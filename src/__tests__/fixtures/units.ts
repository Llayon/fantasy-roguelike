/**
 * Test fixtures for BattleUnit creation.
 *
 * Provides factory functions for creating test units with various configurations.
 * Used across all test suites to ensure consistent unit setup.
 *
 * @module __tests__/fixtures/units
 * @see {@link BattleUnit} for unit type definition
 *
 * @example
 * import { createTestUnit, createPlayerKnight, createEnemyArcher } from './fixtures/units';
 *
 * // Create a basic test unit
 * const unit = createTestUnit();
 *
 * // Create a specific unit type
 * const knight = createPlayerKnight();
 *
 * // Create with custom overrides
 * const damagedUnit = createTestUnit({ currentHp: 25, maxHp: 100 });
 */

import { BattleUnit, FacingDirection } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';

// =============================================================================
// BASE UNIT FACTORY
// =============================================================================

/**
 * Create a minimal test unit with sensible defaults.
 *
 * All properties can be overridden via the `overrides` parameter.
 * Useful for creating units quickly in tests without specifying every property.
 *
 * @param overrides - Partial unit properties to override defaults
 * @param team - Team affiliation (default: 'player')
 * @param index - Unit index for generating unique instanceId (default: 0)
 * @returns Complete BattleUnit with all required properties
 *
 * @example
 * // Create default unit
 * const unit = createTestUnit();
 *
 * // Create with custom HP
 * const damagedUnit = createTestUnit({ currentHp: 50, maxHp: 100 });
 *
 * // Create enemy unit
 * const enemy = createTestUnit({}, 'enemy', 0);
 *
 * // Create routing unit
 * const routingUnit = createTestUnit({ resolve: 0, isRouting: true });
 */
export function createTestUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  const defaultPosition: Position =
    team === 'player' ? { x: index % 8, y: 0 } : { x: index % 8, y: 9 };

  return {
    // Identity
    id: 'test_unit',
    instanceId: `${team}_test_${index}`,
    name: 'Test Unit',
    team,

    // Base stats
    stats: {
      hp: 100,
      atk: 10,
      atkCount: 1,
      armor: 5,
      speed: 3,
      initiative: 10,
      dodge: 10,
    },
    range: 1,
    role: 'tank',
    cost: 5,
    abilities: [],

    // Battle state
    position: defaultPosition,
    currentHp: 100,
    maxHp: 100,
    alive: true,

    // Core 2.0 Mechanics
    facing: 'S' as FacingDirection,
    resolve: 100,
    maxResolve: 100,
    isRouting: false,
    engaged: false,
    engagedBy: [],
    riposteCharges: 1,
    ammo: null,
    maxAmmo: null,
    momentum: 0,
    armorShred: 0,
    inPhalanx: false,
    tags: [],
    faction: 'human',

    ...overrides,
  };
}

// =============================================================================
// UNIT TYPE FACTORIES
// =============================================================================

/**
 * Create a player-side knight unit.
 *
 * Knights are tanks with high armor and HP.
 * Default position: (0, 0)
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Knight unit
 *
 * @example
 * const knight = createPlayerKnight();
 * const damagedKnight = createPlayerKnight({ currentHp: 50 });
 */
export function createPlayerKnight(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'knight',
      name: 'Knight',
      role: 'tank',
      cost: 5,
      stats: {
        hp: 120,
        atk: 12,
        atkCount: 1,
        armor: 20,
        speed: 2,
        initiative: 8,
        dodge: 5,
      },
      tags: ['infantry', 'tank'],
      ...overrides,
    },
    'player',
    index,
  );
}

/**
 * Create an enemy-side knight unit.
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Enemy knight unit
 */
export function createEnemyKnight(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'knight',
      name: 'Knight',
      role: 'tank',
      cost: 5,
      stats: {
        hp: 120,
        atk: 12,
        atkCount: 1,
        armor: 20,
        speed: 2,
        initiative: 8,
        dodge: 5,
      },
      facing: 'N' as FacingDirection,
      tags: ['infantry', 'tank'],
      ...overrides,
    },
    'enemy',
    index,
  );
}

/**
 * Create a player-side archer unit.
 *
 * Archers are ranged DPS with ammunition.
 * Default position: (1, 0)
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Archer unit
 */
export function createPlayerArcher(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'archer',
      name: 'Archer',
      role: 'ranged_dps',
      cost: 4,
      range: 3,
      stats: {
        hp: 60,
        atk: 14,
        atkCount: 1,
        armor: 5,
        speed: 3,
        initiative: 12,
        dodge: 15,
      },
      ammo: 12,
      maxAmmo: 12,
      tags: ['ranged'],
      ...overrides,
    },
    'player',
    index,
  );
}

/**
 * Create an enemy-side archer unit.
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Enemy archer unit
 */
export function createEnemyArcher(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'archer',
      name: 'Archer',
      role: 'ranged_dps',
      cost: 4,
      range: 3,
      stats: {
        hp: 60,
        atk: 14,
        atkCount: 1,
        armor: 5,
        speed: 3,
        initiative: 12,
        dodge: 15,
      },
      facing: 'N' as FacingDirection,
      ammo: 12,
      maxAmmo: 12,
      tags: ['ranged'],
      ...overrides,
    },
    'enemy',
    index,
  );
}

/**
 * Create a player-side rogue unit.
 *
 * Rogues are melee DPS with high dodge and initiative.
 * Default position: (2, 0)
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Rogue unit
 */
export function createPlayerRogue(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'rogue',
      name: 'Rogue',
      role: 'melee_dps',
      cost: 4,
      stats: {
        hp: 70,
        atk: 16,
        atkCount: 1,
        armor: 3,
        speed: 4,
        initiative: 14,
        dodge: 20,
      },
      tags: ['infantry', 'melee_dps'],
      ...overrides,
    },
    'player',
    index,
  );
}

/**
 * Create an enemy-side rogue unit.
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Enemy rogue unit
 */
export function createEnemyRogue(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'rogue',
      name: 'Rogue',
      role: 'melee_dps',
      cost: 4,
      stats: {
        hp: 70,
        atk: 16,
        atkCount: 1,
        armor: 3,
        speed: 4,
        initiative: 14,
        dodge: 20,
      },
      facing: 'N' as FacingDirection,
      tags: ['infantry', 'melee_dps'],
      ...overrides,
    },
    'enemy',
    index,
  );
}

/**
 * Create a player-side mage unit.
 *
 * Mages are ranged casters with limited ammunition (spells).
 * Default position: (3, 0)
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Mage unit
 */
export function createPlayerMage(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'mage',
      name: 'Mage',
      role: 'mage',
      cost: 5,
      range: 4,
      stats: {
        hp: 50,
        atk: 18,
        atkCount: 1,
        armor: 2,
        speed: 2,
        initiative: 11,
        dodge: 8,
      },
      ammo: 3,
      maxAmmo: 3,
      tags: ['ranged', 'mage'],
      ...overrides,
    },
    'player',
    index,
  );
}

/**
 * Create an enemy-side mage unit.
 *
 * @param overrides - Properties to override
 * @param index - Unit index for unique instanceId
 * @returns Enemy mage unit
 */
export function createEnemyMage(
  overrides: Partial<BattleUnit> = {},
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'mage',
      name: 'Mage',
      role: 'mage',
      cost: 5,
      range: 4,
      stats: {
        hp: 50,
        atk: 18,
        atkCount: 1,
        armor: 2,
        speed: 2,
        initiative: 11,
        dodge: 8,
      },
      facing: 'N' as FacingDirection,
      ammo: 3,
      maxAmmo: 3,
      tags: ['ranged', 'mage'],
      ...overrides,
    },
    'enemy',
    index,
  );
}

/**
 * Create a cavalry unit (for charge mechanics testing).
 *
 * Cavalry units have the 'cavalry' tag and higher speed.
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Cavalry unit
 */
export function createCavalryUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'cavalry',
      name: 'Cavalry',
      role: 'melee_dps',
      cost: 6,
      stats: {
        hp: 90,
        atk: 14,
        atkCount: 1,
        armor: 8,
        speed: 5,
        initiative: 11,
        dodge: 8,
      },
      tags: ['cavalry', 'melee_dps'],
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create a spearman unit (for intercept mechanics testing).
 *
 * Spearman units have the 'spearman' tag and can counter cavalry charges.
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Spearman unit
 */
export function createSpearmanUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'spearman',
      name: 'Spearman',
      role: 'tank',
      cost: 4,
      stats: {
        hp: 100,
        atk: 11,
        atkCount: 1,
        armor: 15,
        speed: 2,
        initiative: 9,
        dodge: 5,
      },
      tags: ['infantry', 'spearman', 'tank'],
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create an undead unit (for resolve/crumble mechanics testing).
 *
 * Undead units have the 'undead' faction and crumble (die) when resolve reaches 0.
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Undead unit
 */
export function createUndeadUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      id: 'skeleton',
      name: 'Skeleton',
      role: 'melee_dps',
      cost: 3,
      stats: {
        hp: 60,
        atk: 12,
        atkCount: 1,
        armor: 5,
        speed: 3,
        initiative: 10,
        dodge: 5,
      },
      faction: 'undead',
      tags: ['undead', 'melee_dps'],
      ...overrides,
    },
    team,
    index,
  );
}

// =============================================================================
// UNIT STATE FACTORIES
// =============================================================================

/**
 * Create a dead unit (for death handling tests).
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Dead unit
 */
export function createDeadUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      currentHp: 0,
      alive: false,
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create a routing unit (for resolve mechanics testing).
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Routing unit
 */
export function createRoutingUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      resolve: 0,
      isRouting: true,
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create an engaged unit (for engagement mechanics testing).
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Engaged unit
 */
export function createEngagedUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      engaged: true,
      engagedBy: [`${team === 'player' ? 'enemy' : 'player'}_unit_0`],
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create a unit in phalanx formation (for phalanx mechanics testing).
 *
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Unit in phalanx
 */
export function createPhalanxUnit(
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      inPhalanx: true,
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create a unit with armor shred (for armor shred mechanics testing).
 *
 * @param shredAmount - Amount of armor shred to apply
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Unit with armor shred
 */
export function createShredUnit(
  shredAmount: number = 5,
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createTestUnit(
    {
      armorShred: shredAmount,
      ...overrides,
    },
    team,
    index,
  );
}

/**
 * Create a unit with low ammunition (for ammunition mechanics testing).
 *
 * @param ammoCount - Remaining ammunition
 * @param overrides - Properties to override
 * @param team - Team affiliation
 * @param index - Unit index for unique instanceId
 * @returns Unit with low ammo
 */
export function createLowAmmoUnit(
  ammoCount: number = 1,
  overrides: Partial<BattleUnit> = {},
  team: 'player' | 'enemy' = 'player',
  index: number = 0,
): BattleUnit {
  return createPlayerArcher(
    {
      ammo: ammoCount,
      ...overrides,
    },
    index,
  );
}
