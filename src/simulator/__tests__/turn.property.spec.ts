/**
 * Property-Based Tests for Turn Execution
 *
 * Tests correctness properties for turn execution:
 * - Property 1: Phase Order Invariant - events are emitted in strict phase order
 *
 * **Feature: simulator-refactor, Property 1: Phase Order Invariant**
 * **Validates: Requirements 1.3, 2.2**
 *
 * @module simulator/__tests__/turn.property.spec
 */

import * as fc from 'fast-check';
import { simulateBattle } from '../simulator';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { Phase } from '../../core/types/events';
import { Position } from '../../core/types/grid.types';
import { UnitId, getAllUnitIds } from '../../game/units/unit.data';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grid dimensions */
const GRID_WIDTH = 8;

/** Player deployment rows (0-1) */
const PLAYER_ROWS = [0, 1];

/** Enemy deployment rows (8-9) */
const ENEMY_ROWS = [8, 9];

/**
 * Phase order for validation.
 * Events within a turn must follow this order.
 */
const EXPECTED_PHASE_ORDER: readonly Phase[] = PHASE_ORDER;

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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the index of a phase in the expected order.
 * Returns -1 if phase is not found.
 *
 * @param phase - Phase to find
 * @returns Index in EXPECTED_PHASE_ORDER or -1
 */
function getPhaseIndex(phase: Phase): number {
  return EXPECTED_PHASE_ORDER.indexOf(phase);
}

/**
 * Represents a unit's turn with its events.
 */
interface UnitTurn {
  turnNumber: number;
  actorId: string;
  events: BattleEvent[];
}

/**
 * Group events by unit turn.
 * A unit turn is identified by turn_start and turn_end events for the same actor.
 * Returns an array of unit turns with their events.
 *
 * @param events - All battle events
 * @returns Array of unit turns with their events
 */
function groupEventsByUnitTurn(events: readonly BattleEvent[]): UnitTurn[] {
  const unitTurns: UnitTurn[] = [];
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let currentTurn: UnitTurn | null = null;

  for (const event of sortedEvents) {
    if (event.type === 'turn_start' && 'actorId' in event) {
      // Start a new unit turn
      currentTurn = {
        turnNumber: event.turn,
        actorId: (event as { actorId: string }).actorId,
        events: [event],
      };
    } else if (event.type === 'turn_end' && currentTurn) {
      // End the current unit turn
      currentTurn.events.push(event);
      unitTurns.push(currentTurn);
      currentTurn = null;
    } else if (currentTurn) {
      // Add event to current unit turn
      currentTurn.events.push(event);
    }
    // Events outside of turn_start/turn_end pairs (like battle_start, round_start)
    // are not part of a unit's turn and are skipped
  }

  return unitTurns;
}

/**
 * Check if events within a turn follow the correct phase order.
 * Returns true if all events are in valid phase order.
 *
 * @param events - Events within a single turn
 * @returns True if phase order is valid
 */
function isValidPhaseOrder(events: BattleEvent[]): boolean {
  if (events.length === 0) return true;

  // Sort events by timestamp to ensure we check them in order
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let lastPhaseIndex = -1;

  for (const event of sortedEvents) {
    const currentPhaseIndex = getPhaseIndex(event.phase);

    // Skip events with unknown phases (shouldn't happen, but be defensive)
    if (currentPhaseIndex === -1) continue;

    // Phase index should be >= last phase index (can stay same or increase)
    // Within a turn, we can have multiple events in the same phase,
    // but we should never go backwards
    if (currentPhaseIndex < lastPhaseIndex) {
      return false;
    }

    lastPhaseIndex = currentPhaseIndex;
  }

  return true;
}

/**
 * Find the first phase order violation in events.
 * Returns null if no violation found.
 *
 * @param events - Events within a single turn
 * @returns Description of violation or null
 */
// Unused - kept for future reference
// function findPhaseOrderViolation(events: BattleEvent[]): string | null {
//   if (events.length === 0) return null;
//
//   const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
//
//   let lastPhaseIndex = -1;
//   let lastPhase: Phase | null = null;
//
//   for (const event of sortedEvents) {
//     const currentPhaseIndex = getPhaseIndex(event.phase);
//
//     if (currentPhaseIndex === -1) continue;
//
//     if (currentPhaseIndex < lastPhaseIndex) {
//       return `Phase order violation: ${lastPhase} (index ${lastPhaseIndex}) followed by ${event.phase} (index ${currentPhaseIndex}) in event type '${event.type}'`;
//     }
//
//     lastPhaseIndex = currentPhaseIndex;
//     lastPhase = event.phase;
//   }
//
//   return null;
// }

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Turn Execution Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 1: Phase Order Invariant**
   * **Validates: Requirements 1.3, 2.2**
   *
   * For any battle simulation, events SHALL be emitted in strict phase order:
   * turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end,
   * with no phase appearing out of sequence within a turn.
   */
  describe('Property 1: Phase Order Invariant', () => {
    it('events within each unit turn follow strict phase order', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Group events by unit turn (turn_start to turn_end for each unit)
            const unitTurns = groupEventsByUnitTurn(result.events);

            // Check phase order for each unit's turn
            for (const unitTurn of unitTurns) {
              const isValid = isValidPhaseOrder(unitTurn.events);

              if (!isValid) {
                // const _violation = findPhaseOrderViolation(unitTurn.events);
                expect(isValid).toBe(true);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('turn_start events always come before turn_end events within a unit turn', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Group events by unit turn
            const unitTurns = groupEventsByUnitTurn(result.events);

            for (const unitTurn of unitTurns) {
              const sortedEvents = [...unitTurn.events].sort((a, b) => a.timestamp - b.timestamp);

              const turnStartIndex = sortedEvents.findIndex((e) => e.type === 'turn_start');
              const turnEndIndex = sortedEvents.findIndex((e) => e.type === 'turn_end');

              // Both should exist in a complete unit turn
              if (turnStartIndex === -1 || turnEndIndex === -1) {
                expect(turnStartIndex).not.toBe(-1);
                expect(turnEndIndex).not.toBe(-1);
                return false;
              }

              // turn_start must come before turn_end
              if (turnStartIndex >= turnEndIndex) {
                expect(turnStartIndex).toBeLessThan(turnEndIndex);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('attack events only occur in attack phase', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all attack events
            const attackEvents = result.events.filter((e) => e.type === 'attack');

            // All attack events should be in attack phase
            for (const event of attackEvents) {
              if (event.phase !== 'attack') {
                expect(event.phase).toBe('attack');
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('movement events only occur in movement phase', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all move events
            const moveEvents = result.events.filter((e) => e.type === 'move');

            // All move events should be in movement phase
            for (const event of moveEvents) {
              if (event.phase !== 'movement') {
                expect(event.phase).toBe('movement');
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('phase transitions are monotonically increasing within a unit turn', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Group events by unit turn
            const unitTurns = groupEventsByUnitTurn(result.events);

            for (const unitTurn of unitTurns) {
              const sortedEvents = [...unitTurn.events].sort((a, b) => a.timestamp - b.timestamp);

              let lastPhaseIndex = -1;

              for (const event of sortedEvents) {
                const currentPhaseIndex = getPhaseIndex(event.phase);

                // Skip unknown phases
                if (currentPhaseIndex === -1) continue;

                // Phase index should never decrease within a unit's turn
                if (currentPhaseIndex < lastPhaseIndex) {
                  expect(currentPhaseIndex).toBeGreaterThanOrEqual(lastPhaseIndex);
                  return false;
                }

                lastPhaseIndex = currentPhaseIndex;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('all events have valid phase values', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check all events have valid phases
            for (const event of result.events) {
              const phaseIndex = getPhaseIndex(event.phase);

              // Phase should be in the expected order list
              if (phaseIndex === -1) {
                expect(EXPECTED_PHASE_ORDER).toContain(event.phase);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('determinism: same inputs produce same phase order', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the same battle twice
            const result1 = simulateBattle(playerTeam, enemyTeam, seed);
            const result2 = simulateBattle(playerTeam, enemyTeam, seed);

            // Extract phase sequences
            const phases1 = result1.events.map((e) => e.phase);
            const phases2 = result2.events.map((e) => e.phase);

            // Phase sequences should be identical
            if (phases1.length !== phases2.length) {
              expect(phases1.length).toBe(phases2.length);
              return false;
            }

            for (let i = 0; i < phases1.length; i++) {
              if (phases1[i] !== phases2[i]) {
                expect(phases1[i]).toBe(phases2[i]);
                return false;
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
