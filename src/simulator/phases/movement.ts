/**
 * Movement phase handler for battle simulation.
 *
 * Handles the movement phase which executes after AI decision.
 * Phase order: turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end
 *
 * Movement phase responsibilities:
 * 1. Execute pathfinding to target position
 * 2. Check for intercept triggers (hard and soft)
 * 3. Update engagement status (Zone of Control)
 * 4. Calculate charge momentum for cavalry units
 *
 * @module simulator/phases/movement
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for return type
 * @see Requirements 2.4 for movement phase specification
 */

import {
  BattleState,
  PhaseResult,
  Phase,
  BattleEvent,
  createMoveEvent,
  createInterceptTriggeredEvent,
  createEngagementChangedEvent,
  createChargeStartedEvent,
  createDamageEvent,
} from '../../core/types';
import { BattleUnit } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';
import {
  findUnit,
  updateUnit,
  updateOccupiedPositions,
  getTeamUnits,
  getAliveUnits,
} from '../../core/utils/state-helpers';
import { findPath } from '../../core/grid/pathfinding';
import { createGridWithUnits, manhattanDistance } from '../../core/grid/grid';
import {
  createChargeProcessor,
  DEFAULT_CHARGE_CONFIG,
  CAVALRY_TAG,
  CHARGE_TAG,
} from '../../core/mechanics';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum charge momentum (capped by ChargeProcessor config) */
const MAX_MOMENTUM = DEFAULT_CHARGE_CONFIG.maxMomentum;

/** Counter damage multiplier for spear wall (50% of spearman ATK) */
const SPEAR_WALL_COUNTER_MULTIPLIER = 0.5;

/** Singleton ChargeProcessor instance for this module */
const chargeProcessor = createChargeProcessor(DEFAULT_CHARGE_CONFIG);

// =============================================================================
// MAIN PHASE HANDLER
// =============================================================================

/**
 * Handle movement phase for a unit.
 *
 * Executes the following in order:
 * 1. Validate movement is possible
 * 2. Calculate path to target position
 * 3. Check for hard intercepts (spearman vs cavalry)
 * 4. Check for soft intercepts (entering enemy ZoC)
 * 5. Execute movement along path
 * 6. Update engagement status
 * 7. Calculate charge momentum (if applicable)
 *
 * @param state - Current battle state (immutable)
 * @param unitId - Instance ID of unit moving
 * @param targetPosition - Target position to move to
 * @returns Updated state and events from this phase
 *
 * @invariant Original state is not mutated
 * @invariant Events are emitted for all state changes
 *
 * @example
 * const { state: newState, events } = handleMovement(
 *   currentState,
 *   'player_knight_0',
 *   { x: 4, y: 3 }
 * );
 */
export function handleMovement(
  state: BattleState,
  unitId: string,
  targetPosition: Position,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Create event context for this phase
  const eventContext = {
    round: currentState.round,
    turn: currentState.turn,
    phase: 'movement' as Phase,
  };

  // Skip movement if unit is at target position
  if (unit.position.x === targetPosition.x && unit.position.y === targetPosition.y) {
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 1: Calculate Path
  // ==========================================================================
  const pathResult = calculatePath(currentState, unit, targetPosition);
  if (pathResult.path.length === 0) {
    // No valid path found
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 2: Check for Hard Intercept (Spearman vs Cavalry)
  // ==========================================================================
  const hardInterceptResult = checkHardIntercept(currentState, unit, pathResult.path, eventContext);
  currentState = hardInterceptResult.state;
  events.push(...hardInterceptResult.events);

  // If hard intercept occurred, movement is stopped
  if (hardInterceptResult.intercepted) {
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 3: Check for Soft Intercept (Entering Enemy ZoC)
  // ==========================================================================
  const softInterceptResult = checkSoftIntercept(currentState, unit, pathResult.path, eventContext);
  currentState = softInterceptResult.state;
  events.push(...softInterceptResult.events);

  // Adjust path if soft intercept occurred
  const finalPath = softInterceptResult.adjustedPath || pathResult.path;

  // ==========================================================================
  // STEP 4: Execute Movement
  // ==========================================================================
  const moveResult = executeMovement(currentState, unitId, unit.position, finalPath, eventContext);
  currentState = moveResult.state;
  events.push(...moveResult.events);

  // ==========================================================================
  // STEP 5: Update Engagement Status
  // ==========================================================================
  const engagementResult = updateEngagementStatus(currentState, unitId, eventContext);
  currentState = engagementResult.state;
  events.push(...engagementResult.events);

  // ==========================================================================
  // STEP 6: Calculate Charge Momentum
  // ==========================================================================
  const chargeResult = calculateChargeMomentum(
    currentState,
    unitId,
    unit.position,
    finalPath,
    eventContext,
  );
  currentState = chargeResult.state;
  events.push(...chargeResult.events);

  return { state: currentState, events };
}

// =============================================================================
// PATH CALCULATION
// =============================================================================

/**
 * Result of path calculation.
 */
interface PathResult {
  /** Calculated path (empty if no valid path) */
  path: Position[];
  /** Distance of the path */
  distance: number;
}

/**
 * Calculate path from unit's current position to target.
 *
 * Uses A* pathfinding with unit collision detection.
 * Path is limited by unit's speed stat.
 *
 * @param state - Current battle state
 * @param unit - Unit that is moving
 * @param targetPosition - Target position
 * @returns Path result with positions and distance
 */
function calculatePath(state: BattleState, unit: BattleUnit, targetPosition: Position): PathResult {
  // Create grid with current unit positions
  const aliveUnits = getAliveUnits(state);
  const grid = createGridWithUnits([...aliveUnits]);

  // Find path using A* algorithm
  const fullPath = findPath(
    unit.position,
    targetPosition,
    grid,
    [...aliveUnits],
    unit, // Exclude moving unit from collision
  );

  if (fullPath.length === 0) {
    return { path: [], distance: 0 };
  }

  // Limit path by unit's speed
  const maxSteps = unit.stats.speed;
  const limitedPath = fullPath.slice(0, maxSteps + 1); // +1 because path includes start position

  return {
    path: limitedPath,
    distance: limitedPath.length - 1, // Exclude start position from distance
  };
}

// =============================================================================
// HARD INTERCEPT (SPEARMAN VS CAVALRY)
// =============================================================================

/**
 * Result of hard intercept check.
 */
interface HardInterceptResult extends PhaseResult {
  /** Whether a hard intercept occurred */
  intercepted: boolean;
}

/**
 * Check for hard intercept (spearman vs cavalry).
 *
 * Hard intercept triggers when:
 * - Moving unit has 'cavalry' tag
 * - Spearman is within 2 cells of path
 * - Spearman is facing the cavalry
 *
 * Effects:
 * - Cavalry movement is stopped
 * - Cavalry takes counter damage (50% of spearman ATK)
 * - Cavalry momentum reset to 0
 *
 * @param state - Current battle state
 * @param unit - Moving unit
 * @param path - Planned movement path
 * @param eventContext - Event context for creating events
 * @returns Updated state, events, and whether intercept occurred
 *
 * @see Requirements 2.4 for intercept specification
 */
function checkHardIntercept(
  state: BattleState,
  unit: BattleUnit,
  path: Position[],
  eventContext: { round: number; turn: number; phase: Phase },
): HardInterceptResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  // Only cavalry can be hard intercepted
  if (!unit.tags.includes('cavalry')) {
    return { state: currentState, events, intercepted: false };
  }

  // Get enemy units with spearman tag
  const enemyTeam = unit.team === 'player' ? 'enemy' : 'player';
  const enemySpearmen = getTeamUnits(currentState, enemyTeam).filter(
    (u) => u.tags.includes('spearman') && u.alive,
  );

  if (enemySpearmen.length === 0) {
    return { state: currentState, events, intercepted: false };
  }

  // Check each position along the path for intercept
  for (let i = 1; i < path.length; i++) {
    const pathPos = path[i];
    if (!pathPos) continue;

    for (const spearman of enemySpearmen) {
      // Check if spearman is within 2 cells
      const distance = manhattanDistance(pathPos, spearman.position);
      if (distance > 2) continue;

      // Check if spearman is facing the cavalry
      if (!isFacingPosition(spearman, pathPos)) continue;

      // Hard intercept triggered!
      const counterDamage = Math.floor(spearman.stats.atk * SPEAR_WALL_COUNTER_MULTIPLIER);

      // Stop cavalry at position before intercept
      const stoppedPosition = path[i - 1] || unit.position;

      // Update cavalry position and apply damage
      const newHp = Math.max(0, unit.currentHp - counterDamage);
      currentState = updateUnit(currentState, unit.instanceId, {
        position: stoppedPosition,
        currentHp: newHp,
        alive: newHp > 0,
        momentum: 0, // Reset momentum
      });
      currentState = updateOccupiedPositions(currentState);

      // Emit intercept event
      const interceptEvent = createInterceptTriggeredEvent(
        eventContext,
        spearman.instanceId,
        unit.instanceId,
        {
          interceptorId: spearman.instanceId,
          movingUnitId: unit.instanceId,
          interceptType: 'hard',
          stoppedAt: stoppedPosition,
          counterDamage,
        },
      );
      events.push(interceptEvent);

      // Emit damage event
      const damageEvent = createDamageEvent(
        eventContext,
        unit.instanceId,
        {
          amount: counterDamage,
          damageType: 'physical',
          source: 'intercept',
          newHp,
          maxHp: unit.maxHp,
        },
        spearman.instanceId,
      );
      events.push(damageEvent);

      return { state: currentState, events, intercepted: true };
    }
  }

  return { state: currentState, events, intercepted: false };
}

/**
 * Check if a unit is facing a specific position.
 *
 * @param unit - Unit to check facing
 * @param targetPos - Position to check
 * @returns True if unit is facing the position
 */
function isFacingPosition(unit: BattleUnit, targetPos: Position): boolean {
  const dx = targetPos.x - unit.position.x;
  const dy = targetPos.y - unit.position.y;

  switch (unit.facing) {
    case 'N':
      return dy < 0; // Target is above (lower y)
    case 'S':
      return dy > 0; // Target is below (higher y)
    case 'E':
      return dx > 0; // Target is to the right
    case 'W':
      return dx < 0; // Target is to the left
    default:
      return false;
  }
}

// =============================================================================
// SOFT INTERCEPT (ENTERING ENEMY ZOC)
// =============================================================================

/**
 * Result of soft intercept check.
 */
interface SoftInterceptResult extends PhaseResult {
  /** Adjusted path if soft intercept occurred */
  adjustedPath?: Position[];
}

/**
 * Check for soft intercept (entering enemy Zone of Control).
 *
 * Soft intercept triggers when:
 * - Moving unit enters a cell adjacent to an enemy infantry
 * - Moving unit becomes engaged
 *
 * Effects:
 * - Moving unit becomes engaged
 * - Movement can continue if unit has remaining movement
 * - No damage dealt
 *
 * @param state - Current battle state
 * @param unit - Moving unit
 * @param path - Planned movement path
 * @param eventContext - Event context for creating events
 * @returns Updated state, events, and adjusted path
 *
 * @see Requirements 2.4 for intercept specification
 */
function checkSoftIntercept(
  state: BattleState,
  unit: BattleUnit,
  path: Position[],
  eventContext: { round: number; turn: number; phase: Phase },
): SoftInterceptResult {
  const events: BattleEvent[] = [];
  const currentState = state;

  // Get enemy units
  const enemyTeam = unit.team === 'player' ? 'enemy' : 'player';
  const enemyUnits = getTeamUnits(currentState, enemyTeam).filter((u) => u.alive);

  if (enemyUnits.length === 0) {
    return { state: currentState, events };
  }

  // Check each position along the path for soft intercept
  for (let i = 1; i < path.length; i++) {
    const pathPos = path[i];
    if (!pathPos) continue;

    // Check if any enemy is adjacent to this position
    const adjacentEnemies = enemyUnits.filter((enemy) => {
      const distance = manhattanDistance(pathPos, enemy.position);
      return distance === 1; // Orthogonally adjacent
    });

    if (adjacentEnemies.length > 0) {
      // Soft intercept triggered - unit becomes engaged
      const engagingEnemyIds = adjacentEnemies.map((e) => e.instanceId);
      const firstInterceptor = adjacentEnemies[0];

      // Emit intercept event
      if (firstInterceptor) {
        const interceptEvent = createInterceptTriggeredEvent(
          eventContext,
          firstInterceptor.instanceId,
          unit.instanceId,
          {
            interceptorId: firstInterceptor.instanceId,
            movingUnitId: unit.instanceId,
            interceptType: 'soft',
            stoppedAt: pathPos,
          },
        );
        events.push(interceptEvent);
      }

      // Unit can continue moving but is now engaged
      // Return the path up to this point plus remaining path
      // (soft intercept doesn't stop movement, just engages)
      return {
        state: currentState,
        events,
        adjustedPath: path, // Full path - soft intercept doesn't stop movement
      };
    }
  }

  return { state: currentState, events };
}

// =============================================================================
// EXECUTE MOVEMENT
// =============================================================================

/**
 * Execute the actual movement of a unit.
 *
 * @param state - Current battle state
 * @param unitId - Unit to move
 * @param fromPosition - Starting position
 * @param path - Path to follow
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 */
function executeMovement(
  state: BattleState,
  unitId: string,
  fromPosition: Position,
  path: Position[],
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive || path.length < 2) {
    return { state: currentState, events };
  }

  // Get final position (last element of path)
  const toPosition = path[path.length - 1];
  if (!toPosition) {
    return { state: currentState, events };
  }

  // Determine movement reason
  const reason = unit.isRouting
    ? 'routing'
    : unit.tags.includes('cavalry') && path.length > 2
      ? 'charge'
      : 'normal';

  // Update unit position
  currentState = updateUnit(currentState, unitId, {
    position: toPosition,
  });
  currentState = updateOccupiedPositions(currentState);

  // Emit move event
  const moveEvent = createMoveEvent(eventContext, unitId, {
    fromPosition,
    toPosition,
    reason: reason as 'normal' | 'routing' | 'charge' | 'ability',
    pathLength: path.length - 1,
  });
  events.push(moveEvent);

  return { state: currentState, events };
}

// =============================================================================
// ENGAGEMENT STATUS UPDATE
// =============================================================================

/**
 * Update engagement status after movement.
 *
 * Zone of Control (ZoC):
 * - Each unit projects ZoC to all 4 orthogonally adjacent cells
 * - Entering enemy ZoC triggers engagement
 *
 * @param state - Current battle state
 * @param unitId - Unit that moved
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.4 for engagement specification
 */
function updateEngagementStatus(
  state: BattleState,
  unitId: string,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Get enemy units
  const enemyTeam = unit.team === 'player' ? 'enemy' : 'player';
  const enemyUnits = getTeamUnits(currentState, enemyTeam).filter((u) => u.alive);

  // Find all enemies adjacent to the unit (in their ZoC)
  const engagingEnemies = enemyUnits.filter((enemy) => {
    const distance = manhattanDistance(unit.position, enemy.position);
    return distance === 1; // Orthogonally adjacent
  });

  const wasEngaged = unit.engaged;
  const isNowEngaged = engagingEnemies.length > 0;
  const engagedByIds = engagingEnemies.map((e) => e.instanceId);

  // Update unit engagement status
  if (wasEngaged !== isNowEngaged || !arraysEqual(unit.engagedBy, engagedByIds)) {
    currentState = updateUnit(currentState, unitId, {
      engaged: isNowEngaged,
      engagedBy: engagedByIds,
    });

    // Emit engagement changed event
    const engagementEvent = createEngagementChangedEvent(eventContext, unitId, {
      unitId,
      engaged: isNowEngaged,
      engagedBy: engagedByIds,
      reason: isNowEngaged ? 'entered_zoc' : 'left_zoc',
    });
    events.push(engagementEvent);
  }

  // Also update engagement status for enemies that are now adjacent
  for (const enemy of engagingEnemies) {
    const enemyEngagedBy = [...enemy.engagedBy];
    if (!enemyEngagedBy.includes(unitId)) {
      enemyEngagedBy.push(unitId);
      currentState = updateUnit(currentState, enemy.instanceId, {
        engaged: true,
        engagedBy: enemyEngagedBy,
      });

      // Emit engagement changed event for enemy
      const enemyEngagementEvent = createEngagementChangedEvent(eventContext, enemy.instanceId, {
        unitId: enemy.instanceId,
        engaged: true,
        engagedBy: enemyEngagedBy,
        reason: 'entered_zoc',
      });
      events.push(enemyEngagementEvent);
    }
  }

  return { state: currentState, events };
}

/**
 * Check if two arrays have the same elements (order-independent).
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

// =============================================================================
// CHARGE MOMENTUM CALCULATION
// =============================================================================

/**
 * Helper function to check if a unit has charge capability.
 *
 * @param unit - Unit to check
 * @returns True if unit can charge
 */
function hasChargeCapability(unit: BattleUnit): boolean {
  const tags = unit.tags ?? [];
  return tags.includes(CAVALRY_TAG) || tags.includes(CHARGE_TAG);
}

/**
 * Calculate charge momentum for cavalry units using ChargeProcessor.
 *
 * Uses the ChargeProcessor to:
 * - Calculate momentum based on distance moved
 * - Track movement for charge state
 * - Emit charge_started events
 *
 * Momentum Calculation (from ChargeProcessor):
 * - If distance < minChargeDistance (3): momentum = 0
 * - Otherwise: momentum = min(maxMomentum, distance * momentumPerCell)
 * - Default: 0.2 per cell, max 1.0 (100% bonus)
 *
 * @param state - Current battle state
 * @param unitId - Unit that moved
 * @param fromPosition - Starting position
 * @param path - Path taken
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.4 for charge specification
 * @see Task 21.2: Call calculateMomentum() during movement
 */
function calculateChargeMomentum(
  state: BattleState,
  unitId: string,
  fromPosition: Position,
  path: Position[],
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Only units with charge capability can build momentum
  if (!hasChargeCapability(unit)) {
    return { state: currentState, events };
  }

  // Calculate distance moved
  const distanceMoved = path.length - 1; // Exclude start position

  if (distanceMoved <= 0) {
    return { state: currentState, events };
  }

  // Use ChargeProcessor to calculate momentum (Task 21.2)
  const momentum = chargeProcessor.calculateMomentum(distanceMoved, DEFAULT_CHARGE_CONFIG);

  // Get final position
  const toPosition = path[path.length - 1];
  if (!toPosition) {
    return { state: currentState, events };
  }

  // Update unit momentum and charge state
  currentState = updateUnit(currentState, unitId, {
    momentum,
    isCharging: momentum > 0,
    chargeDistance: distanceMoved,
    chargeStartPosition: fromPosition,
  });

  // Only emit charge started event if momentum > 0
  if (momentum > 0) {
    const chargeEvent = createChargeStartedEvent(eventContext, unitId, {
      unitId,
      startPosition: fromPosition,
      targetPosition: toPosition,
      momentum,
    });
    events.push(chargeEvent);
  }

  return { state: currentState, events };
}

// =============================================================================
// ROUTING MOVEMENT
// =============================================================================

/**
 * Handle movement for a routing unit.
 *
 * Routing units can only retreat toward their deployment edge:
 * - Player units retreat toward rows 0-1
 * - Enemy units retreat toward rows 8-9
 *
 * @param state - Current battle state
 * @param unitId - Routing unit
 * @returns Target position for retreat
 */
export function getRoutingTargetPosition(state: BattleState, unitId: string): Position | null {
  const unit = findUnit(state, unitId);
  if (!unit || !unit.alive || !unit.isRouting) {
    return null;
  }

  // Determine deployment edge based on team
  const targetY = unit.team === 'player' ? 0 : 9;

  // Find closest position on deployment edge
  const aliveUnits = getAliveUnits(state);
  const occupiedPositions = new Set(
    aliveUnits.filter((u) => u.instanceId !== unitId).map((u) => `${u.position.x},${u.position.y}`),
  );

  // Try positions on the deployment edge
  let bestPosition: Position | null = null;
  let bestDistance = Infinity;

  for (let x = 0; x < 8; x++) {
    const pos = { x, y: targetY };
    const posKey = `${pos.x},${pos.y}`;

    if (!occupiedPositions.has(posKey)) {
      const distance = manhattanDistance(unit.position, pos);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPosition = pos;
      }
    }
  }

  return bestPosition;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculatePath,
  checkHardIntercept,
  checkSoftIntercept,
  executeMovement,
  updateEngagementStatus,
  calculateChargeMomentum,
  isFacingPosition,
  hasChargeCapability,
  chargeProcessor,
  MAX_MOMENTUM,
  SPEAR_WALL_COUNTER_MULTIPLIER,
};
