/**
 * Core utilities module barrel export.
 * @module core/utils
 */

export { seededRandom, SeededRandom } from './random';

export {
  findUnit,
  findUnitOrThrow,
  updateUnit,
  updateUnits,
  updateOccupiedPositions,
  removeFromTurnQueue,
  getAliveUnits,
  getTeamUnits,
  isPositionOccupied,
  getUnitAtPositionFromState,
} from './state-helpers';

export type { UnitUpdate, BatchUnitUpdate } from './state-helpers';

// Logger exports
export {
  LogLevel,
  BattleLogger,
  createLogger,
  createProductionLogger,
  createDevelopmentLogger,
  createSilentLogger,
  PRODUCTION_CONFIG,
  DEVELOPMENT_CONFIG,
} from './logger';

export type { BattleContext, LogEntry, LoggerConfig } from './logger';

// Error exports
export {
  BattleErrorCode,
  BattleError,
  ValidationError,
  MechanicError,
  SimulatorError,
  ErrorBoundary,
  ErrorLogger,
  invalidUnitError,
  invalidPositionError,
  invalidTargetError,
  mechanicError,
  deadUnitActionError,
  maxRoundsExceededError,
  isBattleError,
  isRecoverableError,
  createErrorLogger,
} from './errors';

export type { RecoveryStrategy, RecoveryResult, RecoveryOptions } from './errors';
