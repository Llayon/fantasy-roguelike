/**
 * Tier 1: Engagement (Zone of Control) Module
 *
 * Exports all engagement-related types and the processor factory.
 *
 * @module core/mechanics/tier1/engagement
 */

export * from './engagement.types';
export {
  createEngagementProcessor,
  AOO_HIT_CHANCE,
  AOO_DAMAGE_MULTIPLIER,
} from './engagement.processor';
