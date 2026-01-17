/**
 * Unit tests for turn execution module.
 *
 * Tests the executeTurn function and phase handlers.
 *
 * @module simulator/__tests__/turn.spec
 */

import {
  executeTurn,
  handleTurnStart,
  handleTurnEnd,
  handleUnitDeath,
  calculateFacing,
  calculateDamage,
} from '../turn';
import { BattleState } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { SeededRandom } from '../../core/utils/random';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a minimal test unit.
 */
function createTestUnit(
  overrides: Partial<BattleUnit> = {},
): BattleUnit {
  return {
    id: 'test_unit',
    instanceId: 'player_test_0',
    name: 'Test Unit',
    team: 'player',
    stats: {
      hp: 100,
      atk: 10,
      atkCount: 1,
      armor: 5,
      speed: 3,
      initiative: 10,
      dodge: 10,
    },
    range: 1,
    role: 'tank',
    cost: 5,
    abilities: [],
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
    tags: [],
    faction: 'human',
    ...overrides,
  };
}

/**
 * Create a minimal test battle state.
 */
function createTestState(
  units: BattleUnit[] = [],
): BattleState {
  const occupiedPositions = new Set<string>();
  for (const unit of units) {
    if (unit.alive) {
      occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
    }
  }

  return {
    battleId: 'test_battle',
    units,
    round: 1,
    turn: 1,
    currentPhase: 'turn_start',
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: units.filter((u) => u.alive).map((u) => u.instanceId),
    currentTurnIndex: 0,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('executeTurn', () => {
  it('returns empty events for dead unit', () => {
    const deadUnit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([deadUnit]);
    const rng = new SeededRandom(12345);

    const result = executeTurn(state, deadUnit.instanceId, rng);

    expect(result.events).toHaveLength(0);
  });

  it('returns empty events for non-existent unit', () => {
    const state = createTestState([]);
    const rng = new SeededRandom(12345);

    const result = executeTurn(state, 'non_existent', rng);

    expect(result.events).toHaveLength(0);
  });

  it('emits turn_start and turn_end events for valid unit', () => {
    const playerUnit = createTestUnit();
    const enemyUnit = createTestUnit({
      instanceId: 'enemy_test_0',
      team: 'enemy',
      position: { x: 3, y: 9 },
      facing: 'N',
    });
    const state = createTestState([playerUnit, enemyUnit]);
    const rng = new SeededRandom(12345);

    const result = executeTurn(state, playerUnit.instanceId, rng);

    // Should have turn_start and turn_end events
    const turnStartEvents = result.events.filter((e) => e.type === 'turn_start');
    const turnEndEvents = result.events.filter((e) => e.type === 'turn_end');

    expect(turnStartEvents.length).toBeGreaterThanOrEqual(1);
    expect(turnEndEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('increments turn counter', () => {
    const playerUnit = createTestUnit();
    const state = createTestState([playerUnit]);
    const rng = new SeededRandom(12345);

    const result = executeTurn(state, playerUnit.instanceId, rng);

    expect(result.state.turn).toBe(state.turn + 1);
  });

  it('skips action for routing unit', () => {
    const routingUnit = createTestUnit({ isRouting: true, resolve: 0 });
    const enemyUnit = createTestUnit({
      instanceId: 'enemy_test_0',
      team: 'enemy',
      position: { x: 3, y: 2 }, // Adjacent to player
      facing: 'N',
    });
    const state = createTestState([routingUnit, enemyUnit]);
    const rng = new SeededRandom(12345);

    const result = executeTurn(state, routingUnit.instanceId, rng);

    // Routing unit should not attack
    const attackEvents = result.events.filter((e) => e.type === 'attack');
    expect(attackEvents).toHaveLength(0);
  });
});

describe('handleTurnStart', () => {
  it('resets riposte charges', () => {
    const unit = createTestUnit({ riposteCharges: 0 });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    expect(updatedUnit?.riposteCharges).toBe(1);
  });

  it('regenerates resolve', () => {
    const unit = createTestUnit({ resolve: 50 });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    expect(updatedUnit?.resolve).toBe(55); // +5 regen
  });

  it('does not exceed max resolve', () => {
    const unit = createTestUnit({ resolve: 98, maxResolve: 100 });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    expect(updatedUnit?.resolve).toBe(100);
  });

  it('starts routing when resolve is 0 and stays 0 after regen', () => {
    // Note: resolve regenerates +5 first, so we need to test with a unit
    // that will still have 0 resolve after regen (which isn't possible with current logic)
    // Instead, test that routing is triggered when resolve <= 0 after regen
    // This test verifies the routing check happens after regen
    const unit = createTestUnit({ resolve: -5, isRouting: false }); // Will be 0 after +5 regen
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    // After +5 regen, resolve = 0, should start routing
    expect(updatedUnit?.resolve).toBe(0);
    expect(updatedUnit?.isRouting).toBe(true);
  });

  it('rallies when resolve reaches 25 (via external source)', () => {
    // Note: Routing units do NOT regenerate resolve, so they can only rally
    // if their resolve is increased by an external source (e.g., ability, aura)
    // This test verifies that a routing unit with resolve >= 25 will rally
    const unit = createTestUnit({ resolve: 25, isRouting: true });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    // Routing units don't regenerate, but if resolve >= 25, they should rally
    expect(updatedUnit?.resolve).toBe(25);
    expect(updatedUnit?.isRouting).toBe(false);
  });
});

describe('handleTurnEnd', () => {
  it('decays armor shred', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);

    const result = handleTurnEnd(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    expect(updatedUnit?.armorShred).toBe(3); // -2 decay
  });

  it('does not go below 0 armor shred', () => {
    const unit = createTestUnit({ armorShred: 1 });
    const state = createTestState([unit]);

    const result = handleTurnEnd(state, unit.instanceId);

    const updatedUnit = result.state.units.find(
      (u) => u.instanceId === unit.instanceId,
    );
    expect(updatedUnit?.armorShred).toBe(0);
  });
});

describe('handleUnitDeath', () => {
  it('creates death event', () => {
    const unit = createTestUnit({ currentHp: 0, alive: false });
    const state = createTestState([unit]);

    const result = handleUnitDeath(state, unit.instanceId, 'enemy_killer_0');

    const deathEvents = result.events.filter((e) => e.type === 'unit_died');
    expect(deathEvents).toHaveLength(1);
    expect(deathEvents[0].targetId).toBe(unit.instanceId);
  });

  it('removes unit from turn queue', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = handleUnitDeath(state, unit.instanceId);

    expect(result.state.turnQueue).not.toContain(unit.instanceId);
  });

  it('updates occupied positions', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 }, alive: false, currentHp: 0 });
    const state = createTestState([unit]);
    // Manually set occupied positions to include the dead unit's position
    // (simulating state before death was processed)
    const stateWithOccupied = {
      ...state,
      occupiedPositions: new Set(['3,1']),
    };

    const result = handleUnitDeath(stateWithOccupied, unit.instanceId);

    expect(result.state.occupiedPositions.has('3,1')).toBe(false);
  });
});

describe('calculateFacing', () => {
  it('returns E when target is to the right', () => {
    expect(calculateFacing({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe('E');
  });

  it('returns W when target is to the left', () => {
    expect(calculateFacing({ x: 5, y: 0 }, { x: 0, y: 0 })).toBe('W');
  });

  it('returns S when target is below', () => {
    expect(calculateFacing({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe('S');
  });

  it('returns N when target is above', () => {
    expect(calculateFacing({ x: 0, y: 5 }, { x: 0, y: 0 })).toBe('N');
  });

  it('returns E when diagonal with larger x delta', () => {
    expect(calculateFacing({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe('E');
  });

  it('returns S when diagonal with larger y delta', () => {
    expect(calculateFacing({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe('S');
  });
});

describe('calculateDamage', () => {
  it('calculates basic damage correctly', () => {
    const attacker = createTestUnit({ stats: { ...createTestUnit().stats, atk: 20, atkCount: 1 } });
    const target = createTestUnit({ stats: { ...createTestUnit().stats, armor: 5 }, armorShred: 0 });

    const damage = calculateDamage(attacker, target);

    expect(damage).toBe(15); // 20 - 5 = 15
  });

  it('applies armor shred', () => {
    const attacker = createTestUnit({ stats: { ...createTestUnit().stats, atk: 20, atkCount: 1 } });
    const target = createTestUnit({ stats: { ...createTestUnit().stats, armor: 10 }, armorShred: 5 });

    const damage = calculateDamage(attacker, target);

    expect(damage).toBe(15); // 20 - (10 - 5) = 15
  });

  it('multiplies by attack count', () => {
    const attacker = createTestUnit({ stats: { ...createTestUnit().stats, atk: 10, atkCount: 3 } });
    const target = createTestUnit({ stats: { ...createTestUnit().stats, armor: 2 }, armorShred: 0 });

    const damage = calculateDamage(attacker, target);

    expect(damage).toBe(24); // (10 - 2) * 3 = 24
  });

  it('returns minimum 1 damage', () => {
    const attacker = createTestUnit({ stats: { ...createTestUnit().stats, atk: 5, atkCount: 1 } });
    const target = createTestUnit({ stats: { ...createTestUnit().stats, armor: 100 }, armorShred: 0 });

    const damage = calculateDamage(attacker, target);

    expect(damage).toBe(1);
  });
});
