/**
 * Test fixtures for BattleState creation.
 *
 * Provides factory functions for creating test battle states with various configurations.
 * Used for testing state management, phase handlers, and mechanics processors.
 *
 * @module __tests__/fixtures/states
 * @see {@link BattleState} for state type definition
 * @see {@link BattleUnit} for unit type definition
 *
 * @example
 * import { createTestBattleState, createSimpleBattleState } from './fixtures/states';
 *
 * // Create a basic battle state
 * const state = createTestBattleState();
 *
 * // Create with custom units
 * const customState = createTestBattleState([
 *   createPlayerKnight(),
 *   createEnemyArcher(),
 * ]);
 *
 * // Create a simple 1v1 state
 * const simpleState = createSimpleBattleState();
 */

import { BattleState, Phase, PHASE_ORDER } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { BattleEvent } from '../../core/types/events';
import {
  createPlayerKnight,
  createEnemyKnight,
  createPlayerArcher,
  createEnemyArcher,
  createTestUnit,
} from './units';
import {
  createPlayerTeam,
  createEnemyTeam,
  createPlayerUnitsFromTeam,
  createEnemyUnitsFromTeam,
} from './teams';

// =============================================================================
// BATTLE STATE FACTORIES
// =============================================================================

/**
 * Create a minimal test battle state.
 *
 * Default: 1 player knight vs 1 enemy knight
 * Round 1, Turn 1, turn_start phase
 *
 * @param units - Custom units array (default: 1v1 knights)
 * @param overrides - Partial state properties to override
 * @returns Complete BattleState
 *
 * @example
 * // Create default 1v1 state
 * const state = createTestBattleState();
 *
 * // Create with custom units
 * const state = createTestBattleState([
 *   createPlayerKnight(),
 *   createPlayerArcher(),
 *   createEnemyKnight(),
 * ]);
 *
 * // Create with custom properties
 * const state = createTestBattleState([], { round: 5, turn: 3 });
 */
export function createTestBattleState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  // Use default units if none provided
  if (units.length === 0) {
    units = [createPlayerKnight(), createEnemyKnight()];
  }

  // Build turn queue from alive units, sorted by initiative DESC
  const turnQueue = units
    .filter((u) => u.alive)
    .sort((a, b) => {
      if (b.stats.initiative !== a.stats.initiative) {
        return b.stats.initiative - a.stats.initiative;
      }
      return a.instanceId.localeCompare(b.instanceId);
    })
    .map((u) => u.instanceId);

  // Build occupied positions set
  const occupiedPositions = new Set<string>();
  for (const unit of units) {
    if (unit.alive) {
      occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
    }
  }

  return {
    battleId: 'test_battle',
    units,
    round: 1,
    turn: 1,
    currentPhase: 'turn_start' as Phase,
    events: [],
    occupiedPositions,
    seed: 12345,
    turnQueue,
    currentTurnIndex: 0,
    ...overrides,
  };
}

/**
 * Create a simple 1v1 battle state (player knight vs enemy knight).
 *
 * Useful for basic mechanic testing.
 *
 * @param overrides - Partial state properties to override
 * @returns BattleState with 1v1 setup
 *
 * @example
 * const state = createSimpleBattleState();
 * const state = createSimpleBattleState({ round: 3 });
 */
export function createSimpleBattleState(
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState(
    [createPlayerKnight(), createEnemyKnight()],
    overrides,
  );
}

/**
 * Create a balanced team battle state.
 *
 * Default: 3v3 with balanced compositions
 * Player: knight, archer, rogue
 * Enemy: knight, archer, rogue
 *
 * @param overrides - Partial state properties to override
 * @returns BattleState with balanced teams
 *
 * @example
 * const state = createBalancedBattleState();
 */
export function createBalancedBattleState(
  overrides: Partial<BattleState> = {},
): BattleState {
  const playerTeam = createPlayerTeam();
  const enemyTeam = createEnemyTeam();

  const playerUnits = createPlayerUnitsFromTeam(playerTeam);
  const enemyUnits = createEnemyUnitsFromTeam(enemyTeam);

  return createTestBattleState([...playerUnits, ...enemyUnits], overrides);
}

/**
 * Create a battle state with custom team setups.
 *
 * @param playerUnits - Player team units
 * @param enemyUnits - Enemy team units
 * @param overrides - Partial state properties to override
 * @returns BattleState with custom teams
 *
 * @example
 * const state = createBattleStateWithTeams(
 *   [createPlayerKnight(), createPlayerArcher()],
 *   [createEnemyKnight(), createEnemyArcher()]
 * );
 */
export function createBattleStateWithTeams(
  playerUnits: BattleUnit[],
  enemyUnits: BattleUnit[],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState([...playerUnits, ...enemyUnits], overrides);
}

// =============================================================================
// PHASE-SPECIFIC STATE FACTORIES
// =============================================================================

/**
 * Create a battle state at a specific phase.
 *
 * @param phase - Target phase
 * @param units - Units array (default: 1v1 knights)
 * @param overrides - Partial state properties to override
 * @returns BattleState at specified phase
 *
 * @example
 * const attackState = createStateAtPhase('attack');
 * const turnEndState = createStateAtPhase('turn_end');
 */
export function createStateAtPhase(
  phase: Phase,
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState(units, {
    currentPhase: phase,
    ...overrides,
  });
}

/**
 * Create a battle state at turn_start phase.
 *
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at turn_start
 */
export function createTurnStartState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createStateAtPhase('turn_start', units, overrides);
}

/**
 * Create a battle state at movement phase.
 *
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at movement
 */
export function createMovementState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createStateAtPhase('movement', units, overrides);
}

/**
 * Create a battle state at attack phase.
 *
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at attack
 */
export function createAttackState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createStateAtPhase('attack', units, overrides);
}

/**
 * Create a battle state at turn_end phase.
 *
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at turn_end
 */
export function createTurnEndState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createStateAtPhase('turn_end', units, overrides);
}

// =============================================================================
// ROUND/TURN STATE FACTORIES
// =============================================================================

/**
 * Create a battle state at a specific round and turn.
 *
 * @param round - Target round number
 * @param turn - Target turn number
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at specified round/turn
 *
 * @example
 * const state = createStateAtRoundTurn(5, 3);
 */
export function createStateAtRoundTurn(
  round: number,
  turn: number,
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState(units, {
    round,
    turn,
    ...overrides,
  });
}

/**
 * Create a battle state at a late round (for endurance testing).
 *
 * Default: Round 50, Turn 1
 *
 * @param round - Round number (default: 50)
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at late round
 *
 * @example
 * const state = createLateRoundState();
 * const state = createLateRoundState(75);
 */
export function createLateRoundState(
  round: number = 50,
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createStateAtRoundTurn(round, 1, units, overrides);
}

// =============================================================================
// TURN QUEUE STATE FACTORIES
// =============================================================================

/**
 * Create a battle state with a specific turn queue index.
 *
 * @param currentTurnIndex - Index in turn queue
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState with specified turn index
 *
 * @example
 * const state = createStateWithTurnIndex(2);
 */
export function createStateWithTurnIndex(
  currentTurnIndex: number,
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState(units, {
    currentTurnIndex,
    ...overrides,
  });
}

/**
 * Create a battle state where it's the last unit's turn.
 *
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState at last turn in queue
 *
 * @example
 * const state = createLastTurnState([unit1, unit2, unit3]);
 */
export function createLastTurnState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  if (units.length === 0) {
    units = [createPlayerKnight(), createEnemyKnight()];
  }

  const turnQueue = units
    .filter((u) => u.alive)
    .sort((a, b) => {
      if (b.stats.initiative !== a.stats.initiative) {
        return b.stats.initiative - a.stats.initiative;
      }
      return a.instanceId.localeCompare(b.instanceId);
    })
    .map((u) => u.instanceId);

  return createTestBattleState(units, {
    currentTurnIndex: Math.max(0, turnQueue.length - 1),
    ...overrides,
  });
}

// =============================================================================
// EVENT HISTORY STATE FACTORIES
// =============================================================================

/**
 * Create a battle state with event history.
 *
 * @param events - Array of events to add to state
 * @param units - Units array
 * @param overrides - Partial state properties to override
 * @returns BattleState with events
 *
 * @example
 * const state = createStateWithEvents([
 *   { type: 'turn_start', ... },
 *   { type: 'attack', ... },
 * ]);
 */
export function createStateWithEvents(
  events: BattleEvent[],
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState(units, {
    events,
    ...overrides,
  });
}

// =============================================================================
// EDGE CASE STATE FACTORIES
// =============================================================================

/**
 * Create a battle state where one team is eliminated.
 *
 * All enemy units are dead.
 *
 * @param overrides - Partial state properties to override
 * @returns BattleState with player victory condition
 *
 * @example
 * const state = createPlayerVictoryState();
 */
export function createPlayerVictoryState(
  overrides: Partial<BattleState> = {},
): BattleState {
  const playerUnit = createPlayerKnight();
  const deadEnemy = createEnemyKnight({ alive: false, currentHp: 0 });

  return createTestBattleState([playerUnit, deadEnemy], {
    turnQueue: [playerUnit.instanceId],
    ...overrides,
  });
}

/**
 * Create a battle state where enemy team is winning.
 *
 * All player units are dead.
 *
 * @param overrides - Partial state properties to override
 * @returns BattleState with enemy victory condition
 *
 * @example
 * const state = createEnemyVictoryState();
 */
export function createEnemyVictoryState(
  overrides: Partial<BattleState> = {},
): BattleState {
  const deadPlayer = createPlayerKnight({ alive: false, currentHp: 0 });
  const enemyUnit = createEnemyKnight();

  return createTestBattleState([deadPlayer, enemyUnit], {
    turnQueue: [enemyUnit.instanceId],
    ...overrides,
  });
}

/**
 * Create a battle state with only one unit alive (edge case).
 *
 * @param unit - The surviving unit
 * @param overrides - Partial state properties to override
 * @returns BattleState with single survivor
 *
 * @example
 * const state = createSingleSurvivorState(createPlayerKnight());
 */
export function createSingleSurvivorState(
  unit: BattleUnit,
  overrides: Partial<BattleState> = {},
): BattleState {
  return createTestBattleState([unit], {
    turnQueue: [unit.instanceId],
    ...overrides,
  });
}

/**
 * Create a battle state with all units at low HP.
 *
 * All units have 10% of max HP remaining.
 *
 * @param units - Units array (default: 1v1 knights)
 * @param overrides - Partial state properties to override
 * @returns BattleState with low HP units
 *
 * @example
 * const state = createLowHpState();
 */
export function createLowHpState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  if (units.length === 0) {
    units = [createPlayerKnight(), createEnemyKnight()];
  }

  const lowHpUnits = units.map((u) => ({
    ...u,
    currentHp: Math.max(1, Math.floor(u.maxHp * 0.1)),
  }));

  return createTestBattleState(lowHpUnits, overrides);
}

/**
 * Create a battle state with all units at full HP.
 *
 * Useful for testing fresh battle scenarios.
 *
 * @param units - Units array (default: 1v1 knights)
 * @param overrides - Partial state properties to override
 * @returns BattleState with full HP units
 *
 * @example
 * const state = createFullHpState();
 */
export function createFullHpState(
  units: BattleUnit[] = [],
  overrides: Partial<BattleState> = {},
): BattleState {
  if (units.length === 0) {
    units = [createPlayerKnight(), createEnemyKnight()];
  }

  const fullHpUnits = units.map((u) => ({
    ...u,
    currentHp: u.maxHp,
  }));

  return createTestBattleState(fullHpUnits, overrides);
}

// =============================================================================
// STATE VALIDATION HELPERS
// =============================================================================

/**
 * Validate that a battle state is internally consistent.
 *
 * Checks:
 * - All units have valid HP bounds
 * - Alive status matches HP
 * - Turn queue contains only alive units
 * - Occupied positions match alive units
 * - Current turn index is within bounds
 *
 * @param state - BattleState to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * const state = createTestBattleState();
 * if (isValidBattleState(state)) {
 *   // Use state
 * }
 */
export function isValidBattleState(state: BattleState): boolean {
  // Check HP bounds
  for (const unit of state.units) {
    if (unit.currentHp < 0 || unit.currentHp > unit.maxHp) {
      return false;
    }
    if (unit.alive !== (unit.currentHp > 0)) {
      return false;
    }
  }

  // Check turn queue contains only alive units
  const aliveIds = new Set(state.units.filter((u) => u.alive).map((u) => u.instanceId));
  for (const unitId of state.turnQueue) {
    if (!aliveIds.has(unitId)) {
      return false;
    }
  }

  // Check occupied positions match alive units
  const expectedPositions = new Set<string>();
  for (const unit of state.units) {
    if (unit.alive) {
      expectedPositions.add(`${unit.position.x},${unit.position.y}`);
    }
  }
  if (expectedPositions.size !== state.occupiedPositions.size) {
    return false;
  }
  for (const pos of expectedPositions) {
    if (!state.occupiedPositions.has(pos)) {
      return false;
    }
  }

  // Check current turn index
  if (state.currentTurnIndex < 0 || state.currentTurnIndex >= state.turnQueue.length) {
    return false;
  }

  return true;
}

/**
 * Get the current acting unit from a battle state.
 *
 * @param state - BattleState
 * @returns Current unit or undefined if no valid turn
 *
 * @example
 * const state = createTestBattleState();
 * const currentUnit = getCurrentUnit(state);
 */
export function getCurrentUnit(state: BattleState): BattleUnit | undefined {
  const currentUnitId = state.turnQueue[state.currentTurnIndex];
  return state.units.find((u) => u.instanceId === currentUnitId);
}

/**
 * Get all alive units from a battle state.
 *
 * @param state - BattleState
 * @returns Array of alive units
 *
 * @example
 * const state = createTestBattleState();
 * const alive = getAliveUnits(state);
 */
export function getAliveUnits(state: BattleState): BattleUnit[] {
  return state.units.filter((u) => u.alive);
}

/**
 * Get all dead units from a battle state.
 *
 * @param state - BattleState
 * @returns Array of dead units
 *
 * @example
 * const state = createTestBattleState();
 * const dead = getDeadUnits(state);
 */
export function getDeadUnits(state: BattleState): BattleUnit[] {
  return state.units.filter((u) => !u.alive);
}

/**
 * Get all units of a specific team.
 *
 * @param state - BattleState
 * @param team - Team affiliation
 * @returns Array of units on that team
 *
 * @example
 * const state = createTestBattleState();
 * const playerUnits = getTeamUnits(state, 'player');
 */
export function getTeamUnits(
  state: BattleState,
  team: 'player' | 'enemy',
): BattleUnit[] {
  return state.units.filter((u) => u.team === team);
}
