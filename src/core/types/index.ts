/**
 * Core type definitions
 * @module core/types
 */

// Grid types
export * from './grid.types';

// Config types
export * from './config.types';

// Config validators
export * from './config.validators';

// Battle unit types (Core 2.0)
export * from './battle-unit';

// Battle event types (Core 2.0) - must come before battle-state
export * from './events';

// Battle state types (Core 2.0) - re-exports Phase from events
export {
  PHASE_ORDER,
  BattleActionType,
  BattleAction,
  PhaseContext,
  BattleState,
  BattleResult,
  PhaseResult,
  TeamSetup,
  TeamSetupUnit,
  FinalUnitState,
} from './battle-state';
