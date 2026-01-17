/**
 * Ability System Types for Fantasy Roguelike.
 * Defines types for unit abilities, effects, and targeting.
 *
 * @module game/types/ability
 */

// =============================================================================
// ABILITY TYPE ENUMS
// =============================================================================

/**
 * Ability activation type.
 */
export type AbilityType = 'active' | 'passive';

/**
 * Ability targeting classification.
 */
export type TargetType =
  | 'self'
  | 'ally'
  | 'enemy'
  | 'area'
  | 'lowest_hp_ally'
  | 'lowest_hp_enemy'
  | 'all_allies'
  | 'all_enemies';

/**
 * Damage type classification.
 */
export type DamageType = 'physical' | 'magical' | 'true';

/**
 * Stats that can be modified by buffs/debuffs.
 */
export type ModifiableStat =
  | 'attack'
  | 'armor'
  | 'speed'
  | 'initiative'
  | 'dodge';

/**
 * Passive ability trigger conditions.
 */
export type PassiveTrigger =
  | 'on_attack'
  | 'on_hit'
  | 'on_low_hp'
  | 'on_ally_death'
  | 'on_kill';

// =============================================================================
// ABILITY EFFECTS
// =============================================================================

/**
 * Damage effect configuration.
 */
export interface DamageEffect {
  type: 'damage';
  /** Base damage value */
  value: number;
  /** Damage type */
  damageType: DamageType;
  /** Attack scaling multiplier */
  attackScaling?: number;
  /** Trigger chance (0-100) */
  chance?: number;
}

/**
 * Heal effect configuration.
 */
export interface HealEffect {
  type: 'heal';
  /** Base heal value */
  value: number;
  /** Attack scaling multiplier */
  attackScaling?: number;
  /** Whether healing can exceed max HP */
  canOverheal?: boolean;
}

/**
 * Buff effect configuration.
 */
export interface BuffEffect {
  type: 'buff';
  /** Stat to modify */
  stat: ModifiableStat;
  /** Percentage increase (0.0-1.0) */
  percentage: number;
  /** Duration in turns */
  duration: number;
  /** Whether effect can stack */
  stackable: boolean;
}

/**
 * Debuff effect configuration.
 */
export interface DebuffEffect {
  type: 'debuff';
  /** Stat to modify */
  stat: ModifiableStat;
  /** Percentage decrease (0.0-1.0) */
  percentage: number;
  /** Duration in turns (0 = instant) */
  duration: number;
}

/**
 * Stun effect configuration.
 */
export interface StunEffect {
  type: 'stun';
  /** Duration in turns */
  duration: number;
}

/**
 * Taunt effect configuration.
 */
export interface TauntEffect {
  type: 'taunt';
  /** Duration in turns */
  duration: number;
}

/**
 * Union type of all ability effects.
 */
export type AbilityEffect =
  | DamageEffect
  | HealEffect
  | BuffEffect
  | DebuffEffect
  | StunEffect
  | TauntEffect;

// =============================================================================
// ABILITY DEFINITIONS
// =============================================================================

/**
 * Base ability properties shared by all abilities.
 */
interface BaseAbility {
  /** Unique ability identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description text */
  description: string;
  /** Ability type */
  type: AbilityType;
  /** Targeting type */
  targetType: TargetType;
  /** Range in cells */
  range: number;
  /** Ability effects */
  effects: AbilityEffect[];
  /** Icon identifier */
  icon: string;
}

/**
 * Active ability that must be manually triggered.
 */
export interface ActiveAbility extends BaseAbility {
  type: 'active';
  /** Cooldown in turns */
  cooldown: number;
  /** Area of effect size (for area abilities) */
  areaSize?: number;
}

/**
 * Passive ability that triggers automatically.
 */
export interface PassiveAbility extends BaseAbility {
  type: 'passive';
  /** Trigger condition */
  trigger: PassiveTrigger;
  /** Trigger threshold (e.g., HP percentage) */
  triggerThreshold?: number;
}

/**
 * Union type of all abilities.
 */
export type Ability = ActiveAbility | PassiveAbility;

/**
 * Ability ID type (string alias for clarity).
 */
export type AbilityId = string;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if ability is active.
 *
 * @param ability - Ability to check
 * @returns True if ability is active
 * @example
 * if (isActiveAbility(ability)) {
 *   console.log(ability.cooldown);
 * }
 */
export function isActiveAbility(ability: Ability): ability is ActiveAbility {
  return ability.type === 'active';
}

/**
 * Check if ability is passive.
 *
 * @param ability - Ability to check
 * @returns True if ability is passive
 * @example
 * if (isPassiveAbility(ability)) {
 *   console.log(ability.trigger);
 * }
 */
export function isPassiveAbility(ability: Ability): ability is PassiveAbility {
  return ability.type === 'passive';
}

/**
 * Check if effect is damage effect.
 *
 * @param effect - Effect to check
 * @returns True if effect is damage
 */
export function isDamageEffect(effect: AbilityEffect): effect is DamageEffect {
  return effect.type === 'damage';
}

/**
 * Check if effect is heal effect.
 *
 * @param effect - Effect to check
 * @returns True if effect is heal
 */
export function isHealEffect(effect: AbilityEffect): effect is HealEffect {
  return effect.type === 'heal';
}

/**
 * Check if effect is buff effect.
 *
 * @param effect - Effect to check
 * @returns True if effect is buff
 */
export function isBuffEffect(effect: AbilityEffect): effect is BuffEffect {
  return effect.type === 'buff';
}

/**
 * Check if effect is debuff effect.
 *
 * @param effect - Effect to check
 * @returns True if effect is debuff
 */
export function isDebuffEffect(effect: AbilityEffect): effect is DebuffEffect {
  return effect.type === 'debuff';
}
