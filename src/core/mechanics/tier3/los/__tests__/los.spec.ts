/**
 * Unit tests for the Line of Sight (LoS) processor.
 *
 * Tests the LoS mechanics including:
 * - Direct fire blocking by units
 * - Arc fire ignoring obstacles
 * - Bresenham line algorithm
 * - Partial cover detection
 *
 * @module core/mechanics/tier3/los/__tests__
 */

import { createLoSProcessor } from '../los.processor';
import { DEFAULT_LOS_CONFIG } from '../../../config/defaults';
import type { BattleState, BattleUnit } from '../../../../types';
import type { UnitWithLoS } from '../los.types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Creates a minimal battle unit for testing.
 */
function createTestUnit(
  instanceId: string,
  position: { x: number; y: number },
  options: Partial<BattleUnit & UnitWithLoS> = {},
): BattleUnit & UnitWithLoS {
  return {
    id: 'test_unit',
    instanceId,
    name: 'Test Unit',
    team: 'player',
    position,
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
    role: 'melee_dps',
    cost: 5,
    abilities: [],
    ...options,
  };
}

/**
 * Creates a minimal battle state for testing.
 */
function createTestState(units: BattleUnit[]): BattleState {
  const occupiedPositions = new Set<string>();
  for (const unit of units) {
    if (unit.alive) {
      occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
    }
  }

  return {
    units,
    round: 1,
    turn: 1,
    currentPhase: 'attack',
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: [],
    currentTurnIndex: 0,
    battleId: 'test_battle',
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('LoSProcessor', () => {
  const processor = createLoSProcessor(DEFAULT_LOS_CONFIG);

  describe('getFireType', () => {
    it('should return direct for units without arc fire tags', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          tags: ['ranged'],
        },
      );

      expect(processor.getFireType(unit)).toBe('direct');
    });

    it('should return arc for units with arc_fire tag', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          tags: ['arc_fire'],
        },
      );

      expect(processor.getFireType(unit)).toBe('arc');
    });

    it('should return arc for units with siege tag', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          tags: ['siege'],
        },
      );

      expect(processor.getFireType(unit)).toBe('arc');
    });

    it('should return arc when canArcFire is true', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          canArcFire: true,
        },
      );

      expect(processor.getFireType(unit)).toBe('arc');
    });
  });

  describe('checkLoS', () => {
    it('should return clear when no units block the path', () => {
      const shooter = createTestUnit(
        'shooter',
        { x: 0, y: 0 },
        {
          range: 5,
          tags: ['ranged'],
        },
      );
      const target = createTestUnit(
        'target',
        { x: 3, y: 0 },
        {
          team: 'enemy',
        },
      );

      const state = createTestState([shooter, target]);
      const result = processor.checkLoS(shooter, target, state);

      expect(result.canAttack).toBe(true);
      expect(result.losStatus).toBe('clear');
      expect(result.fireType).toBe('direct');
    });

    it('should return blocked when a unit is in the path', () => {
      const shooter = createTestUnit(
        'shooter',
        { x: 0, y: 0 },
        {
          range: 5,
          tags: ['ranged'],
        },
      );
      const blocker = createTestUnit('blocker', { x: 1, y: 0 });
      const target = createTestUnit(
        'target',
        { x: 3, y: 0 },
        {
          team: 'enemy',
        },
      );

      const state = createTestState([shooter, blocker, target]);
      const result = processor.checkLoS(shooter, target, state);

      expect(result.canAttack).toBe(false);
      expect(result.losStatus).toBe('blocked');
      expect(result.reason).toBe('unit_blocking');
      expect(result.blockingUnitId).toBe('blocker');
    });

    it('should allow arc fire to ignore blocking units', () => {
      const shooter = createTestUnit(
        'shooter',
        { x: 0, y: 0 },
        {
          range: 5,
          tags: ['siege'],
        },
      );
      const blocker = createTestUnit('blocker', { x: 1, y: 0 });
      const target = createTestUnit(
        'target',
        { x: 3, y: 0 },
        {
          team: 'enemy',
        },
      );

      const state = createTestState([shooter, blocker, target]);
      const result = processor.checkLoS(shooter, target, state);

      expect(result.canAttack).toBe(true);
      expect(result.fireType).toBe('arc');
      expect(result.accuracyModifier).toBeLessThan(1.0);
    });

    it('should block arc fire when target is adjacent', () => {
      const shooter = createTestUnit(
        'shooter',
        { x: 0, y: 0 },
        {
          range: 5,
          tags: ['siege'],
        },
      );
      const target = createTestUnit(
        'target',
        { x: 1, y: 0 },
        {
          team: 'enemy',
        },
      );

      const state = createTestState([shooter, target]);
      const result = processor.checkLoS(shooter, target, state);

      expect(result.canAttack).toBe(false);
      expect(result.reason).toBe('arc_fire_too_close');
    });

    it('should allow units with ignore_los tag to attack through blockers', () => {
      const shooter = createTestUnit(
        'shooter',
        { x: 0, y: 0 },
        {
          range: 5,
          tags: ['ignore_los'],
        },
      );
      const blocker = createTestUnit('blocker', { x: 1, y: 0 });
      const target = createTestUnit(
        'target',
        { x: 3, y: 0 },
        {
          team: 'enemy',
        },
      );

      const state = createTestState([shooter, blocker, target]);
      const result = processor.checkLoS(shooter, target, state);

      expect(result.canAttack).toBe(true);
      expect(result.losStatus).toBe('clear');
    });
  });

  describe('calculatePath', () => {
    it('should return empty path for adjacent positions', () => {
      const state = createTestState([]);
      const result = processor.calculatePath({ x: 0, y: 0 }, { x: 1, y: 0 }, state);

      expect(result.cells.length).toBe(0);
      expect(result.isClear).toBe(true);
    });

    it('should return cells along the path', () => {
      const state = createTestState([]);
      const result = processor.calculatePath({ x: 0, y: 0 }, { x: 3, y: 0 }, state);

      expect(result.cells.length).toBe(2);
      expect(result.cells[0].position).toEqual({ x: 1, y: 0 });
      expect(result.cells[1].position).toEqual({ x: 2, y: 0 });
      expect(result.isClear).toBe(true);
    });

    it('should detect blocking units in path', () => {
      const blocker = createTestUnit('blocker', { x: 2, y: 0 });
      const state = createTestState([blocker]);
      const result = processor.calculatePath({ x: 0, y: 0 }, { x: 4, y: 0 }, state);

      expect(result.isClear).toBe(false);
      expect(result.blockingCell).toBeDefined();
      expect(result.blockingCell?.unitId).toBe('blocker');
    });

    it('should exclude specified unit IDs from blocking check', () => {
      const blocker = createTestUnit('blocker', { x: 2, y: 0 });
      const state = createTestState([blocker]);
      const result = processor.calculatePath({ x: 0, y: 0 }, { x: 4, y: 0 }, state, ['blocker']);

      expect(result.isClear).toBe(true);
    });
  });

  describe('getBlockingUnit', () => {
    it('should return undefined for empty position', () => {
      const state = createTestState([]);
      const result = processor.getBlockingUnit({ x: 1, y: 1 }, state);

      expect(result).toBeUndefined();
    });

    it('should return unit ID for occupied position', () => {
      const unit = createTestUnit('unit_1', { x: 1, y: 1 });
      const state = createTestState([unit]);
      const result = processor.getBlockingUnit({ x: 1, y: 1 }, state);

      expect(result).toBe('unit_1');
    });

    it('should not return dead units', () => {
      const unit = createTestUnit('unit_1', { x: 1, y: 1 }, { alive: false });
      const state = createTestState([unit]);
      const result = processor.getBlockingUnit({ x: 1, y: 1 }, state);

      expect(result).toBeUndefined();
    });

    it('should exclude specified unit IDs', () => {
      const unit = createTestUnit('unit_1', { x: 1, y: 1 });
      const state = createTestState([unit]);
      const result = processor.getBlockingUnit({ x: 1, y: 1 }, state, ['unit_1']);

      expect(result).toBeUndefined();
    });
  });

  describe('getAccuracyModifier', () => {
    it('should return 1.0 for direct fire', () => {
      expect(processor.getAccuracyModifier('direct', 'clear')).toBe(1.0);
    });

    it('should return reduced accuracy for arc fire', () => {
      const modifier = processor.getAccuracyModifier('arc', 'clear');
      expect(modifier).toBeLessThan(1.0);
      expect(modifier).toBe(0.8); // 1.0 - 0.2 penalty
    });
  });

  describe('getCoverDodgeBonus', () => {
    it('should return 0 for clear LoS', () => {
      expect(processor.getCoverDodgeBonus('clear')).toBe(0);
    });

    it('should return bonus for partial cover', () => {
      expect(processor.getCoverDodgeBonus('partial')).toBe(0.2);
    });

    it('should return 0 for blocked LoS', () => {
      expect(processor.getCoverDodgeBonus('blocked')).toBe(0);
    });
  });

  describe('canUseArcFire', () => {
    it('should return false for regular units', () => {
      const unit = createTestUnit('unit_1', { x: 0, y: 0 });
      expect(processor.canUseArcFire(unit)).toBe(false);
    });

    it('should return true for siege units', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          tags: ['siege'],
        },
      );
      expect(processor.canUseArcFire(unit)).toBe(true);
    });
  });

  describe('ignoresLoS', () => {
    it('should return false for regular units', () => {
      const unit = createTestUnit('unit_1', { x: 0, y: 0 });
      expect(processor.ignoresLoS(unit)).toBe(false);
    });

    it('should return true for units with ignore_los tag', () => {
      const unit = createTestUnit(
        'unit_1',
        { x: 0, y: 0 },
        {
          tags: ['ignore_los'],
        },
      );
      expect(processor.ignoresLoS(unit)).toBe(true);
    });
  });
});
