/**
 * Tier 3: Charge Processor
 *
 * Implements the charge (cavalry momentum) system which provides damage bonuses
 * based on distance moved before attacking. Charge is primarily used by cavalry
 * units and can be countered by spearmen with Spear Wall.
 *
 * Key mechanics:
 * - Momentum builds based on distance moved (cells traveled)
 * - Momentum provides damage bonus on attack
 * - Charge impact deals additional resolve damage (shock)
 * - Spear Wall units can counter and stop charges
 * - Minimum distance required to qualify for charge bonus
 *
 * @module core/mechanics/tier3/charge
 */

import type { BattleUnit, Position } from '../../../types';
import type { ChargeConfig } from '../../config/mechanics.types';
import type { ChargeProcessor, UnitWithCharge, ChargeEligibility } from './charge.types';
import {
  SPEAR_WALL_TAG,
  CAVALRY_TAG,
  CHARGE_TAG,
  SPEAR_WALL_COUNTER_MULTIPLIER,
} from './charge.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the charge capability.
 */
function hasChargeCapability(unit: BattleUnit & UnitWithCharge): boolean {
  if (unit.canCharge !== undefined) {
    return unit.canCharge;
  }
  const tags = unit.tags ?? [];
  return tags.includes(CAVALRY_TAG) || tags.includes(CHARGE_TAG);
}

/**
 * Checks if a unit has Spear Wall capability (can counter charges).
 */
function hasSpearWall(unit: BattleUnit & UnitWithCharge): boolean {
  if (unit.hasSpearWall !== undefined) {
    return unit.hasSpearWall;
  }
  return unit.tags?.includes(SPEAR_WALL_TAG) ?? false;
}

/**
 * Gets the attack value for a unit.
 */
function getUnitAtk(unit: BattleUnit & UnitWithCharge): number {
  return unit.atk ?? unit.stats?.atk ?? 0;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a charge processor instance.
 *
 * @param config - Charge configuration with momentum and shock settings
 * @returns ChargeProcessor instance
 *
 * @example
 * const processor = createChargeProcessor({
 *   momentumPerCell: 0.2,
 *   maxMomentum: 1.0,
 *   shockResolveDamage: 10,
 *   minChargeDistance: 3,
 * });
 */
export function createChargeProcessor(config: ChargeConfig): ChargeProcessor {
  return {
    /**
     * Calculates momentum based on distance moved.
     * Momentum is capped at config.maxMomentum.
     *
     * Formula:
     * - If distance < minChargeDistance: momentum = 0
     * - Otherwise: momentum = min(maxMomentum, distance * momentumPerCell)
     *
     * @param distance - Number of cells moved
     * @param chargeConfig - Charge configuration
     * @returns Calculated momentum value (0.0 to maxMomentum)
     */
    calculateMomentum(distance: number, chargeConfig: ChargeConfig): number {
      if (distance < chargeConfig.minChargeDistance) {
        return 0;
      }
      const rawMomentum = distance * chargeConfig.momentumPerCell;
      return Math.min(chargeConfig.maxMomentum, rawMomentum);
    },

    /**
     * Applies charge damage bonus based on momentum.
     *
     * Formula: totalDamage = floor(baseDamage * (1 + momentum))
     *
     * @param baseDamage - Original damage before bonus
     * @param momentum - Momentum value (0.0 to maxMomentum)
     * @returns Total damage after charge bonus
     */
    applyChargeBonus(baseDamage: number, momentum: number): number {
      return Math.floor(baseDamage * (1 + momentum));
    },

    /**
     * Gets the charge bonus multiplier for a given momentum.
     * Returns the multiplier (e.g., 0.6 for 60% bonus).
     *
     * @param momentum - Momentum value (0.0 to maxMomentum)
     * @returns Bonus multiplier (same as momentum value)
     */
    getChargeBonus(momentum: number): number {
      return momentum;
    },

    /**
     * Checks if target has Spear Wall ability to counter charges.
     *
     * @param target - Unit being charged
     * @returns True if target can counter the charge
     */
    isCounteredBySpearWall(target: BattleUnit & UnitWithCharge): boolean {
      return hasSpearWall(target);
    },

    /**
     * Calculates Spear Wall counter damage.
     *
     * Formula: counterDamage = floor(spearman.atk * SPEAR_WALL_COUNTER_MULTIPLIER)
     *
     * @param spearman - Unit with Spear Wall performing counter
     * @returns Counter damage to be dealt to charger
     */
    calculateCounterDamage(spearman: BattleUnit & UnitWithCharge): number {
      const spearmanAtk = getUnitAtk(spearman);
      return Math.floor(spearmanAtk * SPEAR_WALL_COUNTER_MULTIPLIER);
    },

    /**
     * Checks if a unit can perform a charge attack.
     *
     * @param unit - Unit attempting to charge
     * @param distance - Distance moved this turn
     * @param chargeConfig - Charge configuration
     * @returns Charge eligibility result
     */
    canCharge(
      unit: BattleUnit & UnitWithCharge,
      distance: number,
      chargeConfig: ChargeConfig,
    ): ChargeEligibility {
      if (!hasChargeCapability(unit)) {
        return {
          canCharge: false,
          reason: 'no_charge_ability',
          distance,
          momentum: 0,
        };
      }

      if (unit.chargeCountered) {
        return {
          canCharge: false,
          reason: 'countered',
          distance,
          momentum: 0,
        };
      }

      if (distance < chargeConfig.minChargeDistance) {
        return {
          canCharge: false,
          reason: 'insufficient_distance',
          distance,
          momentum: 0,
        };
      }

      const momentum = this.calculateMomentum(distance, chargeConfig);

      return {
        canCharge: true,
        distance,
        momentum,
      };
    },

    /**
     * Resets a unit's momentum and charge state.
     *
     * @param unit - Unit to reset
     * @returns Updated unit with reset charge state
     */
    resetCharge(unit: BattleUnit & UnitWithCharge): BattleUnit & UnitWithCharge {
      const { chargeStartPosition: _chargeStartPosition, ...rest } = unit;
      return {
        ...rest,
        momentum: 0,
        isCharging: false,
        chargeDistance: 0,
        chargeCountered: false,
      } as BattleUnit & UnitWithCharge;
    },

    /**
     * Tracks movement distance for momentum calculation.
     *
     * @param unit - Unit that moved
     * @param path - Movement path (array of positions)
     * @param chargeConfig - Charge configuration
     * @returns Updated unit with tracked distance and momentum
     */
    trackMovement(
      unit: BattleUnit & UnitWithCharge,
      path: Position[],
      chargeConfig: ChargeConfig,
    ): BattleUnit & UnitWithCharge {
      const distance = path.length > 0 ? path.length - 1 : 0;
      const momentum = this.calculateMomentum(distance, chargeConfig);
      const isCharging = momentum > 0 && hasChargeCapability(unit);
      const firstPosition = path[0];
      const startPosition = firstPosition !== undefined ? firstPosition : unit.position;

      return {
        ...unit,
        chargeDistance: distance,
        momentum,
        isCharging,
        chargeStartPosition: startPosition,
      };
    },
  };
}

export default createChargeProcessor;
