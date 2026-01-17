/**
 * Tier 2: Riposte (Counter-attack) - Type Definitions
 *
 * Defines types for the riposte system which allows defenders to
 * counter-attack when hit from the front arc. Riposte is disabled
 * when attacked from flank or rear.
 *
 * Riposte requires the flanking mechanic (Tier 1) to be enabled,
 * which in turn requires facing (Tier 0).
 *
 * Key mechanics:
 * - Only front attacks allow riposte (flank/rear disable it)
 * - Riposte chance is based on Initiative comparison
 * - Units have limited riposte charges per round
 * - Riposte deals reduced damage (50% of normal)
 *
 * @module core/mechanics/tier2/riposte
 */

import type { BattleState, BattleEvent } from '../../../types';
import type { BattleUnit } from '../../../types/battle-unit';
import type { AttackArc } from '../../tier0/facing/facing.types';
import type { RiposteConfig } from '../../config/mechanics.types';

// Re-export AttackArc for convenience
export type { AttackArc } from '../../tier0/facing/facing.types';

// ═══════════════════════════════════════════════════════════════
// RIPOSTE CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Damage multiplier for riposte attacks.
 * Riposte deals reduced damage compared to normal attacks.
 *
 * @example
 * const riposteDamage = Math.floor(defender.atk * RIPOSTE_DAMAGE_MULTIPLIER);
 */
export const RIPOSTE_DAMAGE_MULTIPLIER = 0.5;

/**
 * Minimum riposte chance (0% when attacker has much higher Initiative).
 */
export const MIN_RIPOSTE_CHANCE = 0.0;

/**
 * Maximum riposte chance (100% when defender has much higher Initiative).
 */
export const MAX_RIPOSTE_CHANCE = 1.0;

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the riposte system.
 * These properties are added to BattleUnit when riposte mechanic is enabled.
 */
export interface UnitWithRiposte {
  /** Current riposte charges remaining this round */
  riposteCharges?: number;
  /** Maximum riposte charges per round */
  maxRiposteCharges?: number;
  /** Whether unit is capable of riposting */
  canRiposte?: boolean;
  /** Unit's Initiative stat for riposte chance calculation */
  initiative?: number;
  /** Unit's attack count (used when chargesPerRound = 'attackCount') */
  attackCount?: number;
  /** The round number when riposte charges were last reset */
  lastChargeResetRound?: number;
}

// ═══════════════════════════════════════════════════════════════
// RIPOSTE RESULT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of a riposte eligibility check.
 */
export interface RiposteEligibility {
  canRiposte: boolean;
  reason?: RiposteBlockReason;
  arc: AttackArc;
  chargesRemaining?: number;
}

/**
 * Reasons why a riposte might be blocked.
 */
export type RiposteBlockReason =
  | 'flanked'
  | 'rear'
  | 'no_charges'
  | 'disabled'
  | 'dead'
  | 'stunned'
  | 'routing';

/**
 * Result of a riposte chance calculation.
 */
export interface RiposteChanceResult {
  chance: number;
  defenderInitiative: number;
  attackerInitiative: number;
  initiativeDiff: number;
  isGuaranteed: boolean;
  isImpossible: boolean;
}

/**
 * Result of executing a riposte.
 */
export interface RiposteExecutionResult {
  success: boolean;
  damage: number;
  attackerNewHp: number;
  defenderChargesRemaining: number;
  state: BattleState;
}

// ═══════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Riposte triggered event for battle log.
 */
export interface RiposteTriggeredEvent {
  type: 'riposte_triggered';
  defenderId: string;
  attackerId: string;
  damage: number;
  riposteChance: number;
  roll: number;
}

/**
 * Riposte failed event for battle log.
 */
export interface RiposteFailedEvent {
  type: 'riposte_failed';
  defenderId: string;
  attackerId: string;
  riposteChance: number;
  roll: number;
}

/**
 * Riposte blocked event for battle log.
 */
export interface RiposteBlockedEvent {
  type: 'riposte_blocked';
  defenderId: string;
  attackerId: string;
  reason: RiposteBlockReason;
  arc?: AttackArc;
}

/**
 * Riposte charges reset event for battle log.
 */
export interface RiposteChargesResetEvent {
  type: 'riposte_charges_reset';
  unitId: string;
  charges: number;
}

/**
 * Union type for all riposte-related events.
 */
export type RiposteEvent =
  | RiposteTriggeredEvent
  | RiposteFailedEvent
  | RiposteBlockedEvent
  | RiposteChargesResetEvent;

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Riposte processor interface.
 * Handles all riposte-related mechanics including eligibility checks,
 * chance calculation, and counter-attack execution.
 *
 * Requires: flanking (Tier 1) - uses AttackArc to determine if riposte is allowed
 */
export interface RiposteProcessor {
  /**
   * Checks if defender can riposte against the attacker.
   * Riposte is only allowed from front arc and requires charges.
   *
   * @param defender - Unit being attacked (potential riposte source)
   * @param attacker - Unit performing the attack
   * @param arc - Attack arc relative to defender's facing
   * @returns True if defender can riposte
   */
  canRiposte(
    defender: BattleUnit & UnitWithRiposte,
    attacker: BattleUnit,
    arc: AttackArc,
  ): boolean;

  /**
   * Calculates riposte chance based on Initiative comparison.
   * Higher defender Initiative = higher riposte chance.
   *
   * @param defender - Unit being attacked
   * @param attacker - Unit performing the attack
   * @param config - Riposte configuration
   * @returns Riposte chance (0.0 to 1.0)
   */
  getRiposteChance(
    defender: BattleUnit & UnitWithRiposte,
    attacker: BattleUnit,
    config?: RiposteConfig,
  ): number;

  /**
   * Executes a riposte counter-attack.
   * Deals 50% of defender's normal damage to attacker.
   * Consumes one riposte charge.
   *
   * @param defender - Unit performing the riposte
   * @param attacker - Unit receiving riposte damage
   * @param state - Current battle state
   * @returns Updated battle state with damage applied
   */
  executeRiposte(
    defender: BattleUnit & UnitWithRiposte,
    attacker: BattleUnit,
    state: BattleState,
  ): BattleState;

  /**
   * Get the maximum riposte charges for a unit.
   *
   * @param unit - Unit to get max charges for
   * @returns Maximum riposte charges per round
   */
  getMaxCharges(unit: BattleUnit & UnitWithRiposte): number;

  /**
   * Reset riposte charges for a unit at round start.
   *
   * @param state - Current battle state
   * @param unitId - Unit to reset charges for
   * @returns Updated battle state
   */
  resetCharges(state: BattleState, unitId: string): BattleState;
}

// ═══════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Options for creating a riposte processor with custom settings.
 */
export interface RiposteProcessorOptions {
  damageMultiplier?: number;
}

/**
 * Context for riposte calculation.
 */
export interface RiposteContext {
  defender: BattleUnit & UnitWithRiposte;
  attacker: BattleUnit;
  arc: AttackArc;
  config: RiposteConfig;
  seed: number;
}

/**
 * Full riposte check result with all details.
 */
export interface RiposteCheckResult {
  eligibility: RiposteEligibility;
  chanceResult?: RiposteChanceResult;
  roll?: number;
  triggered: boolean;
  executionResult?: RiposteExecutionResult;
  event: RiposteEvent;
}
