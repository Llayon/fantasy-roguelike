/**
 * Tier 0: Facing - Public API
 *
 * Exports the facing processor and related types for directional combat.
 *
 * @module core/mechanics/tier0/facing
 */

export { createFacingProcessor, default } from './facing.processor';
export type {
  FacingProcessor,
  FacingDirection,
  AttackArc,
  FacingContext,
  FacingResult,
} from './facing.types';
