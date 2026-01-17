/**
 * Tier 3: Charge (Cavalry Momentum) - Public API
 *
 * @module core/mechanics/tier3/charge
 */

export { createChargeProcessor, default } from './charge.processor';
export type {
  ChargeProcessor,
  UnitWithCharge,
  ChargeEligibility,
  ChargeBlockReason,
  SpearWallCounterResult,
  ChargeExecutionResult,
} from './charge.types';
export {
  DEFAULT_MOMENTUM_PER_CELL,
  DEFAULT_MAX_MOMENTUM,
  DEFAULT_MIN_CHARGE_DISTANCE,
  DEFAULT_SHOCK_RESOLVE_DAMAGE,
  SPEAR_WALL_COUNTER_MULTIPLIER,
  SPEAR_WALL_TAG,
  CAVALRY_TAG,
  CHARGE_TAG,
} from './charge.types';
