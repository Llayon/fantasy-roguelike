/**
 * Structured logging utilities for the battle simulator.
 * Provides JSON-formatted logs with battle context for easy debugging and LLM parsing.
 *
 * @module core/utils/logger
 */

/**
 * Log levels in order of severity.
 * Production mode filters to warn and error only.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Battle context for structured logging.
 * Provides context for debugging battle-related issues.
 */
export interface BattleContext {
  /** Unique battle identifier */
  battleId?: string;
  /** Current round number (1-based) */
  round?: number;
  /** Current turn number within round */
  turn?: number;
  /** Current battle phase */
  phase?: string;
  /** Unit performing action */
  unitId?: string;
  /** Target of action */
  targetId?: string;
  /** Mechanic being applied */
  mechanic?: string;
}

/**
 * Structured log entry format.
 * Designed for machine parsing and LLM consumption.
 */
export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log level string */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log message */
  message: string;
  /** Battle context */
  context?: BattleContext;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration options.
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to output as JSON (true) or human-readable (false) */
  jsonFormat: boolean;
  /** Custom output function (defaults to console) */
  output?: (entry: LogEntry) => void;
}

/**
 * Default logger configuration.
 * Debug level, JSON format for machine parsing.
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: LogLevel.DEBUG,
  jsonFormat: true,
};

/**
 * Production logger configuration.
 * Warn level and above only, JSON format.
 */
export const PRODUCTION_CONFIG: LoggerConfig = {
  minLevel: LogLevel.WARN,
  jsonFormat: true,
};

/**
 * Development logger configuration.
 * All levels, human-readable format.
 */
export const DEVELOPMENT_CONFIG: LoggerConfig = {
  minLevel: LogLevel.DEBUG,
  jsonFormat: false,
};

/**
 * Battle Logger class for structured logging with battle context.
 *
 * @example
 * const logger = new BattleLogger({ battleId: 'battle-123' });
 * logger.debug('Turn started', { round: 1, turn: 1 });
 * logger.info('Damage dealt', { unitId: 'knight-1', targetId: 'goblin-1' }, { damage: 25 });
 * logger.warn('Low HP warning', { unitId: 'knight-1' }, { currentHp: 5 });
 * logger.error('Invalid state', { phase: 'attack' }, new Error('No target'));
 */
export class BattleLogger {
  private config: LoggerConfig;
  private baseContext: BattleContext;

  /**
   * Create a new battle logger.
   *
   * @param baseContext - Default context applied to all log entries
   * @param config - Logger configuration (defaults to DEBUG level, JSON format)
   *
   * @example
   * // Create logger for a specific battle
   * const logger = new BattleLogger({ battleId: 'battle-123' });
   *
   * // Create production logger
   * const prodLogger = new BattleLogger({}, PRODUCTION_CONFIG);
   */
  constructor(baseContext: BattleContext = {}, config: Partial<LoggerConfig> = {}) {
    this.baseContext = baseContext;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with additional context.
   * Useful for scoping logs to a specific round, turn, or phase.
   *
   * @param additionalContext - Context to merge with base context
   * @returns New logger with merged context
   *
   * @example
   * const battleLogger = new BattleLogger({ battleId: 'battle-123' });
   * const turnLogger = battleLogger.child({ round: 1, turn: 1 });
   * turnLogger.debug('Processing turn'); // Includes battleId, round, turn
   */
  child(additionalContext: BattleContext): BattleLogger {
    return new BattleLogger({ ...this.baseContext, ...additionalContext }, this.config);
  }

  /**
   * Log a debug message.
   * Filtered out in production mode.
   *
   * @param message - Log message
   * @param context - Additional context for this entry
   * @param metadata - Additional metadata
   *
   * @example
   * logger.debug('Turn started', { round: 1, turn: 1 });
   * logger.debug('Mechanic triggered', { mechanic: 'riposte' }, { chance: 0.3 });
   */
  debug(message: string, context?: BattleContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  /**
   * Log an info message.
   * Filtered out in production mode.
   *
   * @param message - Log message
   * @param context - Additional context for this entry
   * @param metadata - Additional metadata
   *
   * @example
   * logger.info('Battle started', { battleId: 'battle-123' });
   * logger.info('Damage dealt', { unitId: 'knight-1' }, { damage: 25 });
   */
  info(message: string, context?: BattleContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  /**
   * Log a warning message.
   * Always logged, even in production.
   *
   * @param message - Log message
   * @param context - Additional context for this entry
   * @param metadata - Additional metadata
   *
   * @example
   * logger.warn('Unit has no valid targets', { unitId: 'archer-1' });
   * logger.warn('Approaching max rounds', { round: 95 }, { maxRounds: 100 });
   */
  warn(message: string, context?: BattleContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  /**
   * Log an error message.
   * Always logged, even in production.
   *
   * @param message - Log message
   * @param context - Additional context for this entry
   * @param error - Error object or additional metadata
   *
   * @example
   * logger.error('Failed to execute ability', { unitId: 'mage-1' }, new Error('Invalid target'));
   * logger.error('Battle state corrupted', { battleId: 'battle-123' });
   */
  error(message: string, context?: BattleContext, error?: Error | Record<string, unknown>): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, message, context, undefined, error);
    } else {
      this.log(LogLevel.ERROR, message, context, error);
    }
  }

  /**
   * Internal log method.
   */
  private log(
    level: LogLevel,
    message: string,
    context?: BattleContext,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    // Filter by log level
    if (level < this.config.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: this.levelToString(level),
      message,
      context: this.mergeContext(context),
      metadata,
    };

    // Add error details if present
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Remove undefined fields for cleaner output
    if (!entry.context || Object.keys(entry.context).length === 0) {
      delete entry.context;
    }
    if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
      delete entry.metadata;
    }

    // Output the log entry
    if (this.config.output) {
      this.config.output(entry);
    } else {
      this.defaultOutput(entry, level);
    }
  }

  /**
   * Merge base context with additional context.
   */
  private mergeContext(additional?: BattleContext): BattleContext {
    const merged = { ...this.baseContext, ...additional };
    // Remove undefined values
    return Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined),
    ) as BattleContext;
  }

  /**
   * Convert log level to string.
   */
  private levelToString(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
    }
  }

  /**
   * Default output to console.
   */
  private defaultOutput(entry: LogEntry, level: LogLevel): void {
    const output = this.config.jsonFormat ? JSON.stringify(entry) : this.formatHumanReadable(entry);

    switch (level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(output);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(output);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(output);
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(output);
        break;
    }
  }

  /**
   * Format log entry for human-readable output.
   */
  private formatHumanReadable(entry: LogEntry): string {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(`context=${JSON.stringify(entry.context)}`);
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(`metadata=${JSON.stringify(entry.metadata)}`);
    }

    if (entry.error) {
      parts.push(`error=${entry.error.name}: ${entry.error.message}`);
    }

    return parts.join(' ');
  }

  /**
   * Update logger configuration.
   *
   * @param config - Partial configuration to merge
   *
   * @example
   * logger.configure({ minLevel: LogLevel.WARN }); // Switch to production mode
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   *
   * @returns Current logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Create a logger configured for production mode.
 * Only logs warnings and errors.
 *
 * @param baseContext - Default context applied to all log entries
 * @returns Logger configured for production
 *
 * @example
 * const logger = createProductionLogger({ battleId: 'battle-123' });
 */
export function createProductionLogger(baseContext: BattleContext = {}): BattleLogger {
  return new BattleLogger(baseContext, PRODUCTION_CONFIG);
}

/**
 * Create a logger configured for development mode.
 * Logs all levels in human-readable format.
 *
 * @param baseContext - Default context applied to all log entries
 * @returns Logger configured for development
 *
 * @example
 * const logger = createDevelopmentLogger({ battleId: 'battle-123' });
 */
export function createDevelopmentLogger(baseContext: BattleContext = {}): BattleLogger {
  return new BattleLogger(baseContext, DEVELOPMENT_CONFIG);
}

/**
 * Create a logger based on environment.
 * Uses NODE_ENV to determine configuration.
 *
 * @param baseContext - Default context applied to all log entries
 * @returns Logger configured for current environment
 *
 * @example
 * const logger = createLogger({ battleId: 'battle-123' });
 */
export function createLogger(baseContext: BattleContext = {}): BattleLogger {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? createProductionLogger(baseContext) : createDevelopmentLogger(baseContext);
}

/**
 * Create a silent logger that doesn't output anything.
 * Useful for testing.
 *
 * @param baseContext - Default context applied to all log entries
 * @returns Logger that doesn't output
 *
 * @example
 * const logger = createSilentLogger();
 * logger.debug('This will not be output');
 */
export function createSilentLogger(baseContext: BattleContext = {}): BattleLogger {
  return new BattleLogger(baseContext, {
    minLevel: LogLevel.ERROR + 1, // Higher than any level
    jsonFormat: true,
    output: (): void => {}, // No-op output
  });
}
