/**
 * Property-Based Tests for Turn Start Phase
 *
 * Tests correctness properties for turn_start phase:
 * - Property 9: Riposte Charge Reset - riposte charges reset at turn start
 *
 * **Feature: simulator-refactor, Property 9: Riposte Charge Reset**
 * **Validates: Requirements 2.3, 3.4**
 *
 * @module simulator/phases/__tests__/turn-start.property.spec
 */

import * as fc from 'fast-check';
import { handleTurnStart, DEFAULT_RIPOSTE_CHARGES } from '../turn-start';
import { BattleState, Phase } from '../../../core/types';
import { BattleUnit, FacingDirection, TeamType, UnitFaction } from '../../../core/types/battle-unit';
import { Position } from '../../../core/types/grid.types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grid dimensions */
const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;

/** Valid facing directions */
const VALID_FACINGS: FacingDirection[] = ['N', 'S', 'E', 'W'];

/** Valid teams */
const VALID_TEAMS: TeamType[] = ['player', 'enemy'];

/** Valid factions */
const VALID_FACTIONS: UnitFaction[] = ['human', 'undead'];

// =============================================================================
// ARBITRARIES (GENERATORS)
// =============================================================================

/**
 * Arbitrary generator for valid position on grid.
 */
const arbitraryPosition: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: GRID_WIDTH - 1 }),
  y: fc.integer({ min: 0, max: GRID_HEIGHT - 1 }),
});

/**
 * Arbitrary generator for facing direction.
 */
const arbitraryFacing: fc.Arbitrary<FacingDirection> = fc.constantFrom(...VALID_FACINGS);

/**
 * Arbitrary generator for team type.
 */
const arbitraryTeam: fc.Arbitrary<TeamType> = fc.constantFrom(...VALID_TEAMS);

/**
 * Arbitrary generator for faction.
 */
const arbitraryFaction: fc.Arbitrary<UnitFaction> = fc.constantFrom(...VALID_FACTIONS);

/**
 * Arbitrary generator for riposte charges.
 * Can be any non-negative integer, including 0 (depleted) and values above default.
 */
const arbitraryRiposteCharges: fc.Arbitrary<number> = fc.integer({ min: 0, max: 10 });

/**
 * Arbitrary generator for a valid BattleUnit.
 * Generates units with various riposte charge states.
 */
const arbitraryBattleUnit: fc.Arbitrary<BattleUnit> = fc.record({
  id: fc.constantFrom('knight', 'archer', 'mage', 'rogue', 'priest'),
  instanceId: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `unit_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
  name: fc.constantFrom('Knight', 'Archer', 'Mage', 'Rogue', 'Priest'),
  team: arbitraryTeam,
  stats: fc.record({
    hp: fc.integer({ min: 50, max: 200 }),
    atk: fc.integer({ min: 5, max: 50 }),
    atkCount: fc.integer({ min: 1, max: 3 }),
    armor: fc.integer({ min: 0, max: 30 }),
    speed: fc.integer({ min: 1, max: 5 }),
    initiative: fc.integer({ min: 1, max: 20 }),
    dodge: fc.integer({ min: 0, max: 50 }),
  }),
  range: fc.integer({ min: 1, max: 5 }),
  role: fc.constantFrom('tank', 'melee_dps', 'ranged_dps', 'mage', 'support'),
  cost: fc.integer({ min: 3, max: 8 }),
  abilities: fc.array(fc.constantFrom('shield_wall', 'riposte', 'heal', 'fireball'), { minLength: 0, maxLength: 3 }),
  position: arbitraryPosition,
  currentHp: fc.integer({ min: 1, max: 200 }),
  maxHp: fc.integer({ min: 50, max: 200 }),
  alive: fc.constant(true), // Only test alive units for turn start
  facing: arbitraryFacing,
  resolve: fc.integer({ min: 0, max: 100 }),
  maxResolve: fc.integer({ min: 50, max: 100 }),
  isRouting: fc.boolean(),
  engaged: fc.boolean(),
  engagedBy: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
  riposteCharges: arbitraryRiposteCharges,
  ammo: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 20 })),
  maxAmmo: fc.oneof(fc.constant(null), fc.integer({ min: 5, max: 20 })),
  momentum: fc.integer({ min: 0, max: 5 }),
  armorShred: fc.integer({ min: 0, max: 20 }),
  inPhalanx: fc.boolean(),
  tags: fc.array(fc.constantFrom('infantry', 'cavalry', 'ranged', 'mage'), { minLength: 0, maxLength: 3 }),
  faction: arbitraryFaction,
}).filter((unit) => unit.currentHp <= unit.maxHp && unit.resolve <= unit.maxResolve);

/**
 * Create a valid BattleState from a unit.
 */
function createBattleState(unit: BattleUnit): BattleState {
  const occupiedPositions = new Set<string>();
  occupiedPositions.add(`${unit.position.x},${unit.position.y}`);

  return {
    battleId: 'test_battle',
    units: [unit],
    round: 1,
    turn: 1,
    currentPhase: 'turn_start' as Phase,
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: [unit.instanceId],
    currentTurnIndex: 0,
  };
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Turn Start Phase Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 9: Riposte Charge Reset**
   * **Validates: Requirements 2.3, 3.4**
   *
   * For any unit at the start of their turn, `riposteCharges` SHALL be reset
   * to the configured maximum value (DEFAULT_RIPOSTE_CHARGES).
   */
  describe('Property 9: Riposte Charge Reset', () => {
    it('riposte charges are reset to default at turn start for any alive unit', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          (unit: BattleUnit): boolean => {
            // Ensure unit is alive (turn start only applies to alive units)
            const aliveUnit = { ...unit, alive: true, currentHp: Math.max(1, unit.currentHp) };
            const state = createBattleState(aliveUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, aliveUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === aliveUnit.instanceId,
            );

            // Property 9: Riposte charges must be reset to default
            const chargesReset = updatedUnit?.riposteCharges === DEFAULT_RIPOSTE_CHARGES;

            expect(updatedUnit).toBeDefined();
            expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);

            return chargesReset;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte charges reset regardless of initial charge value', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          fc.integer({ min: 0, max: 100 }), // Test with wide range of initial charges
          (unit: BattleUnit, initialCharges: number): boolean => {
            // Set specific initial charges
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: initialCharges,
            };
            const state = createBattleState(testUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === testUnit.instanceId,
            );

            // Property 9: Charges must be reset to default regardless of initial value
            const chargesReset = updatedUnit?.riposteCharges === DEFAULT_RIPOSTE_CHARGES;

            expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);

            return chargesReset;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte charges reset for units with zero charges (depleted)', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          (unit: BattleUnit): boolean => {
            // Specifically test with depleted charges
            const depletedUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: 0,
            };
            const state = createBattleState(depletedUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, depletedUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === depletedUnit.instanceId,
            );

            // Property 9: Depleted charges must be restored
            const chargesRestored = updatedUnit?.riposteCharges === DEFAULT_RIPOSTE_CHARGES;

            expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);

            return chargesRestored;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte reset emits event when charges change', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          fc.integer({ min: 0, max: DEFAULT_RIPOSTE_CHARGES - 1 }), // Charges below default
          (unit: BattleUnit, initialCharges: number): boolean => {
            // Set charges below default to ensure event is emitted
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: initialCharges,
            };
            const state = createBattleState(testUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Check for riposte_reset event
            const riposteResetEvent = result.events.find((e) => e.type === 'riposte_reset');

            // Event should be emitted when charges change
            const eventEmitted = riposteResetEvent !== undefined;

            expect(riposteResetEvent).toBeDefined();
            expect(riposteResetEvent?.type).toBe('riposte_reset');

            return eventEmitted;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte reset does not emit event when already at max charges', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          (unit: BattleUnit): boolean => {
            // Set charges to default (no change needed)
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: DEFAULT_RIPOSTE_CHARGES,
            };
            const state = createBattleState(testUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Check for riposte_reset event
            const riposteResetEvent = result.events.find((e) => e.type === 'riposte_reset');

            // No event should be emitted when charges don't change
            const noEventEmitted = riposteResetEvent === undefined;

            expect(riposteResetEvent).toBeUndefined();

            return noEventEmitted;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte charges reset preserves other unit properties', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          (unit: BattleUnit): boolean => {
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: 0, // Depleted
            };
            const state = createBattleState(testUnit);

            // Capture original values
            const originalFacing = testUnit.facing;
            const originalAmmo = testUnit.ammo;
            const originalMomentum = testUnit.momentum;
            const originalArmorShred = testUnit.armorShred;
            const originalPosition = { ...testUnit.position };

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === testUnit.instanceId,
            );

            // Property 9 + Property 8: Riposte reset should not affect other properties
            const facingPreserved = updatedUnit?.facing === originalFacing;
            const ammoPreserved = updatedUnit?.ammo === originalAmmo;
            const momentumPreserved = updatedUnit?.momentum === originalMomentum;
            const armorShredPreserved = updatedUnit?.armorShred === originalArmorShred;
            const positionPreserved =
              updatedUnit?.position.x === originalPosition.x &&
              updatedUnit?.position.y === originalPosition.y;

            expect(updatedUnit?.facing).toBe(originalFacing);
            expect(updatedUnit?.ammo).toBe(originalAmmo);
            expect(updatedUnit?.momentum).toBe(originalMomentum);
            expect(updatedUnit?.armorShred).toBe(originalArmorShred);
            expect(updatedUnit?.position).toEqual(originalPosition);

            return (
              facingPreserved &&
              ammoPreserved &&
              momentumPreserved &&
              armorShredPreserved &&
              positionPreserved
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte charges reset works for both human and undead factions', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          arbitraryFaction,
          (unit: BattleUnit, faction: UnitFaction): boolean => {
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: 0,
              faction,
            };
            const state = createBattleState(testUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === testUnit.instanceId,
            );

            // Property 9: Riposte reset applies to all factions
            const chargesReset = updatedUnit?.riposteCharges === DEFAULT_RIPOSTE_CHARGES;

            expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);

            return chargesReset;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('riposte charges reset works for both player and enemy teams', () => {
      fc.assert(
        fc.property(
          arbitraryBattleUnit,
          arbitraryTeam,
          (unit: BattleUnit, team: TeamType): boolean => {
            const testUnit: BattleUnit = {
              ...unit,
              alive: true,
              currentHp: Math.max(1, unit.currentHp),
              riposteCharges: 0,
              team,
            };
            const state = createBattleState(testUnit);

            // Execute turn start phase
            const result = handleTurnStart(state, testUnit.instanceId);

            // Find the updated unit
            const updatedUnit = result.state.units.find(
              (u) => u.instanceId === testUnit.instanceId,
            );

            // Property 9: Riposte reset applies to all teams
            const chargesReset = updatedUnit?.riposteCharges === DEFAULT_RIPOSTE_CHARGES;

            expect(updatedUnit?.riposteCharges).toBe(DEFAULT_RIPOSTE_CHARGES);

            return chargesReset;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
