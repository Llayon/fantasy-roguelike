/**
 * Turn start phase handler for battle simulation.
 *
 * Handles the turn_start phase which executes at the beginning of each unit's turn.
 * Phase order: turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end
 *
 * Turn start phase responsibilities:
 * 1. Resolve regeneration (+5 base, +3 if in phalanx)
 * 2. Reset riposte charges to max
 * 3. Check routing status (route if resolve = 0, rally if resolve >= 25)
 * 4. Apply aura pulse effects from nearby allies
 *
 * @module simulator/phases/turn-start
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for return type
 * @see Requirements 2.3 for turn_start phase specification
 */

import {
  BattleState,
  PhaseResult,
  Phase,
  createResolveChangedEvent,
  createRiposteResetEvent,
  createRoutingStartedEvent,
  createUnitRalliedEvent,
  createAuraPulseEvent,
  BattleEvent,
} from '../../core/types';
import { BattleUnit } from '../../core/types/battle-unit';
import { findUnit, updateUnit, getTeamUnits } from '../../core/utils/state-helpers';
import { createResolveProcessor, DEFAULT_RESOLVE_CONFIG } from '../../core/mechanics';
import type { ResolveConfig } from '../../core/mechanics';
import type { UnitWithResolve } from '../../core/mechanics/tier1/resolve';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base resolve regeneration per turn */
const RESOLVE_REGEN_BASE = 5;

/** Additional resolve regeneration when in phalanx formation */
const RESOLVE_REGEN_PHALANX_BONUS = 3;

/** Default riposte charges to reset at turn start */
const DEFAULT_RIPOSTE_CHARGES = 1;

/** Resolve threshold for rallying from routing */
const RALLY_THRESHOLD = 25;

/** Minimum adjacent allies required for phalanx formation */
const PHALANX_MIN_ALLIES = 2;

/** Resolve processor instance using default config */
// const _resolveProcessor = createResolveProcessor(DEFAULT_RESOLVE_CONFIG);

// =============================================================================
// MAIN PHASE HANDLER
// =============================================================================

/**
 * Handle turn_start phase for a unit.
 *
 * Executes the following in order:
 * 1. Resolve regeneration (+5 base, +3 if in phalanx)
 * 2. Reset riposte charges
 * 3. Check routing/rally status
 * 4. Apply aura pulse effects
 *
 * @param state - Current battle state (immutable)
 * @param unitId - Instance ID of unit starting their turn
 * @returns Updated state and events from this phase
 *
 * @invariant Original state is not mutated
 * @invariant Events are emitted for all state changes
 * @invariant Property 9: Riposte charges are reset at turn start
 *
 * @example
 * const { state: newState, events } = handleTurnStart(
 *   currentState,
 *   'player_knight_0'
 * );
 */
export function handleTurnStart(state: BattleState, unitId: string): PhaseResult {
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
    phase: 'turn_start' as Phase,
  };

  // ==========================================================================
  // STEP 1: Resolve Regeneration
  // ==========================================================================
  const resolveResult = handleResolveRegeneration(currentState, unitId, eventContext);
  currentState = resolveResult.state;
  events.push(...resolveResult.events);

  // ==========================================================================
  // STEP 2: Reset Riposte Charges
  // ==========================================================================
  const riposteResult = handleRiposteReset(currentState, unitId, eventContext);
  currentState = riposteResult.state;
  events.push(...riposteResult.events);

  // ==========================================================================
  // STEP 3: Check Routing/Rally Status
  // ==========================================================================
  const routingResult = handleRoutingCheck(currentState, unitId, eventContext);
  currentState = routingResult.state;
  events.push(...routingResult.events);

  // ==========================================================================
  // STEP 4: Apply Aura Pulse Effects
  // ==========================================================================
  const auraResult = handleAuraPulse(currentState, unitId, eventContext);
  currentState = auraResult.state;
  events.push(...auraResult.events);

  return { state: currentState, events };
}

// =============================================================================
// RESOLVE REGENERATION
// =============================================================================

/**
 * Handle resolve regeneration at turn start using ResolveProcessor.
 *
 * Formula:
 * - Base: +5 resolve per turn (from config.baseRegeneration)
 * - Phalanx bonus: +3 additional resolve if in phalanx formation
 *
 * Uses the ResolveProcessor.regenerate() method for core logic.
 *
 * @param state - Current battle state
 * @param unitId - Unit to regenerate resolve for
 * @param eventContext - Event context for creating events
 * @param config - Optional resolve configuration (defaults to DEFAULT_RESOLVE_CONFIG)
 * @returns Updated state and events
 *
 * @see Requirements 2.3 for resolve regeneration specification
 */
function handleResolveRegeneration(
  state: BattleState,
  unitId: string,
  eventContext: { round: number; turn: number; phase: Phase },
  config: ResolveConfig = DEFAULT_RESOLVE_CONFIG,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Don't regenerate for routing units
  if (unit.isRouting) {
    return { state: currentState, events };
  }

  // Check if unit is at max resolve
  if (unit.resolve >= unit.maxResolve) {
    return { state: currentState, events };
  }

  // Calculate phalanx status for bonus regeneration
  const inPhalanx = checkPhalanxStatus(currentState, unit);

  // Create effective config with phalanx bonus
  const effectiveConfig: ResolveConfig = inPhalanx
    ? { ...config, baseRegeneration: config.baseRegeneration + RESOLVE_REGEN_PHALANX_BONUS }
    : config;

  // Use ResolveProcessor for regeneration
  const processor = createResolveProcessor(effectiveConfig);
  const unitWithResolve = unit as BattleUnit & UnitWithResolve;
  const regeneratedUnit = processor.regenerate(unitWithResolve, effectiveConfig);

  // Calculate actual delta
  const actualDelta = regeneratedUnit.resolve - unit.resolve;

  // Skip if no change
  if (actualDelta === 0) {
    return { state: currentState, events };
  }

  // Update unit resolve and phalanx status
  currentState = updateUnit(currentState, unitId, {
    resolve: regeneratedUnit.resolve,
    inPhalanx,
  });

  // Emit resolve changed event
  const resolveEvent = createResolveChangedEvent(eventContext, unitId, {
    unitId,
    delta: actualDelta,
    newValue: regeneratedUnit.resolve,
    maxValue: unit.maxResolve,
    source: inPhalanx ? 'phalanx' : 'regeneration',
  });
  events.push(resolveEvent);

  return { state: currentState, events };
}

// =============================================================================
// RIPOSTE CHARGE RESET
// =============================================================================

/**
 * Reset riposte charges at turn start.
 *
 * Property 9: Riposte charges are reset to max at the start of each turn.
 *
 * @param state - Current battle state
 * @param unitId - Unit to reset charges for
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.3, 3.4 for riposte charge reset specification
 */
function handleRiposteReset(
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

  // Reset riposte charges to default
  const newCharges = DEFAULT_RIPOSTE_CHARGES;

  // Skip if already at max
  if (unit.riposteCharges === newCharges) {
    return { state: currentState, events };
  }

  // Update unit riposte charges
  currentState = updateUnit(currentState, unitId, {
    riposteCharges: newCharges,
  });

  // Emit riposte reset event
  const riposteEvent = createRiposteResetEvent(eventContext, unitId, newCharges);
  events.push(riposteEvent);

  return { state: currentState, events };
}

// =============================================================================
// ROUTING/RALLY CHECK
// =============================================================================

/**
 * Check and update routing/rally status at turn start using ResolveProcessor.
 *
 * Routing rules:
 * - Human units route when resolve = 0 (checkState returns 'routing')
 * - Human units rally when resolve >= 25
 * - Undead units crumble (die) when resolve = 0 (checkState returns 'crumbled')
 *
 * Uses the ResolveProcessor.checkState() method to determine routing status,
 * and startRouting()/rally() methods to update state.
 *
 * @param state - Current battle state
 * @param unitId - Unit to check routing status for
 * @param eventContext - Event context for creating events
 * @param config - Optional resolve configuration (defaults to DEFAULT_RESOLVE_CONFIG)
 * @returns Updated state and events
 *
 * @see Requirements 2.3 for routing/rally specification
 */
function handleRoutingCheck(
  state: BattleState,
  unitId: string,
  eventContext: { round: number; turn: number; phase: Phase },
  config: ResolveConfig = DEFAULT_RESOLVE_CONFIG,
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Use ResolveProcessor to check routing status
  const processor = createResolveProcessor(config);
  const unitWithResolve = unit as BattleUnit & UnitWithResolve;
  const resolveState = processor.checkState(unitWithResolve, config);

  // Handle routing state
  if (resolveState === 'routing' && !unit.isRouting) {
    // Unit should start routing
    currentState = processor.startRouting(currentState, unitId);

    // Emit routing started event
    const routingEvent = createRoutingStartedEvent(eventContext, unitId, {
      unitId,
      resolve: unit.resolve,
      faction: unit.faction,
    });
    events.push(routingEvent);
  } else if (resolveState === 'crumbled' && unit.faction === 'undead') {
    // Undead unit crumbles - mark as dead
    // Note: This is handled separately in damage resolution, but we check here too
    currentState = updateUnit(currentState, unitId, {
      alive: false,
      currentHp: 0,
    });
  }

  // Check if unit should rally (routing and resolve >= RALLY_THRESHOLD)
  const unitAfterRoutingCheck = findUnit(currentState, unitId);
  if (
    unitAfterRoutingCheck &&
    unitAfterRoutingCheck.isRouting &&
    unitAfterRoutingCheck.resolve >= RALLY_THRESHOLD
  ) {
    // Unit rallies
    currentState = processor.rally(currentState, unitId);

    // Emit unit rallied event
    const rallyEvent = createUnitRalliedEvent(eventContext, unitId, {
      unitId,
      resolve: unitAfterRoutingCheck.resolve,
    });
    events.push(rallyEvent);
  }

  return { state: currentState, events };
}

// =============================================================================
// AURA PULSE EFFECTS
// =============================================================================

/**
 * Apply aura pulse effects at turn start.
 *
 * Aura effects are applied from nearby allies with aura abilities.
 * Currently supports:
 * - Healing auras (restore HP to nearby allies)
 * - Buff auras (apply stat bonuses to nearby allies)
 *
 * @param state - Current battle state
 * @param unitId - Unit to apply aura effects to
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.3 for aura pulse specification
 */
function handleAuraPulse(
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

  // Find allies with aura abilities
  const allies = getTeamUnits(currentState, unit.team).filter(
    (ally) => ally.instanceId !== unitId && ally.alive,
  );

  // Check each ally for aura abilities
  for (const ally of allies) {
    // Check if ally has an aura ability
    const auraAbility = getAuraAbility(ally);
    if (!auraAbility) {
      continue;
    }

    // Check if unit is within aura range
    const distance = manhattanDistance(unit.position, ally.position);
    if (distance > auraAbility.range) {
      continue;
    }

    // Apply aura effect
    const auraResult = applyAuraEffect(
      currentState,
      unitId,
      ally.instanceId,
      auraAbility,
      eventContext,
    );
    currentState = auraResult.state;
    events.push(...auraResult.events);
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
function manhattanDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

/**
 * Aura ability definition.
 */
interface AuraAbility {
  /** Ability ID */
  id: string;
  /** Aura type */
  type: 'healing' | 'buff';
  /** Effect range in cells */
  range: number;
  /** Effect value (HP for healing, stat bonus for buff) */
  value: number;
  /** Stat affected (for buff auras) */
  stat?: string;
}

/**
 * Get aura ability from a unit if it has one.
 *
 * @param unit - Unit to check
 * @returns Aura ability definition or null
 */
function getAuraAbility(unit: BattleUnit): AuraAbility | null {
  // Check for known aura abilities
  // This is a simplified implementation - in production, this would
  // reference the ability data system
  if (unit.abilities.includes('healing_aura')) {
    return {
      id: 'healing_aura',
      type: 'healing',
      range: 2,
      value: 5,
    };
  }

  if (unit.abilities.includes('inspire_aura')) {
    return {
      id: 'inspire_aura',
      type: 'buff',
      range: 2,
      value: 10,
      stat: 'atk',
    };
  }

  return null;
}

/**
 * Apply an aura effect to a unit.
 *
 * @param state - Current battle state
 * @param targetId - Unit receiving the aura effect
 * @param sourceId - Unit providing the aura
 * @param aura - Aura ability definition
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 */
function applyAuraEffect(
  state: BattleState,
  targetId: string,
  sourceId: string,
  aura: AuraAbility,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const target = findUnit(currentState, targetId);
  if (!target || !target.alive) {
    return { state: currentState, events };
  }

  // Apply effect based on aura type
  if (aura.type === 'healing') {
    // Heal the target
    const newHp = Math.min(target.currentHp + aura.value, target.maxHp);
    if (newHp > target.currentHp) {
      currentState = updateUnit(currentState, targetId, {
        currentHp: newHp,
      });
    }
  }
  // Note: Buff auras would modify stats temporarily
  // This is a simplified implementation

  // Emit aura pulse event
  const auraEvent = createAuraPulseEvent(eventContext, sourceId, {
    sourceId,
    auraType: aura.id,
    affectedUnits: [targetId],
    effect: aura.type === 'healing' ? `heal_${aura.value}` : `buff_${aura.stat}_${aura.value}`,
  });
  events.push(auraEvent);

  return { state: currentState, events };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  handleResolveRegeneration,
  handleRiposteReset,
  handleRoutingCheck,
  handleAuraPulse,
  checkPhalanxStatus,
  RESOLVE_REGEN_BASE,
  RESOLVE_REGEN_PHALANX_BONUS,
  DEFAULT_RIPOSTE_CHARGES,
  RALLY_THRESHOLD,
  PHALANX_MIN_ALLIES,
};
