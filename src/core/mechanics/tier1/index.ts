/**
 * Tier 1: Flanking, Resolve, Engagement
 *
 * Exports for Tier 1 mechanics which build on Tier 0 (Facing).
 *
 * @module core/mechanics/tier1
 */

// Flanking
export {
  createFlankingProcessor,
  FLANKING_DAMAGE_MODIFIERS,
  DEFAULT_FLANKING_RESOLVE_DAMAGE,
} from './flanking';
export type {
  FlankingProcessor,
  FlankingResult,
  FlankingProcessorOptions,
  AttackArc,
} from './flanking';

// Resolve
export {
  createResolveProcessor,
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  RESOLVE_DAMAGE_NEARBY_RANGE,
} from './resolve';
export type {
  ResolveProcessor,
  MechanicsResolveState,
  UnitWithResolve,
  ResolveFaction,
  ResolveDamageSource,
  ResolveRegenerateResult,
  ResolveDamageResult,
  ResolveStateCheckResult,
} from './resolve';

// Engagement (Zone of Control)
export { createEngagementProcessor, AOO_HIT_CHANCE, AOO_DAMAGE_MULTIPLIER } from './engagement';
export type {
  EngagementProcessor,
  EngagementStatus,
  UnitWithEngagement,
  ZoneOfControl,
  ZoCCheckResult,
  AoOTrigger,
  AoOResult,
} from './engagement';
