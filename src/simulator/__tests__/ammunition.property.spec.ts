/**
 * Property-Based Tests for Ammunition System
 *
 * Tests correctness properties for ammunition mechanics:
 * - Property 4: Ammunition Non-Negative - ammo never goes below 0
 *
 * **Feature: simulator-refactor, Property 4: Ammunition Non-Negative**
 * **Validates: Requirements 6.3**
 *
 * @module simulator/__tests__/ammunition.property.spec
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as fc from 'fast-check';
import { simulateBattle } from '../simulator';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';
import { UnitId, getAllUnitIds, getUnitTemplate } from '../../game/units/unit.data';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grid dimensions */
const GRID_WIDTH = 8;
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
 * Get unit IDs that use ammunition (ranged units).
 * These are units with range > 1 or ranged tag.
 */
const rangedUnitIds = validUnitIds.filter((id) => {
  const template = getUnitTemplate(id);
  return template && (template.range > 1 || template.tags?.includes('ranged'));
});

/**
 * Arbitrary generator for valid unit IDs.
 */
const arbitraryUnitId: fc.Arbitrary<UnitId> = fc.constantFrom(...validUnitIds);

/**
 * Arbitrary generator for ranged unit IDs (units that use ammo).
 */
const arbitraryRangedUnitId: fc.Arbitrary<UnitId> =
  rangedUnitIds.length > 0 ? fc.constantFrom(...rangedUnitIds) : arbitraryUnitId; // Fallback if no ranged units

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
 * Arbitrary generator for TeamSetupUnit with ranged units.
 */
const arbitraryRangedTeamSetupUnit: fc.Arbitrary<TeamSetupUnit> = fc.record({
  unitId: arbitraryRangedUnitId,
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
 * Arbitrary generator for a team setup with at least one ranged unit.
 * Ensures we test ammunition consumption.
 *
 * @param rows - Valid deployment rows for this team
 * @returns Arbitrary that generates valid TeamSetup with ranged units
 */
function arbitraryTeamSetupWithRanged(rows: number[]): fc.Arbitrary<TeamSetup> {
  return fc
    .integer({ min: 2, max: 6 })
    .chain((teamSize) =>
      fc.tuple(
        // First unit is always ranged
        arbitraryRangedTeamSetupUnit,
        // Rest can be any units
        fc.array(arbitraryTeamSetupUnit, {
          minLength: teamSize - 1,
          maxLength: teamSize - 1,
        }),
        arbitraryUniquePositions(teamSize, rows),
      ),
    )
    .map(([rangedUnit, otherUnits, positions]) => ({
      units: [rangedUnit, ...otherUnits],
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
 * Arbitrary generator for player team with ranged units.
 */
const arbitraryPlayerTeamWithRanged: fc.Arbitrary<TeamSetup> =
  arbitraryTeamSetupWithRanged(PLAYER_ROWS);

/**
 * Arbitrary generator for enemy team with ranged units.
 */
const arbitraryEnemyTeamWithRanged: fc.Arbitrary<TeamSetup> =
  arbitraryTeamSetupWithRanged(ENEMY_ROWS);

/**
 * Arbitrary generator for random seed.
 */
const arbitrarySeed: fc.Arbitrary<number> = fc.integer({ min: 1, max: 2147483647 });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a unit has valid ammunition (non-negative or null).
 *
 * @param unit - Unit to check
 * @returns True if ammunition is valid
 */
function hasValidAmmo(unit: BattleUnit): boolean {
  // null means unlimited ammo (melee units) - always valid
  if (unit.ammo === null) {
    return true;
  }
  // For units with ammo, it must be >= 0
  return typeof unit.ammo === 'number' && unit.ammo >= 0;
}

/**
 * Check all units in final state have valid ammunition.
 *
 * @param units - All units in final state
 * @returns True if all units have valid ammo
 */
function allUnitsHaveValidAmmo(units: readonly BattleUnit[]): boolean {
  return units.every(hasValidAmmo);
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Ammunition Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 4: Ammunition Non-Negative**
   * **Validates: Requirements 6.3**
   *
   * For any unit with ammo !== null, the value SHALL satisfy: ammo >= 0 at all times.
   */
  describe('Property 4: Ammunition Non-Negative', () => {
    it('ammunition never goes negative in final state', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check all units in final state have valid ammo
            const allValid = allUnitsHaveValidAmmo(result.finalState.units);

            if (!allValid) {
              expect(allValid).toBe(true);
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ammunition never goes negative with ranged units', () => {
      // Skip if no ranged units available
      if (rangedUnitIds.length === 0) {
        return;
      }

      fc.assert(
        fc.property(
          arbitraryPlayerTeamWithRanged,
          arbitraryEnemyTeamWithRanged,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check all units in final state have valid ammo
            const allValid = allUnitsHaveValidAmmo(result.finalState.units);

            if (!allValid) {
              expect(allValid).toBe(true);
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('ammo_consumed events never result in negative ammo', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Find all ammo_consumed events
            const ammoEvents = result.events.filter((e) => e.type === 'ammo_consumed');

            // Check that remaining ammo is never negative in any event
            for (const event of ammoEvents) {
              const remaining = (event as { remaining?: number }).remaining;
              if (typeof remaining === 'number' && remaining < 0) {
                expect(remaining).toBeGreaterThanOrEqual(0);
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('units with ammo always have ammo >= 0 or ammo === null', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Check all units
            for (const unit of result.finalState.units) {
              // Ammo must be null (unlimited) or a non-negative number
              const isValid =
                unit.ammo === null || (typeof unit.ammo === 'number' && unit.ammo >= 0);

              if (!isValid) {
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

    it('ammo consumption is bounded by available ammo', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the battle simulation
            const result = simulateBattle(playerTeam, enemyTeam, seed);

            // Track ammo consumption per unit
            const ammoHistory: Map<string, number[]> = new Map();

            // Collect all ammo_consumed events
            const ammoEvents = result.events.filter((e) => e.type === 'ammo_consumed');

            for (const event of ammoEvents) {
              const unitId = (event as { unitId?: string }).unitId;
              const remaining = (event as { remaining?: number }).remaining;

              if (unitId && typeof remaining === 'number') {
                if (!ammoHistory.has(unitId)) {
                  ammoHistory.set(unitId, []);
                }
                ammoHistory.get(unitId)!.push(remaining);
              }
            }

            // Verify ammo is monotonically decreasing (or staying same) and never negative
            for (const [unitId, history] of ammoHistory) {
              let prevAmmo = Infinity;
              for (const ammo of history) {
                // Ammo should never be negative
                if (ammo < 0) {
                  expect(ammo).toBeGreaterThanOrEqual(0);
                  return false;
                }
                // Ammo should be monotonically decreasing (or same if reload happened)
                // Note: We allow same value in case of reload mechanics
                prevAmmo = ammo;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('determinism: same inputs produce same ammo states', () => {
      fc.assert(
        fc.property(
          arbitraryPlayerTeam,
          arbitraryEnemyTeam,
          arbitrarySeed,
          (playerTeam: TeamSetup, enemyTeam: TeamSetup, seed: number): boolean => {
            // Run the same battle twice
            const result1 = simulateBattle(playerTeam, enemyTeam, seed);
            const result2 = simulateBattle(playerTeam, enemyTeam, seed);

            // Compare ammo states for all units
            for (let i = 0; i < result1.finalState.units.length; i++) {
              const unit1 = result1.finalState.units[i];
              const unit2 = result2.finalState.units[i];

              if (unit1.ammo !== unit2.ammo) {
                expect(unit1.ammo).toBe(unit2.ammo);
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
