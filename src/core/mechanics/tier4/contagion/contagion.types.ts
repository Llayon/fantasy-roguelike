/**
 * Tier 4: Contagion (Status Effect Spreading) - Type Definitions
 *
 * Defines types for the contagion system which handles the spreading of
 * status effects between adjacent units. Effects spread at turn_end phase
 * with configurable spread chances per effect type.
 *
 * Key mechanics:
 * - Status effects spread to adjacent allies (same team)
 * - Each effect type has a base spread chance
 * - Phalanx formation increases spread chance
 * - Spread effects have reduced duration (original - 1, min 1)
 * - Same effect cannot stack, but refreshes duration
 * - Spread blocked if target has immunity
 *
 * @module core/mechanics/tier4/contagion
 */

import type { BattleState, BattleUnit, Position } from '../../../types';
import type { ContagionConfig } from '../../config/mechanics.types';

// ═══════════════════════════════════════════════════════════════
// CONTAGION CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default fire spread chance (50%).
 */
export const DEFAULT_FIRE_SPREAD = 0.5;

/**
 * Default poison spread chance (30%).
 */
export const DEFAULT_POISON_SPREAD = 0.3;

/**
 * Default curse spread chance (25%).
 */
export const DEFAULT_CURSE_SPREAD = 0.25;

/**
 * Default frost spread chance (20%).
 */
export const DEFAULT_FROST_SPREAD = 0.2;

/**
 * Default plague spread chance (60%).
 */
export const DEFAULT_PLAGUE_SPREAD = 0.6;

/**
 * Default fear spread chance (40%).
 * Fear spreads faster as morale effects are contagious.
 */
export const DEFAULT_FEAR_SPREAD = 0.4;

/**
 * Default phalanx spread bonus (15%).
 * Dense formations spread effects faster.
 */
export const DEFAULT_PHALANX_SPREAD_BONUS = 0.15;

/**
 * Minimum duration for spread effects.
 */
export const MIN_SPREAD_DURATION = 1;

/**
 * Tag that identifies units immune to contagion.
 */
export const CONTAGION_IMMUNE_TAG = 'contagion_immune';

/**
 * Tag that identifies units that don't spread effects.
 */
export const NO_SPREAD_TAG = 'no_spread';

// ═══════════════════════════════════════════════════════════════
// CONTAGION EFFECT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Status effects that can spread via contagion.
 */
export type ContagionEffectType = 'fire' | 'poison' | 'curse' | 'frost' | 'plague' | 'fear';

/**
 * Status effect on a unit that can potentially spread.
 */
export interface StatusEffect {
  /** Effect type identifier */
  type: ContagionEffectType;

  /** Remaining duration in turns */
  duration: number;

  /** Source unit that applied the effect (optional) */
  sourceId?: string;

  /** Number of times this effect has spread */
  spreadCount?: number;
}

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the contagion system.
 * These properties are added to BattleUnit when contagion mechanic is enabled.
 */
export interface UnitWithContagion {
  /** Active status effects on this unit */
  statusEffects?: StatusEffect[];

  /** Whether unit is immune to contagion spread */
  contagionImmune?: boolean;

  /** Whether unit's effects can spread to others */
  canSpreadEffects?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SPREAD CALCULATION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of checking if an effect can spread to a target.
 */
export interface SpreadEligibility {
  /** Whether the effect can spread to this target */
  canSpread: boolean;

  /** Reason if spread is blocked */
  reason?: SpreadBlockReason;

  /** Calculated spread chance (0-1) */
  spreadChance: number;

  /** Whether target is in phalanx (affects spread chance) */
  targetInPhalanx: boolean;
}

/**
 * Reasons why an effect might not spread.
 */
export type SpreadBlockReason =
  | 'target_immune'
  | 'source_no_spread'
  | 'target_dead'
  | 'same_effect_active'
  | 'not_adjacent'
  | 'different_team'
  | 'effect_not_spreadable';

/**
 * Result of attempting to spread an effect.
 */
export interface SpreadAttemptResult {
  /** Whether the spread was successful */
  success: boolean;

  /** The random roll value (0-1) */
  roll: number;

  /** The spread chance that was used */
  spreadChance: number;

  /** The effect that was spread (if successful) */
  spreadEffect?: StatusEffect;

  /** Reason for failure (if unsuccessful) */
  failureReason?: SpreadBlockReason | 'roll_failed';
}

/**
 * Result of processing contagion spread for a unit.
 */
export interface ContagionSpreadResult {
  /** Units that received spread effects */
  affectedUnits: string[];

  /** Details of each spread attempt */
  spreadAttempts: Array<{
    targetId: string;
    effectType: ContagionEffectType;
    result: SpreadAttemptResult;
  }>;

  /** Updated battle state */
  state: BattleState;

  /** Total number of successful spreads */
  totalSpreads: number;
}

/**
 * Information about an adjacent ally for spread calculation.
 */
export interface AdjacentTarget {
  /** The adjacent unit */
  unit: BattleUnit & UnitWithContagion;

  /** Position of the adjacent unit */
  position: Position;

  /** Whether target is in phalanx formation */
  inPhalanx: boolean;

  /** Existing effects on target (to check for duplicates) */
  existingEffects: ContagionEffectType[];
}

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
}

/**
 * Orthogonal position offsets for adjacent cell detection.
 * Only includes N/S/E/W directions (no diagonals).
 */
export const ORTHOGONAL_OFFSETS: readonly PositionOffset[] = [
  { dx: 0, dy: -1 }, // North
  { dx: 0, dy: 1 }, // South
  { dx: 1, dy: 0 }, // East
  { dx: -1, dy: 0 }, // West
] as const;

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Contagion processor interface.
 * Handles all contagion-related mechanics including spread calculation,
 * eligibility checking, and effect application.
 */
export interface ContagionProcessor {
  /**
   * Gets the spread chance for an effect type.
   * @param effectType - Type of effect
   * @param targetInPhalanx - Whether target is in phalanx formation
   * @returns Spread chance (0-1)
   */
  getSpreadChance(effectType: ContagionEffectType, targetInPhalanx: boolean): number;

  /**
   * Checks if an effect can spread from source to target.
   * @param source - Unit with the effect
   * @param target - Potential spread target
   * @param effectType - Type of effect to spread
   * @param state - Current battle state
   * @returns Spread eligibility result
   */
  canSpread(
    source: BattleUnit & UnitWithContagion,
    target: BattleUnit & UnitWithContagion,
    effectType: ContagionEffectType,
    state: BattleState,
  ): SpreadEligibility;

  /**
   * Gets adjacent allies that could receive spread effects.
   * @param unit - Source unit
   * @param state - Current battle state
   * @returns Array of adjacent targets
   */
  getAdjacentTargets(unit: BattleUnit & UnitWithContagion, state: BattleState): AdjacentTarget[];

  /**
   * Gets spreadable effects from a unit.
   * @param unit - Unit to check for effects
   * @returns Array of spreadable status effects
   */
  getSpreadableEffects(unit: BattleUnit & UnitWithContagion): StatusEffect[];

  /**
   * Attempts to spread an effect to a target.
   * @param source - Unit with the effect
   * @param target - Target unit
   * @param effect - Effect to spread
   * @param roll - Random roll value (0-1)
   * @param state - Current battle state
   * @returns Spread attempt result
   */
  attemptSpread(
    source: BattleUnit & UnitWithContagion,
    target: BattleUnit & UnitWithContagion,
    effect: StatusEffect,
    roll: number,
    state: BattleState,
  ): SpreadAttemptResult;

  /**
   * Applies a spread effect to a target unit.
   * @param target - Target unit
   * @param effect - Effect to apply
   * @param state - Current battle state
   * @returns Updated battle state
   */
  applySpreadEffect(
    target: BattleUnit & UnitWithContagion,
    effect: StatusEffect,
    state: BattleState,
  ): BattleState;

  /**
   * Processes contagion spread for a unit at turn_end.
   * @param state - Current battle state
   * @param unitId - Unit whose effects should spread
   * @param rolls - Array of random rolls for each spread attempt
   * @returns Contagion spread result
   */
  processSpread(state: BattleState, unitId: string, rolls: number[]): ContagionSpreadResult;

  /**
   * Checks if a unit has immunity to contagion.
   * @param unit - Unit to check
   * @returns True if unit is immune
   */
  isImmune(unit: BattleUnit & UnitWithContagion): boolean;

  /**
   * Checks if a unit can spread its effects.
   * @param unit - Unit to check
   * @returns True if unit can spread effects
   */
  canSpreadFrom(unit: BattleUnit & UnitWithContagion): boolean;
}
