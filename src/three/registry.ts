import type { SceneId } from '@/data/types';
import type { SceneModule } from './core/types';

/** Lazy loaders so each 3D venue is code-split into its own chunk. */
export const SCENE_LOADERS: Record<SceneId, () => Promise<SceneModule>> = {
  farm: () => import('./scenes/farm'),
  apiary: () => import('./scenes/apiary'),
  pottery: () => import('./scenes/pottery'),
  harbour: () => import('./scenes/harbour'),
  atelier: () => import('./scenes/atelier'),
};
