/**
 * Ability Definitions for Fantasy Roguelike.
 * Contains all 15 unit abilities with complete parameters from GDD.
 *
 * @fileoverview Complete ability database with definitions for all units.
 * Each ability is a fully typed object with effects, targeting, and cooldowns.
 */

import {
  Ability,
  ActiveAbility,
  PassiveAbility,
  AbilityId,
  AbilityEffect,
  isActiveAbility,
  isPassiveAbility,
} from '../types/ability.types';

// =============================================================================
// ABILITY ID TYPE
// =============================================================================

/**
 * All available ability IDs in the game.
 * One ability per unit (15 total).
 */
export type GameAbilityId =
  // Tank abilities
  | 'shield_wall' // Knight
  | 'taunt' // Guardian
  | 'rage' // Berserker
  // Melee DPS abilities
  | 'backstab' // Rogue
  | 'riposte' // Duelist
  | 'execute' // Assassin
  // Ranged DPS abilities
  | 'volley' // Archer
  | 'piercing_shot' // Crossbowman
  | 'trap' // Hunter
  // Mage abilities
  | 'fireball' // Mage
  | 'drain_life' // Warlock
  | 'chain_lightning' // Elementalist
  // Support abilities
  | 'heal' // Priest
  | 'inspire' // Bard
  // Control abilities
  | 'stun'; // Enchanter

// =============================================================================
// TANK ABILITIES (3)
// =============================================================================

/**
 * Shield Wall - Knight's defensive ability.
 * Increases armor by 50% for 2 turns.
 */
const shieldWall: ActiveAbility = {
  id: 'shield_wall',
  name: 'Стена щитов',
  description: 'Увеличивает броню на 50% на 2 хода',
  type: 'active',
  targetType: 'self',
  cooldown: 3,
  range: 0,
  effects: [
    {
      type: 'buff',
      stat: 'armor',
      percentage: 0.5,
      duration: 2,
      stackable: false,
    },
  ],
  icon: 'shield',
};

/**
 * Taunt - Guardian's crowd control ability.
 * Forces all enemies to attack this unit for 2 turns.
 */
const taunt: ActiveAbility = {
  id: 'taunt',
  name: 'Провокация',
  description: 'Враги атакуют только этого юнита 2 хода',
  type: 'active',
  targetType: 'self',
  cooldown: 4,
  range: 0,
  effects: [
    {
      type: 'taunt',
      duration: 2,
    },
  ],
  icon: 'taunt',
};

/**
 * Rage - Berserker's passive damage boost.
 * Gains +50% attack when HP falls below 50%.
 */
const rage: PassiveAbility = {
  id: 'rage',
  name: 'Ярость',
  description: '+50% к атаке при HP ниже 50%',
  type: 'passive',
  targetType: 'self',
  trigger: 'on_low_hp',
  triggerThreshold: 50,
  range: 0,
  effects: [
    {
      type: 'buff',
      stat: 'attack',
      percentage: 0.5,
      duration: 999,
      stackable: false,
    },
  ],
  icon: 'rage',
};

// =============================================================================
// MELEE DPS ABILITIES (3)
// =============================================================================

/**
 * Backstab - Rogue's positional damage ability.
 * Deals +100% damage when attacking from behind.
 */
const backstab: PassiveAbility = {
  id: 'backstab',
  name: 'Удар в спину',
  description: '+100% урона при атаке сзади',
  type: 'passive',
  targetType: 'enemy',
  trigger: 'on_attack',
  range: 1,
  effects: [
    {
      type: 'damage',
      value: 0,
      damageType: 'physical',
      attackScaling: 1.0,
    },
  ],
  icon: 'dagger',
};

/**
 * Riposte - Duelist's counter-attack ability.
 * Has 30% chance to counter-attack when hit.
 */
const riposte: PassiveAbility = {
  id: 'riposte',
  name: 'Рипост',
  description: '30% шанс контратаки при получении урона',
  type: 'passive',
  targetType: 'enemy',
  trigger: 'on_hit',
  range: 1,
  effects: [
    {
      type: 'damage',
      value: 0,
      damageType: 'physical',
      attackScaling: 0.75,
      chance: 30,
    },
  ],
  icon: 'sword',
};

/**
 * Execute - Assassin's finishing ability.
 * Deals +100% damage to targets below 30% HP.
 */
const execute: PassiveAbility = {
  id: 'execute',
  name: 'Казнь',
  description: '+100% урона по целям с HP ниже 30%',
  type: 'passive',
  targetType: 'lowest_hp_enemy',
  trigger: 'on_attack',
  triggerThreshold: 30,
  range: 1,
  effects: [
    {
      type: 'damage',
      value: 0,
      damageType: 'physical',
      attackScaling: 1.0,
    },
  ],
  icon: 'skull',
};

// =============================================================================
// RANGED DPS ABILITIES (3)
// =============================================================================

/**
 * Volley - Archer's area damage ability.
 * Fires arrows at all enemies in a 2-cell radius.
 */
const volley: ActiveAbility = {
  id: 'volley',
  name: 'Залп',
  description: 'Наносит урон всем врагам в радиусе 2 клеток',
  type: 'active',
  targetType: 'area',
  cooldown: 3,
  range: 4,
  areaSize: 2,
  effects: [
    {
      type: 'damage',
      value: 12,
      damageType: 'physical',
      attackScaling: 0.5,
    },
  ],
  icon: 'arrows',
};

/**
 * Piercing Shot - Crossbowman's armor-penetrating ability.
 * Ignores 50% of target's armor.
 */
const piercingShot: ActiveAbility = {
  id: 'piercing_shot',
  name: 'Пробивающий выстрел',
  description: 'Игнорирует 50% брони цели',
  type: 'active',
  targetType: 'enemy',
  cooldown: 2,
  range: 5,
  effects: [
    {
      type: 'damage',
      value: 25,
      damageType: 'physical',
      attackScaling: 0.8,
    },
    {
      type: 'debuff',
      stat: 'armor',
      percentage: 0.5,
      duration: 0,
    },
  ],
  icon: 'crossbow',
};

/**
 * Trap - Hunter's control ability.
 * Places a trap that stuns the first enemy to step on it.
 */
const trap: ActiveAbility = {
  id: 'trap',
  name: 'Ловушка',
  description: 'Устанавливает ловушку, оглушающую врага на 1 ход',
  type: 'active',
  targetType: 'area',
  cooldown: 4,
  range: 3,
  areaSize: 1,
  effects: [
    {
      type: 'stun',
      duration: 1,
    },
    {
      type: 'damage',
      value: 10,
      damageType: 'physical',
    },
  ],
  icon: 'trap',
};

// =============================================================================
// MAGE ABILITIES (3)
// =============================================================================

/**
 * Fireball - Mage's signature AoE ability.
 * Deals magic damage in a 1-cell radius.
 */
const fireball: ActiveAbility = {
  id: 'fireball',
  name: 'Огненный шар',
  description: 'Наносит 30 магического урона в радиусе 1 клетки',
  type: 'active',
  targetType: 'area',
  cooldown: 2,
  range: 3,
  areaSize: 1,
  effects: [
    {
      type: 'damage',
      value: 30,
      damageType: 'magical',
      attackScaling: 0.6,
    },
  ],
  icon: 'fireball',
};

/**
 * Drain Life - Warlock's sustain ability.
 * Deals damage and heals for 50% of damage dealt.
 */
const drainLife: ActiveAbility = {
  id: 'drain_life',
  name: 'Похищение жизни',
  description: 'Наносит урон и восстанавливает 50% от нанесённого урона',
  type: 'active',
  targetType: 'enemy',
  cooldown: 3,
  range: 3,
  effects: [
    {
      type: 'damage',
      value: 20,
      damageType: 'magical',
      attackScaling: 0.7,
    },
    {
      type: 'heal',
      value: 0,
      attackScaling: 0.35,
    },
  ],
  icon: 'drain',
};

/**
 * Chain Lightning - Elementalist's multi-target ability.
 * Hits primary target and chains to 2 nearby enemies.
 */
const chainLightning: ActiveAbility = {
  id: 'chain_lightning',
  name: 'Цепная молния',
  description: 'Поражает цель и перескакивает на 2 ближайших врагов',
  type: 'active',
  targetType: 'enemy',
  cooldown: 3,
  range: 4,
  effects: [
    {
      type: 'damage',
      value: 35,
      damageType: 'magical',
      attackScaling: 0.8,
    },
  ],
  icon: 'lightning',
};

// =============================================================================
// SUPPORT ABILITIES (2)
// =============================================================================

/**
 * Heal - Priest's healing ability.
 * Restores 25 HP to an allied unit.
 */
const heal: ActiveAbility = {
  id: 'heal',
  name: 'Исцеление',
  description: 'Восстанавливает 25 HP союзнику',
  type: 'active',
  targetType: 'lowest_hp_ally',
  cooldown: 2,
  range: 3,
  effects: [
    {
      type: 'heal',
      value: 25,
      attackScaling: 0.5,
      canOverheal: false,
    },
  ],
  icon: 'heal',
};

/**
 * Inspire - Bard's buff ability.
 * Increases attack of all allies by 20% for 2 turns.
 */
const inspire: ActiveAbility = {
  id: 'inspire',
  name: 'Вдохновение',
  description: '+20% к атаке всех союзников на 2 хода',
  type: 'active',
  targetType: 'all_allies',
  cooldown: 4,
  range: 0,
  effects: [
    {
      type: 'buff',
      stat: 'attack',
      percentage: 0.2,
      duration: 2,
      stackable: false,
    },
  ],
  icon: 'music',
};

// =============================================================================
// CONTROL ABILITIES (1)
// =============================================================================

/**
 * Stun - Enchanter's crowd control ability.
 * Target skips their next turn.
 */
const stun: ActiveAbility = {
  id: 'stun',
  name: 'Оглушение',
  description: 'Цель пропускает следующий ход',
  type: 'active',
  targetType: 'enemy',
  cooldown: 3,
  range: 3,
  effects: [
    {
      type: 'stun',
      duration: 1,
    },
  ],
  icon: 'stun',
};

// =============================================================================
// ABILITY DATABASE
// =============================================================================

/**
 * Complete ability database with all 15 unit abilities.
 * Indexed by ability ID for quick lookup.
 */
export const ABILITIES: Record<GameAbilityId, Ability> = {
  // Tank abilities
  shield_wall: shieldWall,
  taunt: taunt,
  rage: rage,
  // Melee DPS abilities
  backstab: backstab,
  riposte: riposte,
  execute: execute,
  // Ranged DPS abilities
  volley: volley,
  piercing_shot: piercingShot,
  trap: trap,
  // Mage abilities
  fireball: fireball,
  drain_life: drainLife,
  chain_lightning: chainLightning,
  // Support abilities
  heal: heal,
  inspire: inspire,
  // Control abilities
  stun: stun,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get ability by ID.
 *
 * @param abilityId - The ability ID to retrieve
 * @returns Ability definition or undefined if not found
 * @example
 * const fireball = getAbility('fireball');
 * console.log(fireball?.name); // 'Огненный шар'
 */
export function getAbility(abilityId: AbilityId): Ability | undefined {
  return ABILITIES[abilityId as GameAbilityId];
}

/**
 * Get all active abilities.
 *
 * @returns Array of all active abilities
 * @example
 * const activeAbilities = getActiveAbilities();
 * console.log(activeAbilities.length); // 11
 */
export function getActiveAbilities(): ActiveAbility[] {
  return Object.values(ABILITIES).filter(isActiveAbility);
}

/**
 * Get all passive abilities.
 *
 * @returns Array of all passive abilities
 * @example
 * const passiveAbilities = getPassiveAbilities();
 * console.log(passiveAbilities.length); // 4
 */
export function getPassiveAbilities(): PassiveAbility[] {
  return Object.values(ABILITIES).filter(isPassiveAbility);
}

/**
 * Get all ability IDs.
 *
 * @returns Array of all ability IDs
 * @example
 * const allIds = getAllAbilityIds();
 * console.log(allIds.length); // 15
 */
export function getAllAbilityIds(): GameAbilityId[] {
  return Object.keys(ABILITIES) as GameAbilityId[];
}

/**
 * Check if ability exists.
 *
 * @param abilityId - The ability ID to check
 * @returns True if ability exists
 * @example
 * const exists = hasAbility('fireball'); // true
 * const notExists = hasAbility('unknown'); // false
 */
export function hasAbility(abilityId: string): abilityId is GameAbilityId {
  return abilityId in ABILITIES;
}

/**
 * Get abilities by effect type.
 *
 * @param effectType - The effect type to filter by
 * @returns Array of abilities containing the specified effect type
 * @example
 * const healingAbilities = getAbilitiesByEffectType('heal');
 * console.log(healingAbilities.map(a => a.id)); // ['heal', 'drain_life']
 */
export function getAbilitiesByEffectType(
  effectType: AbilityEffect['type'],
): Ability[] {
  return Object.values(ABILITIES).filter((ability) =>
    ability.effects.some((effect) => effect.type === effectType),
  );
}

/**
 * Get abilities by target type.
 *
 * @param targetType - The target type to filter by
 * @returns Array of abilities with the specified target type
 * @example
 * const selfAbilities = getAbilitiesByTargetType('self');
 * console.log(selfAbilities.map(a => a.id)); // ['shield_wall', 'taunt', 'rage']
 */
export function getAbilitiesByTargetType(
  targetType: Ability['targetType'],
): Ability[] {
  return Object.values(ABILITIES).filter(
    (ability) => ability.targetType === targetType,
  );
}

/**
 * Calculate ability cooldown reduction.
 *
 * @param baseCooldown - The base cooldown value
 * @param reduction - Reduction amount (flat or percentage)
 * @param isPercentage - Whether reduction is percentage-based
 * @returns Reduced cooldown (minimum 1)
 * @example
 * const reduced = calculateCooldownReduction(4, 1, false); // 3
 */
export function calculateCooldownReduction(
  baseCooldown: number,
  reduction: number,
  isPercentage: boolean = false,
): number {
  if (isPercentage) {
    return Math.max(1, Math.floor(baseCooldown * (1 - reduction)));
  }
  return Math.max(1, baseCooldown - reduction);
}

/**
 * Get ability description with formatted values.
 *
 * @param ability - The ability to format
 * @returns Formatted description string
 * @example
 * const desc = getFormattedDescription(ABILITIES.fireball);
 */
export function getFormattedDescription(ability: Ability): string {
  return ability.description;
}

/**
 * Check if ability is on cooldown.
 *
 * @param currentCooldown - Current cooldown remaining
 * @returns True if ability is on cooldown
 * @example
 * const onCooldown = isOnCooldown(2); // true
 */
export function isOnCooldown(currentCooldown: number): boolean {
  return currentCooldown > 0;
}

/**
 * Check if ability can target a specific position.
 *
 * @param ability - The ability to check
 * @param casterX - Caster X position
 * @param casterY - Caster Y position
 * @param targetX - Target X position
 * @param targetY - Target Y position
 * @returns True if target is within ability range
 * @example
 * const canTarget = isInAbilityRange(ABILITIES.fireball, 0, 0, 2, 2);
 */
export function isInAbilityRange(
  ability: Ability,
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
): boolean {
  if (ability.targetType === 'self') {
    return true;
  }

  if (
    ability.targetType === 'all_allies' ||
    ability.targetType === 'all_enemies'
  ) {
    return true;
  }

  if (ability.range === -1) {
    return true;
  }

  const distance = Math.abs(targetX - casterX) + Math.abs(targetY - casterY);
  return distance <= ability.range;
}

// =============================================================================
// UNIT-ABILITY MAPPING
// =============================================================================

/**
 * Mapping of unit IDs to their ability IDs.
 * Each unit has exactly one ability.
 */
export const UNIT_ABILITY_MAP: Record<string, GameAbilityId> = {
  // Tanks
  knight: 'shield_wall',
  guardian: 'taunt',
  berserker: 'rage',
  // Melee DPS
  rogue: 'backstab',
  duelist: 'riposte',
  assassin: 'execute',
  // Ranged DPS
  archer: 'volley',
  crossbowman: 'piercing_shot',
  hunter: 'trap',
  // Mages
  mage: 'fireball',
  warlock: 'drain_life',
  elementalist: 'chain_lightning',
  // Support
  priest: 'heal',
  bard: 'inspire',
  // Control
  enchanter: 'stun',
};

/**
 * Get ability for a specific unit.
 *
 * @param unitId - The unit ID to get ability for
 * @returns Ability definition or undefined if unit has no ability
 * @example
 * const knightAbility = getUnitAbility('knight');
 * console.log(knightAbility?.name); // 'Стена щитов'
 */
export function getUnitAbility(unitId: string): Ability | undefined {
  const abilityId = UNIT_ABILITY_MAP[unitId];
  if (!abilityId) {
    return undefined;
  }
  return ABILITIES[abilityId];
}

/**
 * Check if unit has an active ability.
 *
 * @param unitId - The unit ID to check
 * @returns True if unit has an active ability
 * @example
 * const hasActive = unitHasActiveAbility('mage'); // true
 */
export function unitHasActiveAbility(unitId: string): boolean {
  const ability = getUnitAbility(unitId);
  return ability !== undefined && isActiveAbility(ability);
}

/**
 * Check if unit has a passive ability.
 *
 * @param unitId - The unit ID to check
 * @returns True if unit has a passive ability
 * @example
 * const hasPassive = unitHasPassiveAbility('rogue'); // true
 */
export function unitHasPassiveAbility(unitId: string): boolean {
  const ability = getUnitAbility(unitId);
  return ability !== undefined && isPassiveAbility(ability);
}
