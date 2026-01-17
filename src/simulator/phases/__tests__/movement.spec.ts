/**
 * Unit tests for movement phase handler.
 *
 * Tests the following functionality:
 * - Pathfinding to target position
 * - Hard intercept (spearman vs cavalry)
 * - Soft intercept (entering enemy ZoC)
 * - Engagement status updates
 * - Charge momentum calculation
 *
 * @see Requirements 2.4 for movement phase specification
 */

import {
  handleMovement,
  calculateChargeMomentum,
  updateEngagementStatus,
  checkHardIntercept,
  checkSoftIntercept,
  isFacingPosition,
  getRoutingTargetPosition,
  MAX_MOMENTUM,
  SPEAR_WALL_COUNTER_MULTIPLIER,
} from '../movement';
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
      speed: 3,
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
    currentPhase: 'movement' as Phase,
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

describe('Movement Constants', () => {
  it('has correct max momentum value', () => {
    // MAX_MOMENTUM is now from DEFAULT_CHARGE_CONFIG.maxMomentum = 1.0
    expect(MAX_MOMENTUM).toBe(1.0);
  });

  it('has correct spear wall counter multiplier', () => {
    expect(SPEAR_WALL_COUNTER_MULTIPLIER).toBe(0.5);
  });
});

// =============================================================================
// FACING POSITION TESTS
// =============================================================================

describe('isFacingPosition', () => {
  it('returns true when unit faces north and target is above', () => {
    const unit = createTestUnit({ facing: 'N', position: { x: 3, y: 5 } });
    expect(isFacingPosition(unit, { x: 3, y: 3 })).toBe(true);
  });

  it('returns true when unit faces south and target is below', () => {
    const unit = createTestUnit({ facing: 'S', position: { x: 3, y: 3 } });
    expect(isFacingPosition(unit, { x: 3, y: 5 })).toBe(true);
  });

  it('returns true when unit faces east and target is to the right', () => {
    const unit = createTestUnit({ facing: 'E', position: { x: 3, y: 3 } });
    expect(isFacingPosition(unit, { x: 5, y: 3 })).toBe(true);
  });

  it('returns true when unit faces west and target is to the left', () => {
    const unit = createTestUnit({ facing: 'W', position: { x: 5, y: 3 } });
    expect(isFacingPosition(unit, { x: 3, y: 3 })).toBe(true);
  });

  it('returns false when unit faces wrong direction', () => {
    const unit = createTestUnit({ facing: 'N', position: { x: 3, y: 3 } });
    expect(isFacingPosition(unit, { x: 3, y: 5 })).toBe(false); // Target is below, facing north
  });
});

// =============================================================================
// HARD INTERCEPT TESTS
// =============================================================================

describe('checkHardIntercept', () => {
  const eventContext = { round: 1, turn: 1, phase: 'movement' as Phase };

  it('triggers hard intercept when cavalry passes near facing spearman', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 1 },
      currentHp: 100,
    });
    const spearman = createTestUnit({
      instanceId: 'enemy_spearman_0',
      team: 'enemy',
      tags: ['spearman'],
      position: { x: 3, y: 4 },
      facing: 'N', // Facing the cavalry
      stats: { ...createTestUnit().stats, atk: 20 },
    });
    const state = createTestState([cavalry, spearman]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 }, // Within 2 cells of spearman
    ];

    const result = checkHardIntercept(state, cavalry, path, eventContext);

    expect(result.intercepted).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe('intercept_triggered');
  });

  it('does not trigger for non-cavalry units', () => {
    const infantry = createTestUnit({
      tags: ['infantry'],
      position: { x: 3, y: 1 },
    });
    const spearman = createTestUnit({
      instanceId: 'enemy_spearman_0',
      team: 'enemy',
      tags: ['spearman'],
      position: { x: 3, y: 4 },
      facing: 'N',
    });
    const state = createTestState([infantry, spearman]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkHardIntercept(state, infantry, path, eventContext);

    expect(result.intercepted).toBe(false);
    expect(result.events.length).toBe(0);
  });

  it('does not trigger when spearman is not facing cavalry', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 1 },
    });
    const spearman = createTestUnit({
      instanceId: 'enemy_spearman_0',
      team: 'enemy',
      tags: ['spearman'],
      position: { x: 3, y: 4 },
      facing: 'S', // Facing away from cavalry
    });
    const state = createTestState([cavalry, spearman]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkHardIntercept(state, cavalry, path, eventContext);

    expect(result.intercepted).toBe(false);
  });

  it('applies counter damage to cavalry', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 1 },
      currentHp: 100,
    });
    const spearman = createTestUnit({
      instanceId: 'enemy_spearman_0',
      team: 'enemy',
      tags: ['spearman'],
      position: { x: 3, y: 4 },
      facing: 'N',
      stats: { ...createTestUnit().stats, atk: 20 },
    });
    const state = createTestState([cavalry, spearman]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkHardIntercept(state, cavalry, path, eventContext);
    const updatedCavalry = result.state.units.find((u) => u.instanceId === cavalry.instanceId);

    const expectedDamage = Math.floor(20 * SPEAR_WALL_COUNTER_MULTIPLIER);
    expect(updatedCavalry?.currentHp).toBe(100 - expectedDamage);
  });

  it('resets cavalry momentum on intercept', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 1 },
      momentum: 3,
    });
    const spearman = createTestUnit({
      instanceId: 'enemy_spearman_0',
      team: 'enemy',
      tags: ['spearman'],
      position: { x: 3, y: 4 },
      facing: 'N',
    });
    const state = createTestState([cavalry, spearman]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkHardIntercept(state, cavalry, path, eventContext);
    const updatedCavalry = result.state.units.find((u) => u.instanceId === cavalry.instanceId);

    expect(updatedCavalry?.momentum).toBe(0);
  });
});

// =============================================================================
// SOFT INTERCEPT TESTS
// =============================================================================

describe('checkSoftIntercept', () => {
  const eventContext = { round: 1, turn: 1, phase: 'movement' as Phase };

  it('triggers soft intercept when entering enemy ZoC', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 },
    });
    const state = createTestState([unit, enemy]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 }, // Adjacent to enemy
    ];

    const result = checkSoftIntercept(state, unit, path, eventContext);

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('intercept_triggered');
  });

  it('does not trigger when no enemies are adjacent', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 7, y: 7 }, // Far away
    });
    const state = createTestState([unit, enemy]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkSoftIntercept(state, unit, path, eventContext);

    expect(result.events.length).toBe(0);
  });

  it('returns adjusted path on soft intercept', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 },
    });
    const state = createTestState([unit, enemy]);
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ];

    const result = checkSoftIntercept(state, unit, path, eventContext);

    // Soft intercept doesn't stop movement, just engages
    expect(result.adjustedPath).toEqual(path);
  });
});

// =============================================================================
// ENGAGEMENT STATUS TESTS
// =============================================================================

describe('updateEngagementStatus', () => {
  const eventContext = { round: 1, turn: 1, phase: 'movement' as Phase };

  it('engages unit when adjacent to enemy', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
      engaged: false,
      engagedBy: [],
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 }, // Adjacent
    });
    const state = createTestState([unit, enemy]);

    const result = updateEngagementStatus(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.engaged).toBe(true);
    expect(updatedUnit?.engagedBy).toContain(enemy.instanceId);
  });

  it('disengages unit when no enemies are adjacent', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
      engaged: true,
      engagedBy: ['enemy_knight_0'],
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 7, y: 7 }, // Far away
    });
    const state = createTestState([unit, enemy]);

    const result = updateEngagementStatus(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.engaged).toBe(false);
    expect(updatedUnit?.engagedBy).toHaveLength(0);
  });

  it('emits engagement_changed event when status changes', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
      engaged: false,
      engagedBy: [],
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 },
    });
    const state = createTestState([unit, enemy]);

    const result = updateEngagementStatus(state, unit.instanceId, eventContext);

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe('engagement_changed');
  });

  it('updates enemy engagement status as well', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
      engaged: false,
      engagedBy: [],
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 },
      engaged: false,
      engagedBy: [],
    });
    const state = createTestState([unit, enemy]);

    const result = updateEngagementStatus(state, unit.instanceId, eventContext);
    const updatedEnemy = result.state.units.find((u) => u.instanceId === enemy.instanceId);

    expect(updatedEnemy?.engaged).toBe(true);
    expect(updatedEnemy?.engagedBy).toContain(unit.instanceId);
  });

  it('handles multiple adjacent enemies', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
      engaged: false,
      engagedBy: [],
    });
    const enemy1 = createTestUnit({
      instanceId: 'enemy_knight_0',
      team: 'enemy',
      position: { x: 3, y: 4 },
    });
    const enemy2 = createTestUnit({
      instanceId: 'enemy_knight_1',
      team: 'enemy',
      position: { x: 4, y: 3 },
    });
    const state = createTestState([unit, enemy1, enemy2]);

    const result = updateEngagementStatus(state, unit.instanceId, eventContext);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.engaged).toBe(true);
    expect(updatedUnit?.engagedBy).toHaveLength(2);
    expect(updatedUnit?.engagedBy).toContain(enemy1.instanceId);
    expect(updatedUnit?.engagedBy).toContain(enemy2.instanceId);
  });
});

// =============================================================================
// CHARGE MOMENTUM TESTS
// =============================================================================

describe('calculateChargeMomentum', () => {
  const eventContext = { round: 1, turn: 1, phase: 'movement' as Phase };

  it('calculates momentum based on distance moved using ChargeProcessor', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 4 }, // Final position after move
      momentum: 0,
    });
    const state = createTestState([cavalry]);
    const fromPosition = { x: 3, y: 1 };
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ];

    const result = calculateChargeMomentum(
      state,
      cavalry.instanceId,
      fromPosition,
      path,
      eventContext,
    );
    const updatedCavalry = result.state.units.find((u) => u.instanceId === cavalry.instanceId);

    // New formula: momentum = distance * 0.2 = 3 * 0.2 = 0.6
    expect(updatedCavalry?.momentum).toBeCloseTo(0.6);
  });

  it('caps momentum at MAX_MOMENTUM', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 7 },
      momentum: 0,
      stats: { ...createTestUnit().stats, speed: 10 }, // High speed
    });
    const state = createTestState([cavalry]);
    const fromPosition = { x: 3, y: 0 };
    const path = [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
      { x: 3, y: 7 },
    ];

    const result = calculateChargeMomentum(
      state,
      cavalry.instanceId,
      fromPosition,
      path,
      eventContext,
    );
    const updatedCavalry = result.state.units.find((u) => u.instanceId === cavalry.instanceId);

    expect(updatedCavalry?.momentum).toBe(MAX_MOMENTUM);
  });

  it('does not calculate momentum for non-cavalry units', () => {
    const infantry = createTestUnit({
      tags: ['infantry'],
      position: { x: 3, y: 4 },
      momentum: 0,
    });
    const state = createTestState([infantry]);
    const fromPosition = { x: 3, y: 1 };
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ];

    const result = calculateChargeMomentum(
      state,
      infantry.instanceId,
      fromPosition,
      path,
      eventContext,
    );

    expect(result.events.length).toBe(0);
  });

  it('emits charge_started event for cavalry', () => {
    const cavalry = createTestUnit({
      instanceId: 'player_cavalry_0',
      tags: ['cavalry'],
      position: { x: 3, y: 4 },
      momentum: 0,
    });
    const state = createTestState([cavalry]);
    const fromPosition = { x: 3, y: 1 };
    const path = [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ];

    const result = calculateChargeMomentum(
      state,
      cavalry.instanceId,
      fromPosition,
      path,
      eventContext,
    );

    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe('charge_started');
  });
});

// =============================================================================
// ROUTING TARGET POSITION TESTS
// =============================================================================

describe('getRoutingTargetPosition', () => {
  it('returns position on player deployment edge for player units', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 5 },
      isRouting: true,
      team: 'player',
    });
    const state = createTestState([unit]);

    const target = getRoutingTargetPosition(state, unit.instanceId);

    expect(target).not.toBeNull();
    expect(target?.y).toBe(0); // Player deployment edge
  });

  it('returns position on enemy deployment edge for enemy units', () => {
    const unit = createTestUnit({
      instanceId: 'enemy_knight_0',
      position: { x: 3, y: 5 },
      isRouting: true,
      team: 'enemy',
    });
    const state = createTestState([unit]);

    const target = getRoutingTargetPosition(state, unit.instanceId);

    expect(target).not.toBeNull();
    expect(target?.y).toBe(9); // Enemy deployment edge
  });

  it('returns null for non-routing units', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 5 },
      isRouting: false,
    });
    const state = createTestState([unit]);

    const target = getRoutingTargetPosition(state, unit.instanceId);

    expect(target).toBeNull();
  });

  it('avoids occupied positions', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 5 },
      isRouting: true,
      team: 'player',
    });
    const blocker = createTestUnit({
      instanceId: 'player_knight_1',
      position: { x: 3, y: 0 }, // Blocking closest position
    });
    const state = createTestState([unit, blocker]);

    const target = getRoutingTargetPosition(state, unit.instanceId);

    expect(target).not.toBeNull();
    expect(target?.y).toBe(0);
    expect(target?.x).not.toBe(3); // Should find different x position
  });
});

// =============================================================================
// FULL PHASE HANDLER TESTS
// =============================================================================

describe('handleMovement', () => {
  it('moves unit to target position', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 3 };

    const result = handleMovement(state, unit.instanceId, targetPosition);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    expect(updatedUnit?.position.x).toBe(3);
    expect(updatedUnit?.position.y).toBe(3);
  });

  it('emits move event', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 3 };

    const result = handleMovement(state, unit.instanceId, targetPosition);

    const moveEvent = result.events.find((e) => e.type === 'move');
    expect(moveEvent).toBeDefined();
  });

  it('returns unchanged state when already at target', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 3 },
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 3 };

    const result = handleMovement(state, unit.instanceId, targetPosition);

    expect(result.events.length).toBe(0);
  });

  it('returns unchanged state for dead unit', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
      alive: false,
      currentHp: 0,
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 3 };

    const result = handleMovement(state, unit.instanceId, targetPosition);

    expect(result.state).toBe(state);
    expect(result.events.length).toBe(0);
  });

  it('limits movement by unit speed', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
      stats: { ...createTestUnit().stats, speed: 2 },
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 9 }; // Far away

    const result = handleMovement(state, unit.instanceId, targetPosition);
    const updatedUnit = result.state.units.find((u) => u.instanceId === unit.instanceId);

    // Should only move 2 cells (speed limit)
    expect(updatedUnit?.position.y).toBeLessThanOrEqual(3);
  });

  it('updates occupied positions after movement', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const state = createTestState([unit]);
    const targetPosition = { x: 3, y: 3 };

    const result = handleMovement(state, unit.instanceId, targetPosition);

    expect(result.state.occupiedPositions.has('3,3')).toBe(true);
    expect(result.state.occupiedPositions.has('3,1')).toBe(false);
  });

  it('preserves immutability of original state', () => {
    const unit = createTestUnit({
      position: { x: 3, y: 1 },
    });
    const state = createTestState([unit]);
    const originalPosition = { ...unit.position };
    const targetPosition = { x: 3, y: 3 };

    handleMovement(state, unit.instanceId, targetPosition);

    // Original state should be unchanged
    expect(state.units[0].position).toEqual(originalPosition);
  });
});
