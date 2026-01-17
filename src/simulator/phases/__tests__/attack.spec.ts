/**
 * Unit tests for attack phase handler.
 *
 * Tests the attack phase which handles:
 * - Facing rotation toward target
 * - Flanking arc calculation
 * - Damage calculation with modifiers
 * - Dodge roll
 * - Riposte trigger
 * - Ammunition consumption
 *
 * @module simulator/phases/__tests__/attack.spec
 */

import {
  handleAttack,
  calculateFacingDirection,
  getAttackArc,
  getFlankingModifier,
  canRiposte,
  calculateRiposteChance,
  BASE_RIPOSTE_CHANCE,
  MAX_RIPOSTE_CHANCE,
} from '../attack';
import { FLANKING_DAMAGE_MODIFIERS } from '../../../core/mechanics';
import { BattleState } from '../../../core/types/battle-state';
import { BattleUnit, FacingDirection } from '../../../core/types/battle-unit';
import { SeededRandom } from '../../../core/utils/random';

// Alias for backward compatibility in tests
const FLANKING_FRONT_MODIFIER = FLANKING_DAMAGE_MODIFIERS.front;
const FLANKING_FLANK_MODIFIER = FLANKING_DAMAGE_MODIFIERS.flank;
const FLANKING_REAR_MODIFIER = FLANKING_DAMAGE_MODIFIERS.rear;

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a test battle unit with default values.
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
      armor: 10,
      speed: 2,
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
    facing: 'S' as FacingDirection,
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
 * Create a test battle state with given units.
 */
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
    currentPhase: 'attack',
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: units.filter((u) => u.alive).map((u) => u.instanceId),
    currentTurnIndex: 0,
  };
}

// =============================================================================
// FACING DIRECTION TESTS
// =============================================================================

describe('calculateFacingDirection', () => {
  it('should return E when target is to the right', () => {
    const from = { x: 3, y: 3 };
    const to = { x: 5, y: 3 };
    expect(calculateFacingDirection(from, to)).toBe('E');
  });

  it('should return W when target is to the left', () => {
    const from = { x: 3, y: 3 };
    const to = { x: 1, y: 3 };
    expect(calculateFacingDirection(from, to)).toBe('W');
  });

  it('should return S when target is below', () => {
    const from = { x: 3, y: 3 };
    const to = { x: 3, y: 5 };
    expect(calculateFacingDirection(from, to)).toBe('S');
  });

  it('should return N when target is above', () => {
    const from = { x: 3, y: 3 };
    const to = { x: 3, y: 1 };
    expect(calculateFacingDirection(from, to)).toBe('N');
  });

  it('should return diagonal direction based on angle (SE = S)', () => {
    // When moving diagonally (equal dx and dy), the angle-based calculation
    // determines the facing based on the actual angle (135° = South-East → S)
    const from = { x: 3, y: 3 };
    const to = { x: 5, y: 5 };
    // 45° diagonal is exactly between E and S, angle-based calculation returns S
    expect(calculateFacingDirection(from, to)).toBe('S');
  });
});

// =============================================================================
// FLANKING ARC TESTS
// =============================================================================

describe('getAttackArc', () => {
  it('should return front when attacker is in front of target', () => {
    // Target facing S, attacker is south of target
    const attackerPos = { x: 3, y: 5 };
    const targetPos = { x: 3, y: 3 };
    const targetFacing: FacingDirection = 'S';
    expect(getAttackArc(attackerPos, targetPos, targetFacing)).toBe('front');
  });

  it('should return rear when attacker is behind target', () => {
    // Target facing S, attacker is north of target
    const attackerPos = { x: 3, y: 1 };
    const targetPos = { x: 3, y: 3 };
    const targetFacing: FacingDirection = 'S';
    expect(getAttackArc(attackerPos, targetPos, targetFacing)).toBe('rear');
  });

  it('should return flank when attacker is to the side', () => {
    // Target facing S, attacker is east of target
    const attackerPos = { x: 5, y: 3 };
    const targetPos = { x: 3, y: 3 };
    const targetFacing: FacingDirection = 'S';
    expect(getAttackArc(attackerPos, targetPos, targetFacing)).toBe('flank');
  });

  it('should return flank when attacker is to the other side', () => {
    // Target facing S, attacker is west of target
    const attackerPos = { x: 1, y: 3 };
    const targetPos = { x: 3, y: 3 };
    const targetFacing: FacingDirection = 'S';
    expect(getAttackArc(attackerPos, targetPos, targetFacing)).toBe('flank');
  });
});

describe('getFlankingModifier', () => {
  it('should return 1.0 for front attacks', () => {
    expect(getFlankingModifier('front')).toBe(FLANKING_FRONT_MODIFIER);
  });

  it('should return 1.15 for flank attacks', () => {
    expect(getFlankingModifier('flank')).toBe(FLANKING_FLANK_MODIFIER);
  });

  it('should return 1.30 for rear attacks', () => {
    expect(getFlankingModifier('rear')).toBe(FLANKING_REAR_MODIFIER);
  });
});

// =============================================================================
// RIPOSTE TESTS
// =============================================================================

describe('canRiposte', () => {
  it('should return true when all conditions are met', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 1,
      isRouting: false,
      alive: true,
    });
    const attacker = createTestUnit({
      instanceId: 'attacker',
      alive: true,
    });
    expect(canRiposte(defender, attacker, 'front')).toBe(true);
  });

  it('should return false when defender has no riposte charges', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 0,
    });
    const attacker = createTestUnit({ instanceId: 'attacker' });
    expect(canRiposte(defender, attacker, 'front')).toBe(false);
  });

  it('should return false when attack is from flank', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 1,
    });
    const attacker = createTestUnit({ instanceId: 'attacker' });
    expect(canRiposte(defender, attacker, 'flank')).toBe(false);
  });

  it('should return false when attack is from rear', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 1,
    });
    const attacker = createTestUnit({ instanceId: 'attacker' });
    expect(canRiposte(defender, attacker, 'rear')).toBe(false);
  });

  it('should return false when defender is routing', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 1,
      isRouting: true,
    });
    const attacker = createTestUnit({ instanceId: 'attacker' });
    expect(canRiposte(defender, attacker, 'front')).toBe(false);
  });

  it('should return false when defender is dead', () => {
    const defender = createTestUnit({
      instanceId: 'defender',
      riposteCharges: 1,
      alive: false,
    });
    const attacker = createTestUnit({ instanceId: 'attacker' });
    expect(canRiposte(defender, attacker, 'front')).toBe(false);
  });
});

describe('calculateRiposteChance', () => {
  // Note: calculateRiposteChance now delegates to RiposteProcessor which uses
  // DEFAULT_RIPOSTE_CONFIG: baseChance=0.5, guaranteedThreshold=10, initiativeBased=true
  // Formula: chance = baseChance + (initDiff / guaranteedThreshold) * 0.5
  // Range: 0.0 (attacker +10 init) to 1.0 (defender +10 init)

  it('should return base chance when initiatives are equal', () => {
    const defender = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 10 },
    });
    const attacker = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 10 },
    });
    // With equal initiative, chance = 0.5 (base chance from DEFAULT_RIPOSTE_CONFIG)
    expect(calculateRiposteChance(defender, attacker)).toBe(0.5);
  });

  it('should add initiative bonus when defender has higher initiative', () => {
    const defender = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 15, dodge: 10 },
    });
    const attacker = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 10 },
    });
    // 5 point difference: chance = 0.5 + (5/10) * 0.5 = 0.5 + 0.25 = 0.75
    expect(calculateRiposteChance(defender, attacker)).toBe(0.75);
  });

  it('should cap at maximum riposte chance', () => {
    const defender = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 50, dodge: 10 },
    });
    const attacker = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 10 },
    });
    // 40 point difference >= guaranteedThreshold (10): chance = 1.0 (guaranteed)
    expect(calculateRiposteChance(defender, attacker)).toBe(1.0);
  });

  it('should reduce chance when attacker has higher initiative', () => {
    const defender = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 5, dodge: 10 },
    });
    const attacker = createTestUnit({
      stats: { hp: 100, atk: 15, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 10 },
    });
    // -5 point difference: chance = 0.5 + (-5/10) * 0.5 = 0.5 - 0.25 = 0.25
    expect(calculateRiposteChance(defender, attacker)).toBe(0.25);
  });
});

// =============================================================================
// HANDLE ATTACK INTEGRATION TESTS
// =============================================================================

describe('handleAttack', () => {
  it('should rotate attacker facing toward target', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      position: { x: 3, y: 3 },
      facing: 'N', // Initially facing north
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 5 }, // Target is south
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_knight_0',
      'enemy_rogue_0',
      rng,
    );

    // Check facing was updated
    const updatedAttacker = newState.units.find((u) => u.instanceId === 'player_knight_0');
    expect(updatedAttacker?.facing).toBe('S');

    // Check facing rotated event was emitted
    const facingEvent = events.find((e) => e.type === 'facing_rotated');
    expect(facingEvent).toBeDefined();
    expect(facingEvent?.metadata).toMatchObject({
      from: 'N',
      to: 'S',
      reason: 'attack',
    });
  });

  it('should emit flanking applied event', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      position: { x: 3, y: 5 },
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 3 },
      facing: 'S', // Facing south, attacker is in front
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { events } = handleAttack(state, 'player_knight_0', 'enemy_rogue_0', rng);

    const flankingEvent = events.find((e) => e.type === 'flanking_applied');
    expect(flankingEvent).toBeDefined();
    expect(flankingEvent?.metadata).toMatchObject({
      arc: 'front',
      modifier: 1.0,
    });
  });

  it('should apply damage to target', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      position: { x: 3, y: 5 },
      stats: { hp: 100, atk: 20, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 0 },
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 3 },
      currentHp: 100,
      stats: { hp: 100, atk: 10, atkCount: 1, armor: 5, speed: 3, initiative: 15, dodge: 0 },
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_knight_0',
      'enemy_rogue_0',
      rng,
    );

    // Check target took damage
    const updatedTarget = newState.units.find((u) => u.instanceId === 'enemy_rogue_0');
    expect(updatedTarget?.currentHp).toBeLessThan(100);

    // Check damage event was emitted
    const damageEvent = events.find((e) => e.type === 'damage');
    expect(damageEvent).toBeDefined();
  });

  it('should consume ammunition for ranged units', () => {
    const attacker = createTestUnit({
      instanceId: 'player_archer_0',
      team: 'player',
      position: { x: 3, y: 1 },
      ammo: 12,
      maxAmmo: 12,
      range: 5,
      tags: ['ranged'],
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 5 },
      stats: { hp: 100, atk: 10, atkCount: 1, armor: 5, speed: 3, initiative: 15, dodge: 0 },
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_archer_0',
      'enemy_rogue_0',
      rng,
    );

    // Check ammo was consumed
    const updatedAttacker = newState.units.find((u) => u.instanceId === 'player_archer_0');
    expect(updatedAttacker?.ammo).toBe(11);

    // Check ammo consumed event was emitted
    const ammoEvent = events.find((e) => e.type === 'ammo_consumed');
    expect(ammoEvent).toBeDefined();
    expect(ammoEvent?.metadata).toMatchObject({
      consumed: 1,
      remaining: 11,
    });
  });

  it('should not consume ammunition for melee units', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      position: { x: 3, y: 4 },
      ammo: null,
      maxAmmo: null,
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 3 },
      stats: { hp: 100, atk: 10, atkCount: 1, armor: 5, speed: 3, initiative: 15, dodge: 0 },
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { events } = handleAttack(state, 'player_knight_0', 'enemy_rogue_0', rng);

    // Check no ammo consumed event was emitted
    const ammoEvent = events.find((e) => e.type === 'ammo_consumed');
    expect(ammoEvent).toBeUndefined();
  });

  it('should kill target when damage exceeds HP', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      position: { x: 3, y: 4 },
      stats: { hp: 100, atk: 50, atkCount: 1, armor: 10, speed: 2, initiative: 10, dodge: 0 },
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      position: { x: 3, y: 3 },
      currentHp: 10,
      stats: { hp: 100, atk: 10, atkCount: 1, armor: 0, speed: 3, initiative: 15, dodge: 0 },
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_knight_0',
      'enemy_rogue_0',
      rng,
    );

    // Check target is dead
    const updatedTarget = newState.units.find((u) => u.instanceId === 'enemy_rogue_0');
    expect(updatedTarget?.alive).toBe(false);
    expect(updatedTarget?.currentHp).toBe(0);

    // Check unit died event was emitted
    const diedEvent = events.find((e) => e.type === 'unit_died');
    expect(diedEvent).toBeDefined();
  });

  it('should return unchanged state when attacker is dead', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
      alive: false,
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_knight_0',
      'enemy_rogue_0',
      rng,
    );

    expect(newState).toBe(state);
    expect(events).toHaveLength(0);
  });

  it('should return unchanged state when target is dead', () => {
    const attacker = createTestUnit({
      instanceId: 'player_knight_0',
      team: 'player',
    });
    const target = createTestUnit({
      instanceId: 'enemy_rogue_0',
      team: 'enemy',
      alive: false,
    });
    const state = createTestState([attacker, target]);
    const rng = new SeededRandom(12345);

    const { state: newState, events } = handleAttack(
      state,
      'player_knight_0',
      'enemy_rogue_0',
      rng,
    );

    expect(newState).toBe(state);
    expect(events).toHaveLength(0);
  });
});
