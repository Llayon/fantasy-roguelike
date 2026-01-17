/**
 * Battle Simulator - Main simulation loop.
 *
 * Pure function that simulates a complete battle between two teams.
 * Same inputs + seed = identical output (deterministic).
 *
 * Design goals:
 * - Under 200 lines (main file)
 * - Clear phase flow
 * - Immutable state updates
 * - Full event emission for replay
 *
 * @module simulator
 * @see {@link BattleState} for state structure
 * @see {@link BattleResult} for result structure
 * @see {@link TeamSetup} for team configuration
 */

import {
  BattleState,
  BattleResult,
  TeamSetup,
  BattleEvent,
  createBattleStartEvent,
  createBattleEndEvent,
  createRoundStartEvent,
  createRoundEndEvent,
} from '../core/types';
import { BattleUnit, FacingDirection, UnitFaction } from '../core/types/battle-unit';
import { SeededRandom } from '../core/utils/random';
import { getTeamUnits } from '../core/utils/state-helpers';
import { UNIT_TEMPLATES, UnitId } from '../game/units/unit.data';
import { executeTurn } from './turn';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum rounds before battle ends in draw */
const MAX_ROUNDS = 100;

/** Default max resolve for units */
const DEFAULT_MAX_RESOLVE = 100;

// =============================================================================
// TURN QUEUE BUILDER (adapted for BattleUnit)
// =============================================================================

/**
 * Build turn queue from battle units with deterministic sorting.
 * Sorting rules:
 * 1. Initiative (descending) - higher initiative goes first
 * 2. Speed (descending) - higher speed breaks initiative ties
 * 3. instanceId (ascending) - alphabetical order for complete determinism
 *
 * @param units - Array of battle units
 * @returns Sorted array of alive units in turn order
 */
function buildBattleTurnQueue(units: readonly BattleUnit[]): BattleUnit[] {
  return [...units]
    .filter((unit) => unit.alive)
    .sort((a, b) => {
      // Sort by initiative (descending)
      if (b.stats.initiative !== a.stats.initiative) {
        return b.stats.initiative - a.stats.initiative;
      }
      // Sort by speed (descending)
      if (b.stats.speed !== a.stats.speed) {
        return b.stats.speed - a.stats.speed;
      }
      // Sort by instanceId (ascending) for determinism
      return a.instanceId.localeCompare(b.instanceId);
    });
}

// =============================================================================
// BATTLE INITIALIZATION
// =============================================================================

/**
 * Create a BattleUnit from team setup.
 *
 * @param setup - Unit setup from team configuration
 * @param team - Team affiliation
 * @param index - Unit index for instance ID generation
 * @returns Fully initialized BattleUnit
 */
function createBattleUnit(
  setup: { unitId: string; tier: number },
  team: 'player' | 'enemy',
  index: number,
  position: { x: number; y: number },
): BattleUnit {
  const template = UNIT_TEMPLATES[setup.unitId as UnitId];
  if (!template) {
    throw new Error(`Unknown unit template: ${setup.unitId}`);
  }

  // Apply tier scaling (10% per tier above 1)
  const tierMultiplier = 1 + (setup.tier - 1) * 0.1;
  const scaledHp = Math.floor(template.stats.hp * tierMultiplier);
  const scaledAtk = Math.floor(template.stats.atk * tierMultiplier);

  // Determine initial facing based on team
  const facing: FacingDirection = team === 'player' ? 'S' : 'N';

  return {
    // Identity
    id: template.id,
    instanceId: `${team}_${template.id}_${index}`,
    name: template.name,
    team,

    // Base stats (with tier scaling)
    stats: {
      hp: scaledHp,
      atk: scaledAtk,
      atkCount: template.stats.atkCount,
      armor: template.stats.armor,
      speed: template.stats.speed,
      initiative: template.stats.initiative,
      dodge: template.stats.dodge,
    },
    range: template.range,
    role: template.role,
    cost: template.cost,
    abilities: [...template.abilities],

    // Battle state
    position,
    currentHp: scaledHp,
    maxHp: scaledHp,
    alive: true,

    // Core 2.0 Mechanics
    facing,
    resolve: template.resolve ?? DEFAULT_MAX_RESOLVE,
    maxResolve: DEFAULT_MAX_RESOLVE,
    isRouting: false,
    engaged: false,
    engagedBy: [],
    riposteCharges: template.riposteCharges ?? 1,
    ammo: template.ammo ?? null,
    maxAmmo: template.ammo ?? null,
    momentum: 0,
    armorShred: 0,
    inPhalanx: false,
    tags: [...(template.tags ?? [])],
    faction: (template.faction ?? 'human') as UnitFaction,
  };
}

/**
 * Initialize battle state from team setups.
 *
 * @param playerTeam - Player team configuration
 * @param enemyTeam - Enemy team configuration
 * @param seed - Random seed for determinism
 * @returns Initial battle state
 */
function initializeBattle(
  playerTeam: TeamSetup,
  enemyTeam: TeamSetup,
  seed: number,
): BattleState {
  const battleId = `battle_${seed}_${Date.now()}`;
  const units: BattleUnit[] = [];

  // Create player units
  for (let i = 0; i < playerTeam.units.length; i++) {
    const setup = playerTeam.units[i];
    const position = playerTeam.positions[i];
    if (setup && position) {
      units.push(createBattleUnit(setup, 'player', i, position));
    }
  }

  // Create enemy units
  for (let i = 0; i < enemyTeam.units.length; i++) {
    const setup = enemyTeam.units[i];
    const position = enemyTeam.positions[i];
    if (setup && position) {
      units.push(createBattleUnit(setup, 'enemy', i, position));
    }
  }

  // Build initial turn queue
  const turnQueue = buildBattleTurnQueue(units).map((u) => u.instanceId);

  // Build occupied positions set
  const occupiedPositions = new Set<string>();
  for (const unit of units) {
    occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
  }

  return {
    battleId,
    units,
    round: 1,
    turn: 1,
    currentPhase: 'turn_start',
    events: [],
    occupiedPositions,
    seed,
    turnQueue,
    currentTurnIndex: 0,
  };
}

// =============================================================================
// BATTLE END DETECTION
// =============================================================================

/**
 * Check if battle should end.
 *
 * @param state - Current battle state
 * @returns Battle result if ended, null if battle continues
 */
function checkBattleEnd(state: BattleState): Omit<BattleResult, 'events' | 'finalState'> | null {
  const playerUnits = getTeamUnits(state, 'player');
  const enemyUnits = getTeamUnits(state, 'enemy');

  // Player wins if all enemies are dead
  if (enemyUnits.length === 0) {
    return {
      battleId: state.battleId,
      result: 'win',
      winner: 'player',
      rounds: state.round,
      playerSurvivors: playerUnits.map((u) => u.instanceId),
      enemySurvivors: [],
    };
  }

  // Player loses if all player units are dead
  if (playerUnits.length === 0) {
    return {
      battleId: state.battleId,
      result: 'loss',
      winner: 'enemy',
      rounds: state.round,
      playerSurvivors: [],
      enemySurvivors: enemyUnits.map((u) => u.instanceId),
    };
  }

  // Draw if max rounds reached
  if (state.round > MAX_ROUNDS) {
    return {
      battleId: state.battleId,
      result: 'draw',
      winner: null,
      rounds: MAX_ROUNDS,
      playerSurvivors: playerUnits.map((u) => u.instanceId),
      enemySurvivors: enemyUnits.map((u) => u.instanceId),
    };
  }

  return null;
}

// =============================================================================
// MAIN SIMULATION LOOP
// =============================================================================

/**
 * Main battle simulation function.
 * Pure function - same inputs always produce same outputs.
 *
 * @param playerTeam - Player's team setup
 * @param enemyTeam - Enemy team setup (snapshot or bot)
 * @param seed - Random seed for determinism
 * @returns Battle result with events and final state
 *
 * @example
 * const result = simulateBattle(
 *   { units: [{ unitId: 'knight', tier: 1 }], positions: [{ x: 3, y: 0 }] },
 *   { units: [{ unitId: 'rogue', tier: 1 }], positions: [{ x: 3, y: 9 }] },
 *   12345
 * );
 * console.log(result.result); // 'win' | 'loss' | 'draw'
 */
export function simulateBattle(
  playerTeam: TeamSetup,
  enemyTeam: TeamSetup,
  seed: number,
): BattleResult {
  // Initialize RNG and state
  const rng = new SeededRandom(seed);
  let state = initializeBattle(playerTeam, enemyTeam, seed);
  const allEvents: BattleEvent[] = [];

  // Emit battle start event
  const startEvent = createBattleStartEvent(
    { round: 1, turn: 0, phase: 'turn_start' },
    {
      battleId: state.battleId,
      seed,
      playerUnitCount: playerTeam.units.length,
      enemyUnitCount: enemyTeam.units.length,
    },
  );
  allEvents.push(startEvent);

  // Main simulation loop
  while (state.round <= MAX_ROUNDS) {
    // Check for battle end at start of each round
    const endCheck = checkBattleEnd(state);
    if (endCheck) {
      break;
    }

    // Emit round start event
    const roundStartEvent = createRoundStartEvent(
      { round: state.round, turn: 0, phase: 'turn_start' },
      { roundNumber: state.round, turnQueueOrder: [...state.turnQueue] },
    );
    allEvents.push(roundStartEvent);

    // Execute all turns in this round
    const { state: newState, events: turnEvents } = executeRound(state, rng);
    state = newState;
    allEvents.push(...turnEvents);

    // Emit round end event
    const playerAlive = getTeamUnits(state, 'player').length;
    const enemyAlive = getTeamUnits(state, 'enemy').length;
    const roundEndEvent = createRoundEndEvent(
      { round: state.round, turn: state.turn, phase: 'turn_end' },
      { roundNumber: state.round, playerUnitsAlive: playerAlive, enemyUnitsAlive: enemyAlive },
    );
    allEvents.push(roundEndEvent);

    // Advance to next round
    state = advanceRound(state);
  }

  // Determine final result
  const finalResult = checkBattleEnd(state) ?? {
    battleId: state.battleId,
    result: 'draw' as const,
    winner: null,
    rounds: MAX_ROUNDS,
    playerSurvivors: getTeamUnits(state, 'player').map((u) => u.instanceId),
    enemySurvivors: getTeamUnits(state, 'enemy').map((u) => u.instanceId),
  };

  // Emit battle end event
  const endEvent = createBattleEndEvent(
    { round: state.round, turn: state.turn, phase: 'turn_end' },
    {
      result: finalResult.result,
      winner: finalResult.winner,
      totalRounds: finalResult.rounds,
      playerSurvivors: finalResult.playerSurvivors.length,
      enemySurvivors: finalResult.enemySurvivors.length,
    },
  );
  allEvents.push(endEvent);

  return {
    ...finalResult,
    events: allEvents,
    finalState: { ...state, events: allEvents },
  };
}

// =============================================================================
// ROUND EXECUTION
// =============================================================================

/**
 * Execute all turns in a round.
 *
 * @param state - Current battle state
 * @param rng - Seeded random generator
 * @returns Updated state and events from all turns
 */
function executeRound(
  state: BattleState,
  rng: SeededRandom,
): { state: BattleState; events: BattleEvent[] } {
  let currentState = state;
  const roundEvents: BattleEvent[] = [];

  // Process each unit in turn queue
  while (currentState.currentTurnIndex < currentState.turnQueue.length) {
    const unitId = currentState.turnQueue[currentState.currentTurnIndex];
    if (!unitId) {
      currentState = { ...currentState, currentTurnIndex: currentState.currentTurnIndex + 1 };
      continue;
    }

    // Find the unit
    const unit = currentState.units.find((u) => u.instanceId === unitId);
    if (!unit || !unit.alive) {
      currentState = { ...currentState, currentTurnIndex: currentState.currentTurnIndex + 1 };
      continue;
    }

    // Execute turn for this unit
    const { state: newState, events: turnEvents } = executeTurn(currentState, unitId, rng);
    currentState = newState;
    roundEvents.push(...turnEvents);

    // Check for battle end after each turn
    const endCheck = checkBattleEnd(currentState);
    if (endCheck) {
      break;
    }

    // Advance to next unit
    currentState = { ...currentState, currentTurnIndex: currentState.currentTurnIndex + 1 };
  }

  return { state: currentState, events: roundEvents };
}

/**
 * Advance to next round.
 *
 * @param state - Current battle state
 * @returns State with incremented round and rebuilt turn queue
 */
function advanceRound(state: BattleState): BattleState {
  // Rebuild turn queue with alive units
  const aliveUnits = state.units.filter((u) => u.alive);
  const newTurnQueue = buildBattleTurnQueue(aliveUnits).map((u) => u.instanceId);

  return {
    ...state,
    round: state.round + 1,
    turn: 1,
    currentTurnIndex: 0,
    turnQueue: newTurnQueue,
  };
}

// =============================================================================
// TURN EXECUTION (imported from turn.ts)
// =============================================================================

// Re-export executeTurn from turn module
export { executeTurn } from './turn';

// =============================================================================
// EXPORTS
// =============================================================================

export { initializeBattle, checkBattleEnd, createBattleUnit };
