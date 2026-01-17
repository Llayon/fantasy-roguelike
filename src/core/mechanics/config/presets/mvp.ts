/**
 * MVP Preset - All mechanics disabled
 *
 * @module core/mechanics/config/presets
 */

import type { MechanicsConfig } from '../mechanics.types';

/**
 * MVP Preset: All mechanics disabled.
 * Produces identical results to core 1.0.
 */
export const MVP_PRESET: MechanicsConfig = {
  facing: false,
  resolve: false,
  engagement: false,
  flanking: false,
  riposte: false,
  intercept: false,
  aura: false,
  charge: false,
  overwatch: false,
  phalanx: false,
  lineOfSight: false,
  ammunition: false,
  contagion: false,
  armorShred: false,
};
