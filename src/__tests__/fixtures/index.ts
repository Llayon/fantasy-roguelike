/**
 * Test fixtures and helpers for the simulator test suite.
 *
 * Exports all fixture factories and helper functions for creating test data.
 *
 * @module __tests__/fixtures
 *
 * @example
 * import {
 *   createTestUnit,
 *   createPlayerTeam,
 *   createTestBattleState,
 *   setupBattleScenario,
 *   assertUnitAlive,
 * } from './fixtures';
 *
 * // Create test data
 * const unit = createTestUnit();
 * const team = createPlayerTeam();
 * const state = createTestBattleState();
 *
 * // Setup scenarios
 * const { state, playerUnits, enemyUnits } = setupBattleScenario();
 *
 * // Make assertions
 * assertUnitAlive(unit);
 */

// =============================================================================
// UNIT FIXTURES
// =============================================================================

export {
  createTestUnit,
  createPlayerKnight,
  createEnemyKnight,
  createPlayerArcher,
  createEnemyArcher,
  createPlayerRogue,
  createEnemyRogue,
  createPlayerMage,
  createEnemyMage,
  createCavalryUnit,
  createSpearmanUnit,
  createUndeadUnit,
  createDeadUnit,
  createRoutingUnit,
  createEngagedUnit,
  createPhalanxUnit,
  createShredUnit,
  createLowAmmoUnit,
} from './units';

// =============================================================================
// TEAM FIXTURES
// =============================================================================

export {
  createPlayerTeam,
  createEnemyTeam,
  createBalancedTeam,
  createTankTeam,
  createRangedTeam,
  createMeleeTeam,
  createSingleUnitTeam,
  createTeamWithUnits,
  createPlayerUnitsFromTeam,
  createEnemyUnitsFromTeam,
  createBothTeams,
  getTeamCost,
  getTeamUnitCount,
  isValidTeamSetup,
} from './teams';

// =============================================================================
// STATE FIXTURES
// =============================================================================

export {
  createTestBattleState,
  createSimpleBattleState,
  createBalancedBattleState,
  createBattleStateWithTeams,
  createStateAtPhase,
  createTurnStartState,
  createMovementState,
  createAttackState,
  createTurnEndState,
  createStateAtRoundTurn,
  createLateRoundState,
  createStateWithTurnIndex,
  createLastTurnState,
  createStateWithEvents,
  createPlayerVictoryState,
  createEnemyVictoryState,
  createSingleSurvivorState,
  createLowHpState,
  createFullHpState,
  isValidBattleState,
  getCurrentUnit,
  getAliveUnits,
  getDeadUnits,
  getTeamUnits,
} from './states';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export {
  setupBattleScenario,
  setupDuelScenario,
  setupPositionScenario,
  setupEngagementScenario,
  damageUnit,
  healUnit,
  moveUnit,
  applyArmorShred,
  consumeAmmo,
  applyResolveDamage,
  regenerateResolve,
  updateUnitInState,
  advanceToNextTurn,
  advanceToPhase,
  assertUnitAlive,
  assertUnitDead,
  assertUnitHp,
  assertUnitMinHp,
  assertUnitPosition,
  assertValidBattleState,
  assertTeamUnitCount,
  assertUnitResolve,
  assertUnitRouting,
  assertUnitNotRouting,
} from './helpers';
