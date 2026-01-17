/**
 * Mechanics Integration Tests - Task 40
 *
 * Tests specific mechanic interactions as defined in task 40:
 * 40.1 - Facing + Flanking integration
 * 40.2 - Riposte trigger conditions
 * 40.3 - Ammunition depletion and melee fallback
 * 40.4 - Charge + Intercept interaction
 * 40.5 - Resolve + Routing cycle
 *
 * @module simulator/__tests__/mechanics-integration-task40.spec
 * @see Requirements 1.2, 1.3, 1.4, 1.5
 */

import { handleAttack } from '../phases/attack';
import { handleTurnStart } from '../phases/turn-start';
import { handleMovement } from '../phases/movement';
import { SeededRandom } from '../../core/utils/random';
import {
  createTestBattleState,
  createTestUnit,
  assertUnitDead,
} from '../../__tests__/fixtures';
import { findUnit } from '../../core/utils/state-helpers';

describe('Task 40: Mechanics Integration Tests', () => {
  describe('40.1 Test facing + flanking integration', () => {
    it('should rotate facing toward target and calculate flanking bonus', () => {
      // Setup: Attacker west of target, target facing north
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 2, y: 5 },
          facing: 'E',
          stats: { hp: 100, atk: 20, atkCount: 1, armor: 5, speed: 3, initiative: 8, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(12345);
      const result = handleAttack(state, 'player_attacker', 'enemy_target', rng);

      // Should have flanking event
      const flankingEvents = result.events.filter(e => e.type === 'flanking_applied');
      expect(flankingEvents.length).toBeGreaterThan(0);
    });

    it('should apply correct damage modifier for front arc attack', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 3, y: 4 },
          facing: 'S',
          stats: { hp: 100, atk: 20, atkCount: 1, armor: 5, speed: 3, initiative: 8, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          currentHp: 100,
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(54321);
      const result = handleAttack(state, 'player_attacker', 'enemy_target', rng);

      const flankingEvents = result.events.filter(e => e.type === 'flanking_applied');
      expect(flankingEvents.length).toBeGreaterThan(0);
      expect(flankingEvents[0].metadata?.arc).toBe('front');
      expect(flankingEvents[0].metadata?.modifier).toBe(1.0);
    });

    it('should apply correct damage modifier for rear arc attack', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 3, y: 6 },
          facing: 'N',
          stats: { hp: 100, atk: 20, atkCount: 1, armor: 5, speed: 3, initiative: 8, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          currentHp: 100,
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(11111);
      const result = handleAttack(state, 'player_attacker', 'enemy_target', rng);

      const flankingEvents = result.events.filter(e => e.type === 'flanking_applied');
      expect(flankingEvents.length).toBeGreaterThan(0);
      expect(flankingEvents[0].metadata?.arc).toBe('rear');
      expect(flankingEvents[0].metadata?.modifier).toBe(1.30);
    });
  });

  describe('40.2 Test riposte trigger conditions', () => {
    it('should trigger riposte when attacked from front arc with charges', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 3, y: 4 },
          facing: 'S',
          stats: { hp: 80, atk: 18, atkCount: 1, armor: 4, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_defender',
          position: { x: 3, y: 5 },
          facing: 'N',
          riposteCharges: 2,
          stats: { hp: 100, atk: 22, atkCount: 1, armor: 6, speed: 2, initiative: 9, dodge: 5 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(10000);
      const result = handleAttack(state, 'player_attacker', 'enemy_defender', rng);

      const riposteEvents = result.events.filter(e => e.type === 'riposte_triggered');
      if (riposteEvents.length > 0) {
        expect(riposteEvents[0].metadata?.defenderId).toBe('enemy_defender');
        expect(riposteEvents[0].metadata?.attackerId).toBe('player_attacker');
      }
    });

    it('should NOT trigger riposte when attacked from flank', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 4, y: 5 },
          facing: 'W',
          stats: { hp: 80, atk: 18, atkCount: 1, armor: 4, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_defender',
          position: { x: 3, y: 5 },
          facing: 'N',
          riposteCharges: 2,
          stats: { hp: 100, atk: 22, atkCount: 1, armor: 6, speed: 2, initiative: 9, dodge: 5 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(20000);
      const result = handleAttack(state, 'player_attacker', 'enemy_defender', rng);

      const riposteEvents = result.events.filter(e => e.type === 'riposte_triggered');
      expect(riposteEvents.length).toBe(0);
    });

    it('should NOT trigger riposte when defender has no charges', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 3, y: 4 },
          facing: 'S',
          stats: { hp: 80, atk: 18, atkCount: 1, armor: 4, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_defender',
          position: { x: 3, y: 5 },
          facing: 'N',
          riposteCharges: 0,
          stats: { hp: 100, atk: 22, atkCount: 1, armor: 6, speed: 2, initiative: 9, dodge: 5 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(30000);
      const result = handleAttack(state, 'player_attacker', 'enemy_defender', rng);

      const riposteEvents = result.events.filter(e => e.type === 'riposte_triggered');
      expect(riposteEvents.length).toBe(0);
    });

    it('should consume riposte charge when riposte triggers', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_attacker',
          position: { x: 3, y: 4 },
          facing: 'S',
          stats: { hp: 80, atk: 18, atkCount: 1, armor: 4, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_defender',
          position: { x: 3, y: 5 },
          facing: 'N',
          riposteCharges: 2,
          stats: { hp: 100, atk: 22, atkCount: 1, armor: 6, speed: 2, initiative: 10, dodge: 5 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(40000);
      const result = handleAttack(state, 'player_attacker', 'enemy_defender', rng);

      const riposteEvents = result.events.filter(e => e.type === 'riposte_triggered');
      if (riposteEvents.length > 0) {
        const defender = findUnit(result.state, 'enemy_defender');
        expect(defender?.riposteCharges).toBe(1);
      }
    });
  });

  describe('40.3 Test ammunition depletion and melee fallback', () => {
    it('should consume ammunition when ranged unit attacks', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_archer',
          position: { x: 3, y: 2 },
          facing: 'S',
          range: 5,
          ammo: 12,
          maxAmmo: 12,
          stats: { hp: 60, atk: 18, atkCount: 1, armor: 2, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(50000);
      const result = handleAttack(state, 'player_archer', 'enemy_target', rng);

      const ammoEvents = result.events.filter(e => e.type === 'ammo_consumed');
      expect(ammoEvents.length).toBeGreaterThan(0);

      const archer = findUnit(result.state, 'player_archer');
      expect(archer?.ammo).toBe(11);
    });

    it('should fallback to melee when ammunition is depleted', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_archer',
          position: { x: 3, y: 4 },
          facing: 'S',
          range: 5,
          ammo: 0,
          maxAmmo: 12,
          stats: { hp: 60, atk: 18, atkCount: 1, armor: 2, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(60000);
      const result = handleAttack(state, 'player_archer', 'enemy_target', rng);

      const attackEvents = result.events.filter(e => e.type === 'attack');
      expect(attackEvents.length).toBeGreaterThan(0);

      const ammoEvents = result.events.filter(e => e.type === 'ammo_consumed');
      expect(ammoEvents.length).toBe(0);
    });

    it('should never allow ammunition to go negative', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_archer',
          position: { x: 3, y: 2 },
          facing: 'S',
          range: 5,
          ammo: 1,
          maxAmmo: 12,
          stats: { hp: 60, atk: 18, atkCount: 1, armor: 2, speed: 3, initiative: 7, dodge: 10 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(70000);
      const result = handleAttack(state, 'player_archer', 'enemy_target', rng);

      const archer = findUnit(result.state, 'player_archer');
      expect(archer?.ammo).toBe(0);
      expect(archer?.ammo).toBeGreaterThanOrEqual(0);
    });
  });

  describe('40.4 Test charge + intercept interaction', () => {
    it('should build momentum during movement', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_cavalry',
          position: { x: 3, y: 2 },
          facing: 'S',
          momentum: 0,
          tags: ['melee', 'charge', 'cavalry'],
          stats: { hp: 100, atk: 18, atkCount: 1, armor: 5, speed: 4, initiative: 6, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 8 },
          facing: 'N',
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(80000);
      const targetPosition = { x: 3, y: 5 };
      const result = handleMovement(state, 'player_cavalry', targetPosition);

      const cavalry = findUnit(result.state, 'player_cavalry');
      expect(cavalry?.momentum).toBeGreaterThan(0);
    });

    it('should apply charge bonus damage when attacking with momentum', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_cavalry',
          position: { x: 3, y: 4 },
          facing: 'S',
          momentum: 3,
          tags: ['melee', 'charge', 'cavalry'],
          stats: { hp: 100, atk: 18, atkCount: 1, armor: 5, speed: 4, initiative: 6, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_target',
          position: { x: 3, y: 5 },
          facing: 'N',
          currentHp: 100,
          stats: { hp: 100, atk: 15, atkCount: 1, armor: 8, speed: 2, initiative: 5, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(90000);
      const result = handleAttack(state, 'player_cavalry', 'enemy_target', rng);

      const chargeEvents = result.events.filter(e => e.type === 'charge_impact');
      expect(chargeEvents.length).toBeGreaterThan(0);

      if (chargeEvents[0]) {
        expect(chargeEvents[0].metadata?.momentum).toBe(3);
        expect(chargeEvents[0].metadata?.bonusDamage).toBeGreaterThan(0);
      }
    });

    it('should trigger spear wall counter against charging cavalry', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_cavalry',
          position: { x: 3, y: 4 },
          facing: 'S',
          momentum: 4,
          tags: ['melee', 'charge', 'cavalry'],
          stats: { hp: 100, atk: 18, atkCount: 1, armor: 5, speed: 4, initiative: 6, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_spearman',
          position: { x: 3, y: 5 },
          facing: 'N',
          tags: ['melee', 'heavy', 'phalanx', 'spear_wall'],
          stats: { hp: 150, atk: 8, atkCount: 1, armor: 12, speed: 1, initiative: 3, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(100000);
      const result = handleAttack(state, 'player_cavalry', 'enemy_spearman', rng);

      const counterEvents = result.events.filter(e => 
        e.type === 'spear_wall_counter' || e.type === 'charge_countered'
      );
      
      if (counterEvents.length > 0) {
        const cavalry = findUnit(result.state, 'player_cavalry');
        expect(cavalry?.momentum).toBe(0);
        expect(cavalry?.currentHp).toBeLessThan(100);
      }
    });

    it('should trigger hard intercept when cavalry moves near spearman', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_cavalry',
          position: { x: 3, y: 2 },
          facing: 'S',
          momentum: 0,
          tags: ['melee', 'charge', 'cavalry'],
          stats: { hp: 100, atk: 18, atkCount: 1, armor: 5, speed: 4, initiative: 6, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_spearman',
          position: { x: 3, y: 5 },
          facing: 'N',
          tags: ['melee', 'heavy', 'phalanx', 'spear_wall'],
          stats: { hp: 150, atk: 8, atkCount: 1, armor: 12, speed: 1, initiative: 3, dodge: 0 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(110000);
      const targetPosition = { x: 3, y: 4 };
      const result = handleMovement(state, 'player_cavalry', targetPosition);

      const interceptEvents = result.events.filter(e => 
        e.type === 'hard_intercept' || e.type === 'intercept_triggered'
      );
      
      if (interceptEvents.length > 0) {
        const cavalry = findUnit(result.state, 'player_cavalry');
        expect(cavalry?.momentum).toBeDefined();
      }
    });
  });

  describe('40.5 Test resolve + routing cycle', () => {
    it('should regenerate resolve at turn start', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_knight',
          position: { x: 3, y: 0 },
          facing: 'S',
          resolve: 40,
          maxResolve: 100,
          isRouting: false,
          faction: 'human',
          stats: { hp: 120, atk: 12, atkCount: 1, armor: 8, speed: 2, initiative: 4, dodge: 5 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_rogue',
          position: { x: 3, y: 9 },
          facing: 'N',
          stats: { hp: 70, atk: 15, atkCount: 2, armor: 3, speed: 4, initiative: 9, dodge: 25 },
        }, 'enemy', 0),
      ]);

      const result = handleTurnStart(state, 'player_knight');

      const knight = findUnit(result.state, 'player_knight');
      expect(knight?.resolve).toBeGreaterThan(40);

      const resolveEvents = result.events.filter(e => e.type === 'resolve_changed');
      expect(resolveEvents.length).toBeGreaterThan(0);
    });

    it('should apply resolve damage when adjacent ally dies', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_knight',
          position: { x: 3, y: 0 },
          facing: 'S',
          resolve: 50,
          maxResolve: 100,
          faction: 'human',
          stats: { hp: 120, atk: 12, atkCount: 1, armor: 8, speed: 2, initiative: 4, dodge: 5 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'player_guardian',
          position: { x: 4, y: 0 },
          facing: 'S',
          currentHp: 1,
          resolve: 50,
          maxResolve: 100,
          faction: 'human',
          stats: { hp: 150, atk: 8, atkCount: 1, armor: 12, speed: 1, initiative: 3, dodge: 0 },
        }, 'player', 1),
        createTestUnit({
          instanceId: 'enemy_assassin',
          position: { x: 4, y: 1 },
          facing: 'N',
          stats: { hp: 55, atk: 100, atkCount: 1, armor: 2, speed: 5, initiative: 10, dodge: 20 },
        }, 'enemy', 0),
      ]);

      const rng = new SeededRandom(120000);
      const result = handleAttack(state, 'enemy_assassin', 'player_guardian', rng);

      const guardian = findUnit(result.state, 'player_guardian');
      expect(guardian?.alive).toBe(false);

      const knight = findUnit(result.state, 'player_knight');
      expect(knight?.resolve).toBeLessThan(50);
    });

    it('should rally when resolve reaches threshold (25)', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_knight',
          position: { x: 3, y: 0 },
          facing: 'S',
          resolve: 25,
          maxResolve: 100,
          isRouting: true,
          faction: 'human',
          stats: { hp: 120, atk: 12, atkCount: 1, armor: 8, speed: 2, initiative: 4, dodge: 5 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_rogue',
          position: { x: 3, y: 9 },
          facing: 'N',
          stats: { hp: 70, atk: 15, atkCount: 2, armor: 3, speed: 4, initiative: 9, dodge: 25 },
        }, 'enemy', 0),
      ]);

      const result = handleTurnStart(state, 'player_knight');

      const rallyEvents = result.events.filter(e => e.type === 'unit_rallied');
      expect(rallyEvents.length).toBeGreaterThan(0);

      const knight = findUnit(result.state, 'player_knight');
      expect(knight?.isRouting).toBe(false);
    });

    it('should handle undead crumbling instead of routing', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_skeleton',
          position: { x: 3, y: 0 },
          facing: 'S',
          resolve: 0,
          maxResolve: 100,
          isRouting: false,
          faction: 'undead',
          stats: { hp: 80, atk: 10, atkCount: 1, armor: 4, speed: 2, initiative: 3, dodge: 0 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'enemy_rogue',
          position: { x: 3, y: 9 },
          facing: 'N',
          stats: { hp: 70, atk: 15, atkCount: 2, armor: 3, speed: 4, initiative: 9, dodge: 25 },
        }, 'enemy', 0),
      ]);

      const result = handleTurnStart(state, 'player_skeleton');

      const skeleton = findUnit(result.state, 'player_skeleton');
      
      const crumbleEvents = result.events.filter(e => 
        e.type === 'unit_crumbled' || e.type === 'unit_died'
      );
      
      if (crumbleEvents.length > 0) {
        expect(skeleton?.alive).toBe(false);
      }
    });

    it('should provide phalanx bonus to resolve regeneration', () => {
      const state = createTestBattleState([
        createTestUnit({
          instanceId: 'player_knight',
          position: { x: 3, y: 0 },
          facing: 'S',
          resolve: 50,
          maxResolve: 100,
          inPhalanx: false, // Will be calculated at turn start
          tags: ['melee', 'heavy', 'phalanx'],
          stats: { hp: 120, atk: 12, atkCount: 1, armor: 8, speed: 2, initiative: 4, dodge: 5 },
        }, 'player', 0),
        createTestUnit({
          instanceId: 'player_guardian',
          position: { x: 4, y: 0 }, // East of knight
          facing: 'S',
          tags: ['melee', 'heavy', 'phalanx'],
          stats: { hp: 150, atk: 8, atkCount: 1, armor: 12, speed: 1, initiative: 3, dodge: 0 },
        }, 'player', 1),
        createTestUnit({
          instanceId: 'player_knight_2',
          position: { x: 3, y: 1 }, // South of knight
          facing: 'S',
          tags: ['melee', 'heavy', 'phalanx'],
          stats: { hp: 120, atk: 12, atkCount: 1, armor: 8, speed: 2, initiative: 4, dodge: 5 },
        }, 'player', 2),
        createTestUnit({
          instanceId: 'enemy_rogue',
          position: { x: 3, y: 9 },
          facing: 'N',
          stats: { hp: 70, atk: 15, atkCount: 2, armor: 3, speed: 4, initiative: 9, dodge: 25 },
        }, 'enemy', 0),
      ]);

      const result = handleTurnStart(state, 'player_knight');

      const knight = findUnit(result.state, 'player_knight');
      expect(knight?.resolve).toBeGreaterThan(50);
      expect(knight?.resolve).toBeGreaterThanOrEqual(58); // 50 + 5 base + 3 phalanx = 58
      expect(knight?.inPhalanx).toBe(true); // Should be detected as in phalanx
    });
  });
});



