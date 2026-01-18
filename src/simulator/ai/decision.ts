/**
 * AI Decision Making System for Battle Simulation.
 *
 * Provides deterministic AI decisions based on:
 * - Unit role (Tank, Melee DPS, Ranged DPS, Support, Mage, Control)
 * - Target selection strategies
 * - Action selection (attack, move, ability, skip)
 * - Routing behavior (retreat toward deployment edge)
 *
 * All decisions are deterministic - same inputs + seed = same outputs.
 * Uses seeded random for any probabilistic decisions.
 *
 * @module simulator/ai/decision
 * @see {@link BattleState} for state structure
 * @see {@link BattleAction} for action types
 */

import { BattleState } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';
import { SeededRandom } from '../../core/utils/random';
import { findUnit, getTeamUnits } from '../../core/utils/state-helpers';
import { manhattanDistance } from '../../core/grid/grid';

// =============================================================================
// TYPES
// =============================================================================

/**
 * AI decision input containing all context needed for decision making.
 */
export interface AIDecisionInput {
  /** Current battle state (immutable) */
  state: BattleState;
  /** Instance ID of unit making decision */
  actorId: string;
  /** Seeded random generator for determinism */
  rng: SeededRandom;
}

/**
 * AI decision output representing the chosen action.
 *
 * @invariant Exactly one action type is set
 * @invariant targetId is valid unit instanceId if set
 * @invariant targetPosition is valid grid position if set
 */
export interface AIDecisionOutput {
  /** Type of action to perform */
  action: 'attack' | 'move' | 'ability' | 'skip';
  /** Target unit instance ID (for attack/ability) */
  targetId?: string;
  /** Target position (for move) */
  targetPosition?: Position;
  /** Ability ID (for ability action) */
  abilityId?: string;
  /** Reason for this decision (for debugging/logging) */
  reason: string;
}

/**
 * Context for AI decision making with pre-computed battlefield info.
 */
interface DecisionContext {
  /** The unit making the decision */
  actor: BattleUnit;
  /** All living allied units */
  allies: readonly BattleUnit[];
  /** All living enemy units */
  enemies: readonly BattleUnit[];
  /** Enemies within attack range */
  enemiesInRange: readonly BattleUnit[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * HP threshold percentages for decision making.
 */
const HP_THRESHOLDS = {
  /** Critical HP - needs immediate healing */
  CRITICAL: 0.25,
  /** Wounded - should be healed when possible */
  WOUNDED: 0.5,
  /** Low HP for execute abilities */
  EXECUTE_TARGET: 0.3,
} as const;

/**
 * Grid configuration for deployment zones.
 */
const GRID_CONFIG = {
  /** Player deployment rows (bottom of grid from player perspective) */
  PLAYER_DEPLOYMENT_Y: 0,
  /** Enemy deployment rows (top of grid from player perspective) */
  ENEMY_DEPLOYMENT_Y: 9,
} as const;

// =============================================================================
// MAIN DECISION FUNCTION
// =============================================================================

/**
 * Make AI decision for a unit's turn.
 *
 * Decision rules by role:
 *
 * **Tank:**
 * 1. If has taunt ability and not on cooldown → use taunt
 * 2. If enemy in range → attack lowest HP enemy
 * 3. Else → move toward nearest enemy
 *
 * **Melee DPS:**
 * 1. If enemy in range with HP < 30% → attack (execute)
 * 2. If enemy in range → attack highest value target
 * 3. Else → move toward nearest enemy
 *
 * **Ranged DPS:**
 * 1. If ammo = 0 → move toward nearest enemy (melee fallback)
 * 2. If enemy in range → attack lowest armor enemy
 * 3. Else → move to optimal range position
 *
 * **Support:**
 * 1. If ally HP < 50% and heal available → heal
 * 2. If buff available → buff highest ATK ally
 * 3. Else → attack nearest enemy
 *
 * **Routing Unit:**
 * 1. Always move toward own deployment edge
 * 2. Cannot attack or use abilities
 *
 * @param input - AI decision input with state, actorId, and rng
 * @returns AI decision output with action and target
 *
 * @example
 * const decision = decideAction({
 *   state: battleState,
 *   actorId: 'player_knight_0',
 *   rng: seededRandom,
 * });
 *
 * if (decision.action === 'attack') {
 *   // Execute attack on decision.targetId
 * }
 */
export function decideAction(input: AIDecisionInput): AIDecisionOutput {
  const { state, actorId, rng } = input;

  // Find the actor
  const actor = findUnit(state, actorId);
  if (!actor || !actor.alive) {
    return createSkipAction('Unit is dead or not found');
  }

  // Handle routing units - they can only retreat
  if (actor.isRouting) {
    return decideRoutingAction(actor, state);
  }

  // Build decision context
  const context = buildDecisionContext(actor, state);

  // No enemies = skip
  if (context.enemies.length === 0) {
    return createSkipAction('No enemies remaining');
  }

  // Decide based on role
  switch (actor.role) {
    case 'tank':
      return decideTankAction(context, rng);
    case 'melee_dps':
      return decideMeleeDpsAction(context, rng);
    case 'ranged_dps':
      return decideRangedDpsAction(context, rng);
    case 'support':
      return decideSupportAction(context, rng);
    case 'mage':
      return decideMageAction(context, rng);
    case 'control':
      return decideControlAction(context, rng);
    default:
      // Default behavior: attack nearest or move
      return decideDefaultAction(context, rng);
  }
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

/**
 * Build decision context with pre-computed battlefield information.
 *
 * @param actor - Unit making the decision
 * @param state - Current battle state
 * @returns Decision context with computed values
 */
function buildDecisionContext(actor: BattleUnit, state: BattleState): DecisionContext {
  const allies = getTeamUnits(state, actor.team);
  const enemyTeam = actor.team === 'player' ? 'enemy' : 'player';
  const enemies = getTeamUnits(state, enemyTeam);

  const enemiesInRange = enemies.filter(
    (enemy) => manhattanDistance(actor.position, enemy.position) <= actor.range,
  );

  // const _woundedAllies = allies.filter(
  //   (ally) => ally.currentHp / ally.maxHp < HP_THRESHOLDS.WOUNDED,
  // );

  return {
    actor,
    allies,
    enemies,
    enemiesInRange,
  };
}

// =============================================================================
// ROLE-SPECIFIC DECISION FUNCTIONS
// =============================================================================

/**
 * Decide action for Tank units (Knight, Guardian, Berserker).
 * Priority: taunt > attack lowest HP > move toward enemy
 */
function decideTankAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Priority 1: Attack if enemies in range (target lowest HP)
  if (enemiesInRange.length > 0) {
    const target = selectLowestHpUnit(enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Attacking lowest HP enemy ${target.id}`);
    }
  }

  // Priority 2: Move toward nearest enemy
  const nearestEnemy = selectNearestUnit(actor, enemies);
  if (nearestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
    return createMoveAction(targetPos, `Moving toward nearest enemy ${nearestEnemy.id}`);
  }

  return createSkipAction('No valid tank action');
}

/**
 * Decide action for Melee DPS units (Rogue, Duelist, Assassin).
 * Priority: execute low HP > attack highest value > move toward enemy
 */
function decideMeleeDpsAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Priority 1: Execute low HP targets
  const lowHpEnemiesInRange = enemiesInRange.filter(
    (enemy) => enemy.currentHp / enemy.maxHp < HP_THRESHOLDS.EXECUTE_TARGET,
  );
  if (lowHpEnemiesInRange.length > 0) {
    const target = selectLowestHpUnit(lowHpEnemiesInRange);
    if (target) {
      return createAttackAction(
        target.instanceId,
        `Executing low HP target ${target.id} at ${Math.round((target.currentHp / target.maxHp) * 100)}%`,
      );
    }
  }

  // Priority 2: Attack highest value target in range (highest ATK)
  if (enemiesInRange.length > 0) {
    const target = selectHighestThreatUnit(enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Attacking high-value target ${target.id}`);
    }
  }

  // Priority 3: Move toward weakest enemy
  const weakestEnemy = selectLowestHpUnit(enemies);
  if (weakestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, weakestEnemy.position);
    return createMoveAction(targetPos, `Moving toward weakest enemy ${weakestEnemy.id}`);
  }

  return createSkipAction('No valid melee DPS action');
}

/**
 * Decide action for Ranged DPS units (Archer, Crossbowman, Hunter).
 * Priority: melee fallback if no ammo > attack lowest armor > move to range
 */
function decideRangedDpsAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Check ammo - if out, switch to melee behavior
  if (actor.ammo !== null && actor.ammo === 0) {
    // Melee fallback - move toward nearest enemy
    const nearestEnemy = selectNearestUnit(actor, enemies);
    if (nearestEnemy) {
      const distance = manhattanDistance(actor.position, nearestEnemy.position);
      if (distance <= 1) {
        // Adjacent - attack with reduced damage (handled in attack phase)
        return createAttackAction(
          nearestEnemy.instanceId,
          `Melee fallback attack on ${nearestEnemy.id}`,
        );
      }
      const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
      return createMoveAction(targetPos, `Moving to melee range (out of ammo)`);
    }
    return createSkipAction('Out of ammo, no enemies to engage');
  }

  // Priority 1: Attack lowest armor enemy in range
  if (enemiesInRange.length > 0) {
    const target = selectLowestArmorUnit(enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Attacking lowest armor enemy ${target.id}`);
    }
  }

  // Priority 2: Move to optimal range position
  const nearestEnemy = selectNearestUnit(actor, enemies);
  if (nearestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
    return createMoveAction(targetPos, `Moving toward enemy ${nearestEnemy.id}`);
  }

  return createSkipAction('No valid ranged DPS action');
}

/**
 * Decide action for Support units (Priest, Bard).
 * Priority: heal wounded > buff allies > attack
 */
function decideSupportAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Priority 1: Heal critically wounded allies (would use ability)
  // For now, we don't have ability system integrated, so skip to attack
  // TODO: Integrate ability system in future task

  // Priority 2: Attack nearest enemy
  if (enemiesInRange.length > 0) {
    const target = selectNearestUnit(actor, enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Support attacking ${target.id}`);
    }
  }

  // Priority 3: Move toward nearest enemy
  const nearestEnemy = selectNearestUnit(actor, enemies);
  if (nearestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
    return createMoveAction(targetPos, `Support moving toward ${nearestEnemy.id}`);
  }

  return createSkipAction('No valid support action');
}

/**
 * Decide action for Mage units (Mage, Warlock, Elementalist).
 * Priority: AoE if clustered > single target > attack
 */
function decideMageAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Check ammo for mages (spell charges)
  if (actor.ammo !== null && actor.ammo === 0) {
    // Out of spells - basic attack
    if (enemiesInRange.length > 0) {
      const target = selectNearestUnit(actor, enemiesInRange);
      if (target) {
        return createAttackAction(
          target.instanceId,
          `Mage basic attack on ${target.id} (out of spells)`,
        );
      }
    }
    const nearestEnemy = selectNearestUnit(actor, enemies);
    if (nearestEnemy) {
      const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
      return createMoveAction(targetPos, `Mage moving (out of spells)`);
    }
    return createSkipAction('Mage out of spells, no targets');
  }

  // Priority 1: Attack lowest HP enemy in range
  if (enemiesInRange.length > 0) {
    const target = selectLowestHpUnit(enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Mage attacking ${target.id}`);
    }
  }

  // Priority 2: Move toward enemies
  const nearestEnemy = selectNearestUnit(actor, enemies);
  if (nearestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
    return createMoveAction(targetPos, `Mage moving toward ${nearestEnemy.id}`);
  }

  return createSkipAction('No valid mage action');
}

/**
 * Decide action for Control units (Enchanter).
 * Priority: stun high threat > attack
 */
function decideControlAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Priority 1: Attack highest threat in range
  if (enemiesInRange.length > 0) {
    const target = selectHighestThreatUnit(enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Control attacking high-threat ${target.id}`);
    }
  }

  // Priority 2: Move toward highest threat enemy
  const highestThreat = selectHighestThreatUnit(enemies);
  if (highestThreat) {
    const targetPos = calculateMoveTowardTarget(actor, highestThreat.position);
    return createMoveAction(targetPos, `Control moving toward ${highestThreat.id}`);
  }

  return createSkipAction('No valid control action');
}

/**
 * Default action for units without specific role logic.
 * Priority: attack nearest > move toward nearest
 */
function decideDefaultAction(context: DecisionContext, _rng: SeededRandom): AIDecisionOutput {
  const { actor, enemies, enemiesInRange } = context;

  // Attack nearest enemy in range
  if (enemiesInRange.length > 0) {
    const target = selectNearestUnit(actor, enemiesInRange);
    if (target) {
      return createAttackAction(target.instanceId, `Attacking nearest enemy ${target.id}`);
    }
  }

  // Move toward nearest enemy
  const nearestEnemy = selectNearestUnit(actor, enemies);
  if (nearestEnemy) {
    const targetPos = calculateMoveTowardTarget(actor, nearestEnemy.position);
    return createMoveAction(targetPos, `Moving toward ${nearestEnemy.id}`);
  }

  return createSkipAction('No valid action');
}

// =============================================================================
// ROUTING BEHAVIOR
// =============================================================================

/**
 * Decide action for routing units.
 * Routing units can only retreat toward their deployment edge.
 *
 * @param actor - The routing unit
 * @param _state - Current battle state
 * @returns Move action toward deployment edge
 */
function decideRoutingAction(actor: BattleUnit, _state: BattleState): AIDecisionOutput {
  // Determine deployment edge based on team
  const deploymentY =
    actor.team === 'player' ? GRID_CONFIG.PLAYER_DEPLOYMENT_Y : GRID_CONFIG.ENEMY_DEPLOYMENT_Y;

  // Calculate retreat position
  const retreatTarget: Position = {
    x: actor.position.x,
    y: deploymentY,
  };

  // If already at deployment edge, skip
  if (actor.position.y === deploymentY) {
    return createSkipAction('Routing unit at deployment edge');
  }

  // Move toward deployment edge
  const targetPos = calculateMoveTowardTarget(actor, retreatTarget);
  return createMoveAction(targetPos, `Routing - retreating toward deployment edge`);
}

// =============================================================================
// TARGET SELECTION HELPERS (Deterministic)
// =============================================================================

/**
 * Select unit with lowest HP from array.
 * Uses instanceId for deterministic tiebreaking.
 *
 * @param units - Array of units to select from
 * @returns Unit with lowest HP, or undefined if empty
 */
function selectLowestHpUnit(units: readonly BattleUnit[]): BattleUnit | undefined {
  if (units.length === 0) return undefined;

  let lowest: BattleUnit | undefined;
  let lowestHp = Infinity;

  for (const unit of units) {
    if (
      unit.currentHp < lowestHp ||
      (unit.currentHp === lowestHp &&
        (!lowest || unit.instanceId.localeCompare(lowest.instanceId) < 0))
    ) {
      lowest = unit;
      lowestHp = unit.currentHp;
    }
  }

  return lowest;
}

/**
 * Select nearest unit using Manhattan distance.
 * Uses instanceId for deterministic tiebreaking.
 *
 * @param fromUnit - Reference unit for distance calculation
 * @param units - Array of units to select from
 * @returns Nearest unit, or undefined if empty
 */
function selectNearestUnit(
  fromUnit: BattleUnit,
  units: readonly BattleUnit[],
): BattleUnit | undefined {
  if (units.length === 0) return undefined;

  let nearest: BattleUnit | undefined;
  let nearestDist = Infinity;

  for (const unit of units) {
    const dist = manhattanDistance(fromUnit.position, unit.position);
    if (
      dist < nearestDist ||
      (dist === nearestDist && (!nearest || unit.instanceId.localeCompare(nearest.instanceId) < 0))
    ) {
      nearest = unit;
      nearestDist = dist;
    }
  }

  return nearest;
}

/**
 * Select unit with highest threat (ATK stat).
 * Uses instanceId for deterministic tiebreaking.
 *
 * @param units - Array of units to select from
 * @returns Unit with highest ATK, or undefined if empty
 */
function selectHighestThreatUnit(units: readonly BattleUnit[]): BattleUnit | undefined {
  if (units.length === 0) return undefined;

  let highest: BattleUnit | undefined;
  let highestAtk = -1;

  for (const unit of units) {
    if (
      unit.stats.atk > highestAtk ||
      (unit.stats.atk === highestAtk &&
        (!highest || unit.instanceId.localeCompare(highest.instanceId) < 0))
    ) {
      highest = unit;
      highestAtk = unit.stats.atk;
    }
  }

  return highest;
}

/**
 * Select unit with lowest armor.
 * Uses instanceId for deterministic tiebreaking.
 *
 * @param units - Array of units to select from
 * @returns Unit with lowest armor, or undefined if empty
 */
function selectLowestArmorUnit(units: readonly BattleUnit[]): BattleUnit | undefined {
  if (units.length === 0) return undefined;

  let lowest: BattleUnit | undefined;
  let lowestArmor = Infinity;

  for (const unit of units) {
    const effectiveArmor = Math.max(0, unit.stats.armor - unit.armorShred);
    if (
      effectiveArmor < lowestArmor ||
      (effectiveArmor === lowestArmor &&
        (!lowest || unit.instanceId.localeCompare(lowest.instanceId) < 0))
    ) {
      lowest = unit;
      lowestArmor = effectiveArmor;
    }
  }

  return lowest;
}

// =============================================================================
// MOVEMENT HELPERS
// =============================================================================

/**
 * Calculate position to move toward a target.
 * Moves up to unit's speed toward the target position.
 *
 * @param actor - Unit that is moving
 * @param target - Target position to move toward
 * @returns New position after movement
 */
function calculateMoveTowardTarget(actor: BattleUnit, target: Position): Position {
  const dx = target.x - actor.position.x;
  const dy = target.y - actor.position.y;
  const speed = actor.stats.speed;

  // Calculate movement in each direction
  let moveX = 0;
  let moveY = 0;

  // Prioritize the larger delta
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Move primarily in X direction
    moveX = dx === 0 ? 0 : Math.sign(dx) * Math.min(Math.abs(dx), speed);
    const remainingSpeed = speed - Math.abs(moveX);
    moveY = dy === 0 ? 0 : Math.sign(dy) * Math.min(Math.abs(dy), remainingSpeed);
  } else {
    // Move primarily in Y direction
    moveY = dy === 0 ? 0 : Math.sign(dy) * Math.min(Math.abs(dy), speed);
    const remainingSpeed = speed - Math.abs(moveY);
    moveX = dx === 0 ? 0 : Math.sign(dx) * Math.min(Math.abs(dx), remainingSpeed);
  }

  return {
    x: actor.position.x + moveX,
    y: actor.position.y + moveY,
  };
}

// =============================================================================
// ACTION CREATORS
// =============================================================================

/**
 * Create an attack action.
 */
function createAttackAction(targetId: string, reason: string): AIDecisionOutput {
  return {
    action: 'attack',
    targetId,
    reason,
  };
}

/**
 * Create a move action.
 */
function createMoveAction(targetPosition: Position, reason: string): AIDecisionOutput {
  return {
    action: 'move',
    targetPosition,
    reason,
  };
}

/**
 * Create a skip action.
 */
function createSkipAction(reason: string): AIDecisionOutput {
  return {
    action: 'skip',
    reason,
  };
}

/**
 * Create an ability action.
 */
export function createAbilityAction(
  abilityId: string,
  targetId: string | undefined,
  reason: string,
): AIDecisionOutput {
  return {
    action: 'ability',
    abilityId,
    targetId,
    reason,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  buildDecisionContext,
  selectLowestHpUnit,
  selectNearestUnit,
  selectHighestThreatUnit,
  selectLowestArmorUnit,
  calculateMoveTowardTarget,
  decideRoutingAction,
  HP_THRESHOLDS,
  GRID_CONFIG,
};
