/**
 * Tier 0 Mechanics - Public API
 *
 * Tier 0 contains foundational mechanics that other tiers depend on.
 * Currently includes:
 * - Facing: Directional combat system
 *
 * @module core/mechanics/tier0
 */

export { createFacingProcessor, default as FacingProcessor } from './facing';

export type {
  FacingProcessor as FacingProcessorType,
  FacingDirection,
  AttackArc,
  FacingContext,
  FacingResult,
} from './facing';
