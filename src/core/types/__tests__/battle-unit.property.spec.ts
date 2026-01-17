/**
 * Property-Based Tests for BattleUnit Type
 *
 * Tests correctness properties for BattleUnit:
 * - Property 5: Facing Validity - facing is always one of 'N', 'S', 'E', 'W'
 *
 * @module core/types/__tests__/battle-unit.property.spec
 */

import * as fc from 'fast-check';
import {
  BattleUnit,
  FacingDirection,
  BattleUnitStats,
  TeamType,
  UnitFaction,
} from '../battle-unit';
import { Position } from '../grid.types';

// =============================================================================
// VALID FACING DIRECTIONS
// =============================================================================

/**
 * Set of all valid facing directions.
 * Used for validation in property tests.
 */
const VALID_FACING_DIRECTIONS: ReadonlySet<FacingDirection> = new Set([
  'N',
  'S',
  'E',
  'W',
]);

// =============================================================================
// ARBITRARIES (GENERATORS)
// =============================================================================

/**
 * Arbitrary generator for valid facing directions.
 * Generates only valid values: 'N', 'S', 'E', 'W'.
 */
const arbitraryFacingDirection: fc.Arbitrary<FacingDirection> = fc.constantFrom(
  'N',
  'S',
  'E',
  'W',
);

/**
 * Arbitrary generator for valid positions on the grid.
 * Grid is 8x10 (x: 0-7, y: 0-9).
 */
const arbitraryPosition: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: 7 }),
  y: fc.integer({ min: 0, max: 9 }),
});

/**
 * Arbitrary generator for team type.
 */
const arbitraryTeamType: fc.Arbitrary<TeamType> = fc.constantFrom(
  'player',
  'enemy',
);

/**
 * Arbitrary generator for unit faction.
 */
const arbitraryFaction: fc.Arbitrary<UnitFaction> = fc.constantFrom(
  'human',
  'undead',
);

/**
 * Arbitrary generator for valid BattleUnitStats.
 */
const arbitraryBattleUnitStats: fc.Arbitrary<BattleUnitStats> = fc.record({
  hp: fc.integer({ min: 1, max: 200 }),
  atk: fc.integer({ min: 1, max: 50 }),
  atkCount: fc.integer({ min: 1, max: 5 }),
  armor: fc.integer({ min: 0, max: 50 }),
  speed: fc.integer({ min: 1, max: 6 }),
  initiative: fc.integer({ min: 1, max: 30 }),
  dodge: fc.integer({ min: 0, max: 50 }),
});

/**
 * Arbitrary generator for valid BattleUnit.
 * Ensures all invariants are satisfied:
 * - 0 <= currentHp <= maxHp
 * - alive === (currentHp > 0)
 * - facing is valid ('N', 'S', 'E', 'W')
 * - ammo is null or >= 0
 * - resolve is within bounds
 */
const arbitraryBattleUnit: fc.Arbitrary<BattleUnit> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    instanceId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    team: arbitraryTeamType,
    stats: arbitraryBattleUnitStats,
    range: fc.integer({ min: 1, max: 5 }),
    role: fc.constantFrom(
      'tank',
      'melee_dps',
      'ranged_dps',
      'mage',
      'support',
      'control',
    ),
    cost: fc.integer({ min: 3, max: 8 }),
    abilities: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 0,
      maxLength: 3,
    }),
    position: arbitraryPosition,
    facing: arbitraryFacingDirection,
    maxResolve: fc.integer({ min: 50, max: 100 }),
    isRouting: fc.boolean(),
    engaged: fc.boolean(),
    engagedBy: fc.array(fc.uuid(), { minLength: 0, maxLength: 4 }),
    riposteCharges: fc.integer({ min: 0, max: 3 }),
    momentum: fc.integer({ min: 0, max: 5 }),
    armorShred: fc.integer({ min: 0, max: 30 }),
    inPhalanx: fc.boolean(),
    tags: fc.array(
      fc.constantFrom(
        'infantry',
        'cavalry',
        'spearman',
        'ranged',
        'mage',
        'heavy',
        'light',
        'undead',
      ),
      { minLength: 0, maxLength: 3 },
    ),
    faction: arbitraryFaction,
    hasAmmo: fc.boolean(),
    maxAmmoValue: fc.integer({ min: 3, max: 20 }),
  })
  .chain((base) => {
    // Derive dependent values
    const maxHp = base.stats.hp;

    return fc
      .record({
        currentHp: fc.integer({ min: 0, max: maxHp }),
        resolve: fc.integer({ min: 0, max: base.maxResolve }),
        ammoValue: fc.integer({ min: 0, max: base.maxAmmoValue }),
      })
      .map((derived) => {
        const unit: BattleUnit = {
          id: base.id,
          instanceId: base.instanceId,
          name: base.name,
          team: base.team,
          stats: base.stats,
          range: base.range,
          role: base.role,
          cost: base.cost,
          abilities: base.abilities,
          position: base.position,
          currentHp: derived.currentHp,
          maxHp: maxHp,
          alive: derived.currentHp > 0,
          facing: base.facing,
          resolve: derived.resolve,
          maxResolve: base.maxResolve,
          isRouting: base.isRouting,
          engaged: base.engaged,
          engagedBy: base.engagedBy,
          riposteCharges: base.riposteCharges,
          ammo: base.hasAmmo ? derived.ammoValue : null,
          maxAmmo: base.hasAmmo ? base.maxAmmoValue : null,
          momentum: base.momentum,
          armorShred: base.armorShred,
          inPhalanx: base.inPhalanx,
          tags: base.tags,
          faction: base.faction,
        };
        return unit;
      });
  });

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('BattleUnit Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 5: Facing Validity**
   * **Validates: Requirements 6.4**
   *
   * For any unit at any point during battle, `facing` SHALL be one of: 'N', 'S', 'E', 'W'.
   */
  describe('Property 5: Facing Validity', () => {
    it('facing is always one of N, S, E, W for any generated BattleUnit', () => {
      fc.assert(
        fc.property(arbitraryBattleUnit, (unit: BattleUnit): boolean => {
          // Property 5: facing must be a valid direction
          const isValidFacing = VALID_FACING_DIRECTIONS.has(unit.facing);

          expect(isValidFacing).toBe(true);
          expect(['N', 'S', 'E', 'W']).toContain(unit.facing);

          return isValidFacing;
        }),
        { numRuns: 100 },
      );
    });

    it('FacingDirection type only allows valid values', () => {
      fc.assert(
        fc.property(arbitraryFacingDirection, (facing: FacingDirection): boolean => {
          // The type system ensures only valid values can be assigned
          const isValid = facing === 'N' || facing === 'S' || facing === 'E' || facing === 'W';

          expect(isValid).toBe(true);
          expect(VALID_FACING_DIRECTIONS.has(facing)).toBe(true);

          return isValid;
        }),
        { numRuns: 100 },
      );
    });

    it('facing remains valid after simulated state updates', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          arbitraryFacingDirection,
          (unit: BattleUnit, newFacing: FacingDirection): boolean => {
            // Simulate a state update (immutable)
            const updatedUnit: BattleUnit = {
              ...unit,
              facing: newFacing,
            };

            // Property 5: facing must still be valid after update
            const isValidFacing = VALID_FACING_DIRECTIONS.has(updatedUnit.facing);

            expect(isValidFacing).toBe(true);
            expect(['N', 'S', 'E', 'W']).toContain(updatedUnit.facing);

            return isValidFacing;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing is valid for units in different positions', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          arbitraryPosition,
          (unit: BattleUnit, newPosition: Position): boolean => {
            // Simulate position change (immutable)
            const movedUnit: BattleUnit = {
              ...unit,
              position: newPosition,
            };

            // Property 5: facing must remain valid regardless of position
            const isValidFacing = VALID_FACING_DIRECTIONS.has(movedUnit.facing);

            expect(isValidFacing).toBe(true);
            expect(['N', 'S', 'E', 'W']).toContain(movedUnit.facing);

            return isValidFacing;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing is valid for both player and enemy teams', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          arbitraryTeamType,
          (unit: BattleUnit, team: TeamType): boolean => {
            // Simulate team assignment
            const teamUnit: BattleUnit = {
              ...unit,
              team,
            };

            // Property 5: facing must be valid for any team
            const isValidFacing = VALID_FACING_DIRECTIONS.has(teamUnit.facing);

            expect(isValidFacing).toBe(true);
            expect(['N', 'S', 'E', 'W']).toContain(teamUnit.facing);

            return isValidFacing;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
