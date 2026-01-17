/**
 * Unit tests for turn_end phase handler.
 *
 * Tests the following functionality:
 * - Contagion spread to adjacent allies
 * - Armor shred decay
 * - Ability cooldown ticks
 *
 * @see Requirements 2.2 for turn_end phase specification
 */

import {
  handleTurnEnd,
  handleContagionSpread,
  handleArmorShredDecay,
  handleCooldownTicks,
  getSpreadChance,
  getAdjacentAllies,
  SHRED_DECAY_AMOUNT,
} from '../turn-end';
import {
  DEFAULT_FIRE_SPREAD,
  DEFAULT_POISON_SPREAD,
  DEFAULT_FEAR_SPREAD,
  DEFAULT_PHALANX_SPREAD_BONUS,
} from '../../../core/mechanics/tier4/contagion';
import { BattleState, Phase } from '../../../core/types';
import { BattleUnit } from '../../../core/types/battle-unit';
import { SeededRandom } from '../../../core/utils/random';

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
    riposteCharges: 1,
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
    currentPhase: 'turn_end' as Phase,
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

describe('Turn End Constants', () => {
  it('has correct shred decay amount', () => {
    expect(SHRED_DECAY_AMOUNT).toBe(2);
  });

  it('has correct contagion spread chances', () => {
    // These are now from the contagion processor defaults
    expect(DEFAULT_FIRE_SPREAD).toBe(0.50);
    expect(DEFAULT_POISON_SPREAD).toBe(0.30);
    expect(DEFAULT_FEAR_SPREAD).toBe(0.40);
    expect(DEFAULT_PHALANX_SPREAD_BONUS).toBe(0.15);
  });
});

// =============================================================================
// ARMOR SHRED DECAY TESTS
// =============================================================================

describe('handleArmorShredDecay', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_end' as Phase };

  it('decays armor shred by decay amount', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.armorShred).toBe(5 - SHRED_DECAY_AMOUNT);
  });

  it('does not decay below zero', () => {
    const unit = createTestUnit({ armorShred: 1 });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.armorShred).toBe(0);
  });

  it('emits shred_decayed event when shred decays', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('shred_decayed');
  });

  it('does not emit event when no shred to decay', () => {
    const unit = createTestUnit({ armorShred: 0 });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('does not decay shred for undead units', () => {
    const unit = createTestUnit({ armorShred: 5, faction: 'undead' });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.armorShred).toBe(5);
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0, armorShred: 5 });
    const state = createTestState([unit]);

    const result = handleArmorShredDecay(state, unit.instanceId, eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });
});


// =============================================================================
// CONTAGION SPREAD TESTS
// =============================================================================

describe('handleContagionSpread', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_end' as Phase };

  it('returns unchanged state when unit has no spreadable effects', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, ally]);
    const rng = new SeededRandom(12345);

    const result = handleContagionSpread(state, unit.instanceId, rng, eventContext);

    // No events since no status effects to spread
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state when no adjacent allies', () => {
    const unit = createTestUnit({ position: { x: 0, y: 0 } });
    const ally = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 5, y: 5 }, // Far away
    });
    const state = createTestState([unit, ally]);
    const rng = new SeededRandom(12345);

    const result = handleContagionSpread(state, unit.instanceId, rng, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleContagionSpread(state, unit.instanceId, rng, eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });
});

// =============================================================================
// SPREAD CHANCE TESTS
// =============================================================================

describe('getSpreadChance', () => {
  it('returns correct base chance for fire', () => {
    expect(getSpreadChance('fire', false)).toBe(DEFAULT_FIRE_SPREAD);
  });

  it('returns correct base chance for poison', () => {
    expect(getSpreadChance('poison', false)).toBe(DEFAULT_POISON_SPREAD);
  });

  it('returns correct base chance for fear', () => {
    expect(getSpreadChance('fear', false)).toBe(DEFAULT_FEAR_SPREAD);
  });

  it('adds phalanx bonus when target is in phalanx', () => {
    expect(getSpreadChance('fire', true)).toBe(
      DEFAULT_FIRE_SPREAD + DEFAULT_PHALANX_SPREAD_BONUS
    );
    expect(getSpreadChance('poison', true)).toBe(
      DEFAULT_POISON_SPREAD + DEFAULT_PHALANX_SPREAD_BONUS
    );
    expect(getSpreadChance('fear', true)).toBe(
      DEFAULT_FEAR_SPREAD + DEFAULT_PHALANX_SPREAD_BONUS
    );
  });
});

// =============================================================================
// ADJACENT ALLIES TESTS
// =============================================================================

describe('getAdjacentAllies', () => {
  it('returns orthogonally adjacent allies', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally1 = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 2, y: 1 }, // Left
    });
    const ally2 = createTestUnit({
      instanceId: 'player_knight_2',
      position: { x: 4, y: 1 }, // Right
    });
    const ally3 = createTestUnit({
      instanceId: 'player_knight_3',
      position: { x: 3, y: 0 }, // Above
    });
    const ally4 = createTestUnit({
      instanceId: 'player_knight_4',
      position: { x: 3, y: 2 }, // Below
    });
    const state = createTestState([unit, ally1, ally2, ally3, ally4]);

    const result = getAdjacentAllies(state, unit);

    expect(result.length).toBe(4);
  });

  it('does not include diagonally adjacent allies', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 4, y: 2 }, // Diagonal
    });
    const state = createTestState([unit, ally]);

    const result = getAdjacentAllies(state, unit);

    expect(result.length).toBe(0);
  });

  it('does not include dead allies', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const ally = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 4, y: 1 },
      alive: false,
      currentHp: 0,
    });
    const state = createTestState([unit, ally]);

    const result = getAdjacentAllies(state, unit);

    expect(result.length).toBe(0);
  });

  it('does not include enemy units', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 4, y: 1 },
    });
    const state = createTestState([unit, enemy]);

    const result = getAdjacentAllies(state, unit);

    expect(result.length).toBe(0);
  });

  it('does not include the unit itself', () => {
    const unit = createTestUnit({ position: { x: 3, y: 1 } });
    const state = createTestState([unit]);

    const result = getAdjacentAllies(state, unit);

    expect(result.length).toBe(0);
  });
});


// =============================================================================
// COOLDOWN TICKS TESTS
// =============================================================================

describe('handleCooldownTicks', () => {
  const eventContext = { round: 1, turn: 1, phase: 'turn_end' as Phase };

  it('returns unchanged state for unit with no abilities', () => {
    const unit = createTestUnit({ abilities: [] });
    const state = createTestState([unit]);

    const result = handleCooldownTicks(state, unit.instanceId, eventContext);

    // No events since cooldowns aren't tracked yet
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0, abilities: ['shield_wall'] });
    const state = createTestState([unit]);

    const result = handleCooldownTicks(state, unit.instanceId, eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for non-existent unit', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);

    const result = handleCooldownTicks(state, 'non_existent_unit', eventContext);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });
});

// =============================================================================
// FULL PHASE HANDLER TESTS
// =============================================================================

describe('handleTurnEnd', () => {
  it('executes all steps in order', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleTurnEnd(state, unit.instanceId, rng);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Armor shred decayed
    expect(updatedUnit?.armorShred).toBe(5 - SHRED_DECAY_AMOUNT);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({ alive: false, currentHp: 0 });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleTurnEnd(state, unit.instanceId, rng);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for non-existent unit', () => {
    const unit = createTestUnit();
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleTurnEnd(state, 'non_existent_unit', rng);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('preserves immutability of original state', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);
    const originalShred = unit.armorShred;
    const rng = new SeededRandom(12345);

    handleTurnEnd(state, unit.instanceId, rng);

    // Original state should be unchanged
    expect(state.units[0].armorShred).toBe(originalShred);
  });

  it('handles undead unit correctly (no shred decay)', () => {
    const unit = createTestUnit({ armorShred: 5, faction: 'undead' });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleTurnEnd(state, unit.instanceId, rng);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Undead don't have shred decay
    expect(updatedUnit?.armorShred).toBe(5);
  });

  it('emits events for all state changes', () => {
    const unit = createTestUnit({ armorShred: 5 });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);

    const result = handleTurnEnd(state, unit.instanceId, rng);

    // Should have shred_decayed event
    const shredEvent = result.events.find((e) => e.type === 'shred_decayed');
    expect(shredEvent).toBeDefined();
  });
});
