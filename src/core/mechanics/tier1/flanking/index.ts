/**
 * Tier 1: Flanking Module
 *
 * Exports for the flanking system which provides damage bonuses
 * and resolve damage based on attack angle relative to target's facing.
 *
 * @module core/mechanics/tier1/flanking
 */

export { createFlankingProcessor, default } from './flanking.processor';
export type {
  FlankingProcessor,
  FlankingResult,
  FlankingProcessorOptions,
  AttackArc,
} from './flanking.types';
export {
  FLANKING_DAMAGE_MODIFIERS,
  DEFAULT_FLANKING_RESOLVE_DAMAGE,
} from './flanking.types';
