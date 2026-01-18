/**
 * Tier 3: Line of Sight (LoS) - Type Definitions
 *
 * Defines types for the Line of Sight system which determines
 * whether ranged attacks can reach their targets based on
 * obstacles in the path.
 *
 * Key mechanics:
 * - Direct Fire: Requires clear line to target (blocked by units)
 * - Arc Fire: Ignores obstacles but has accuracy penalty
 * - Bresenham line algorithm for LoS calculation
 * - Partial cover provides dodge bonus
 *
 * @module core/mechanics/tier3/los
 */

import type { BattleState, BattleUnit } from '../../../types';
import type { Position } from '../../../types/grid.types';

// ═══════════════════════════════════════════════════════════════
// LOS CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Default arc fire accuracy penalty (20%). */
export const DEFAULT_ARC_FIRE_PENALTY = 0.2;

/** Partial cover hit chance (50%). */
export const PARTIAL_COVER_HIT_CHANCE = 0.5;

/** Cover dodge bonus (20%). */
export const COVER_DODGE_BONUS = 0.2;

/** Tag that identifies units that can use arc fire. */
export const ARC_FIRE_TAG = 'arc_fire';

/** Tag that identifies siege units (always use arc fire). */
export const SIEGE_TAG = 'siege';

/** Tag that identifies units that ignore LoS completely. */
export const IGNORE_LOS_TAG = 'ignore_los';

/** Minimum range for arc fire (cannot target adjacent units). */
export const ARC_FIRE_MIN_RANGE = 2;

// ═══════════════════════════════════════════════════════════════
// FIRE TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Type of ranged fire.
 * - direct: Requires clear line of sight
 * - arc: Ignores obstacles but has accuracy penalty
 */
export type FireType = 'direct' | 'arc';

/**
 * Result of LoS blocking check.
 * - clear: No obstacles in path
 * - blocked: Unit blocking the path
 * - partial: Path passes through cell edge (partial cover)
 */
export type LoSBlockStatus = 'clear' | 'blocked' | 'partial';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the LoS system.
 */
export interface UnitWithLoS {
  /** Unit's current position on the grid. */
  position: Position;
  /** Unit's attack range in cells. */
  range?: number;
  /** Unit tags for fire type determination. */
  tags?: string[];
  /** Whether unit can use arc fire. */
  canArcFire?: boolean;
  /** Whether unit ignores LoS completely. */
  ignoresLoS?: boolean;
  /** Unit's instance ID. */
  instanceId?: string;
}

// ═══════════════════════════════════════════════════════════════
// LOS CHECK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of checking if a unit can attack a target.
 */
export interface LoSCheckResult {
  /** Whether the attack can proceed */
  canAttack: boolean;
  /** Type of fire being used */
  fireType: FireType;
  /** LoS status (clear, blocked, partial) */
  losStatus: LoSBlockStatus;
  /** Accuracy modifier (1.0 = no penalty) */
  accuracyModifier: number;
  /** Dodge bonus for target from cover */
  coverDodgeBonus: number;
  /** Blocking unit ID (if blocked) */
  blockingUnitId?: string;
  /** Blocking unit position (if blocked) */
  blockingPosition?: Position;
  /** Reason if attack is blocked */
  reason?: LoSBlockReason;
}

/**
 * Reasons why an attack might be blocked by LoS.
 */
export type LoSBlockReason =
  | 'unit_blocking'
  | 'arc_fire_too_close'
  | 'out_of_range'
  | 'no_direct_fire'
  | 'disabled';

/**
 * Cell along the line of sight path.
 */
export interface LoSPathCell {
  /** Cell position */
  position: Position;
  /** Whether this cell is occupied by a unit */
  isOccupied: boolean;
  /** Unit ID if occupied */
  unitId?: string;
  /** Whether this is an edge cell (partial cover) */
  isEdgeCell: boolean;
}

/**
 * Result of calculating the LoS path.
 */
export interface LoSPathResult {
  /** All cells along the path */
  cells: LoSPathCell[];
  /** Whether path is clear */
  isClear: boolean;
  /** First blocking cell (if any) */
  blockingCell?: LoSPathCell;
  /** Whether path has partial cover */
  hasPartialCover: boolean;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR OPTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Options for creating a LoS processor with custom settings.
 */
export interface LoSProcessorOptions {
  /** Custom arc fire accuracy penalty (default: 0.2) */
  arcFirePenalty?: number;
  /** Custom partial cover hit chance (default: 0.5) */
  partialCoverHitChance?: number;
  /** Custom cover dodge bonus (default: 0.2) */
  coverDodgeBonus?: number;
  /** Custom tags for arc fire units */
  arcFireTags?: string[];
  /** Custom tags for units that ignore LoS */
  ignoreLoSTags?: string[];
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Line of Sight processor interface.
 * Handles all LoS-related mechanics for ranged attacks.
 */
export interface LoSProcessor {
  /**
   * Determines the fire type for a unit based on tags.
   * @param unit - Unit to check
   * @returns Fire type (direct or arc)
   */
  getFireType(unit: BattleUnit & UnitWithLoS): FireType;

  /**
   * Checks if a ranged attack has clear line of sight.
   * @param shooter - Attacking unit
   * @param target - Target unit
   * @param state - Current battle state
   * @returns LoS check result
   */
  checkLoS(
    shooter: BattleUnit & UnitWithLoS,
    target: BattleUnit & UnitWithLoS,
    state: BattleState,
  ): LoSCheckResult;

  /**
   * Calculates the path between two positions using Bresenham's algorithm.
   * @param from - Starting position
   * @param to - Ending position
   * @param state - Current battle state
   * @param excludeIds - Unit IDs to exclude from blocking check
   * @returns Path result with all cells
   */
  calculatePath(
    from: Position,
    to: Position,
    state: BattleState,
    excludeIds?: string[],
  ): LoSPathResult;

  /**
   * Checks if a position is blocked by a unit.
   * @param position - Position to check
   * @param state - Current battle state
   * @param excludeIds - Unit IDs to exclude
   * @returns Blocking unit ID or undefined
   */
  getBlockingUnit(
    position: Position,
    state: BattleState,
    excludeIds?: string[],
  ): string | undefined;

  /**
   * Gets the accuracy modifier for an attack.
   * @param fireType - Type of fire
   * @param losStatus - LoS status
   * @returns Accuracy modifier (1.0 = no penalty)
   */
  getAccuracyModifier(fireType: FireType, losStatus: LoSBlockStatus): number;

  /**
   * Gets the cover dodge bonus for a target.
   * @param losStatus - LoS status
   * @returns Dodge bonus (0 = no bonus)
   */
  getCoverDodgeBonus(losStatus: LoSBlockStatus): number;

  /**
   * Checks if a unit can use arc fire.
   * @param unit - Unit to check
   * @returns True if unit can use arc fire
   */
  canUseArcFire(unit: BattleUnit & UnitWithLoS): boolean;

  /**
   * Checks if a unit ignores LoS completely.
   * @param unit - Unit to check
   * @returns True if unit ignores LoS
   */
  ignoresLoS(unit: BattleUnit & UnitWithLoS): boolean;
}
