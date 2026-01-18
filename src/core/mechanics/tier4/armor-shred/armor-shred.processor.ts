/**
 * Tier 4: Armor Shred Processor
 *
 * Implements the armor shred system which handles the degradation of armor
 * through physical attacks and decay over time.
 *
 * Key mechanics:
 * - Each physical attack applies shred based on config
 * - Shred accumulates on target up to maxShredPercent of base armor
 * - At turn_end, shred decays by decayPerTurn points
 * - Undead units don't decay (permanent until death)
 * - Armored units have shred capped at 50% of armor
 * - Effective armor = max(0, baseArmor - armorShred)
 *
 * @module core/mechanics/tier4/armor-shred
 */

import type { BattleState, BattleUnit } from '../../../types';
import type { ShredConfig } from '../../config/mechanics.types';
import type {
  ArmorShredProcessor,
  UnitWithArmorShred,
  ShredApplicationResult,
  ShredDecayResult,
  ArmorShredDecayResult,
  ArmorShredAttackResult,
  EffectiveArmorResult,
} from './armor-shred.types';
import {
  DEFAULT_SHRED_PER_ATTACK,
  DEFAULT_MAX_SHRED_PERCENT,
  DEFAULT_DECAY_PER_TURN,
  SHRED_IMMUNE_TAG,
  ARMORED_TAG,
  ARMORED_SHRED_CAP_PERCENT,
} from './armor-shred.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the shred immunity tag.
 */
function hasImmunityTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(SHRED_IMMUNE_TAG) ?? false;
}

/**
 * Checks if a unit has the armored tag.
 */
function hasArmoredTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(ARMORED_TAG) ?? false;
}

/**
 * Checks if a unit is alive.
 */
function isUnitAlive(unit: BattleUnit): boolean {
  return unit.currentHp > 0 && unit.alive !== false;
}

/**
 * Gets the unit's unique identifier.
 */
function getUnitId(unit: BattleUnit): string {
  return unit.instanceId ?? unit.id;
}

/**
 * Gets the base armor for a unit.
 */
function getBaseArmor(unit: BattleUnit & UnitWithArmorShred): number {
  // Check for baseArmor property first, then fall back to stats.armor
  const unitWithShred = unit as UnitWithArmorShred;
  if (typeof unitWithShred.baseArmor === 'number') {
    return unitWithShred.baseArmor;
  }
  return unit.stats?.armor ?? 0;
}

/**
 * Gets the current armor shred on a unit.
 */
function getCurrentShred(unit: BattleUnit & UnitWithArmorShred): number {
  return unit.armorShred ?? 0;
}

/**
 * Updates units in state immutably.
 */
function updateUnits(state: BattleState, updatedUnits: BattleUnit[]): BattleState {
  const unitMap = new Map(updatedUnits.map((u) => [getUnitId(u), u]));
  return {
    ...state,
    units: state.units.map((u) => unitMap.get(getUnitId(u)) ?? u),
  };
}

/**
 * Finds a unit by ID in state.
 */
function findUnit(state: BattleState, unitId: string): BattleUnit | undefined {
  return state.units.find((u) => getUnitId(u) === unitId);
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an armor shred processor instance.
 *
 * The armor shred processor handles:
 * - Calculating effective armor after shred
 * - Applying shred from attacks
 * - Processing shred decay at turn end
 * - Checking immunity and armored status
 *
 * @param config - Shred configuration
 * @returns ArmorShredProcessor instance
 *
 * @example
 * const processor = createArmorShredProcessor({
 *   shredPerAttack: 1,
 *   maxShredPercent: 0.4,
 *   decayPerTurn: 2,
 * });
 *
 * // Get effective armor
 * const result = processor.getEffectiveArmor(unit);
 *
 * // Process decay at turn end
 * const decayResult = processor.processDecay(state, 'player_knight_0');
 */
export function createArmorShredProcessor(config: ShredConfig): ArmorShredProcessor {
  const shredPerAttack = config.shredPerAttack ?? DEFAULT_SHRED_PER_ATTACK;
  const maxShredPercent = config.maxShredPercent ?? DEFAULT_MAX_SHRED_PERCENT;
  const decayPerTurn = config.decayPerTurn ?? DEFAULT_DECAY_PER_TURN;

  return {
    /**
     * Calculates the effective armor for a unit after shred.
     */
    getEffectiveArmor(unit: BattleUnit & UnitWithArmorShred): EffectiveArmorResult {
      const baseArmor = getBaseArmor(unit);
      const currentShred = getCurrentShred(unit);
      const effectiveArmor = Math.max(0, baseArmor - currentShred);
      const reductionPercent = baseArmor > 0 ? currentShred / baseArmor : 0;

      return {
        baseArmor,
        currentShred,
        effectiveArmor,
        reductionPercent,
      };
    },

    /**
     * Calculates shred to apply from an attack.
     */
    calculateShredFromAttack(
      attacker: BattleUnit,
      target: BattleUnit & UnitWithArmorShred,
    ): ShredApplicationResult {
      const baseTarget = target as BattleUnit;

      // Check immunity
      if (hasImmunityTag(baseTarget) || (target as UnitWithArmorShred).shredImmune) {
        return {
          shredApplied: 0,
          newShred: getCurrentShred(target),
          wasCapped: false,
          maxShred: this.getMaxShred(target),
        };
      }

      const currentShred = getCurrentShred(target);
      const maxShred = this.getMaxShred(target);

      // Calculate shred to apply
      const potentialShred = currentShred + shredPerAttack;
      const newShred = Math.min(potentialShred, maxShred);
      const shredApplied = newShred - currentShred;
      const wasCapped = potentialShred > maxShred;

      return {
        shredApplied,
        newShred,
        wasCapped,
        maxShred,
      };
    },

    /**
     * Applies shred from an attack to a target.
     */
    applyShredFromAttack(
      state: BattleState,
      attackerId: string,
      targetId: string,
    ): ArmorShredAttackResult {
      const attacker = findUnit(state, attackerId);
      const target = findUnit(state, targetId);

      if (!attacker || !target) {
        return {
          attackerId,
          targetId,
          application: {
            shredApplied: 0,
            newShred: 0,
            wasCapped: false,
            maxShred: 0,
          },
          state,
        };
      }

      const targetWithShred = target as BattleUnit & UnitWithArmorShred;
      const application = this.calculateShredFromAttack(attacker, targetWithShred);

      if (application.shredApplied === 0) {
        return {
          attackerId,
          targetId,
          application,
          state,
        };
      }

      // Update target with new shred
      const updatedTarget = {
        ...target,
        armorShred: application.newShred,
      };

      return {
        attackerId,
        targetId,
        application,
        state: updateUnits(state, [updatedTarget]),
      };
    },

    /**
     * Calculates shred decay for a unit at turn end.
     */
    calculateDecay(unit: BattleUnit & UnitWithArmorShred): ShredDecayResult {
      const baseUnit = unit as BattleUnit;

      // Check if unit is dead
      if (!isUnitAlive(baseUnit)) {
        return {
          decayAmount: 0,
          remainingShred: getCurrentShred(unit),
          decaySkipped: true,
          skipReason: 'unit_dead',
        };
      }

      // Check if decay is disabled in config
      if (decayPerTurn <= 0) {
        return {
          decayAmount: 0,
          remainingShred: getCurrentShred(unit),
          decaySkipped: true,
          skipReason: 'decay_disabled',
        };
      }

      // Undead units don't decay
      if (baseUnit.faction === 'undead') {
        return {
          decayAmount: 0,
          remainingShred: getCurrentShred(unit),
          decaySkipped: true,
          skipReason: 'undead',
        };
      }

      const currentShred = getCurrentShred(unit);

      // No shred to decay
      if (currentShred <= 0) {
        return {
          decayAmount: 0,
          remainingShred: 0,
          decaySkipped: true,
          skipReason: 'no_shred',
        };
      }

      // Calculate decay
      const decayAmount = Math.min(decayPerTurn, currentShred);
      const remainingShred = currentShred - decayAmount;

      return {
        decayAmount,
        remainingShred,
        decaySkipped: false,
      };
    },

    /**
     * Processes shred decay for a unit at turn end.
     */
    processDecay(state: BattleState, unitId: string): ArmorShredDecayResult {
      const unit = findUnit(state, unitId);

      if (!unit) {
        return {
          unitId,
          decay: {
            decayAmount: 0,
            remainingShred: 0,
            decaySkipped: true,
            skipReason: 'unit_dead',
          },
          state,
        };
      }

      const unitWithShred = unit as BattleUnit & UnitWithArmorShred;
      const decay = this.calculateDecay(unitWithShred);

      if (decay.decaySkipped || decay.decayAmount === 0) {
        return {
          unitId,
          decay,
          state,
        };
      }

      // Update unit with decayed shred
      const updatedUnit = {
        ...unit,
        armorShred: decay.remainingShred,
      };

      return {
        unitId,
        decay,
        state: updateUnits(state, [updatedUnit]),
      };
    },

    /**
     * Checks if a unit is immune to armor shred.
     */
    isImmune(unit: BattleUnit & UnitWithArmorShred): boolean {
      const baseUnit = unit as BattleUnit;
      return hasImmunityTag(baseUnit) || (unit as UnitWithArmorShred).shredImmune === true;
    },

    /**
     * Checks if a unit has the armored tag (reduced shred cap).
     */
    isArmored(unit: BattleUnit): boolean {
      return hasArmoredTag(unit);
    },

    /**
     * Gets the maximum shred allowed for a unit.
     */
    getMaxShred(unit: BattleUnit & UnitWithArmorShred): number {
      const baseArmor = getBaseArmor(unit);

      // Armored units have shred capped at 50% of armor
      if (this.isArmored(unit as BattleUnit)) {
        return Math.floor(baseArmor * ARMORED_SHRED_CAP_PERCENT);
      }

      // Normal units have shred capped at maxShredPercent of armor
      return Math.floor(baseArmor * maxShredPercent);
    },

    /**
     * Checks if shred decay is enabled for a unit.
     */
    canDecay(unit: BattleUnit & UnitWithArmorShred): boolean {
      const baseUnit = unit as BattleUnit;

      // Decay disabled in config
      if (decayPerTurn <= 0) {
        return false;
      }

      // Undead don't decay
      if (baseUnit.faction === 'undead') {
        return false;
      }

      return true;
    },
  };
}

export default createArmorShredProcessor;
