/**
 * Property-Based Tests for Battle Simulator
 *
 * Tests correctness properties for battle simulation:
 * - Property 6: Battle Termination - battle always terminates within MAX_ROUNDS
 *
 * **Feature: simulator-refactor, Property 6: Battle Termination**
 * **Validates: Requirements 6.5**
 *
 * @module simulator/__tests__/simulator.property.spec
 */

import * as fc from 'fast-check';
import { simulateBattle } from '../simulator';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { Position } from '../../core/types/grid.types';
import { UnitId, getAllUnitIds, getUnitTemplate } from '../../game/units/unit.data';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum rounds before battle ends (from simulator) */
const MAX_ROUNDS = 100;

/** Grid dimensions */
const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;

/** Player deployment rows (0-1) */
const PLAYER_ROWS = [0, 1];

/** Enemy deployment rows (8-9) */
const ENEMY_ROWS = [8, 9];

// =============================================================================
// ARBITRARIES (GENERATORS)
// =============================================================================

/**
 * Get all valid unit IDs for team generation.
 */
const validUnitIds = getAllUnitIds();

/**
 * Arbitrary generator for valid unit IDs.
 */
const arbitraryUnitId: fc.Arbitrary<UnitId> = fc.constantFrom(...validUnitIds);

/**
 * Arbitrary generator for unit tier (1-3).
 */
const arbitraryTier: fc.Arbitrary<number> = fc.integer({ min: 1, max: 3 });

/**
 * Arbitrary generator for TeamSetupUnit.
 */
const arbitraryTeamSetupUnit: fc.Arbitrary<TeamSetupUnit> = fc.record({
  unitId: arbitraryUnitId,
  tier: arbitraryTier,
});

/**
 * Arbitrary generator for player position (rows 0-1).
 */
const arbitraryPlayerPosition: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: GRID_WIDTH - 1 }),
  y: fc.constantFrom(...PLAYER_ROWS),
});

/**
 * Arbitrary generator for enemy position (rows 8-9).
 */
const arbitraryEnemyPosition: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: GRID_WIDTH - 1 }),
  y: fc.constantFrom(...ENEMY_ROWS),
});

/**
 * Generate unique positions for a team.
 * Ensures no two units occupy the same position.
 *
 * @param count - Number of positions to generate
 * @param rows - Valid rows for this team
 * @returns Arbitrary that generates unique positions
 */
function arbitraryUniquePositions(count: number, rows: number[]): fc.Arbitrary<Position[]> {
  return fc
    .array(
      fc.record({
        x: fc.integer({ min: 0, max: GRID_WIDTH - 1 }),
        y: fc.constantFrom(...rows),
      }),
      { minLength: count, maxLength: count },
    )
    .map((positions) => {
      // Ensure uniqueness by using a Set
      const seen = new Set<string>();
      const unique: Position[] = [];

      for (const pos of positions) {
        const key = `${pos.x},${pos.y}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(pos);
        }
      }

      // If we don't have enough unique positions, generate more deterministically
      while (unique.length < count) {
        for (let x = 0; x < GRID_WIDTH && unique.length < count; x++) {
          for (const y of rows) {
            const key = `${x},${y}`;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push({ x, y });
              if (unique.length >= count) break;
            }
          }
        }
      }

      return unique;
    });
}

/**
 * Arbitrary generator for a valid team setup.
 * Generates 1-6 units with unique positions.
 *
 * @param rows - Valid deployment rows for this team
 * @returns Arbitrary that generates valid TeamSetup
 */
function arbitraryTeamSetup(rows: number[]): fc.Arbitrary<TeamSetup> {
  return fc
    .integer({ min: 1, max: 6 })
    .chain((teamSize) =>
      fc.tuple(
        fc.array(arbitraryTeamSetupUnit, {
          minLength: teamSize,
          maxLength: teamSize,
        }),
        arbitraryUniquePositions(teamSize, rows),
      ),
    )
    .map(([units, positions]) => ({
      units,
      positions,
    }));
}

/**
 * Arbitrary generator for player team setup.
 */
const arbitraryPlayerTeam: fc.Arbitrary<TeamSetup> = arbitraryTeamSetup(PLAYER_ROWS);

/**
 * Arbitrary generator for enemy team setup.
 */
const arbitraryEnemyTeam: fc.Arbitrary<TeamSetup> = arbitraryTeamSetup(ENEMY_ROWS);

/**
 * Arbitrary generator for random seed.
 */
const arbitrarySeed: fc.Arbitrary<number> = fc.integer({ min: 1, max: 2147483647 });

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Battle Simulator Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 6: Battle Termination**
   * **Validates: Requirements 6.5**
   *
   * For any battle simulation, the battle SHALL terminate within MAX_ROUNDS (100)
   * with a definitive winner or draw.
   */
  describe('Property 6: Battle Termination', () => {
    it('battle always terminates within MAX_ROUNDS', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Property 6: Battle must terminate
            const hasResult =
              result.result === 'win' || result.result === 'loss' || result.result === 'draw';
            const withinMaxRounds = result.rounds <= MAX_ROUNDS;

            expect(hasResult).toBe(true);
            expect(withinMaxRounds).toBe(true);
            expect(result.rounds).toBeGreaterThanOrEqual(1);
            expect(result.rounds).toBeLessThanOrEqual(MAX_ROUNDS);

            return hasResult && withinMaxRounds;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('battle result is consistent with survivor counts', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check result consistency
            if (result.result === 'win') {
              // Player wins: all enemies dead, at least one player alive
              expect(result.enemySurvivors.length).toBe(0);
              expect(result.playerSurvivors.length).toBeGreaterThan(0);
              expect(result.winner).toBe('player');
              return result.enemySurvivors.length === 0 && result.playerSurvivors.length > 0;
            } else if (result.result === 'loss') {
              // Player loses: all players dead, at least one enemy alive
              expect(result.playerSurvivors.length).toBe(0);
              expect(result.enemySurvivors.length).toBeGreaterThan(0);
              expect(result.winner).toBe('enemy');
              return result.playerSurvivors.length === 0 && result.enemySurvivors.length > 0;
            } else {
              // Draw: both teams have survivors (max rounds reached)
              expect(result.winner).toBeNull();
              expect(result.rounds).toBe(MAX_ROUNDS);
              return result.winner === null;
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('battle events are generated', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Battle should always generate events
            const hasEvents = result.events.length > 0;

            // Should have at least battle_start and battle_end events
            const hasBattleStart = result.events.some((e) => e.type === 'battle_start');
            const hasBattleEnd = result.events.some((e) => e.type === 'battle_end');

            expect(hasEvents).toBe(true);
            expect(hasBattleStart).toBe(true);
            expect(hasBattleEnd).toBe(true);

            return hasEvents && hasBattleStart && hasBattleEnd;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('same seed produces identical results (determinism)', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the same battle twice with the same seed
            const result1 = simulateBattle(playerTeam, enemyTeam, seed);
            const result2 = simulateBattle(playerTeam, enemyTeam, seed);

            // Results must be identical
            const sameResult = result1.result === result2.result;
            const sameWinner = result1.winner === result2.winner;
            const sameRounds = result1.rounds === result2.rounds;
            const samePlayerSurvivors =
              result1.playerSurvivors.length === result2.playerSurvivors.length &&
              result1.playerSurvivors.every((id, i) => id === result2.playerSurvivors[i]);
            const sameEnemySurvivors =
              result1.enemySurvivors.length === result2.enemySurvivors.length &&
              result1.enemySurvivors.every((id, i) => id === result2.enemySurvivors[i]);
            const sameEventCount = result1.events.length === result2.events.length;

            expect(sameResult).toBe(true);
            expect(sameWinner).toBe(true);
            expect(sameRounds).toBe(true);
            expect(samePlayerSurvivors).toBe(true);
            expect(sameEnemySurvivors).toBe(true);
            expect(sameEventCount).toBe(true);

            return (
              sameResult &&
              sameWinner &&
              sameRounds &&
              samePlayerSurvivors &&
              sameEnemySurvivors &&
              sameEventCount
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('final state reflects battle outcome', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Final state should exist
            expect(result.finalState).toBeDefined();
            expect(result.finalState.units).toBeDefined();

            // Count alive units in final state
            const alivePlayerUnits = result.finalState.units.filter(
              (u) => u.team === 'player' && u.alive,
            );
            const aliveEnemyUnits = result.finalState.units.filter(
              (u) => u.team === 'enemy' && u.alive,
            );

            // Survivor counts should match
            const playerSurvivorsMatch = alivePlayerUnits.length === result.playerSurvivors.length;
            const enemySurvivorsMatch = aliveEnemyUnits.length === result.enemySurvivors.length;

            expect(playerSurvivorsMatch).toBe(true);
            expect(enemySurvivorsMatch).toBe(true);

            return playerSurvivorsMatch && enemySurvivorsMatch;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('battle terminates even with maximum team sizes', () => {
      // Test with larger teams to ensure termination
      const largeTeamArbitrary = fc
        .integer({ min: 4, max: 8 })
        .chain((teamSize) =>
          fc.tuple(
            fc.array(arbitraryTeamSetupUnit, {
              minLength: teamSize,
              maxLength: teamSize,
            }),
            arbitraryUniquePositions(teamSize, PLAYER_ROWS),
          ),
        )
        .map(([units, positions]) => ({
          units,
          positions,
        }));

      const largeEnemyArbitrary = fc
        .integer({ min: 4, max: 8 })
        .chain((teamSize) =>
          fc.tuple(
            fc.array(arbitraryTeamSetupUnit, {
              minLength: teamSize,
              maxLength: teamSize,
            }),
            arbitraryUniquePositions(teamSize, ENEMY_ROWS),
          ),
        )
        .map(([units, positions]) => ({
          units,
          positions,
        }));

      fc.assert(
        fc.property(
          largeTeamArbitrary,
          largeEnemyArbitrary,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Property 6: Battle must terminate within MAX_ROUNDS
            const terminated =
              result.result === 'win' || result.result === 'loss' || result.result === 'draw';
            const withinLimit = result.rounds <= MAX_ROUNDS;

            expect(terminated).toBe(true);
            expect(withinLimit).toBe(true);

            return terminated && withinLimit;
          },
        ),
        { numRuns: 50 }, // Fewer runs for larger teams
      );
    });
  });
});
