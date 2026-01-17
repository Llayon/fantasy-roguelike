/**
 * Target selection system for battle engine AI.
 * Provides various targeting strategies with deterministic tiebreaking.
 *
 * @fileoverview Target selection implementation with distance-based, health-based,
 * and threat-based targeting strategies.
 *
 * @module core/battle/targeting
 */

import type { Position } from '../types/grid.types';
import { manhattanDistance } from '../grid/grid';

// =============================================================================
// UNIT INTERFACE (minimal for core)
// =============================================================================

/**
 * Minimal unit interface for targeting.
 * Game-specific unit types should extend this.
 */
export interface TargetingUnit {
  /** Unit identifier */
  id: string;
  /** Unique instance identifier */
  instanceId: string;
  /** Whether unit is alive */
  alive: boolean;
  /** Current position */
  position: Position;
  /** Current hit points */
  currentHp: number;
  /** Maximum hit points */
  maxHp: number;
  /** Attack range */
  range: number;
  /** Unit role for threat calculation */
  role: string;
  /** Unit stats */
  stats: {
    /** Attack power */
    atk: number;
    /** Number of attacks per turn */
    atkCount: number;
  };
  /** Ability IDs (for taunt detection) */
  abilities: string[];
}

// =============================================================================
// TARGET SELECTION TYPES
// =============================================================================

/**
 * Available targeting strategies for AI units.
 */
export type TargetStrategy = 'nearest' | 'weakest' | 'highest_threat';

/**
 * Target selection result with metadata.
 */
export interface TargetSelectionResult<T extends TargetingUnit = TargetingUnit> {
  /** Selected target unit, null if no valid target */
  target: T | null;
  /** Strategy used for selection */
  strategy: TargetStrategy;
  /** Distance to target (for nearest strategy) */
  distance: number | undefined;
  /** Reason for selection or failure */
  reason: string;
}

// =============================================================================
// CORE TARGETING FUNCTIONS
// =============================================================================

/**
 * Find the nearest enemy unit using Manhattan distance.
 * Uses deterministic tiebreaking by ID when distances are equal.
 *
 * @param unit - The unit looking for a target
 * @param enemies - Array of potential enemy targets
 * @returns Nearest living enemy or null if none available
 */
export function findNearestEnemy<T extends TargetingUnit>(unit: T, enemies: T[]): T | null {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);

  if (livingEnemies.length === 0) {
    return null;
  }

  let nearestEnemy: T | null = null;
  let shortestDistance = Infinity;

  for (const enemy of livingEnemies) {
    const distance = manhattanDistance(unit.position, enemy.position);

    if (
      distance < shortestDistance ||
      (distance === shortestDistance && (!nearestEnemy || enemy.id.localeCompare(nearestEnemy.id) < 0))
    ) {
      nearestEnemy = enemy;
      shortestDistance = distance;
    }
  }

  return nearestEnemy;
}

/**
 * Find the enemy with the lowest current HP.
 * Uses deterministic tiebreaking by ID when HP values are equal.
 *
 * @param enemies - Array of potential enemy targets
 * @returns Enemy with lowest HP or null if none available
 */
export function findWeakestEnemy<T extends TargetingUnit>(enemies: T[]): T | null {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);

  if (livingEnemies.length === 0) {
    return null;
  }

  let weakestEnemy: T | null = null;
  let lowestHp = Infinity;

  for (const enemy of livingEnemies) {
    if (
      enemy.currentHp < lowestHp ||
      (enemy.currentHp === lowestHp && (!weakestEnemy || enemy.id.localeCompare(weakestEnemy.id) < 0))
    ) {
      weakestEnemy = enemy;
      lowestHp = enemy.currentHp;
    }
  }

  return weakestEnemy;
}

/**
 * Find enemy with Taunt ability that forces targeting.
 *
 * @param _unit - The unit looking for a target (unused but kept for API consistency)
 * @param enemies - Array of potential enemy targets
 * @param tauntAbilityId - ID of the taunt ability (default: 'taunt')
 * @returns Enemy with Taunt ability or null if none have Taunt
 */
export function findTauntTarget<T extends TargetingUnit>(
  _unit: T,
  enemies: T[],
  tauntAbilityId: string = 'taunt'
): T | null {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);
  const tauntingEnemies = livingEnemies.filter((enemy) => enemy.abilities.includes(tauntAbilityId));

  if (tauntingEnemies.length === 0) {
    return null;
  }

  return tauntingEnemies.reduce((best, current) =>
    current.id.localeCompare(best.id) < 0 ? current : best
  );
}

/**
 * Calculate threat level of an enemy unit.
 *
 * @param enemy - Enemy unit to evaluate
 * @param attacker - Unit evaluating the threat (for distance calculation)
 * @param roleModifiers - Optional role-based threat modifiers
 * @returns Numerical threat score (higher = more threatening)
 */
export function calculateThreatLevel<T extends TargetingUnit>(
  enemy: T,
  attacker: T,
  roleModifiers?: Record<string, number>
): number {
  if (!enemy.alive) {
    return 0;
  }

  const damageScore = enemy.stats.atk * enemy.stats.atkCount;
  const hpRatio = enemy.currentHp / enemy.maxHp;
  const survivabilityScore = (1 - hpRatio) * 50;
  const distance = manhattanDistance(attacker.position, enemy.position);
  const proximityScore = Math.max(0, 10 - distance);

  const defaultModifiers: Record<string, number> = {
    mage: 1.3,
    support: 1.2,
    ranged_dps: 1.1,
    tank: 0.8,
  };

  const modifiers = roleModifiers || defaultModifiers;
  const roleModifier = modifiers[enemy.role] || 1.0;

  return (damageScore + survivabilityScore + proximityScore) * roleModifier;
}

/**
 * Find the enemy with the highest threat level.
 *
 * @param unit - The unit evaluating threats
 * @param enemies - Array of potential enemy targets
 * @param roleModifiers - Optional role-based threat modifiers
 * @returns Enemy with highest threat or null if none available
 */
export function findHighestThreatEnemy<T extends TargetingUnit>(
  unit: T,
  enemies: T[],
  roleModifiers?: Record<string, number>
): T | null {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);

  if (livingEnemies.length === 0) {
    return null;
  }

  let highestThreatEnemy: T | null = null;
  let highestThreat = -1;

  for (const enemy of livingEnemies) {
    const threat = calculateThreatLevel(enemy, unit, roleModifiers);

    if (
      threat > highestThreat ||
      (threat === highestThreat &&
        (!highestThreatEnemy || enemy.id.localeCompare(highestThreatEnemy.id) < 0))
    ) {
      highestThreatEnemy = enemy;
      highestThreat = threat;
    }
  }

  return highestThreatEnemy;
}


// =============================================================================
// MAIN TARGET SELECTION FUNCTION
// =============================================================================

/**
 * Select target using specified strategy with fallback logic.
 * Implements priority system: Taunt > Strategy > Fallback to nearest.
 *
 * @param unit - The unit selecting a target
 * @param enemies - Array of potential enemy targets
 * @param strategy - Targeting strategy to use
 * @param tauntAbilityId - ID of the taunt ability (default: 'taunt')
 * @returns Selected target or null if no valid targets
 */
export function selectTarget<T extends TargetingUnit>(
  unit: T,
  enemies: T[],
  strategy: TargetStrategy,
  tauntAbilityId: string = 'taunt'
): T | null {
  const tauntTarget = findTauntTarget(unit, enemies, tauntAbilityId);
  if (tauntTarget) {
    return tauntTarget;
  }

  let target: T | null = null;

  switch (strategy) {
    case 'nearest':
      target = findNearestEnemy(unit, enemies);
      break;
    case 'weakest':
      target = findWeakestEnemy(enemies);
      break;
    case 'highest_threat':
      target = findHighestThreatEnemy(unit, enemies);
      break;
    default:
      target = findNearestEnemy(unit, enemies);
  }

  if (!target) {
    target = findNearestEnemy(unit, enemies);
  }

  return target;
}

/**
 * Select target with detailed result information.
 *
 * @param unit - The unit selecting a target
 * @param enemies - Array of potential enemy targets
 * @param strategy - Targeting strategy to use
 * @param tauntAbilityId - ID of the taunt ability (default: 'taunt')
 * @returns Detailed target selection result
 */
export function selectTargetWithDetails<T extends TargetingUnit>(
  unit: T,
  enemies: T[],
  strategy: TargetStrategy,
  tauntAbilityId: string = 'taunt'
): TargetSelectionResult<T> {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);

  if (livingEnemies.length === 0) {
    return {
      target: null,
      strategy,
      distance: undefined,
      reason: 'No living enemies available',
    };
  }

  const tauntTarget = findTauntTarget(unit, enemies, tauntAbilityId);
  if (tauntTarget) {
    return {
      target: tauntTarget,
      strategy: 'nearest',
      distance: manhattanDistance(unit.position, tauntTarget.position),
      reason: `Forced to target ${tauntTarget.id} due to Taunt ability`,
    };
  }

  let target: T | null = null;
  let reason = '';

  switch (strategy) {
    case 'nearest':
      target = findNearestEnemy(unit, enemies);
      reason = target
        ? `Nearest enemy at distance ${manhattanDistance(unit.position, target.position)}`
        : 'No reachable enemies';
      break;
    case 'weakest':
      target = findWeakestEnemy(enemies);
      reason = target ? `Weakest enemy with ${target.currentHp} HP` : 'No valid weak targets';
      break;
    case 'highest_threat':
      target = findHighestThreatEnemy(unit, enemies);
      reason = target
        ? `Highest threat enemy (${calculateThreatLevel(target, unit).toFixed(1)} threat)`
        : 'No threatening enemies';
      break;
  }

  if (!target) {
    target = findNearestEnemy(unit, enemies);
    reason = target ? `Fallback to nearest enemy` : 'No valid targets found';
  }

  return {
    target,
    strategy,
    distance: target ? manhattanDistance(unit.position, target.position) : undefined,
    reason,
  };
}

// =============================================================================
// TARGETING UTILITIES
// =============================================================================

/**
 * Check if a unit can target another unit (within range).
 *
 * @param attacker - Unit attempting to attack
 * @param target - Potential target unit
 * @returns True if target is within range and can be attacked
 */
export function canTarget<T extends TargetingUnit>(attacker: T, target: T): boolean {
  if (!target.alive) {
    return false;
  }

  const distance = manhattanDistance(attacker.position, target.position);
  return distance <= attacker.range;
}

/**
 * Get all enemies within attack range of a unit.
 *
 * @param unit - Unit checking for targets in range
 * @param enemies - Array of potential enemy targets
 * @returns Array of enemies within attack range
 */
export function getEnemiesInRange<T extends TargetingUnit>(unit: T, enemies: T[]): T[] {
  return enemies.filter((enemy) => canTarget(unit, enemy));
}

/**
 * Find optimal position to attack a specific target.
 *
 * @param unit - Unit that wants to attack
 * @param target - Target to attack
 * @param maxMovement - Maximum movement distance
 * @returns Array of positions from which unit can attack target
 */
export function findAttackPositions<T extends TargetingUnit>(
  unit: T,
  target: T,
  maxMovement: number
): Position[] {
  const positions: Position[] = [];

  for (let dx = -maxMovement; dx <= maxMovement; dx++) {
    for (let dy = -maxMovement; dy <= maxMovement; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > maxMovement) {
        continue;
      }

      const candidatePos: Position = {
        x: unit.position.x + dx,
        y: unit.position.y + dy,
      };

      const distanceToTarget = manhattanDistance(candidatePos, target.position);
      if (distanceToTarget <= unit.range) {
        positions.push(candidatePos);
      }
    }
  }

  return positions;
}

/**
 * Evaluate targeting strategy effectiveness for a unit.
 *
 * @param unit - Unit to evaluate strategies for
 * @param enemies - Available enemy targets
 * @param roleStrategies - Optional role-to-strategy mapping
 * @returns Recommended strategy based on unit role and battlefield state
 */
export function recommendTargetingStrategy<T extends TargetingUnit>(
  unit: T,
  enemies: T[],
  roleStrategies?: Record<string, TargetStrategy>
): TargetStrategy {
  const livingEnemies = enemies.filter((enemy) => enemy.alive);

  if (livingEnemies.length === 0) {
    return 'nearest';
  }

  const defaultStrategies: Record<string, TargetStrategy> = {
    mage: 'highest_threat',
    ranged_dps: 'highest_threat',
    melee_dps: 'weakest',
    tank: 'nearest',
    support: 'highest_threat',
  };

  const strategies = roleStrategies || defaultStrategies;
  return strategies[unit.role] || 'nearest';
}
