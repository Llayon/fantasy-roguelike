/**
 * Tier 4: Armor Shred Module
 *
 * Exports the armor shred processor and related types for the
 * armor degradation system.
 *
 * @module core/mechanics/tier4/armor-shred
 */

export { createArmorShredProcessor, default } from './armor-shred.processor';
export type {
  ArmorShredProcessor,
  UnitWithArmorShred,
  ShredApplicationResult,
  ShredDecayResult,
  ArmorShredDecayResult,
  ArmorShredAttackResult,
  EffectiveArmorResult,
  ShredDecaySkipReason,
} from './armor-shred.types';
export {
  DEFAULT_SHRED_PER_ATTACK,
  DEFAULT_MAX_SHRED_PERCENT,
  DEFAULT_DECAY_PER_TURN,
  SHRED_IMMUNE_TAG,
  ARMORED_TAG,
  ARMORED_SHRED_CAP_PERCENT,
} from './armor-shred.types';
