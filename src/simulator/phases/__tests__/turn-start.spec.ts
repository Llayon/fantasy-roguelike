/**
 * Unit tests for turn_start phase handler.
 *
 * Tests the following functionality:
 * - Resolve regeneration (+5 base, +3 if in phalanx)
 * - Riposte charge reset
 * - Routing/rally status checks
 * - Aura pulse effects
 *
 * @see Requirements 2.3 for turn_start phase specification
 */

import {
  handleTurnStart,
  handleResolveRegeneration,
  handleRiposteReset,
  handleRoutingCheck,
  handleAuraPulse,
  checkPhalanxStatus,
  RESOLVE_REGEN_BASE,
  RESOLVE_REGEN_PHALANX_BONUS,
  DEFAULT_RIPOSTE_CHARGES,
  RALLY_THRESHOLD,
  PHALANX_MIN_ALLIES,
} from '../turn-start';
import { BattleState, Phase } from '../../../core/types';
import { BattleUnit } from '../../../core/types/battle-unit';

// =============================================================================
// TEST FIXTURES
// =============================================================================

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
    abilities: [],
    position: { x: 3, y: 1 },
    currentHp: 100,
    maxHp: 100,
    alive: true,
    facing: 'S',
    resolve: 50,
    maxResolve: 100,
    isRouting: false,
    engaged: false,
    engagedBy: [],
    riposteCharges: 0,
    ammo: null,
    maxAmmo: null,
    momentum: 0,
    armorShred: 0,
    inPhalanx: false,
    tags: ['infantry'],
    faction: 'human',
    ...overrides,
  };
}

function createTestState(units: BattleUnit[]): BattleState {
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
    currentPhase: 'turn_start' as Phase,
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: units.filter((u) => u.alive).map((u) => u.instanceId),
    currentTurnIndex: 0,
  };
}

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('Turn Start Constants', () => {
  it('has correct resolve regeneration values', () => {
    expect(RESOLVE_REGEN_BASE).toBe(5);
    expect(RESOLVE_REGEN_PHALANX_BONUS).toBe(3);
  });

  it('has correct riposte charge default', () => {
    expect(DEFAULT_RIPOSTE_CHARGES).toBe(1);
  });

  it('has correct rally threshold', () => {
    expect(RALLY_THRESHOLD).toBe(25);
  });

  it('has correct phalanx minimum allies', () => {
    expect(PHALANX_MIN_ALLIES).toBe(2);
  });
});

// =============================================================================
// RESOLVE REGENERATION TESTS
// =============================================================================

describe('handleResolveRegeneration', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_start' as Phase };

  it('regenerates resolve by base amount', () => {
    const unit = createTestUnit({ resolve: 50 });
    const state = createTestState([unit]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.resolve).toBe(50 + RESOLVE_REGEN_BASE);
  });

  it('does not exceed max resolve', () => {
    const unit = createTestUnit({ resolve: 98, maxResolve: 100 });
    const state = createTestState([unit]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.resolve).toBe(100);
  });

  it('does not regenerate when at max resolve', () => {
    const unit = createTestUnit({ resolve: 100, maxResolve: 100 });
    const state = createTestState([unit]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('adds phalanx bonus when in phalanx formation', () => {
    // Create 3 units in phalanx formation (orthogonally adjacent)
    const unit = createTestUnit({ resolve: 50, position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      resolve: 50,
      position: { x: 2, y: 1 }, // Left of unit
    });
    const ally2 = createTestUnit({
      instanceId: 'player_knight_2',
      resolve: 50,
      position: { x: 4, y: 1 }, // Right of unit
    });
    const state = createTestState([unit, ally1, ally2]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.resolve).toBe(50 + RESOLVE_REGEN_BASE + RESOLVE_REGEN_PHALANX_BONUS);
    expect(updatedUnit?.inPhalanx).toBe(true);
  });

  it('emits resolve_changed event', () => {
    const unit = createTestUnit({ resolve: 50 });
    const state = createTestState([unit]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('resolve_changed');
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([unit]);

    const result = handleResolveRegeneration(state, unit.instanceId, eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });
});

// =============================================================================
// RIPOSTE RESET TESTS
// =============================================================================

describe('handleRiposteReset', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_start' as Phase };

  it('resets riposte charges to default', () => {
    const unit = createTestUnit({ riposteCharges: 0 });
    const state = createTestState([unit]);

    const result = handleRiposteReset(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);
  });

  it('emits riposte_reset event when charges change', () => {
    const unit = createTestUnit({ riposteCharges: 0 });
    const state = createTestState([unit]);

    const result = handleRiposteReset(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('riposte_reset');
  });

  it('does not emit event when already at max charges', () => {
    const unit = createTestUnit({ riposteCharges: DEFAULT_RIPOSTE_CHARGES });
    const state = createTestState([unit]);

    const result = handleRiposteReset(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([unit]);

    const result = handleRiposteReset(state, unit.instanceId, eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });
});

// =============================================================================
// ROUTING/RALLY TESTS
// =============================================================================

describe('handleRoutingCheck', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_start' as Phase };

  it('starts routing when resolve is 0', () => {
    const unit = createTestUnit({ resolve: 0, isRouting: false, faction: 'human' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.isRouting).toBe(true);
  });

  it('emits routing_started event when starting to route', () => {
    const unit = createTestUnit({ resolve: 0, isRouting: false, faction: 'human' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('routing_started');
  });

  it('does not route undead units (they crumble instead)', () => {
    const unit = createTestUnit({ resolve: 0, isRouting: false, faction: 'undead' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Undead don't route - they crumble (handled in damage phase)
    expect(updatedUnit?.isRouting).toBe(false);
    expect(result.events.length).toBe(0);
  });

  it('rallies when resolve reaches threshold', () => {
    const unit = createTestUnit({ resolve: RALLY_THRESHOLD, isRouting: true, faction: 'human' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.isRouting).toBe(false);
  });

  it('emits unit_rallied event when rallying', () => {
    const unit = createTestUnit({ resolve: RALLY_THRESHOLD, isRouting: true, faction: 'human' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('unit_rallied');
  });

  it('does not rally when resolve is below threshold', () => {
    const unit = createTestUnit({
      resolve: RALLY_THRESHOLD - 1,
      isRouting: true,
      faction: 'human',
    });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.isRouting).toBe(true);
    expect(result.events.length).toBe(0);
  });

  it('does not change state for non-routing unit with positive resolve', () => {
    const unit = createTestUnit({ resolve: 50, isRouting: false, faction: 'human' });
    const state = createTestState([unit]);

    const result = handleRoutingCheck(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });
});

// =============================================================================
// AURA PULSE TESTS
// =============================================================================

describe('handleAuraPulse', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_start' as Phase };

  it('applies healing aura from nearby ally', () => {
    const unit = createTestUnit({
      currentHp: 80,
      maxHp: 100,
      position: { x: 3, y: 1 },
    });
    const healer = createTestUnit({
      instanceId: 'player_priest_0',
      abilities: ['healing_aura'],
      position: { x: 4, y: 1 }, // Adjacent to unit
    });
    const state = createTestState([unit, healer]);

    const result = handleAuraPulse(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.currentHp).toBeGreaterThan(80);
  });

  it('emits aura_pulse event when aura is applied', () => {
    const unit = createTestUnit({
      currentHp: 80,
      maxHp: 100,
      position: { x: 3, y: 1 },
    });
    const healer = createTestUnit({
      instanceId: 'player_priest_0',
      abilities: ['healing_aura'],
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, healer]);

    const result = handleAuraPulse(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('aura_pulse');
  });

  it('does not apply aura from out-of-range ally', () => {
    const unit = createTestUnit({
      currentHp: 80,
      maxHp: 100,
      position: { x: 0, y: 0 },
    });
    const healer = createTestUnit({
      instanceId: 'player_priest_0',
      abilities: ['healing_aura'],
      position: { x: 5, y: 5 }, // Far from unit
    });
    const state = createTestState([unit, healer]);

    const result = handleAuraPulse(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('does not apply aura from enemy units', () => {
    const unit = createTestUnit({
      currentHp: 80,
      maxHp: 100,
      position: { x: 3, y: 1 },
    });
    const enemyHealer = createTestUnit({
      instanceId: 'enemy_priest_0',
      team: 'enemy',
      abilities: ['healing_aura'],
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, enemyHealer]);

    const result = handleAuraPulse(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('does not heal beyond max HP', () => {
    const unit = createTestUnit({
      currentHp: 99,
      maxHp: 100,
      position: { x: 3, y: 1 },
    });
    const healer = createTestUnit({
      instanceId: 'player_priest_0',
      abilities: ['healing_aura'],
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, healer]);

    const result = handleAuraPulse(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.currentHp).toBe(100);
  });
});

// =============================================================================
// PHALANX STATUS TESTS
// =============================================================================

describe('checkPhalanxStatus', () => {
  it('returns true when 2+ allies are orthogonally adjacent', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 2, y: 1 },
    });
    const ally2 = createTestUnit({
      instanceId: 'player_knight_2',
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, ally1, ally2]);

    expect(checkPhalanxStatus(state, unit)).toBe(true);
  });

  it('returns false when only 1 ally is adjacent', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 2, y: 1 },
    });
    const state = createTestState([unit, ally1]);

    expect(checkPhalanxStatus(state, unit)).toBe(false);
  });

  it('returns false when allies are diagonally adjacent', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 2, y: 0 }, // Diagonal
    });
    const ally2 = createTestUnit({
      instanceId: 'player_knight_2',
      position: { x: 4, y: 2 }, // Diagonal
    });
    const state = createTestState([unit, ally1, ally2]);

    expect(checkPhalanxStatus(state, unit)).toBe(false);
  });

  it('does not count dead allies', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 2, y: 1 },
      alive: false,
      currentHp: 0,
    });
    const ally2 = createTestUnit({
      instanceId: 'player_knight_2',
      position: { x: 4, y: 1 },
      alive: false,
      currentHp: 0,
    });
    const state = createTestState([unit, ally1, ally2]);

    expect(checkPhalanxStatus(state, unit)).toBe(false);
  });

  it('does not count enemy units', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const enemy1 = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 2, y: 1 },
    });
    const enemy2 = createTestUnit({
      instanceId: 'enemy_knight_1',
      team: 'enemy',
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, enemy1, enemy2]);

    expect(checkPhalanxStatus(state, unit)).toBe(false);
  });
});

// =============================================================================
// FULL PHASE HANDLER TESTS
// =============================================================================

describe('handleTurnStart', () => {
  it('executes all steps in order', () => {
    const unit = createTestUnit({
      resolve: 50,
      riposteCharges: 0,
      isRouting: false,
    });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Resolve regenerated
    expect(updatedUnit?.resolve).toBe(50 + RESOLVE_REGEN_BASE);
    // Riposte charges reset
    expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for non-existent unit', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = handleTurnStart(state, 'non_existent_unit');

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('handles routing unit correctly', () => {
    const unit = createTestUnit({
      resolve: RALLY_THRESHOLD,
      isRouting: true,
      riposteCharges: 0,
    });
    const state = createTestState([unit]);

    const result = handleTurnStart(state, unit.instanceId);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Should rally since resolve >= 25
    expect(updatedUnit?.isRouting).toBe(false);
  });

  it('preserves immutability of original state', () => {
    const unit = createTestUnit({ resolve: 50, riposteCharges: 0 });
    const state = createTestState([unit]);
    const originalResolve = unit.resolve;
    const originalCharges = unit.riposteCharges;

    handleTurnStart(state, unit.instanceId);

    // Original state should be unchanged
    expect(state.units[0].resolve).toBe(originalResolve);
    expect(state.units[0].riposteCharges).toBe(originalCharges);
  });
});
