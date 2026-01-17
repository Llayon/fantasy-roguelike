/**
 * Tier 1: Engagement (Zone of Control) Processor
 *
 * Implements the engagement/Zone of Control system which controls
 * how units interact when in close proximity.
 *
 * Key mechanics:
 * - Zone of Control (ZoC): Adjacent cells around a melee unit
 * - Engagement: When an enemy enters a unit's ZoC
 * - Attack of Opportunity: Free attack when enemy leaves ZoC
 * - Archer Penalty: Ranged units suffer accuracy penalty when engaged
 *
 * @module core/mechanics/tier1/engagement
 */

import type { EngagementConfig } from '../../config/mechanics.types';
import type { BattleState } from '../../../types/battle-state';
import type { BattleUnit } from '../../../types/battle-unit';
import type { Position } from '../../../types/grid.types';
import { getNeighbors, manhattanDistance } from '../../../grid/grid';
import { updateUnit, updateUnits, findUnit } from '../../../utils/state-helpers';
import { SeededRandom } from '../../../utils/random';
import type {
  EngagementProcessor,
  EngagementStatus,
  ZoneOfControl,
  ZoCCheckResult,
  AoOTrigger,
  AoOResult,
  UnitWithEngagement,
} from './engagement.types';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Default hit chance for Attack of Opportunity (80%) */
export const AOO_HIT_CHANCE = 0.8;

/** Damage multiplier for Attack of Opportunity (50% of normal) */
export const AOO_DAMAGE_MULTIPLIER = 0.5;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has Zone of Control capability.
 * Only melee units (range <= 1) project ZoC by default.
 *
 * @param unit - Unit to check
 * @returns True if unit projects Zone of Control
 */
function hasZoC(unit: BattleUnit & UnitWithEngagement): boolean {
  // Explicit override takes precedence
  if (unit.hasZoneOfControl !== undefined) {
    return unit.hasZoneOfControl;
  }
  // Default: melee units (range <= 1) have ZoC
  return unit.range <= 1;
}

/**
 * Checks if a unit is a ranged unit (for archer penalty).
 *
 * @param unit - Unit to check
 * @returns True if unit is ranged
 */
function isRangedUnit(unit: BattleUnit & UnitWithEngagement): boolean {
  if (unit.isRanged !== undefined) {
    return unit.isRanged;
  }
  return unit.range > 1;
}

/**
 * Gets all enemy units for a given unit.
 *
 * @param unit - Unit to find enemies for
 * @param state - Current battle state
 * @returns Array of enemy units
 */
function getEnemyUnits(unit: BattleUnit, state: BattleState): BattleUnit[] {
  return state.units.filter((u) => u.alive && u.team !== unit.team);
}

/**
 * Gets all adjacent positions to a unit.
 *
 * @param unit - Unit to get adjacent positions for
 * @returns Array of adjacent positions
 */
function getAdjacentPositions(unit: BattleUnit): Position[] {
  return getNeighbors(unit.position);
}

/**
 * Checks if two positions are adjacent (Manhattan distance = 1).
 *
 * @param a - First position
 * @param b - Second position
 * @returns True if positions are adjacent
 */
function areAdjacent(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) === 1;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an engagement processor instance.
 *
 * The engagement processor handles:
 * - Zone of Control detection
 * - Attack of Opportunity when enemies leave ZoC
 * - Archer penalty when engaged in melee
 * - Engagement status tracking
 *
 * @param config - Engagement configuration
 * @returns EngagementProcessor instance
 *
 * @example
 * const processor = createEngagementProcessor({
 *   attackOfOpportunity: true,
 *   archerPenalty: true,
 *   archerPenaltyPercent: 0.5,
 * });
 *
 * // Check engagement status
 * const status = processor.getEngagementStatus(unit, state);
 *
 * // Get archer penalty
 * const penalty = processor.getArcherPenalty(archer, state, config);
 */
export function createEngagementProcessor(config: EngagementConfig): EngagementProcessor {
  return {
    /**
     * Gets the engagement status of a unit.
     * Checks if unit is in any enemy's Zone of Control.
     *
     * @param unit - Unit to check engagement status for
     * @param state - Current battle state with all units
     * @returns Engagement status ('free', 'engaged', or 'pinned')
     */
    getEngagementStatus(
      unit: BattleUnit & UnitWithEngagement,
      state: BattleState,
    ): EngagementStatus {
      // Get all enemy units with ZoC
      const enemies = getEnemyUnits(unit, state);
      const engagingEnemies = enemies.filter((enemy) => {
        const enemyWithEngagement = enemy as BattleUnit & UnitWithEngagement;
        return hasZoC(enemyWithEngagement) && areAdjacent(unit.position, enemy.position);
      });

      if (engagingEnemies.length === 0) {
        return 'free';
      }

      if (engagingEnemies.length >= 2) {
        return 'pinned';
      }

      return 'engaged';
    },

    /**
     * Gets the Zone of Control for a unit.
     * Returns adjacent cells that the unit controls.
     *
     * @param unit - Unit to get Zone of Control for
     * @returns Zone of Control information with controlled cells
     */
    getZoneOfControl(unit: BattleUnit & UnitWithEngagement): ZoneOfControl {
      const active = unit.alive && hasZoC(unit);
      const cells = active ? getAdjacentPositions(unit) : [];

      return {
        unitId: unit.instanceId,
        cells,
        active,
      };
    },

    /**
     * Checks if a position is in any unit's Zone of Control.
     *
     * @param position - Position to check for ZoC coverage
     * @param state - Current battle state with all units
     * @param excludeUnitId - Optional unit ID to exclude from check
     * @returns ZoC check result with controlling units
     */
    checkZoneOfControl(
      position: Position,
      state: BattleState,
      excludeUnitId?: string,
    ): ZoCCheckResult {
      const controllingUnits: string[] = [];

      for (const unit of state.units) {
        // Skip dead units and excluded unit
        if (!unit.alive) continue;
        if (excludeUnitId && unit.instanceId === excludeUnitId) continue;

        const unitWithEngagement = unit as BattleUnit & UnitWithEngagement;
        if (!hasZoC(unitWithEngagement)) continue;

        // Check if position is adjacent to this unit
        if (areAdjacent(position, unit.position)) {
          controllingUnits.push(unit.instanceId);
        }
      }

      return {
        inZoC: controllingUnits.length > 0,
        controllingUnits,
        triggersAoO: config.attackOfOpportunity && controllingUnits.length > 0,
      };
    },

    /**
     * Checks if movement triggers Attack of Opportunity.
     *
     * @param unit - Unit that is moving
     * @param fromPosition - Starting position of the movement
     * @param toPosition - Target position of the movement
     * @param state - Current battle state with all units
     * @returns Array of AoO triggers (empty if none triggered)
     */
    checkAttackOfOpportunity(
      unit: BattleUnit & UnitWithEngagement,
      fromPosition: Position,
      toPosition: Position,
      state: BattleState,
    ): AoOTrigger[] {
      // AoO disabled in config
      if (!config.attackOfOpportunity) {
        return [];
      }

      const triggers: AoOTrigger[] = [];
      const enemies = getEnemyUnits(unit, state);

      for (const enemy of enemies) {
        const enemyWithEngagement = enemy as BattleUnit & UnitWithEngagement;

        // Skip enemies without ZoC
        if (!hasZoC(enemyWithEngagement)) continue;

        // Skip enemies that already used AoO this turn
        if (enemyWithEngagement.usedAttackOfOpportunity) continue;

        // Check if unit was in enemy's ZoC at start position
        const wasInZoC = areAdjacent(fromPosition, enemy.position);

        // Check if unit is leaving ZoC (moving away from enemy)
        const isLeavingZoC = wasInZoC && !areAdjacent(toPosition, enemy.position);

        if (isLeavingZoC) {
          triggers.push({
            type: 'leave_zoc',
            attacker: enemy,
            target: unit,
            fromPosition,
            toPosition,
          });
        }
      }

      return triggers;
    },

    /**
     * Executes an Attack of Opportunity.
     *
     * @param trigger - AoO trigger information with attacker and target
     * @param state - Current battle state
     * @param seed - Random seed for deterministic hit calculation
     * @returns AoO result with hit status, damage, and updated state
     */
    executeAttackOfOpportunity(trigger: AoOTrigger, state: BattleState, seed: number): AoOResult {
      const { attacker, target } = trigger;
      const random = new SeededRandom(seed);

      // AoO hit chance: fixed 80% chance to hit
      const roll = random.next();
      const hit = roll < AOO_HIT_CHANCE;

      if (!hit) {
        // Mark attacker as having used AoO
        const newState = updateUnit(state, attacker.instanceId, {
          usedAttackOfOpportunity: true,
        } as Partial<BattleUnit>);

        return {
          hit: false,
          damage: 0,
          movementInterrupted: false,
          state: newState,
        };
      }

      // AoO damage: max(1, floor((ATK - armor) * 0.5))
      const baseDamage = attacker.stats.atk;
      const targetArmor = target.stats.armor;
      const damage = Math.max(1, Math.floor((baseDamage - targetArmor) * AOO_DAMAGE_MULTIPLIER));

      // Apply damage to target
      const newHp = Math.max(0, target.currentHp - damage);

      // Update both units
      const newState = updateUnits(state, [
        {
          instanceId: target.instanceId,
          updates: {
            currentHp: newHp,
            alive: newHp > 0,
          },
        },
        {
          instanceId: attacker.instanceId,
          updates: {
            usedAttackOfOpportunity: true,
          } as Partial<BattleUnit>,
        },
      ]);

      return {
        hit: true,
        damage,
        movementInterrupted: false, // AoO doesn't interrupt movement by default
        state: newState,
      };
    },

    /**
     * Calculates archer penalty when engaged.
     * Returns damage multiplier (1.0 = no penalty, 0.5 = 50% damage).
     *
     * @param unit - Ranged unit to check for penalty
     * @param state - Current battle state
     * @param engagementConfig - Engagement configuration with penalty settings
     * @returns Damage multiplier (0.0 to 1.0)
     */
    getArcherPenalty(
      unit: BattleUnit & UnitWithEngagement,
      state: BattleState,
      engagementConfig: EngagementConfig,
    ): number {
      // Penalty disabled in config
      if (!engagementConfig.archerPenalty) {
        return 1.0;
      }

      // Only ranged units suffer penalty
      if (!isRangedUnit(unit)) {
        return 1.0;
      }

      // Check if unit is engaged
      const status = this.getEngagementStatus(unit, state);
      if (status === 'free') {
        return 1.0;
      }

      // Archer penalty: multiplier = 1.0 - archerPenaltyPercent
      return 1.0 - engagementConfig.archerPenaltyPercent;
    },

    /**
     * Updates engagement status for all units.
     * Should be called after movement to recalculate engagements.
     *
     * @param state - Current battle state with all units
     * @returns Updated battle state with engagement info on all units
     */
    updateEngagements(state: BattleState): BattleState {
      const updates: Array<{ instanceId: string; updates: Partial<BattleUnit> }> = [];

      for (const unit of state.units) {
        if (!unit.alive) continue;

        const unitWithEngagement = unit as BattleUnit & UnitWithEngagement;
        const status = this.getEngagementStatus(unitWithEngagement, state);

        // Find all enemies engaging this unit
        const enemies = getEnemyUnits(unit, state);
        const engagingEnemyIds = enemies
          .filter((enemy) => {
            const enemyWithEngagement = enemy as BattleUnit & UnitWithEngagement;
            return hasZoC(enemyWithEngagement) && areAdjacent(unit.position, enemy.position);
          })
          .map((e) => e.instanceId);

        updates.push({
          instanceId: unit.instanceId,
          updates: {
            engaged: status !== 'free',
            engagedBy: engagingEnemyIds.length > 0 ? engagingEnemyIds : [],
          },
        });
      }

      return updateUnits(state, updates);
    },

    /**
     * Reset Attack of Opportunity usage for a unit at turn end.
     *
     * @param state - Current battle state
     * @param unitId - Unit to reset AoO for
     * @returns Updated battle state
     */
    resetAoOUsage(state: BattleState, unitId: string): BattleState {
      const unit = findUnit(state, unitId);
      if (!unit) return state;

      const unitWithEngagement = unit as BattleUnit & UnitWithEngagement;
      if (!unitWithEngagement.usedAttackOfOpportunity) {
        return state;
      }

      return updateUnit(state, unitId, {
        usedAttackOfOpportunity: false,
      } as Partial<BattleUnit>);
    },
  };
}

/**
 * Default export for convenience.
 */
export default createEngagementProcessor;
