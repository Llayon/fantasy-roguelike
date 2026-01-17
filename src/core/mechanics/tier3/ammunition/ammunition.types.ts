/**
 * Tier 3: Ammunition & Cooldown - Type Definitions
 *
 * Defines types for the ammunition and cooldown system which tracks
 * resource consumption for ranged units and ability cooldowns for mages.
 *
 * @module core/mechanics/tier3/ammunition
 */

import type { BattleState, BattleUnit } from '../../../types';
import type { AmmoConfig } from '../../config/mechanics.types';
import type { Position } from '../../../types/grid.types';

// ═══════════════════════════════════════════════════════════════
// AMMUNITION CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Default ammunition count for ranged units. */
export const DEFAULT_AMMO_COUNT = 6;

/** Default cooldown duration for mage abilities. */
export const DEFAULT_COOLDOWN_DURATION = 3;

/** Tag that identifies ranged units that use ammunition. */
export const RANGED_TAG = 'ranged';

/** Tag that identifies mage units that use cooldowns. */
export const MAGE_TAG = 'mage';

/** Tag that identifies units with unlimited ammunition. */
export const UNLIMITED_AMMO_TAG = 'unlimited_ammo';

/** Tag that identifies units with reduced cooldowns. */
export const QUICK_COOLDOWN_TAG = 'quick_cooldown';

// ═══════════════════════════════════════════════════════════════
// RESOURCE TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Resource type used by a unit.
 * - ammo: Physical ammunition (arrows, bolts, etc.)
 * - cooldown: Ability cooldowns (mana regeneration, spell preparation)
 * - none: Unit doesn't use resources (melee units)
 */
export type ResourceType = 'ammo' | 'cooldown' | 'none';

/**
 * State of a unit's ammunition.
 * - full: Unit has maximum ammunition
 * - partial: Unit has some ammunition remaining
 * - empty: Unit has no ammunition (cannot use ranged attacks)
 * - reloading: Unit is in the process of reloading
 */
export type AmmoState = 'full' | 'partial' | 'empty' | 'reloading';

/**
 * State of an ability's cooldown.
 * - ready: Ability is ready to use
 * - cooling: Ability is on cooldown
 * - reduced: Cooldown was reduced by an effect
 */
export type CooldownState = 'ready' | 'cooling' | 'reduced';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the ammunition system.
 */
export interface UnitWithAmmunition {
  /** Current ammunition count. */
  ammo?: number | null;
  /** Maximum ammunition capacity. */
  maxAmmo?: number | null;
  /** Current ammunition state. */
  ammoState?: AmmoState;
  /** Ability cooldowns map. Key: ability ID, Value: turns remaining. */
  cooldowns?: Record<string, number>;
  /** Default cooldown duration for abilities. */
  defaultCooldown?: number;
  /** Resource type this unit uses. */
  resourceType?: ResourceType;
  /** Whether unit has unlimited ammunition. */
  hasUnlimitedAmmo?: boolean;
  /** Whether unit has quick cooldown reduction. */
  hasQuickCooldown?: boolean;
  /** Whether unit is currently reloading. */
  isReloading?: boolean;
  /** Unit tags for resource type determination. */
  tags?: string[];
  /** Unit's current position on the grid. */
  position?: Position;
  /** Unit's attack range in cells. */
  range?: number;
}

// ═══════════════════════════════════════════════════════════════
// AMMUNITION CHECK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of checking if a unit can perform a ranged attack.
 */
export interface AmmoCheckResult {
  /** Whether the unit can perform a ranged attack */
  canAttack: boolean;
  /** Whether the unit has ammunition remaining */
  hasAmmo: boolean;
  /** Current ammunition count */
  ammoRemaining: number;
  /** Current ammunition state */
  ammoState: AmmoState;
  /** Reason if attack is blocked */
  reason?: AmmoBlockReason;
}

/**
 * Result of checking if an ability is ready to use.
 */
export interface CooldownCheckResult {
  /** Whether the ability can be used */
  canUse: boolean;
  /** Whether the ability is off cooldown */
  isReady: boolean;
  /** Turns remaining until ready (0 if ready) */
  turnsRemaining: number;
  /** Current cooldown state */
  cooldownState: CooldownState;
  /** Reason if ability is blocked */
  reason?: CooldownBlockReason;
}

/** Reasons why a ranged attack might be blocked. */
export type AmmoBlockReason = 'no_ammo' | 'reloading' | 'not_ranged' | 'disabled';

/** Reasons why an ability might be blocked. */
export type CooldownBlockReason = 'on_cooldown' | 'not_mage' | 'no_ability' | 'disabled';

// ═══════════════════════════════════════════════════════════════
// CONSUMPTION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of consuming ammunition.
 */
export interface AmmoConsumeResult {
  /** Whether ammunition was consumed successfully */
  success: boolean;
  /** Amount of ammunition consumed */
  ammoConsumed: number;
  /** Ammunition remaining after consumption */
  ammoRemaining: number;
  /** New ammunition state */
  newState: AmmoState;
  /** Updated unit with new ammo count */
  unit: BattleUnit & UnitWithAmmunition;
  /** Reason if consumption failed */
  reason?: AmmoBlockReason;
}

/**
 * Result of triggering an ability cooldown.
 */
export interface CooldownTriggerResult {
  /** Whether cooldown was triggered successfully */
  success: boolean;
  /** Ability that was put on cooldown */
  abilityId: string;
  /** Duration of the cooldown in turns */
  cooldownDuration: number;
  /** Updated unit with new cooldown state */
  unit: BattleUnit & UnitWithAmmunition;
  /** Reason if trigger failed */
  reason?: CooldownBlockReason;
}

// ═══════════════════════════════════════════════════════════════
// RELOAD TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of reloading ammunition.
 */
export interface ReloadResult {
  /** Whether reload was successful */
  success: boolean;
  /** Amount of ammunition restored */
  ammoRestored: number;
  /** New ammunition count */
  newAmmo: number;
  /** New ammunition state */
  newState: AmmoState;
  /** Updated unit with restored ammo */
  unit: BattleUnit & UnitWithAmmunition;
  /** Reason if reload failed */
  reason?: ReloadBlockReason;
}

/** Reasons why a reload might fail. */
export type ReloadBlockReason = 'already_full' | 'already_reloading' | 'not_ranged' | 'disabled';

/**
 * Result of reducing cooldowns at turn start.
 */
export interface CooldownTickResult {
  /** Abilities that became ready this turn */
  abilitiesReady: string[];
  /** Abilities still on cooldown */
  abilitiesStillCooling: string[];
  /** Updated cooldown values */
  cooldownsReduced: Record<string, number>;
  /** Updated unit with reduced cooldowns */
  unit: BattleUnit & UnitWithAmmunition;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR OPTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Options for creating an ammunition processor with custom settings.
 */
export interface AmmunitionProcessorOptions {
  /** Custom default ammunition count (default: 6) */
  defaultAmmo?: number;
  /** Custom default cooldown duration (default: 3) */
  defaultCooldown?: number;
  /** Whether to auto-reload at turn start (default: false) */
  autoReload?: boolean;
  /** Amount to auto-reload per turn (default: 0) */
  autoReloadAmount?: number;
  /** Custom tags for ranged units */
  rangedTags?: string[];
  /** Custom tags for mage units */
  mageTags?: string[];
  /** Custom tags for unlimited ammo */
  unlimitedAmmoTags?: string[];
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Ammunition processor interface.
 * Handles all ammunition and cooldown-related mechanics.
 */
export interface AmmunitionProcessor {
  /** Determines the resource type for a unit based on tags. */
  getResourceType(unit: BattleUnit & UnitWithAmmunition): ResourceType;

  /** Checks if a unit can perform a ranged attack. */
  checkAmmo(unit: BattleUnit & UnitWithAmmunition): AmmoCheckResult;

  /** Checks if an ability is ready to use. */
  checkCooldown(unit: BattleUnit & UnitWithAmmunition, abilityId: string): CooldownCheckResult;

  /** Consumes ammunition for a ranged attack. */
  consumeAmmo(
    unit: BattleUnit & UnitWithAmmunition,
    state: BattleState,
    amount?: number,
  ): AmmoConsumeResult;

  /** Triggers cooldown for an ability. */
  triggerCooldown(
    unit: BattleUnit & UnitWithAmmunition,
    abilityId: string,
    state: BattleState,
    duration?: number,
  ): CooldownTriggerResult;

  /** Reloads ammunition for a unit. */
  reload(unit: BattleUnit & UnitWithAmmunition, state: BattleState, amount?: number): ReloadResult;

  /** Reduces all cooldowns by 1 at turn start. */
  tickCooldowns(unit: BattleUnit & UnitWithAmmunition): CooldownTickResult;

  /** Gets the current ammunition state for a unit. */
  getAmmoState(unit: BattleUnit & UnitWithAmmunition): AmmoState;

  /** Gets the cooldown state for an ability. */
  getCooldownState(unit: BattleUnit & UnitWithAmmunition, abilityId: string): CooldownState;

  /** Initializes ammunition/cooldown state for a unit. */
  initializeUnit(
    unit: BattleUnit & UnitWithAmmunition,
    config: AmmoConfig,
  ): BattleUnit & UnitWithAmmunition;
}
