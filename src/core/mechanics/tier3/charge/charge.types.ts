/**
 * Tier 3: Charge (Cavalry Momentum) - Type Definitions
 *
 * Defines types for the charge system which provides damage bonuses
 * based on distance moved before attacking. Charge is primarily used
 * by cavalry units and can be countered by spearmen with Spear Wall.
 *
 * Key mechanics:
 * - Momentum builds based on distance moved (cells traveled)
 * - Momentum provides damage bonus on attack
 * - Charge impact deals additional resolve damage (shock)
 * - Spear Wall units can counter and stop charges
 * - Minimum distance required to qualify for charge bonus
 *
 * @module core/mechanics/tier3/charge
 */

import type { BattleState, BattleUnit, Position } from '../../../types';
import type { ChargeConfig } from '../../config/mechanics.types';

// ═══════════════════════════════════════════════════════════════
// CHARGE CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default momentum bonus per cell moved.
 * 0.2 = +20% damage per cell.
 */
export const DEFAULT_MOMENTUM_PER_CELL = 0.2;

/**
 * Default maximum momentum bonus cap.
 * 1.0 = +100% maximum damage bonus.
 */
export const DEFAULT_MAX_MOMENTUM = 1.0;

/**
 * Default minimum distance required for charge bonus.
 * Unit must move at least this many cells to gain momentum.
 */
export const DEFAULT_MIN_CHARGE_DISTANCE = 3;

/**
 * Default resolve damage on charge impact.
 * Applied in addition to HP damage when charging.
 */
export const DEFAULT_SHOCK_RESOLVE_DAMAGE = 10;

/**
 * Damage multiplier for Spear Wall counter-attack.
 * Spearmen deal bonus damage when stopping a charge.
 */
export const SPEAR_WALL_COUNTER_MULTIPLIER = 1.5;

/**
 * Tag that identifies units capable of countering charges (spearmen).
 */
export const SPEAR_WALL_TAG = 'spear_wall';

/**
 * Tag that identifies units capable of charging (cavalry).
 */
export const CAVALRY_TAG = 'cavalry';

/**
 * Tag that identifies units with charge capability.
 */
export const CHARGE_TAG = 'charge';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the charge system.
 */
export interface UnitWithCharge {
  /** Whether unit is capable of charging */
  canCharge?: boolean;
  /** Current momentum accumulated from movement */
  momentum?: number;
  /** Whether unit is currently in a charge state */
  isCharging?: boolean;
  /** Distance moved this turn */
  chargeDistance?: number;
  /** Starting position at turn start */
  chargeStartPosition?: Position;
  /** Whether unit's charge was countered this turn */
  chargeCountered?: boolean;
  /** Unit tags for charge type determination */
  tags?: string[];
  /** Whether unit has Spear Wall ability */
  hasSpearWall?: boolean;
  /** Unit's base attack value */
  atk?: number;
  /** Unit's current HP */
  currentHp?: number;
  /** Unit's current resolve */
  resolve?: number;
}

// ═══════════════════════════════════════════════════════════════
// CHARGE RESULT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of a charge eligibility check.
 */
export interface ChargeEligibility {
  /** Whether the unit can perform a charge attack */
  canCharge: boolean;
  /** Reason if charge is not possible */
  reason?: ChargeBlockReason;
  /** Distance moved */
  distance: number;
  /** Calculated momentum (if eligible) */
  momentum: number;
}

/**
 * Reasons why a charge might be blocked.
 */
export type ChargeBlockReason =
  | 'insufficient_distance'
  | 'no_charge_ability'
  | 'already_charged'
  | 'countered'
  | 'no_target'
  | 'disabled';

/**
 * Result of a Spear Wall counter check.
 */
export interface SpearWallCounterResult {
  /** Whether the charge was countered */
  isCountered: boolean;
  /** Damage dealt to the charger by Spear Wall */
  counterDamage: number;
  /** Whether the charger's movement was stopped */
  chargerStopped: boolean;
  /** Position where charger was stopped */
  stoppedAt?: Position;
  /** Spearman unit that performed the counter */
  counteredBy?: BattleUnit;
}

/**
 * Result of executing a charge attack.
 */
export interface ChargeExecutionResult {
  /** Whether charge was executed successfully */
  success: boolean;
  /** Total damage dealt (base + bonus) */
  damage: number;
  /** Target's HP after charge */
  targetNewHp: number;
  /** Shock resolve damage dealt */
  shockDamage: number;
  /** Target's resolve after shock */
  targetNewResolve: number;
  /** Momentum that was used */
  momentumUsed: number;
  /** Whether charge was countered by Spear Wall */
  wasCountered: boolean;
  /** Counter result if charge was countered */
  counterResult?: SpearWallCounterResult;
  /** Updated battle state */
  state: BattleState;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Charge processor interface.
 */
export interface ChargeProcessor {
  /**
   * Calculates momentum based on distance moved.
   */
  calculateMomentum(distance: number, config: ChargeConfig): number;

  /**
   * Applies charge damage bonus based on momentum.
   */
  applyChargeBonus(baseDamage: number, momentum: number): number;

  /**
   * Gets the charge bonus multiplier for a given momentum.
   * Returns the multiplier (e.g., 0.6 for 60% bonus).
   */
  getChargeBonus(momentum: number): number;

  /**
   * Checks if target has Spear Wall ability to counter charges.
   */
  isCounteredBySpearWall(target: BattleUnit & UnitWithCharge): boolean;

  /**
   * Calculates Spear Wall counter damage.
   */
  calculateCounterDamage(spearman: BattleUnit & UnitWithCharge): number;

  /**
   * Checks if a unit can perform a charge attack.
   */
  canCharge(
    unit: BattleUnit & UnitWithCharge,
    distance: number,
    config: ChargeConfig,
  ): ChargeEligibility;

  /**
   * Resets a unit's momentum and charge state.
   */
  resetCharge(unit: BattleUnit & UnitWithCharge): BattleUnit & UnitWithCharge;

  /**
   * Tracks movement distance for momentum calculation.
   */
  trackMovement(
    unit: BattleUnit & UnitWithCharge,
    path: Position[],
    config: ChargeConfig,
  ): BattleUnit & UnitWithCharge;
}
