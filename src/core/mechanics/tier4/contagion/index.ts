/**
 * Tier 4: Contagion (Status Effect Spreading)
 *
 * Exports for the contagion mechanic module.
 *
 * @module core/mechanics/tier4/contagion
 */

export { createContagionProcessor } from './contagion.processor';
export type {
  ContagionProcessor,
  UnitWithContagion,
  ContagionEffectType,
  StatusEffect,
  SpreadEligibility,
  SpreadBlockReason,
  SpreadAttemptResult,
  ContagionSpreadResult,
  AdjacentTarget,
} from './contagion.types';
export {
  CONTAGION_IMMUNE_TAG,
  NO_SPREAD_TAG,
  MIN_SPREAD_DURATION,
  ORTHOGONAL_OFFSETS,
  DEFAULT_FIRE_SPREAD,
  DEFAULT_POISON_SPREAD,
  DEFAULT_CURSE_SPREAD,
  DEFAULT_FROST_SPREAD,
  DEFAULT_PLAGUE_SPREAD,
  DEFAULT_FEAR_SPREAD,
  DEFAULT_PHALANX_SPREAD_BONUS,
} from './contagion.types';
