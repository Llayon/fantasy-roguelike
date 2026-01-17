/**
 * Unit Tests for State Helpers
 *
 * Tests the immutable state update functions:
 * - findUnit / findUnitOrThrow
 * - updateUnit
 * - updateUnits
 * - updateOccupiedPositions
 * - removeFromTurnQueue
 * - getAliveUnits / getTeamUnits
 * - isPositionOccupied / getUnitAtPositionFromState
 *
 * @module core/utils/__tests__/state-helpers.spec
 */

import {
  findUnit,
  findUnitOrThrow,
  updateUnit,
  updateUnits,
  updateOccupiedPositions,
  removeFromTurnQueue,
  getAliveUnits,
  getTeamUnits,
  isPositionOccupied,
  getUnitAtPositionFromState,
} from '../state-helpers';
import { BattleState } from '../../types/battle-state';
import { BattleUnit } from '../../types/battle-unit';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a minimal valid BattleUnit for testing.
 */
function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'knight',
    instanceId: 'player_knight_0',
    name: 'Knight',
    team: 'player',
    stats: {
      hp: 100,
      atk: 15,
      atkCount: 1,
      armor: 20,
      speed: 2,
      initiative: 10,
      dodge: 5,
    },
    range: 1,
    role: 'tank',
    cost: 5,
    abilities: ['shield_wall'],
    position: { x: 3, y: 1 },
    currentHp: 100,
    maxHp: 100,
    alive: true,
    facing: 'S',
    resolve: 100,
    maxResolve: 100,
    isRouting: false,
    engaged: false,
    engagedBy: [],
    riposteCharges: 1,
    ammo: null,
    maxAmmo: null,
    momentum: 0,
    armorShred: 0,
    inPhalanx: false,
    tags: ['infantry', 'tank'],
    faction: 'human',
    ...overrides,
  };
}

/**
 * Create a minimal valid BattleState for testing.
 */
function createTestState(overrides: Partial<BattleState> = {}): BattleState {
  const playerKnight = createTestUnit({
    instanceId: 'player_knight_0',
    position: { x: 3, y: 1 },
  });
  const playerArcher = createTestUnit({
    id: 'archer',
    instanceId: 'player_archer_0',
    name: 'Archer',
    team: 'player',
    role: 'ranged_dps',
    range: 4,
    position: { x: 5, y: 0 },
    ammo: 12,
    maxAmmo: 12,
  });
  const enemyRogue = createTestUnit({
    id: 'rogue',
    instanceId: 'enemy_rogue_0',
    name: 'Rogue',
    team: 'enemy',
    role: 'melee_dps',
    position: { x: 4, y: 8 },
  });

  return {
    battleId: 'test_battle_001',
    units: [playerKnight, playerArcher, enemyRogue],
    round: 1,
    turn: 1,
    currentPhase: 'turn_start',
    events: [],
    occupiedPositions: new Set(['3,1', '5,0', '4,8']),
    seed: 12345,
    turnQueue: ['player_knight_0', 'enemy_rogue_0', 'player_archer_0'],
    currentTurnIndex: 0,
    ...overrides,
  };
}


// =============================================================================
// FIND UNIT TESTS
// =============================================================================

describe('findUnit', () => {
  it('returns the unit when found', () => {
    const state = createTestState();
    const unit = findUnit(state, 'player_knight_0');

    expect(unit).toBeDefined();
    expect(unit?.instanceId).toBe('player_knight_0');
    expect(unit?.name).toBe('Knight');
  });

  it('returns undefined when unit not found', () => {
    const state = createTestState();
    const unit = findUnit(state, 'nonexistent_unit');

    expect(unit).toBeUndefined();
  });

  it('finds units from different teams', () => {
    const state = createTestState();

    const playerUnit = findUnit(state, 'player_knight_0');
    const enemyUnit = findUnit(state, 'enemy_rogue_0');

    expect(playerUnit?.team).toBe('player');
    expect(enemyUnit?.team).toBe('enemy');
  });
});

describe('findUnitOrThrow', () => {
  it('returns the unit when found', () => {
    const state = createTestState();
    const unit = findUnitOrThrow(state, 'player_knight_0');

    expect(unit.instanceId).toBe('player_knight_0');
  });

  it('throws error when unit not found', () => {
    const state = createTestState();

    expect(() => findUnitOrThrow(state, 'nonexistent_unit')).toThrow(
      'Unit not found: nonexistent_unit',
    );
  });
});

// =============================================================================
// UPDATE UNIT TESTS
// =============================================================================

describe('updateUnit', () => {
  it('updates a single property immutably', () => {
    const state = createTestState();
    const originalUnit = findUnit(state, 'player_knight_0');

    const newState = updateUnit(state, 'player_knight_0', { currentHp: 50 });
    const updatedUnit = findUnit(newState, 'player_knight_0');

    // New state has updated HP
    expect(updatedUnit?.currentHp).toBe(50);

    // Original state is unchanged
    expect(originalUnit?.currentHp).toBe(100);
    expect(findUnit(state, 'player_knight_0')?.currentHp).toBe(100);

    // State objects are different
    expect(newState).not.toBe(state);
    expect(newState.units).not.toBe(state.units);
  });

  it('preserves all other properties when updating', () => {
    const state = createTestState();
    const newState = updateUnit(state, 'player_knight_0', { currentHp: 50 });
    const updatedUnit = findUnit(newState, 'player_knight_0');

    // All mechanic properties preserved
    expect(updatedUnit?.facing).toBe('S');
    expect(updatedUnit?.resolve).toBe(100);
    expect(updatedUnit?.riposteCharges).toBe(1);
    expect(updatedUnit?.momentum).toBe(0);
    expect(updatedUnit?.armorShred).toBe(0);
    expect(updatedUnit?.position).toEqual({ x: 3, y: 1 });
  });

  it('updates multiple properties at once', () => {
    const state = createTestState();
    const newState = updateUnit(state, 'player_knight_0', {
      currentHp: 0,
      alive: false,
      armorShred: 10,
    });
    const updatedUnit = findUnit(newState, 'player_knight_0');

    expect(updatedUnit?.currentHp).toBe(0);
    expect(updatedUnit?.alive).toBe(false);
    expect(updatedUnit?.armorShred).toBe(10);
  });

  it('returns original state if unit not found', () => {
    const state = createTestState();
    const newState = updateUnit(state, 'nonexistent_unit', { currentHp: 50 });

    expect(newState).toBe(state);
  });

  it('does not affect other units', () => {
    const state = createTestState();
    const newState = updateUnit(state, 'player_knight_0', { currentHp: 50 });

    const archer = findUnit(newState, 'player_archer_0');
    const rogue = findUnit(newState, 'enemy_rogue_0');

    expect(archer?.currentHp).toBe(100);
    expect(rogue?.currentHp).toBe(100);
  });
});


// =============================================================================
// UPDATE UNITS (BATCH) TESTS
// =============================================================================

describe('updateUnits', () => {
  it('updates multiple units in a single operation', () => {
    const state = createTestState();
    const newState = updateUnits(state, [
      { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
      { instanceId: 'enemy_rogue_0', updates: { currentHp: 30 } },
    ]);

    expect(findUnit(newState, 'player_knight_0')?.currentHp).toBe(50);
    expect(findUnit(newState, 'enemy_rogue_0')?.currentHp).toBe(30);
  });

  it('preserves original state immutably', () => {
    const state = createTestState();
    const newState = updateUnits(state, [
      { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
    ]);

    expect(findUnit(state, 'player_knight_0')?.currentHp).toBe(100);
    expect(newState).not.toBe(state);
  });

  it('returns original state for empty updates array', () => {
    const state = createTestState();
    const newState = updateUnits(state, []);

    expect(newState).toBe(state);
  });

  it('skips units that are not found', () => {
    const state = createTestState();
    const newState = updateUnits(state, [
      { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
      { instanceId: 'nonexistent_unit', updates: { currentHp: 0 } },
    ]);

    expect(findUnit(newState, 'player_knight_0')?.currentHp).toBe(50);
    expect(newState.units.length).toBe(3);
  });

  it('preserves mechanic properties for all updated units', () => {
    const state = createTestState();
    const newState = updateUnits(state, [
      { instanceId: 'player_knight_0', updates: { currentHp: 50 } },
      { instanceId: 'player_archer_0', updates: { ammo: 6 } },
    ]);

    const knight = findUnit(newState, 'player_knight_0');
    const archer = findUnit(newState, 'player_archer_0');

    expect(knight?.facing).toBe('S');
    expect(knight?.resolve).toBe(100);
    expect(archer?.ammo).toBe(6);
    expect(archer?.maxAmmo).toBe(12);
  });
});

// =============================================================================
// OCCUPIED POSITIONS TESTS
// =============================================================================

describe('updateOccupiedPositions', () => {
  it('rebuilds occupied positions from alive units', () => {
    const state = createTestState();
    const newState = updateOccupiedPositions(state);

    expect(newState.occupiedPositions.has('3,1')).toBe(true);
    expect(newState.occupiedPositions.has('5,0')).toBe(true);
    expect(newState.occupiedPositions.has('4,8')).toBe(true);
  });

  it('excludes dead units from occupied positions', () => {
    let state = createTestState();
    state = updateUnit(state, 'enemy_rogue_0', { alive: false, currentHp: 0 });
    const newState = updateOccupiedPositions(state);

    expect(newState.occupiedPositions.has('3,1')).toBe(true);
    expect(newState.occupiedPositions.has('5,0')).toBe(true);
    expect(newState.occupiedPositions.has('4,8')).toBe(false);
  });

  it('updates positions after unit movement', () => {
    let state = createTestState();
    state = updateUnit(state, 'player_knight_0', { position: { x: 4, y: 2 } });
    const newState = updateOccupiedPositions(state);

    expect(newState.occupiedPositions.has('3,1')).toBe(false);
    expect(newState.occupiedPositions.has('4,2')).toBe(true);
  });
});

// =============================================================================
// TURN QUEUE TESTS
// =============================================================================

describe('removeFromTurnQueue', () => {
  it('removes unit from turn queue', () => {
    const state = createTestState();
    const newState = removeFromTurnQueue(state, 'enemy_rogue_0');

    expect(newState.turnQueue).not.toContain('enemy_rogue_0');
    expect(newState.turnQueue.length).toBe(2);
  });

  it('preserves order of remaining units', () => {
    const state = createTestState();
    const newState = removeFromTurnQueue(state, 'enemy_rogue_0');

    expect(newState.turnQueue[0]).toBe('player_knight_0');
    expect(newState.turnQueue[1]).toBe('player_archer_0');
  });

  it('adjusts currentTurnIndex when removing unit before current', () => {
    const state = createTestState({
      currentTurnIndex: 2, // pointing to player_archer_0
    });
    const newState = removeFromTurnQueue(state, 'player_knight_0');

    // Index should shift back by 1
    expect(newState.currentTurnIndex).toBe(1);
  });

  it('keeps currentTurnIndex when removing unit after current', () => {
    const state = createTestState({
      currentTurnIndex: 0, // pointing to player_knight_0
    });
    const newState = removeFromTurnQueue(state, 'player_archer_0');

    expect(newState.currentTurnIndex).toBe(0);
  });

  it('returns original state if unit not in queue', () => {
    const state = createTestState();
    const newState = removeFromTurnQueue(state, 'nonexistent_unit');

    expect(newState).toBe(state);
  });
});


// =============================================================================
// ALIVE UNITS TESTS
// =============================================================================

describe('getAliveUnits', () => {
  it('returns all alive units', () => {
    const state = createTestState();
    const aliveUnits = getAliveUnits(state);

    expect(aliveUnits.length).toBe(3);
  });

  it('excludes dead units', () => {
    let state = createTestState();
    state = updateUnit(state, 'enemy_rogue_0', { alive: false, currentHp: 0 });
    const aliveUnits = getAliveUnits(state);

    expect(aliveUnits.length).toBe(2);
    expect(aliveUnits.find((u) => u.instanceId === 'enemy_rogue_0')).toBeUndefined();
  });
});

describe('getTeamUnits', () => {
  it('returns alive units for player team', () => {
    const state = createTestState();
    const playerUnits = getTeamUnits(state, 'player');

    expect(playerUnits.length).toBe(2);
    expect(playerUnits.every((u) => u.team === 'player')).toBe(true);
  });

  it('returns alive units for enemy team', () => {
    const state = createTestState();
    const enemyUnits = getTeamUnits(state, 'enemy');

    expect(enemyUnits.length).toBe(1);
    expect(enemyUnits.every((u) => u.team === 'enemy')).toBe(true);
  });

  it('excludes dead units from team', () => {
    let state = createTestState();
    state = updateUnit(state, 'player_knight_0', { alive: false, currentHp: 0 });
    const playerUnits = getTeamUnits(state, 'player');

    expect(playerUnits.length).toBe(1);
    expect(playerUnits[0]?.instanceId).toBe('player_archer_0');
  });
});

// =============================================================================
// POSITION HELPERS TESTS
// =============================================================================

describe('isPositionOccupied', () => {
  it('returns true for occupied positions', () => {
    const state = createTestState();

    expect(isPositionOccupied(state, 3, 1)).toBe(true);
    expect(isPositionOccupied(state, 5, 0)).toBe(true);
    expect(isPositionOccupied(state, 4, 8)).toBe(true);
  });

  it('returns false for empty positions', () => {
    const state = createTestState();

    expect(isPositionOccupied(state, 0, 0)).toBe(false);
    expect(isPositionOccupied(state, 7, 9)).toBe(false);
  });
});

describe('getUnitAtPositionFromState', () => {
  it('returns unit at occupied position', () => {
    const state = createTestState();
    const unit = getUnitAtPositionFromState(state, 3, 1);

    expect(unit).toBeDefined();
    expect(unit?.instanceId).toBe('player_knight_0');
  });

  it('returns undefined for empty position', () => {
    const state = createTestState();
    const unit = getUnitAtPositionFromState(state, 0, 0);

    expect(unit).toBeUndefined();
  });

  it('returns undefined for dead unit position', () => {
    let state = createTestState();
    state = updateUnit(state, 'enemy_rogue_0', { alive: false, currentHp: 0 });
    const unit = getUnitAtPositionFromState(state, 4, 8);

    expect(unit).toBeUndefined();
  });
});
