/**
 * Tier 3: Line of Sight (LoS) Module
 *
 * Exports the LoS processor and related types for ranged attack
 * line of sight calculations.
 *
 * @module core/mechanics/tier3/los
 */

export { createLoSProcessor, default } from './los.processor';
export type {
  LoSProcessor,
  UnitWithLoS,
  FireType,
  LoSBlockStatus,
  LoSCheckResult,
  LoSPathResult,
  LoSPathCell,
  LoSProcessorOptions,
  LoSBlockReason,
} from './los.types';
export {
  DEFAULT_ARC_FIRE_PENALTY,
  PARTIAL_COVER_HIT_CHANCE,
  COVER_DODGE_BONUS,
  ARC_FIRE_TAG,
  SIEGE_TAG,
  IGNORE_LOS_TAG,
  ARC_FIRE_MIN_RANGE,
} from './los.types';
