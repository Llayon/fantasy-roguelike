/**
 * State update helpers for immutable battle state management.
 * Provides utility functions for updating BattleState and BattleUnit
 * without mutating the original objects.
 *
 * All functions in this module follow the immutability principle:
 * - Original state/unit objects are never modified
 * - New objects are returned with the requested changes
 * - Mechanic-specific properties are preserved during updates
 *
 * @module core/utils/state-helpers
 * @see {@link BattleState} for state structure
 * @see {@link BattleUnit} for unit structure
 *
 * @example
 * import { updateUnit, updateUnits, findUnit } from './state-helpers';
 *
 * // Update a single unit
 * const newState = updateUnit(state, 'player_knight_0', { currentHp: 50 });
 *
 * // Update multiple units
 * const newState2 = updateUnits(state, [
 *   { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
 *   { instanceId: 'enemy_rogue_0', updates: { alive: false } },
 * ]);
 *
 * // Find a unit by instanceId
 * const unit = findUnit(state, 'player_knight_0');
 */

import { BattleState } from '../types/battle-state';
import { BattleUnit } from '../types/battle-unit';


// =============================================================================
// FIND UNIT
// =============================================================================

/**
 * Find a unit by its instance ID in the battle state.
 *
 * @param state - Current battle state
 * @param instanceId - Unique instance identifier of the unit
 * @returns The unit if found, undefined otherwise
 *
 * @example
 * const unit = findUnit(state, 'player_knight_0');
 * if (unit) {
 *   console.log(`Found ${unit.name} with ${unit.currentHp} HP`);
 * }
 */
export function findUnit(
  state: BattleState,
  instanceId: string,
): BattleUnit | undefined {
  return state.units.find((u) => u.instanceId === instanceId);
}

/**
 * Find a unit by its instance ID, throwing an error if not found.
 * Use this when you expect the unit to exist (e.g., processing events).
 *
 * @param state - Current battle state
 * @param instanceId - Unique instance identifier of the unit
 * @returns The unit
 * @throws Error if unit is not found
 *
 * @example
 * try {
 *   const unit = findUnitOrThrow(state, 'player_knight_0');
 *   // Safe to use unit here
 * } catch (error) {
 *   console.error('Unit not found:', error.message);
 * }
 */
export function findUnitOrThrow(
  state: BattleState,
  instanceId: string,
): BattleUnit {
  const unit = findUnit(state, instanceId);
  if (!unit) {
    throw new Error(`Unit not found: ${instanceId}`);
  }
  return unit;
}

// =============================================================================
// UPDATE UNIT
// =============================================================================

/**
 * Partial update type for BattleUnit.
 * Allows updating any subset of unit properties.
 */
export type UnitUpdate = Partial<Omit<BattleUnit, 'instanceId' | 'id'>>;

/**
 * Update a single unit in the battle state immutably.
 *
 * Creates a new state object with the specified unit updated.
 * The original state and unit objects are not modified.
 * All mechanic-specific properties are preserved unless explicitly updated.
 *
 * @param state - Current battle state (immutable)
 * @param instanceId - Instance ID of the unit to update
 * @param updates - Partial unit properties to update
 * @returns New battle state with the unit updated
 *
 * @invariant Original state is not mutated
 * @invariant All unit properties not in updates are preserved
 * @invariant Returns original state if unit not found
 *
 * @example
 * // Update unit HP after taking damage
 * const newState = updateUnit(state, 'player_knight_0', {
 *   currentHp: 50,
 *   armorShred: 5,
 * });
 *
 * // Mark unit as dead
 * const newState2 = updateUnit(state, 'enemy_rogue_0', {
 *   currentHp: 0,
 *   alive: false,
 * });
 *
 * // Update facing direction
 * const newState3 = updateUnit(state, 'player_archer_0', {
 *   facing: 'S',
 * });
 */
export function updateUnit(
  state: BattleState,
  instanceId: string,
  updates: UnitUpdate,
): BattleState {
  const unitIndex = state.units.findIndex((u) => u.instanceId === instanceId);

  // Return original state if unit not found
  if (unitIndex === -1) {
    return state;
  }

  const existingUnit = state.units[unitIndex];
  if (!existingUnit) {
    return state;
  }

  // Create updated unit with spread operator (immutable)
  const updatedUnit: BattleUnit = {
    ...existingUnit,
    ...updates,
  };

  // Create new units array with updated unit
  const newUnits = [
    ...state.units.slice(0, unitIndex),
    updatedUnit,
    ...state.units.slice(unitIndex + 1),
  ];

  // Return new state with updated units array
  return {
    ...state,
    units: newUnits,
  };
}


// =============================================================================
// BATCH UPDATE UNITS
// =============================================================================

/**
 * Batch update specification for multiple units.
 */
export interface BatchUnitUpdate {
  /** Instance ID of the unit to update */
  instanceId: string;
  /** Partial unit properties to update */
  updates: UnitUpdate;
}

/**
 * Update multiple units in the battle state immutably.
 *
 * More efficient than calling updateUnit() multiple times as it
 * creates only one new state object. Units not found are skipped.
 *
 * @param state - Current battle state (immutable)
 * @param updates - Array of unit updates to apply
 * @returns New battle state with all units updated
 *
 * @invariant Original state is not mutated
 * @invariant All unit properties not in updates are preserved
 * @invariant Units not found in updates array are unchanged
 *
 * @example
 * // Apply damage to multiple units
 * const newState = updateUnits(state, [
 *   { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
 *   { instanceId: 'enemy_rogue_0', updates: { currentHp: 30, armorShred: 3 } },
 * ]);
 *
 * // Mark multiple units as dead
 * const newState2 = updateUnits(state, [
 *   { instanceId: 'enemy_mage_0', updates: { currentHp: 0, alive: false } },
 *   { instanceId: 'enemy_archer_0', updates: { currentHp: 0, alive: false } },
 * ]);
 */
export function updateUnits(
  state: BattleState,
  updates: BatchUnitUpdate[],
): BattleState {
  // Return original state if no updates
  if (updates.length === 0) {
    return state;
  }

  // Create a map of instanceId -> updates for O(1) lookup
  const updateMap = new Map<string, UnitUpdate>();
  for (const update of updates) {
    updateMap.set(update.instanceId, update.updates);
  }

  // Create new units array with all updates applied
  const newUnits = state.units.map((unit) => {
    const unitUpdates = updateMap.get(unit.instanceId);
    if (unitUpdates) {
      return {
        ...unit,
        ...unitUpdates,
      };
    }
    return unit;
  });

  // Return new state with updated units array
  return {
    ...state,
    units: newUnits,
  };
}


// =============================================================================
// ADDITIONAL HELPERS
// =============================================================================

/**
 * Update the occupied positions set based on current alive units.
 * Call this after units move or die to keep the set in sync.
 *
 * @param state - Current battle state
 * @returns New battle state with updated occupiedPositions
 *
 * @example
 * // After moving a unit, update occupied positions
 * let newState = updateUnit(state, 'player_knight_0', {
 *   position: { x: 4, y: 2 },
 * });
 * newState = updateOccupiedPositions(newState);
 */
export function updateOccupiedPositions(state: BattleState): BattleState {
  const newOccupied = new Set<string>();
  for (const unit of state.units) {
    if (unit.alive) {
      newOccupied.add(`${unit.position.x},${unit.position.y}`);
    }
  }
  return {
    ...state,
    occupiedPositions: newOccupied,
  };
}

/**
 * Remove a dead unit from the turn queue.
 * Call this after a unit dies to prevent them from acting.
 *
 * @param state - Current battle state
 * @param instanceId - Instance ID of the dead unit
 * @returns New battle state with updated turnQueue
 *
 * @invariant Dead unit is removed from queue
 * @invariant Order of remaining units preserved
 * @invariant currentTurnIndex adjusted if needed
 *
 * @example
 * // After killing a unit
 * let newState = updateUnit(state, 'enemy_rogue_0', {
 *   currentHp: 0,
 *   alive: false,
 * });
 * newState = removeFromTurnQueue(newState, 'enemy_rogue_0');
 */
export function removeFromTurnQueue(
  state: BattleState,
  instanceId: string,
): BattleState {
  const queueIndex = state.turnQueue.indexOf(instanceId);

  // Unit not in queue, return unchanged
  if (queueIndex === -1) {
    return state;
  }

  // Create new queue without the dead unit
  const newQueue = [
    ...state.turnQueue.slice(0, queueIndex),
    ...state.turnQueue.slice(queueIndex + 1),
  ];

  // Adjust currentTurnIndex if needed
  let newIndex = state.currentTurnIndex;
  if (queueIndex < state.currentTurnIndex) {
    // Dead unit was before current, shift index back
    newIndex = Math.max(0, newIndex - 1);
  } else if (queueIndex === state.currentTurnIndex) {
    // Dead unit was current, keep index but it now points to next unit
    // Ensure index doesn't exceed queue length
    newIndex = Math.min(newIndex, newQueue.length - 1);
  }

  return {
    ...state,
    turnQueue: newQueue,
    currentTurnIndex: Math.max(0, newIndex),
  };
}

/**
 * Get all alive units from the battle state.
 *
 * @param state - Current battle state
 * @returns Array of alive units
 *
 * @example
 * const aliveUnits = getAliveUnits(state);
 * console.log(`${aliveUnits.length} units still fighting`);
 */
export function getAliveUnits(state: BattleState): readonly BattleUnit[] {
  return state.units.filter((u) => u.alive);
}

/**
 * Get all alive units for a specific team.
 *
 * @param state - Current battle state
 * @param team - Team to filter by ('player' or 'enemy')
 * @returns Array of alive units on the specified team
 *
 * @example
 * const playerUnits = getTeamUnits(state, 'player');
 * const enemyUnits = getTeamUnits(state, 'enemy');
 */
export function getTeamUnits(
  state: BattleState,
  team: 'player' | 'enemy',
): readonly BattleUnit[] {
  return state.units.filter((u) => u.alive && u.team === team);
}

/**
 * Check if a position is occupied by an alive unit.
 *
 * @param state - Current battle state
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns True if position is occupied
 *
 * @example
 * if (!isPositionOccupied(state, 4, 2)) {
 *   // Safe to move unit here
 * }
 */
export function isPositionOccupied(
  state: BattleState,
  x: number,
  y: number,
): boolean {
  return state.occupiedPositions.has(`${x},${y}`);
}

/**
 * Get the unit at a specific position, if any.
 *
 * @param state - Current battle state
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns The unit at the position, or undefined if empty
 *
 * @example
 * const unitAtPosition = getUnitAtPositionFromState(state, 4, 2);
 * if (unitAtPosition) {
 *   console.log(`${unitAtPosition.name} is at (4, 2)`);
 * }
 */
export function getUnitAtPositionFromState(
  state: BattleState,
  x: number,
  y: number,
): BattleUnit | undefined {
  return state.units.find(
    (u) => u.alive && u.position.x === x && u.position.y === y,
  );
}
