/**
 * Tier 2: Riposte Processor
 *
 * Implements the riposte (counter-attack) system which allows defenders
 * to counter-attack when hit from the front arc. Riposte is disabled
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

import type { BattleState } from '../../../types';
import type { BattleUnit } from '../../../types/battle-unit';
import type { RiposteConfig } from '../../config/mechanics.types';
import { updateUnit, findUnit } from '../../../utils/state-helpers';
import type {
  AttackArc,
  RiposteProcessor,
  UnitWithRiposte,
} from './riposte.types';
import {
  RIPOSTE_DAMAGE_MULTIPLIER as DAMAGE_MULTIPLIER,
  MIN_RIPOSTE_CHANCE as MIN_CHANCE,
  MAX_RIPOSTE_CHANCE as MAX_CHANCE,
} from './riposte.types';

/**
 * Creates a riposte processor instance.
 *
 * The riposte processor handles:
 * - Checking if defender can riposte (front arc, has charges)
 * - Calculating riposte chance based on Initiative comparison
 * - Executing riposte counter-attacks with reduced damage
 * - Resetting riposte charges at round start
 *
 * @param config - Riposte configuration with chance and charge settings
 * @returns RiposteProcessor instance
 *
 * @example
 * const processor = createRiposteProcessor({
 *   initiativeBased: true,
 *   chargesPerRound: 'attackCount',
 *   baseChance: 0.5,
 *   guaranteedThreshold: 10,
 * });
 *
 * // Check if defender can riposte
 * const canRiposte = processor.canRiposte(defender, attacker, 'front');
 *
 * // Calculate riposte chance
 * const chance = processor.getRiposteChance(defender, attacker, config);
 *
 * // Execute riposte
 * const newState = processor.executeRiposte(defender, attacker, state);
 */
export function createRiposteProcessor(config: RiposteConfig): RiposteProcessor {
  /**
   * Helper function to get maximum riposte charges for a unit.
   */
  function getMaxRiposteCharges(unit: BattleUnit & UnitWithRiposte): number {
    if (config.chargesPerRound === 'attackCount') {
      return unit.attackCount ?? unit.stats?.atkCount ?? 1;
    }
    return config.chargesPerRound;
  }

  return {
    /**
     * Checks if defender can riposte against the attacker.
     * Riposte is only allowed from front arc and requires charges.
     *
     * Conditions for riposte:
     * 1. Attack must be from front arc (not flank or rear)
     * 2. Defender must have riposte charges remaining
     * 3. Defender must be alive and not routing
     *
     * @param defender - Unit being attacked (potential riposte source)
     * @param attacker - Unit performing the attack
     * @param arc - Attack arc relative to defender's facing
     * @returns True if defender can riposte
     */
    canRiposte(
      defender: BattleUnit & UnitWithRiposte,
      _attacker: BattleUnit,
      arc: AttackArc,
    ): boolean {
      // Rule 1: Cannot riposte if attacked from flank or rear
      if (arc !== 'front') {
        return false;
      }

      // Rule 2: Defender must be alive to riposte
      if (!defender.alive || defender.currentHp <= 0) {
        return false;
      }

      // Rule 3: Defender must not be routing
      if (defender.isRouting) {
        return false;
      }

      // Rule 4: Check remaining riposte charges
      const maxCharges = getMaxRiposteCharges(defender);
      const currentCharges = defender.riposteCharges ?? maxCharges;

      return currentCharges > 0;
    },

    /**
     * Calculates riposte chance based on Initiative comparison.
     * Higher defender Initiative = higher riposte chance.
     *
     * ═══════════════════════════════════════════════════════════════
     * RIPOSTE CHANCE FORMULA (Initiative-Based)
     * ═══════════════════════════════════════════════════════════════
     *
     * Step 1: Calculate Initiative difference
     *   initDiff = defender.initiative - attacker.initiative
     *
     * Step 2: Determine chance based on initDiff
     *   - If initDiff >= guaranteedThreshold (default: 10):
     *       chance = 1.0 (100% - guaranteed riposte)
     *
     *   - If initDiff <= -guaranteedThreshold:
     *       chance = 0.0 (0% - impossible to riposte)
     *
     *   - Otherwise (linear interpolation):
     *       chance = baseChance + (initDiff / guaranteedThreshold) * 0.5
     *
     * @param defender - Unit being attacked
     * @param attacker - Unit performing the attack
     * @param _config - Riposte configuration (uses instance config)
     * @returns Riposte chance (0.0 to 1.0)
     */
    getRiposteChance(
      defender: BattleUnit & UnitWithRiposte,
      attacker: BattleUnit,
      _config?: RiposteConfig,
    ): number {
      // Non-Initiative Mode: Return flat base chance
      if (!config.initiativeBased) {
        return config.baseChance;
      }

      // Step 1: Get Initiative values (default to 0 if not set)
      const defenderInit = defender.initiative ?? defender.stats?.initiative ?? 0;
      const attackerWithRiposte = attacker as BattleUnit & UnitWithRiposte;
      const attackerInit = attackerWithRiposte.initiative ?? attacker.stats?.initiative ?? 0;

      // Step 2: Calculate Initiative difference
      const initDiff = defenderInit - attackerInit;

      // Step 3a: Check for guaranteed riposte (defender much faster)
      if (initDiff >= config.guaranteedThreshold) {
        return MAX_CHANCE;
      }

      // Step 3b: Check for impossible riposte (attacker much faster)
      if (initDiff <= -config.guaranteedThreshold) {
        return MIN_CHANCE;
      }

      // Step 3c: Linear interpolation for intermediate values
      const chance = config.baseChance + (initDiff / config.guaranteedThreshold) * 0.5;

      // Step 4: Clamp to valid range [0, 1]
      return Math.max(MIN_CHANCE, Math.min(MAX_CHANCE, chance));
    },

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
    ): BattleState {
      // Step 1: Calculate riposte damage (50% of normal attack)
      const defenderAtk = defender.stats?.atk ?? 0;
      const damage = Math.floor(defenderAtk * DAMAGE_MULTIPLIER);

      // Step 2: Apply damage to attacker
      const newAttackerHp = Math.max(0, attacker.currentHp - damage);
      const attackerAlive = newAttackerHp > 0;

      // Step 3: Consume one riposte charge from defender
      const maxCharges = getMaxRiposteCharges(defender);
      const currentCharges = defender.riposteCharges ?? maxCharges;
      const newCharges = Math.max(0, currentCharges - 1);

      // Step 4: Update state with both units modified
      let newState = updateUnit(state, attacker.instanceId, {
        currentHp: newAttackerHp,
        alive: attackerAlive,
      });

      newState = updateUnit(newState, defender.instanceId, {
        riposteCharges: newCharges,
      });

      return newState;
    },

    /**
     * Get the maximum riposte charges for a unit.
     *
     * @param unit - Unit to get max charges for
     * @returns Maximum riposte charges per round
     */
    getMaxCharges(unit: BattleUnit & UnitWithRiposte): number {
      return getMaxRiposteCharges(unit);
    },

    /**
     * Reset riposte charges for a unit at round start.
     *
     * @param state - Current battle state
     * @param unitId - Unit to reset charges for
     * @returns Updated battle state
     */
    resetCharges(state: BattleState, unitId: string): BattleState {
      const unit = findUnit(state, unitId);
      if (!unit) {
        return state;
      }

      const maxCharges = getMaxRiposteCharges(unit as BattleUnit & UnitWithRiposte);

      return updateUnit(state, unitId, {
        riposteCharges: maxCharges,
      });
    },
  };
}

/**
 * Default export for convenience.
 */
export default createRiposteProcessor;
