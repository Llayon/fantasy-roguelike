/**
 * AI decision making for battle simulation.
 *
 * Provides deterministic AI decisions based on:
 * - Unit role (Tank, DPS, Support, etc.)
 * - Target selection strategies
 * - Action selection (attack, move, ability)
 * - Routing behavior (retreat toward deployment edge)
 *
 * @module simulator/ai
 */

export {
  decideAction,
  AIDecisionInput,
  AIDecisionOutput,
  buildDecisionContext,
  selectLowestHpUnit,
  selectNearestUnit,
  selectHighestThreatUnit,
  selectLowestArmorUnit,
  calculateMoveTowardTarget,
  decideRoutingAction,
  createAbilityAction,
  HP_THRESHOLDS,
  GRID_CONFIG,
} from './decision';
