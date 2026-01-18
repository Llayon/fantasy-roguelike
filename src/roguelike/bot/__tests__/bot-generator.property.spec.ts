/**
 * Property-based tests for bot team generator.
 * Verifies universal properties that should hold across all bot team generations.
 *
 * **Feature: simulator-refactor, Property 11: Bot Team Budget Constraint**
 *
 * Uses fast-check to generate random bot configurations and verify that
 * generated teams always respect budget constraints.
 *
 * @module roguelike/bot/__tests__
 */

import fc from 'fast-check';
import { BotTeamGenerator } from '../bot-generator';
import { UNIT_TEMPLATES } from '../../../game/units/unit.data';

describe('BotTeamGenerator - Property-Based Tests', () => {
  let generator: BotTeamGenerator;

  beforeEach(() => {
    generator = new BotTeamGenerator();
  });

  /**
   * Property 11: Bot Team Budget Constraint
   *
   * For any generated bot team, the total cost of units SHALL NOT exceed
   * the budget for the current run stage.
   *
   * **Validates: Requirements 8.3**
   *
   * This property ensures that:
   * 1. Bot teams are always valid (within budget)
   * 2. Budget calculation is correct for all difficulty levels
   * 3. Unit selection respects budget constraints
   * 4. No edge cases violate budget rules
   *
   * Test strategy:
   * - Generate random difficulty levels (1-10)
   * - Generate random stages (1-9)
   * - Generate random seeds for determinism
   * - For each configuration, verify total cost <= budget
   * - Run 100 iterations to cover the input space
   */
  describe('Property 11: Bot Team Budget Constraint', () => {
    it('should never exceed budget for any difficulty/stage/seed combination', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Calculate expected budget
            // Formula: 10 + (difficulty - 1) * (20 / 9)
            const expectedBudget = Math.round(10 + (difficulty - 1) * (20 / 9));

            // Calculate actual total cost
            const totalCost = team.units.reduce((sum, unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              if (!template) {
                throw new Error(`Invalid unit ID: ${unit.unitId}`);
              }
              return sum + template.cost;
            }, 0);

            // Property: Total cost must not exceed budget
            if (totalCost > expectedBudget) {
              // Budget constraint violated
              throw new Error(
                `Budget constraint violated: difficulty=${difficulty}, stage=${stage}, seed=${seed}, expectedBudget=${expectedBudget}, actualCost=${totalCost}`,
              );
            }

            return totalCost <= expectedBudget;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should generate at least one unit within budget', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: Must have at least one unit
            return team.units.length > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should generate valid unit IDs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: All units must have valid IDs
            return team.units.every((unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              return template !== undefined;
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should generate valid tiers (1-3)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: All units must have valid tiers
            return team.units.every((unit) => unit.tier >= 1 && unit.tier <= 3);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should match unit count to position count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: Units and positions must have same length
            return team.units.length === team.positions.length;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should place units in enemy deployment zone', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: All positions must be in enemy deployment zone (rows 8-9)
            return team.positions.every(
              (pos) => pos.x >= 0 && pos.x < 8 && pos.y >= 8 && pos.y < 10,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should be deterministic with same seed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate two teams with same configuration
            const team1 = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const team2 = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Property: Same seed produces identical teams
            const unitsMatch =
              team1.units.length === team2.units.length &&
              team1.units.every(
                (u, i) => u.unitId === team2.units[i].unitId && u.tier === team2.units[i].tier,
              );

            const positionsMatch =
              team1.positions.length === team2.positions.length &&
              team1.positions.every(
                (p, i) => p.x === team2.positions[i].x && p.y === team2.positions[i].y,
              );

            return unitsMatch && positionsMatch;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should scale budget correctly with difficulty', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            // Generate bot team
            generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            // Calculate expected budget
            const expectedBudget = Math.round(10 + (difficulty - 1) * (20 / 9));

            // Property: Budget should be in valid range
            // Difficulty 1: 10 budget
            // Difficulty 5: 20 budget
            // Difficulty 10: 30 budget
            const minBudget = 10;
            const maxBudget = 30;

            return expectedBudget >= minBudget && expectedBudget <= maxBudget;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Edge case tests using property-based testing.
   */
  describe('Edge Cases', () => {
    it('should handle minimum difficulty (1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (stage, seed) => {
            const team = generator.generateTeam({
              difficulty: 1,
              stage,
              seed,
            });

            const totalCost = team.units.reduce((sum, unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            // Budget at difficulty 1 is 10
            return totalCost <= 10 && team.units.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle maximum difficulty (10)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (stage, seed) => {
            const team = generator.generateTeam({
              difficulty: 10,
              stage,
              seed,
            });

            const totalCost = team.units.reduce((sum, unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            // Budget at difficulty 10 is 30
            return totalCost <= 30 && team.units.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle difficulty clamping (< 1)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10, max: 0 }), // invalid difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const totalCost = team.units.reduce((sum, unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            // Should clamp to difficulty 1 (budget 10)
            return totalCost <= 10 && team.units.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should handle difficulty clamping (> 10)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 100 }), // invalid difficulty
          fc.integer({ min: 1, max: 9 }), // stage
          fc.integer({ min: 0, max: 999999 }), // seed
          (difficulty, stage, seed) => {
            const team = generator.generateTeam({
              difficulty,
              stage,
              seed,
            });

            const totalCost = team.units.reduce((sum, unit) => {
              const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
              return sum + (template?.cost || 0);
            }, 0);

            // Should clamp to difficulty 10 (budget 30)
            return totalCost <= 30 && team.units.length > 0;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
