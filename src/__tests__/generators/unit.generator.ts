/**
 * Property-based test generators for BattleUnit.
 *
 * Generates random BattleUnit instances for property-based testing.
 * Uses fast-check to create valid units across the entire input domain.
 *
 * @module __tests__/generators/unit.generator
 * @see {@link BattleUnit} for unit type definition
 * @see {@link https://github.com/dubzzz/fast-check} for fast-check documentation
 *
 * @example
 * import fc from 'fast-check';
 * import { arbitraryBattleUnit, arbitraryFacingDirection } from './generators/unit.generator';
 *
 * // Generate random units for property testing
 * fc.assert(
 *   fc.property(arbitraryBattleUnit(), (unit) => {
 *     // Property: HP is always within bounds
 *     expect(unit.currentHp).toBeGreaterThanOrEqual(0);
 *     expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
 *   })
 * );
 */

import fc from 'fast-check';
import { BattleUnit, FacingDirection } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';

// =============================================================================
// BASIC TYPE GENERATORS
// =============================================================================

/**
 * Generate a valid facing direction.
 *
 * @returns Arbitrary<FacingDirection>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryFacingDirection(), (facing) => {
 *     expect(['N', 'S', 'E', 'W']).toContain(facing);
 *   })
 * );
 */
export function arbitraryFacingDirection(): fc.Arbitrary<FacingDirection> {
  return fc.constantFrom<FacingDirection>('N', 'S', 'E', 'W');
}

/**
 * Generate a valid grid position (0-7 x, 0-9 y).
 *
 * @returns Arbitrary<Position>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPosition(), (pos) => {
 *     expect(pos.x).toBeGreaterThanOrEqual(0);
 *     expect(pos.x).toBeLessThanOrEqual(7);
 *     expect(pos.y).toBeGreaterThanOrEqual(0);
 *     expect(pos.y).toBeLessThanOrEqual(9);
 *   })
 * );
 */
export function arbitraryPosition(): fc.Arbitrary<Position> {
  return fc.record({
    x: fc.integer({ min: 0, max: 7 }),
    y: fc.integer({ min: 0, max: 9 }),
  });
}

/**
 * Generate a valid team affiliation.
 *
 * @returns Arbitrary<'player' | 'enemy'>
 */
export function arbitraryTeam(): fc.Arbitrary<'player' | 'enemy'> {
  return fc.constantFrom<'player' | 'enemy'>('player', 'enemy');
}

/**
 * Generate a valid unit faction.
 *
 * @returns Arbitrary<'human' | 'undead'>
 */
export function arbitraryFaction(): fc.Arbitrary<'human' | 'undead'> {
  return fc.constantFrom<'human' | 'undead'>('human', 'undead');
}

/**
 * Generate a valid unit role.
 *
 * @returns Arbitrary<string>
 */
export function arbitraryRole(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'tank',
    'melee_dps',
    'ranged_dps',
    'mage',
    'support',
    'control',
  );
}

/**
 * Generate unit classification tags.
 *
 * @returns Arbitrary<string[]>
 */
export function arbitraryTags(): fc.Arbitrary<string[]> {
  const tagOptions = [
    'infantry',
    'cavalry',
    'spearman',
    'ranged',
    'mage',
    'heavy',
    'light',
    'undead',
  ];
  return fc.array(fc.constantFrom(...tagOptions), { maxLength: 4 });
}

// =============================================================================
// STAT GENERATORS
// =============================================================================

/**
 * Generate valid unit base stats.
 *
 * Constraints:
 * - HP: 30-200
 * - ATK: 5-30
 * - ATK Count: 1-3
 * - Armor: 0-50
 * - Speed: 1-6
 * - Initiative: 1-20
 * - Dodge: 0-50 (capped at 50 in game)
 *
 * @returns Arbitrary<BattleUnitStats>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBattleUnitStats(), (stats) => {
 *     expect(stats.hp).toBeGreaterThan(0);
 *     expect(stats.atk).toBeGreaterThan(0);
 *     expect(stats.dodge).toBeLessThanOrEqual(50);
 *   })
 * );
 */
export function arbitraryBattleUnitStats(): fc.Arbitrary<any> {
  return fc.record({
    hp: fc.integer({ min: 30, max: 200 }),
    atk: fc.integer({ min: 5, max: 30 }),
    atkCount: fc.integer({ min: 1, max: 3 }),
    armor: fc.integer({ min: 0, max: 50 }),
    speed: fc.integer({ min: 1, max: 6 }),
    initiative: fc.integer({ min: 1, max: 20 }),
    dodge: fc.integer({ min: 0, max: 50 }),
  });
}

// =============================================================================
// AMMUNITION GENERATORS
// =============================================================================

/**
 * Generate ammunition value (null for unlimited, or 0-20 for limited).
 *
 * @returns Arbitrary<number | null>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryAmmo(), (ammo) => {
 *     expect(ammo === null || ammo >= 0).toBe(true);
 *   })
 * );
 */
export function arbitraryAmmo(): fc.Arbitrary<number | null> {
  return fc.oneof(
    fc.constant(null),
    fc.integer({ min: 0, max: 20 }),
  );
}

// =============================================================================
// RESOLVE GENERATORS
// =============================================================================

/**
 * Generate valid resolve value (0-100).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryResolve(), (resolve) => {
 *     expect(resolve).toBeGreaterThanOrEqual(0);
 *     expect(resolve).toBeLessThanOrEqual(100);
 *   })
 * );
 */
export function arbitraryResolve(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 100 });
}

// =============================================================================
// HP GENERATORS
// =============================================================================

/**
 * Generate valid HP value given max HP.
 *
 * @param maxHp - Maximum HP value
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryCurrentHp(100), (hp) => {
 *     expect(hp).toBeGreaterThanOrEqual(0);
 *     expect(hp).toBeLessThanOrEqual(100);
 *   })
 * );
 */
export function arbitraryCurrentHp(maxHp: number): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: maxHp });
}

// =============================================================================
// ARMOR SHRED GENERATORS
// =============================================================================

/**
 * Generate valid armor shred value (0-50).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryArmorShred(), (shred) => {
 *     expect(shred).toBeGreaterThanOrEqual(0);
 *   })
 * );
 */
export function arbitraryArmorShred(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 50 });
}

// =============================================================================
// MOMENTUM GENERATORS
// =============================================================================

/**
 * Generate valid momentum value (0-1.0).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryMomentum(), (momentum) => {
 *     expect(momentum).toBeGreaterThanOrEqual(0);
 *     expect(momentum).toBeLessThanOrEqual(1.0);
 *   })
 * );
 */
export function arbitraryMomentum(): fc.Arbitrary<number> {
  return fc.float({ min: 0, max: 1.0, noNaN: true });
}

// =============================================================================
// RIPOSTE CHARGE GENERATORS
// =============================================================================

/**
 * Generate valid riposte charges (0-3).
 *
 * @returns Arbitrary<number>
 */
export function arbitraryRiposteCharges(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 3 });
}

// =============================================================================
// ENGAGEMENT GENERATORS
// =============================================================================

/**
 * Generate engaged-by unit IDs.
 *
 * @returns Arbitrary<string[]>
 */
export function arbitraryEngagedBy(): fc.Arbitrary<string[]> {
  return fc.array(
    fc.tuple(
      fc.constantFrom('player', 'enemy'),
      fc.string({ minLength: 1, maxLength: 10 }),
    ).map(([team, id]) => `${team}_${id}`),
    { maxLength: 3 },
  );
}

// =============================================================================
// FULL UNIT GENERATORS
// =============================================================================

/**
 * Generate a random valid BattleUnit.
 *
 * Creates units with:
 * - Valid HP bounds (0 <= currentHp <= maxHp)
 * - Alive status consistent with HP
 * - Valid facing direction
 * - Valid resolve bounds
 * - Valid ammunition (null or >= 0)
 * - Valid armor shred
 * - Valid momentum
 * - Valid positions within grid bounds
 *
 * This is the primary generator for property-based testing of units.
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBattleUnit(), (unit) => {
 *     // Property: HP is always within bounds
 *     expect(unit.currentHp).toBeGreaterThanOrEqual(0);
 *     expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
 *
 *     // Property: Alive status matches HP
 *     expect(unit.alive).toBe(unit.currentHp > 0);
 *
 *     // Property: Facing is always valid
 *     expect(['N', 'S', 'E', 'W']).toContain(unit.facing);
 *   })
 * );
 */
export function arbitraryBattleUnit(): fc.Arbitrary<BattleUnit> {
  return fc
    .tuple(
      arbitraryBattleUnitStats(),
      arbitraryPosition(),
      arbitraryTeam(),
      arbitraryFaction(),
      arbitraryRole(),
      arbitraryTags(),
      arbitraryResolve(),
      arbitraryAmmo(),
      arbitraryArmorShred(),
      arbitraryMomentum(),
      arbitraryRiposteCharges(),
      arbitraryEngagedBy(),
    )
    .map(
      ([
        stats,
        position,
        team,
        faction,
        role,
        tags,
        resolve,
        ammo,
        armorShred,
        momentum,
        riposteCharges,
        engagedBy,
      ]) => {
        // Generate maxHp from stats
        const maxHp = stats.hp;

        // Generate currentHp (0 to maxHp)
        const currentHp = fc.sample(arbitraryCurrentHp(maxHp), 1)[0];

        // Alive status must match HP
        const alive = currentHp > 0;

        return {
          // Identity
          id: fc.sample(fc.string({ minLength: 1, maxLength: 20 }), 1)[0],
          instanceId: `${team}_unit_${fc.sample(fc.integer({ min: 0, max: 100 }), 1)[0]}`,
          name: fc.sample(fc.string({ minLength: 1, maxLength: 20 }), 1)[0],
          team,

          // Base stats
          stats,
          range: fc.sample(fc.integer({ min: 1, max: 5 }), 1)[0],
          role,
          cost: fc.sample(fc.integer({ min: 3, max: 8 }), 1)[0],
          abilities: fc.sample(
            fc.array(fc.string({ minLength: 1, maxLength: 15 }), {
              maxLength: 3,
            }),
            1,
          )[0],

          // Battle state
          position,
          currentHp,
          maxHp,
          alive,

          // Core 2.0 Mechanics
          facing: fc.sample(arbitraryFacingDirection(), 1)[0],
          resolve,
          maxResolve: 100,
          isRouting: resolve === 0 && faction === 'human',
          engaged: engagedBy.length > 0,
          engagedBy,
          riposteCharges,
          ammo,
          maxAmmo: ammo === null ? null : ammo + fc.sample(fc.integer({ min: 0, max: 10 }), 1)[0],
          momentum,
          armorShred,
          inPhalanx: fc.sample(fc.boolean(), 1)[0],
          tags,
          faction,
        };
      },
    );
}

/**
 * Generate a BattleUnit with specific constraints.
 *
 * Useful for testing specific scenarios (e.g., low HP, routing, etc.).
 *
 * @param constraints - Partial unit properties to enforce
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * // Generate only low-HP units
 * const lowHpUnit = arbitraryBattleUnitWith({ currentHp: fc.integer({ min: 1, max: 20 }) });
 *
 * // Generate only routing units
 * const routingUnit = arbitraryBattleUnitWith({ isRouting: fc.constant(true) });
 */
export function arbitraryBattleUnitWith(
  constraints: Partial<Record<keyof BattleUnit, fc.Arbitrary<any>>>,
): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => {
    const result: BattleUnit = { ...unit };

    // Apply constraints
    for (const [key, arbitrary] of Object.entries(constraints)) {
      if (arbitrary) {
        (result as any)[key] = fc.sample(arbitrary, 1)[0];
      }
    }

    return result;
  });
}

/**
 * Generate a dead BattleUnit (currentHp = 0, alive = false).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryDeadUnit(), (unit) => {
 *     expect(unit.alive).toBe(false);
 *     expect(unit.currentHp).toBe(0);
 *   })
 * );
 */
export function arbitraryDeadUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    currentHp: 0,
    alive: false,
  }));
}

/**
 * Generate a routing BattleUnit (resolve = 0, isRouting = true).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryRoutingUnit(), (unit) => {
 *     expect(unit.isRouting).toBe(true);
 *     expect(unit.resolve).toBe(0);
 *   })
 * );
 */
export function arbitraryRoutingUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    resolve: 0,
    isRouting: true,
  }));
}

/**
 * Generate a low-HP BattleUnit (currentHp <= 20% of maxHp).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryLowHpUnit(), (unit) => {
 *     expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp * 0.2);
 *   })
 * );
 */
export function arbitraryLowHpUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => {
    const lowHp = Math.max(1, Math.floor(unit.maxHp * 0.2));
    return {
      ...unit,
      currentHp: fc.sample(fc.integer({ min: 1, max: lowHp }), 1)[0],
      alive: true,
    };
  });
}

/**
 * Generate a unit with no ammunition (ammo = 0).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryNoAmmoUnit(), (unit) => {
 *     expect(unit.ammo).toBe(0);
 *   })
 * );
 */
export function arbitraryNoAmmoUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    ammo: 0,
    maxAmmo: unit.maxAmmo || 10,
  }));
}

/**
 * Generate a unit with armor shred applied.
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryShredUnit(), (unit) => {
 *     expect(unit.armorShred).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryShredUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    armorShred: fc.sample(fc.integer({ min: 1, max: 30 }), 1)[0],
  }));
}

/**
 * Generate a unit with momentum (charging).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryChargingUnit(), (unit) => {
 *     expect(unit.momentum).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryChargingUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    momentum: fc.sample(fc.float({ min: 0.1, max: 1.0, noNaN: true }), 1)[0],
  }));
}

/**
 * Generate a unit in phalanx formation.
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPhalanxUnit(), (unit) => {
 *     expect(unit.inPhalanx).toBe(true);
 *   })
 * );
 */
export function arbitraryPhalanxUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    inPhalanx: true,
  }));
}

/**
 * Generate a cavalry unit (with 'cavalry' tag).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryCavalryUnit(), (unit) => {
 *     expect(unit.tags).toContain('cavalry');
 *   })
 * );
 */
export function arbitraryCavalryUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    tags: [...unit.tags, 'cavalry'],
  }));
}

/**
 * Generate a spearman unit (with 'spearman' tag).
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitrarySpearmanUnit(), (unit) => {
 *     expect(unit.tags).toContain('spearman');
 *   })
 * );
 */
export function arbitrarySpearmanUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    tags: [...unit.tags, 'spearman'],
  }));
}

/**
 * Generate an undead unit (faction = 'undead').
 *
 * @returns Arbitrary<BattleUnit>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryUndeadUnit(), (unit) => {
 *     expect(unit.faction).toBe('undead');
 *   })
 * );
 */
export function arbitraryUndeadUnit(): fc.Arbitrary<BattleUnit> {
  return arbitraryBattleUnit().map((unit) => ({
    ...unit,
    faction: 'undead',
  }));
}
