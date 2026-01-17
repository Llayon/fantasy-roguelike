/**
 * Tier 2: Intercept - Type Definitions
 *
 * Defines types for the intercept system which allows units to block
 * or engage passing enemies during movement. Intercept extends the
 * engagement mechanic with movement blocking capabilities.
 *
 * Key mechanics:
 * - Hard Intercept: Spearmen completely stop cavalry charges
 * - Soft Intercept: Infantry engages passing units (triggers ZoC)
 * - Disengage Cost: Movement penalty to leave engagement
 *
 * @module core/mechanics/tier2/intercept
 */

import type { BattleState } from '../../../types/battle-state';
import type { BattleUnit } from '../../../types/battle-unit';
import type { Position } from '../../../types/grid.types';
import type { InterceptConfig } from '../../config/mechanics.types';

// ═══════════════════════════════════════════════════════════════
// INTERCEPT CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Damage multiplier for hard intercept counter-attacks.
 * Spearmen deal bonus damage when stopping cavalry.
 */
export const HARD_INTERCEPT_DAMAGE_MULTIPLIER = 1.5;

/**
 * Default movement cost to disengage from Zone of Control.
 */
export const DEFAULT_DISENGAGE_COST = 2;

/**
 * Tag that identifies units capable of hard intercept (spearmen).
 */
export const HARD_INTERCEPT_TAG = 'spear_wall';

/**
 * Tag that identifies units that can be hard intercepted (cavalry).
 */
export const CAVALRY_TAG = 'cavalry';

// ═══════════════════════════════════════════════════════════════
// INTERCEPT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Types of intercept.
 */
export type InterceptType = 'hard' | 'soft';

/**
 * Result of an intercept attempt.
 */
export type InterceptResult = 'blocked' | 'engaged' | 'none';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the intercept system.
 */
export interface UnitWithIntercept {
  /** Whether unit can perform hard intercept (stop cavalry) */
  canHardIntercept?: boolean;

  /** Whether unit can perform soft intercept (engage passing units) */
  canSoftIntercept?: boolean;

  /** Number of intercepts remaining this round */
  interceptsRemaining?: number;

  /** Maximum intercepts per round */
  maxIntercepts?: number;

  /** Whether unit is currently intercepting */
  isIntercepting?: boolean;

  /** Unit tags for intercept type determination */
  tags?: string[];

  /** Whether unit is cavalry */
  isCavalry?: boolean;

  /** Whether unit is currently charging */
  isCharging?: boolean;

  /** Current momentum from charge */
  momentum?: number;

  /** The round number when intercepts were last reset */
  lastInterceptResetRound?: number;
}

// ═══════════════════════════════════════════════════════════════
// INTERCEPT CHECK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Information about a potential intercept opportunity.
 */
export interface InterceptOpportunity {
  /** Unit that can intercept */
  interceptor: BattleUnit & UnitWithIntercept;

  /** Unit being intercepted */
  target: BattleUnit & UnitWithIntercept;

  /** Type of intercept (hard or soft) */
  type: InterceptType;

  /** Position where intercept would occur */
  position: Position;

  /** Whether intercept can actually be performed */
  canIntercept: boolean;

  /** Reason if intercept cannot be performed */
  reason?: InterceptBlockReason;
}

/**
 * Reasons why an intercept might be blocked.
 */
export type InterceptBlockReason =
  | 'no_intercepts'
  | 'wrong_type'
  | 'out_of_range'
  | 'same_team'
  | 'disabled'
  | 'already_engaged';

/**
 * Result of checking for intercept opportunities along a path.
 */
export interface InterceptCheckResult {
  /** Whether any intercept opportunity exists */
  hasIntercept: boolean;

  /** All intercept opportunities along the path */
  opportunities: InterceptOpportunity[];

  /** First intercept opportunity (if any) */
  firstIntercept?: InterceptOpportunity;

  /** Position where movement is blocked (for hard intercept) */
  blockedAt?: Position;

  /** Whether movement is completely blocked */
  movementBlocked: boolean;
}

// ═══════════════════════════════════════════════════════════════
// INTERCEPT EXECUTION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of executing an intercept.
 */
export interface InterceptExecutionResult {
  /** Whether intercept was executed successfully */
  success: boolean;

  /** Type of intercept that was executed */
  type: InterceptType;

  /** Damage dealt by intercept (hard intercept only) */
  damage: number;

  /** Target's HP after intercept */
  targetNewHp: number;

  /** Whether target's movement was stopped */
  movementStopped: boolean;

  /** Position where target was stopped (if movement stopped) */
  stoppedAt?: Position;

  /** Interceptor's remaining intercepts */
  interceptorInterceptsRemaining: number;

  /** Updated battle state */
  state: BattleState;
}

/**
 * Disengage attempt result.
 */
export interface DisengageResult {
  /** Whether disengage was successful */
  success: boolean;

  /** Movement points spent to disengage */
  movementCost: number;

  /** Remaining movement after disengage */
  remainingMovement: number;

  /** Whether disengage triggered Attack of Opportunity */
  triggeredAoO: boolean;

  /** Reason if disengage failed */
  reason?: DisengageFailReason;

  /** Updated battle state */
  state: BattleState;
}

/**
 * Reasons why a disengage might fail.
 */
export type DisengageFailReason = 'insufficient_movement' | 'pinned' | 'blocked';

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Intercept processor interface.
 */
export interface InterceptProcessor {
  /**
   * Checks if a unit can perform hard intercept (stop cavalry).
   */
  canHardIntercept(
    interceptor: BattleUnit & UnitWithIntercept,
    target: BattleUnit & UnitWithIntercept,
    config: InterceptConfig,
  ): boolean;

  /**
   * Checks if a unit can perform soft intercept (engage passing unit).
   */
  canSoftIntercept(
    interceptor: BattleUnit & UnitWithIntercept,
    target: BattleUnit & UnitWithIntercept,
    config: InterceptConfig,
  ): boolean;

  /**
   * Checks for intercept opportunities along a movement path.
   */
  checkIntercept(
    unit: BattleUnit & UnitWithIntercept,
    path: Position[],
    state: BattleState,
    config: InterceptConfig,
  ): InterceptCheckResult;

  /**
   * Executes a hard intercept (spearmen stop cavalry).
   */
  executeHardIntercept(
    interceptor: BattleUnit & UnitWithIntercept,
    target: BattleUnit & UnitWithIntercept,
    state: BattleState,
    seed: number,
  ): InterceptExecutionResult;

  /**
   * Executes a soft intercept (infantry engages passing unit).
   */
  executeSoftIntercept(
    interceptor: BattleUnit & UnitWithIntercept,
    target: BattleUnit & UnitWithIntercept,
    state: BattleState,
  ): InterceptExecutionResult;

  /**
   * Calculates the movement cost to disengage from engagement.
   */
  getDisengageCost(
    unit: BattleUnit & UnitWithIntercept,
    state: BattleState,
    config: InterceptConfig,
  ): number;

  /**
   * Attempts to disengage a unit from engagement.
   */
  attemptDisengage(
    unit: BattleUnit & UnitWithIntercept,
    state: BattleState,
    config: InterceptConfig,
    seed: number,
  ): DisengageResult;

  /**
   * Resets intercept charges for a unit at round start.
   */
  resetInterceptCharges(
    unit: BattleUnit & UnitWithIntercept,
    round: number,
  ): BattleUnit & UnitWithIntercept;
}
