/**
 * Tier 3: Phalanx (Formation) - Type Definitions
 *
 * Defines types for the phalanx system which provides defensive bonuses
 * to units in tight formations. Units gain armor and resolve bonuses
 * based on the number of adjacent allies facing the same direction.
 *
 * Phalanx requires the facing mechanic (Tier 0) to be enabled,
 * as formation alignment depends on unit facing direction.
 *
 * Key mechanics:
 * - Formation detection: Units with adjacent allies facing same direction
 * - Armor bonus: Increased defense based on formation depth
 * - Resolve bonus: Increased morale from formation cohesion
 * - Recalculation: Bonuses update after casualties
 * - Contagion vulnerability: Dense formations spread effects faster
 *
 * @module core/mechanics/tier3/phalanx
 */

import type { BattleState, BattleUnit, Position, FacingDirection } from '../../../types';
import type { PhalanxConfig } from '../../config/mechanics.types';

// ═══════════════════════════════════════════════════════════════
// PHALANX CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default maximum armor bonus from formation.
 * Caps the total armor bonus regardless of adjacent allies.
 */
export const DEFAULT_MAX_ARMOR_BONUS = 6;

/**
 * Default maximum resolve bonus from formation.
 * Caps the total resolve bonus regardless of adjacent allies.
 */
export const DEFAULT_MAX_RESOLVE_BONUS = 9;

/**
 * Default armor bonus per adjacent ally in formation.
 */
export const DEFAULT_ARMOR_PER_ALLY = 2;

/**
 * Default resolve bonus per adjacent ally in formation.
 */
export const DEFAULT_RESOLVE_PER_ALLY = 3;

/**
 * Maximum number of adjacent allies that can contribute to formation.
 * In a grid, a unit can have at most 4 orthogonal neighbors.
 */
export const MAX_ADJACENT_ALLIES = 4;

/**
 * Tag that identifies units capable of forming phalanx.
 * Typically infantry units with shields.
 */
export const PHALANX_TAG = 'phalanx';

/**
 * Tag that identifies units with enhanced phalanx capability.
 * Elite units may provide additional bonuses.
 */
export const ELITE_PHALANX_TAG = 'elite_phalanx';

/**
 * Tag that identifies units that cannot join formations.
 * Cavalry and large units typically cannot form phalanx.
 */
export const PHALANX_IMMUNE_TAG = 'no_phalanx';

// ═══════════════════════════════════════════════════════════════
// FORMATION STATE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Phalanx formation state for units.
 *
 * - none: Unit is not in any formation
 * - partial: Unit has some adjacent allies but not optimal formation
 * - full: Unit has maximum adjacent allies in formation
 */
export type PhalanxFormationState = 'none' | 'partial' | 'full';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the phalanx system.
 * These properties are added to BattleUnit when phalanx mechanic is enabled.
 */
export interface UnitWithPhalanx {
  /** Whether unit is capable of forming phalanx */
  canFormPhalanx?: boolean;

  /** Whether unit is currently in a phalanx formation */
  inPhalanx?: boolean;

  /** Current phalanx formation state */
  phalanxState?: PhalanxFormationState;

  /** Number of adjacent allies in formation */
  adjacentAlliesCount?: number;

  /** IDs of adjacent allies contributing to formation */
  adjacentAllyIds?: string[];

  /** Current armor bonus from phalanx formation */
  phalanxArmorBonus?: number;

  /** Current resolve bonus from phalanx formation */
  phalanxResolveBonus?: number;

  /** Base armor value (before phalanx bonus) */
  baseArmor?: number;

  /** Base resolve value (before phalanx bonus) */
  baseResolve?: number;
}

// ═══════════════════════════════════════════════════════════════
// FORMATION DETECTION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Information about an adjacent ally in formation.
 */
export interface AdjacentAlly {
  /** The adjacent ally unit */
  unit: BattleUnit & UnitWithPhalanx;

  /** Position of the adjacent ally */
  position: Position;

  /** Direction from source unit to this ally (N/S/E/W) */
  direction: FacingDirection;

  /** Whether ally's facing is aligned with source unit */
  facingAligned: boolean;
}

/**
 * Result of detecting adjacent allies for formation.
 */
export interface FormationDetectionResult {
  /** All adjacent allies (regardless of facing) */
  adjacentAllies: AdjacentAlly[];

  /** Adjacent allies with aligned facing */
  alignedAllies: AdjacentAlly[];

  /** Total number of adjacent allies */
  totalAdjacent: number;

  /** Number of allies with aligned facing */
  alignedCount: number;

  /** Whether unit can form phalanx (has aligned allies) */
  canFormPhalanx: boolean;
}

/**
 * Result of calculating phalanx bonuses.
 */
export interface PhalanxBonusResult {
  /** Calculated armor bonus */
  armorBonus: number;

  /** Calculated resolve bonus */
  resolveBonus: number;

  /** Number of adjacent allies contributing */
  adjacentCount: number;

  /** Formation state based on adjacent count */
  formationState: PhalanxFormationState;

  /** Whether armor bonus was capped at maximum */
  cappedArmor: boolean;

  /** Whether resolve bonus was capped at maximum */
  cappedResolve: boolean;

  /** Raw armor bonus before capping */
  rawArmorBonus: number;

  /** Raw resolve bonus before capping */
  rawResolveBonus: number;
}

/**
 * Result of checking phalanx eligibility for a unit.
 */
export interface PhalanxEligibility {
  /** Whether the unit can join a phalanx formation */
  canJoinPhalanx: boolean;

  /** Reason if unit cannot join phalanx */
  reason?: PhalanxBlockReason;

  /** Whether unit has phalanx tag */
  hasTag: boolean;

  /** Whether unit is alive */
  isAlive: boolean;
}

/**
 * Reasons why a unit might not be able to join phalanx.
 */
export type PhalanxBlockReason =
  | 'no_phalanx_tag'
  | 'immune_tag'
  | 'dead'
  | 'no_facing'
  | 'isolated'
  | 'disabled';

// ═══════════════════════════════════════════════════════════════
// RECALCULATION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of recalculating phalanx bonuses after state change.
 */
export interface PhalanxRecalculationResult {
  /** IDs of units whose phalanx state was updated */
  unitsUpdated: string[];

  /** Number of formations that changed */
  formationsChanged: number;

  /** Net change in total armor bonus across all units */
  totalArmorBonusChange: number;

  /** Net change in total resolve bonus across all units */
  totalResolveBonusChange: number;

  /** Updated battle state */
  state: BattleState;
}

/**
 * Trigger for phalanx recalculation.
 */
export type RecalculationTrigger =
  | 'unit_death'
  | 'unit_move'
  | 'unit_facing_change'
  | 'turn_start'
  | 'manual';

// ═══════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Position offset for adjacent cell detection.
 */
export interface PositionOffset {
  /** X offset (-1, 0, or 1) */
  dx: number;

  /** Y offset (-1, 0, or 1) */
  dy: number;

  /** Direction this offset represents */
  direction: FacingDirection;
}

/**
 * Orthogonal position offsets for adjacent cell detection.
 * Only includes N/S/E/W directions (no diagonals).
 */
export const ORTHOGONAL_OFFSETS: readonly PositionOffset[] = [
  { dx: 0, dy: -1, direction: 'N' },
  { dx: 0, dy: 1, direction: 'S' },
  { dx: 1, dy: 0, direction: 'E' },
  { dx: -1, dy: 0, direction: 'W' },
] as const;

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Phalanx processor interface.
 * Handles all phalanx-related mechanics including formation detection,
 * bonus calculation, and recalculation after state changes.
 */
export interface PhalanxProcessor {
  /**
   * Checks if a unit can join a phalanx formation.
   * @param unit - Unit to check
   * @returns Phalanx eligibility result
   */
  canJoinPhalanx(unit: BattleUnit & UnitWithPhalanx): PhalanxEligibility;

  /**
   * Detects adjacent allies for formation.
   * @param unit - Unit to check formation for
   * @param state - Current battle state
   * @returns Formation detection result
   */
  detectFormation(
    unit: BattleUnit & UnitWithPhalanx,
    state: BattleState,
  ): FormationDetectionResult;

  /**
   * Calculates phalanx bonuses based on adjacent ally count.
   * @param adjacentCount - Number of adjacent allies in formation
   * @param config - Phalanx configuration
   * @returns Calculated bonuses
   */
  calculateBonuses(
    adjacentCount: number,
    config: PhalanxConfig,
  ): PhalanxBonusResult;

  /**
   * Gets the effective armor for a unit including phalanx bonus.
   * @param unit - Unit to get effective armor for
   * @returns Effective armor value
   */
  getEffectiveArmor(unit: BattleUnit & UnitWithPhalanx): number;

  /**
   * Gets the effective resolve for a unit including phalanx bonus.
   * @param unit - Unit to get effective resolve for
   * @returns Effective resolve value
   */
  getEffectiveResolve(unit: BattleUnit & UnitWithPhalanx): number;

  /**
   * Updates phalanx state for a single unit.
   * @param unit - Unit to update
   * @param state - Current battle state
   * @param config - Phalanx configuration
   * @returns Updated unit with phalanx state
   */
  updateUnitPhalanx(
    unit: BattleUnit & UnitWithPhalanx,
    state: BattleState,
    config: PhalanxConfig,
  ): BattleUnit & UnitWithPhalanx;

  /**
   * Recalculates phalanx bonuses for all units.
   * @param state - Current battle state
   * @param trigger - What triggered the recalculation
   * @returns Recalculation result with updated state
   */
  recalculate(
    state: BattleState,
    trigger: RecalculationTrigger,
  ): PhalanxRecalculationResult;

  /**
   * Clears phalanx state for a unit.
   * @param unit - Unit to clear phalanx state for
   * @returns Updated unit with cleared phalanx state
   */
  clearPhalanx(unit: BattleUnit & UnitWithPhalanx): BattleUnit & UnitWithPhalanx;

  /**
   * Checks if a unit is currently in a phalanx formation.
   * @param unit - Unit to check
   * @returns True if unit is in phalanx
   */
  isInPhalanx(unit: BattleUnit & UnitWithPhalanx): boolean;
}
