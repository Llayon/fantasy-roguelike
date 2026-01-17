/**
 * Tier 2: Intercept Processor
 *
 * Implements the intercept system which allows units to block or engage
 * passing enemies during movement.
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
import { updateUnit, updateUnits } from '../../../utils/state-helpers';
import { manhattanDistance } from '../../../grid/grid';
import type {
  InterceptProcessor,
  InterceptCheckResult,
  InterceptOpportunity,
  InterceptExecutionResult,
  DisengageResult,
  UnitWithIntercept,
  InterceptType,
  InterceptBlockReason,
} from './intercept.types';
import {
  HARD_INTERCEPT_DAMAGE_MULTIPLIER,
  DEFAULT_DISENGAGE_COST,
  HARD_INTERCEPT_TAG,
  CAVALRY_TAG,
} from './intercept.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the spear wall tag (can hard intercept).
 */
function hasSpearWallTag(unit: BattleUnit & UnitWithIntercept): boolean {
  if (unit.canHardIntercept !== undefined) {
    return unit.canHardIntercept;
  }
  return unit.tags?.includes(HARD_INTERCEPT_TAG) ?? false;
}

/**
 * Checks if a unit is cavalry (can be hard intercepted).
 */
function isCavalry(unit: BattleUnit & UnitWithIntercept): boolean {
  if (unit.isCavalry !== undefined) {
    return unit.isCavalry;
  }
  return unit.tags?.includes(CAVALRY_TAG) ?? false;
}

/**
 * Checks if a unit can perform soft intercept (melee infantry).
 */
function canPerformSoftIntercept(unit: BattleUnit & UnitWithIntercept): boolean {
  if (unit.canSoftIntercept !== undefined) {
    return unit.canSoftIntercept;
  }
  return unit.range <= 1;
}

/**
 * Gets all enemy units for a given unit.
 */
function getEnemyUnits(unit: BattleUnit, state: BattleState): (BattleUnit & UnitWithIntercept)[] {
  return state.units.filter((u) => u.alive && u.team !== unit.team) as (BattleUnit &
    UnitWithIntercept)[];
}

/**
 * Checks if two positions are adjacent (Manhattan distance = 1).
 */
function areAdjacent(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) === 1;
}

/**
 * Gets the maximum intercepts per round for a unit.
 */
function getMaxIntercepts(unit: BattleUnit & UnitWithIntercept): number {
  return unit.maxIntercepts ?? 1;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an intercept processor instance.
 *
 * @param config - Intercept configuration
 * @returns InterceptProcessor instance
 *
 * @example
 * const processor = createInterceptProcessor({
 *   hardIntercept: true,
 *   softIntercept: true,
 *   disengageCost: 2,
 * });
 */
export function createInterceptProcessor(config: InterceptConfig): InterceptProcessor {
  return {
    /**
     * Checks if a unit can perform hard intercept (stop cavalry).
     */
    canHardIntercept(
      interceptor: BattleUnit & UnitWithIntercept,
      target: BattleUnit & UnitWithIntercept,
      interceptConfig: InterceptConfig,
    ): boolean {
      if (!interceptConfig.hardIntercept) {
        return false;
      }

      if (!interceptor.alive || interceptor.currentHp <= 0) {
        return false;
      }

      if (!hasSpearWallTag(interceptor)) {
        return false;
      }

      if (!isCavalry(target)) {
        return false;
      }

      const maxIntercepts = getMaxIntercepts(interceptor);
      const remaining = interceptor.interceptsRemaining ?? maxIntercepts;
      if (remaining <= 0) {
        return false;
      }

      return true;
    },

    /**
     * Checks if a unit can perform soft intercept (engage passing unit).
     */
    canSoftIntercept(
      interceptor: BattleUnit & UnitWithIntercept,
      target: BattleUnit & UnitWithIntercept,
      interceptConfig: InterceptConfig,
    ): boolean {
      if (!interceptConfig.softIntercept) {
        return false;
      }

      if (!interceptor.alive || interceptor.currentHp <= 0) {
        return false;
      }

      if (interceptor.team === target.team) {
        return false;
      }

      if (!canPerformSoftIntercept(interceptor)) {
        return false;
      }

      const maxIntercepts = getMaxIntercepts(interceptor);
      const remaining = interceptor.interceptsRemaining ?? maxIntercepts;
      if (remaining <= 0) {
        return false;
      }

      return true;
    },

    /**
     * Checks for intercept opportunities along a movement path.
     */
    checkIntercept(
      unit: BattleUnit & UnitWithIntercept,
      path: Position[],
      state: BattleState,
      interceptConfig: InterceptConfig,
    ): InterceptCheckResult {
      const opportunities: InterceptOpportunity[] = [];
      let movementBlocked = false;
      let blockedAt: Position | undefined;
      let firstIntercept: InterceptOpportunity | undefined;

      const enemies = getEnemyUnits(unit, state);

      for (let i = 1; i < path.length; i++) {
        const currentPos = path[i];
        if (!currentPos) continue;

        for (const enemy of enemies) {
          if (!areAdjacent(currentPos, enemy.position)) {
            continue;
          }

          let interceptType: InterceptType | null = null;
          let canIntercept = false;
          let reason: InterceptBlockReason | undefined;

          if (this.canHardIntercept(enemy, unit, interceptConfig)) {
            interceptType = 'hard';
            canIntercept = true;
          } else if (this.canSoftIntercept(enemy, unit, interceptConfig)) {
            interceptType = 'soft';
            canIntercept = true;
          } else {
            if (enemy.team === unit.team) {
              reason = 'same_team';
            } else if ((enemy.interceptsRemaining ?? getMaxIntercepts(enemy)) <= 0) {
              reason = 'no_intercepts';
            } else if (!canPerformSoftIntercept(enemy) && !hasSpearWallTag(enemy)) {
              reason = 'disabled';
            } else {
              reason = 'wrong_type';
            }
          }

          if (interceptType) {
            const opportunity: InterceptOpportunity = {
              interceptor: enemy,
              target: unit,
              type: interceptType,
              position: currentPos,
              canIntercept,
              ...(reason !== undefined && { reason }),
            };

            opportunities.push(opportunity);

            if (!firstIntercept && canIntercept) {
              firstIntercept = opportunity;
            }

            if (interceptType === 'hard' && canIntercept) {
              movementBlocked = true;
              blockedAt = currentPos;
              break;
            }
          }
        }

        if (movementBlocked) {
          break;
        }
      }

      const result: InterceptCheckResult = {
        hasIntercept: opportunities.length > 0,
        opportunities,
        movementBlocked,
      };

      if (firstIntercept !== undefined) {
        result.firstIntercept = firstIntercept;
      }

      if (blockedAt !== undefined) {
        result.blockedAt = blockedAt;
      }

      return result;
    },

    /**
     * Executes a hard intercept (spearmen stop cavalry).
     */
    executeHardIntercept(
      interceptor: BattleUnit & UnitWithIntercept,
      target: BattleUnit & UnitWithIntercept,
      state: BattleState,
      _seed: number,
    ): InterceptExecutionResult {
      const interceptorAtk = interceptor.stats?.atk ?? 0;
      const damage = Math.floor(interceptorAtk * HARD_INTERCEPT_DAMAGE_MULTIPLIER);

      const newTargetHp = Math.max(0, target.currentHp - damage);
      const targetAlive = newTargetHp > 0;

      const maxIntercepts = getMaxIntercepts(interceptor);
      const currentIntercepts = interceptor.interceptsRemaining ?? maxIntercepts;
      const newIntercepts = Math.max(0, currentIntercepts - 1);

      const newState = updateUnits(state, [
        {
          instanceId: target.instanceId,
          updates: {
            currentHp: newTargetHp,
            alive: targetAlive,
            momentum: 0,
            isCharging: false,
          },
        },
        {
          instanceId: interceptor.instanceId,
          updates: {
            interceptsRemaining: newIntercepts,
            isIntercepting: true,
          } as Partial<BattleUnit>,
        },
      ]);

      return {
        success: true,
        type: 'hard',
        damage,
        targetNewHp: newTargetHp,
        movementStopped: true,
        stoppedAt: interceptor.position,
        interceptorInterceptsRemaining: newIntercepts,
        state: newState,
      };
    },

    /**
     * Executes a soft intercept (infantry engages passing unit).
     */
    executeSoftIntercept(
      interceptor: BattleUnit & UnitWithIntercept,
      target: BattleUnit & UnitWithIntercept,
      state: BattleState,
    ): InterceptExecutionResult {
      const maxIntercepts = getMaxIntercepts(interceptor);
      const currentIntercepts = interceptor.interceptsRemaining ?? maxIntercepts;
      const newIntercepts = Math.max(0, currentIntercepts - 1);

      const newState = updateUnits(state, [
        {
          instanceId: target.instanceId,
          updates: {
            engaged: true,
          },
        },
        {
          instanceId: interceptor.instanceId,
          updates: {
            interceptsRemaining: newIntercepts,
            isIntercepting: true,
          } as Partial<BattleUnit>,
        },
      ]);

      return {
        success: true,
        type: 'soft',
        damage: 0,
        targetNewHp: target.currentHp,
        movementStopped: false,
        interceptorInterceptsRemaining: newIntercepts,
        state: newState,
      };
    },

    /**
     * Calculates the movement cost to disengage from engagement.
     */
    getDisengageCost(
      unit: BattleUnit & UnitWithIntercept,
      _state: BattleState,
      interceptConfig: InterceptConfig,
    ): number {
      if (!unit.engaged) {
        return 0;
      }

      return interceptConfig.disengageCost ?? DEFAULT_DISENGAGE_COST;
    },

    /**
     * Attempts to disengage a unit from engagement.
     */
    attemptDisengage(
      unit: BattleUnit & UnitWithIntercept,
      state: BattleState,
      interceptConfig: InterceptConfig,
      _seed: number,
    ): DisengageResult {
      if (!unit.engaged) {
        return {
          success: true,
          movementCost: 0,
          remainingMovement: unit.stats?.speed ?? 0,
          triggeredAoO: false,
          state,
        };
      }

      const cost = this.getDisengageCost(unit, state, interceptConfig);
      const unitSpeed = unit.stats?.speed ?? 0;

      if (unitSpeed < cost) {
        return {
          success: false,
          movementCost: 0,
          remainingMovement: unitSpeed,
          triggeredAoO: false,
          reason: 'insufficient_movement',
          state,
        };
      }

      const newState = updateUnit(state, unit.instanceId, {
        engaged: false,
      });

      return {
        success: true,
        movementCost: cost,
        remainingMovement: unitSpeed - cost,
        triggeredAoO: true,
        state: newState,
      };
    },

    /**
     * Resets intercept charges for a unit at round start.
     */
    resetInterceptCharges(
      unit: BattleUnit & UnitWithIntercept,
      round: number,
    ): BattleUnit & UnitWithIntercept {
      const maxIntercepts = getMaxIntercepts(unit);

      return {
        ...unit,
        interceptsRemaining: maxIntercepts,
        maxIntercepts,
        isIntercepting: false,
        lastInterceptResetRound: round,
      };
    },
  };
}

/**
 * Default export for convenience.
 */
export default createInterceptProcessor;
