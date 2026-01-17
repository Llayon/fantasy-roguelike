/**
 * Unit tests for death handling module.
 *
 * Tests the handleUnitDeath function and related helpers.
 *
 * @module simulator/__tests__/death.spec
 */

import {
  handleUnitDeath,
  markUnitAsDead,
  removeDeadUnitFromTurnQueue,
  applyAllyDeathResolveDamage,
  recalculatePhalanxOnDeath,
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  PHALANX_MIN_ALLIES,
} from '../death';
import { BattleState } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a minimal test unit.
 */
function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
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
    position: { x: 3, y: 3 },
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
function createTestState(units: BattleUnit[] = []): BattleState {
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
    currentPhase: 'attack',
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: units.filter((u) => u.alive).map((u) => u.instanceId),
    currentTurnIndex: 0,
  };
}

const eventContext = { round: 1, turn: 1, phase: 'attack' as const };

// =============================================================================
// TESTS: handleUnitDeath
// =============================================================================

describe('handleUnitDeath', () => {
  it('marks unit as dead', () => {
    const unit = createTestUnit({ currentHp: 0 });
    const state = createTestState([unit]);

    const result = handleUnitDeath(
      state,
      unit.instanceId,
      'enemy_killer_0',
      'damage',
      eventContext,
    );

    const deadUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);
    expect(deadUnit?.alive).toBe(false);
    expect(deadUnit?.currentHp).toBe(0);
  });

  it('emits unit_died event', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = handleUnitDeath(
      state,
      unit.instanceId,
      'enemy_killer_0',
      'damage',
      eventContext,
    );

    const diedEvents = result.events.filter((e) => e.type === 'unit_died');
    expect(diedEvents).toHaveLength(1);
    expect(diedEvents[0].targetId).toBe(unit.instanceId);
  });

  it('removes unit from turn queue', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = handleUnitDeath(
      state,
      unit.instanceId,
      undefined,
      'damage',
      eventContext,
    );

    expect(result.state.turnQueue).not.toContain(unit.instanceId);
  });

  it('updates occupied positions', () => {
    const unit = createTestUnit({ position: { x: 3, y: 3 } });
    const state = createTestState([unit]);

    const result = handleUnitDeath(
      state,
      unit.instanceId,
      undefined,
      'damage',
      eventContext,
    );

    expect(result.state.occupiedPositions.has('3,3')).toBe(false);
  });

  it('returns unchanged state for non-existent unit', () => {
    const state = createTestState([]);

    const result = handleUnitDeath(
      state,
      'non_existent',
      undefined,
      'damage',
      eventContext,
    );

    expect(result.events).toHaveLength(0);
    expect(result.state).toBe(state);
  });
});

// =============================================================================
// TESTS: markUnitAsDead
// =============================================================================

describe('markUnitAsDead', () => {
  it('sets alive to false', () => {
    const unit = createTestUnit({ alive: true });
    const state = createTestState([unit]);

    const result = markUnitAsDead(state, unit.instanceId);

    const deadUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);
    expect(deadUnit?.alive).toBe(false);
  });

  it('sets currentHp to 0', () => {
    const unit = createTestUnit({ currentHp: 50 });
    const state = createTestState([unit]);

    const result = markUnitAsDead(state, unit.instanceId);

    const deadUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);
    expect(deadUnit?.currentHp).toBe(0);
  });

  it('returns unchanged state for non-existent unit', () => {
    const state = createTestState([]);

    const result = markUnitAsDead(state, 'non_existent');

    expect(result.state).toBe(state);
  });
});

// =============================================================================
// TESTS: removeDeadUnitFromTurnQueue
// =============================================================================

describe('removeDeadUnitFromTurnQueue', () => {
  it('removes unit from turn queue', () => {
    const unit1 = createTestUnit({ instanceId: 'unit_1' });
    const unit2 = createTestUnit({ instanceId: 'unit_2', position: { x: 4, y: 3 } });
    const state = createTestState([unit1, unit2]);

    const result = removeDeadUnitFromTurnQueue(state, 'unit_1');

    expect(result.turnQueue).not.toContain('unit_1');
    expect(result.turnQueue).toContain('unit_2');
  });

  it('adjusts currentTurnIndex when dead unit was before current', () => {
    const unit1 = createTestUnit({ instanceId: 'unit_1' });
    const unit2 = createTestUnit({ instanceId: 'unit_2', position: { x: 4, y: 3 } });
    const state = {
      ...createTestState([unit1, unit2]),
      currentTurnIndex: 1, // Currently on unit_2
    };

    const result = removeDeadUnitFromTurnQueue(state, 'unit_1');

    expect(result.currentTurnIndex).toBe(0); // Shifted back
  });

  it('returns unchanged state for unit not in queue', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = removeDeadUnitFromTurnQueue(state, 'non_existent');

    expect(result.turnQueue).toEqual(state.turnQueue);
  });
});

// =============================================================================
// TESTS: applyAllyDeathResolveDamage
// =============================================================================

describe('applyAllyDeathResolveDamage', () => {
  it('applies adjacent ally death damage (-15 resolve)', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const adjacentAlly = createTestUnit({
      instanceId: 'adjacent_ally',
      position: { x: 3, y: 4 }, // Adjacent (distance = 1)
      resolve: 100,
    });
    const state = createTestState([deadUnit, adjacentAlly]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const updatedAlly = result.state.units.find(
      (u) => u.instanceId === 'adjacent_ally',
    );
    expect(updatedAlly?.resolve).toBe(100 - RESOLVE_DAMAGE_ADJACENT);
  });

  it('applies nearby ally death damage (-8 resolve)', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const nearbyAlly = createTestUnit({
      instanceId: 'nearby_ally',
      position: { x: 3, y: 6 }, // Distance = 3
      resolve: 100,
    });
    const state = createTestState([deadUnit, nearbyAlly]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const updatedAlly = result.state.units.find(
      (u) => u.instanceId === 'nearby_ally',
    );
    expect(updatedAlly?.resolve).toBe(100 - RESOLVE_DAMAGE_NEARBY);
  });

  it('does not affect allies beyond range 3', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const farAlly = createTestUnit({
      instanceId: 'far_ally',
      position: { x: 3, y: 7 }, // Distance = 4
      resolve: 100,
    });
    const state = createTestState([deadUnit, farAlly]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const updatedAlly = result.state.units.find(
      (u) => u.instanceId === 'far_ally',
    );
    expect(updatedAlly?.resolve).toBe(100); // Unchanged
  });

  it('does not affect enemies', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      team: 'player',
      alive: false,
    });
    const adjacentEnemy = createTestUnit({
      instanceId: 'adjacent_enemy',
      position: { x: 3, y: 4 },
      team: 'enemy',
      resolve: 100,
    });
    const state = createTestState([deadUnit, adjacentEnemy]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const updatedEnemy = result.state.units.find(
      (u) => u.instanceId === 'adjacent_enemy',
    );
    expect(updatedEnemy?.resolve).toBe(100); // Unchanged
  });

  it('emits resolve_changed events', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const adjacentAlly = createTestUnit({
      instanceId: 'adjacent_ally',
      position: { x: 3, y: 4 },
      resolve: 100,
    });
    const state = createTestState([deadUnit, adjacentAlly]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const resolveEvents = result.events.filter(
      (e) => e.type === 'resolve_changed',
    );
    expect(resolveEvents).toHaveLength(1);
    expect(resolveEvents[0].actorId).toBe('adjacent_ally');
  });

  it('clamps resolve to 0', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const lowResolveAlly = createTestUnit({
      instanceId: 'low_resolve_ally',
      position: { x: 3, y: 4 },
      resolve: 5, // Will go negative without clamping
    });
    const state = createTestState([deadUnit, lowResolveAlly]);

    const result = applyAllyDeathResolveDamage(state, deadUnit, eventContext);

    const updatedAlly = result.state.units.find(
      (u) => u.instanceId === 'low_resolve_ally',
    );
    expect(updatedAlly?.resolve).toBe(0);
  });
});

// =============================================================================
// TESTS: recalculatePhalanxOnDeath
// =============================================================================

describe('recalculatePhalanxOnDeath', () => {
  it('breaks phalanx when unit dies', () => {
    // Create a phalanx of 3 units in a line
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const unit1 = createTestUnit({
      instanceId: 'unit_1',
      position: { x: 2, y: 3 }, // Adjacent to dead unit
      inPhalanx: true,
    });
    const unit2 = createTestUnit({
      instanceId: 'unit_2',
      position: { x: 4, y: 3 }, // Adjacent to dead unit
      inPhalanx: true,
    });
    const state = createTestState([deadUnit, unit1, unit2]);

    const result = recalculatePhalanxOnDeath(state, deadUnit, eventContext);

    // Both units should lose phalanx status (only 1 adjacent ally each now)
    const updatedUnit1 = result.state.units.find((u) => u.instanceId === 'unit_1');
    const updatedUnit2 = result.state.units.find((u) => u.instanceId === 'unit_2');
    expect(updatedUnit1?.inPhalanx).toBe(false);
    expect(updatedUnit2?.inPhalanx).toBe(false);
  });

  it('maintains phalanx when enough allies remain', () => {
    // Create a phalanx of 4 units in a square
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const unit1 = createTestUnit({
      instanceId: 'unit_1',
      position: { x: 2, y: 3 }, // Adjacent to dead unit
      inPhalanx: true,
    });
    const unit2 = createTestUnit({
      instanceId: 'unit_2',
      position: { x: 2, y: 4 }, // Adjacent to unit1
      inPhalanx: true,
    });
    const unit3 = createTestUnit({
      instanceId: 'unit_3',
      position: { x: 2, y: 2 }, // Adjacent to unit1
      inPhalanx: true,
    });
    const state = createTestState([deadUnit, unit1, unit2, unit3]);

    const result = recalculatePhalanxOnDeath(state, deadUnit, eventContext);

    // unit1 should maintain phalanx (still has 2 adjacent allies)
    const updatedUnit1 = result.state.units.find((u) => u.instanceId === 'unit_1');
    expect(updatedUnit1?.inPhalanx).toBe(true);
  });

  it('emits phalanx_broken event when formations break', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const unit1 = createTestUnit({
      instanceId: 'unit_1',
      position: { x: 2, y: 3 },
      inPhalanx: true,
    });
    const state = createTestState([deadUnit, unit1]);

    const result = recalculatePhalanxOnDeath(state, deadUnit, eventContext);

    const phalanxEvents = result.events.filter((e) => e.type === 'phalanx_broken');
    expect(phalanxEvents).toHaveLength(1);
    expect(phalanxEvents[0].metadata.reason).toBe('unit_died');
  });

  it('does not emit event when no phalanx was broken', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      alive: false,
    });
    const unit1 = createTestUnit({
      instanceId: 'unit_1',
      position: { x: 0, y: 0 }, // Far from dead unit
      inPhalanx: false,
    });
    const state = createTestState([deadUnit, unit1]);

    const result = recalculatePhalanxOnDeath(state, deadUnit, eventContext);

    const phalanxEvents = result.events.filter((e) => e.type === 'phalanx_broken');
    expect(phalanxEvents).toHaveLength(0);
  });

  it('does not affect enemy phalanx', () => {
    const deadUnit = createTestUnit({
      instanceId: 'dead_unit',
      position: { x: 3, y: 3 },
      team: 'player',
      alive: false,
    });
    const enemyUnit = createTestUnit({
      instanceId: 'enemy_unit',
      position: { x: 2, y: 3 },
      team: 'enemy',
      inPhalanx: true,
    });
    const state = createTestState([deadUnit, enemyUnit]);

    const result = recalculatePhalanxOnDeath(state, deadUnit, eventContext);

    const updatedEnemy = result.state.units.find((u) => u.instanceId === 'enemy_unit');
    expect(updatedEnemy?.inPhalanx).toBe(true); // Unchanged
  });
});

// =============================================================================
// TESTS: Integration
// =============================================================================

describe('Death handling integration', () => {
  it('handles complete death sequence', () => {
    // Setup: 3 player units in phalanx, 1 enemy
    const deadUnit = createTestUnit({
      instanceId: 'player_1',
      position: { x: 3, y: 3 },
      team: 'player',
    });
    const ally1 = createTestUnit({
      instanceId: 'player_2',
      position: { x: 2, y: 3 }, // Adjacent
      team: 'player',
      resolve: 100,
      inPhalanx: true,
    });
    const ally2 = createTestUnit({
      instanceId: 'player_3',
      position: { x: 4, y: 3 }, // Adjacent
      team: 'player',
      resolve: 100,
      inPhalanx: true,
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_1',
      position: { x: 3, y: 7 },
      team: 'enemy',
    });
    const state = createTestState([deadUnit, ally1, ally2, enemy]);

    const result = handleUnitDeath(
      state,
      deadUnit.instanceId,
      enemy.instanceId,
      'damage',
      eventContext,
    );

    // Verify death
    const dead = result.state.units.find((u) => u.instanceId === 'player_1');
    expect(dead?.alive).toBe(false);

    // Verify turn queue
    expect(result.state.turnQueue).not.toContain('player_1');

    // Verify resolve damage
    const updatedAlly1 = result.state.units.find((u) => u.instanceId === 'player_2');
    const updatedAlly2 = result.state.units.find((u) => u.instanceId === 'player_3');
    expect(updatedAlly1?.resolve).toBe(100 - RESOLVE_DAMAGE_ADJACENT);
    expect(updatedAlly2?.resolve).toBe(100 - RESOLVE_DAMAGE_ADJACENT);

    // Verify phalanx broken
    expect(updatedAlly1?.inPhalanx).toBe(false);
    expect(updatedAlly2?.inPhalanx).toBe(false);

    // Verify events
    expect(result.events.some((e) => e.type === 'unit_died')).toBe(true);
    expect(result.events.some((e) => e.type === 'resolve_changed')).toBe(true);
    expect(result.events.some((e) => e.type === 'phalanx_broken')).toBe(true);
  });
});
