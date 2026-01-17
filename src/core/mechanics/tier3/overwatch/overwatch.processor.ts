/**
 * Tier 3: Overwatch Processor
 *
 * Implements the overwatch (ranged reaction fire) system which allows ranged
 * units to enter a Vigilance state and automatically fire at enemies that
 * move within their range.
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
import { manhattanDistance } from '../../../grid/grid';
import { seededRandom } from '../../../utils/random';
import { updateUnit, updateUnits } from '../../../utils/state-helpers';
import type {
  OverwatchProcessor,
  UnitWithOverwatch,
  OverwatchCheckResult,
  OverwatchOpportunity,
  OverwatchShotResult,
  EnterVigilanceResult,
  ExitVigilanceResult,
  ToggleVigilanceResult,
  OverwatchBlockReason,
  VigilanceBlockReason,
  VigilanceExitBlockReason,
  OverwatchProcessorOptions,
} from './overwatch.types';
import {
  DEFAULT_OVERWATCH_DAMAGE_MODIFIER,
  DEFAULT_MAX_OVERWATCH_SHOTS,
  DEFAULT_OVERWATCH_ACCURACY_PENALTY,
  OVERWATCH_TAG,
  OVERWATCH_IMMUNE_TAG,
} from './overwatch.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the overwatch capability.
 */
function hasOverwatchCapability(
  unit: BattleUnit & UnitWithOverwatch,
  overwatchTags: string[] = [OVERWATCH_TAG],
): boolean {
  if (unit.canOverwatch !== undefined) {
    return unit.canOverwatch;
  }
  const tags = unit.tags ?? [];
  return overwatchTags.some((tag) => tags.includes(tag));
}

/**
 * Checks if a unit is immune to overwatch (stealth units).
 */
function hasOverwatchImmunity(
  unit: BattleUnit & UnitWithOverwatch,
  immunityTags: string[] = [OVERWATCH_IMMUNE_TAG],
): boolean {
  const tags = unit.tags ?? [];
  return immunityTags.some((tag) => tags.includes(tag));
}

/**
 * Gets the attack value for a unit.
 */
function getUnitAtk(unit: BattleUnit & UnitWithOverwatch): number {
  return unit.stats?.atk ?? 0;
}

/**
 * Gets the current HP for a unit.
 */
function getUnitHp(unit: BattleUnit & UnitWithOverwatch): number {
  return unit.currentHp ?? 0;
}

/**
 * Gets the attack range for a unit.
 */
function getUnitRange(unit: BattleUnit & UnitWithOverwatch): number {
  return unit.range ?? 1;
}

/**
 * Gets the overwatch range for a unit.
 */
function getOverwatchRange(unit: BattleUnit & UnitWithOverwatch): number {
  return unit.overwatchRange ?? getUnitRange(unit);
}

/**
 * Gets the maximum overwatch shots for a unit.
 */
function getMaxOverwatchShots(
  unit: BattleUnit & UnitWithOverwatch,
  defaultMax: number = DEFAULT_MAX_OVERWATCH_SHOTS,
): number {
  return unit.maxOverwatchShots ?? defaultMax;
}

/**
 * Gets the remaining overwatch shots for a unit.
 */
function getRemainingOverwatchShots(
  unit: BattleUnit & UnitWithOverwatch,
  defaultMax: number = DEFAULT_MAX_OVERWATCH_SHOTS,
): number {
  const max = getMaxOverwatchShots(unit, defaultMax);
  return unit.overwatchShotsRemaining ?? max;
}

/**
 * Gets the unit's current ammunition.
 */
function getUnitAmmo(unit: BattleUnit & UnitWithOverwatch): number {
  const ammo = unit.ammo;
  if (ammo === null || ammo === undefined) {
    return Infinity; // Unlimited ammo
  }
  return ammo;
}

/**
 * Gets all allied units in vigilance state.
 */
function getVigilantEnemies(
  movingUnit: BattleUnit,
  state: BattleState,
): (BattleUnit & UnitWithOverwatch)[] {
  return state.units.filter((u) => {
    const unitWithOverwatch = u as BattleUnit & UnitWithOverwatch;
    return u.alive && u.team !== movingUnit.team && unitWithOverwatch.vigilance === 'active';
  }) as (BattleUnit & UnitWithOverwatch)[];
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an overwatch processor instance.
 *
 * @param options - Optional configuration for overwatch behavior
 * @returns OverwatchProcessor instance
 *
 * @example
 * const processor = createOverwatchProcessor();
 * const result = processor.enterVigilance(archer, state);
 */
export function createOverwatchProcessor(
  options: OverwatchProcessorOptions = {},
): OverwatchProcessor {
  const damageModifier = options.damageModifier ?? DEFAULT_OVERWATCH_DAMAGE_MODIFIER;
  const maxShots = options.maxShots ?? DEFAULT_MAX_OVERWATCH_SHOTS;
  const accuracyPenalty = options.accuracyPenalty ?? DEFAULT_OVERWATCH_ACCURACY_PENALTY;
  const overwatchTags = options.overwatchTags ?? [OVERWATCH_TAG];
  const immunityTags = options.immunityTags ?? [OVERWATCH_IMMUNE_TAG];

  return {
    /**
     * Checks if a unit can enter vigilance (overwatch) state.
     */
    canEnterVigilance(unit: BattleUnit & UnitWithOverwatch): boolean {
      if (!hasOverwatchCapability(unit, overwatchTags)) {
        return false;
      }
      if (getUnitAmmo(unit) <= 0) {
        return false;
      }
      if (unit.vigilance === 'active' || unit.vigilance === 'triggered') {
        return false;
      }
      if (unit.enteredVigilanceThisTurn) {
        return false;
      }
      return true;
    },

    /**
     * Enters vigilance state for a unit.
     */
    enterVigilance(unit: BattleUnit & UnitWithOverwatch, state: BattleState): EnterVigilanceResult {
      if (!hasOverwatchCapability(unit, overwatchTags)) {
        return {
          success: false,
          reason: 'not_ranged' as VigilanceBlockReason,
          unit,
          state,
        };
      }

      if (getUnitAmmo(unit) <= 0) {
        return {
          success: false,
          reason: 'no_ammo' as VigilanceBlockReason,
          unit,
          state,
        };
      }

      if (unit.vigilance === 'active' || unit.vigilance === 'triggered') {
        return {
          success: false,
          reason: 'already_vigilant' as VigilanceBlockReason,
          unit,
          state,
        };
      }

      const overwatchRange = getOverwatchRange(unit);
      const maxOverwatchShots = getMaxOverwatchShots(unit, maxShots);

      const updatedUnit: BattleUnit & UnitWithOverwatch = {
        ...unit,
        vigilance: 'active',
        overwatchShotsRemaining: maxOverwatchShots,
        overwatchRange,
        overwatchTargetsFired: [],
        enteredVigilanceThisTurn: true,
        canOverwatch: true,
      };

      return {
        success: true,
        unit: updatedUnit,
        state: updateUnit(state, unit.instanceId, updatedUnit),
      };
    },

    /**
     * Checks if a unit can exit vigilance state.
     */
    canExitVigilance(unit: BattleUnit & UnitWithOverwatch): boolean {
      if (unit.vigilance !== 'active') {
        return false;
      }
      return true;
    },

    /**
     * Exits vigilance state for a unit.
     */
    exitVigilance(unit: BattleUnit & UnitWithOverwatch, state: BattleState): ExitVigilanceResult {
      if (unit.vigilance === 'inactive' || unit.vigilance === undefined) {
        return {
          success: false,
          reason: 'not_vigilant' as VigilanceExitBlockReason,
          unit,
          state,
        };
      }

      if (unit.vigilance === 'triggered') {
        return {
          success: false,
          reason: 'already_triggered' as VigilanceExitBlockReason,
          unit,
          state,
        };
      }

      if (unit.vigilance === 'exhausted') {
        return {
          success: false,
          reason: 'exhausted' as VigilanceExitBlockReason,
          unit,
          state,
        };
      }

      const updatedUnit: BattleUnit & UnitWithOverwatch = {
        ...unit,
        vigilance: 'inactive',
        overwatchShotsRemaining: 0,
        overwatchTargetsFired: [],
        enteredVigilanceThisTurn: false,
      };

      return {
        success: true,
        unit: updatedUnit,
        state: updateUnit(state, unit.instanceId, updatedUnit),
      };
    },

    /**
     * Toggles vigilance state for a unit.
     */
    toggleVigilance(
      unit: BattleUnit & UnitWithOverwatch,
      state: BattleState,
    ): ToggleVigilanceResult {
      if (unit.vigilance === 'active') {
        const exitResult = this.exitVigilance(unit, state);
        return {
          success: exitResult.success,
          action: exitResult.success ? 'exited' : undefined,
          reason: exitResult.reason,
          unit: exitResult.unit,
          state: exitResult.state,
        };
      }

      if (unit.vigilance === 'triggered') {
        return {
          success: false,
          action: undefined,
          reason: 'already_triggered' as VigilanceExitBlockReason,
          unit,
          state,
        };
      }

      if (unit.vigilance === 'exhausted') {
        return {
          success: false,
          action: undefined,
          reason: 'exhausted' as VigilanceExitBlockReason,
          unit,
          state,
        };
      }

      const enterResult = this.enterVigilance(unit, state);
      return {
        success: enterResult.success,
        action: enterResult.success ? 'entered' : undefined,
        reason: enterResult.reason,
        unit: enterResult.unit,
        state: enterResult.state,
      };
    },

    /**
     * Checks if a unit is currently in vigilance state.
     */
    isVigilant(unit: BattleUnit & UnitWithOverwatch): boolean {
      return unit.vigilance === 'active';
    },

    /**
     * Checks if a target is immune to overwatch.
     */
    isImmuneToOverwatch(target: BattleUnit & UnitWithOverwatch): boolean {
      return hasOverwatchImmunity(target, immunityTags);
    },

    /**
     * Checks for overwatch triggers along a movement path.
     */
    checkOverwatch(
      target: BattleUnit & UnitWithOverwatch,
      path: Position[],
      state: BattleState,
    ): OverwatchCheckResult {
      const opportunities: OverwatchOpportunity[] = [];
      const triggerPositions: Position[] = [];

      if (this.isImmuneToOverwatch(target)) {
        return {
          hasOverwatch: false,
          opportunities: [],
          totalShots: 0,
          triggerPositions: [],
        };
      }

      const vigilantEnemies = getVigilantEnemies(target, state);

      for (let i = 1; i < path.length; i++) {
        const currentPos = path[i];
        if (!currentPos) continue;

        for (const watcher of vigilantEnemies) {
          const targetsFired = watcher.overwatchTargetsFired ?? [];
          if (targetsFired.includes(target.id)) {
            continue;
          }

          const distance = manhattanDistance(watcher.position, currentPos);
          const overwatchRange = getOverwatchRange(watcher);

          let canFire = true;
          let reason: OverwatchBlockReason | undefined;

          if (distance > overwatchRange) {
            canFire = false;
            reason = 'out_of_range';
          }

          if (canFire && getUnitAmmo(watcher) <= 0) {
            canFire = false;
            reason = 'no_ammo';
          }

          if (canFire && getRemainingOverwatchShots(watcher, maxShots) <= 0) {
            canFire = false;
            reason = 'no_shots';
          }

          if (canFire && watcher.vigilance !== 'active') {
            canFire = false;
            reason = 'not_vigilant';
          }

          if (distance <= overwatchRange) {
            const opportunity: OverwatchOpportunity = {
              watcher,
              target,
              triggerPosition: currentPos,
              canFire,
              distance,
              ...(reason !== undefined && { reason }),
            };

            const existingIndex = opportunities.findIndex((o) => o.watcher.id === watcher.id);

            if (existingIndex === -1) {
              opportunities.push(opportunity);
              if (canFire) {
                triggerPositions.push(currentPos);
              }
            }
          }
        }
      }

      const totalShots = opportunities.filter((o) => o.canFire).length;

      return {
        hasOverwatch: totalShots > 0,
        opportunities,
        totalShots,
        triggerPositions,
      };
    },

    /**
     * Calculates overwatch damage.
     * Formula: damage = floor(watcher.atk * damageModifier)
     */
    calculateOverwatchDamage(
      watcher: BattleUnit & UnitWithOverwatch,
      _target: BattleUnit & UnitWithOverwatch,
    ): number {
      const watcherAtk = getUnitAtk(watcher);
      return Math.floor(watcherAtk * damageModifier);
    },

    /**
     * Executes an overwatch shot.
     * Hit chance: hitChance = 1.0 - accuracyPenalty - targetDodge
     */
    executeOverwatchShot(
      watcher: BattleUnit & UnitWithOverwatch,
      target: BattleUnit & UnitWithOverwatch,
      state: BattleState,
      seed: number,
    ): OverwatchShotResult {
      const currentAmmo = getUnitAmmo(watcher);
      const newAmmo = currentAmmo === Infinity ? Infinity : Math.max(0, currentAmmo - 1);

      const currentShots = getRemainingOverwatchShots(watcher, maxShots);
      const newShots = Math.max(0, currentShots - 1);

      const targetsFired = [...(watcher.overwatchTargetsFired ?? []), target.id];
      const newVigilance = newShots <= 0 ? 'exhausted' : 'triggered';

      const targetDodge = (target.stats?.dodge ?? 0) / 100;
      const hitChance = Math.max(0, 1.0 - accuracyPenalty - targetDodge);

      const roll = seededRandom(seed);
      const hit = roll < hitChance;

      let damage = 0;
      let targetNewHp = getUnitHp(target);

      if (hit) {
        damage = this.calculateOverwatchDamage(watcher, target);
        targetNewHp = Math.max(0, targetNewHp - damage);
      }

      const updatedWatcher: Partial<BattleUnit & UnitWithOverwatch> = {
        ammo: newAmmo === Infinity ? null : newAmmo,
        overwatchShotsRemaining: newShots,
        overwatchTargetsFired: targetsFired,
        vigilance: newVigilance as 'triggered' | 'exhausted',
      };

      const targetAlive = targetNewHp > 0;
      const updatedTarget: Partial<BattleUnit & UnitWithOverwatch> = {
        currentHp: targetNewHp,
        alive: targetAlive,
      };

      const newState = updateUnits(state, [
        { instanceId: watcher.instanceId, updates: updatedWatcher },
        { instanceId: target.instanceId, updates: updatedTarget },
      ]);

      return {
        success: true,
        hit,
        damage,
        targetNewHp,
        ammoConsumed: 1,
        watcherAmmoRemaining: newAmmo === Infinity ? -1 : newAmmo,
        watcherShotsRemaining: newShots,
        state: newState,
      };
    },

    /**
     * Resets overwatch state for a unit.
     */
    resetOverwatch(unit: BattleUnit & UnitWithOverwatch): BattleUnit & UnitWithOverwatch {
      return {
        ...unit,
        vigilance: 'inactive',
        overwatchShotsRemaining: 0,
        overwatchTargetsFired: [],
        enteredVigilanceThisTurn: false,
      };
    },

    /**
     * Resets overwatch shots for a unit at round start.
     */
    resetOverwatchShots(unit: BattleUnit & UnitWithOverwatch): BattleUnit & UnitWithOverwatch {
      if (unit.vigilance !== 'active' && unit.vigilance !== 'triggered') {
        return unit;
      }

      const maxOverwatchShots = getMaxOverwatchShots(unit, maxShots);

      return {
        ...unit,
        overwatchShotsRemaining: maxOverwatchShots,
        overwatchTargetsFired: [],
        vigilance: 'active',
      };
    },
  };
}

export default createOverwatchProcessor;
