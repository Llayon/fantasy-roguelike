/**
 * Tests for bot team generator.
 * Verifies budget constraints, difficulty scaling, and valid compositions.
 */

import { BotTeamGenerator } from '../bot-generator';
import { UNIT_TEMPLATES } from '../../../game/units/unit.data';
import { UNIT_ROLES } from '../../../game/constants/game.constants';
import { TeamSetup } from '../../../core/types';

describe('BotTeamGenerator', () => {
  let generator: BotTeamGenerator;

  beforeEach(() => {
    generator = new BotTeamGenerator();
  });

  describe('generateTeam', () => {
    it('should generate a valid team at difficulty 1', () => {
      const team = generator.generateTeam({
        difficulty: 1,
        stage: 1,
        seed: 12345,
      });

      expect(team.units).toBeDefined();
      expect(team.positions).toBeDefined();
      expect(team.units.length).toBeGreaterThan(0);
      expect(team.units.length).toBeLessThanOrEqual(10);
      expect(team.units.length).toBe(team.positions.length);
    });

    it('should generate a valid team at difficulty 5', () => {
      const team = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 54321,
      });

      expect(team.units).toBeDefined();
      expect(team.positions).toBeDefined();
      expect(team.units.length).toBeGreaterThan(0);
      expect(team.units.length).toBe(team.positions.length);
    });

    it('should generate a valid team at difficulty 10', () => {
      const team = generator.generateTeam({
        difficulty: 10,
        stage: 9,
        seed: 99999,
      });

      expect(team.units).toBeDefined();
      expect(team.positions).toBeDefined();
      expect(team.units.length).toBeGreaterThan(0);
      expect(team.units.length).toBe(team.positions.length);
    });

    it('should respect budget constraints', () => {
      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        const team = generator.generateTeam({
          difficulty,
          stage: 1,
          seed: difficulty * 1000,
        });

        const totalCost = team.units.reduce((sum, u) => {
          const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
          return sum + (template?.cost || 0);
        }, 0);

        // Budget should be: 10 + (difficulty - 1) * (20 / 9)
        const expectedBudget = Math.round(10 + (difficulty - 1) * (20 / 9));

        expect(totalCost).toBeLessThanOrEqual(expectedBudget);
      }
    });

    it('should generate deterministic teams with same seed', () => {
      const team1 = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      const team2 = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      expect(team1.units).toEqual(team2.units);
      expect(team1.positions).toEqual(team2.positions);
    });

    it('should generate different teams with different seeds', () => {
      // Generate multiple teams with different seeds to verify variation
      const teams: TeamSetup[] = [];
      for (let i = 0; i < 5; i++) {
        teams.push(
          generator.generateTeam({
            difficulty: 5,
            stage: 3,
            seed: 10000 + i * 1000,
          }),
        );
      }

      // At least some teams should be different (with very high probability)
      let hasDifference = false;
      for (let i = 0; i < teams.length - 1; i++) {
        const unitsDifferent =
          teams[i].units.length !== teams[i + 1].units.length ||
          !teams[i].units.every((u, j) => u.unitId === teams[i + 1].units[j]?.unitId);

        if (unitsDifferent) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });

    it('should ensure all units are valid', () => {
      const team = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      for (const unit of team.units) {
        const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
        expect(template).toBeDefined();
        expect(unit.tier).toBeGreaterThanOrEqual(1);
        expect(unit.tier).toBeLessThanOrEqual(3);
      }
    });

    it('should place units in enemy deployment zone', () => {
      const team = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      for (const pos of team.positions) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(8);
        expect(pos.y).toBeGreaterThanOrEqual(8);
        expect(pos.y).toBeLessThan(10);
      }
    });

    it('should include at least one tank', () => {
      const team = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      const hasTank = team.units.some((u) => {
        const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
        return template?.role === UNIT_ROLES.TANK;
      });

      expect(hasTank).toBe(true);
    });

    it('should scale unit count with difficulty', () => {
      const counts: number[] = [];

      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        const team = generator.generateTeam({
          difficulty,
          stage: 1,
          seed: difficulty * 1000,
        });
        counts.push(team.units.length);
      }

      // Unit count should generally increase with difficulty
      // (not strictly monotonic due to randomness, but trend should be upward)
      const avgLowDifficulty = (counts[0] + counts[1] + counts[2]) / 3;
      const avgHighDifficulty = (counts[7] + counts[8] + counts[9]) / 3;

      expect(avgHighDifficulty).toBeGreaterThanOrEqual(avgLowDifficulty);
    });

    it('should have diverse role composition', () => {
      const team = generator.generateTeam({
        difficulty: 5,
        stage: 3,
        seed: 12345,
      });

      const roles = new Set<string>();
      for (const unit of team.units) {
        const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
        if (template) {
          roles.add(template.role);
        }
      }

      // Should have at least 2 different roles
      expect(roles.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle difficulty 0 (clamped to 1)', () => {
      const team = generator.generateTeam({
        difficulty: 0,
        stage: 1,
        seed: 12345,
      });

      expect(team.units.length).toBeGreaterThan(0);
      expect(team.positions.length).toBe(team.units.length);
    });

    it('should handle difficulty > 10 (clamped to 10)', () => {
      const team = generator.generateTeam({
        difficulty: 15,
        stage: 1,
        seed: 12345,
      });

      expect(team.units.length).toBeGreaterThan(0);
      expect(team.positions.length).toBe(team.units.length);
    });

    it('should handle stage 1', () => {
      const team = generator.generateTeam({
        difficulty: 1,
        stage: 1,
        seed: 12345,
      });

      expect(team.units.length).toBeGreaterThan(0);
    });

    it('should handle stage 9', () => {
      const team = generator.generateTeam({
        difficulty: 10,
        stage: 9,
        seed: 12345,
      });

      expect(team.units.length).toBeGreaterThan(0);
    });
  });
});
