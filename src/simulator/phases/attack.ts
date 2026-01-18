/**
 * Attack phase handler for battle simulation.
 *
 * Handles the attack phase which executes after movement/pre_attack.
 * Phase order: turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end
 *
 * Attack phase responsibilities:
 * 1. Rotate facing toward target
 * 2. Calculate flanking arc and damage modifier
 * 3. Calculate damage with all modifiers (flanking, charge momentum, armor shred)
 * 4. Roll dodge
 * 5. Apply damage and check for death
 * 6. Trigger riposte if applicable
 * 7. Consume ammunition
 *
 * @module simulator/phases/attack
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for return type
 * @see Requirements 2.5 for attack phase specification
 */

import {
  BattleState,
  PhaseResult,
  Phase,
  BattleEvent,
  createFlankingAppliedEvent,
  createAttackEvent,
  createDamageEvent,
  createDodgeEvent,
  createUnitDiedEvent,
  createRiposteTriggeredEvent,
  createAmmoConsumedEvent,
  createChargeImpactEvent,
  createResolveChangedEvent,
} from '../../core/types';
import { BattleUnit, FacingDirection } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';
import {
  findUnit,
  updateUnit,
  removeFromTurnQueue,
  updateOccupiedPositions,
  getTeamUnits,
} from '../../core/utils/state-helpers';
import { calculatePhysicalDamage, applyDamage } from '../../core/battle/damage';
import { SeededRandom } from '../../core/utils/random';
import {
  createFacingProcessor,
  createFlankingProcessor,
  createRiposteProcessor,
  createAmmunitionProcessor,
  createChargeProcessor,
  createLoSProcessor,
  AttackArc,
  DEFAULT_RIPOSTE_CONFIG,
  DEFAULT_AMMO_CONFIG,
  DEFAULT_CHARGE_CONFIG,
  DEFAULT_LOS_CONFIG,
  RiposteProcessor,
  AmmunitionProcessor,
  ChargeProcessor,
  LoSProcessor,
} from '../../core/mechanics';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base riposte chance (30%) */
const BASE_RIPOSTE_CHANCE = 0.3;

/** Maximum riposte chance (60%) */
const MAX_RIPOSTE_CHANCE = 0.6;

/** Initiative bonus per point difference (2% per point) */
const INITIATIVE_RIPOSTE_BONUS = 0.02;

// =============================================================================
// MAIN PHASE HANDLER
// =============================================================================

/**
 * Handle attack phase for a unit.
 *
 * Executes the following in order:
 * 1. Rotate facing toward target
 * 2. Calculate flanking arc and damage modifier
 * 3. Calculate damage with all modifiers
 * 4. Roll dodge
 * 5. Apply damage and check for death
 * 6. Trigger riposte if applicable
 * 7. Consume ammunition
 *
 * @param state - Current battle state (immutable)
 * @param attackerId - Instance ID of attacking unit
 * @param targetId - Instance ID of target unit
 * @param rng - Seeded random number generator for determinism
 * @returns Updated state and events from this phase
 *
 * @invariant Original state is not mutated
 * @invariant Events are emitted for all state changes
 * @invariant Property 10: Facing rotates toward target on attack
 *
 * @example
 * const rng = new SeededRandom(12345);
 * const { state: newState, events } = handleAttack(
 *   currentState,
 *   'player_knight_0',
 *   'enemy_rogue_0',
 *   rng
 * );
 */
export function handleAttack(
  state: BattleState,
  attackerId: string,
  targetId: string,
  rng: SeededRandom,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const attacker = findUnit(currentState, attackerId);
  const target = findUnit(currentState, targetId);

  // Validate attacker and target
  if (!attacker || !attacker.alive) {
    return { state: currentState, events };
  }
  if (!target || !target.alive) {
    return { state: currentState, events };
  }

  // Create event context for this phase
  const eventContext = {
    round: currentState.round,
    turn: currentState.turn,
    phase: 'attack' as Phase,
  };

  // ==========================================================================
  // STEP 0: Check Ammunition (Task 20.2)
  // ==========================================================================
  // Check if ranged unit has ammo before proceeding with attack
  const ammoCheck = ammunitionProcessor.checkAmmo(attacker);

  // If ranged unit is out of ammo, check if melee fallback is possible
  if (!ammoCheck.canAttack && ammoCheck.reason === 'no_ammo') {
    // Melee fallback: ranged unit out of ammo must be adjacent to attack
    const distance =
      Math.abs(attacker.position.x - target.position.x) +
      Math.abs(attacker.position.y - target.position.y);

    if (distance > 1) {
      // Cannot attack - not adjacent and no ammo
      // Return without attacking (AI should have moved closer)
      return { state: currentState, events };
    }
    // Continue with melee attack at reduced damage (handled in damage calculation)
  }

  // ==========================================================================
  // STEP 0.5: Check Line of Sight for Ranged Attacks (Task 23.6)
  // ==========================================================================
  // Check if ranged attack has clear line of sight to target
  const attackDistance =
    Math.abs(attacker.position.x - target.position.x) +
    Math.abs(attacker.position.y - target.position.y);

  // Only check LoS for ranged attacks (distance > 1)
  if (attackDistance > 1) {
    const losCheck = losProcessor.checkLoS(attacker, target, currentState);

    if (!losCheck.canAttack) {
      // LoS blocked - cannot attack
      // Return without attacking (AI should find different target or move)
      return { state: currentState, events };
    }

    // Store LoS modifiers for later use in damage/dodge calculations
    // Note: accuracyModifier and coverDodgeBonus are applied in dodge roll
  }

  // ==========================================================================
  // STEP 1: Rotate Facing Toward Target
  // ==========================================================================
  const facingResult = handleFacingRotation(
    currentState,
    attackerId,
    target.position,
    eventContext,
  );
  currentState = facingResult.state;
  events.push(...facingResult.events);

  // ==========================================================================
  // STEP 2: Calculate Flanking Arc
  // ==========================================================================
  const updatedAttacker = findUnit(currentState, attackerId);
  const updatedTarget = findUnit(currentState, targetId);
  if (!updatedAttacker || !updatedTarget) {
    return { state: currentState, events };
  }

  const flankingResult = calculateFlankingArc(updatedAttacker, updatedTarget, eventContext);
  events.push(...flankingResult.events);

  // ==========================================================================
  // STEP 3: Apply Resolve Damage from Flanking
  // ==========================================================================
  const resolveResult = applyFlankingResolveDamage(
    currentState,
    targetId,
    flankingResult.arc,
    eventContext,
  );
  currentState = resolveResult.state;
  events.push(...resolveResult.events);

  // ==========================================================================
  // STEP 3.5: Check for Spear Wall Counter (Task 21.4)
  // ==========================================================================
  // If attacker has momentum and target has spear_wall, check for counter
  const spearWallResult = checkSpearWallCounter(currentState, attackerId, targetId, eventContext);
  currentState = spearWallResult.state;
  events.push(...spearWallResult.events);

  // If charge was countered, the attacker takes damage and momentum is reset
  // The attack still proceeds but without charge bonus
  const attackerAfterCounter = findUnit(currentState, attackerId);
  if (!attackerAfterCounter || !attackerAfterCounter.alive) {
    // Attacker died from spear wall counter
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 4: Calculate Damage with Modifiers
  // ==========================================================================
  const damageResult = calculateAttackDamage(
    currentState,
    attackerId,
    targetId,
    flankingResult.modifier,
    eventContext,
  );
  events.push(...damageResult.events);

  // ==========================================================================
  // STEP 5: Roll Dodge
  // ==========================================================================
  const dodgeResult = handleDodgeRoll(currentState, attackerId, targetId, rng, eventContext);
  events.push(...dodgeResult.events);

  if (dodgeResult.dodged) {
    // Attack missed - skip damage application but still consume ammo
    const ammoResult = handleAmmoConsumption(currentState, attackerId, eventContext);
    currentState = ammoResult.state;
    events.push(...ammoResult.events);
    return { state: currentState, events };
  }

  // ==========================================================================
  // STEP 6: Apply Damage
  // ==========================================================================
  const applyResult = applyAttackDamage(
    currentState,
    attackerId,
    targetId,
    damageResult.damage,
    damageResult.damageType,
    eventContext,
  );
  currentState = applyResult.state;
  events.push(...applyResult.events);

  // ==========================================================================
  // STEP 7: Check for Riposte (if target survived)
  // ==========================================================================
  const targetAfterDamage = findUnit(currentState, targetId);
  if (targetAfterDamage && targetAfterDamage.alive) {
    const riposteResult = handleRiposte(
      currentState,
      targetId,
      attackerId,
      flankingResult.arc,
      rng,
      eventContext,
    );
    currentState = riposteResult.state;
    events.push(...riposteResult.events);
  }

  // ==========================================================================
  // STEP 8: Consume Ammunition
  // ==========================================================================
  const ammoResult = handleAmmoConsumption(currentState, attackerId, eventContext);
  currentState = ammoResult.state;
  events.push(...ammoResult.events);

  return { state: currentState, events };
}

// =============================================================================
// FACING ROTATION
// =============================================================================

/** Singleton FacingProcessor instance for this module */
const facingProcessor = createFacingProcessor();

/** Singleton FlankingProcessor instance for this module */
const flankingProcessor = createFlankingProcessor();

/** Singleton RiposteProcessor instance for this module */
const riposteProcessor: RiposteProcessor = createRiposteProcessor(DEFAULT_RIPOSTE_CONFIG);

/** Singleton AmmunitionProcessor instance for this module */
const ammunitionProcessor: AmmunitionProcessor = createAmmunitionProcessor(DEFAULT_AMMO_CONFIG);

/** Singleton ChargeProcessor instance for this module */
const chargeProcessor: ChargeProcessor = createChargeProcessor(DEFAULT_CHARGE_CONFIG);

/** Singleton LoSProcessor instance for this module (Task 23.6) */
const losProcessor: LoSProcessor = createLoSProcessor(DEFAULT_LOS_CONFIG);

/**
 * Rotate attacker to face the target.
 *
 * Uses the FacingProcessor from core/mechanics to determine the cardinal
 * direction from attacker to target and updates the attacker's facing direction.
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param targetPosition - Target's position
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.5 for facing rotation specification
 * @see Requirements 1.3 for phase hook specification
 */
function handleFacingRotation(
  state: BattleState,
  attackerId: string,
  targetPosition: Position,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  // Delegate to FacingProcessor for facing rotation
  return facingProcessor.faceTarget(state, attackerId, targetPosition, eventContext);
}

/**
 * Calculate the facing direction from one position to another.
 * Delegates to FacingProcessor for consistent behavior.
 *
 * @param from - Source position
 * @param to - Target position
 * @returns Cardinal direction (N, S, E, W)
 */
export function calculateFacingDirection(from: Position, to: Position): FacingDirection {
  return facingProcessor.calculateFacingDirection(from, to);
}

// =============================================================================
// FLANKING CALCULATION
// =============================================================================

/**
 * Result of flanking arc calculation.
 */
interface FlankingResult {
  /** Attack arc (front, flank, or rear) */
  arc: AttackArc;
  /** Damage modifier for this arc */
  modifier: number;
  /** Events generated */
  events: BattleEvent[];
}

/**
 * Calculate the attack arc and flanking modifier.
 *
 * Attack Arc Determination:
 * - Front: attacker is within ±45° of target's facing direction
 * - Flank: attacker is within 45°-135° of target's facing direction
 * - Rear: attacker is within ±45° of opposite to target's facing direction
 *
 * @param attacker - Attacking unit
 * @param target - Target unit
 * @param eventContext - Event context for creating events
 * @returns Flanking result with arc, modifier, and events
 *
 * @see Requirements 2.5 for flanking specification
 */
function calculateFlankingArc(
  attacker: BattleUnit,
  target: BattleUnit,
  eventContext: { round: number; turn: number; phase: Phase },
): FlankingResult {
  const events: BattleEvent[] = [];

  // Calculate attack arc based on target's facing
  const arc = getAttackArc(attacker.position, target.position, target.facing);

  // Get damage modifier for this arc
  const modifier = getFlankingModifier(arc);

  // Emit flanking applied event
  const flankingEvent = createFlankingAppliedEvent(
    eventContext,
    attacker.instanceId,
    target.instanceId,
    {
      attackerId: attacker.instanceId,
      targetId: target.instanceId,
      arc,
      modifier,
    },
  );
  events.push(flankingEvent);

  return { arc, modifier, events };
}

/**
 * Determine the attack arc based on positions and target facing.
 * Delegates to FacingProcessor for consistent arc calculation.
 *
 * @param attackerPos - Attacker's position
 * @param targetPos - Target's position
 * @param targetFacing - Target's facing direction
 * @returns Attack arc (front, flank, or rear)
 */
export function getAttackArc(
  attackerPos: Position,
  targetPos: Position,
  targetFacing: FacingDirection,
): AttackArc {
  // Delegate to FacingProcessor for consistent arc calculation
  return facingProcessor.getAttackArc(attackerPos, targetPos, targetFacing);
}

/**
 * Get the damage modifier for an attack arc.
 * Delegates to FlankingProcessor for consistent behavior.
 *
 * @param arc - Attack arc
 * @returns Damage modifier (1.0, 1.15, or 1.30)
 */
export function getFlankingModifier(arc: AttackArc): number {
  return flankingProcessor.getDamageModifier(arc);
}

// =============================================================================
// RESOLVE DAMAGE FROM FLANKING
// =============================================================================

/**
 * Apply resolve damage from flanking/rear attacks.
 * Uses FlankingProcessor to get resolve damage values.
 *
 * Resolve Damage:
 * - Flanking attack received: -5 resolve
 * - Rear attack received: -10 resolve
 *
 * @param state - Current battle state
 * @param targetId - Target unit receiving the attack
 * @param arc - Attack arc
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 */
function applyFlankingResolveDamage(
  state: BattleState,
  targetId: string,
  arc: AttackArc,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  // Get resolve damage from FlankingProcessor (returns 0 for front attacks)
  const resolveDamage = flankingProcessor.getResolveDamage(arc);

  // No resolve damage for front attacks
  if (resolveDamage === 0) {
    return { state: currentState, events };
  }

  const target = findUnit(currentState, targetId);
  if (!target || !target.alive) {
    return { state: currentState, events };
  }

  const newResolve = Math.max(0, target.resolve - resolveDamage);

  // Update target resolve
  currentState = updateUnit(currentState, targetId, {
    resolve: newResolve,
  });

  // Emit resolve changed event
  const resolveEvent = createResolveChangedEvent(eventContext, targetId, {
    unitId: targetId,
    delta: -resolveDamage,
    newValue: newResolve,
    maxValue: target.maxResolve,
    source: 'flanking',
  });
  events.push(resolveEvent);

  return { state: currentState, events };
}

// =============================================================================
// SPEAR WALL COUNTER CHECK
// =============================================================================

/**
 * Result of spear wall counter check.
 */
interface SpearWallCounterCheckResult extends PhaseResult {
  /** Whether the charge was countered */
  wasCountered: boolean;
}

/**
 * Check if a charging unit is countered by a spear wall target.
 *
 * Uses ChargeProcessor.isCounteredBySpearWall() to check if the target
 * can counter the charge. If countered:
 * - Attacker takes counter damage (150% of target's ATK)
 * - Attacker's momentum is reset to 0
 * - Attacker's chargeCountered flag is set
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit (potential charger)
 * @param targetId - Target unit (potential spear wall)
 * @param eventContext - Event context for creating events
 * @returns Updated state, events, and whether counter occurred
 *
 * @see Task 21.4: Call isCounteredBySpearWall() check
 * @see Requirements 1.6 for charge specification
 */
function checkSpearWallCounter(
  state: BattleState,
  attackerId: string,
  targetId: string,
  eventContext: { round: number; turn: number; phase: Phase },
): SpearWallCounterCheckResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const attacker = findUnit(currentState, attackerId);
  const target = findUnit(currentState, targetId);

  if (!attacker || !attacker.alive || !target || !target.alive) {
    return { state: currentState, events, wasCountered: false };
  }

  // Only check for counter if attacker has momentum (is charging)
  if (attacker.momentum <= 0) {
    return { state: currentState, events, wasCountered: false };
  }

  // Use ChargeProcessor to check if target can counter (Task 21.4)
  if (!chargeProcessor.isCounteredBySpearWall(target)) {
    return { state: currentState, events, wasCountered: false };
  }

  // Spear wall counter triggered!
  // Calculate counter damage using ChargeProcessor
  const counterDamage = chargeProcessor.calculateCounterDamage(target);

  // Apply counter damage to attacker
  const newHp = Math.max(0, attacker.currentHp - counterDamage);
  const attackerAlive = newHp > 0;

  // Update attacker with counter damage and reset momentum
  currentState = updateUnit(currentState, attackerId, {
    currentHp: newHp,
    alive: attackerAlive,
    momentum: 0,
    isCharging: false,
    chargeCountered: true,
  });

  // Emit charge countered event (using damage event with source 'intercept')
  const damageEvent = createDamageEvent(
    eventContext,
    attackerId,
    {
      amount: counterDamage,
      damageType: 'physical',
      source: 'intercept',
      newHp,
      maxHp: attacker.maxHp,
    },
    targetId,
  );
  events.push(damageEvent);

  // If attacker died from counter, emit death event
  if (!attackerAlive) {
    const deathResult = handleUnitDeath(
      currentState,
      attackerId,
      targetId,
      'intercept',
      eventContext,
    );
    currentState = deathResult.state;
    events.push(...deathResult.events);
  }

  return { state: currentState, events, wasCountered: true };
}

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================

/**
 * Result of damage calculation.
 */
interface DamageCalculationResult {
  /** Calculated damage amount */
  damage: number;
  /** Damage type */
  damageType: 'physical' | 'magic';
  /** Events generated */
  events: BattleEvent[];
}

/**
 * Calculate attack damage with all modifiers.
 *
 * Formula: max(1, (ATK * flankingModifier * (1 + momentumBonus) - effectiveArmor) * atkCount)
 *
 * Uses ChargeProcessor.getChargeBonus() to calculate momentum bonus.
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param targetId - Target unit
 * @param flankingModifier - Flanking damage modifier
 * @param eventContext - Event context for creating events
 * @returns Damage calculation result
 *
 * @see Requirements 2.5 for damage calculation specification
 * @see Task 21.3: Call getChargeBonus() for damage calculation
 */
function calculateAttackDamage(
  state: BattleState,
  attackerId: string,
  targetId: string,
  flankingModifier: number,
  eventContext: { round: number; turn: number; phase: Phase },
): DamageCalculationResult {
  const events: BattleEvent[] = [];

  const attacker = findUnit(state, attackerId);
  const target = findUnit(state, targetId);

  if (!attacker || !target) {
    return { damage: 0, damageType: 'physical', events };
  }

  // Calculate momentum bonus from charge using ChargeProcessor (Task 21.3)
  const momentumBonus = chargeProcessor.getChargeBonus(attacker.momentum);

  // Emit charge impact event if there's momentum
  if (attacker.momentum > 0) {
    const bonusDamage = Math.floor(attacker.stats.atk * momentumBonus);
    const chargeEvent = createChargeImpactEvent(eventContext, attackerId, targetId, {
      attackerId,
      targetId,
      momentum: attacker.momentum,
      bonusDamage,
      wasCountered: false,
    });
    events.push(chargeEvent);
  }

  // Determine damage type (mages deal magic damage)
  const isMage = attacker.tags.includes('mage');
  const damageType: 'physical' | 'magic' = isMage ? 'magic' : 'physical';

  // Calculate damage
  let damage: number;
  if (damageType === 'magic') {
    // Magic damage ignores armor
    damage = attacker.stats.atk * attacker.stats.atkCount;
  } else {
    // Physical damage with all modifiers
    damage = calculatePhysicalDamage(attacker, target, undefined, {
      flankingModifier,
      momentumBonus,
    });
  }

  return { damage, damageType, events };
}

// =============================================================================
// DODGE ROLL
// =============================================================================

/**
 * Result of dodge roll.
 */
interface DodgeResult {
  /** Whether the attack was dodged */
  dodged: boolean;
  /** Events generated */
  events: BattleEvent[];
}

/**
 * Handle dodge roll for an attack.
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param targetId - Target unit
 * @param rng - Seeded random number generator
 * @param eventContext - Event context for creating events
 * @returns Dodge result
 *
 * @see Requirements 2.5 for dodge specification
 */
function handleDodgeRoll(
  state: BattleState,
  attackerId: string,
  targetId: string,
  rng: SeededRandom,
  eventContext: { round: number; turn: number; phase: Phase },
): DodgeResult {
  const events: BattleEvent[] = [];

  const target = findUnit(state, targetId);
  if (!target) {
    return { dodged: false, events };
  }

  // Get dodge chance (capped at 50%)
  const dodgeChance = Math.min(target.stats.dodge, 50) / 100;
  const roll = rng.next();
  const dodged = roll < dodgeChance;

  if (dodged) {
    // Emit dodge event
    const dodgeEvent = createDodgeEvent(eventContext, attackerId, targetId, {
      dodgeChance: target.stats.dodge,
      roll: Math.floor(roll * 100),
    });
    events.push(dodgeEvent);
  }

  return { dodged, events };
}

// =============================================================================
// APPLY DAMAGE
// =============================================================================

/**
 * Result of applying damage.
 */
interface ApplyDamageResult extends PhaseResult {
  /** Whether the target was killed */
  killed: boolean;
}

/**
 * Apply damage to target and handle death.
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param targetId - Target unit
 * @param damage - Damage amount
 * @param damageType - Type of damage
 * @param eventContext - Event context for creating events
 * @returns Updated state, events, and kill status
 *
 * @see Requirements 2.5 for damage application specification
 */
function applyAttackDamage(
  state: BattleState,
  attackerId: string,
  targetId: string,
  damage: number,
  damageType: 'physical' | 'magic',
  eventContext: { round: number; turn: number; phase: Phase },
): ApplyDamageResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const target = findUnit(currentState, targetId);
  if (!target || !target.alive) {
    return { state: currentState, events, killed: false };
  }

  // Apply damage
  const damageResult = applyDamage(target, damage);

  // Update target HP and alive status
  currentState = updateUnit(currentState, targetId, {
    currentHp: damageResult.newHp,
    alive: !damageResult.killed,
  });

  // Emit attack event
  const attackEvent = createAttackEvent(eventContext, attackerId, targetId, {
    damage,
    damageType,
    isCritical: false,
    isRiposte: false,
  });
  events.push(attackEvent);

  // Emit damage event
  const damageEvent = createDamageEvent(
    eventContext,
    targetId,
    {
      amount: damage,
      damageType,
      source: 'attack',
      newHp: damageResult.newHp,
      maxHp: target.maxHp,
    },
    attackerId,
  );
  events.push(damageEvent);

  // Handle death
  if (damageResult.killed) {
    const deathResult = handleUnitDeath(currentState, targetId, attackerId, 'damage', eventContext);
    currentState = deathResult.state;
    events.push(...deathResult.events);
  }

  return { state: currentState, events, killed: damageResult.killed };
}

/**
 * Handle unit death and related effects.
 *
 * @param state - Current battle state
 * @param deadUnitId - Unit that died
 * @param killerId - Unit that caused the death
 * @param cause - Cause of death
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 */
function handleUnitDeath(
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

  // Emit unit died event
  const diedEvent = createUnitDiedEvent(eventContext, deadUnitId, {
    unitId: deadUnitId,
    killerId,
    cause,
    position: deadUnit.position,
  });
  events.push(diedEvent);

  // Remove from turn queue
  currentState = removeFromTurnQueue(currentState, deadUnitId);

  // Update occupied positions
  currentState = updateOccupiedPositions(currentState);

  // Apply resolve damage to nearby allies
  const resolveResult = applyAllyDeathResolveDamage(currentState, deadUnit, eventContext);
  currentState = resolveResult.state;
  events.push(...resolveResult.events);

  return { state: currentState, events };
}

/**
 * Apply resolve damage to allies when a unit dies.
 *
 * Resolve Damage:
 * - Adjacent ally dies: -15 resolve
 * - Nearby ally dies (≤3 cells): -8 resolve
 *
 * @param state - Current battle state
 * @param deadUnit - Unit that died
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 */
function applyAllyDeathResolveDamage(
  state: BattleState,
  deadUnit: BattleUnit,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  // Get allies of the dead unit
  const allies = getTeamUnits(currentState, deadUnit.team).filter(
    (ally) => ally.instanceId !== deadUnit.instanceId && ally.alive,
  );

  for (const ally of allies) {
    const distance = manhattanDistance(ally.position, deadUnit.position);

    let resolveDamage = 0;
    if (distance === 1) {
      // Adjacent ally
      resolveDamage = 15;
    } else if (distance <= 3) {
      // Nearby ally
      resolveDamage = 8;
    }

    if (resolveDamage > 0) {
      const newResolve = Math.max(0, ally.resolve - resolveDamage);
      currentState = updateUnit(currentState, ally.instanceId, {
        resolve: newResolve,
      });

      // Emit resolve changed event
      const resolveEvent = createResolveChangedEvent(eventContext, ally.instanceId, {
        unitId: ally.instanceId,
        delta: -resolveDamage,
        newValue: newResolve,
        maxValue: ally.maxResolve,
        source: 'ally_death',
      });
      events.push(resolveEvent);
    }
  }

  return { state: currentState, events };
}

/**
 * Calculate Manhattan distance between two positions.
 */
function manhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// =============================================================================
// RIPOSTE
// =============================================================================

/**
 * Handle riposte counter-attack using RiposteProcessor.
 *
 * Riposte Conditions (checked by RiposteProcessor):
 * 1. Defender has riposteCharges > 0
 * 2. Attacker is in defender's front arc
 * 3. Defender is not stunned/routing
 * 4. Random roll < riposte chance
 *
 * Riposte Chance (calculated by RiposteProcessor):
 * - Base: 50% (from DEFAULT_RIPOSTE_CONFIG)
 * - Initiative-based: +/- based on initiative difference
 * - Guaranteed at +10 initiative difference
 *
 * @param state - Current battle state
 * @param defenderId - Defending unit (potential riposte)
 * @param attackerId - Attacking unit (riposte target)
 * @param attackArc - Arc of the original attack
 * @param rng - Seeded random number generator
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 1.4 for riposte specification
 * @see Requirements 2.5 for attack phase specification
 */
function handleRiposte(
  state: BattleState,
  defenderId: string,
  attackerId: string,
  attackArc: AttackArc,
  rng: SeededRandom,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const defender = findUnit(currentState, defenderId);
  const attacker = findUnit(currentState, attackerId);

  if (!defender || !defender.alive || !attacker || !attacker.alive) {
    return { state: currentState, events };
  }

  // Step 1: Check riposte conditions using RiposteProcessor
  // (Task 19.2: Call canRiposte() after attack damage)
  if (!riposteProcessor.canRiposte(defender, attacker, attackArc)) {
    return { state: currentState, events };
  }

  // Step 2: Calculate riposte chance using RiposteProcessor
  // (Task 19.3: Call getRiposteChance() and roll)
  const riposteChance = riposteProcessor.getRiposteChance(defender, attacker);

  // Roll for riposte
  const roll = rng.next();
  if (roll >= riposteChance) {
    return { state: currentState, events };
  }

  // Step 3: Execute riposte using RiposteProcessor
  // (Task 19.4: Call executeRiposte() on success)
  currentState = riposteProcessor.executeRiposte(defender, attacker, currentState);

  // Get updated units after riposte execution
  const updatedAttacker = findUnit(currentState, attackerId);
  const updatedDefender = findUnit(currentState, defenderId);

  // Calculate riposte damage for event (50% of defender's ATK)
  const riposteDamage = Math.floor((defender.stats?.atk ?? 0) * 0.5);

  // Step 4: Emit riposte_triggered event
  // (Task 19.5: Emit riposte_triggered events)
  const riposteEvent = createRiposteTriggeredEvent(eventContext, defenderId, attackerId, {
    defenderId,
    attackerId,
    damage: riposteDamage,
    chance: Math.floor(riposteChance * 100),
    roll: Math.floor(roll * 100),
    chargesRemaining: updatedDefender?.riposteCharges ?? 0,
  });
  events.push(riposteEvent);

  // Emit damage event for riposte
  const damageEvent = createDamageEvent(
    eventContext,
    attackerId,
    {
      amount: riposteDamage,
      damageType: 'physical',
      source: 'riposte',
      newHp: updatedAttacker?.currentHp ?? 0,
      maxHp: attacker.maxHp,
    },
    defenderId,
  );
  events.push(damageEvent);

  // Handle attacker death from riposte
  if (updatedAttacker && !updatedAttacker.alive) {
    const deathResult = handleUnitDeath(
      currentState,
      attackerId,
      defenderId,
      'riposte',
      eventContext,
    );
    currentState = deathResult.state;
    events.push(...deathResult.events);
  }

  return { state: currentState, events };
}

/**
 * Check if a defender can riposte.
 * Delegates to RiposteProcessor for consistent behavior.
 *
 * @param defender - Defending unit
 * @param attacker - Attacking unit
 * @param attackArc - Arc of the attack
 * @returns True if riposte is possible
 */
export function canRiposte(
  defender: BattleUnit,
  attacker: BattleUnit,
  attackArc: AttackArc,
): boolean {
  // Delegate to RiposteProcessor for consistent riposte eligibility check
  return riposteProcessor.canRiposte(defender, attacker, attackArc);
}

/**
 * Calculate riposte chance based on initiative.
 * Delegates to RiposteProcessor for consistent behavior.
 *
 * Uses DEFAULT_RIPOSTE_CONFIG:
 * - Base: 50%
 * - Initiative-based: +/- based on initiative difference
 * - Guaranteed at +10 initiative difference
 *
 * @param defender - Defending unit
 * @param attacker - Attacking unit
 * @returns Riposte chance (0-1)
 */
export function calculateRiposteChance(defender: BattleUnit, attacker: BattleUnit): number {
  // Delegate to RiposteProcessor for consistent riposte chance calculation
  return riposteProcessor.getRiposteChance(defender, attacker);
}

/**
 * Calculate riposte damage.
 *
 * Riposte deals reduced damage (50% of defender's ATK) based on RIPOSTE_DAMAGE_MULTIPLIER.
 *
 * @param defender - Defending unit (dealing riposte)
 * @param _attacker - Attacking unit (receiving riposte) - unused but kept for API consistency
 * @returns Riposte damage amount
 */
// Unused - kept for future reference
// function calculateRiposteDamage(defender: BattleUnit, _attacker: BattleUnit): number {
//   // Riposte deals 50% of defender's ATK (from RIPOSTE_DAMAGE_MULTIPLIER)
//   const defenderAtk = defender.stats?.atk ?? 0;
//   return Math.floor(defenderAtk * RIPOSTE_DAMAGE_MULTIPLIER);
// }

// =============================================================================
// AMMUNITION CONSUMPTION
// =============================================================================

/**
 * Handle ammunition consumption after attack using AmmunitionProcessor.
 *
 * Uses the AmmunitionProcessor to:
 * - Check if unit uses ammunition (ranged units)
 * - Consume ammunition on attack
 * - Emit ammo_consumed events
 *
 * When ammo = 0, ranged units switch to melee fallback (handled in attack check).
 *
 * @param state - Current battle state
 * @param attackerId - Attacking unit
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 1.5 for ammunition specification
 * @see Task 20.4: Call consume() after attack
 * @see Task 20.5: Emit ammo_consumed events
 */
function handleAmmoConsumption(
  state: BattleState,
  attackerId: string,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const attacker = findUnit(currentState, attackerId);
  if (!attacker || !attacker.alive) {
    return { state: currentState, events };
  }

  // Use AmmunitionProcessor to consume ammo (Task 20.4)
  const consumeResult = ammunitionProcessor.consumeAmmo(attacker, currentState);

  // If no ammo was consumed (melee unit or unlimited ammo), return unchanged
  if (!consumeResult.success || consumeResult.ammoConsumed === 0) {
    return { state: currentState, events };
  }

  // Update attacker with new ammo count
  currentState = updateUnit(currentState, attackerId, {
    ammo: consumeResult.ammoRemaining,
  });

  // Determine ammo type based on unit tags
  const ammoType = getAmmoType(attacker);

  // Emit ammo consumed event (Task 20.5)
  const ammoEvent = createAmmoConsumedEvent(eventContext, attackerId, {
    unitId: attackerId,
    ammoType,
    consumed: consumeResult.ammoConsumed,
    remaining: consumeResult.ammoRemaining,
    maxAmmo: typeof attacker.maxAmmo === 'number' ? attacker.maxAmmo : 0,
  });
  events.push(ammoEvent);

  return { state: currentState, events };
}

/**
 * Get the ammo type for a unit based on its tags.
 *
 * @param unit - Unit to check
 * @returns Ammo type
 */
function getAmmoType(unit: BattleUnit): 'arrow' | 'bolt' | 'spell' {
  if (unit.tags.includes('mage')) {
    return 'spell';
  }
  if (unit.id === 'crossbowman' || unit.tags.includes('crossbow')) {
    return 'bolt';
  }
  return 'arrow';
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  handleFacingRotation,
  calculateFlankingArc,
  calculateAttackDamage,
  handleDodgeRoll,
  applyAttackDamage,
  handleRiposte,
  handleAmmoConsumption,
  handleUnitDeath,
  applyAllyDeathResolveDamage,
  applyFlankingResolveDamage,
  checkSpearWallCounter,
  BASE_RIPOSTE_CHANCE,
  MAX_RIPOSTE_CHANCE,
  INITIATIVE_RIPOSTE_BONUS,
  riposteProcessor,
  ammunitionProcessor,
  chargeProcessor,
  losProcessor,
};

// Re-export flanking constants from mechanics module for backward compatibility
export {
  FLANKING_DAMAGE_MODIFIERS,
  DEFAULT_FLANKING_RESOLVE_DAMAGE,
  RIPOSTE_DAMAGE_MULTIPLIER,
} from '../../core/mechanics';
