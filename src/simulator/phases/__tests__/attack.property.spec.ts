/**
 * Property-Based Tests for Attack Phase
 *
 * Tests correctness properties for attack phase:
 * - Property 10: Facing Rotation on Attack - facing rotates toward target
 *
 * **Feature: simulator-refactor, Property 10: Facing Rotation on Attack**
 * **Validates: Requirements 2.5**
 *
 * @module simulator/phases/__tests__/attack.property.spec
 */

import * as fc from 'fast-check';
import { handleAttack, calculateFacingDirection } from '../attack';
import { BattleState, Phase } from '../../../core/types';
import { BattleUnit, FacingDirection, TeamType, UnitFaction } from '../../../core/types/battle-unit';
import { Position } from '../../../core/types/grid.types';
import { SeededRandom } from '../../../core/utils/random';

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
 * Arbitrary generator for a valid BattleUnit.
 */
function createArbitraryBattleUnit(
  team: TeamType,
  position: Position,
  instanceIdSuffix: string,
): fc.Arbitrary<BattleUnit> {
  return fc.record({
    id: fc.constantFrom('knight', 'archer', 'mage', 'rogue', 'priest'),
    instanceId: fc.constant(`${team}_unit_${instanceIdSuffix}`),
    name: fc.constantFrom('Knight', 'Archer', 'Mage', 'Rogue', 'Priest'),
    team: fc.constant(team),
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
    position: fc.constant(position),
    currentHp: fc.integer({ min: 1, max: 200 }),
    maxHp: fc.integer({ min: 50, max: 200 }),
    alive: fc.constant(true),
    facing: arbitraryFacing,
    resolve: fc.integer({ min: 1, max: 100 }),
    maxResolve: fc.integer({ min: 50, max: 100 }),
    isRouting: fc.constant(false),
    engaged: fc.boolean(),
    engagedBy: fc.constant([]),
    riposteCharges: fc.integer({ min: 0, max: 3 }),
    ammo: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 20 })),
    maxAmmo: fc.oneof(fc.constant(null), fc.integer({ min: 5, max: 20 })),
    momentum: fc.integer({ min: 0, max: 5 }),
    armorShred: fc.integer({ min: 0, max: 20 }),
    inPhalanx: fc.boolean(),
    tags: fc.array(fc.constantFrom('infantry', 'cavalry', 'ranged', 'mage'), { minLength: 0, maxLength: 3 }),
    faction: arbitraryFaction,
  }).filter((unit) => unit.currentHp <= unit.maxHp && unit.resolve <= unit.maxResolve);
}

/**
 * Generate two distinct positions on the grid.
 */
const arbitraryDistinctPositions: fc.Arbitrary<[Position, Position]> = fc
  .tuple(arbitraryPosition, arbitraryPosition)
  .filter(([p1, p2]) => p1.x !== p2.x || p1.y !== p2.y);

/**
 * Create a valid BattleState with attacker and target.
 */
function createBattleState(attacker: BattleUnit, target: BattleUnit): BattleState {
  const occupiedPositions = new Set<string>();
  occupiedPositions.add(`${attacker.position.x},${attacker.position.y}`);
  occupiedPositions.add(`${target.position.x},${target.position.y}`);

  return {
    battleId: 'test_battle',
    units: [attacker, target],
    round: 1,
    turn: 1,
    currentPhase: 'attack' as Phase,
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue: [attacker.instanceId, target.instanceId],
    currentTurnIndex: 0,
  };
}

/**
 * Calculate expected facing direction from attacker to target.
 */
function getExpectedFacing(attackerPos: Position, targetPos: Position): FacingDirection {
  return calculateFacingDirection(attackerPos, targetPos);
}

// =============================================================================
// PROPERTY-BASED TESTS
// =============================================================================

describe('Attack Phase Property-Based Tests', () => {
  /**
   * **Feature: simulator-refactor, Property 10: Facing Rotation on Attack**
   * **Validates: Requirements 2.5**
   *
   * When a unit attacks, its facing direction SHALL be updated to face
   * the target unit before the attack is executed.
   */
  describe('Property 10: Facing Rotation on Attack', () => {
    it('facing rotates toward target on attack for any attacker/target positions', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], seed: number): boolean => {
            // Create attacker and target at distinct positions
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            // Generate units
            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            const state = createBattleState(attacker, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(state, attacker.instanceId, target.instanceId, rng);

            // Find the updated attacker
            const updatedAttacker = result.state.units.find(
              (u) => u.instanceId === attacker.instanceId,
            );

            // Calculate expected facing
            const expectedFacing = getExpectedFacing(attackerPos, targetPos);

            // Property 10: Facing must be toward target after attack
            const facingCorrect = updatedAttacker?.facing === expectedFacing;

            expect(updatedAttacker).toBeDefined();
            expect(updatedAttacker?.facing).toBe(expectedFacing);

            return facingCorrect;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing rotates regardless of initial facing direction', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          arbitraryFacing,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], initialFacing: FacingDirection, seed: number): boolean => {
            // Create attacker with specific initial facing
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            const attacker = { ...fc.sample(attackerArb, 1)[0], facing: initialFacing };
            const target = fc.sample(targetArb, 1)[0];

            const state = createBattleState(attacker, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(state, attacker.instanceId, target.instanceId, rng);

            // Find the updated attacker
            const updatedAttacker = result.state.units.find(
              (u) => u.instanceId === attacker.instanceId,
            );

            // Calculate expected facing
            const expectedFacing = getExpectedFacing(attackerPos, targetPos);

            // Property 10: Facing must be toward target regardless of initial facing
            const facingCorrect = updatedAttacker?.facing === expectedFacing;

            expect(updatedAttacker?.facing).toBe(expectedFacing);

            return facingCorrect;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing is always a valid cardinal direction after attack', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], seed: number): boolean => {
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            const state = createBattleState(attacker, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(state, attacker.instanceId, target.instanceId, rng);

            // Find the updated attacker
            const updatedAttacker = result.state.units.find(
              (u) => u.instanceId === attacker.instanceId,
            );

            // Property 10 + Property 5: Facing must be valid cardinal direction
            const facingValid = VALID_FACINGS.includes(updatedAttacker?.facing as FacingDirection);

            expect(VALID_FACINGS).toContain(updatedAttacker?.facing);

            return facingValid;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('emits facing_rotated event when facing changes', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], seed: number): boolean => {
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            // Calculate expected facing
            const expectedFacing = getExpectedFacing(attackerPos, targetPos);

            // Set initial facing to something different if possible
            const differentFacing = VALID_FACINGS.find((f) => f !== expectedFacing) ?? expectedFacing;
            const attackerWithDifferentFacing = { ...attacker, facing: differentFacing };

            const state = createBattleState(attackerWithDifferentFacing, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(
              state,
              attackerWithDifferentFacing.instanceId,
              target.instanceId,
              rng,
            );

            // Check for facing_rotated event if facing changed
            const facingRotatedEvent = result.events.find((e) => e.type === 'facing_rotated');

            if (differentFacing !== expectedFacing) {
              // Event should be emitted when facing changes
              expect(facingRotatedEvent).toBeDefined();
              return facingRotatedEvent !== undefined;
            }

            // If facing was already correct, no event needed
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does not emit facing_rotated event when already facing target', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], seed: number): boolean => {
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            // Set initial facing to expected facing (already facing target)
            const expectedFacing = getExpectedFacing(attackerPos, targetPos);
            const attackerAlreadyFacing = { ...attacker, facing: expectedFacing };

            const state = createBattleState(attackerAlreadyFacing, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(
              state,
              attackerAlreadyFacing.instanceId,
              target.instanceId,
              rng,
            );

            // Check for facing_rotated event
            const facingRotatedEvent = result.events.find((e) => e.type === 'facing_rotated');

            // No event should be emitted when already facing target
            expect(facingRotatedEvent).toBeUndefined();

            return facingRotatedEvent === undefined;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing rotation preserves other unit properties', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], seed: number): boolean => {
            const attackerArb = createArbitraryBattleUnit('player', attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit('enemy', targetPos, 'target');

            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            // Capture original values
            const originalPosition = { ...attacker.position };
            const originalTeam = attacker.team;
            const originalId = attacker.id;
            const originalInstanceId = attacker.instanceId;

            const state = createBattleState(attacker, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(state, attacker.instanceId, target.instanceId, rng);

            // Find the updated attacker
            const updatedAttacker = result.state.units.find(
              (u) => u.instanceId === attacker.instanceId,
            );

            // Property 10 + Property 8: Facing rotation should not affect other properties
            const positionPreserved =
              updatedAttacker?.position.x === originalPosition.x &&
              updatedAttacker?.position.y === originalPosition.y;
            const teamPreserved = updatedAttacker?.team === originalTeam;
            const idPreserved = updatedAttacker?.id === originalId;
            const instanceIdPreserved = updatedAttacker?.instanceId === originalInstanceId;

            expect(updatedAttacker?.position).toEqual(originalPosition);
            expect(updatedAttacker?.team).toBe(originalTeam);
            expect(updatedAttacker?.id).toBe(originalId);
            expect(updatedAttacker?.instanceId).toBe(originalInstanceId);

            return positionPreserved && teamPreserved && idPreserved && instanceIdPreserved;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('facing rotation works for both player and enemy attackers', () => {
      fc.assert(
        fc.property(
          arbitraryDistinctPositions,
          arbitraryTeam,
          fc.integer({ min: 1, max: 99999 }),
          ([attackerPos, targetPos], attackerTeam: TeamType, seed: number): boolean => {
            const targetTeam = attackerTeam === 'player' ? 'enemy' : 'player';

            const attackerArb = createArbitraryBattleUnit(attackerTeam, attackerPos, 'attacker');
            const targetArb = createArbitraryBattleUnit(targetTeam, targetPos, 'target');

            const attacker = fc.sample(attackerArb, 1)[0];
            const target = fc.sample(targetArb, 1)[0];

            const state = createBattleState(attacker, target);
            const rng = new SeededRandom(seed);

            // Execute attack phase
            const result = handleAttack(state, attacker.instanceId, target.instanceId, rng);

            // Find the updated attacker
            const updatedAttacker = result.state.units.find(
              (u) => u.instanceId === attacker.instanceId,
            );

            // Calculate expected facing
            const expectedFacing = getExpectedFacing(attackerPos, targetPos);

            // Property 10: Facing rotation applies to all teams
            const facingCorrect = updatedAttacker?.facing === expectedFacing;

            expect(updatedAttacker?.facing).toBe(expectedFacing);

            return facingCorrect;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
