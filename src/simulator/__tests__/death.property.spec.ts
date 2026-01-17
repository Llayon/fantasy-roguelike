/**
 * Property-Based Tests for Death Handling
 *
 * Tests correctness properties for death handling:
 * - Property 2: Dead Units Never Act - dead units never appear as actors in action events
 *
 * **Feature: simulator-refactor, Property 2: Dead Units Never Act**
 * **Validates: Requirements 3.3, 6.1**
 *
 * @module simulator/__tests__/death.property.spec
 */

import * as fc from 'fast-check';
import { simulateBattle } from '../simulator';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { BattleEvent } from '../../core/types/events';
import { Position } from '../../core/types/grid.types';
import { UnitId, getAllUnitIds } from '../../game/units/unit.data';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grid dimensions */
const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;

/** Player deployment rows (0-1) */
const PLAYER_ROWS = [0, 1];

/** Enemy deployment rows (8-9) */
const ENEMY_ROWS = [8, 9];

/**
 * Event types that represent unit actions.
 * These are events where a unit is actively doing something.
 */
const ACTION_EVENT_TYPES = [
  'attack',
  'move',
  'ability_used',
  'turn_start',
  'turn_end',
] as const;

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
function arbitraryUniquePositions(
  count: number,
  rows: number[],
): fc.Arbitrary<Position[]> {
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
 * Extract the actor ID from an event if it has one.
 * Different event types store the actor ID in different fields.
 *
 * @param event - Battle event
 * @returns Actor ID or undefined if event has no actor
 */
function getEventActorId(event: BattleEvent): string | undefined {
  // Check for actorId field (most common)
  if ('actorId' in event && typeof event.actorId === 'string') {
    return event.actorId;
  }
  // Check for attackerId field (attack events)
  if ('attackerId' in event && typeof event.attackerId === 'string') {
    return event.attackerId;
  }
  // Check for unitId field (some mechanic events)
  if ('unitId' in event && typeof event.unitId === 'string') {
    return event.unitId;
  }
  return undefined;
}

/**
 * Check if an event represents a unit action.
 * Action events are events where a unit is actively doing something.
 *
 * @param event - Battle event
 * @returns True if event is an action event
 */
function isActionEvent(event: BattleEvent): boolean {
  return ACTION_EVENT_TYPES.includes(event.type as typeof ACTION_EVENT_TYPES[number]);
}

/**
 * Find all unit_died events and extract the dead unit IDs with their timestamps.
 *
 * @param events - All battle events
 * @returns Map of unit ID to death timestamp
 */
function findDeathTimestamps(events: readonly BattleEvent[]): Map<string, number> {
  const deathTimestamps = new Map<string, number>();

  for (const event of events) {
    if (event.type === 'unit_died' && 'targetId' in event) {
      const targetId = event.targetId as string;
      // Only record the first death (in case of duplicate events)
      if (!deathTimestamps.has(targetId)) {
        deathTimestamps.set(targetId, event.timestamp);
      }
    }
  }

  return deathTimestamps;
}

/**
 * Find all action events where a dead unit appears as the actor after their death.
 *
 * @param events - All battle events
 * @param deathTimestamps - Map of unit ID to death timestamp
 * @returns Array of violating events with details
 */
function findDeadUnitActions(
  events: readonly BattleEvent[],
  deathTimestamps: Map<string, number>,
): Array<{ event: BattleEvent; unitId: string; deathTimestamp: number }> {
  const violations: Array<{ event: BattleEvent; unitId: string; deathTimestamp: number }> = [];

  for (const event of events) {
    // Skip non-action events
    if (!isActionEvent(event)) continue;

    const actorId = getEventActorId(event);
    if (!actorId) continue;

    // Check if this actor died before this event
    const deathTimestamp = deathTimestamps.get(actorId);
    if (deathTimestamp !== undefined && event.timestamp > deathTimestamp) {
      violations.push({
        event,
        unitId: actorId,
        deathTimestamp,
      });
    }
  }

  return violations;
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Death Handling Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 2: Dead Units Never Act**
   * **Validates: Requirements 3.3, 6.1**
   *
   * For any battle state, if a unit has `alive === false`, that unit SHALL NOT
   * appear as the actor in any subsequent action event (attack, move, ability).
   */
  describe('Property 2: Dead Units Never Act', () => {
    it('dead units never appear as actors in action events after death', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all death timestamps
            const deathTimestamps = findDeathTimestamps(result.events);

            // If no units died, property trivially holds
            if (deathTimestamps.size === 0) {
              return true;
            }

            // Find any violations
            const violations = findDeadUnitActions(result.events, deathTimestamps);

            // Property holds if no violations found
            if (violations.length > 0) {
              const firstViolation = violations[0];
              console.error(
                `Dead unit acted: Unit '${firstViolation.unitId}' died at timestamp ${firstViolation.deathTimestamp} ` +
                `but performed action '${firstViolation.event.type}' at timestamp ${firstViolation.event.timestamp}`,
              );
              expect(violations.length).toBe(0);
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('dead units are not in turn queue after death', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Get final state
            const finalState = result.finalState;

            // Find all dead units in final state
            const deadUnitIds = finalState.units
              .filter((u) => !u.alive)
              .map((u) => u.instanceId);

            // Check that no dead unit is in the turn queue
            for (const deadId of deadUnitIds) {
              if (finalState.turnQueue.includes(deadId)) {
                console.error(
                  `Dead unit '${deadId}' found in turn queue at end of battle`,
                );
                expect(finalState.turnQueue).not.toContain(deadId);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('turn_start events only occur for alive units', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all death timestamps
            const deathTimestamps = findDeathTimestamps(result.events);

            // Find all turn_start events
            const turnStartEvents = result.events.filter((e) => e.type === 'turn_start');

            // Check each turn_start event
            for (const event of turnStartEvents) {
              const actorId = getEventActorId(event);
              if (!actorId) continue;

              // Check if this unit died before this turn_start
              const deathTimestamp = deathTimestamps.get(actorId);
              if (deathTimestamp !== undefined && event.timestamp > deathTimestamp) {
                console.error(
                  `Dead unit '${actorId}' had turn_start at timestamp ${event.timestamp} ` +
                  `but died at timestamp ${deathTimestamp}`,
                );
                expect(event.timestamp).toBeLessThanOrEqual(deathTimestamp);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('attack events only have alive attackers', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all death timestamps
            const deathTimestamps = findDeathTimestamps(result.events);

            // Find all attack events
            const attackEvents = result.events.filter((e) => e.type === 'attack');

            // Check each attack event
            for (const event of attackEvents) {
              const attackerId = getEventActorId(event);
              if (!attackerId) continue;

              // Check if attacker died before this attack
              const deathTimestamp = deathTimestamps.get(attackerId);
              if (deathTimestamp !== undefined && event.timestamp > deathTimestamp) {
                console.error(
                  `Dead unit '${attackerId}' attacked at timestamp ${event.timestamp} ` +
                  `but died at timestamp ${deathTimestamp}`,
                );
                expect(event.timestamp).toBeLessThanOrEqual(deathTimestamp);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('final state has consistent alive status with HP', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check all units in final state
            for (const unit of result.finalState.units) {
              // alive should be consistent with HP
              const shouldBeAlive = unit.currentHp > 0;

              if (unit.alive !== shouldBeAlive) {
                console.error(
                  `Unit '${unit.instanceId}' has inconsistent state: ` +
                  `alive=${unit.alive} but currentHp=${unit.currentHp}`,
                );
                expect(unit.alive).toBe(shouldBeAlive);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('unit_died events have valid target IDs', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Get all unit IDs from initial state
            const allUnitIds = new Set(result.finalState.units.map((u) => u.instanceId));

            // Find all unit_died events
            const deathEvents = result.events.filter((e) => e.type === 'unit_died');

            // Check each death event has a valid target
            for (const event of deathEvents) {
              if ('targetId' in event) {
                const targetId = event.targetId as string;
                if (!allUnitIds.has(targetId)) {
                  console.error(
                    `unit_died event has invalid targetId: '${targetId}'`,
                  );
                  expect(allUnitIds.has(targetId)).toBe(true);
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

    it('each unit dies at most once', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Count deaths per unit
            const deathCounts = new Map<string, number>();

            for (const event of result.events) {
              if (event.type === 'unit_died' && 'targetId' in event) {
                const targetId = event.targetId as string;
                const count = deathCounts.get(targetId) ?? 0;
                deathCounts.set(targetId, count + 1);
              }
            }

            // Check no unit died more than once
            for (const [unitId, count] of deathCounts) {
              if (count > 1) {
                console.error(
                  `Unit '${unitId}' died ${count} times (should be at most 1)`,
                );
                expect(count).toBeLessThanOrEqual(1);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('determinism: same inputs produce same death sequence', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the same battle twice
            const result1 = simulateBattle(playerTeam, enemyTeam, seed);
            const result2 = simulateBattle(playerTeam, enemyTeam, seed);

            // Extract death sequences
            const deaths1 = result1.events
              .filter((e) => e.type === 'unit_died')
              .map((e) => ('targetId' in e ? e.targetId : null));
            const deaths2 = result2.events
              .filter((e) => e.type === 'unit_died')
              .map((e) => ('targetId' in e ? e.targetId : null));

            // Death sequences should be identical
            if (deaths1.length !== deaths2.length) {
              console.error(
                `Different death counts: ${deaths1.length} vs ${deaths2.length}`,
              );
              expect(deaths1.length).toBe(deaths2.length);
              return false;
            }

            for (let i = 0; i < deaths1.length; i++) {
              if (deaths1[i] !== deaths2[i]) {
                console.error(
                  `Death sequence mismatch at index ${i}: '${deaths1[i]}' vs '${deaths2[i]}'`,
                );
                expect(deaths1[i]).toBe(deaths2[i]);
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
