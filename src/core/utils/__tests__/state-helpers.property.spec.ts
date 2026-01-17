/**
 * Property-Based Tests for State Helpers
 *
 * Tests correctness properties for immutable state updates:
 * - Property 7: Immutable State Updates - original state is never mutated
 *
 * **Feature: simulator-refactor, Property 7: Immutable State Updates**
 * **Validates: Requirements 3.1**
 *
 * @module core/utils/__tests__/state-helpers.property.spec
 */

import * as fc from 'fast-check';
import {
  updateUnit,
  updateUnits,
  updateOccupiedPositions,
  removeFromTurnQueue,
  UnitUpdate,
  BatchUnitUpdate,
} from '../state-helpers';
import { BattleState } from '../../types/battle-state';
import { BattleUnit, FacingDirection, TeamType, UnitFaction } from '../../types/battle-unit';
import { Position } from '../../types/grid.types';

// =============================================================================
// ARBITRARIES (GENERATORS)
// =============================================================================

/**
 * Arbitrary generator for valid facing directions.
 */
const arbitraryFacingDirection: fc.Arbitrary<FacingDirection> = fc.constantFrom('N', 'S', 'E', 'W');

/**
 * Arbitrary generator for valid positions on the grid.
 * Grid is 8x10 (x: 0-7, y: 0-9).
 */
const arbitraryPosition: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: 7 }),
  y: fc.integer({ min: 0, max: 9 }),
});

/**
 * Arbitrary generator for team type.
 */
const arbitraryTeamType: fc.Arbitrary<TeamType> = fc.constantFrom('player', 'enemy');

/**
 * Arbitrary generator for unit faction.
 */
const arbitraryFaction: fc.Arbitrary<UnitFaction> = fc.constantFrom('human', 'undead');

/**
 * Arbitrary generator for valid BattleUnit.
 */
const arbitraryBattleUnit: fc.Arbitrary<BattleUnit> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    instanceId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    team: arbitraryTeamType,
    hp: fc.integer({ min: 1, max: 200 }),
    atk: fc.integer({ min: 1, max: 50 }),
    atkCount: fc.integer({ min: 1, max: 5 }),
    armor: fc.integer({ min: 0, max: 50 }),
    speed: fc.integer({ min: 1, max: 6 }),
    initiative: fc.integer({ min: 1, max: 30 }),
    dodge: fc.integer({ min: 0, max: 50 }),
    range: fc.integer({ min: 1, max: 5 }),
    role: fc.constantFrom('tank', 'melee_dps', 'ranged_dps', 'mage', 'support', 'control'),
    cost: fc.integer({ min: 3, max: 8 }),
    abilities: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 0,
      maxLength: 3,
    }),
    position: arbitraryPosition,
    facing: arbitraryFacingDirection,
    maxResolve: fc.integer({ min: 50, max: 100 }),
    isRouting: fc.boolean(),
    engaged: fc.boolean(),
    engagedBy: fc.array(fc.uuid(), { minLength: 0, maxLength: 4 }),
    riposteCharges: fc.integer({ min: 0, max: 3 }),
    momentum: fc.integer({ min: 0, max: 5 }),
    armorShred: fc.integer({ min: 0, max: 30 }),
    inPhalanx: fc.boolean(),
    tags: fc.array(
      fc.constantFrom(
        'infantry',
        'cavalry',
        'spearman',
        'ranged',
        'mage',
        'heavy',
        'light',
        'undead',
      ),
      { minLength: 0, maxLength: 3 },
    ),
    faction: arbitraryFaction,
    hasAmmo: fc.boolean(),
    maxAmmoValue: fc.integer({ min: 3, max: 20 }),
  })
  .chain((base) => {
    const maxHp = base.hp;

    return fc
      .record({
        currentHp: fc.integer({ min: 0, max: maxHp }),
        resolve: fc.integer({ min: 0, max: base.maxResolve }),
        ammoValue: fc.integer({ min: 0, max: base.maxAmmoValue }),
      })
      .map((derived) => {
        const unit: BattleUnit = {
          id: base.id,
          instanceId: base.instanceId,
          name: base.name,
          team: base.team,
          stats: {
            hp: base.hp,
            atk: base.atk,
            atkCount: base.atkCount,
            armor: base.armor,
            speed: base.speed,
            initiative: base.initiative,
            dodge: base.dodge,
          },
          range: base.range,
          role: base.role,
          cost: base.cost,
          abilities: base.abilities,
          position: base.position,
          currentHp: derived.currentHp,
          maxHp: maxHp,
          alive: derived.currentHp > 0,
          facing: base.facing,
          resolve: derived.resolve,
          maxResolve: base.maxResolve,
          isRouting: base.isRouting,
          engaged: base.engaged,
          engagedBy: base.engagedBy,
          riposteCharges: base.riposteCharges,
          ammo: base.hasAmmo ? derived.ammoValue : null,
          maxAmmo: base.hasAmmo ? base.maxAmmoValue : null,
          momentum: base.momentum,
          armorShred: base.armorShred,
          inPhalanx: base.inPhalanx,
          tags: base.tags,
          faction: base.faction,
        };
        return unit;
      });
  });

/**
 * Arbitrary generator for valid BattleState with 2-6 units.
 */
const arbitraryBattleState: fc.Arbitrary<BattleState> = fc
  .array(arbitraryBattleUnit, { minLength: 2, maxLength: 6 })
  .chain((units) => {
    // Ensure unique instanceIds
    const uniqueUnits = units.map((unit, index) => ({
      ...unit,
      instanceId: `unit_${index}`,
    }));

    // Build occupied positions from alive units
    const occupiedPositions = new Set<string>();
    for (const unit of uniqueUnits) {
      if (unit.alive) {
        occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
      }
    }

    // Build turn queue from alive units
    const turnQueue = uniqueUnits.filter((u) => u.alive).map((u) => u.instanceId);

    return fc
      .record({
        battleId: fc.uuid(),
        round: fc.integer({ min: 1, max: 100 }),
        turn: fc.integer({ min: 1, max: 20 }),
        seed: fc.integer(),
        currentTurnIndex: fc.integer({ min: 0, max: Math.max(0, turnQueue.length - 1) }),
      })
      .map((base) => {
        const state: BattleState = {
          battleId: base.battleId,
          units: uniqueUnits,
          round: base.round,
          turn: base.turn,
          currentPhase: 'turn_start',
          events: [],
          occupiedPositions,
          seed: base.seed,
          turnQueue,
          currentTurnIndex: turnQueue.length > 0 ? base.currentTurnIndex : 0,
        };
        return state;
      });
  });

/**
 * Arbitrary generator for unit updates.
 */
const arbitraryUnitUpdate: fc.Arbitrary<UnitUpdate> = fc
  .record({
    currentHp: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
    alive: fc.option(fc.boolean(), { nil: undefined }),
    facing: fc.option(arbitraryFacingDirection, { nil: undefined }),
    resolve: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    armorShred: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }),
    momentum: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
    position: fc.option(arbitraryPosition, { nil: undefined }),
  })
  .map((update) => {
    // Filter out undefined values
    const filtered: UnitUpdate = {};
    if (update.currentHp !== undefined) filtered.currentHp = update.currentHp;
    if (update.alive !== undefined) filtered.alive = update.alive;
    if (update.facing !== undefined) filtered.facing = update.facing;
    if (update.resolve !== undefined) filtered.resolve = update.resolve;
    if (update.armorShred !== undefined) filtered.armorShred = update.armorShred;
    if (update.momentum !== undefined) filtered.momentum = update.momentum;
    if (update.position !== undefined) filtered.position = update.position;
    return filtered;
  });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Deep clone a BattleState for comparison.
 * Used to capture original state before mutation tests.
 */
function deepCloneState(state: BattleState): BattleState {
  return {
    ...state,
    units: state.units.map((unit) => ({
      ...unit,
      stats: { ...unit.stats },
      position: { ...unit.position },
      engagedBy: [...unit.engagedBy],
      abilities: [...unit.abilities],
      tags: [...unit.tags],
    })),
    events: [...state.events],
    occupiedPositions: new Set(state.occupiedPositions),
    turnQueue: [...state.turnQueue],
  };
}

/**
 * Compare two BattleStates for equality (deep comparison).
 */
function statesAreEqual(a: BattleState, b: BattleState): boolean {
  if (a.battleId !== b.battleId) return false;
  if (a.round !== b.round) return false;
  if (a.turn !== b.turn) return false;
  if (a.seed !== b.seed) return false;
  if (a.currentTurnIndex !== b.currentTurnIndex) return false;
  if (a.units.length !== b.units.length) return false;

  for (let i = 0; i < a.units.length; i++) {
    const unitA = a.units[i];
    const unitB = b.units[i];
    if (!unitA || !unitB) return false;
    if (unitA.instanceId !== unitB.instanceId) return false;
    if (unitA.currentHp !== unitB.currentHp) return false;
    if (unitA.alive !== unitB.alive) return false;
    if (unitA.facing !== unitB.facing) return false;
    if (unitA.resolve !== unitB.resolve) return false;
    if (unitA.armorShred !== unitB.armorShred) return false;
    if (unitA.momentum !== unitB.momentum) return false;
    if (unitA.position.x !== unitB.position.x) return false;
    if (unitA.position.y !== unitB.position.y) return false;
  }

  return true;
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('State Helpers Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 7: Immutable State Updates**
   * **Validates: Requirements 3.1**
   *
   * For any state update operation, the original state object SHALL NOT be mutated;
   * a new state object SHALL be returned.
   */
  describe('Property 7: Immutable State Updates', () => {
    it('updateUnit does not mutate original state', () => {
      fc.assert(
        fc.property(
          arbitraryBattleState,
          arbitraryUnitUpdate,
          (state: BattleState, update: UnitUpdate): boolean => {
            // Skip if no units
            if (state.units.length === 0) return true;

            // Clone original state for comparison
            const originalState = deepCloneState(state);

            // Get a valid instanceId from the state
            const targetInstanceId = state.units[0]?.instanceId;
            if (!targetInstanceId) return true;

            // Perform the update
            const newState = updateUnit(state, targetInstanceId, update);

            // Property 7: Original state must not be mutated
            const originalUnchanged = statesAreEqual(state, originalState);

            expect(originalUnchanged).toBe(true);
            expect(state).not.toBe(newState); // Different object references
            expect(state.units).not.toBe(newState.units); // Different arrays

            return originalUnchanged;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('updateUnits does not mutate original state', () => {
      fc.assert(
        fc.property(
          arbitraryBattleState,
          fc.array(arbitraryUnitUpdate, { minLength: 1, maxLength: 3 }),
          (state: BattleState, updates: UnitUpdate[]): boolean => {
            // Skip if no units
            if (state.units.length === 0) return true;

            // Clone original state for comparison
            const originalState = deepCloneState(state);

            // Create batch updates for existing units
            const batchUpdates: BatchUnitUpdate[] = updates
              .slice(0, state.units.length)
              .map((update, index) => ({
                instanceId: state.units[index]?.instanceId ?? '',
                updates: update,
              }))
              .filter((bu) => bu.instanceId !== '');

            if (batchUpdates.length === 0) return true;

            // Perform the batch update
            const newState = updateUnits(state, batchUpdates);

            // Property 7: Original state must not be mutated
            const originalUnchanged = statesAreEqual(state, originalState);

            expect(originalUnchanged).toBe(true);
            expect(state).not.toBe(newState);
            expect(state.units).not.toBe(newState.units);

            return originalUnchanged;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('updateOccupiedPositions does not mutate original state', () => {
      fc.assert(
        fc.property(arbitraryBattleState, (state: BattleState): boolean => {
          // Clone original state for comparison
          const originalState = deepCloneState(state);

          // Perform the update
          const newState = updateOccupiedPositions(state);

          // Property 7: Original state must not be mutated
          const originalUnchanged = statesAreEqual(state, originalState);

          expect(originalUnchanged).toBe(true);
          expect(state).not.toBe(newState);
          expect(state.occupiedPositions).not.toBe(newState.occupiedPositions);

          return originalUnchanged;
        }),
        { numRuns: 100 },
      );
    });

    it('removeFromTurnQueue does not mutate original state', () => {
      fc.assert(
        fc.property(arbitraryBattleState, (state: BattleState): boolean => {
          // Skip if no units in turn queue
          if (state.turnQueue.length === 0) return true;

          // Clone original state for comparison
          const originalState = deepCloneState(state);

          // Get a valid instanceId from the turn queue
          const targetInstanceId = state.turnQueue[0];
          if (!targetInstanceId) return true;

          // Perform the removal
          const newState = removeFromTurnQueue(state, targetInstanceId);

          // Property 7: Original state must not be mutated
          const originalUnchanged = statesAreEqual(state, originalState);

          expect(originalUnchanged).toBe(true);
          expect(state).not.toBe(newState);
          expect(state.turnQueue).not.toBe(newState.turnQueue);

          return originalUnchanged;
        }),
        { numRuns: 100 },
      );
    });

    it('chained updates do not mutate any intermediate states', () => {
      fc.assert(
        fc.property(
          arbitraryBattleState,
          arbitraryUnitUpdate,
          arbitraryUnitUpdate,
          (state: BattleState, update1: UnitUpdate, update2: UnitUpdate): boolean => {
            // Skip if fewer than 2 units
            if (state.units.length < 2) return true;

            // Clone original state
            const originalState = deepCloneState(state);

            // Get valid instanceIds
            const instanceId1 = state.units[0]?.instanceId;
            const instanceId2 = state.units[1]?.instanceId;
            if (!instanceId1 || !instanceId2) return true;

            // Perform chained updates
            const state1 = updateUnit(state, instanceId1, update1);
            const state1Clone = deepCloneState(state1);

            const state2 = updateUnit(state1, instanceId2, update2);

            // Property 7: All intermediate states must not be mutated
            const originalUnchanged = statesAreEqual(state, originalState);
            const state1Unchanged = statesAreEqual(state1, state1Clone);

            expect(originalUnchanged).toBe(true);
            expect(state1Unchanged).toBe(true);
            expect(state).not.toBe(state1);
            expect(state1).not.toBe(state2);

            return originalUnchanged && state1Unchanged;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('unit objects within state are not mutated', () => {
      fc.assert(
        fc.property(
          arbitraryBattleState,
          arbitraryUnitUpdate,
          (state: BattleState, update: UnitUpdate): boolean => {
            // Skip if no units
            if (state.units.length === 0) return true;

            // Get reference to original unit
            const originalUnit = state.units[0];
            if (!originalUnit) return true;

            // Clone original unit values
            const originalHp = originalUnit.currentHp;
            const originalFacing = originalUnit.facing;
            const originalResolve = originalUnit.resolve;
            const originalAlive = originalUnit.alive;

            // Perform the update
            updateUnit(state, originalUnit.instanceId, update);

            // Property 7: Original unit object must not be mutated
            const unitUnchanged =
              originalUnit.currentHp === originalHp &&
              originalUnit.facing === originalFacing &&
              originalUnit.resolve === originalResolve &&
              originalUnit.alive === originalAlive;

            expect(unitUnchanged).toBe(true);
            expect(originalUnit.currentHp).toBe(originalHp);
            expect(originalUnit.facing).toBe(originalFacing);
            expect(originalUnit.resolve).toBe(originalResolve);
            expect(originalUnit.alive).toBe(originalAlive);

            return unitUnchanged;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('new state contains updated values while original is unchanged', () => {
      fc.assert(
        fc.property(
          arbitraryBattleState,
          fc.integer({ min: 0, max: 100 }),
          (state: BattleState, newHp: number): boolean => {
            // Skip if no units
            if (state.units.length === 0) return true;

            const targetUnit = state.units[0];
            if (!targetUnit) return true;

            const originalHp = targetUnit.currentHp;

            // Perform the update
            const newState = updateUnit(state, targetUnit.instanceId, {
              currentHp: newHp,
            });

            // Find updated unit in new state
            const updatedUnit = newState.units.find((u) => u.instanceId === targetUnit.instanceId);

            // Property 7: Original unchanged, new state has update
            const originalUnchanged = targetUnit.currentHp === originalHp;
            const newStateHasUpdate = updatedUnit?.currentHp === newHp;

            expect(originalUnchanged).toBe(true);
            expect(newStateHasUpdate).toBe(true);

            return originalUnchanged && newStateHasUpdate;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
