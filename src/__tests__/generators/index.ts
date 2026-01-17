/**
 * Property-based test generators for the battle simulator.
 *
 * Exports all generators for use in property-based tests.
 * These generators create random valid instances of core types
 * for comprehensive property-based testing.
 *
 * @module __tests__/generators
 *
 * @example
 * import fc from 'fast-check';
 * import {
 *   arbitraryBattleUnit,
 *   arbitraryBattleState,
 *   arbitraryTeamSetup,
 * } from './generators';
 *
 * // Use in property tests
 * fc.assert(
 *   fc.property(arbitraryBattleUnit(), (unit) => {
 *     expect(unit.currentHp).toBeGreaterThanOrEqual(0);
 *     expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
 *   })
 * );
 */

// Unit generators
export {
  arbitraryFacingDirection,
  arbitraryPosition,
  arbitraryTeam,
  arbitraryFaction,
  arbitraryRole,
  arbitraryTags,
  arbitraryBattleUnitStats,
  arbitraryAmmo,
  arbitraryResolve,
  arbitraryCurrentHp,
  arbitraryArmorShred,
  arbitraryMomentum,
  arbitraryRiposteCharges,
  arbitraryEngagedBy,
  arbitraryBattleUnit,
  arbitraryBattleUnitWith,
  arbitraryDeadUnit,
  arbitraryRoutingUnit,
  arbitraryLowHpUnit,
  arbitraryNoAmmoUnit,
  arbitraryShredUnit,
  arbitraryChargingUnit,
  arbitraryPhalanxUnit,
  arbitraryCavalryUnit,
  arbitrarySpearmanUnit,
  arbitraryUndeadUnit,
} from './unit.generator';

// State generators
export {
  arbitraryPhase,
  arbitraryRound,
  arbitraryTurn,
  arbitrarySeed,
  arbitraryBattleEvent,
  arbitraryBattleEvents,
  arbitraryBattleState,
  arbitraryBattleStateWith,
  arbitraryPlayerVictoryState,
  arbitraryEnemyVictoryState,
  arbitraryLowHpState,
  arbitraryBattleStateAtPhase,
  arbitraryLateRoundState,
  arbitraryRoutingState,
  arbitraryEngagedState,
  arbitraryPhalanxState,
  arbitraryShredState,
} from './state.generator';

// Team generators
export {
  arbitraryPlayerPosition,
  arbitraryEnemyPosition,
  arbitraryUnitId,
  arbitraryUnitTier,
  arbitraryTeamSetupUnit,
  arbitraryTeamSetup,
  arbitraryPlayerTeamSetup,
  arbitraryEnemyTeamSetup,
  arbitraryTeamSetupWith,
  arbitrarySingleUnitTeam,
  arbitraryFullBudgetTeam,
  arbitraryTankTeam,
  arbitraryRangedTeam,
  arbitraryBalancedTeam,
  arbitraryHighTierTeam,
} from './team.generator';
