/**
 * Tier 1: Resolve (Morale) Processor
 *
 * Implements the resolve/morale system which tracks unit morale
 * and determines behavior when morale breaks.
 *
 * Resolve mechanics:
 * - Regenerates at turn start (baseRegeneration per turn)
 * - Damaged by flanking/rear attacks, charges, ally deaths
 * - When resolve reaches 0:
 *   - Human units route (flee the battlefield)
 *   - Undead units crumble (destroyed)
 *
 * @module core/mechanics/tier1/resolve
 */

import type { ResolveConfig } from '../../config/mechanics.types';
import type { BattleState } from '../../../types';
import type { BattleUnit } from '../../../types/battle-unit';
import { updateUnit } from '../../../utils/state-helpers';
import type {
  ResolveProcessor,
  MechanicsResolveState,
  UnitWithResolve,
  ResolveFaction,
} from './resolve.types';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Resolve damage when adjacent ally (within 1 cell) dies */
export const RESOLVE_DAMAGE_ADJACENT = 15;

/** Resolve damage when nearby ally (within 3 cells) dies */
export const RESOLVE_DAMAGE_NEARBY = 8;

/** Maximum range for nearby ally death resolve damage */
export const RESOLVE_DAMAGE_NEARBY_RANGE = 3;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Gets the effective resolve value for a unit.
 * Returns maxResolve from config if unit has no resolve set.
 *
 * @param unit - Unit to get resolve for
 * @param config - Resolve configuration
 * @returns Current resolve value
 */
function getEffectiveResolve(unit: BattleUnit & UnitWithResolve, config: ResolveConfig): number {
  return unit.resolve ?? unit.maxResolve ?? config.maxResolve;
}

/**
 * Gets the maximum resolve value for a unit.
 * Uses unit's maxResolve if set, otherwise config.maxResolve.
 *
 * @param unit - Unit to get max resolve for
 * @param config - Resolve configuration
 * @returns Maximum resolve value
 */
function getMaxResolve(unit: BattleUnit & UnitWithResolve, config: ResolveConfig): number {
  return unit.maxResolve ?? config.maxResolve;
}

/**
 * Gets the faction for a unit.
 * Defaults to 'human' if not specified.
 *
 * @param unit - Unit to get faction for
 * @returns Unit's faction
 */
function getFaction(unit: BattleUnit & UnitWithResolve): ResolveFaction {
  return unit.faction ?? 'human';
}

/**
 * Calculate Manhattan distance between two positions.
 *
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Manhattan distance
 */
function manhattanDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a resolve processor instance.
 *
 * The resolve processor handles:
 * - Regenerating resolve at turn start
 * - Applying resolve damage from combat
 * - Checking for routing/crumbling when resolve reaches 0
 * - Faction-specific behavior (human retreat vs undead crumble)
 *
 * @param config - Resolve configuration
 * @returns ResolveProcessor instance
 *
 * @example
 * const processor = createResolveProcessor({
 *   maxResolve: 100,
 *   baseRegeneration: 5,
 *   humanRetreat: true,
 *   undeadCrumble: true,
 *   flankingResolveDamage: 12,
 *   rearResolveDamage: 20,
 * });
 *
 * // Regenerate at turn start
 * const regenUnit = processor.regenerate(unit, config);
 *
 * // Apply damage from flanking attack
 * const damagedUnit = processor.applyDamage(unit, 12);
 *
 * // Check if unit should rout/crumble
 * const state = processor.checkState(unit, config);
 */
export function createResolveProcessor(config: ResolveConfig): ResolveProcessor {
  return {
    /**
     * Regenerates resolve at turn start.
     * Adds baseRegeneration to current resolve, capped at maxResolve.
     * Does not regenerate for routing or crumbled units.
     */
    regenerate(
      unit: BattleUnit & UnitWithResolve,
      resolveConfig: ResolveConfig,
    ): BattleUnit & UnitWithResolve {
      // Don't regenerate for routing or crumbled units
      if (unit.isRouting || unit.hasCrumbled) {
        return unit;
      }

      const currentResolve = getEffectiveResolve(unit, resolveConfig);
      const maxResolve = getMaxResolve(unit, resolveConfig);

      // Formula: newResolve = min(maxResolve, currentResolve + baseRegeneration)
      const newResolve = Math.min(maxResolve, currentResolve + resolveConfig.baseRegeneration);

      return {
        ...unit,
        resolve: newResolve,
        maxResolve,
      };
    },

    /**
     * Applies resolve damage from combat.
     * Reduces resolve by the specified amount, minimum 0.
     */
    applyDamage(unit: BattleUnit & UnitWithResolve, damage: number): BattleUnit & UnitWithResolve {
      const currentResolve = getEffectiveResolve(unit, config);

      // Formula: newResolve = max(0, currentResolve - damage)
      const newResolve = Math.max(0, currentResolve - damage);

      return {
        ...unit,
        resolve: newResolve,
      };
    },

    /**
     * Checks if unit should rout/crumble based on resolve.
     */
    checkState(
      unit: BattleUnit & UnitWithResolve,
      resolveConfig: ResolveConfig,
    ): MechanicsResolveState {
      // Already routing or crumbled
      if (unit.isRouting) return 'routing';
      if (unit.hasCrumbled) return 'crumbled';

      const resolve = getEffectiveResolve(unit, resolveConfig);

      // Still has resolve - active
      if (resolve > 0) return 'active';

      // Resolve is 0 - check faction-specific behavior
      const faction = getFaction(unit);

      if (faction === 'undead' && resolveConfig.undeadCrumble) {
        return 'crumbled';
      }

      if (faction !== 'undead' && resolveConfig.humanRetreat) {
        return 'routing';
      }

      // Config doesn't enable routing/crumbling for this faction
      return 'active';
    },

    /**
     * Applies ally death resolve damage to nearby units.
     */
    applyAllyDeathDamage(
      state: BattleState,
      deadUnit: BattleUnit,
      _resolveConfig: ResolveConfig,
    ): BattleState {
      let currentState = state;

      // Get allies of the dead unit (same team, alive, not the dead unit)
      const allies = state.units.filter(
        (u) => u.team === deadUnit.team && u.instanceId !== deadUnit.instanceId && u.alive,
      );

      for (const ally of allies) {
        const distance = manhattanDistance(ally.position, deadUnit.position);

        let resolveDamage = 0;
        if (distance === 1) {
          // Adjacent ally - higher resolve damage
          resolveDamage = RESOLVE_DAMAGE_ADJACENT;
        } else if (distance <= RESOLVE_DAMAGE_NEARBY_RANGE) {
          // Nearby ally - lower resolve damage
          resolveDamage = RESOLVE_DAMAGE_NEARBY;
        }

        if (resolveDamage > 0) {
          const newResolve = Math.max(0, ally.resolve - resolveDamage);
          currentState = updateUnit(currentState, ally.instanceId, {
            resolve: newResolve,
          });
        }
      }

      return currentState;
    },

    /**
     * Starts routing for a unit.
     */
    startRouting(state: BattleState, unitId: string): BattleState {
      return updateUnit(state, unitId, {
        isRouting: true,
      });
    },

    /**
     * Rallies a routing unit.
     */
    rally(state: BattleState, unitId: string): BattleState {
      return updateUnit(state, unitId, {
        isRouting: false,
      });
    },
  };
}

/**
 * Default export for convenience.
 */
export default createResolveProcessor;
