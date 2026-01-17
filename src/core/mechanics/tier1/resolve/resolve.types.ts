/**
 * Tier 1: Resolve (Morale) - Type Definitions
 *
 * Defines types for the resolve/morale system which tracks unit morale
 * and determines behavior when morale breaks (routing for humans,
 * crumbling for undead).
 *
 * Resolve is damaged by:
 * - Flanking attacks (side attacks)
 * - Rear attacks (backstabs)
 * - Charge impacts (cavalry shock)
 * - Ally deaths nearby
 *
 * Resolve regenerates at the start of each turn.
 *
 * @module core/mechanics/tier1/resolve
 */

import type { ResolveConfig } from '../../config/mechanics.types';
import type { BattleState } from '../../../types';
import type { BattleUnit } from '../../../types/battle-unit';

// ═══════════════════════════════════════════════════════════════
// RESOLVE STATE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve state for a unit in the mechanics system.
 * Determines unit behavior based on current morale level.
 *
 * - active: Unit is fighting normally (resolve > 0)
 * - routing: Human unit is fleeing (resolve = 0, humanRetreat enabled)
 * - crumbled: Undead unit has disintegrated (resolve = 0, undeadCrumble enabled)
 *
 * @example
 * const state = processor.checkState(unit, config);
 * if (state === 'routing') {
 *   // Unit will attempt to flee the battlefield
 * }
 */
export type MechanicsResolveState = 'active' | 'routing' | 'crumbled';

// ═══════════════════════════════════════════════════════════════
// FACTION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Faction types that affect resolve behavior.
 * Different factions have different responses to morale breaking.
 *
 * - human: Retreats when resolve reaches 0 (if humanRetreat enabled)
 * - undead: Crumbles when resolve reaches 0 (if undeadCrumble enabled)
 */
export type ResolveFaction = 'human' | 'undead';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the resolve system.
 * These properties are added to BattleUnit when resolve mechanic is enabled.
 */
export interface UnitWithResolve {
  /** Current resolve/morale value (0 to maxResolve) */
  resolve: number;

  /** Maximum resolve value (defaults to config.maxResolve) */
  maxResolve: number;

  /** Unit's faction for resolve behavior */
  faction: ResolveFaction;

  /** Whether unit is currently routing (fleeing) */
  isRouting: boolean;

  /** Whether unit has crumbled (undead only) */
  hasCrumbled?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// RESOLVE DAMAGE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Source of resolve damage for tracking and events.
 */
export type ResolveDamageSource =
  | 'flanking'
  | 'rear'
  | 'charge'
  | 'ally_death'
  | 'ability'
  | 'aura'
  | 'surrounded';

// ═══════════════════════════════════════════════════════════════
// PROCESSOR RESULT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of regenerating resolve.
 */
export interface ResolveRegenerateResult {
  /** Updated unit with new resolve value */
  unit: BattleUnit & UnitWithResolve;
  /** Amount of resolve regenerated */
  delta: number;
  /** Whether regeneration occurred */
  regenerated: boolean;
}

/**
 * Result of applying resolve damage.
 */
export interface ResolveDamageResult {
  /** Updated unit with new resolve value */
  unit: BattleUnit & UnitWithResolve;
  /** Amount of resolve damage applied */
  damage: number;
  /** New resolve value after damage */
  newResolve: number;
}

/**
 * Result of checking resolve state.
 */
export interface ResolveStateCheckResult {
  /** Current resolve state */
  state: MechanicsResolveState;
  /** Whether state changed from previous */
  changed: boolean;
  /** Previous state (if changed) */
  previousState?: MechanicsResolveState;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve processor interface.
 * Handles all resolve-related mechanics including regeneration,
 * damage application, and state checking.
 *
 * @example
 * const processor = createResolveProcessor(config);
 *
 * // Regenerate at turn start
 * const regenResult = processor.regenerate(unit, config);
 *
 * // Apply damage from flanking attack
 * const damageResult = processor.applyDamage(unit, 12);
 *
 * // Check if unit should rout/crumble
 * const state = processor.checkState(unit, config);
 */
export interface ResolveProcessor {
  /**
   * Regenerates resolve at turn start.
   * Adds baseRegeneration to current resolve, capped at maxResolve.
   *
   * @param unit - Unit to regenerate resolve for
   * @param config - Resolve configuration
   * @returns New unit object with updated resolve
   */
  regenerate(
    unit: BattleUnit & UnitWithResolve,
    config: ResolveConfig,
  ): BattleUnit & UnitWithResolve;

  /**
   * Applies resolve damage from combat.
   * Reduces resolve by the specified amount, minimum 0.
   *
   * @param unit - Unit to apply damage to
   * @param damage - Amount of resolve damage
   * @returns New unit object with updated resolve
   */
  applyDamage(unit: BattleUnit & UnitWithResolve, damage: number): BattleUnit & UnitWithResolve;

  /**
   * Checks if unit should rout/crumble based on resolve.
   * Returns 'active' if resolve > 0, otherwise checks faction
   * and config to determine routing or crumbling.
   *
   * @param unit - Unit to check state for
   * @param config - Resolve configuration
   * @returns Current resolve state
   */
  checkState(unit: BattleUnit & UnitWithResolve, config: ResolveConfig): MechanicsResolveState;

  /**
   * Applies ally death resolve damage to nearby units.
   *
   * @param state - Current battle state
   * @param deadUnit - Unit that died
   * @param config - Resolve configuration
   * @returns Updated battle state with resolve damage applied
   */
  applyAllyDeathDamage(
    state: BattleState,
    deadUnit: BattleUnit,
    config: ResolveConfig,
  ): BattleState;

  /**
   * Starts routing for a unit.
   *
   * @param state - Current battle state
   * @param unitId - Instance ID of unit to start routing
   * @returns Updated battle state
   */
  startRouting(state: BattleState, unitId: string): BattleState;

  /**
   * Rallies a routing unit.
   *
   * @param state - Current battle state
   * @param unitId - Instance ID of unit to rally
   * @returns Updated battle state
   */
  rally(state: BattleState, unitId: string): BattleState;
}
