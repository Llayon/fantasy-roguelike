/**
 * Property-based test generators for team setup and composition.
 *
 * Generates random team setups for property-based testing.
 * Uses fast-check to create valid team compositions across the entire input domain.
 *
 * @module __tests__/generators/team.generator
 * @see {@link TeamSetup} for team setup type definition
 * @see {@link https://github.com/dubzzz/fast-check} for fast-check documentation
 *
 * @example
 * import fc from 'fast-check';
 * import { arbitraryTeamSetup } from './generators/team.generator';
 *
 * // Generate random team setups for property testing
 * fc.assert(
 *   fc.property(arbitraryTeamSetup(), (team) => {
 *     // Property: Units and positions arrays have same length
 *     expect(team.units.length).toBe(team.positions.length);
 *
 *     // Property: At least 1 unit
 *     expect(team.units.length).toBeGreaterThan(0);
 *
 *     // Property: Total cost <= 30 points
 *     const totalCost = team.units.reduce((sum, u) => sum + getUnitCost(u.unitId), 0);
 *     expect(totalCost).toBeLessThanOrEqual(30);
 *   })
 * );
 */

import fc from 'fast-check';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { Position } from '../../core/types/grid.types';

// =============================================================================
// UNIT COST MAPPING
// =============================================================================

/**
 * Get the cost of a unit by ID.
 *
 * @param unitId - Unit template ID
 * @returns Cost in points (3-8)
 */
function getUnitCost(unitId: string): number {
  const costs: Record<string, number> = {
    knight: 5,
    guardian: 6,
    berserker: 5,
    rogue: 4,
    duelist: 5,
    assassin: 4,
    archer: 4,
    crossbowman: 5,
    hunter: 4,
    mage: 5,
    warlock: 6,
    elementalist: 5,
    priest: 5,
    bard: 4,
    enchanter: 6,
  };
  return costs[unitId] || 5;
}

// =============================================================================
// POSITION GENERATORS
// =============================================================================

/**
 * Generate a valid player-side position (y = 0-1).
 *
 * @returns Arbitrary<Position>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPlayerPosition(), (pos) => {
 *     expect(pos.y).toBeLessThanOrEqual(1);
 *   })
 * );
 */
export function arbitraryPlayerPosition(): fc.Arbitrary<Position> {
  return fc.record({
    x: fc.integer({ min: 0, max: 7 }),
    y: fc.integer({ min: 0, max: 1 }),
  });
}

/**
 * Generate a valid enemy-side position (y = 8-9).
 *
 * @returns Arbitrary<Position>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryEnemyPosition(), (pos) => {
 *     expect(pos.y).toBeGreaterThanOrEqual(8);
 *   })
 * );
 */
export function arbitraryEnemyPosition(): fc.Arbitrary<Position> {
  return fc.record({
    x: fc.integer({ min: 0, max: 7 }),
    y: fc.integer({ min: 8, max: 9 }),
  });
}

/**
 * Generate a valid position for either team.
 *
 * @returns Arbitrary<Position>
 */
export function arbitraryPosition(): fc.Arbitrary<Position> {
  return fc.record({
    x: fc.integer({ min: 0, max: 7 }),
    y: fc.integer({ min: 0, max: 9 }),
  });
}

// =============================================================================
// UNIT ID GENERATORS
// =============================================================================

/**
 * Generate a valid unit ID.
 *
 * @returns Arbitrary<string>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryUnitId(), (unitId) => {
 *     const validIds = ['knight', 'archer', 'rogue', 'mage', ...];
 *     expect(validIds).toContain(unitId);
 *   })
 * );
 */
export function arbitraryUnitId(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'knight',
    'guardian',
    'berserker',
    'rogue',
    'duelist',
    'assassin',
    'archer',
    'crossbowman',
    'hunter',
    'mage',
    'warlock',
    'elementalist',
    'priest',
    'bard',
    'enchanter',
  );
}

/**
 * Generate a valid unit tier (1-3).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryUnitTier(), (tier) => {
 *     expect(tier).toBeGreaterThanOrEqual(1);
 *     expect(tier).toBeLessThanOrEqual(3);
 *   })
 * );
 */
export function arbitraryUnitTier(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 3 });
}

// =============================================================================
// TEAM SETUP UNIT GENERATORS
// =============================================================================

/**
 * Generate a random team setup unit.
 *
 * @returns Arbitrary<TeamSetupUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryTeamSetupUnit(), (unit) => {
 *     expect(unit.tier).toBeGreaterThanOrEqual(1);
 *     expect(unit.tier).toBeLessThanOrEqual(3);
 *   })
 * );
 */
export function arbitraryTeamSetupUnit(): fc.Arbitrary<TeamSetupUnit> {
  return fc.record({
    unitId: arbitraryUnitId(),
    tier: arbitraryUnitTier(),
  });
}

// =============================================================================
// FULL TEAM SETUP GENERATORS
// =============================================================================

/**
 * Generate a random valid TeamSetup.
 *
 * Creates teams with:
 * - 1-6 units
 * - Valid unit IDs and tiers
 * - Total cost <= 30 points
 * - Valid positions within grid bounds
 * - Units and positions arrays have same length
 *
 * This is the primary generator for property-based testing of team setups.
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryTeamSetup(), (team) => {
 *     // Property: Units and positions have same length
 *     expect(team.units.length).toBe(team.positions.length);
 *
 *     // Property: At least 1 unit
 *     expect(team.units.length).toBeGreaterThan(0);
 *
 *     // Property: Total cost <= 30
 *     const cost = team.units.reduce((sum, u) => sum + getUnitCost(u.unitId), 0);
 *     expect(cost).toBeLessThanOrEqual(30);
 *   })
 * );
 */
export function arbitraryTeamSetup(): fc.Arbitrary<TeamSetup> {
  return fc
    .tuple(
      fc.array(arbitraryTeamSetupUnit(), { minLength: 1, maxLength: 6 }),
      fc.integer({ min: 0, max: 1 }), // 0 = player side, 1 = enemy side
    )
    .chain(([units, side]) => {
      // Filter units to stay within 30-point budget
      let totalCost = 0;
      const validUnits: TeamSetupUnit[] = [];

      for (const unit of units) {
        const cost = getUnitCost(unit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(unit);
          totalCost += cost;
        }
      }

      // Ensure at least 1 unit
      if (validUnits.length === 0) {
        validUnits.push(units[0]);
      }

      // Generate positions
      const positionGenerator =
        side === 0 ? arbitraryPlayerPosition() : arbitraryEnemyPosition();

      return fc
        .array(positionGenerator, {
          minLength: validUnits.length,
          maxLength: validUnits.length,
        })
        .map((positions) => ({
          units: validUnits,
          positions,
        }));
    });
}

/**
 * Generate a TeamSetup for the player side (y = 0-1).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPlayerTeamSetup(), (team) => {
 *     team.positions.forEach(pos => {
 *       expect(pos.y).toBeLessThanOrEqual(1);
 *     });
 *   })
 * );
 */
export function arbitraryPlayerTeamSetup(): fc.Arbitrary<TeamSetup> {
  return fc
    .array(arbitraryTeamSetupUnit(), { minLength: 1, maxLength: 6 })
    .chain((units) => {
      // Filter to budget
      let totalCost = 0;
      const validUnits: TeamSetupUnit[] = [];

      for (const unit of units) {
        const cost = getUnitCost(unit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(unit);
          totalCost += cost;
        }
      }

      if (validUnits.length === 0) {
        validUnits.push(units[0]);
      }

      return fc
        .array(arbitraryPlayerPosition(), {
          minLength: validUnits.length,
          maxLength: validUnits.length,
        })
        .map((positions) => ({
          units: validUnits,
          positions,
        }));
    });
}

/**
 * Generate a TeamSetup for the enemy side (y = 8-9).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryEnemyTeamSetup(), (team) => {
 *     team.positions.forEach(pos => {
 *       expect(pos.y).toBeGreaterThanOrEqual(8);
 *     });
 *   })
 * );
 */
export function arbitraryEnemyTeamSetup(): fc.Arbitrary<TeamSetup> {
  return fc
    .array(arbitraryTeamSetupUnit(), { minLength: 1, maxLength: 6 })
    .chain((units) => {
      // Filter to budget
      let totalCost = 0;
      const validUnits: TeamSetupUnit[] = [];

      for (const unit of units) {
        const cost = getUnitCost(unit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(unit);
          totalCost += cost;
        }
      }

      if (validUnits.length === 0) {
        validUnits.push(units[0]);
      }

      return fc
        .array(arbitraryEnemyPosition(), {
          minLength: validUnits.length,
          maxLength: validUnits.length,
        })
        .map((positions) => ({
          units: validUnits,
          positions,
        }));
    });
}

/**
 * Generate a TeamSetup with specific constraints.
 *
 * Useful for testing specific scenarios.
 *
 * @param constraints - Partial team setup properties to enforce
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * // Generate only single-unit teams
 * const singleUnitTeam = arbitraryTeamSetupWith({
 *   units: fc.array(arbitraryTeamSetupUnit(), { minLength: 1, maxLength: 1 }),
 * });
 */
export function arbitraryTeamSetupWith(
  constraints: Partial<Record<keyof TeamSetup, fc.Arbitrary<any>>>,
): fc.Arbitrary<TeamSetup> {
  return arbitraryTeamSetup().map((team) => {
    const result = { ...team };

    // Apply constraints
    for (const [key, arbitrary] of Object.entries(constraints)) {
      if (arbitrary) {
        result[key as keyof TeamSetup] = fc.sample(arbitrary, 1)[0];
      }
    }

    return result;
  });
}

/**
 * Generate a single-unit TeamSetup (edge case).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitrarySingleUnitTeam(), (team) => {
 *     expect(team.units.length).toBe(1);
 *   })
 * );
 */
export function arbitrarySingleUnitTeam(): fc.Arbitrary<TeamSetup> {
  return fc
    .tuple(arbitraryTeamSetupUnit(), fc.integer({ min: 0, max: 1 }))
    .chain(([unit, side]) => {
      const positionGenerator =
        side === 0 ? arbitraryPlayerPosition() : arbitraryEnemyPosition();

      return positionGenerator.map((position) => ({
        units: [unit],
        positions: [position],
      }));
    });
}

/**
 * Generate a full-budget TeamSetup (total cost = 30).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryFullBudgetTeam(), (team) => {
 *     const cost = team.units.reduce((sum, u) => sum + getUnitCost(u.unitId), 0);
 *     expect(cost).toBe(30);
 *   })
 * );
 */
export function arbitraryFullBudgetTeam(): fc.Arbitrary<TeamSetup> {
  return fc
    .array(arbitraryTeamSetupUnit(), { minLength: 1, maxLength: 6 })
    .chain((units) => {
      // Find combination that totals exactly 30
      let totalCost = 0;
      const validUnits: TeamSetupUnit[] = [];

      for (const unit of units) {
        const cost = getUnitCost(unit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(unit);
          totalCost += cost;
        }
      }

      // Pad with cheap units to reach 30 if needed
      while (totalCost < 30) {
        const cheapUnit: TeamSetupUnit = { unitId: 'rogue', tier: 1 };
        const cost = getUnitCost(cheapUnit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(cheapUnit);
          totalCost += cost;
        } else {
          break;
        }
      }

      if (validUnits.length === 0) {
        validUnits.push({ unitId: 'knight', tier: 1 });
      }

      return fc
        .array(arbitraryPosition(), {
          minLength: validUnits.length,
          maxLength: validUnits.length,
        })
        .map((positions) => ({
          units: validUnits,
          positions,
        }));
    });
}

/**
 * Generate a tank-heavy TeamSetup (3+ tanks).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryTankTeam(), (team) => {
 *     const tanks = team.units.filter(u => ['knight', 'guardian'].includes(u.unitId));
 *     expect(tanks.length).toBeGreaterThanOrEqual(3);
 *   })
 * );
 */
export function arbitraryTankTeam(): fc.Arbitrary<TeamSetup> {
  const tankUnits = [
    { unitId: 'knight' as const, tier: 1 },
    { unitId: 'guardian' as const, tier: 1 },
    { unitId: 'berserker' as const, tier: 1 },
  ];

  return fc
    .tuple(
      fc.array(fc.constantFrom(...tankUnits), { minLength: 3, maxLength: 6 }),
      fc.integer({ min: 0, max: 1 }),
    )
    .chain(([units, side]) => {
      const positionGenerator =
        side === 0 ? arbitraryPlayerPosition() : arbitraryEnemyPosition();

      return fc
        .array(positionGenerator, {
          minLength: units.length,
          maxLength: units.length,
        })
        .map((positions) => ({
          units,
          positions,
        }));
    });
}

/**
 * Generate a ranged-heavy TeamSetup (3+ ranged units).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryRangedTeam(), (team) => {
 *     const ranged = team.units.filter(u =>
 *       ['archer', 'crossbowman', 'hunter', 'mage'].includes(u.unitId)
 *     );
 *     expect(ranged.length).toBeGreaterThanOrEqual(3);
 *   })
 * );
 */
export function arbitraryRangedTeam(): fc.Arbitrary<TeamSetup> {
  const rangedUnits = [
    { unitId: 'archer' as const, tier: 1 },
    { unitId: 'crossbowman' as const, tier: 1 },
    { unitId: 'hunter' as const, tier: 1 },
    { unitId: 'mage' as const, tier: 1 },
  ];

  return fc
    .tuple(
      fc.array(fc.constantFrom(...rangedUnits), { minLength: 3, maxLength: 6 }),
      fc.integer({ min: 0, max: 1 }),
    )
    .chain(([units, side]) => {
      const positionGenerator =
        side === 0 ? arbitraryPlayerPosition() : arbitraryEnemyPosition();

      return fc
        .array(positionGenerator, {
          minLength: units.length,
          maxLength: units.length,
        })
        .map((positions) => ({
          units,
          positions,
        }));
    });
}

/**
 * Generate a balanced TeamSetup (mix of roles).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBalancedTeam(), (team) => {
 *     // Should have mix of different unit types
 *     expect(team.units.length).toBeGreaterThan(1);
 *   })
 * );
 */
export function arbitraryBalancedTeam(): fc.Arbitrary<TeamSetup> {
  const allUnits = [
    { unitId: 'knight' as const, tier: 1 },
    { unitId: 'archer' as const, tier: 1 },
    { unitId: 'rogue' as const, tier: 1 },
    { unitId: 'mage' as const, tier: 1 },
    { unitId: 'priest' as const, tier: 1 },
  ];

  return fc
    .tuple(
      fc.array(fc.constantFrom(...allUnits), { minLength: 2, maxLength: 5 }),
      fc.integer({ min: 0, max: 1 }),
    )
    .chain(([units, side]) => {
      const positionGenerator =
        side === 0 ? arbitraryPlayerPosition() : arbitraryEnemyPosition();

      return fc
        .array(positionGenerator, {
          minLength: units.length,
          maxLength: units.length,
        })
        .map((positions) => ({
          units,
          positions,
        }));
    });
}

/**
 * Generate a high-tier TeamSetup (mostly tier 2-3 units).
 *
 * @returns Arbitrary<TeamSetup>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryHighTierTeam(), (team) => {
 *     const highTier = team.units.filter(u => u.tier >= 2);
 *     expect(highTier.length).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryHighTierTeam(): fc.Arbitrary<TeamSetup> {
  return fc
    .array(
      fc.record({
        unitId: arbitraryUnitId(),
        tier: fc.integer({ min: 2, max: 3 }),
      }),
      { minLength: 1, maxLength: 4 },
    )
    .chain((units) => {
      // Filter to budget
      let totalCost = 0;
      const validUnits: TeamSetupUnit[] = [];

      for (const unit of units) {
        const cost = getUnitCost(unit.unitId);
        if (totalCost + cost <= 30) {
          validUnits.push(unit);
          totalCost += cost;
        }
      }

      if (validUnits.length === 0) {
        validUnits.push({ unitId: 'knight', tier: 2 });
      }

      return fc
        .array(arbitraryPosition(), {
          minLength: validUnits.length,
          maxLength: validUnits.length,
        })
        .map((positions) => ({
          units: validUnits,
          positions,
        }));
    });
}
