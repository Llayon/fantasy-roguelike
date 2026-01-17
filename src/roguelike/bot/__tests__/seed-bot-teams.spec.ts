/**
 * Tests for bot team seed script.
 * Verifies that the seed script generates valid bot teams for all stages and difficulties.
 */

import { BotTeamGenerator } from '../bot-generator';
import { UNIT_TEMPLATES } from '../../../game/units/unit.data';
import { TeamSetupUnit } from '../../../core/types';

describe('Bot Team Seeding', () => {
  let generator: BotTeamGenerator;

  beforeEach(() => {
    generator = new BotTeamGenerator();
  });

  describe('seed generation for all stages and difficulties', () => {
    it('should generate valid teams for all 9 stages and 10 difficulties', () => {
      const allTeams: Array<{
        stage: number;
        difficulty: number;
        composition: number;
        unitCount: number;
        totalCost: number;
      }> = [];

      for (let stage = 1; stage <= 9; stage++) {
        for (let difficulty = 1; difficulty <= 10; difficulty++) {
          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const totalCost = teamSetup.units.reduce((sum: number, u: TeamSetupUnit) => {
              const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            allTeams.push({
              stage,
              difficulty,
              composition,
              unitCount: teamSetup.units.length,
              totalCost,
            });

            // Verify team is valid
            expect(teamSetup.units.length).toBeGreaterThan(0);
            expect(teamSetup.positions.length).toBe(teamSetup.units.length);

            // Verify budget constraint
            const budget = Math.round(10 + (difficulty - 1) * (20 / 9));
            expect(totalCost).toBeLessThanOrEqual(budget);

            // Verify all units are valid
            for (const unit of teamSetup.units) {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              expect(template).toBeDefined();
            }

            // Verify positions are in enemy deployment zone
            for (const pos of teamSetup.positions) {
              expect(pos.x).toBeGreaterThanOrEqual(0);
              expect(pos.x).toBeLessThan(8);
              expect(pos.y).toBeGreaterThanOrEqual(8);
              expect(pos.y).toBeLessThan(10);
            }
          }
        }
      }

      // Verify we generated the expected number of teams
      expect(allTeams.length).toBe(9 * 10 * 5); // 450 teams total

      // Verify coverage statistics
      const teamsByStage: Record<number, number> = {};
      const teamsByDifficulty: Record<number, number> = {};

      for (const team of allTeams) {
        teamsByStage[team.stage] = (teamsByStage[team.stage] || 0) + 1;
        teamsByDifficulty[team.difficulty] = (teamsByDifficulty[team.difficulty] || 0) + 1;
      }

      // Each stage should have 50 teams (10 difficulties * 5 compositions)
      for (let stage = 1; stage <= 9; stage++) {
        expect(teamsByStage[stage]).toBe(50);
      }

      // Each difficulty should have 45 teams (9 stages * 5 compositions)
      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        expect(teamsByDifficulty[difficulty]).toBe(45);
      }
    });

    it('should ensure minimum 5 unique compositions per stage', () => {
      for (let stage = 1; stage <= 9; stage++) {
        const compositions = new Set<string>();

        for (let difficulty = 1; difficulty <= 10; difficulty++) {
          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Create a unique key for this composition
            const compositionKey = teamSetup.units
              .map((u: TeamSetupUnit) => u.unitId)
              .sort()
              .join(',');

            compositions.add(compositionKey);
          }
        }

        // Should have at least 5 unique compositions per stage
        expect(compositions.size).toBeGreaterThanOrEqual(5);
      }
    });

    it('should respect budget constraints for all teams', () => {
      for (let stage = 1; stage <= 9; stage++) {
        for (let difficulty = 1; difficulty <= 10; difficulty++) {
          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const totalCost = teamSetup.units.reduce((sum: number, u: TeamSetupUnit) => {
              const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            const budget = Math.round(10 + (difficulty - 1) * (20 / 9));

            expect(totalCost).toBeLessThanOrEqual(budget);
          }
        }
      }
    });

    it('should scale difficulty appropriately', () => {
      const avgCostByDifficulty: Record<number, number> = {};

      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        let totalCost = 0;
        let count = 0;

        for (let stage = 1; stage <= 9; stage++) {
          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const cost = teamSetup.units.reduce((sum: number, u: TeamSetupUnit) => {
              const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            totalCost += cost;
            count++;
          }
        }

        avgCostByDifficulty[difficulty] = Math.round(totalCost / count);
      }

      // Average cost should increase with difficulty
      for (let d = 1; d < 10; d++) {
        expect(avgCostByDifficulty[d + 1]).toBeGreaterThanOrEqual(avgCostByDifficulty[d] - 1); // Allow 1 point variance
      }
    });

    it('should generate diverse team compositions', () => {
      const allCompositions = new Set<string>();

      for (let stage = 1; stage <= 9; stage++) {
        for (let difficulty = 1; difficulty <= 10; difficulty++) {
          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const compositionKey = teamSetup.units
              .map((u: TeamSetupUnit) => u.unitId)
              .sort()
              .join(',');

            allCompositions.add(compositionKey);
          }
        }
      }

      // Should have significant diversity across all 450 teams
      // With 15 units and various combinations, we should have many unique compositions
      expect(allCompositions.size).toBeGreaterThan(50);
    });
  });

  describe('seed script statistics', () => {
    it('should provide accurate statistics', () => {
      let totalGenerated = 0;
      let totalValidated = 0;
      const teamsByStage: Record<number, number> = {};
      const teamsByDifficulty: Record<number, number> = {};

      for (let stage = 1; stage <= 9; stage++) {
        teamsByStage[stage] = 0;

        for (let difficulty = 1; difficulty <= 10; difficulty++) {
          teamsByDifficulty[difficulty] = (teamsByDifficulty[difficulty] || 0) + 0;

          for (let composition = 0; composition < 5; composition++) {
            const seed = stage * 1000 + difficulty * 100 + composition;

            const teamSetup = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const totalCost = teamSetup.units.reduce((sum: number, u: TeamSetupUnit) => {
              const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            const budget = Math.round(10 + (difficulty - 1) * (20 / 9));

            totalGenerated++;

            if (totalCost <= budget) {
              totalValidated++;
              teamsByStage[stage]++;
              teamsByDifficulty[difficulty]++;
            }
          }
        }
      }

      // All teams should be valid
      expect(totalValidated).toBe(totalGenerated);
      expect(totalValidated).toBe(450);

      // Each stage should have 50 teams
      for (let stage = 1; stage <= 9; stage++) {
        expect(teamsByStage[stage]).toBe(50);
      }

      // Each difficulty should have 45 teams
      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        expect(teamsByDifficulty[difficulty]).toBe(45);
      }
    });
  });
});
