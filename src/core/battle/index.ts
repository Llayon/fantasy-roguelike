/**
 * Core battle module barrel export.
 * @module core/battle
 */

// Damage calculations
export {
  DEFAULT_BATTLE_CONFIG,
  calculatePhysicalDamage,
  calculateMagicDamage,
  rollDodge,
  applyDamage,
  applyHealing,
  resolvePhysicalAttack,
  resolveMagicAttack,
  calculateArmorReduction,
  canSurviveDamage,
  calculateLethalDamage,
  getEffectiveArmor,
} from './damage';

export type { DamageUnit, PhysicalDamageOptions, ResolvePhysicalAttackOptions } from './damage';

// Turn order
export {
  buildTurnQueue,
  getNextUnit,
  removeDeadUnits,
  removeInactiveUnits,
  hasLivingUnits,
  hasActiveUnits,
  getLivingUnitsByTeam,
  countLivingUnitsByTeam,
  findUnitById,
  getTurnOrderPreview,
  validateTurnQueue,
  isTurnQueueSorted,
  advanceToNextTurn,
  shouldStartNewRound,
  canUnitAct,
  ResolveState,
  VigilanceState,
} from './turn-order';

export type { TurnOrderUnit } from './turn-order';

// Targeting
export {
  findNearestEnemy,
  findWeakestEnemy,
  findTauntTarget,
  calculateThreatLevel,
  findHighestThreatEnemy,
  selectTarget,
  selectTargetWithDetails,
  canTarget,
  getEnemiesInRange,
  findAttackPositions,
  recommendTargetingStrategy,
} from './targeting';

export type { TargetingUnit, TargetStrategy, TargetSelectionResult } from './targeting';
