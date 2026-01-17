/**
 * Tier 3: Overwatch (Ranged Reaction Fire) - Type Definitions
 *
 * Defines types for the overwatch system which allows ranged units to
 * enter a Vigilance state and automatically fire at enemies that move
 * within their range. Overwatch is primarily used by archers and
 * crossbowmen to control enemy movement.
 *
 * Key mechanics:
 * - Vigilance state: Unit skips turn to enter overwatch mode
 * - Trigger on movement: Fires when enemy enters/moves through range
 * - Ammo consumption: Each overwatch shot consumes ammunition
 * - Reset at turn end: Vigilance state clears at end of round
 * - Limited shots: Can only fire once per enemy movement
 *
 * @module core/mechanics/tier3/overwatch
 */

import type { BattleState, Position } from '../../../types';
import type { BattleUnit } from '../../../types/battle-unit';

// ═══════════════════════════════════════════════════════════════
// OVERWATCH CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default damage modifier for overwatch attacks.
 * Overwatch attacks deal reduced damage compared to normal attacks.
 * 0.75 = 75% of normal damage.
 */
export const DEFAULT_OVERWATCH_DAMAGE_MODIFIER = 0.75;

/**
 * Default maximum overwatch shots per round.
 * Limits how many times a unit can fire in overwatch mode.
 */
export const DEFAULT_MAX_OVERWATCH_SHOTS = 2;

/**
 * Default accuracy penalty for overwatch attacks.
 * Reaction fire is less accurate than aimed shots.
 * 0.2 = 20% accuracy penalty.
 */
export const DEFAULT_OVERWATCH_ACCURACY_PENALTY = 0.2;

/**
 * Tag that identifies units capable of overwatch (ranged units).
 */
export const OVERWATCH_TAG = 'ranged';

/**
 * Tag that identifies units with enhanced overwatch capability.
 */
export const ENHANCED_OVERWATCH_TAG = 'marksman';

/**
 * Tag that identifies units immune to overwatch (stealthy units).
 */
export const OVERWATCH_IMMUNE_TAG = 'stealth';

// ═══════════════════════════════════════════════════════════════
// VIGILANCE STATE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Overwatch vigilance state for units.
 *
 * - inactive: Unit is not in overwatch mode
 * - active: Unit is in overwatch mode, ready to fire
 * - triggered: Unit has fired this movement phase
 * - exhausted: Unit has used all overwatch shots this round
 */
export type OverwatchVigilanceState = 'inactive' | 'active' | 'triggered' | 'exhausted';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the overwatch system.
 */
export interface UnitWithOverwatch {
  /** Whether unit is capable of entering overwatch mode */
  canOverwatch?: boolean;
  /** Current vigilance state */
  vigilance?: OverwatchVigilanceState;
  /** Number of overwatch shots remaining this round */
  overwatchShotsRemaining?: number;
  /** Maximum overwatch shots per round */
  maxOverwatchShots?: number;
  /** Range for overwatch triggers */
  overwatchRange?: number;
  /** IDs of units already fired upon this movement phase */
  overwatchTargetsFired?: string[];
  /** Whether unit entered vigilance this turn */
  enteredVigilanceThisTurn?: boolean;
  /** Unit's current ammunition count */
  ammo?: number | null;
}

// ═══════════════════════════════════════════════════════════════
// OVERWATCH CHECK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Information about a potential overwatch opportunity.
 */
export interface OverwatchOpportunity {
  /** Unit in overwatch mode */
  watcher: BattleUnit & UnitWithOverwatch;
  /** Unit that triggered overwatch */
  target: BattleUnit & UnitWithOverwatch;
  /** Position where overwatch was triggered */
  triggerPosition: Position;
  /** Whether overwatch can actually fire */
  canFire: boolean;
  /** Distance from watcher to trigger position */
  distance: number;
  /** Reason if overwatch cannot fire */
  reason?: OverwatchBlockReason;
}

/**
 * Reasons why an overwatch shot might be blocked.
 */
export type OverwatchBlockReason =
  | 'no_ammo'
  | 'no_shots'
  | 'out_of_range'
  | 'same_team'
  | 'already_fired'
  | 'not_vigilant'
  | 'target_immune'
  | 'blocked_los';

/**
 * Result of checking for overwatch triggers along a path.
 */
export interface OverwatchCheckResult {
  /** Whether any overwatch opportunity exists */
  hasOverwatch: boolean;
  /** All overwatch opportunities along the path */
  opportunities: OverwatchOpportunity[];
  /** Total number of overwatch shots that will be fired */
  totalShots: number;
  /** Positions where overwatch will trigger */
  triggerPositions: Position[];
}

// ═══════════════════════════════════════════════════════════════
// OVERWATCH EXECUTION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of executing an overwatch shot.
 */
export interface OverwatchShotResult {
  /** Whether overwatch shot was executed */
  success: boolean;
  /** Whether the shot hit the target */
  hit: boolean;
  /** Damage dealt (0 if missed) */
  damage: number;
  /** Target's HP after shot */
  targetNewHp: number;
  /** Ammunition consumed */
  ammoConsumed: number;
  /** Watcher's remaining ammunition */
  watcherAmmoRemaining: number;
  /** Watcher's remaining overwatch shots */
  watcherShotsRemaining: number;
  /** Updated battle state */
  state: BattleState;
}

/**
 * Result of entering vigilance state.
 */
export interface EnterVigilanceResult {
  /** Whether vigilance was entered successfully */
  success: boolean;
  /** Reason if vigilance could not be entered */
  reason?: VigilanceBlockReason;
  /** Updated unit with vigilance state */
  unit: BattleUnit & UnitWithOverwatch;
  /** Updated battle state */
  state: BattleState;
}

/**
 * Result of exiting vigilance state.
 */
export interface ExitVigilanceResult {
  /** Whether vigilance was exited successfully */
  success: boolean;
  /** Reason if vigilance could not be exited */
  reason?: VigilanceExitBlockReason;
  /** Updated unit with vigilance state */
  unit: BattleUnit & UnitWithOverwatch;
  /** Updated battle state */
  state: BattleState;
}

/**
 * Result of toggling vigilance state.
 */
export interface ToggleVigilanceResult {
  /** Whether vigilance was toggled successfully */
  success: boolean;
  /** Action that was performed */
  action: 'entered' | 'exited' | undefined;
  /** Reason if vigilance could not be toggled */
  reason: VigilanceBlockReason | VigilanceExitBlockReason | undefined;
  /** Updated unit with vigilance state */
  unit: BattleUnit & UnitWithOverwatch;
  /** Updated battle state */
  state: BattleState;
}

/**
 * Reasons why entering vigilance might fail.
 */
export type VigilanceBlockReason =
  | 'no_ammo'
  | 'not_ranged'
  | 'already_acted'
  | 'already_vigilant'
  | 'disabled';

/**
 * Reasons why exiting vigilance might fail.
 */
export type VigilanceExitBlockReason = 'not_vigilant' | 'already_triggered' | 'exhausted';

// ═══════════════════════════════════════════════════════════════
// PROCESSOR OPTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Options for creating an overwatch processor with custom settings.
 */
export interface OverwatchProcessorOptions {
  /** Custom damage modifier for overwatch attacks (default: 0.75) */
  damageModifier?: number;
  /** Custom maximum shots per round (default: 2) */
  maxShots?: number;
  /** Custom accuracy penalty for overwatch (default: 0.2) */
  accuracyPenalty?: number;
  /** Custom tags for overwatch capability */
  overwatchTags?: string[];
  /** Custom tags for overwatch immunity */
  immunityTags?: string[];
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Overwatch processor interface.
 */
export interface OverwatchProcessor {
  /** Checks if a unit can enter vigilance state */
  canEnterVigilance(unit: BattleUnit & UnitWithOverwatch): boolean;

  /** Checks if a unit can exit vigilance state */
  canExitVigilance(unit: BattleUnit & UnitWithOverwatch): boolean;

  /** Toggles vigilance state for a unit */
  toggleVigilance(unit: BattleUnit & UnitWithOverwatch, state: BattleState): ToggleVigilanceResult;

  /** Enters vigilance state for a unit */
  enterVigilance(unit: BattleUnit & UnitWithOverwatch, state: BattleState): EnterVigilanceResult;

  /** Exits vigilance state for a unit */
  exitVigilance(unit: BattleUnit & UnitWithOverwatch, state: BattleState): ExitVigilanceResult;

  /** Checks if a unit is currently in vigilance state */
  isVigilant(unit: BattleUnit & UnitWithOverwatch): boolean;

  /** Checks if a target is immune to overwatch */
  isImmuneToOverwatch(target: BattleUnit & UnitWithOverwatch): boolean;

  /** Checks for overwatch triggers along a movement path */
  checkOverwatch(
    target: BattleUnit & UnitWithOverwatch,
    path: Position[],
    state: BattleState,
  ): OverwatchCheckResult;

  /** Calculates overwatch damage */
  calculateOverwatchDamage(
    watcher: BattleUnit & UnitWithOverwatch,
    target: BattleUnit & UnitWithOverwatch,
  ): number;

  /** Executes an overwatch shot */
  executeOverwatchShot(
    watcher: BattleUnit & UnitWithOverwatch,
    target: BattleUnit & UnitWithOverwatch,
    state: BattleState,
    seed: number,
  ): OverwatchShotResult;

  /** Resets overwatch state for a unit */
  resetOverwatch(unit: BattleUnit & UnitWithOverwatch): BattleUnit & UnitWithOverwatch;

  /** Resets overwatch shots for a unit at round start */
  resetOverwatchShots(unit: BattleUnit & UnitWithOverwatch): BattleUnit & UnitWithOverwatch;
}
