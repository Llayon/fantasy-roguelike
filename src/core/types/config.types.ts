/**
 * Configuration type definitions for the core battle engine.
 * These interfaces allow customization of grid and battle parameters.
 *
 * @module core/types/config
 */

/**
 * Grid configuration interface.
 * Defines battlefield dimensions and deployment zones.
 *
 * @example
 * const config: GridConfig = {
 *   width: 8,
 *   height: 10,
 *   playerRows: [0, 1],
 *   enemyRows: [8, 9],
 * };
 */
export interface GridConfig {
  /** Grid width in cells */
  width: number;
  /** Grid height in cells */
  height: number;
  /** Row indices for player unit deployment */
  playerRows: number[];
  /** Row indices for enemy unit deployment */
  enemyRows: number[];
}

/**
 * Battle configuration interface.
 * Defines battle simulation parameters.
 *
 * @example
 * const config: BattleConfig = {
 *   maxRounds: 100,
 *   minDamage: 1,
 *   dodgeCapPercent: 50,
 * };
 */
export interface BattleConfig {
  /** Maximum battle rounds before draw */
  maxRounds: number;
  /** Minimum damage dealt (after armor reduction) */
  minDamage: number;
  /** Maximum dodge chance percentage (0-100) */
  dodgeCapPercent: number;
}

/**
 * Damage calculation configuration.
 * Allows customization of damage formulas.
 *
 * @example
 * const config: DamageConfig = {
 *   physicalFormula: (atk, armor, atkCount) => Math.max(1, (atk - armor) * atkCount),
 *   magicFormula: (atk, atkCount) => atk * atkCount,
 * };
 */
export interface DamageConfig {
  /**
   * Physical damage formula.
   * @param atk - Attacker's attack value
   * @param armor - Target's armor value
   * @param atkCount - Number of attacks
   * @returns Calculated damage
   */
  physicalFormula: (atk: number, armor: number, atkCount: number) => number;

  /**
   * Magic damage formula (ignores armor).
   * @param atk - Attacker's attack value
   * @param atkCount - Number of attacks
   * @returns Calculated damage
   */
  magicFormula: (atk: number, atkCount: number) => number;
}

/**
 * Pathfinding configuration.
 * Parameters for A* algorithm.
 */
export interface PathfindingConfig {
  /** Maximum iterations to prevent infinite loops */
  maxIterations: number;
  /** Movement cost for adjacent cells */
  movementCost: number;
  /** Diagonal movement cost multiplier */
  diagonalCost: number;
}

/**
 * Complete engine configuration.
 * Combines all configuration interfaces.
 */
export interface EngineConfig {
  /** Grid configuration */
  grid: GridConfig;
  /** Battle configuration */
  battle: BattleConfig;
  /** Damage calculation configuration */
  damage: DamageConfig;
  /** Pathfinding configuration */
  pathfinding: PathfindingConfig;
}
