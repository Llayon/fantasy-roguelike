/**
 * Battle Simulator - Main simulation loop (<500 lines).
 *
 * This module provides:
 * - simulateBattle(): Main battle simulation function
 * - executeTurn(): Single turn execution
 * - Phase handlers: turn_start, movement, attack, turn_end
 * - AI decision making
 *
 * @module simulator
 */

// Main simulator exports
export { simulateBattle, initializeBattle, checkBattleEnd, createBattleUnit } from './simulator';

// Turn execution exports
export {
  executeTurn,
  handleTurnStart,
  handleMovement,
  handleAttackSequence,
  handleTurnEnd,
  handleUnitDeath,
  calculateFacing,
  calculateDamage,
} from './turn';

// Death handling exports
export {
  handleUnitDeath as handleDeath,
  markUnitAsDead,
  removeDeadUnitFromTurnQueue,
  applyAllyDeathResolveDamage,
  recalculatePhalanxOnDeath,
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  RESOLVE_DAMAGE_NEARBY_RANGE,
  PHALANX_MIN_ALLIES,
} from './death';

// Phase handlers will be exported here
// export * from './phases';

// AI decision making will be exported here
// export * from './ai';
