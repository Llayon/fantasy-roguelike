/**
 * Damage calculation system for battle engine.
 * Provides deterministic damage calculations with physical/magic damage types,
 * dodge mechanics, and health management.
 *
 * @fileoverview Pure functions for combat damage calculations.
 * All functions are deterministic and use seeded randomness for reproducible results.
 *
 * @module core/battle/damage
 */

import type { BattleConfig } from '../types/config.types';
import { seededRandom } from '../utils/random';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default battle configuration.
 */
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  maxRounds: 100,
  minDamage: 1,
  dodgeCapPercent: 50,
};

// =============================================================================
// UNIT INTERFACE (minimal for core)
// =============================================================================

/**
 * Minimal unit interface for damage calculations.
 * Game-specific unit types should extend this.
 */
export interface DamageUnit {
  /** Unit stats */
  stats: {
    /** Attack power */
    atk: number;
    /** Number of attacks per turn */
    atkCount: number;
    /** Armor (damage reduction) */
    armor: number;
    /** Dodge chance (0-100) */
    dodge: number;
  };
  /** Current hit points */
  currentHp: number;
  /** Maximum hit points */
  maxHp: number;
  /**
   * Accumulated armor shred from physical attacks.
   * Reduces effective armor when present.
   * Part of Core 2.0 mechanics system.
   */
  armorShred?: number;
}

// =============================================================================
// EFFECTIVE ARMOR CALCULATION
// =============================================================================

/**
 * Calculate effective armor after applying armor shred.
 * Effective armor = base armor - armor shred (minimum 0).
 *
 * @param unit - The unit to calculate effective armor for
 * @returns Effective armor value (minimum 0)
 * @example
 * const knight = { stats: { armor: 10 }, armorShred: 3 };
 * const effectiveArmor = getEffectiveArmor(knight);
 * // Returns: 7 (10 - 3)
 */
export function getEffectiveArmor(unit: DamageUnit): number {
  const baseArmor = unit.stats.armor;
  const shred = unit.armorShred ?? 0;
  return Math.max(0, baseArmor - shred);
}

// =============================================================================
// DAMAGE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Options for physical damage calculation.
 * Supports Core 2.0 mechanics like flanking modifiers and charge momentum.
 */
export interface PhysicalDamageOptions {
  /**
   * Flanking damage modifier from Core 2.0 mechanics.
   * - 1.0 = front attack (no bonus)
   * - 1.3 = flank attack (+30% damage)
   * - 1.5 = rear attack (+50% damage)
   */
  flankingModifier?: number;

  /**
   * Charge momentum bonus from Core 2.0 mechanics.
   * - 0.0 = no charge bonus
   * - 0.2 = +20% damage (1 cell moved)
   * - 1.0 = +100% damage (max momentum)
   */
  momentumBonus?: number;
}

/**
 * Calculate physical damage dealt by attacker to target.
 * Physical damage is reduced by target's effective armor but has a minimum of 1.
 *
 * Formula: max(minDamage, floor((ATK * flankingModifier * (1 + momentumBonus) - effectiveArmor) * atkCount))
 *
 * @param attacker - The unit dealing damage
 * @param target - The unit receiving damage
 * @param config - Battle configuration (defaults to standard config)
 * @param options - Optional damage calculation options
 * @returns Calculated physical damage value (minimum 1)
 * @example
 * const warrior = { stats: { atk: 15, atkCount: 1, armor: 0, dodge: 0 }, currentHp: 100, maxHp: 100 };
 * const knight = { stats: { atk: 10, atkCount: 1, armor: 8, dodge: 0 }, currentHp: 100, maxHp: 100 };
 * const damage = calculatePhysicalDamage(warrior, knight);
 * // Returns: max(1, (15 - 8) * 1) = 7
 */
export function calculatePhysicalDamage(
  attacker: DamageUnit,
  target: DamageUnit,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  options?: PhysicalDamageOptions,
): number {
  const effectiveArmor = getEffectiveArmor(target);
  let effectiveAtk = attacker.stats.atk;

  if (options?.flankingModifier !== undefined && options.flankingModifier !== 1.0) {
    effectiveAtk = effectiveAtk * options.flankingModifier;
  }

  if (options?.momentumBonus !== undefined && options.momentumBonus > 0) {
    effectiveAtk = effectiveAtk * (1 + options.momentumBonus);
  }

  const baseDamage = Math.floor(effectiveAtk) - effectiveArmor;
  const totalDamage = baseDamage * attacker.stats.atkCount;

  return Math.max(config.minDamage, totalDamage);
}

/**
 * Calculate magic damage dealt by attacker to target.
 * Magic damage ignores armor and is calculated directly from attack power.
 * Formula: ATK * atkCount
 *
 * @param attacker - The unit dealing magic damage
 * @param _target - The unit receiving damage (armor ignored)
 * @returns Calculated magic damage value
 */
export function calculateMagicDamage(attacker: DamageUnit, _target: DamageUnit): number {
  return attacker.stats.atk * attacker.stats.atkCount;
}

/**
 * Perform deterministic dodge roll for physical attacks.
 * Uses seeded random number generation for reproducible results.
 *
 * @param target - The unit attempting to dodge
 * @param seed - Seed for deterministic random generation
 * @returns True if attack was dodged, false if hit
 */
export function rollDodge(target: DamageUnit, seed: number): boolean {
  const roll = seededRandom(seed);
  const dodgeChance = target.stats.dodge / 100;
  return roll < dodgeChance;
}

/**
 * Apply damage to a unit and calculate new health state.
 * Does not mutate the input unit, returns new state values.
 *
 * @param target - The unit receiving damage
 * @param damage - Amount of damage to apply
 * @returns Object with new HP and death status
 */
export function applyDamage(
  target: DamageUnit,
  damage: number,
): { newHp: number; killed: boolean; overkill: number } {
  const newHp = Math.max(0, target.currentHp - damage);
  const killed = newHp === 0;
  const overkill = damage > target.currentHp ? damage - target.currentHp : 0;

  return { newHp, killed, overkill };
}

/**
 * Apply healing to a unit and calculate new health state.
 * Does not mutate the input unit, returns new state values.
 * Cannot heal above maximum HP.
 *
 * @param target - The unit receiving healing
 * @param healAmount - Amount of healing to apply
 * @returns Object with new HP and overheal amount
 */
export function applyHealing(
  target: DamageUnit,
  healAmount: number,
): { newHp: number; overheal: number } {
  const potentialHp = target.currentHp + healAmount;
  const newHp = Math.min(target.maxHp, potentialHp);
  const overheal = potentialHp > target.maxHp ? potentialHp - target.maxHp : 0;

  return { newHp, overheal };
}

// =============================================================================
// COMBAT RESOLUTION FUNCTIONS
// =============================================================================

/**
 * Options for resolving a physical attack.
 */
export interface ResolvePhysicalAttackOptions {
  /** Flanking damage modifier */
  flankingModifier?: number;
  /** Charge momentum bonus */
  momentumBonus?: number;
}

/**
 * Resolve a complete physical attack between two units.
 * Handles damage calculation, dodge rolls, and damage application.
 *
 * @param attacker - The unit performing the attack
 * @param target - The unit being attacked
 * @param seed - Seed for deterministic dodge calculation
 * @param config - Battle configuration
 * @param options - Optional attack resolution options
 * @returns Complete attack result with damage and status changes
 */
export function resolvePhysicalAttack(
  attacker: DamageUnit,
  target: DamageUnit,
  seed: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  options?: ResolvePhysicalAttackOptions,
): {
  damage: number;
  dodged: boolean;
  killed: boolean;
  newHp: number;
  overkill: number;
} {
  const dodged = rollDodge(target, seed);

  if (dodged) {
    return {
      damage: 0,
      dodged: true,
      killed: false,
      newHp: target.currentHp,
      overkill: 0,
    };
  }

  let damageOptions: PhysicalDamageOptions | undefined;
  if (options?.flankingModifier !== undefined || options?.momentumBonus !== undefined) {
    damageOptions = {};
    if (options?.flankingModifier !== undefined) {
      damageOptions.flankingModifier = options.flankingModifier;
    }
    if (options?.momentumBonus !== undefined) {
      damageOptions.momentumBonus = options.momentumBonus;
    }
  }
  const damage = calculatePhysicalDamage(attacker, target, config, damageOptions);
  const damageResult = applyDamage(target, damage);

  return {
    damage,
    dodged: false,
    killed: damageResult.killed,
    newHp: damageResult.newHp,
    overkill: damageResult.overkill,
  };
}

/**
 * Resolve a complete magic attack between two units.
 * Magic attacks cannot be dodged and ignore armor.
 *
 * @param attacker - The unit performing the magic attack
 * @param target - The unit being attacked
 * @returns Complete magic attack result with damage and status changes
 */
export function resolveMagicAttack(
  attacker: DamageUnit,
  target: DamageUnit,
): {
  damage: number;
  killed: boolean;
  newHp: number;
  overkill: number;
} {
  const damage = calculateMagicDamage(attacker, target);
  const damageResult = applyDamage(target, damage);

  return {
    damage,
    killed: damageResult.killed,
    newHp: damageResult.newHp,
    overkill: damageResult.overkill,
  };
}

/**
 * Calculate effective damage reduction from armor.
 * Used for UI display and damage preview calculations.
 *
 * @param armor - Base armor value of the defending unit
 * @param incomingDamage - Raw damage before armor reduction
 * @param config - Battle configuration
 * @param armorShred - Optional armor shred amount
 * @returns Object with reduced damage and damage blocked
 */
export function calculateArmorReduction(
  armor: number,
  incomingDamage: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  armorShred: number = 0,
): { reducedDamage: number; damageBlocked: number } {
  const effectiveArmor = Math.max(0, armor - armorShred);
  const damageBlocked = Math.min(effectiveArmor, incomingDamage - config.minDamage);
  const reducedDamage = Math.max(config.minDamage, incomingDamage - effectiveArmor);

  return {
    reducedDamage,
    damageBlocked: Math.max(0, damageBlocked),
  };
}

/**
 * Check if a unit can survive a specific amount of damage.
 *
 * @param unit - The unit to check survival for
 * @param damage - Amount of damage to test
 * @returns True if unit survives, false if killed
 */
export function canSurviveDamage(unit: DamageUnit, damage: number): boolean {
  return unit.currentHp > damage;
}

/**
 * Calculate damage needed to kill a unit.
 *
 * @param unit - The unit to calculate lethal damage for
 * @returns Minimum damage needed to kill the unit
 */
export function calculateLethalDamage(unit: DamageUnit): number {
  return unit.currentHp;
}
