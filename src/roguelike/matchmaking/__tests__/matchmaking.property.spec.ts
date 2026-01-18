/**
 * Property-Based Tests for Matchmaking System
 *
 * Tests correctness properties for matchmaking mechanics:
 * - Property 12: Matchmaking Always Returns Opponent - matchmaking always returns valid opponent
 *
 * **Feature: simulator-refactor, Property 12: Matchmaking Always Returns Opponent**
 * **Validates: Requirements 5.4, 8.1**
 *
 * @module roguelike/matchmaking/__tests__/matchmaking.property.spec
 */

import * as fc from 'fast-check';
import {
  MatchmakingService,
  BotOpponent,
  SnapshotOpponent,
  MatchmakingResult,
} from '../matchmaking.service';
import { TeamSetup } from '../../../core/types';
import { UnitId, getUnitTemplate } from '../../../game/units/unit.data';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Valid run stages (1-9) */
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Valid win counts (0-8, since 9 wins ends the run) */
const VALID_WIN_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Grid dimensions */
const GRID_WIDTH = 8;

// =============================================================================
// ARBITRARIES (GENERATORS)
// =============================================================================

/**
 * Get all valid unit IDs for team generation.
 */
// const validUnitIds = getAllUnitIds();

/**
 * Arbitrary generator for valid run stage (1-9).
 */
const arbitraryStage: fc.Arbitrary<number> = fc.constantFrom(...VALID_STAGES);

/**
 * Arbitrary generator for valid win count (0-8).
 */
const arbitraryWinCount: fc.Arbitrary<number> = fc.constantFrom(...VALID_WIN_COUNTS);

/**
 * Arbitrary generator for random seed.
 */
const arbitrarySeed: fc.Arbitrary<number> = fc.integer({ min: 1, max: 2147483647 });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a result is a valid bot opponent.
 *
 * @param result - Matchmaking result to check
 * @returns True if result is a valid bot opponent
 */
function isValidBotOpponent(result: MatchmakingResult): boolean {
  if (!('botId' in result)) {
    return false;
  }

  const bot = result as BotOpponent;

  // Check botId is a string
  if (typeof bot.botId !== 'string' || bot.botId.length === 0) {
    return false;
  }

  // Check difficulty is in valid range
  if (typeof bot.difficulty !== 'number' || bot.difficulty < 1 || bot.difficulty > 10) {
    return false;
  }

  // Check team is valid
  return isValidTeamSetup(bot.team);
}

/**
 * Check if a result is a valid snapshot opponent.
 *
 * @param result - Matchmaking result to check
 * @returns True if result is a valid snapshot opponent
 */
function isValidSnapshotOpponent(result: MatchmakingResult): boolean {
  if ('botId' in result) {
    return false;
  }

  const snapshot = result as SnapshotOpponent;

  // Check snapshotId is a string
  if (typeof snapshot.snapshotId !== 'string' || snapshot.snapshotId.length === 0) {
    return false;
  }

  // Check wins is a non-negative number
  if (typeof snapshot.wins !== 'number' || snapshot.wins < 0) {
    return false;
  }

  // Check team is valid
  return isValidTeamSetup(snapshot.team);
}

/**
 * Check if a team setup is valid.
 *
 * @param team - Team setup to check
 * @returns True if team setup is valid
 */
function isValidTeamSetup(team: TeamSetup): boolean {
  // Check units array exists and is not empty
  if (!Array.isArray(team.units) || team.units.length === 0) {
    return false;
  }

  // Check positions array exists and matches unit count
  if (!Array.isArray(team.positions) || team.positions.length !== team.units.length) {
    return false;
  }

  // Check each unit has required properties
  for (const unit of team.units) {
    if (typeof unit.unitId !== 'string' || unit.unitId.length === 0) {
      return false;
    }
    if (typeof unit.tier !== 'number' || unit.tier < 1 || unit.tier > 3) {
      return false;
    }
  }

  // Check each position is valid
  for (const pos of team.positions) {
    if (typeof pos.x !== 'number' || pos.x < 0 || pos.x >= GRID_WIDTH) {
      return false;
    }
    if (typeof pos.y !== 'number' || pos.y < 8 || pos.y >= 10) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a matchmaking result is valid (either bot or snapshot).
 *
 * @param result - Matchmaking result to check
 * @returns True if result is valid
 */
function isValidMatchmakingResult(result: MatchmakingResult): boolean {
  if (!result) {
    return false;
  }

  // Check if it's a bot opponent
  if ('botId' in result) {
    return isValidBotOpponent(result);
  }

  // Check if it's a snapshot opponent
  if ('snapshotId' in result) {
    return isValidSnapshotOpponent(result);
  }

  return false;
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Matchmaking Property-Based Tests', () => {
  let service: MatchmakingService;

  beforeEach(() => {
    service = new MatchmakingService();
  });

  /**
   * **Feature: simulator-refactor, Property 12: Matchmaking Always Returns Opponent**
   * **Validates: Requirements 5.4, 8.1**
   *
   * For any matchmaking request (any stage 1-9, any wins 0-8),
   * the system SHALL return either a valid player snapshot or a generated bot team.
   */
  describe('Property 12: Matchmaking Always Returns Opponent', () => {
    it('always returns valid opponent for any stage and wins', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            // Call matchmaking
            const opponent = service.findOpponent(stage, wins, seed);

            // Check opponent is defined
            if (!opponent) {
              expect(opponent).toBeDefined();
              return false;
            }

            // Check opponent is valid
            if (!isValidMatchmakingResult(opponent)) {
              expect(isValidMatchmakingResult(opponent)).toBe(true);
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('always returns opponent with valid team structure', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            const opponent = service.findOpponent(stage, wins, seed);

            // Check team exists
            if (!opponent.team) {
              expect(opponent.team).toBeDefined();
              return false;
            }

            // Check units array
            if (!Array.isArray(opponent.team.units) || opponent.team.units.length === 0) {
              expect(Array.isArray(opponent.team.units) && opponent.team.units.length > 0).toBe(
                true,
              );
              return false;
            }

            // Check positions array
            if (!Array.isArray(opponent.team.positions)) {
              expect(Array.isArray(opponent.team.positions)).toBe(true);
              return false;
            }

            // Check positions match units count
            if (opponent.team.positions.length !== opponent.team.units.length) {
              expect(opponent.team.positions.length).toBe(opponent.team.units.length);
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('always returns opponent with valid unit IDs', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            const opponent = service.findOpponent(stage, wins, seed);

            // Check each unit has valid ID
            for (const unit of opponent.team.units) {
              if (typeof unit.unitId !== 'string' || unit.unitId.length === 0) {
                expect(typeof unit.unitId === 'string' && unit.unitId.length > 0).toBe(true);
                return false;
              }

              // Check unit ID exists in game data
              const template = getUnitTemplate(unit.unitId as UnitId);
              if (!template) {
                expect(template).toBeDefined();
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('always returns opponent with valid positions', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            const opponent = service.findOpponent(stage, wins, seed);

            // Check each position is valid
            for (const pos of opponent.team.positions) {
              // Check x coordinate
              if (typeof pos.x !== 'number' || pos.x < 0 || pos.x >= GRID_WIDTH) {
                expect(pos.x >= 0 && pos.x < GRID_WIDTH).toBe(true);
                return false;
              }

              // Check y coordinate (enemy deployment zone: 8-9)
              if (typeof pos.y !== 'number' || pos.y < 8 || pos.y >= 10) {
                expect(pos.y >= 8 && pos.y < 10).toBe(true);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('always returns opponent with valid difficulty (if bot)', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            const opponent = service.findOpponent(stage, wins, seed);

            // If it's a bot opponent, check difficulty
            if ('botId' in opponent) {
              const bot = opponent as BotOpponent;

              if (typeof bot.difficulty !== 'number' || bot.difficulty < 1 || bot.difficulty > 10) {
                expect(bot.difficulty >= 1 && bot.difficulty <= 10).toBe(true);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('difficulty increases with player wins', () => {
      fc.assert(
        fc.property(arbitraryStage, arbitrarySeed, (stage: number, seed: number): boolean => {
          // Get opponents at different win counts
          const opponent0 = service.findOpponent(stage, 0, seed) as BotOpponent;
          const opponent4 = service.findOpponent(stage, 4, seed) as BotOpponent;
          const opponent8 = service.findOpponent(stage, 8, seed) as BotOpponent;

          // If all are bots, difficulty should be non-decreasing
          if ('botId' in opponent0 && 'botId' in opponent4 && 'botId' in opponent8) {
            if (opponent4.difficulty < opponent0.difficulty) {
              expect(opponent4.difficulty).toBeGreaterThanOrEqual(opponent0.difficulty);
              return false;
            }

            if (opponent8.difficulty < opponent4.difficulty) {
              expect(opponent8.difficulty).toBeGreaterThanOrEqual(opponent4.difficulty);
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('determinism: same inputs produce same opponent', () => {
      fc.assert(
        fc.property(
          arbitraryStage,
          arbitraryWinCount,
          arbitrarySeed,
          (stage: number, wins: number, seed: number): boolean => {
            // Call matchmaking twice with same inputs
            const opponent1 = service.findOpponent(stage, wins, seed);
            const opponent2 = service.findOpponent(stage, wins, seed);

            // Both should be defined
            if (!opponent1 || !opponent2) {
              expect(opponent1).toBeDefined();
              expect(opponent2).toBeDefined();
              return false;
            }

            // Both should be same type (bot or snapshot)
            const isBoth1Bot = 'botId' in opponent1;
            const isBoth2Bot = 'botId' in opponent2;

            if (isBoth1Bot !== isBoth2Bot) {
              expect(isBoth1Bot).toBe(isBoth2Bot);
              return false;
            }

            // If both are bots, they should have same properties
            if (isBoth1Bot && isBoth2Bot) {
              const bot1 = opponent1 as BotOpponent;
              const bot2 = opponent2 as BotOpponent;

              if (bot1.difficulty !== bot2.difficulty) {
                expect(bot1.difficulty).toBe(bot2.difficulty);
                return false;
              }

              if (bot1.team.units.length !== bot2.team.units.length) {
                expect(bot1.team.units.length).toBe(bot2.team.units.length);
                return false;
              }

              // Check unit IDs match
              for (let i = 0; i < bot1.team.units.length; i++) {
                if (bot1.team.units[i].unitId !== bot2.team.units[i].unitId) {
                  expect(bot1.team.units[i].unitId).toBe(bot2.team.units[i].unitId);
                  return false;
                }
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
