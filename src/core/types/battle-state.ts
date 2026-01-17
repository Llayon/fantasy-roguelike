/**
 * Battle state type definitions for the Core 2.0 battle engine.
 * Contains the immutable BattleState interface, Phase types, and PhaseContext.
 *
 * This module provides the core data structures for battle simulation:
 * - {@link BattleState} - Complete battle state (immutable)
 * - {@link Phase} - Turn phase identifiers
 * - {@link PhaseContext} - Context passed to mechanics processors
 * - {@link BattleResult} - Battle outcome data
 *
 * @module core/types/battle-state
 * @see {@link BattleUnit} for unit type definitions
 * @see {@link Position} for grid position type
 * @see {@link events} for event type definitions
 *
 * @example
 * import { BattleState, Phase, PhaseContext } from './battle-state';
 *
 * // Create initial battle state
 * const state: BattleState = {
 *   battleId: 'battle_001',
 *   units: [...playerUnits, ...enemyUnits],
 *   round: 1,
 *   turn: 1,
 *   currentPhase: 'turn_start',
 *   events: [],
 *   occupiedPositions: new Set(['3,0', '4,1']),
 *   seed: 12345,
 *   turnQueue: ['unit_1', 'unit_2'],
 *   currentTurnIndex: 0,
 * };
 */

import { BattleUnit } from './battle-unit';
import { Position } from './grid.types';
import { BattleEvent, Phase } from './events';

// Re-export Phase from events for backward compatibility
export { Phase } from './events';

// =============================================================================
// PHASE ORDER CONSTANT
// =============================================================================

/**
 * Ordered array of phases for validation and iteration.
 * Events must be emitted in this strict order within a turn.
 *
 * This constant defines the canonical order of phase execution.
 * Use it for:
 * - Validating phase transitions
 * - Iterating through phases in order
 * - Checking if a phase comes before/after another
 *
 * @invariant Phase order is immutable and must be followed exactly
 * @see {@link Phase} for phase type definition
 *
 * @example
 * // Validate phase transition
 * function canTransition(from: Phase, to: Phase): boolean {
 *   const fromIndex = PHASE_ORDER.indexOf(from);
 *   const toIndex = PHASE_ORDER.indexOf(to);
 *   return toIndex === fromIndex + 1 || (from === 'turn_end' && to === 'turn_start');
 * }
 *
 * // Get next phase
 * function getNextPhase(current: Phase): Phase | null {
 *   const index = PHASE_ORDER.indexOf(current);
 *   return index < PHASE_ORDER.length - 1 ? PHASE_ORDER[index + 1] : null;
 * }
 */
export const PHASE_ORDER: readonly Phase[] = [
  'turn_start',
  'ai_decision',
  'movement',
  'pre_attack',
  'attack',
  'post_attack',
  'turn_end',
] as const;

// =============================================================================
// BATTLE ACTION TYPES
// =============================================================================

/**
 * Action types that a unit can perform during their turn.
 *
 * - `attack` - Attack a target unit (requires targetId)
 * - `move` - Move to a target position (requires targetPosition)
 * - `ability` - Use a special ability (requires abilityId, may require targetId)
 * - `skip` - Skip the turn (e.g., when routing or no valid actions)
 *
 * @see {@link BattleAction} for the full action interface
 */
export type BattleActionType = 'attack' | 'move' | 'ability' | 'skip';

/**
 * Battle action representing a unit's decision for their turn.
 *
 * Actions are determined during the `ai_decision` phase and executed
 * in subsequent phases. Each action type has specific required fields.
 *
 * @see {@link BattleActionType} for action type definitions
 * @see {@link PhaseContext.action} for how actions are passed to phase handlers
 *
 * @example
 * // Attack action - requires targetId
 * const attackAction: BattleAction = {
 *   type: 'attack',
 *   actorId: 'player_knight_0',
 *   targetId: 'enemy_rogue_0',
 * };
 *
 * // Move action - requires targetPosition
 * const moveAction: BattleAction = {
 *   type: 'move',
 *   actorId: 'player_archer_0',
 *   targetPosition: { x: 5, y: 3 },
 * };
 *
 * // Ability action - requires abilityId, may require targetId
 * const abilityAction: BattleAction = {
 *   type: 'ability',
 *   actorId: 'player_mage_0',
 *   abilityId: 'fireball',
 *   targetId: 'enemy_knight_0',
 * };
 *
 * // Skip action - no additional fields required
 * const skipAction: BattleAction = {
 *   type: 'skip',
 *   actorId: 'player_routing_unit_0',
 * };
 */
export interface BattleAction {
  /** Type of action being performed */
  type: BattleActionType;

  /** Instance ID of the unit performing the action */
  actorId: string;

  /**
   * Target unit instance ID (for attack/ability actions).
   * Required for 'attack' action, optional for 'ability' action.
   */
  targetId?: string;

  /**
   * Target position (for move actions).
   * Required for 'move' action.
   */
  targetPosition?: Position;

  /**
   * Ability ID (for ability actions).
   * Required for 'ability' action.
   */
  abilityId?: string;
}

// =============================================================================
// PHASE CONTEXT
// =============================================================================

/**
 * Context passed to mechanics processors during phase execution.
 * Contains all information needed to process a phase for a specific unit.
 *
 * PhaseContext is created at the start of each phase and passed to all
 * mechanics processors. Processors read from the state and return updated
 * state and events.
 *
 * @see {@link Phase} for phase definitions
 * @see {@link BattleAction} for action structure
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for processor return type
 *
 * @example
 * // Context for attack phase
 * const attackContext: PhaseContext = {
 *   phase: 'attack',
 *   actorId: 'player_knight_0',
 *   targetId: 'enemy_rogue_0',
 *   action: {
 *     type: 'attack',
 *     actorId: 'player_knight_0',
 *     targetId: 'enemy_rogue_0',
 *   },
 *   state: currentBattleState,
 * };
 *
 * // Context for movement phase
 * const moveContext: PhaseContext = {
 *   phase: 'movement',
 *   actorId: 'player_archer_0',
 *   targetPosition: { x: 5, y: 3 },
 *   action: {
 *     type: 'move',
 *     actorId: 'player_archer_0',
 *     targetPosition: { x: 5, y: 3 },
 *   },
 *   state: currentBattleState,
 * };
 */
export interface PhaseContext {
  /**
   * Current phase being executed.
   * Determines which mechanics processors are invoked.
   */
  phase: Phase;

  /**
   * Instance ID of the unit whose turn is being executed.
   * This unit is the "actor" for all events in this phase.
   */
  actorId: string;

  /**
   * Target unit instance ID (if applicable).
   * Set for attack and some ability actions.
   */
  targetId?: string;

  /**
   * Target position (if applicable).
   * Set for move actions.
   */
  targetPosition?: Position;

  /**
   * The action being executed (if in action phases).
   * Set after ai_decision phase completes.
   */
  action?: BattleAction;

  /**
   * Current battle state (immutable).
   * Processors read from this state and return a new state.
   */
  state: BattleState;
}

// =============================================================================
// BATTLE STATE
// =============================================================================

/**
 * Immutable battle state containing all information about the current battle.
 *
 * This interface represents the complete state of a battle at any point in time.
 * All state updates must create new objects rather than mutating existing ones.
 *
 * ## Invariants
 *
 * The following invariants must hold at all times:
 *
 * 1. **HP Bounds**: `∀ unit ∈ units: 0 ≤ unit.currentHp ≤ unit.maxHp`
 * 2. **Alive Consistency**: `∀ unit ∈ units: unit.alive ⟺ unit.currentHp > 0`
 * 3. **Facing Validity**: `∀ unit ∈ units: unit.facing ∈ {'N', 'S', 'E', 'W'}`
 * 4. **Ammo Non-Negative**: `∀ unit ∈ units: unit.ammo === null ∨ unit.ammo ≥ 0`
 * 5. **Resolve Bounds**: `∀ unit ∈ units: 0 ≤ unit.resolve ≤ unit.maxResolve`
 * 6. **Position Validity**: `∀ unit ∈ units: 0 ≤ unit.position.x ≤ 7 ∧ 0 ≤ unit.position.y ≤ 9`
 * 7. **Position Uniqueness**: `∀ u1, u2 ∈ units: u1.alive ∧ u2.alive ∧ u1 ≠ u2 ⟹ u1.position ≠ u2.position`
 * 8. **Round Monotonicity**: `round` is monotonically increasing
 * 9. **Event Ordering**: `∀ e1, e2 ∈ events: e1.timestamp < e2.timestamp ⟹ e1 occurred before e2`
 * 10. **Immutability**: State updates create new objects, never mutate existing
 *
 * @example
 * const battleState: BattleState = {
 *   battleId: 'battle_abc123',
 *   units: [playerKnight, playerArcher, enemyRogue, enemyMage],
 *   round: 3,
 *   turn: 7,
 *   currentPhase: 'attack',
 *   events: [...previousEvents],
 *   occupiedPositions: new Set(['3,1', '4,2', '5,8', '2,9']),
 *   seed: 12345,
 *   turnQueue: ['player_knight_0', 'enemy_rogue_0', 'player_archer_0', 'enemy_mage_0'],
 *   currentTurnIndex: 0,
 * };
 */
export interface BattleState {
  /**
   * Unique identifier for this battle.
   * Used for logging, debugging, and database references.
   */
  battleId: string;

  /**
   * All units participating in the battle (both teams).
   * Includes dead units (with alive = false) for event history.
   *
   * @invariant Array is immutable - updates create new arrays
   */
  readonly units: readonly BattleUnit[];

  /**
   * Current round number (1-based).
   * Increments when all units have taken their turn.
   *
   * @invariant round >= 1
   * @invariant round <= MAX_ROUNDS (100)
   */
  round: number;

  /**
   * Current turn number within the round (1-based).
   * Resets to 1 at the start of each round.
   *
   * @invariant turn >= 1
   * @invariant turn <= units.filter(u => u.alive).length
   */
  turn: number;

  /**
   * Current phase being executed.
   * Updated as the turn progresses through phases.
   */
  currentPhase: Phase;

  /**
   * All events that have occurred in this battle.
   * Events are appended in chronological order.
   *
   * @invariant Array is immutable - updates create new arrays
   * @invariant Events are ordered by timestamp
   */
  readonly events: readonly BattleEvent[];

  /**
   * Set of occupied grid positions.
   * Format: "x,y" (e.g., "3,1").
   * Used for quick collision detection.
   *
   * @invariant Contains positions of all alive units
   * @invariant Updated when units move or die
   */
  readonly occupiedPositions: ReadonlySet<string>;

  /**
   * Random seed for deterministic simulation.
   * Same seed + same inputs = identical battle outcome.
   */
  seed: number;

  /**
   * Ordered list of unit instance IDs for turn execution.
   * Sorted by initiative (descending), ties broken by instanceId.
   * Rebuilt at the start of each round.
   * Dead units are removed immediately.
   *
   * @invariant Contains only alive units
   * @invariant Sorted by initiative DESC, then instanceId ASC
   */
  readonly turnQueue: readonly string[];

  /**
   * Current index in the turn queue.
   * Points to the unit whose turn is being executed.
   *
   * @invariant 0 <= currentTurnIndex < turnQueue.length
   */
  currentTurnIndex: number;
}

// =============================================================================
// BATTLE RESULT
// =============================================================================

/**
 * Result of a completed battle simulation.
 *
 * Contains all information needed for:
 * - Displaying battle outcome to the player
 * - Updating run progression (wins/losses)
 * - Replaying the battle (via events)
 * - Calculating rewards
 *
 * @see {@link BattleState} for state during battle
 * @see {@link BattleEvent} for event structure
 * @see {@link FinalUnitState} for survivor information
 *
 * @example
 * const result: BattleResult = {
 *   battleId: 'battle_abc123',
 *   result: 'win',
 *   winner: 'player',
 *   rounds: 15,
 *   events: [...allEvents],
 *   finalState: endState,
 *   playerSurvivors: ['player_knight_0', 'player_archer_0'],
 *   enemySurvivors: [],
 * };
 *
 * // Process battle result
 * if (result.result === 'win') {
 *   console.log(`Victory in ${result.rounds} rounds!`);
 *   console.log(`Survivors: ${result.playerSurvivors.length}`);
 * }
 */
export interface BattleResult {
  /** Battle identifier */
  battleId: string;

  /** Battle outcome */
  result: 'win' | 'loss' | 'draw';

  /** Winning team (null for draw) */
  winner: 'player' | 'enemy' | null;

  /** Total rounds played */
  rounds: number;

  /** All events from the battle */
  events: readonly BattleEvent[];

  /** Final battle state */
  finalState: BattleState;

  /** Instance IDs of surviving player units */
  playerSurvivors: readonly string[];

  /** Instance IDs of surviving enemy units */
  enemySurvivors: readonly string[];
}

// =============================================================================
// PHASE HANDLER RESULT
// =============================================================================

/**
 * Result returned by phase handlers.
 * Contains the updated state and any events generated.
 *
 * Phase handlers must return a new state object (immutable update)
 * and an array of events generated during the phase.
 *
 * @see {@link PhaseContext} for input to phase handlers
 * @see {@link BattleState} for state structure
 * @see {@link BattleEvent} for event structure
 *
 * @example
 * function handleTurnStart(state: BattleState, unitId: string): PhaseResult {
 *   const unit = state.units.find(u => u.instanceId === unitId);
 *   if (!unit) return { state, events: [] };
 *
 *   // Regenerate resolve
 *   const newResolve = Math.min(unit.resolve + 5, unit.maxResolve);
 *   const updatedUnit = { ...unit, resolve: newResolve };
 *   const updatedUnits = state.units.map(u =>
 *     u.instanceId === unitId ? updatedUnit : u
 *   );
 *
 *   return {
 *     state: { ...state, units: updatedUnits },
 *     events: [{
 *       type: 'resolve_changed',
 *       round: state.round,
 *       turn: state.turn,
 *       phase: 'turn_start',
 *       timestamp: Date.now(),
 *       actorId: unitId,
 *       metadata: { unitId, delta: 5, newValue: newResolve, source: 'regeneration' },
 *     }],
 *   };
 * }
 */
export interface PhaseResult {
  /**
   * Updated battle state after phase execution.
   * Must be a new object (immutable update).
   */
  state: BattleState;

  /**
   * Events generated during phase execution.
   * Will be appended to state.events.
   */
  events: BattleEvent[];
}

// =============================================================================
// TEAM SETUP
// =============================================================================

/**
 * Team configuration for battle initialization.
 *
 * Used to set up teams before battle simulation begins.
 * Units and positions arrays must have the same length.
 *
 * @see {@link TeamSetupUnit} for unit configuration
 * @see {@link Position} for position type
 *
 * @example
 * const playerTeam: TeamSetup = {
 *   units: [
 *     { unitId: 'knight', tier: 2 },
 *     { unitId: 'archer', tier: 1 },
 *     { unitId: 'mage', tier: 1 },
 *   ],
 *   positions: [
 *     { x: 3, y: 0 },  // Knight at front
 *     { x: 5, y: 1 },  // Archer behind
 *     { x: 4, y: 1 },  // Mage behind
 *   ],
 * };
 *
 * // Validate team setup
 * function isValidTeamSetup(team: TeamSetup): boolean {
 *   return team.units.length === team.positions.length &&
 *          team.units.length > 0;
 * }
 */
export interface TeamSetup {
  /** Units in the team */
  units: readonly TeamSetupUnit[];

  /** Positions for each unit (same order as units array) */
  positions: readonly Position[];
}

/**
 * Unit configuration for team setup.
 *
 * @see {@link TeamSetup} for team configuration
 */
export interface TeamSetupUnit {
  /**
   * Unit template ID (e.g., 'knight', 'archer').
   * Must match a valid unit definition in the game data.
   */
  unitId: string;

  /**
   * Upgrade tier (1-3).
   * Higher tiers have improved stats.
   *
   * @invariant 1 <= tier <= 3
   */
  tier: number;
}

// =============================================================================
// FINAL UNIT STATE
// =============================================================================

/**
 * Simplified unit state for battle result reporting.
 *
 * Contains only the essential information needed for post-battle
 * processing and display. Used in {@link BattleResult}.
 *
 * @see {@link BattleResult} for battle outcome data
 * @see {@link BattleUnit} for full unit state during battle
 *
 * @example
 * const finalUnit: FinalUnitState = {
 *   instanceId: 'player_knight_0',
 *   unitId: 'knight',
 *   alive: true,
 *   currentHp: 45,
 *   maxHp: 100,
 *   position: { x: 5, y: 4 },
 * };
 *
 * // Check if unit survived
 * if (finalUnit.alive) {
 *   console.log(`${finalUnit.unitId} survived with ${finalUnit.currentHp}/${finalUnit.maxHp} HP`);
 * }
 */
export interface FinalUnitState {
  /** Unique instance identifier */
  instanceId: string;

  /** Unit template ID */
  unitId: string;

  /** Whether unit survived */
  alive: boolean;

  /** Final HP (0 if dead) */
  currentHp: number;

  /** Maximum HP */
  maxHp: number;

  /** Final position */
  position: Position;
}
