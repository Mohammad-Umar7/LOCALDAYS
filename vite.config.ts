import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Packages only the 3D views need — kept out of the app-wide vendor chunk. */
const THREE_DEPS = new Set([
  'three-stdlib',
  'camera-controls',
  'maath',
  'troika-three-text',
  'troika-three-utils',
  'troika-worker-utils',
  'webgl-sdf-generator',
  'bidi-js',
  'meshline',
  '@use-gesture/core',
  '@use-gesture/react',
  'detect-gpu',
  'suspend-react',
  'its-fine',
  'react-reconciler',
  'react-use-measure',
  'debounce',
  '@monogrid/gainmap-js',
  'hls.js',
  'stats-gl',
  'stats.js',
  'three-mesh-bvh',
  '@mediapipe/tasks-vision',
  'tunnel-rat',
  'glsl-noise',
  'react-composer',
  'simplex-noise',
  'zustand/vanilla',
]);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        // Manual chunks pull in every unassigned dependency (zustand → r3f → three), so app-wide
        // packages are pinned to 'vendor' explicitly. Without this, every page downloaded the
        // whole 3D engine; now three/r3f/post only load where a 3D view is shown.
        manualChunks(id) {
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor';
          if (!id.includes('/node_modules/')) return undefined;
          const pkg = id.split('/node_modules/').pop()!.split('/');
          const name = pkg[0].startsWith('@') ? `${pkg[0]}/${pkg[1]}` : pkg[0];
          if (name === 'three') return 'three';
          if (name === '@react-three/postprocessing' || name === 'postprocessing' || name === 'n8ao') return 'post';
          if (name.startsWith('@react-three/') || THREE_DEPS.has(name)) return 'r3f';
          if (name === 'framer-motion' || name === 'motion-dom' || name === 'motion-utils') return 'motion';
          return 'vendor';
        },
      },
    },
  },
});
