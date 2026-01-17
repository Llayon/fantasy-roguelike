/**
 * Unit tests for AI decision making.
 *
 * Tests cover:
 * - Role-specific decision logic
 * - Target selection strategies
 * - Routing behavior
 * - Deterministic tiebreaking
 */

import {
  decideAction,
  AIDecisionInput,
  selectLowestHpUnit,
  selectNearestUnit,
  selectHighestThreatUnit,
  selectLowestArmorUnit,
  calculateMoveTowardTarget,
  decideRoutingAction,
} from '../decision';
import { BattleState } from '../../../core/types/battle-state';
import { BattleUnit, FacingDirection } from '../../../core/types/battle-unit';
import { SeededRandom } from '../../../core/utils/random';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a minimal battle unit for testing.
 */
function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'test_unit',
    instanceId: 'test_unit_0',
    name: 'Test Unit',
    team: 'player',
    stats: {
      hp: 100,
      atk: 10,
      atkCount: 1,
      armor: 5,
      speed: 2,
      initiative: 10,
      dodge: 5,
    },
    range: 1,
    role: 'tank',
    cost: 5,
    abilities: [],
    position: { x: 0, y: 0 },
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
    tags: [],
    faction: 'human',
    ...overrides,
  };
}

/**
 * Create a minimal battle state for testing.
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
    currentPhase: 'ai_decision',
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: units.filter((u) => u.alive).map((u) => u.instanceId),
    currentTurnIndex: 0,
  };
}

// =============================================================================
// TARGET SELECTION TESTS
// =============================================================================

describe('Target Selection', () => {
  describe('selectLowestHpUnit', () => {
    it('should return undefined for empty array', () => {
      const result = selectLowestHpUnit([]);
      expect(result).toBeUndefined();
    });

    it('should select unit with lowest HP', () => {
      const units = [
        createTestUnit({ instanceId: 'unit_a', currentHp: 50 }),
        createTestUnit({ instanceId: 'unit_b', currentHp: 30 }),
        createTestUnit({ instanceId: 'unit_c', currentHp: 70 }),
      ];

      const result = selectLowestHpUnit(units);
      expect(result?.instanceId).toBe('unit_b');
    });

    it('should use instanceId for deterministic tiebreaking', () => {
      const units = [
        createTestUnit({ instanceId: 'unit_b', currentHp: 50 }),
        createTestUnit({ instanceId: 'unit_a', currentHp: 50 }),
        createTestUnit({ instanceId: 'unit_c', currentHp: 50 }),
      ];

      const result = selectLowestHpUnit(units);
      expect(result?.instanceId).toBe('unit_a'); // Alphabetically first
    });
  });

  describe('selectNearestUnit', () => {
    it('should return undefined for empty array', () => {
      const actor = createTestUnit({ position: { x: 0, y: 0 } });
      const result = selectNearestUnit(actor, []);
      expect(result).toBeUndefined();
    });

    it('should select nearest unit by Manhattan distance', () => {
      const actor = createTestUnit({ position: { x: 0, y: 0 } });
      const units = [
        createTestUnit({ instanceId: 'unit_a', position: { x: 5, y: 5 } }), // distance 10
        createTestUnit({ instanceId: 'unit_b', position: { x: 1, y: 1 } }), // distance 2
        createTestUnit({ instanceId: 'unit_c', position: { x: 3, y: 0 } }), // distance 3
      ];

      const result = selectNearestUnit(actor, units);
      expect(result?.instanceId).toBe('unit_b');
    });

    it('should use instanceId for deterministic tiebreaking', () => {
      const actor = createTestUnit({ position: { x: 0, y: 0 } });
      const units = [
        createTestUnit({ instanceId: 'unit_b', position: { x: 2, y: 0 } }), // distance 2
        createTestUnit({ instanceId: 'unit_a', position: { x: 0, y: 2 } }), // distance 2
      ];

      const result = selectNearestUnit(actor, units);
      expect(result?.instanceId).toBe('unit_a'); // Alphabetically first
    });
  });

  describe('selectHighestThreatUnit', () => {
    it('should select unit with highest ATK', () => {
      const units = [
        createTestUnit({ instanceId: 'unit_a', stats: { ...createTestUnit().stats, atk: 10 } }),
        createTestUnit({ instanceId: 'unit_b', stats: { ...createTestUnit().stats, atk: 20 } }),
        createTestUnit({ instanceId: 'unit_c', stats: { ...createTestUnit().stats, atk: 15 } }),
      ];

      const result = selectHighestThreatUnit(units);
      expect(result?.instanceId).toBe('unit_b');
    });
  });

  describe('selectLowestArmorUnit', () => {
    it('should select unit with lowest effective armor', () => {
      const units = [
        createTestUnit({ instanceId: 'unit_a', stats: { ...createTestUnit().stats, armor: 10 }, armorShred: 0 }),
        createTestUnit({ instanceId: 'unit_b', stats: { ...createTestUnit().stats, armor: 5 }, armorShred: 0 }),
        createTestUnit({ instanceId: 'unit_c', stats: { ...createTestUnit().stats, armor: 15 }, armorShred: 10 }),
      ];

      const result = selectLowestArmorUnit(units);
      expect(result?.instanceId).toBe('unit_b'); // 5 armor
    });

    it('should consider armor shred in calculation', () => {
      const units = [
        createTestUnit({ instanceId: 'unit_a', stats: { ...createTestUnit().stats, armor: 10 }, armorShred: 8 }), // effective 2
        createTestUnit({ instanceId: 'unit_b', stats: { ...createTestUnit().stats, armor: 5 }, armorShred: 0 }), // effective 5
      ];

      const result = selectLowestArmorUnit(units);
      expect(result?.instanceId).toBe('unit_a'); // 2 effective armor
    });
  });
});

// =============================================================================
// MOVEMENT CALCULATION TESTS
// =============================================================================

describe('Movement Calculation', () => {
  describe('calculateMoveTowardTarget', () => {
    it('should move toward target within speed limit', () => {
      const actor = createTestUnit({
        position: { x: 0, y: 0 },
        stats: { ...createTestUnit().stats, speed: 2 },
      });
      const target = { x: 5, y: 5 };

      const result = calculateMoveTowardTarget(actor, target);

      // Should move 2 cells total (speed limit)
      const totalMove = Math.abs(result.x - actor.position.x) + Math.abs(result.y - actor.position.y);
      expect(totalMove).toBeLessThanOrEqual(2);
    });

    it('should not overshoot target', () => {
      const actor = createTestUnit({
        position: { x: 0, y: 0 },
        stats: { ...createTestUnit().stats, speed: 5 },
      });
      const target = { x: 2, y: 1 };

      const result = calculateMoveTowardTarget(actor, target);

      // Should reach target exactly (distance 3, speed 5)
      expect(result.x).toBe(2);
      expect(result.y).toBe(1);
    });

    it('should handle same position', () => {
      const actor = createTestUnit({ position: { x: 3, y: 3 } });
      const target = { x: 3, y: 3 };

      const result = calculateMoveTowardTarget(actor, target);

      expect(result.x).toBe(3);
      expect(result.y).toBe(3);
    });
  });
});

// =============================================================================
// ROUTING BEHAVIOR TESTS
// =============================================================================

describe('Routing Behavior', () => {
  describe('decideRoutingAction', () => {
    it('should retreat player units toward row 0', () => {
      const actor = createTestUnit({
        team: 'player',
        position: { x: 3, y: 5 },
        isRouting: true,
      });
      const state = createTestState([actor]);

      const result = decideRoutingAction(actor, state);

      expect(result.action).toBe('move');
      expect(result.targetPosition?.y).toBeLessThan(5); // Moving toward row 0
    });

    it('should retreat enemy units toward row 9', () => {
      const actor = createTestUnit({
        team: 'enemy',
        position: { x: 3, y: 5 },
        isRouting: true,
      });
      const state = createTestState([actor]);

      const result = decideRoutingAction(actor, state);

      expect(result.action).toBe('move');
      expect(result.targetPosition?.y).toBeGreaterThan(5); // Moving toward row 9
    });

    it('should skip if already at deployment edge', () => {
      const actor = createTestUnit({
        team: 'player',
        position: { x: 3, y: 0 },
        isRouting: true,
      });
      const state = createTestState([actor]);

      const result = decideRoutingAction(actor, state);

      expect(result.action).toBe('skip');
    });
  });
});

// =============================================================================
// ROLE-SPECIFIC DECISION TESTS
// =============================================================================

describe('Role-Specific Decisions', () => {
  const rng = new SeededRandom(12345);

  describe('Tank', () => {
    it('should attack lowest HP enemy in range', () => {
      const tank = createTestUnit({
        instanceId: 'player_tank_0',
        team: 'player',
        role: 'tank',
        position: { x: 3, y: 3 },
        range: 1,
      });
      const enemy1 = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 3, y: 4 }, // Adjacent
        currentHp: 50,
      });
      const enemy2 = createTestUnit({
        instanceId: 'enemy_unit_1',
        team: 'enemy',
        position: { x: 4, y: 3 }, // Adjacent
        currentHp: 30, // Lower HP
      });

      const state = createTestState([tank, enemy1, enemy2]);
      const input: AIDecisionInput = { state, actorId: tank.instanceId, rng };

      const result = decideAction(input);

      expect(result.action).toBe('attack');
      expect(result.targetId).toBe('enemy_unit_1'); // Lower HP target
    });

    it('should move toward nearest enemy if none in range', () => {
      const tank = createTestUnit({
        instanceId: 'player_tank_0',
        team: 'player',
        role: 'tank',
        position: { x: 0, y: 0 },
        range: 1,
      });
      const enemy = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 5, y: 5 },
      });

      const state = createTestState([tank, enemy]);
      const input: AIDecisionInput = { state, actorId: tank.instanceId, rng };

      const result = decideAction(input);

      expect(result.action).toBe('move');
      expect(result.targetPosition).toBeDefined();
    });
  });

  describe('Melee DPS', () => {
    it('should prioritize low HP targets for execute', () => {
      const dps = createTestUnit({
        instanceId: 'player_dps_0',
        team: 'player',
        role: 'melee_dps',
        position: { x: 3, y: 3 },
        range: 1,
      });
      const enemy1 = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 3, y: 4 },
        currentHp: 80,
        maxHp: 100,
      });
      const enemy2 = createTestUnit({
        instanceId: 'enemy_unit_1',
        team: 'enemy',
        position: { x: 4, y: 3 },
        currentHp: 20, // Below 30% threshold
        maxHp: 100,
      });

      const state = createTestState([dps, enemy1, enemy2]);
      const input: AIDecisionInput = { state, actorId: dps.instanceId, rng };

      const result = decideAction(input);

      expect(result.action).toBe('attack');
      expect(result.targetId).toBe('enemy_unit_1'); // Execute target
    });
  });

  describe('Ranged DPS', () => {
    it('should attack lowest armor enemy in range', () => {
      const ranged = createTestUnit({
        instanceId: 'player_ranged_0',
        team: 'player',
        role: 'ranged_dps',
        position: { x: 0, y: 0 },
        range: 5,
        ammo: 10,
      });
      const enemy1 = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 3, y: 0 },
        stats: { ...createTestUnit().stats, armor: 20 },
      });
      const enemy2 = createTestUnit({
        instanceId: 'enemy_unit_1',
        team: 'enemy',
        position: { x: 0, y: 3 },
        stats: { ...createTestUnit().stats, armor: 5 },
      });

      const state = createTestState([ranged, enemy1, enemy2]);
      const input: AIDecisionInput = { state, actorId: ranged.instanceId, rng };

      const result = decideAction(input);

      expect(result.action).toBe('attack');
      expect(result.targetId).toBe('enemy_unit_1'); // Lower armor
    });

    it('should switch to melee fallback when out of ammo', () => {
      const ranged = createTestUnit({
        instanceId: 'player_ranged_0',
        team: 'player',
        role: 'ranged_dps',
        position: { x: 0, y: 0 },
        range: 5,
        ammo: 0, // Out of ammo
      });
      const enemy = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 5, y: 5 },
      });

      const state = createTestState([ranged, enemy]);
      const input: AIDecisionInput = { state, actorId: ranged.instanceId, rng };

      const result = decideAction(input);

      expect(result.action).toBe('move');
      expect(result.reason).toContain('out of ammo');
    });
  });

  describe('Routing Units', () => {
    it('should only retreat when routing', () => {
      const unit = createTestUnit({
        instanceId: 'player_unit_0',
        team: 'player',
        position: { x: 3, y: 5 },
        isRouting: true,
      });
      const enemy = createTestUnit({
        instanceId: 'enemy_unit_0',
        team: 'enemy',
        position: { x: 3, y: 6 }, // Adjacent
      });

      const state = createTestState([unit, enemy]);
      const input: AIDecisionInput = { state, actorId: unit.instanceId, rng };

      const result = decideAction(input);

      // Should retreat, not attack
      expect(result.action).toBe('move');
      expect(result.reason).toContain('Routing');
    });
  });
});

// =============================================================================
// DETERMINISM TESTS
// =============================================================================

describe('Determinism', () => {
  it('should produce same decision with same inputs', () => {
    const tank = createTestUnit({
      instanceId: 'player_tank_0',
      team: 'player',
      role: 'tank',
      position: { x: 3, y: 3 },
    });
    const enemy = createTestUnit({
      instanceId: 'enemy_unit_0',
      team: 'enemy',
      position: { x: 5, y: 5 },
    });

    const state = createTestState([tank, enemy]);

    // Run decision multiple times with same seed
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const rng = new SeededRandom(12345);
      const input: AIDecisionInput = { state, actorId: tank.instanceId, rng };
      const result = decideAction(input);
      results.push(JSON.stringify(result));
    }

    // All results should be identical
    expect(new Set(results).size).toBe(1);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('should skip if unit is dead', () => {
    const unit = createTestUnit({
      instanceId: 'player_unit_0',
      alive: false,
    });
    const state = createTestState([unit]);
    const rng = new SeededRandom(12345);
    const input: AIDecisionInput = { state, actorId: unit.instanceId, rng };

    const result = decideAction(input);

    expect(result.action).toBe('skip');
  });

  it('should skip if no enemies remain', () => {
    const unit = createTestUnit({
      instanceId: 'player_unit_0',
      team: 'player',
    });
    const ally = createTestUnit({
      instanceId: 'player_unit_1',
      team: 'player',
    });
    const state = createTestState([unit, ally]);
    const rng = new SeededRandom(12345);
    const input: AIDecisionInput = { state, actorId: unit.instanceId, rng };

    const result = decideAction(input);

    expect(result.action).toBe('skip');
  });

  it('should handle unit not found', () => {
    const state = createTestState([]);
    const rng = new SeededRandom(12345);
    const input: AIDecisionInput = { state, actorId: 'nonexistent', rng };

    const result = decideAction(input);

    expect(result.action).toBe('skip');
  });
});
