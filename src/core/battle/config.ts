/**
 * Default battle configuration for the core battle engine.
 *
 * @module core/battle/config
 */

import { BattleConfig, DamageConfig } from '../types/config.types';

/**
 * Default battle configuration.
 * Standard battle parameters for most games.
 */
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  maxRounds: 100,
  minDamage: 1,
  dodgeCapPercent: 50,
};

/**
 * Default damage calculation configuration.
 * Standard formulas: physical reduced by armor, magic ignores armor.
 */
export const DEFAULT_DAMAGE_CONFIG: DamageConfig = {
  physicalFormula: (atk: number, armor: number, atkCount: number): number =>
    Math.max(1, (atk - armor) * atkCount),
  magicFormula: (atk: number, atkCount: number): number => atk * atkCount,
};
