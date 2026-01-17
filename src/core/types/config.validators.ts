/**
 * Configuration validators for the core battle engine.
 * Runtime validation to catch invalid configurations early.
 *
 * @module core/types/config.validators
 */

import { GridConfig, BattleConfig } from './config.types';

/**
 * Validates grid configuration.
 * Throws an error if configuration is invalid.
 *
 * @param config - Grid configuration to validate
 * @throws Error if dimensions are not positive
 * @throws Error if player rows are outside grid bounds
 * @throws Error if enemy rows are outside grid bounds
 *
 * @example
 * validateGridConfig({ width: 8, height: 10, playerRows: [0, 1], enemyRows: [8, 9] }); // OK
 * validateGridConfig({ width: 0, height: 10, playerRows: [], enemyRows: [] }); // throws
 */
export function validateGridConfig(config: GridConfig): void {
  // Validate dimensions
  if (config.width <= 0 || config.height <= 0) {
    throw new Error(
      `Grid dimensions must be positive. Got width=${config.width}, height=${config.height}`,
    );
  }

  // Validate player rows
  for (const row of config.playerRows) {
    if (row < 0 || row >= config.height) {
      throw new Error(`Player row ${row} is outside grid bounds [0, ${config.height - 1}]`);
    }
  }

  // Validate enemy rows
  for (const row of config.enemyRows) {
    if (row < 0 || row >= config.height) {
      throw new Error(`Enemy row ${row} is outside grid bounds [0, ${config.height - 1}]`);
    }
  }

  // Check for overlapping rows
  const playerRowSet = new Set(config.playerRows);
  for (const row of config.enemyRows) {
    if (playerRowSet.has(row)) {
      throw new Error(`Row ${row} is assigned to both player and enemy deployment zones`);
    }
  }
}

/**
 * Validates battle configuration.
 * Throws an error if configuration is invalid.
 *
 * @param config - Battle configuration to validate
 * @throws Error if maxRounds is not positive
 * @throws Error if minDamage is negative
 * @throws Error if dodgeCapPercent is outside [0, 100]
 *
 * @example
 * validateBattleConfig({ maxRounds: 100, minDamage: 1, dodgeCapPercent: 50 }); // OK
 * validateBattleConfig({ maxRounds: 0, minDamage: 1, dodgeCapPercent: 50 }); // throws
 */
export function validateBattleConfig(config: BattleConfig): void {
  // Validate max rounds
  if (config.maxRounds <= 0) {
    throw new Error(`Max rounds must be positive. Got maxRounds=${config.maxRounds}`);
  }

  // Validate min damage
  if (config.minDamage < 0) {
    throw new Error(`Min damage cannot be negative. Got minDamage=${config.minDamage}`);
  }

  // Validate dodge cap
  if (config.dodgeCapPercent < 0 || config.dodgeCapPercent > 100) {
    throw new Error(
      `Dodge cap must be between 0 and 100. Got dodgeCapPercent=${config.dodgeCapPercent}`,
    );
  }
}

/**
 * Validates both grid and battle configurations.
 * Convenience function for validating complete engine config.
 *
 * @param gridConfig - Grid configuration to validate
 * @param battleConfig - Battle configuration to validate
 * @throws Error if any configuration is invalid
 */
export function validateEngineConfig(gridConfig: GridConfig, battleConfig: BattleConfig): void {
  validateGridConfig(gridConfig);
  validateBattleConfig(battleConfig);
}
