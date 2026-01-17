/**
 * Turn end phase handler for battle simulation.
 *
 * Handles the turn_end phase which executes at the end of each unit's turn.
 * Phase order: turn_start → ai_decision → movement → pre_attack → attack → post_attack → turn_end
 *
 * Turn end phase responsibilities:
 * 1. Spread contagion effects to adjacent allies
 * 2. Decay armor shred on the unit
 * 3. Tick ability cooldowns
 *
 * @module simulator/phases/turn-end
 * @see {@link BattleState} for state structure
 * @see {@link PhaseResult} for return type
 * @see Requirements 2.2 for turn_end phase specification
 */

import {
  BattleState,
  PhaseResult,
  Phase,
  BattleEvent,
  createContagionSpreadEvent,
  createShredDecayedEvent,
  createCooldownTickedEvent,
} from '../../core/types';
import { BattleUnit } from '../../core/types/battle-unit';
import { findUnit, updateUnit, getTeamUnits } from '../../core/utils/state-helpers';
import { SeededRandom } from '../../core/utils/random';
import {
  createContagionProcessor,
  ContagionEffectType,
  UnitWithContagion,
  StatusEffect,
} from '../../core/mechanics/tier4/contagion';
import {
  createArmorShredProcessor,
  UnitWithArmorShred,
  DEFAULT_DECAY_PER_TURN,
} from '../../core/mechanics/tier4/armor-shred';
import { DEFAULT_CONTAGION_CONFIG, DEFAULT_SHRED_CONFIG } from '../../core/mechanics/config/defaults';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Amount of armor shred that decays per turn (from processor default) */
const SHRED_DECAY_AMOUNT = DEFAULT_DECAY_PER_TURN;

// =============================================================================
// CONTAGION EFFECT TYPES
// =============================================================================

/**
 * Status effects that can spread via contagion.
 * Re-exported from contagion processor for local use.
 */
type ContagionEffect = 'fire' | 'poison' | 'fear' | 'curse' | 'frost' | 'plague';

// =============================================================================
// MAIN PHASE HANDLER
// =============================================================================

/**
 * Handle turn_end phase for a unit.
 *
 * Executes the following in order:
 * 1. Spread contagion effects to adjacent allies
 * 2. Decay armor shred
 * 3. Tick ability cooldowns
 *
 * @param state - Current battle state (immutable)
 * @param unitId - Instance ID of unit ending their turn
 * @param rng - Seeded random number generator for determinism
 * @returns Updated state and events from this phase
 *
 * @invariant Original state is not mutated
 * @invariant Events are emitted for all state changes
 *
 * @example
 * const rng = new SeededRandom(12345);
 * const { state: newState, events } = handleTurnEnd(
 *   currentState,
 *   'player_knight_0',
 *   rng
 * );
 */
export function handleTurnEnd(
  state: BattleState,
  unitId: string,
  rng: SeededRandom,
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
    phase: 'turn_end' as Phase,
  };

  // ==========================================================================
  // STEP 1: Spread Contagion Effects
  // ==========================================================================
  const contagionResult = handleContagionSpread(
    currentState,
    unitId,
    rng,
    eventContext,
  );
  currentState = contagionResult.state;
  events.push(...contagionResult.events);

  // ==========================================================================
  // STEP 2: Decay Armor Shred
  // ==========================================================================
  const shredResult = handleArmorShredDecay(currentState, unitId, eventContext);
  currentState = shredResult.state;
  events.push(...shredResult.events);

  // ==========================================================================
  // STEP 3: Tick Ability Cooldowns
  // ==========================================================================
  const cooldownResult = handleCooldownTicks(currentState, unitId, eventContext);
  currentState = cooldownResult.state;
  events.push(...cooldownResult.events);

  return { state: currentState, events };
}


// =============================================================================
// CONTAGION SPREAD
// =============================================================================

// Create contagion processor with default config
const contagionProcessor = createContagionProcessor(DEFAULT_CONTAGION_CONFIG);

/**
 * Handle contagion spread at turn end.
 *
 * Contagion Mechanics:
 * - At turn_end, each status effect may spread to adjacent units
 * - Only spreads to units of the same team (friendly fire)
 * - Each effect has base spread chance
 * - Phalanx formation increases spread chance
 * - Effect spreads with reduced duration (original - 1, min 1)
 * - Same effect cannot stack, but refreshes duration
 *
 * Spread Chances (from config):
 * - Fire: 50% base
 * - Poison: 30% base
 * - Curse: 25% base
 * - Frost: 20% base
 * - Plague: 60% base
 * - Fear: 40% base
 * - Phalanx bonus: +15%
 *
 * @param state - Current battle state
 * @param unitId - Unit with potential contagion effects
 * @param rng - Seeded random number generator
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.2 for contagion specification
 */
function handleContagionSpread(
  state: BattleState,
  unitId: string,
  rng: SeededRandom,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  let currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  const unitWithContagion = unit as BattleUnit & UnitWithContagion;

  // Get status effects on this unit that can spread
  const spreadableEffects = contagionProcessor.getSpreadableEffects(unitWithContagion);
  if (spreadableEffects.length === 0) {
    return { state: currentState, events };
  }

  // Get adjacent allies (same team)
  const adjacentTargets = contagionProcessor.getAdjacentTargets(unitWithContagion, currentState);
  if (adjacentTargets.length === 0) {
    return { state: currentState, events };
  }

  // Try to spread each effect to each adjacent ally
  for (const effect of spreadableEffects) {
    for (const target of adjacentTargets) {
      // Calculate spread chance using processor
      const spreadChance = contagionProcessor.getSpreadChance(
        effect.type as ContagionEffectType,
        target.inPhalanx,
      );
      const roll = rng.next();

      // Attempt spread using processor
      const spreadResult = contagionProcessor.attemptSpread(
        unitWithContagion,
        target.unit,
        effect,
        roll,
        currentState,
      );

      if (spreadResult.success && spreadResult.spreadEffect) {
        // Apply the spread effect
        currentState = contagionProcessor.applySpreadEffect(
          target.unit,
          spreadResult.spreadEffect,
          currentState,
        );

        // Emit contagion spread event
        const spreadEvent = createContagionSpreadEvent(eventContext, {
          fromId: unitId,
          toId: target.unit.instanceId,
          effect: effect.type as 'fire' | 'poison' | 'fear',
          duration: spreadResult.spreadEffect.duration,
          spreadChance: Math.floor(spreadChance * 100),
          roll: Math.floor(roll * 100),
        });
        events.push(spreadEvent);
      }
    }
  }

  return { state: currentState, events };
}

/**
 * Get spreadable status effects from a unit.
 *
 * Delegates to the contagion processor for consistent behavior.
 *
 * @param unit - Unit to check for effects
 * @returns Array of spreadable status effects
 */
function getSpreadableEffects(unit: BattleUnit): StatusEffect[] {
  return contagionProcessor.getSpreadableEffects(unit as BattleUnit & UnitWithContagion);
}

/**
 * Get allies adjacent to a unit (orthogonally).
 *
 * @param state - Current battle state
 * @param unit - Unit to find adjacent allies for
 * @returns Array of adjacent alive allies
 */
function getAdjacentAllies(
  state: BattleState,
  unit: BattleUnit,
): readonly BattleUnit[] {
  const allies = getTeamUnits(state, unit.team).filter(
    (ally) => ally.instanceId !== unit.instanceId && ally.alive,
  );

  return allies.filter((ally) =>
    isOrthogonallyAdjacent(unit.position, ally.position),
  );
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
 * Get the spread chance for a contagion effect.
 *
 * Delegates to the contagion processor for consistent behavior.
 *
 * @param effectType - Type of effect
 * @param targetInPhalanx - Whether target is in phalanx formation
 * @returns Spread chance (0-1)
 */
function getSpreadChance(
  effectType: ContagionEffect,
  targetInPhalanx: boolean,
): number {
  return contagionProcessor.getSpreadChance(effectType as ContagionEffectType, targetInPhalanx);
}


// =============================================================================
// ARMOR SHRED DECAY
// =============================================================================

// Create armor shred processor with default config
const armorShredProcessor = createArmorShredProcessor(DEFAULT_SHRED_CONFIG);

/**
 * Handle armor shred decay at turn end.
 *
 * Armor Shred Decay Rules:
 * - At turn_end, shred decays by decayPerTurn points (default: 2)
 * - Minimum shred = 0
 * - Decay happens after contagion spread
 * - Undead units don't decay (permanent until death)
 *
 * @param state - Current battle state
 * @param unitId - Unit whose shred should decay
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @example
 * const result = handleArmorShredDecay(state, 'player_knight_0', eventContext);
 * // result.state has updated armorShred
 * // result.events contains shred_decayed event if decay occurred
 *
 * @see Requirements 2.2 for armor shred decay specification
 */
function handleArmorShredDecay(
  state: BattleState,
  unitId: string,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];

  const unit = findUnit(state, unitId);
  if (!unit || !unit.alive) {
    return { state, events };
  }

  // Use processor to handle decay
  const unitWithShred = unit as BattleUnit & UnitWithArmorShred;
  const decayResult = armorShredProcessor.processDecay(state, unitId);

  // If decay was skipped or no decay occurred, return unchanged
  if (decayResult.decay.decaySkipped || decayResult.decay.decayAmount === 0) {
    return { state, events };
  }

  // Emit shred decayed event
  const shredEvent = createShredDecayedEvent(eventContext, unitId, {
    unitId,
    decayAmount: decayResult.decay.decayAmount,
    remaining: decayResult.decay.remainingShred,
  });
  events.push(shredEvent);

  return { state: decayResult.state, events };
}


// =============================================================================
// COOLDOWN TICKS
// =============================================================================

/**
 * Ability cooldown tracking for a unit.
 * Maps ability ID to remaining cooldown turns.
 */
type AbilityCooldowns = Record<string, number>;

/**
 * Handle ability cooldown ticks at turn end.
 *
 * Cooldown Rules:
 * - At turn_end, all ability cooldowns tick down by 1
 * - Minimum cooldown = 0 (ability ready)
 * - Only active abilities have cooldowns
 *
 * @param state - Current battle state
 * @param unitId - Unit whose cooldowns should tick
 * @param eventContext - Event context for creating events
 * @returns Updated state and events
 *
 * @see Requirements 2.2 for cooldown tick specification
 */
function handleCooldownTicks(
  state: BattleState,
  unitId: string,
  eventContext: { round: number; turn: number; phase: Phase },
): PhaseResult {
  const events: BattleEvent[] = [];
  const currentState = state;

  const unit = findUnit(currentState, unitId);
  if (!unit || !unit.alive) {
    return { state: currentState, events };
  }

  // Note: Cooldowns are not currently tracked on BattleUnit
  // This is a placeholder for future implementation
  // In a full implementation, we would:
  // 1. Get unit's ability cooldowns from state
  // 2. Tick each cooldown down by 1
  // 3. Update state with new cooldowns
  // 4. Emit cooldown ticked event

  // For now, we check if unit has abilities and emit a placeholder event
  // when cooldown tracking is implemented
  if (unit.abilities.length === 0) {
    return { state: currentState, events };
  }

  // Placeholder: In a full implementation, this would track actual cooldowns
  // For now, we don't emit events since cooldowns aren't tracked yet
  // The event structure is ready for when cooldowns are implemented:
  //
  // const cooldownEvent = createCooldownTickedEvent(eventContext, unitId, {
  //   unitId,
  //   abilities: [
  //     { abilityId: 'shield_wall', previousCooldown: 2, newCooldown: 1 },
  //   ],
  // });
  // events.push(cooldownEvent);

  return { state: currentState, events };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  handleContagionSpread,
  handleArmorShredDecay,
  handleCooldownTicks,
  getSpreadChance,
  getAdjacentAllies,
  getSpreadableEffects,
  contagionProcessor,
  armorShredProcessor,
  SHRED_DECAY_AMOUNT,
};
