import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Selective planar reflections for the calm basin. Hulls, masts and  */
/*  the jetty (layer 1) are rendered from a camera mirrored in the sea */
/*  plane with an oblique near plane, at half resolution. The water    */
/*  shader projects its surface point into this texture (distorted by  */
/*  the wave normal) and swaps it in for the sky reflection.           */
/* ------------------------------------------------------------------ */

export const REFLECT_LAYER = 1;

export const REFLECTION = {
  uReflTex: { value: null as THREE.Texture | null },
  uReflMatrix: { value: new THREE.Matrix4() },
  uReflOn: { value: 0 },
  /** Mirror strength; low at dusk, when sky glare dominates the water */
  uReflGain: { value: 1 },
};

/**
 * Enables the reflection layer on meshes under the given roots that use one of
 * the listed (large-surface) materials — merged meshes appear late, so re-run periodically.
 */
export function useReflective(roots: MutableRefObject<THREE.Object3D | null>[], enabled: boolean, materials: THREE.Material[]) {
  useFrame(({ clock }) => {
    if (!enabled) return;
    // cheap: a few traversals per second until everything is tagged
    if (Math.floor(clock.elapsedTime * 2) % 2 !== 0) return;
    for (const r of roots) {
      r.current?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && mesh.visible && !o.layers.isEnabled(REFLECT_LAYER) && materials.includes(mesh.material as THREE.Material)) o.layers.enable(REFLECT_LAYER);
      });
    }
  });
}

export function PlanarReflection({ enabled, scale = 0.5 }: { enabled: boolean; scale?: number }) {
  const { gl, size } = useThree();
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.LinearSRGBColorSpace,
        samples: 0,
        depthBuffer: true,
      }),
    [],
  );
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    target.setSize(Math.max(2, Math.round(size.width * dpr * scale)), Math.max(2, Math.round(size.height * dpr * scale)));
  }, [gl, size.width, size.height, scale, target]);
  useEffect(
    () => () => {
      target.dispose();
      REFLECTION.uReflOn.value = 0;
      REFLECTION.uReflTex.value = null;
    },
    [target],
  );

  const tmp = useMemo(
    () => ({
      cam: new THREE.PerspectiveCamera(),
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      up: new THREE.Vector3(),
      plane: new THREE.Plane(),
      clip: new THREE.Vector4(),
      q: new THREE.Vector4(),
      bias: new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1),
    }),
    [],
  );

  useFrame(({ scene, camera, clock }) => {
    // lights are layer-culled too: make sure every light also lights the mirror pass
    if (enabled && Math.floor(clock.elapsedTime * 2) % 4 === 0)
      scene.traverse((o) => {
        if ((o as THREE.Light).isLight && !o.layers.isEnabled(REFLECT_LAYER)) o.layers.enable(REFLECT_LAYER);
      });
    if (!enabled) {
      REFLECTION.uReflOn.value = 0;
      return;
    }
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.position.y <= 0.05) {
      REFLECTION.uReflOn.value = 0;
      return;
    }
    const v = tmp.cam;
    // mirrored camera (proper rotation: reflect position, look target and up)
    tmp.pos.copy(cam.position).setY(-cam.position.y);
    tmp.look.set(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
    tmp.look.y = -tmp.look.y;
    tmp.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    tmp.up.y = -tmp.up.y;
    v.position.copy(tmp.pos);
    v.up.copy(tmp.up);
    v.lookAt(tmp.look);
    v.far = cam.far;
    v.near = cam.near;
    v.fov = cam.fov;
    v.aspect = cam.aspect;
    v.updateMatrixWorld();
    v.updateProjectionMatrix();
    v.layers.set(REFLECT_LAYER);

    // oblique near plane = the sea surface (clip everything under the water)
    tmp.plane.set(new THREE.Vector3(0, 1, 0), 0.02);
    tmp.plane.applyMatrix4(v.matrixWorldInverse);
    tmp.clip.set(tmp.plane.normal.x, tmp.plane.normal.y, tmp.plane.normal.z, tmp.plane.constant);
    const e = v.projectionMatrix.elements;
    tmp.q.x = (Math.sign(tmp.clip.x) + e[8]) / e[0];
    tmp.q.y = (Math.sign(tmp.clip.y) + e[9]) / e[5];
    tmp.q.z = -1.0;
    tmp.q.w = (1.0 + e[10]) / e[14];
    tmp.clip.multiplyScalar(2.0 / tmp.clip.dot(tmp.q));
    e[2] = tmp.clip.x;
    e[6] = tmp.clip.y;
    e[10] = tmp.clip.z + 1.0;
    e[14] = tmp.clip.w;
    v.projectionMatrixInverse.copy(v.projectionMatrix).invert();

    REFLECTION.uReflMatrix.value.copy(tmp.bias).multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);

    const prevTarget = gl.getRenderTarget();
    const prevAuto = gl.shadowMap.autoUpdate;
    const prevClear = gl.getClearColor(new THREE.Color());
    const prevAlpha = gl.getClearAlpha();
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    // The mirror sees undersides (jetty deck, hull bottoms) lit almost only by the environment —
    // at dusk that light is deep orange. Dim it for this pass so they read as shadowed timber.
    const prevEnv = scene.environmentIntensity;
    scene.environmentIntensity = prevEnv * 0.3;
    gl.render(scene, v);
    scene.environmentIntensity = prevEnv;
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
    gl.shadowMap.autoUpdate = prevAuto;

    REFLECTION.uReflTex.value = target.texture;
    REFLECTION.uReflOn.value = 1;
  });
  return null;
}
