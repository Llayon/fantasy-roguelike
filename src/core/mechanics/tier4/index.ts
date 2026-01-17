/**
 * Tier 4: Advanced Mechanics
 *
 * Exports for tier 4 mechanics:
 * - Contagion (status effect spreading)
 * - Armor Shred (armor degradation)
 *
 * @module core/mechanics/tier4
 */

// Contagion (Status Effect Spreading)
export {
  createContagionProcessor,
  CONTAGION_IMMUNE_TAG,
  NO_SPREAD_TAG,
  MIN_SPREAD_DURATION,
  DEFAULT_FIRE_SPREAD,
  DEFAULT_POISON_SPREAD,
  DEFAULT_CURSE_SPREAD,
  DEFAULT_FROST_SPREAD,
  DEFAULT_PLAGUE_SPREAD,
  DEFAULT_FEAR_SPREAD,
  DEFAULT_PHALANX_SPREAD_BONUS,
} from './contagion';
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
} from './contagion';

// Armor Shred (Armor Degradation)
export {
  createArmorShredProcessor,
  DEFAULT_SHRED_PER_ATTACK,
  DEFAULT_MAX_SHRED_PERCENT,
  DEFAULT_DECAY_PER_TURN,
  SHRED_IMMUNE_TAG,
  ARMORED_TAG,
  ARMORED_SHRED_CAP_PERCENT,
} from './armor-shred';
export type {
  ArmorShredProcessor,
  UnitWithArmorShred,
  ShredApplicationResult,
  ShredDecayResult,
  ArmorShredDecayResult,
  ArmorShredAttackResult,
  EffectiveArmorResult,
  ShredDecaySkipReason,
} from './armor-shred';
