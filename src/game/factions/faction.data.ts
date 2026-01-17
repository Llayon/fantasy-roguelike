/**
 * Faction Definitions for Fantasy Roguelike.
 * Contains faction data for roguelike mode.
 *
 * @fileoverview Faction definitions with unique mechanics and unit pools.
 */

import { UnitId } from '../units/unit.data';

// =============================================================================
// FACTION TYPES
// =============================================================================

/**
 * All available faction IDs in the game.
 */
export type FactionId =
  | 'human_kingdom'
  | 'undead_legion'
  | 'elven_court'
  | 'orcish_horde'
  | 'dwarven_hold'
  | 'demon_host';

/**
 * Faction resolve behavior type.
 */
export type FactionBehavior = 'retreat' | 'crumble' | 'berserk' | 'rally';

/**
 * Faction definition interface.
 */
export interface Faction {
  /** Unique faction identifier */
  id: FactionId;
  /** Display name */
  name: string;
  /** Faction description */
  description: string;
  /** Resolve behavior when morale breaks */
  behavior: FactionBehavior;
  /** Available unit IDs for this faction */
  unitPool: UnitId[];
  /** Faction-specific bonuses */
  bonuses: FactionBonus[];
  /** Faction color for UI */
  color: string;
  /** Faction icon identifier */
  icon: string;
}

/**
 * Faction bonus definition.
 */
export interface FactionBonus {
  /** Bonus type */
  type: 'stat' | 'ability' | 'synergy';
  /** Bonus description */
  description: string;
  /** Stat to modify (for stat bonuses) */
  stat?: string;
  /** Bonus value (percentage or flat) */
  value: number;
  /** Whether value is percentage */
  isPercentage: boolean;
}

// =============================================================================
// FACTION DATABASE
// =============================================================================

/**
 * Complete faction database.
 * Each faction has unique units, bonuses, and resolve behavior.
 */
export const FACTIONS: Record<FactionId, Faction> = {
  human_kingdom: {
    id: 'human_kingdom',
    name: 'Королевство Людей',
    description: 'Сбалансированная фракция с сильной защитой и поддержкой',
    behavior: 'retreat',
    unitPool: [
      'knight',
      'guardian',
      'archer',
      'crossbowman',
      'priest',
      'bard',
      'mage',
      'enchanter',
    ],
    bonuses: [
      {
        type: 'stat',
        description: '+10% к броне для всех юнитов',
        stat: 'armor',
        value: 10,
        isPercentage: true,
      },
    ],
    color: '#4A90D9',
    icon: 'crown',
  },

  undead_legion: {
    id: 'undead_legion',
    name: 'Легион Нежити',
    description: 'Агрессивная фракция, юниты рассыпаются при потере морали',
    behavior: 'crumble',
    unitPool: ['berserker', 'assassin', 'rogue', 'warlock', 'elementalist', 'enchanter'],
    bonuses: [
      {
        type: 'stat',
        description: '+15% к атаке для всех юнитов',
        stat: 'attack',
        value: 15,
        isPercentage: true,
      },
      {
        type: 'ability',
        description: 'Иммунитет к страху',
        value: 0,
        isPercentage: false,
      },
    ],
    color: '#6B4C9A',
    icon: 'skull',
  },

  elven_court: {
    id: 'elven_court',
    name: 'Эльфийский Двор',
    description: 'Быстрая фракция с высокой инициативой и уклонением',
    behavior: 'retreat',
    unitPool: ['archer', 'hunter', 'rogue', 'duelist', 'mage', 'elementalist', 'priest', 'bard'],
    bonuses: [
      {
        type: 'stat',
        description: '+20% к уклонению для всех юнитов',
        stat: 'dodge',
        value: 20,
        isPercentage: true,
      },
      {
        type: 'stat',
        description: '+1 к инициативе для всех юнитов',
        stat: 'initiative',
        value: 1,
        isPercentage: false,
      },
    ],
    color: '#2ECC71',
    icon: 'leaf',
  },

  orcish_horde: {
    id: 'orcish_horde',
    name: 'Орочья Орда',
    description: 'Агрессивная фракция, впадает в ярость при низкой морали',
    behavior: 'berserk',
    unitPool: ['berserker', 'knight', 'guardian', 'rogue', 'assassin', 'hunter'],
    bonuses: [
      {
        type: 'stat',
        description: '+20% к HP для всех юнитов',
        stat: 'hp',
        value: 20,
        isPercentage: true,
      },
      {
        type: 'ability',
        description: '+30% к атаке при HP ниже 30%',
        value: 30,
        isPercentage: true,
      },
    ],
    color: '#E74C3C',
    icon: 'axe',
  },

  dwarven_hold: {
    id: 'dwarven_hold',
    name: 'Гномья Твердыня',
    description: 'Защитная фракция с высокой броней и стойкостью',
    behavior: 'rally',
    unitPool: ['knight', 'guardian', 'crossbowman', 'priest', 'enchanter', 'warlock'],
    bonuses: [
      {
        type: 'stat',
        description: '+25% к броне для всех юнитов',
        stat: 'armor',
        value: 25,
        isPercentage: true,
      },
      {
        type: 'synergy',
        description: 'Фаланга: +10% к броне при 3+ танках',
        value: 10,
        isPercentage: true,
      },
    ],
    color: '#F39C12',
    icon: 'hammer',
  },

  demon_host: {
    id: 'demon_host',
    name: 'Демоническое Воинство',
    description: 'Магическая фракция с мощными AoE способностями',
    behavior: 'crumble',
    unitPool: ['mage', 'warlock', 'elementalist', 'enchanter', 'assassin', 'berserker'],
    bonuses: [
      {
        type: 'stat',
        description: '+25% к магической атаке',
        stat: 'attack',
        value: 25,
        isPercentage: true,
      },
      {
        type: 'ability',
        description: 'Магические атаки игнорируют 25% брони',
        value: 25,
        isPercentage: true,
      },
    ],
    color: '#9B59B6',
    icon: 'flame',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get faction by ID.
 *
 * @param factionId - The faction ID to retrieve
 * @returns Faction definition or undefined if not found
 * @example
 * const humans = getFaction('human_kingdom');
 * console.log(humans?.name); // 'Королевство Людей'
 */
export function getFaction(factionId: FactionId): Faction | undefined {
  return FACTIONS[factionId];
}

/**
 * Get all faction IDs.
 *
 * @returns Array of all faction IDs
 * @example
 * const allFactions = getAllFactionIds();
 * console.log(allFactions.length); // 6
 */
export function getAllFactionIds(): FactionId[] {
  return Object.keys(FACTIONS) as FactionId[];
}

/**
 * Get factions by behavior type.
 *
 * @param behavior - The behavior type to filter by
 * @returns Array of factions with the specified behavior
 * @example
 * const retreatFactions = getFactionsByBehavior('retreat');
 * console.log(retreatFactions.length); // 2
 */
export function getFactionsByBehavior(behavior: FactionBehavior): Faction[] {
  return Object.values(FACTIONS).filter((faction) => faction.behavior === behavior);
}

/**
 * Check if unit is available in faction.
 *
 * @param factionId - The faction ID to check
 * @param unitId - The unit ID to check
 * @returns True if unit is in faction's unit pool
 * @example
 * const hasKnight = isUnitInFaction('human_kingdom', 'knight'); // true
 */
export function isUnitInFaction(factionId: FactionId, unitId: UnitId): boolean {
  const faction = getFaction(factionId);
  return faction ? faction.unitPool.includes(unitId) : false;
}

/**
 * Get all units available to a faction.
 *
 * @param factionId - The faction ID
 * @returns Array of unit IDs available to the faction
 * @example
 * const humanUnits = getFactionUnits('human_kingdom');
 * console.log(humanUnits.length); // 8
 */
export function getFactionUnits(factionId: FactionId): UnitId[] {
  const faction = getFaction(factionId);
  return faction ? [...faction.unitPool] : [];
}

/**
 * Get faction bonuses.
 *
 * @param factionId - The faction ID
 * @returns Array of faction bonuses
 * @example
 * const bonuses = getFactionBonuses('human_kingdom');
 * console.log(bonuses[0].description); // '+10% к броне для всех юнитов'
 */
export function getFactionBonuses(factionId: FactionId): FactionBonus[] {
  const faction = getFaction(factionId);
  return faction ? [...faction.bonuses] : [];
}
