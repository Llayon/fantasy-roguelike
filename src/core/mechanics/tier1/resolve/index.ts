/**
 * Tier 1: Resolve (Morale) - Public API
 *
 * @module core/mechanics/tier1/resolve
 */

export { createResolveProcessor, default } from './resolve.processor';
export {
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  RESOLVE_DAMAGE_NEARBY_RANGE,
} from './resolve.processor';
export type {
  ResolveProcessor,
  MechanicsResolveState,
  UnitWithResolve,
  ResolveFaction,
  ResolveDamageSource,
  ResolveRegenerateResult,
  ResolveDamageResult,
  ResolveStateCheckResult,
} from './resolve.types';
