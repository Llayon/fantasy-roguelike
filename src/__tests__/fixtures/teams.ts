/**
 * Test fixtures for team setup and composition.
 *
 * Provides factory functions for creating test teams with various compositions.
 * Used for testing team validation, matchmaking, and battle initialization.
 *
 * @module __tests__/fixtures/teams
 * @see {@link TeamSetup} for team setup type definition
 * @see {@link BattleUnit} for unit type definition
 *
 * @example
 * import { createPlayerTeam, createEnemyTeam, createBalancedTeam } from './fixtures/teams';
 *
 * // Create a basic player team
 * const playerTeam = createPlayerTeam();
 *
 * // Create a balanced team composition
 * const balancedTeam = createBalancedTeam('player');
 *
 * // Create a team with custom units
 * const customTeam = createTeamWithUnits('player', [
 *   { unitId: 'knight', tier: 2 },
 *   { unitId: 'archer', tier: 1 },
 * ]);
 */

import { BattleUnit } from '../../core/types/battle-unit';
import { TeamSetup, TeamSetupUnit } from '../../core/types/battle-state';
import { Position } from '../../core/types/grid.types';
import {
  createPlayerKnight,
  createPlayerArcher,
  createPlayerRogue,
  createPlayerMage,
  createEnemyKnight,
  createEnemyArcher,
  createEnemyRogue,
  createEnemyMage,
  createTestUnit,
} from './units';

// =============================================================================
// TEAM SETUP FACTORIES
// =============================================================================

/**
 * Create a basic player team setup.
 *
 * Default composition: 1 knight, 1 archer, 1 rogue
 * Total cost: 13 points (within 30-point budget)
 *
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for player team
 *
 * @example
 * const team = createPlayerTeam();
 * // Result: { units: [...], positions: [...] }
 */
export function createPlayerTeam(
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  return {
    units: [
      { unitId: 'knight', tier: 1 },
      { unitId: 'archer', tier: 1 },
      { unitId: 'rogue', tier: 1 },
    ],
    positions: [
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 3, y: 1 },
    ],
    ...overrides,
  };
}

/**
 * Create a basic enemy team setup.
 *
 * Default composition: 1 knight, 1 archer, 1 rogue
 * Total cost: 13 points (within 30-point budget)
 *
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for enemy team
 *
 * @example
 * const team = createEnemyTeam();
 */
export function createEnemyTeam(
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  return {
    units: [
      { unitId: 'knight', tier: 1 },
      { unitId: 'archer', tier: 1 },
      { unitId: 'rogue', tier: 1 },
    ],
    positions: [
      { x: 2, y: 9 },
      { x: 4, y: 9 },
      { x: 3, y: 8 },
    ],
    ...overrides,
  };
}

/**
 * Create a balanced team composition.
 *
 * Composition: 1 tank, 1 ranged DPS, 1 melee DPS, 1 mage
 * Total cost: 18 points
 *
 * @param team - Team affiliation ('player' or 'enemy')
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for balanced team
 *
 * @example
 * const playerTeam = createBalancedTeam('player');
 * const enemyTeam = createBalancedTeam('enemy');
 */
export function createBalancedTeam(
  team: 'player' | 'enemy' = 'player',
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  const baseY = team === 'player' ? 0 : 9;
  const offsetY = team === 'player' ? 1 : -1;

  return {
    units: [
      { unitId: 'knight', tier: 1 },
      { unitId: 'archer', tier: 1 },
      { unitId: 'rogue', tier: 1 },
      { unitId: 'mage', tier: 1 },
    ],
    positions: [
      { x: 2, y: baseY },
      { x: 5, y: baseY },
      { x: 3, y: baseY + offsetY },
      { x: 4, y: baseY + offsetY },
    ],
    ...overrides,
  };
}

/**
 * Create a tank-heavy team composition.
 *
 * Composition: 3 knights (frontline focus)
 * Total cost: 15 points
 *
 * @param team - Team affiliation
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for tank-heavy team
 *
 * @example
 * const tankTeam = createTankTeam('player');
 */
export function createTankTeam(
  team: 'player' | 'enemy' = 'player',
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  const baseY = team === 'player' ? 0 : 9;

  return {
    units: [
      { unitId: 'knight', tier: 1 },
      { unitId: 'knight', tier: 1 },
      { unitId: 'knight', tier: 1 },
    ],
    positions: [
      { x: 2, y: baseY },
      { x: 4, y: baseY },
      { x: 6, y: baseY },
    ],
    ...overrides,
  };
}

/**
 * Create a ranged-heavy team composition.
 *
 * Composition: 2 archers, 1 mage
 * Total cost: 13 points
 *
 * @param team - Team affiliation
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for ranged-heavy team
 *
 * @example
 * const rangedTeam = createRangedTeam('player');
 */
export function createRangedTeam(
  team: 'player' | 'enemy' = 'player',
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  const baseY = team === 'player' ? 0 : 9;
  const offsetY = team === 'player' ? 1 : -1;

  return {
    units: [
      { unitId: 'archer', tier: 1 },
      { unitId: 'archer', tier: 1 },
      { unitId: 'mage', tier: 1 },
    ],
    positions: [
      { x: 2, y: baseY },
      { x: 5, y: baseY },
      { x: 3, y: baseY + offsetY },
    ],
    ...overrides,
  };
}

/**
 * Create a melee-heavy team composition.
 *
 * Composition: 2 rogues, 1 knight
 * Total cost: 12 points
 *
 * @param team - Team affiliation
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup for melee-heavy team
 *
 * @example
 * const meleeTeam = createMeleeTeam('player');
 */
export function createMeleeTeam(
  team: 'player' | 'enemy' = 'player',
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  const baseY = team === 'player' ? 0 : 9;

  return {
    units: [
      { unitId: 'rogue', tier: 1 },
      { unitId: 'rogue', tier: 1 },
      { unitId: 'knight', tier: 1 },
    ],
    positions: [
      { x: 2, y: baseY },
      { x: 4, y: baseY },
      { x: 3, y: baseY },
    ],
    ...overrides,
  };
}

/**
 * Create a single-unit team (for edge case testing).
 *
 * Composition: 1 knight
 * Total cost: 5 points
 *
 * @param team - Team affiliation
 * @param overrides - Partial team setup to override defaults
 * @returns TeamSetup with single unit
 *
 * @example
 * const singleUnitTeam = createSingleUnitTeam('player');
 */
export function createSingleUnitTeam(
  team: 'player' | 'enemy' = 'player',
  overrides: Partial<TeamSetup> = {},
): TeamSetup {
  const baseY = team === 'player' ? 0 : 9;

  return {
    units: [{ unitId: 'knight', tier: 1 }],
    positions: [{ x: 3, y: baseY }],
    ...overrides,
  };
}

/**
 * Create a team with custom unit composition.
 *
 * @param team - Team affiliation
 * @param units - Array of unit setup definitions
 * @param positions - Array of positions (must match units length)
 * @returns TeamSetup with custom composition
 *
 * @example
 * const customTeam = createTeamWithUnits('player',
 *   [
 *     { unitId: 'knight', tier: 2 },
 *     { unitId: 'archer', tier: 1 },
 *   ],
 *   [
 *     { x: 3, y: 0 },
 *     { x: 5, y: 0 },
 *   ]
 * );
 */
export function createTeamWithUnits(
  team: 'player' | 'enemy' = 'player',
  units: TeamSetupUnit[],
  positions?: Position[],
): TeamSetup {
  // Generate default positions if not provided
  const defaultPositions: Position[] = [];
  const baseY = team === 'player' ? 0 : 9;

  for (let i = 0; i < units.length; i++) {
    defaultPositions.push({ x: 2 + i * 2, y: baseY });
  }

  return {
    units,
    positions: positions || defaultPositions,
  };
}

// =============================================================================
// BATTLE UNIT ARRAY FACTORIES
// =============================================================================

/**
 * Create an array of player battle units from a team setup.
 *
 * Converts TeamSetup into actual BattleUnit instances.
 * Used for initializing battle state.
 *
 * @param team - Team setup definition
 * @returns Array of BattleUnit instances
 *
 * @example
 * const teamSetup = createPlayerTeam();
 * const units = createPlayerUnitsFromTeam(teamSetup);
 */
export function createPlayerUnitsFromTeam(team: TeamSetup): BattleUnit[] {
  const units: BattleUnit[] = [];

  for (let i = 0; i < team.units.length; i++) {
    const unitSetup = team.units[i];
    const position = team.positions[i];

    let unit: BattleUnit;
    switch (unitSetup.unitId) {
      case 'knight':
        unit = createPlayerKnight({ position }, i);
        break;
      case 'archer':
        unit = createPlayerArcher({ position }, i);
        break;
      case 'rogue':
        unit = createPlayerRogue({ position }, i);
        break;
      case 'mage':
        unit = createPlayerMage({ position }, i);
        break;
      default:
        unit = createTestUnit({ position }, 'player', i);
    }

    units.push(unit);
  }

  return units;
}

/**
 * Create an array of enemy battle units from a team setup.
 *
 * Converts TeamSetup into actual BattleUnit instances.
 * Used for initializing battle state.
 *
 * @param team - Team setup definition
 * @returns Array of BattleUnit instances
 *
 * @example
 * const teamSetup = createEnemyTeam();
 * const units = createEnemyUnitsFromTeam(teamSetup);
 */
export function createEnemyUnitsFromTeam(team: TeamSetup): BattleUnit[] {
  const units: BattleUnit[] = [];

  for (let i = 0; i < team.units.length; i++) {
    const unitSetup = team.units[i];
    const position = team.positions[i];

    let unit: BattleUnit;
    switch (unitSetup.unitId) {
      case 'knight':
        unit = createEnemyKnight({ position }, i);
        break;
      case 'archer':
        unit = createEnemyArcher({ position }, i);
        break;
      case 'rogue':
        unit = createEnemyRogue({ position }, i);
        break;
      case 'mage':
        unit = createEnemyMage({ position }, i);
        break;
      default:
        unit = createTestUnit({ position }, 'enemy', i);
    }

    units.push(unit);
  }

  return units;
}

/**
 * Create both player and enemy teams as BattleUnit arrays.
 *
 * Convenience function for creating a complete battle setup.
 *
 * @param playerTeamSetup - Player team setup
 * @param enemyTeamSetup - Enemy team setup
 * @returns Object with playerUnits and enemyUnits arrays
 *
 * @example
 * const { playerUnits, enemyUnits } = createBothTeams(
 *   createPlayerTeam(),
 *   createEnemyTeam()
 * );
 */
export function createBothTeams(
  playerTeamSetup: TeamSetup,
  enemyTeamSetup: TeamSetup,
): { playerUnits: BattleUnit[]; enemyUnits: BattleUnit[] } {
  return {
    playerUnits: createPlayerUnitsFromTeam(playerTeamSetup),
    enemyUnits: createEnemyUnitsFromTeam(enemyTeamSetup),
  };
}

// =============================================================================
// TEAM COMPOSITION HELPERS
// =============================================================================

/**
 * Calculate total cost of a team setup.
 *
 * @param team - Team setup
 * @returns Total cost in points
 *
 * @example
 * const team = createPlayerTeam();
 * const cost = getTeamCost(team); // 13
 */
export function getTeamCost(team: TeamSetup): number {
  const unitCosts: Record<string, number> = {
    knight: 5,
    archer: 4,
    rogue: 4,
    mage: 5,
  };

  return team.units.reduce((total, unit) => {
    return total + (unitCosts[unit.unitId] || 5);
  }, 0);
}

/**
 * Get unit count in a team setup.
 *
 * @param team - Team setup
 * @returns Number of units
 *
 * @example
 * const team = createPlayerTeam();
 * const count = getTeamUnitCount(team); // 3
 */
export function getTeamUnitCount(team: TeamSetup): number {
  return team.units.length;
}

/**
 * Check if team setup is valid.
 *
 * Validates:
 * - Units and positions arrays have same length
 * - At least 1 unit
 * - Total cost <= 30 points
 * - All positions are within grid bounds
 *
 * @param team - Team setup
 * @returns true if valid, false otherwise
 *
 * @example
 * const team = createPlayerTeam();
 * if (isValidTeamSetup(team)) {
 *   // Use team
 * }
 */
export function isValidTeamSetup(team: TeamSetup): boolean {
  // Check array lengths match
  if (team.units.length !== team.positions.length) {
    return false;
  }

  // Check at least 1 unit
  if (team.units.length === 0) {
    return false;
  }

  // Check total cost
  if (getTeamCost(team) > 30) {
    return false;
  }

  // Check positions are within grid bounds
  for (const pos of team.positions) {
    if (pos.x < 0 || pos.x > 7 || pos.y < 0 || pos.y > 9) {
      return false;
    }
  }

  return true;
}
