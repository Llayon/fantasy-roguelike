/**
 * Tier 2: Intercept Module
 *
 * Exports the intercept processor and related types.
 *
 * @module core/mechanics/tier2/intercept
 */

export { createInterceptProcessor } from './intercept.processor';
export type {
  InterceptProcessor,
  InterceptType,
  InterceptResult,
  UnitWithIntercept,
  InterceptOpportunity,
  InterceptBlockReason,
  InterceptCheckResult,
  InterceptExecutionResult,
  DisengageResult,
  DisengageFailReason,
} from './intercept.types';
export {
  HARD_INTERCEPT_DAMAGE_MULTIPLIER,
  DEFAULT_DISENGAGE_COST,
  HARD_INTERCEPT_TAG,
  CAVALRY_TAG,
} from './intercept.types';

