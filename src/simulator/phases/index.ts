/**
 * Phase handlers for battle simulation.
 *
 * Phase order: turn_start → movement → pre_attack → attack → post_attack → turn_end
 *
 * @module simulator/phases
 */

// Turn start phase
export * from './turn-start';

// Movement phase - export specific items to avoid conflicts
export {
  handleMovement,
  calculatePath,
  checkHardIntercept,
  checkSoftIntercept,
  executeMovement,
  updateEngagementStatus,
  calculateChargeMomentum,
  isFacingPosition,
  hasChargeCapability,
  getRoutingTargetPosition,
  MAX_MOMENTUM,
  SPEAR_WALL_COUNTER_MULTIPLIER,
  chargeProcessor as movementChargeProcessor,
} from './movement';

// Attack phase - export specific items to avoid conflicts
export {
  handleAttack,
  handleFacingRotation,
  calculateFacingDirection,
  calculateFlankingArc,
  getAttackArc,
  getFlankingModifier,
  calculateAttackDamage,
  handleDodgeRoll,
  applyAttackDamage,
  handleRiposte,
  canRiposte,
  calculateRiposteChance,
  handleAmmoConsumption,
  handleUnitDeath,
  applyAllyDeathResolveDamage,
  applyFlankingResolveDamage,
  checkSpearWallCounter,
  BASE_RIPOSTE_CHANCE,
  MAX_RIPOSTE_CHANCE,
  INITIATIVE_RIPOSTE_BONUS,
  riposteProcessor,
  ammunitionProcessor,
  chargeProcessor as attackChargeProcessor,
  FLANKING_DAMAGE_MODIFIERS,
  DEFAULT_FLANKING_RESOLVE_DAMAGE,
  RIPOSTE_DAMAGE_MULTIPLIER,
} from './attack';

// Turn end phase
export * from './turn-end';
