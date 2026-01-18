/**
 * Turn execution module for battle simulation.
 *
 * Handles the execution of a single unit's turn through all phases:
 * turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end
 *
 * Design principles:
 * - Immutable state updates
 * - Full event emission for replay
 * - Proper handling of unit death during turn
 * - Nested mechanics processed in stack order (LIFO)
 *
 * @module simulator/turn
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for phase handler return type
 * @see {@link PHASE_ORDER} for phase execution order
 */

import {
  BattleState,
  BattleEvent,
  PhaseResult,
  BattleAction,
  Phase,
  createTurnStartEvent,
  createTurnEndEvent,
  createUnitDiedEvent,
} from '../core/types';
import { BattleUnit } from '../core/types/battle-unit';
import { SeededRandom } from '../core/utils/random';
import {
  findUnit,
  updateUnit,
  removeFromTurnQueue,
  updateOccupiedPositions,
} from '../core/utils/state-helpers';
import { handleTurnStart } from './phases/turn-start';

// =============================================================================
// TURN EXECUTION
// =============================================================================

/**
 * Execute a single turn for one unit.
 * Processes all phases in order: turn_start → ai_decision → movement →
 * pre_attack → attack → post_attack → turn_end
 *
 * @param state - Current battle state (immutable)
 * @param unitId - Instance ID of unit taking turn
 * @param rng - Seeded random generator for determinism
 * @returns Updated state and events from this turn
 *
 * @invariant Original state is not mutated
 * @invariant Events are emitted in strict phase order
 * @invariant Dead units never act (Property 2)
 *
 * @example
 * const { state: newState, events } = executeTurn(
 *   currentState,
 *   'player_knight_0',
 *   rng
 * );
 */
export function executeTurn(state: BattleState, unitId: string, rng: SeededRandom): PhaseResult {
  const allEvents: BattleEvent[] = [];
  let currentState = state;

  // Find the unit
  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    // Dead units never act (Property 2)
    return { state: currentState, events: [] };
  }

  // Create event context
  const eventContext = {
    round: currentState.round,
    turn: currentState.turn,
    phase: 'turn_start' as Phase,
  };

  // Emit turn start event
  const turnStartEvent = createTurnStartEvent(eventContext, unitId, currentState.turn);
  allEvents.push(turnStartEvent);

  // ==========================================================================
  // PHASE 1: TURN_START
  // ==========================================================================
  const turnStartResult = handleTurnStart(currentState, unitId);
  currentState = turnStartResult.state;
  allEvents.push(...turnStartResult.events);

  // Check if unit died during turn_start (e.g., from status effects)
  const unitAfterTurnStart = findUnit(currentState, unitId);
  if (!unitAfterTurnStart || !unitAfterTurnStart.alive) {
    return finalizeTurn(currentState, unitId, allEvents);
  }

  // ==========================================================================
  // PHASE 2: AI_DECISION
  // ==========================================================================
  const decision = makeAIDecision(currentState, unitId, rng);

  // Skip action if unit is routing or no valid action
  if (decision.type === 'skip') {
    return finalizeTurn(currentState, unitId, allEvents);
  }

  // ==========================================================================
  // PHASE 3: MOVEMENT (if action is move or needs to move to target)
  // ==========================================================================
  if (decision.type === 'move' && decision.targetPosition) {
    const moveResult = handleMovement(currentState, unitId, decision.targetPosition, rng);
    currentState = moveResult.state;
    allEvents.push(...moveResult.events);

    // Check if unit died during movement (e.g., from intercept)
    const unitAfterMove = findUnit(currentState, unitId);
    if (!unitAfterMove || !unitAfterMove.alive) {
      return finalizeTurn(currentState, unitId, allEvents);
    }
  }

  // ==========================================================================
  // PHASE 4-6: PRE_ATTACK, ATTACK, POST_ATTACK (if action is attack)
  // ==========================================================================
  if (decision.type === 'attack' && decision.targetId) {
    // Check if target is still alive
    const target = findUnit(currentState, decision.targetId);
    if (target && target.alive) {
      const attackResult = handleAttackSequence(currentState, unitId, decision.targetId, rng);
      currentState = attackResult.state;
      allEvents.push(...attackResult.events);
    }
  }

  // ==========================================================================
  // PHASE 7: TURN_END
  // ==========================================================================
  const turnEndResult = handleTurnEnd(currentState, unitId);
  currentState = turnEndResult.state;
  allEvents.push(...turnEndResult.events);

  return finalizeTurn(currentState, unitId, allEvents);
}

/**
 * Finalize turn by emitting turn end event and updating state.
 *
 * @param state - Current battle state
 * @param unitId - Unit whose turn is ending
 * @param events - Events collected during turn
 * @returns Final state and events
 */
function finalizeTurn(state: BattleState, unitId: string, events: BattleEvent[]): PhaseResult {
  const eventContext = {
    round: state.round,
    turn: state.turn,
    phase: 'turn_end' as Phase,
  };

  // Emit turn end event
  const turnEndEvent = createTurnEndEvent(eventContext, unitId, state.turn);
  events.push(turnEndEvent);

  // Update state with incremented turn
  const newState = {
    ...state,
    turn: state.turn + 1,
    currentPhase: 'turn_end' as Phase,
  };

  return { state: newState, events };
}

// =============================================================================
// PHASE HANDLERS (Placeholder implementations - will be expanded in tasks 12-14)
// =============================================================================

// handleTurnStart is imported from ./phases/turn-start

/**
 * Make AI decision for unit's action.
 * Placeholder implementation - will be expanded in task 15.
 *
 * @param state - Current battle state
 * @param unitId - Unit making decision
 * @param _rng - Seeded random generator
 * @returns Action to perform
 */
function makeAIDecision(state: BattleState, unitId: string, _rng: SeededRandom): BattleAction {
  const unit = findUnit(state, unitId);
  if (!unit || !unit.alive) {
    return { type: 'skip', actorId: unitId };
  }

  // If routing, skip action (routing units can only retreat)
  if (unit.isRouting) {
    return { type: 'skip', actorId: unitId };
  }

  // Find nearest enemy to attack
  const enemies = state.units.filter((u) => u.alive && u.team !== unit.team);

  if (enemies.length === 0) {
    return { type: 'skip', actorId: unitId };
  }

  // Find closest enemy
  let closestEnemy: BattleUnit | null = null;
  let closestDistance = Infinity;

  for (const enemy of enemies) {
    const distance =
      Math.abs(enemy.position.x - unit.position.x) + Math.abs(enemy.position.y - unit.position.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestEnemy = enemy;
    }
  }

  if (!closestEnemy) {
    return { type: 'skip', actorId: unitId };
  }

  // Check if enemy is in range
  if (closestDistance <= unit.range) {
    return {
      type: 'attack',
      actorId: unitId,
      targetId: closestEnemy.instanceId,
    };
  }

  // Need to move closer - calculate target position
  // Simple movement: move toward enemy
  const dx = closestEnemy.position.x - unit.position.x;
  const dy = closestEnemy.position.y - unit.position.y;

  // Move up to speed cells toward enemy
  const moveX = dx === 0 ? 0 : (dx > 0 ? 1 : -1) * Math.min(Math.abs(dx), unit.stats.speed);
  const moveY = dy === 0 ? 0 : (dy > 0 ? 1 : -1) * Math.min(Math.abs(dy), unit.stats.speed);

  const targetPosition = {
    x: unit.position.x + moveX,
    y: unit.position.y + moveY,
  };

  return {
    type: 'move',
    actorId: unitId,
    targetPosition,
  };
}

/**
 * Handle movement phase.
 * Placeholder implementation - will be expanded in task 12.
 *
 * @param state - Current battle state
 * @param unitId - Unit moving
 * @param targetPosition - Target position
 * @param _rng - Seeded random generator
 * @returns Updated state and events
 */
function handleMovement(
  state: BattleState,
  unitId: string,
  targetPosition: { x: number; y: number },
  _rng: SeededRandom,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Simple movement - just update position
  // TODO: Add intercept checks, engagement updates, charge momentum in task 12
  currentState = updateUnit(currentState, unitId, {
    position: targetPosition,
  });

  // Update occupied positions
  currentState = updateOccupiedPositions(currentState);

  return { state: currentState, events };
}

/**
 * Handle attack sequence (pre_attack, attack, post_attack phases).
 * Placeholder implementation - will be expanded in task 13.
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param targetId - Target unit
 * @param rng - Seeded random generator
 * @returns Updated state and events
 */
function handleAttackSequence(
  state: BattleState,
  attackerId: string,
  targetId: string,
  rng: SeededRandom,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const attacker = findUnit(currentState, attackerId);
  const target = findUnit(currentState, targetId);

  if (!attacker || !attacker.alive || !target || !target.alive) {
    return { state: currentState, events };
  }

  // ==========================================================================
  // PRE_ATTACK: Rotate facing toward target (Property 10)
  // ==========================================================================
  const newFacing = calculateFacing(attacker.position, target.position);
  if (newFacing !== attacker.facing) {
    currentState = updateUnit(currentState, attackerId, {
      facing: newFacing,
    });
  }

  // ==========================================================================
  // ATTACK: Calculate and apply damage
  // ==========================================================================
  const damage = calculateDamage(attacker, target);

  // Roll dodge
  const dodgeRoll = rng.next();
  const dodgeChance = target.stats.dodge / 100;

  if (dodgeRoll < dodgeChance) {
    // Attack dodged - no damage
    return { state: currentState, events };
  }

  // Apply damage
  const newHp = Math.max(0, target.currentHp - damage);
  const isDead = newHp <= 0;

  currentState = updateUnit(currentState, targetId, {
    currentHp: newHp,
    alive: !isDead,
  });

  // Handle death
  if (isDead) {
    const deathResult = handleUnitDeath(currentState, targetId, attackerId);
    currentState = deathResult.state;
    events.push(...deathResult.events);
  }

  // ==========================================================================
  // POST_ATTACK: Consume ammo, apply armor shred
  // ==========================================================================
  const attackerAfterAttack = findUnit(currentState, attackerId);
  if (attackerAfterAttack && attackerAfterAttack.ammo !== null) {
    const newAmmo = Math.max(0, attackerAfterAttack.ammo - 1);
    currentState = updateUnit(currentState, attackerId, {
      ammo: newAmmo,
    });
  }

  return { state: currentState, events };
}

/**
 * Handle turn_end phase.
 * Placeholder implementation - will be expanded in task 14.
 *
 * @param state - Current battle state
 * @param unitId - Unit ending their turn
 * @returns Updated state and events
 */
function handleTurnEnd(state: BattleState, unitId: string): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Decay armor shred
  if (unit.armorShred > 0) {
    const newShred = Math.max(0, unit.armorShred - 2);
    currentState = updateUnit(currentState, unitId, {
      armorShred: newShred,
    });
  }

  return { state: currentState, events };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate facing direction from attacker to target.
 *
 * @param from - Attacker position
 * @param to - Target position
 * @returns Facing direction
 */
function calculateFacing(
  from: { x: number; y: number },
  to: { x: number; y: number },
): 'N' | 'S' | 'E' | 'W' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Determine primary direction based on larger delta
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'E' : 'W';
  } else {
    return dy >= 0 ? 'S' : 'N';
  }
}

/**
 * Calculate damage from attacker to target.
 * Formula: max(1, (ATK - effectiveArmor) * atkCount)
 *
 * @param attacker - Attacking unit
 * @param target - Target unit
 * @returns Damage amount
 */
function calculateDamage(attacker: BattleUnit, target: BattleUnit): number {
  const effectiveArmor = Math.max(0, target.stats.armor - target.armorShred);
  const baseDamage = attacker.stats.atk - effectiveArmor;
  const totalDamage = baseDamage * attacker.stats.atkCount;
  return Math.max(1, totalDamage);
}

/**
 * Handle unit death - mark as dead, remove from queue, apply resolve damage.
 *
 * @param state - Current battle state
 * @param deadUnitId - Unit that died
 * @param killerId - Unit that killed them (optional)
 * @returns Updated state and events
 */
function handleUnitDeath(state: BattleState, deadUnitId: string, killerId?: string): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const deadUnit = findUnit(currentState, deadUnitId);
  if (!deadUnit) {
    return { state: currentState, events };
  }

  // Create death event
  const eventContext = {
    round: currentState.round,
    turn: currentState.turn,
    phase: 'attack' as Phase,
  };

  const deathEvent = createUnitDiedEvent(eventContext, deadUnitId, {
    unitId: deadUnit.id,
    killerId,
    cause: 'damage',
    position: deadUnit.position,
  });
  events.push(deathEvent);

  // Remove from turn queue
  currentState = removeFromTurnQueue(currentState, deadUnitId);

  // Update occupied positions
  currentState = updateOccupiedPositions(currentState);

  // TODO: Apply resolve damage to nearby allies (task 16)

  return { state: currentState, events };
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export handleTurnStart from phases module
export { handleTurnStart } from './phases/turn-start';

export {
  handleMovement,
  handleAttackSequence,
  handleTurnEnd,
  handleUnitDeath,
  calculateFacing,
  calculateDamage,
};
