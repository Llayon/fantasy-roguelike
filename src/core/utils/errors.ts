/**
 * Custom error types for the battle simulator.
 * Provides structured errors with battle context for debugging.
 *
 * @module core/utils/errors
 */

import type { BattleContext } from './logger';

/**
 * Error codes for categorizing battle errors.
 */
export enum BattleErrorCode {
  // General errors (1xx)
  UNKNOWN = 100,
  INVALID_STATE = 101,
  TIMEOUT = 102,

  // Validation errors (2xx)
  INVALID_UNIT = 200,
  INVALID_POSITION = 201,
  INVALID_TARGET = 202,
  INVALID_ABILITY = 203,
  INVALID_TEAM = 204,
  BUDGET_EXCEEDED = 205,

  // Mechanic errors (3xx)
  MECHANIC_FAILED = 300,
  FACING_ERROR = 301,
  RIPOSTE_ERROR = 302,
  AMMUNITION_ERROR = 303,
  RESOLVE_ERROR = 304,
  CHARGE_ERROR = 305,
  PHALANX_ERROR = 306,
  ENGAGEMENT_ERROR = 307,

  // Simulator errors (4xx)
  SIMULATION_FAILED = 400,
  MAX_ROUNDS_EXCEEDED = 401,
  DEAD_UNIT_ACTION = 402,
  NO_VALID_TARGET = 403,
  PATHFINDING_FAILED = 404,
}

/**
 * Base error class for all battle-related errors.
 * Includes battle context for debugging.
 *
 * @example
 * throw new BattleError(
 *   'Invalid battle state',
 *   BattleErrorCode.INVALID_STATE,
 *   { battleId: 'battle-123', round: 5 }
 * );
 */
export class BattleError extends Error {
  /** Error code for categorization */
  readonly code: BattleErrorCode;
  /** Battle context when error occurred */
  readonly context: BattleContext;
  /** Additional error metadata */
  readonly metadata?: Record<string, unknown>;
  /** Timestamp when error occurred */
  readonly timestamp: string;

  /**
   * Create a new battle error.
   *
   * @param message - Error message
   * @param code - Error code for categorization
   * @param context - Battle context when error occurred
   * @param metadata - Additional error metadata
   */
  constructor(
    message: string,
    code: BattleErrorCode = BattleErrorCode.UNKNOWN,
    context: BattleContext = {},
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BattleError';
    this.code = code;
    this.context = context;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BattleError);
    }
  }

  /**
   * Convert error to JSON for logging.
   *
   * @returns JSON-serializable error object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Validation error for invalid inputs or state.
 *
 * @example
 * throw new ValidationError(
 *   'Unit position out of bounds',
 *   BattleErrorCode.INVALID_POSITION,
 *   { unitId: 'knight-1' },
 *   { position: { x: -1, y: 5 } }
 * );
 */
export class ValidationError extends BattleError {
  constructor(
    message: string,
    code: BattleErrorCode = BattleErrorCode.INVALID_STATE,
    context: BattleContext = {},
    metadata?: Record<string, unknown>,
  ) {
    super(message, code, context, metadata);
    this.name = 'ValidationError';
  }
}

/**
 * Mechanic error for failures in battle mechanics.
 *
 * @example
 * throw new MechanicError(
 *   'Riposte failed: no charges remaining',
 *   BattleErrorCode.RIPOSTE_ERROR,
 *   { unitId: 'duelist-1', mechanic: 'riposte' },
 *   { riposteCharges: 0 }
 * );
 */
export class MechanicError extends BattleError {
  constructor(
    message: string,
    code: BattleErrorCode = BattleErrorCode.MECHANIC_FAILED,
    context: BattleContext = {},
    metadata?: Record<string, unknown>,
  ) {
    super(message, code, context, metadata);
    this.name = 'MechanicError';
  }
}

/**
 * Simulator error for failures in battle simulation.
 *
 * @example
 * throw new SimulatorError(
 *   'Battle exceeded maximum rounds',
 *   BattleErrorCode.MAX_ROUNDS_EXCEEDED,
 *   { battleId: 'battle-123', round: 100 }
 * );
 */
export class SimulatorError extends BattleError {
  constructor(
    message: string,
    code: BattleErrorCode = BattleErrorCode.SIMULATION_FAILED,
    context: BattleContext = {},
    metadata?: Record<string, unknown>,
  ) {
    super(message, code, context, metadata);
    this.name = 'SimulatorError';
  }
}

/**
 * Error recovery strategy type.
 */
export type RecoveryStrategy = 'skip' | 'retry' | 'fallback' | 'abort';

/**
 * Error recovery result.
 */
export interface RecoveryResult<T> {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Recovered value if successful */
  value?: T;
  /** Original error */
  originalError: BattleError;
  /** Recovery error if recovery failed */
  recoveryError?: Error;
}

/**
 * Error recovery options.
 */
export interface RecoveryOptions<T> {
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Fallback value if recovery fails */
  fallback?: T;
  /** Whether to log recovery attempts */
  logRecovery?: boolean;
  /** Custom recovery handler */
  onRecovery?: (error: BattleError, attempt: number) => T | undefined;
}

/**
 * Error boundary for simulator operations.
 * Wraps operations with error handling and recovery.
 *
 * @example
 * const boundary = new ErrorBoundary();
 *
 * const result = boundary.execute(
 *   () => riskyOperation(),
 *   { fallback: defaultValue, maxRetries: 2 }
 * );
 *
 * if (result.success) {
 *   console.log('Operation succeeded:', result.value);
 * } else {
 *   console.error('Operation failed:', result.originalError);
 * }
 */
export class ErrorBoundary {
  private errors: BattleError[] = [];
  private readonly maxErrors: number;

  /**
   * Create a new error boundary.
   *
   * @param maxErrors - Maximum errors to store (default: 100)
   */
  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Execute an operation with error handling.
   *
   * @param operation - Operation to execute
   * @param options - Recovery options
   * @returns Recovery result with success status and value
   *
   * @example
   * const result = boundary.execute(
   *   () => calculateDamage(attacker, target),
   *   { fallback: 0, maxRetries: 1 }
   * );
   */
  execute<T>(operation: () => T, options: RecoveryOptions<T> = {}): RecoveryResult<T> {
    const { maxRetries = 0, fallback, onRecovery } = options;

    let lastError: BattleError | undefined;
    let attempt = 0;

    // Try operation with retries
    while (attempt <= maxRetries) {
      try {
        const value = operation();
        return {
          success: true,
          strategy: attempt > 0 ? 'retry' : 'skip',
          value,
          originalError: lastError!,
        };
      } catch (error) {
        lastError = this.wrapError(error);
        this.recordError(lastError);

        // Try custom recovery handler
        if (onRecovery) {
          try {
            const recovered = onRecovery(lastError, attempt);
            if (recovered !== undefined) {
              return {
                success: true,
                strategy: 'fallback',
                value: recovered,
                originalError: lastError,
              };
            }
          } catch (recoveryError) {
            // Recovery handler failed, continue to next attempt
          }
        }

        attempt++;
      }
    }

    // All retries exhausted, try fallback
    if (fallback !== undefined) {
      return {
        success: true,
        strategy: 'fallback',
        value: fallback,
        originalError: lastError!,
      };
    }

    // No recovery possible
    return {
      success: false,
      strategy: 'abort',
      originalError: lastError!,
    };
  }

  /**
   * Execute an async operation with error handling.
   *
   * @param operation - Async operation to execute
   * @param options - Recovery options
   * @returns Promise of recovery result
   */
  async executeAsync<T>(
    operation: () => Promise<T>,
    options: RecoveryOptions<T> = {},
  ): Promise<RecoveryResult<T>> {
    const { maxRetries = 0, fallback, onRecovery } = options;

    let lastError: BattleError | undefined;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const value = await operation();
        return {
          success: true,
          strategy: attempt > 0 ? 'retry' : 'skip',
          value,
          originalError: lastError!,
        };
      } catch (error) {
        lastError = this.wrapError(error);
        this.recordError(lastError);

        if (onRecovery) {
          try {
            const recovered = onRecovery(lastError, attempt);
            if (recovered !== undefined) {
              return {
                success: true,
                strategy: 'fallback',
                value: recovered,
                originalError: lastError,
              };
            }
          } catch {
            // Recovery handler failed
          }
        }

        attempt++;
      }
    }

    if (fallback !== undefined) {
      return {
        success: true,
        strategy: 'fallback',
        value: fallback,
        originalError: lastError!,
      };
    }

    return {
      success: false,
      strategy: 'abort',
      originalError: lastError!,
    };
  }

  /**
   * Wrap any error as a BattleError.
   *
   * @param error - Error to wrap
   * @returns BattleError instance
   */
  private wrapError(error: unknown): BattleError {
    if (error instanceof BattleError) {
      return error;
    }

    if (error instanceof Error) {
      return new BattleError(
        error.message,
        BattleErrorCode.UNKNOWN,
        {},
        { originalError: error.name, stack: error.stack },
      );
    }

    return new BattleError(String(error), BattleErrorCode.UNKNOWN, {}, { originalValue: error });
  }

  /**
   * Record an error for later analysis.
   *
   * @param error - Error to record
   */
  private recordError(error: BattleError): void {
    this.errors.push(error);

    // Trim old errors if exceeding max
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  /**
   * Get all recorded errors.
   *
   * @returns Array of recorded errors
   */
  getErrors(): readonly BattleError[] {
    return [...this.errors];
  }

  /**
   * Clear all recorded errors.
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error count by code.
   *
   * @returns Map of error codes to counts
   */
  getErrorCounts(): Map<BattleErrorCode, number> {
    const counts = new Map<BattleErrorCode, number>();
    for (const error of this.errors) {
      const current = counts.get(error.code) ?? 0;
      counts.set(error.code, current + 1);
    }
    return counts;
  }
}

/**
 * Create a validation error for invalid unit.
 *
 * @param unitId - Invalid unit ID
 * @param reason - Reason for invalidity
 * @param context - Additional context
 * @returns ValidationError instance
 */
export function invalidUnitError(
  unitId: string,
  reason: string,
  context: BattleContext = {},
): ValidationError {
  return new ValidationError(`Invalid unit '${unitId}': ${reason}`, BattleErrorCode.INVALID_UNIT, {
    ...context,
    unitId,
  });
}

/**
 * Create a validation error for invalid position.
 *
 * @param position - Invalid position
 * @param reason - Reason for invalidity
 * @param context - Additional context
 * @returns ValidationError instance
 */
export function invalidPositionError(
  position: { x: number; y: number },
  reason: string,
  context: BattleContext = {},
): ValidationError {
  return new ValidationError(
    `Invalid position (${position.x}, ${position.y}): ${reason}`,
    BattleErrorCode.INVALID_POSITION,
    context,
    { position },
  );
}

/**
 * Create a validation error for invalid target.
 *
 * @param targetId - Invalid target ID
 * @param reason - Reason for invalidity
 * @param context - Additional context
 * @returns ValidationError instance
 */
export function invalidTargetError(
  targetId: string,
  reason: string,
  context: BattleContext = {},
): ValidationError {
  return new ValidationError(
    `Invalid target '${targetId}': ${reason}`,
    BattleErrorCode.INVALID_TARGET,
    { ...context, targetId },
  );
}

/**
 * Create a mechanic error.
 *
 * @param mechanic - Mechanic name
 * @param reason - Reason for failure
 * @param context - Additional context
 * @param metadata - Additional metadata
 * @returns MechanicError instance
 */
export function mechanicError(
  mechanic: string,
  reason: string,
  context: BattleContext = {},
  metadata?: Record<string, unknown>,
): MechanicError {
  const codeMap: Record<string, BattleErrorCode> = {
    facing: BattleErrorCode.FACING_ERROR,
    riposte: BattleErrorCode.RIPOSTE_ERROR,
    ammunition: BattleErrorCode.AMMUNITION_ERROR,
    resolve: BattleErrorCode.RESOLVE_ERROR,
    charge: BattleErrorCode.CHARGE_ERROR,
    phalanx: BattleErrorCode.PHALANX_ERROR,
    engagement: BattleErrorCode.ENGAGEMENT_ERROR,
  };

  return new MechanicError(
    `${mechanic} mechanic failed: ${reason}`,
    codeMap[mechanic.toLowerCase()] ?? BattleErrorCode.MECHANIC_FAILED,
    { ...context, mechanic },
    metadata,
  );
}

/**
 * Create a simulator error for dead unit action.
 *
 * @param unitId - Dead unit ID
 * @param action - Attempted action
 * @param context - Additional context
 * @returns SimulatorError instance
 */
export function deadUnitActionError(
  unitId: string,
  action: string,
  context: BattleContext = {},
): SimulatorError {
  return new SimulatorError(
    `Dead unit '${unitId}' attempted action: ${action}`,
    BattleErrorCode.DEAD_UNIT_ACTION,
    { ...context, unitId },
    { action },
  );
}

/**
 * Create a simulator error for max rounds exceeded.
 *
 * @param maxRounds - Maximum rounds allowed
 * @param context - Additional context
 * @returns SimulatorError instance
 */
export function maxRoundsExceededError(
  maxRounds: number,
  context: BattleContext = {},
): SimulatorError {
  return new SimulatorError(
    `Battle exceeded maximum rounds (${maxRounds})`,
    BattleErrorCode.MAX_ROUNDS_EXCEEDED,
    context,
    { maxRounds },
  );
}

/**
 * Check if an error is a BattleError.
 *
 * @param error - Error to check
 * @returns True if error is a BattleError
 */
export function isBattleError(error: unknown): error is BattleError {
  return error instanceof BattleError;
}

/**
 * Check if an error is recoverable.
 * Validation errors are generally recoverable, simulator errors are not.
 *
 * @param error - Error to check
 * @returns True if error is recoverable
 */
export function isRecoverableError(error: BattleError): boolean {
  // Validation errors are recoverable (can skip or use fallback)
  if (error instanceof ValidationError) {
    return true;
  }

  // Some mechanic errors are recoverable
  if (error instanceof MechanicError) {
    const recoverableCodes = [BattleErrorCode.RIPOSTE_ERROR, BattleErrorCode.AMMUNITION_ERROR];
    return recoverableCodes.includes(error.code);
  }

  // Simulator errors are generally not recoverable
  return false;
}

/**
 * Error logger that combines BattleLogger with error handling.
 * Provides structured error logging with full battle context.
 *
 * @example
 * const errorLogger = new ErrorLogger(logger);
 * errorLogger.logError(error);
 * errorLogger.logAndThrow(error);
 */
export class ErrorLogger {
  private logger: {
    error: (
      message: string,
      context?: BattleContext,
      error?: Error | Record<string, unknown>,
    ) => void;
    warn: (message: string, context?: BattleContext, metadata?: Record<string, unknown>) => void;
  };

  /**
   * Create a new error logger.
   *
   * @param logger - Logger instance with error and warn methods
   */
  constructor(logger: {
    error: (
      message: string,
      context?: BattleContext,
      error?: Error | Record<string, unknown>,
    ) => void;
    warn: (message: string, context?: BattleContext, metadata?: Record<string, unknown>) => void;
  }) {
    this.logger = logger;
  }

  /**
   * Log an error with full context.
   *
   * @param error - Error to log
   *
   * @example
   * errorLogger.logError(new BattleError('Invalid state', BattleErrorCode.INVALID_STATE));
   */
  logError(error: BattleError): void {
    this.logger.error(error.message, error.context, {
      code: error.code,
      codeName: BattleErrorCode[error.code],
      ...error.metadata,
      timestamp: error.timestamp,
    });
  }

  /**
   * Log an error and re-throw it.
   *
   * @param error - Error to log and throw
   * @throws The same error after logging
   *
   * @example
   * errorLogger.logAndThrow(new BattleError('Critical failure'));
   */
  logAndThrow(error: BattleError): never {
    this.logError(error);
    throw error;
  }

  /**
   * Log a warning for a recoverable error.
   *
   * @param error - Error to log as warning
   * @param recoveryAction - Description of recovery action taken
   *
   * @example
   * errorLogger.logRecovery(error, 'Using fallback value');
   */
  logRecovery(error: BattleError, recoveryAction: string): void {
    this.logger.warn(`Recovered from error: ${error.message}`, error.context, {
      code: error.code,
      codeName: BattleErrorCode[error.code],
      recoveryAction,
      ...error.metadata,
    });
  }

  /**
   * Log a recovery result.
   *
   * @param result - Recovery result to log
   *
   * @example
   * const result = boundary.execute(() => riskyOperation());
   * errorLogger.logRecoveryResult(result);
   */
  logRecoveryResult<T>(result: RecoveryResult<T>): void {
    if (result.success) {
      if (result.strategy !== 'skip') {
        this.logger.warn(
          `Operation recovered using ${result.strategy} strategy`,
          result.originalError?.context,
          {
            strategy: result.strategy,
            originalError: result.originalError?.message,
          },
        );
      }
    } else {
      this.logError(result.originalError);
    }
  }

  /**
   * Wrap an operation with error logging.
   *
   * @param operation - Operation to execute
   * @param context - Context to add to any errors
   * @returns Operation result
   * @throws BattleError with context if operation fails
   *
   * @example
   * const result = errorLogger.wrapOperation(
   *   () => calculateDamage(attacker, target),
   *   { phase: 'attack', unitId: attacker.instanceId }
   * );
   */
  wrapOperation<T>(operation: () => T, context: BattleContext): T {
    try {
      return operation();
    } catch (error) {
      const battleError =
        error instanceof BattleError
          ? new BattleError(
              error.message,
              error.code,
              { ...error.context, ...context },
              error.metadata,
            )
          : new BattleError(
              error instanceof Error ? error.message : String(error),
              BattleErrorCode.UNKNOWN,
              context,
              {
                originalError: error instanceof Error ? error.name : typeof error,
              },
            );

      this.logAndThrow(battleError);
    }
  }

  /**
   * Wrap an async operation with error logging.
   *
   * @param operation - Async operation to execute
   * @param context - Context to add to any errors
   * @returns Promise of operation result
   * @throws BattleError with context if operation fails
   */
  async wrapOperationAsync<T>(operation: () => Promise<T>, context: BattleContext): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const battleError =
        error instanceof BattleError
          ? new BattleError(
              error.message,
              error.code,
              { ...error.context, ...context },
              error.metadata,
            )
          : new BattleError(
              error instanceof Error ? error.message : String(error),
              BattleErrorCode.UNKNOWN,
              context,
              {
                originalError: error instanceof Error ? error.name : typeof error,
              },
            );

      this.logAndThrow(battleError);
    }
  }
}

/**
 * Create an error logger from a BattleLogger.
 *
 * @param logger - BattleLogger instance
 * @returns ErrorLogger instance
 *
 * @example
 * import { BattleLogger } from './logger';
 * const logger = new BattleLogger({ battleId: 'battle-123' });
 * const errorLogger = createErrorLogger(logger);
 */
export function createErrorLogger(logger: {
  error: (
    message: string,
    context?: BattleContext,
    error?: Error | Record<string, unknown>,
  ) => void;
  warn: (message: string, context?: BattleContext, metadata?: Record<string, unknown>) => void;
}): ErrorLogger {
  return new ErrorLogger(logger);
}
