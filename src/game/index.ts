/**
 * Game-specific content.
 *
 * This module contains:
 * - Unit definitions (15 units)
 * - Ability data (15 abilities)
 * - Faction definitions (6 factions)
 * - Game types and constants
 *
 * @module game
 */

// Types (excluding duplicates that are in constants)
export {
  TeamType,
  BattleWinner,
  UnitStats,
  FacingDirection,
  UnitTemplate,
  BattleUnit,
  FinalUnitState,
} from './types/game.types';

export {
  AbilityType,
  TargetType,
  DamageType,
  ModifiableStat,
  PassiveTrigger,
  DamageEffect,
  HealEffect,
  BuffEffect,
  DebuffEffect,
  StunEffect,
  TauntEffect,
  AbilityEffect,
  ActiveAbility,
  PassiveAbility,
  Ability,
  AbilityId,
  isActiveAbility,
  isPassiveAbility,
  isDamageEffect,
  isHealEffect,
  isBuffEffect,
  isDebuffEffect,
} from './types/ability.types';

// Constants
export * from './constants';

// Unit definitions
export * from './units';

// Ability data
export * from './abilities';

// Faction definitions
export * from './factions';
