import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, PerformanceMonitor } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import type { SceneId } from '@/data/types';
import { cn } from '@/lib/utils';
import { SCENE_LOADERS } from '../registry';
import { windUniforms } from '../materials/wind';
import { Effects } from './Effects';
import { Hotspot } from './Hotspot';
import type { Quality, SceneConfig, SceneModule, Variant } from './types';

export interface ViewerApi {
  zoom: (delta: number) => void;
  reset: () => void;
  setInteractive: (v: boolean) => void;
}

export interface SceneHotspot {
  id: string;
  title: string;
  kicker?: string;
}

export interface SceneCanvasProps {
  sceneId: SceneId;
  variant: Variant;
  features?: string[];
  hotspots?: SceneHotspot[];
  active?: string | null;
  onSelect?: (id: string | null) => void;
  accent?: string;
  autoRotate?: boolean;
  intro?: boolean;
  /** Pointer/touch camera control. Wheel zoom only when `wheel` is true. */
  interactive?: boolean;
  wheel?: boolean;
  apiRef?: MutableRefObject<ViewerApi | null>;
  onReady?: () => void;
  className?: string;
  /** Force a quality tier (otherwise adaptive) */
  quality?: Quality;
  /** Camera framing: 'auto' picks wide or tall from the canvas aspect (see framingFor) */
  framing?: Framing | 'auto';
  children?: ReactNode;
}

export type Framing = 'wide' | 'tall';
/** Canvases narrower than this use the pulled-back 'tall' pose. Posters are rendered for both poses. */
export const FRAMING_SPLIT = 1.2;
export const framingFor = (aspect: number): Framing => (aspect >= FRAMING_SPLIT ? 'wide' : 'tall');

function initialQuality(): Quality {
  if (typeof window === 'undefined') return 'medium';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (coarse || small) return 'medium';
  if (cores <= 4) return 'medium';
  return 'high';
}

/** Loads a venue module lazily and keeps it cached between mounts. */
const moduleCache = new Map<SceneId, SceneModule>();
function useSceneModule(id: SceneId) {
  const [mod, setMod] = useState<SceneModule | null>(() => moduleCache.get(id) ?? null);
  useEffect(() => {
    let alive = true;
    if (moduleCache.has(id)) {
      setMod(moduleCache.get(id)!);
      return;
    }
    setMod(null);
    SCENE_LOADERS[id]().then((m) => {
      moduleCache.set(id, m);
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return mod;
}

function useInView<T extends Element>(ref: React.RefObject<T>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

export function SceneCanvas({
  sceneId,
  variant,
  features,
  hotspots = [],
  active = null,
  onSelect,
  accent = '#B5502B',
  autoRotate = true,
  intro = true,
  interactive = true,
  wheel = false,
  apiRef,
  onReady,
  className,
  quality: forced,
  framing = 'auto',
  children,
}: SceneCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap);
  const mod = useSceneModule(sceneId);
  const [quality, setQuality] = useState<Quality>(forced ?? initialQuality());

  useEffect(() => {
    if (forced) setQuality(forced);
  }, [forced]);

  const config = mod?.config;
  const Scene = mod?.default;
  // Frames stay paused until every shader program has been built off the main thread
  const [warmFor, setWarmFor] = useState<SceneId | null>(null);
  const warm = warmFor === sceneId;
  const running = inView && warm;

  return (
    <div ref={wrap} className={cn('relative overflow-hidden', className)} style={{ background: config?.background ?? '#E8DCC6' }}>
      {config && Scene && (
        <Canvas
          shadows="soft"
          flat
          dpr={quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [1, 1]}
          frameloop={running ? 'always' : 'never'}
          camera={{ fov: config.fov ?? 38, near: 0.1, far: 2400, position: config.home.position }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
          onCreated={(state) => {
            state.gl.outputColorSpace = THREE.SRGBColorSpace;
            state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
          style={{ position: 'absolute', inset: 0, touchAction: interactive ? 'none' : 'pan-y' }}
        >
          {!forced && (
            <PerformanceMonitor
              ms={400}
              iterations={6}
              threshold={0.6}
              flipflops={2}
              bounds={() => [42, 120]}
              onDecline={() => setQuality((q) => (q === 'high' ? 'medium' : 'low'))}
            />
          )}
          <WindTicker />
          {import.meta.env.DEV && <DevStats />}
          <Suspense fallback={null}>
            <Scene variant={variant} quality={quality} active={active} features={features} />
            <ShaderWarmup key={sceneId} onDone={() => setWarmFor(sceneId)} />
            <ReadySignal onReady={onReady} />
          </Suspense>
          <CameraRig
            config={config}
            active={active}
            autoRotate={autoRotate}
            intro={intro}
            interactive={interactive}
            wheel={wheel}
            apiRef={apiRef}
            warm={warm}
            framing={framing}
          />
          {warm && <Pins hotspots={hotspots} config={config} active={active} accent={accent} onSelect={onSelect} />}
          <Effects quality={quality} />
        </Canvas>
      )}
      {children}
    </div>
  );
}

/** Dev-only: writes renderer stats into a hidden DOM node for automated QA. */
function DevStats() {
  const { gl, scene } = useThree();
  const acc = useRef({ t: 0, frames: 0, calls: 0, tris: 0 });
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame((_, dt) => {
    acc.current.calls = gl.info.render.calls;
    acc.current.tris = gl.info.render.triangles;
    gl.info.reset();
    acc.current.t += dt;
    acc.current.frames += 1;
    if (acc.current.t < 1.5) return;
    let el = document.getElementById('r3f-debug');
    if (!el) {
      el = document.createElement('pre');
      el.id = 'r3f-debug';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    const lights: unknown[] = [];
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight)
        lights.push({ cast: l.castShadow, pos: l.position.toArray().map((v) => +v.toFixed(1)), cam: [l.shadow.camera.left, l.shadow.camera.right, l.shadow.camera.far], map: !!l.shadow.map, i: l.intensity });
    });
    el.textContent = JSON.stringify({
      fps: Math.round(acc.current.frames / acc.current.t),
      calls: acc.current.calls,
      tris: acc.current.tris,
      geos: gl.info.memory.geometries,
      tex: gl.info.memory.textures,
      progs: gl.info.programs?.length ?? 0,
      shadow: gl.shadowMap.enabled,
      lights,
    });
    acc.current = { t: 0, frames: 0, calls: 0, tris: 0 };
  });
  return null;
}

function WindTicker() {
  useFrame((_, dt) => {
    windUniforms.uTime.value += Math.min(dt, 0.05);
  });
  return null;
}

/**
 * Builds every material's shader program before the first frame, in parallel on the
 * driver's worker threads (KHR_parallel_shader_compile). Without it the first frame
 * compiles ~50 programs synchronously and freezes the whole tab for seconds — scrolling,
 * the loading animation, everything.
 */
function ShaderWarmup({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let alive = true;
    const finish = () => {
      if (!alive) return;
      alive = false;
      done.current();
    };
    // Programs are keyed on the output target: the composer renders the scene linear into a buffer
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
    // Let layout effects settle first (environment maps, static batching)
    const start = window.setTimeout(() => {
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(rt);
        const pending = gl.compileAsync(scene, camera);
        gl.setRenderTarget(prev);
        pending.then(finish, finish);
      } catch {
        gl.setRenderTarget(prev);
        finish();
      }
    }, 0);
    const safety = window.setTimeout(finish, 12000);
    return () => {
      alive = false;
      window.clearTimeout(start);
      window.clearTimeout(safety);
      rt.dispose();
    };
  }, [gl, scene, camera]);
  return null;
}

/** Hotspot pins, sized to the viewer: full labels on desktop, numbered dots on phones. */
function Pins({
  hotspots,
  config,
  active,
  accent,
  onSelect,
}: {
  hotspots: SceneHotspot[];
  config: SceneConfig;
  active: string | null;
  accent: string;
  onSelect?: (id: string | null) => void;
}) {
  const width = useThree((s) => s.size.width);
  return (
    <>
      {hotspots.map((h, i) => {
        const anchor = config.anchors[h.id];
        if (!anchor) return null;
        return (
          <Hotspot
            key={h.id}
            id={h.id}
            index={i}
            position={anchor.position}
            label={h.title}
            kicker={h.kicker}
            active={active === h.id}
            dimmed={!!active}
            accent={accent}
            compact={width < 560}
            hideKicker={width < 760}
            onSelect={(id) => onSelect?.(active === id ? null : id)}
          />
        );
      })}
    </>
  );
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    if (frames.current > 3) {
      done.current = true;
      onReady?.();
    }
  });
  return null;
}

interface RigProps {
  warm: boolean;
  framing: Framing | 'auto';
  config: SceneConfig;
  active: string | null;
  autoRotate: boolean;
  intro: boolean;
  interactive: boolean;
  wheel: boolean;
  apiRef?: MutableRefObject<ViewerApi | null>;
}

/**
 * Venue home poses are composed for ~16:10 landscape. On narrower (portrait) canvases pull the
 * camera back along its view ray so the sides of the venue — and their pins — stay in frame.
 */
function framedHome(config: SceneConfig, aspect: number, framing: Framing | 'auto') {
  // Two fixed poses (not a continuous pull-back) so a poster rendered once per pose matches the
  // live view exactly at any size: with a fixed vertical FOV a narrower canvas is a centre crop.
  const mode = framing === 'auto' ? framingFor(aspect) : framing;
  const k = mode === 'wide' ? 1 : 1.45;
  const t = config.home.target;
  const p = config.home.position;
  const position: [number, number, number] = [t[0] + (p[0] - t[0]) * k, t[1] + (p[1] - t[1]) * k, t[2] + (p[2] - t[2]) * k];
  const dist = Math.hypot(position[0] - t[0], position[1] - t[1], position[2] - t[2]);
  return { position, target: t, dist };
}

function CameraRig({ config, active, autoRotate, intro, interactive, wheel, apiRef, warm, framing }: RigProps) {
  const ref = useRef<CameraControls>(null);
  const lastInteraction = useRef(performance.now());
  const started = useRef(false);
  const { camera } = useThree();
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const home = useMemo(() => framedHome(config, aspect, framing), [config, aspect, framing]);
  const homeRef = useRef(home);
  homeRef.current = home;
  // A pin may be chosen while shaders are still warming up — boot honours it
  const activeRef = useRef(active);
  activeRef.current = active;
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  // Boot: cinematic dolly-in from a wider, higher pose (once shaders are warm and frames run)
  useEffect(() => {
    const c = ref.current;
    if (!c || started.current || !warm) return;
    started.current = true;
    const home = homeRef.current;
    if (config.controls.boundary) {
      const { min, max } = config.controls.boundary;
      c.setBoundary(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    }
    const chosen = activeRef.current ? config.anchors[activeRef.current]?.camera : undefined;
    if (chosen) {
      // Start at home and fly straight to the hotspot the visitor already picked
      c.setLookAt(...home.position, ...home.target, false);
      c.smoothTime = 0.7;
      const id = window.setTimeout(() => {
        c.setLookAt(...chosen.position, ...chosen.target, true).then(() => {
          c.smoothTime = 0.55;
        });
      }, 60);
      return () => window.clearTimeout(id);
    }
    if (intro && !reducedMotion) {
      const p = new THREE.Vector3(...home.position);
      const t = new THREE.Vector3(...home.target);
      const off = p.clone().sub(t).multiplyScalar(1.55);
      off.y *= 1.25;
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
      c.setLookAt(t.x + off.x, t.y + off.y, t.z + off.z, t.x, t.y, t.z, false);
      c.smoothTime = 1.4;
      const id = window.setTimeout(() => {
        c.setLookAt(...home.position, ...home.target, true).then(() => {
          c.smoothTime = 0.55;
        });
      }, 60);
      return () => window.clearTimeout(id);
    }
    c.setLookAt(...home.position, ...home.target, false);
  }, [config, intro, reducedMotion, warm]);

  // Fly to the selected hotspot (or back home)
  useEffect(() => {
    const c = ref.current;
    if (!c || !started.current) return;
    const pose = active ? config.anchors[active]?.camera : homeRef.current;
    if (!pose) return;
    c.smoothTime = 0.7;
    c.setLookAt(...pose.position, ...pose.target, true).then(() => {
      c.smoothTime = 0.55;
    });
    lastInteraction.current = performance.now();
  }, [active, config]);

  // Input configuration
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const A = CameraControlsImpl.ACTION;
    c.mouseButtons.left = interactive ? A.ROTATE : A.NONE;
    c.mouseButtons.right = interactive ? A.TRUCK : A.NONE;
    c.mouseButtons.middle = interactive ? A.DOLLY : A.NONE;
    c.mouseButtons.wheel = interactive && wheel ? A.DOLLY : A.NONE;
    c.touches.one = interactive ? A.TOUCH_ROTATE : A.NONE;
    c.touches.two = interactive ? A.TOUCH_DOLLY_TRUCK : A.NONE;
    c.touches.three = A.NONE;
  }, [interactive, wheel]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      zoom: (d) => {
        ref.current?.dolly(d, true);
        lastInteraction.current = performance.now();
      },
      reset: () => {
        ref.current?.setLookAt(...homeRef.current.position, ...homeRef.current.target, true);
        lastInteraction.current = performance.now();
      },
      setInteractive: () => {},
    };
  }, [apiRef, config]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c || !autoRotate || active || reducedMotion) return;
    if (performance.now() - lastInteraction.current > 6000) c.rotate(dt * 0.045, 0, false);
  });

  void camera;
  const { controls } = config;
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={controls.minDistance}
      maxDistance={Math.max(controls.maxDistance, home.dist * 1.15)}
      minPolarAngle={controls.minPolarAngle}
      maxPolarAngle={controls.maxPolarAngle}
      minAzimuthAngle={controls.minAzimuthAngle ?? -Infinity}
      maxAzimuthAngle={controls.maxAzimuthAngle ?? Infinity}
      smoothTime={0.55}
      draggingSmoothTime={0.18}
      dollySpeed={0.6}
      truckSpeed={1.2}
      onStart={() => {
        lastInteraction.current = performance.now();
      }}
      onEnd={() => {
        lastInteraction.current = performance.now();
      }}
    />
  );
}
