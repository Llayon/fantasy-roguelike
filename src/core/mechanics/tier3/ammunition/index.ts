/**
 * Ammunition Processor - Tier 3 Mechanic
 *
 * @module core/mechanics/tier3/ammunition
 */

export { createAmmunitionProcessor } from './ammunition.processor';
export type {
  AmmunitionProcessor,
  UnitWithAmmunition,
  ResourceType,
  AmmoState,
  CooldownState,
  AmmoCheckResult,
  CooldownCheckResult,
  AmmoConsumeResult,
  CooldownTriggerResult,
  ReloadResult,
  CooldownTickResult,
  AmmunitionProcessorOptions,
  AmmoBlockReason,
  CooldownBlockReason,
  ReloadBlockReason,
} from './ammunition.types';
export {
  DEFAULT_AMMO_COUNT,
  DEFAULT_COOLDOWN_DURATION,
  RANGED_TAG,
  MAGE_TAG,
  UNLIMITED_AMMO_TAG,
  QUICK_COOLDOWN_TAG,
} from './ammunition.types';
