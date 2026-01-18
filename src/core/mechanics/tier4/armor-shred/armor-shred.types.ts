/**
 * Tier 4: Armor Shred - Type Definitions
 *
 * Defines types for the armor shred system which handles the degradation
 * of armor through physical attacks and decay over time.
 *
 * Key mechanics:
 * - Each physical attack applies shred = attacker.ATK * shredPerAttack
 * - Shred accumulates on target up to maxShredPercent of base armor
 * - At turn_end, shred decays by decayPerTurn points
 * - Undead units don't decay (permanent until death)
 * - Effective armor = max(0, baseArmor - armorShred)
 *
 * @module core/mechanics/tier4/armor-shred
 */

import type { BattleState, BattleUnit } from '../../../types';

// ═══════════════════════════════════════════════════════════════
// ARMOR SHRED CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default shred per attack (1 point).
 */
export const DEFAULT_SHRED_PER_ATTACK = 1;

/**
 * Default maximum shred as percentage of base armor (40%).
 */
export const DEFAULT_MAX_SHRED_PERCENT = 0.4;

/**
 * Default shred decay per turn (2 points).
 */
export const DEFAULT_DECAY_PER_TURN = 2;

/**
 * Tag that identifies units immune to armor shred.
 */
export const SHRED_IMMUNE_TAG = 'shred_immune';

/**
 * Tag that identifies armored units (shred capped at 50% of armor).
 */
export const ARMORED_TAG = 'armored';

/**
 * Armored units have shred capped at this percentage of armor.
 */
export const ARMORED_SHRED_CAP_PERCENT = 0.5;

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the armor shred system.
 * These properties are added to BattleUnit when armor shred mechanic is enabled.
 */
export interface UnitWithArmorShred {
  /** Current armor shred accumulated on this unit */
  armorShred: number;

  /** Base armor value (before shred) */
  baseArmor?: number;

  /** Whether unit is immune to armor shred */
  shredImmune?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SHRED CALCULATION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of calculating shred to apply from an attack.
 */
export interface ShredApplicationResult {
  /** Amount of shred applied */
  shredApplied: number;

  /** New total shred on target */
  newShred: number;

  /** Whether shred was capped */
  wasCapped: boolean;

  /** Maximum shred allowed for this unit */
  maxShred: number;
}

/**
 * Result of calculating shred decay at turn end.
 */
export interface ShredDecayResult {
  /** Amount of shred that decayed */
  decayAmount: number;

  /** Remaining shred after decay */
  remainingShred: number;

  /** Whether decay was skipped (e.g., undead) */
  decaySkipped: boolean;

  /** Reason for skipping decay */
  skipReason?: ShredDecaySkipReason;
}

/**
 * Reasons why shred decay might be skipped.
 */
export type ShredDecaySkipReason = 'undead' | 'no_shred' | 'unit_dead' | 'decay_disabled';

/**
 * Result of processing shred decay for a unit.
 */
export interface ArmorShredDecayResult {
  /** Unit ID that was processed */
  unitId: string;

  /** Decay calculation result */
  decay: ShredDecayResult;

  /** Updated battle state */
  state: BattleState;
}

/**
 * Result of applying shred from an attack.
 */
export interface ArmorShredAttackResult {
  /** Attacker unit ID */
  attackerId: string;

  /** Target unit ID */
  targetId: string;

  /** Shred application result */
  application: ShredApplicationResult;

  /** Updated battle state */
  state: BattleState;
}

// ═══════════════════════════════════════════════════════════════
// EFFECTIVE ARMOR TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of calculating effective armor.
 */
export interface EffectiveArmorResult {
  /** Base armor value */
  baseArmor: number;

  /** Current shred on unit */
  currentShred: number;

  /** Effective armor after shred */
  effectiveArmor: number;

  /** Percentage of armor reduced */
  reductionPercent: number;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Armor Shred processor interface.
 * Handles all armor shred-related mechanics including application,
 * decay, and effective armor calculation.
 */
export interface ArmorShredProcessor {
  /**
   * Calculates the effective armor for a unit after shred.
   * @param unit - Unit to calculate effective armor for
   * @returns Effective armor result
   */
  getEffectiveArmor(unit: BattleUnit & UnitWithArmorShred): EffectiveArmorResult;

  /**
   * Calculates shred to apply from an attack.
   * @param attacker - Attacking unit
   * @param target - Target unit
   * @returns Shred application result
   */
  calculateShredFromAttack(
    attacker: BattleUnit,
    target: BattleUnit & UnitWithArmorShred,
  ): ShredApplicationResult;

  /**
   * Applies shred from an attack to a target.
   * @param state - Current battle state
   * @param attackerId - Attacker unit ID
   * @param targetId - Target unit ID
   * @returns Updated state and application result
   */
  applyShredFromAttack(
    state: BattleState,
    attackerId: string,
    targetId: string,
  ): ArmorShredAttackResult;

  /**
   * Calculates shred decay for a unit at turn end.
   * @param unit - Unit to calculate decay for
   * @returns Shred decay result
   */
  calculateDecay(unit: BattleUnit & UnitWithArmorShred): ShredDecayResult;

  /**
   * Processes shred decay for a unit at turn end.
   * @param state - Current battle state
   * @param unitId - Unit whose shred should decay
   * @returns Updated state and decay result
   */
  processDecay(state: BattleState, unitId: string): ArmorShredDecayResult;

  /**
   * Checks if a unit is immune to armor shred.
   * @param unit - Unit to check
   * @returns True if unit is immune
   */
  isImmune(unit: BattleUnit & UnitWithArmorShred): boolean;

  /**
   * Checks if a unit has the armored tag (reduced shred cap).
   * @param unit - Unit to check
   * @returns True if unit is armored
   */
  isArmored(unit: BattleUnit): boolean;

  /**
   * Gets the maximum shred allowed for a unit.
   * @param unit - Unit to check
   * @returns Maximum shred value
   */
  getMaxShred(unit: BattleUnit & UnitWithArmorShred): number;

  /**
   * Checks if shred decay is enabled for a unit.
   * @param unit - Unit to check
   * @returns True if decay is enabled
   */
  canDecay(unit: BattleUnit & UnitWithArmorShred): boolean;
}
