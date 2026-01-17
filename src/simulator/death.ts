/**
 * Death handling module for battle simulation.
 *
 * Handles all aspects of unit death including:
 * - Marking units as dead
 * - Applying resolve damage to nearby allies
 * - Recalculating phalanx formations
 * - Removing dead units from turn queue
 *
 * Design principles:
 * - Immutable state updates
 * - Full event emission for replay
 * - Property 2: Dead units never act
 *
 * @module simulator/death
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for return type
 * @see Requirements 3.3 for death handling specification
 */

import {
  BattleState,
  PhaseResult,
  Phase,
  BattleEvent,
  createUnitDiedEvent,
  createResolveChangedEvent,
  createPhalanxBrokenEvent,
} from '../core/types';
import { BattleUnit } from '../core/types/battle-unit';
import {
  findUnit,
  updateUnit,
  updateUnits,
  removeFromTurnQueue,
  updateOccupiedPositions,
  getTeamUnits,
  BatchUnitUpdate,
} from '../core/utils/state-helpers';
import {
  createResolveProcessor,
  DEFAULT_RESOLVE_CONFIG,
} from '../core/mechanics';
import type { ResolveConfig } from '../core/mechanics';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Resolve damage when adjacent ally (within 1 cell) dies */
const RESOLVE_DAMAGE_ADJACENT = 15;

/** Resolve damage when nearby ally (within 3 cells) dies */
const RESOLVE_DAMAGE_NEARBY = 8;

/** Maximum range for nearby ally death resolve damage */
const RESOLVE_DAMAGE_NEARBY_RANGE = 3;

/** Minimum adjacent allies required for phalanx formation */
const PHALANX_MIN_ALLIES = 2;

// =============================================================================
// MAIN DEATH HANDLER
// =============================================================================

/**
 * Handle unit death and all related effects.
 *
 * Executes the following in order:
 * 1. Mark unit as dead (alive = false, currentHp = 0)
 * 2. Emit unit_died event
 * 3. Remove from turn queue (Property 2: Dead units never act)
 * 4. Update occupied positions
 * 5. Apply resolve damage to nearby allies
 * 6. Recalculate phalanx formations
 *
 * @param state - Current battle state (immutable)
 * @param deadUnitId - Instance ID of the unit that died
 * @param killerId - Instance ID of the unit that caused the death (optional)
 * @param cause - Cause of death
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @invariant Original state is not mutated
 * @invariant Dead unit is removed from turn queue
 * @invariant Property 2: Dead units never act
 *
 * @example
 * const { state: newState, events } = handleUnitDeath(
 *   currentState,
 *   'enemy_rogue_0',
 *   'player_knight_0',
 *   'damage',
 *   { round: 3, turn: 7, phase: 'attack' }
 * );
 */
export function handleUnitDeath(
  state: BattleState,
  deadUnitId: string,
  killerId: string | undefined,
  cause: 'damage' | 'riposte' | 'ability' | 'status' | 'crumble' | 'intercept',
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const deadUnit = findUnit(currentState, deadUnitId);
  if (!deadUnit) {
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 1: Mark unit as dead
  // ==========================================================================
  const markResult = markUnitAsDead(currentState, deadUnitId);
  currentState = markResult.state;
  // No events from marking - the death event is emitted below

  // ==========================================================================
  // STEP 2: Emit unit_died event
  // ==========================================================================
  const diedEvent = createUnitDiedEvent(eventContext, deadUnitId, {
    unitId: deadUnit.id,
    killerId,
    cause,
    position: deadUnit.position,
  });
  events.push(diedEvent);

  // ==========================================================================
  // STEP 3: Remove from turn queue (Property 2: Dead units never act)
  // ==========================================================================
  currentState = removeDeadUnitFromTurnQueue(currentState, deadUnitId);

  // ==========================================================================
  // STEP 4: Update occupied positions
  // ==========================================================================
  currentState = updateOccupiedPositions(currentState);

  // ==========================================================================
  // STEP 5: Apply resolve damage to nearby allies
  // ==========================================================================
  const resolveResult = applyAllyDeathResolveDamage(
    currentState,
    deadUnit,
    eventContext,
  );
  currentState = resolveResult.state;
  events.push(...resolveResult.events);

  // ==========================================================================
  // STEP 6: Recalculate phalanx formations
  // ==========================================================================
  const phalanxResult = recalculatePhalanxOnDeath(
    currentState,
    deadUnit,
    eventContext,
  );
  currentState = phalanxResult.state;
  events.push(...phalanxResult.events);

  return { state: currentState, events };
}


// =============================================================================
// MARK UNIT AS DEAD
// =============================================================================

/**
 * Mark a unit as dead in the battle state.
 *
 * Sets alive = false and currentHp = 0.
 * Does not emit events - caller is responsible for event emission.
 *
 * @param state - Current battle state
 * @param unitId - Instance ID of the unit to mark as dead
 * @returns Updated state
 *
 * @example
 * const { state: newState } = markUnitAsDead(state, 'enemy_rogue_0');
 */
export function markUnitAsDead(
  state: BattleState,
  unitId: string,
): { state: BattleState } {
  const unit = findUnit(state, unitId);
  if (!unit) {
    return { state };
  }

  // Mark unit as dead
  const newState = updateUnit(state, unitId, {
    alive: false,
    currentHp: 0,
  });

  return { state: newState };
}

// =============================================================================
// REMOVE FROM TURN QUEUE
// =============================================================================

/**
 * Remove a dead unit from the turn queue.
 *
 * This ensures Property 2: Dead units never act.
 * The turn queue is updated to exclude the dead unit,
 * and currentTurnIndex is adjusted if necessary.
 *
 * @param state - Current battle state
 * @param deadUnitId - Instance ID of the dead unit
 * @returns Updated state with dead unit removed from queue
 *
 * @invariant Dead unit is removed from queue
 * @invariant Order of remaining units preserved
 * @invariant currentTurnIndex adjusted if needed
 *
 * @example
 * const newState = removeDeadUnitFromTurnQueue(state, 'enemy_rogue_0');
 */
export function removeDeadUnitFromTurnQueue(
  state: BattleState,
  deadUnitId: string,
): BattleState {
  return removeFromTurnQueue(state, deadUnitId);
}

// =============================================================================
// RESOLVE DAMAGE TO NEARBY ALLIES
// =============================================================================

/**
 * Apply resolve damage to allies when a unit dies using ResolveProcessor.
 *
 * Resolve Damage:
 * - Adjacent ally dies (distance = 1): -15 resolve
 * - Nearby ally dies (distance 2-3): -8 resolve
 *
 * Uses the ResolveProcessor.applyAllyDeathDamage() method for core logic,
 * then emits events for each affected unit.
 *
 * @param state - Current battle state
 * @param deadUnit - Unit that died
 * @param eventContext - Event context for creating events
 * @param config - Optional resolve configuration (defaults to DEFAULT_RESOLVE_CONFIG)
 * @returns Updated state and events
 *
 * @see Requirements 3.3 for resolve damage specification
 *
 * @example
 * const { state: newState, events } = applyAllyDeathResolveDamage(
 *   state,
 *   deadUnit,
 *   { round: 3, turn: 7, phase: 'attack' }
 * );
 */
export function applyAllyDeathResolveDamage(
  state: BattleState,
  deadUnit: BattleUnit,
  eventContext: { round: number; turn: number; phase: Phase },
  config: ResolveConfig = DEFAULT_RESOLVE_CONFIG,
): PhaseResult {
  const events: BattleEvent[] = [];

  // Get allies of the dead unit before applying damage (for event generation)
  const alliesBefore = getTeamUnits(state, deadUnit.team).filter(
    (ally) => ally.instanceId !== deadUnit.instanceId && ally.alive,
  );

  // Use ResolveProcessor to apply ally death damage
  const resolveProcessor = createResolveProcessor(config);
  const currentState = resolveProcessor.applyAllyDeathDamage(state, deadUnit, config);

  // Generate events for each affected ally
  for (const allyBefore of alliesBefore) {
    const allyAfter = findUnit(currentState, allyBefore.instanceId);
    if (!allyAfter) continue;

    const resolveDelta = allyAfter.resolve - allyBefore.resolve;

    // Only emit event if resolve changed
    if (resolveDelta !== 0) {
      const resolveEvent = createResolveChangedEvent(
        eventContext,
        allyBefore.instanceId,
        {
          unitId: allyBefore.instanceId,
          delta: resolveDelta,
          newValue: allyAfter.resolve,
          maxValue: allyAfter.maxResolve,
          source: 'ally_death',
        },
      );
      events.push(resolveEvent);
    }
  }

  return { state: currentState, events };
}

// =============================================================================
// PHALANX RECALCULATION
// =============================================================================

/**
 * Recalculate phalanx formations after a unit dies.
 *
 * When a unit dies, nearby allies may lose their phalanx status
 * if they no longer have enough adjacent allies.
 *
 * Phalanx rules:
 * - Unit is in phalanx if 2+ allies are orthogonally adjacent
 * - All adjacent allies must be alive
 * - Diagonal adjacency does not count
 *
 * @param state - Current battle state
 * @param deadUnit - Unit that died
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 3.3 for phalanx recalculation specification
 *
 * @example
 * const { state: newState, events } = recalculatePhalanxOnDeath(
 *   state,
 *   deadUnit,
 *   { round: 3, turn: 7, phase: 'attack' }
 * );
 */
export function recalculatePhalanxOnDeath(
  state: BattleState,
  deadUnit: BattleUnit,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  // Get allies of the dead unit that might be affected
  const allies = getTeamUnits(currentState, deadUnit.team).filter(
    (ally) => ally.instanceId !== deadUnit.instanceId && ally.alive,
  );

  // Find units that were in phalanx and might need recalculation
  const unitsToCheck = allies.filter((ally) => {
    // Check if this ally was adjacent to the dead unit
    const wasAdjacent = isOrthogonallyAdjacent(ally.position, deadUnit.position);
    // Only need to recalculate if they were adjacent or already in phalanx
    return wasAdjacent || ally.inPhalanx;
  });

  // Collect updates and track broken formations
  const updates: BatchUnitUpdate[] = [];
  const brokenPhalanxUnits: string[] = [];

  for (const unit of unitsToCheck) {
    const newPhalanxStatus = checkPhalanxStatus(currentState, unit);

    // If phalanx status changed from true to false, track it
    if (unit.inPhalanx && !newPhalanxStatus) {
      brokenPhalanxUnits.push(unit.instanceId);
    }

    // Update if status changed
    if (unit.inPhalanx !== newPhalanxStatus) {
      updates.push({
        instanceId: unit.instanceId,
        updates: { inPhalanx: newPhalanxStatus },
      });
    }
  }

  // Apply all updates in batch
  if (updates.length > 0) {
    currentState = updateUnits(currentState, updates);
  }

  // Emit phalanx broken event if any formations were broken
  if (brokenPhalanxUnits.length > 0) {
    const phalanxEvent = createPhalanxBrokenEvent(eventContext, {
      unitIds: brokenPhalanxUnits,
      reason: 'unit_died',
    });
    events.push(phalanxEvent);
  }

  return { state: currentState, events };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a unit is in phalanx formation.
 *
 * A unit is in phalanx if 2+ allies are orthogonally adjacent.
 *
 * @param state - Current battle state
 * @param unit - Unit to check
 * @returns True if unit is in phalanx formation
 */
function checkPhalanxStatus(state: BattleState, unit: BattleUnit): boolean {
  const allies = getTeamUnits(state, unit.team).filter(
    (ally) => ally.instanceId !== unit.instanceId && ally.alive,
  );

  // Count orthogonally adjacent allies
  let adjacentCount = 0;
  for (const ally of allies) {
    if (isOrthogonallyAdjacent(unit.position, ally.position)) {
      adjacentCount++;
    }
  }

  return adjacentCount >= PHALANX_MIN_ALLIES;
}

/**
 * Check if two positions are orthogonally adjacent.
 *
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns True if positions are orthogonally adjacent
 */
function isOrthogonallyAdjacent(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
): boolean {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/**
 * Calculate Manhattan distance between two positions.
 *
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Manhattan distance
 */
function manhattanDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  RESOLVE_DAMAGE_NEARBY_RANGE,
  PHALANX_MIN_ALLIES,
  checkPhalanxStatus,
  isOrthogonallyAdjacent,
  manhattanDistance,
};
