import { useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { SceneId } from '@/data/types';
import { PROVIDERS } from '@/data/catalog';
import { SceneCanvas, type Framing, type ViewerApi } from '@/three/core/SceneCanvas';
import type { Quality, Variant } from '@/three/core/types';

/**
 * Developer harness: renders one venue full-screen for visual QA and poster renders.
 * /dev/scene/farm?variant=golden&quality=high&provider=ghaf-grove&hotspot=garden
 * Extra params: framing=wide|tall (fixed camera pose), ui=0 (hide this toolbar).
 * Without `variant`, the provider's own lighting is used.
 */
export default function DevScene() {
  const { id = 'farm' } = useParams();
  const [params, setParams] = useSearchParams();
  const quality = (params.get('quality') as Quality) || undefined;
  const providerId = params.get('provider');
  const provider = useMemo(
    () => PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS.find((p) => p.scene.id === id && p.flagship) ?? PROVIDERS.find((p) => p.scene.id === id),
    [providerId, id],
  );
  const variant = (params.get('variant') as Variant) || provider?.scene.variant || 'golden';
  const framingParam = params.get('framing');
  const framing: Framing | 'auto' = framingParam === 'wide' || framingParam === 'tall' ? framingParam : 'auto';
  const showUi = params.get('ui') !== '0';
  const [active, setActive] = useState<string | null>(params.get('hotspot'));
  const api = useRef<ViewerApi | null>(null);
  const [ready, setReady] = useState(false);
  const hotspots = provider?.scene.hotspots.map((h) => ({ id: h.id, title: h.title, kicker: h.kicker })) ?? [];

  return (
    <div className="fixed inset-0 bg-black">
      <SceneCanvas
        sceneId={id as SceneId}
        variant={variant}
        features={provider?.scene.features}
        hotspots={params.get('pins') === '0' ? [] : hotspots}
        active={active}
        onSelect={setActive}
        autoRotate={params.get('rotate') !== '0'}
        intro={params.get('intro') !== '0'}
        interactive
        wheel
        quality={quality}
        framing={framing}
        apiRef={api}
        onReady={() => setReady(true)}
        className="absolute inset-0"
      />
      <div className={showUi ? 'pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-xs' : 'hidden'}>
        <span className="pointer-events-auto rounded-full bg-black/60 px-3 py-1.5 font-semibold text-white">
          {id} · {variant} · {quality ?? 'adaptive'} {ready ? '· ready' : '· loading'}
        </span>
        {(['golden', 'morning', 'dusk'] as Variant[]).map((v) => (
          <button
            key={v}
            className="pointer-events-auto rounded-full bg-white/80 px-3 py-1.5 font-semibold text-black"
            onClick={() => {
              params.set('variant', v);
              setParams(params);
            }}
          >
            {v}
          </button>
        ))}
        {hotspots.map((h) => (
          <button key={h.id} className="pointer-events-auto rounded-full bg-white/80 px-3 py-1.5 text-black" onClick={() => setActive(h.id)}>
            {h.id}
          </button>
        ))}
        <button className="pointer-events-auto rounded-full bg-white/80 px-3 py-1.5 text-black" onClick={() => setActive(null)}>
          home
        </button>
      </div>
      {ready && <div id="scene-ready" className="hidden" />}
    </div>
  );
}
