/**
 * Game-specific constants for Fantasy Roguelike.
 * Contains team limits, unit roles, matchmaking parameters.
 *
 * @module game/constants
 */

// =============================================================================
// TEAM BUILDING CONSTANTS
// =============================================================================

/**
 * Team composition limits and budget.
 */
export const TEAM_LIMITS = {
  /** Maximum team budget in points */
  BUDGET: 30,
  /** Minimum unit cost in points */
  MIN_UNIT_COST: 3,
  /** Maximum unit cost in points */
  MAX_UNIT_COST: 8,
  /** Maximum units per team (limited by budget only) */
  MAX_UNITS: 10,
} as const;

// =============================================================================
// UNIT ROLES & DISTRIBUTION
// =============================================================================

/**
 * Unit role definitions.
 */
export const UNIT_ROLES = {
  TANK: 'tank',
  MELEE_DPS: 'melee_dps',
  RANGED_DPS: 'ranged_dps',
  MAGE: 'mage',
  SUPPORT: 'support',
  CONTROL: 'control',
} as const;

/**
 * Unit role type derived from constants.
 */
export type UnitRole = (typeof UNIT_ROLES)[keyof typeof UNIT_ROLES];

/**
 * Expected unit count per role (total 15 units).
 */
export const ROLE_DISTRIBUTION = {
  [UNIT_ROLES.TANK]: 3,
  [UNIT_ROLES.MELEE_DPS]: 3,
  [UNIT_ROLES.RANGED_DPS]: 3,
  [UNIT_ROLES.MAGE]: 3,
  [UNIT_ROLES.SUPPORT]: 2,
  [UNIT_ROLES.CONTROL]: 1,
} as const;

// =============================================================================
// UNIT STAT RANGES
// =============================================================================

/**
 * Valid ranges for unit statistics.
 */
export const UNIT_STAT_RANGES = {
  HP: { MIN: 40, MAX: 150 },
  ATK: { MIN: 8, MAX: 30 },
  ATK_COUNT: { MIN: 1, MAX: 3 },
  ARMOR: { MIN: 0, MAX: 12 },
  SPEED: { MIN: 1, MAX: 5 },
  INITIATIVE: { MIN: 3, MAX: 10 },
  DODGE: { MIN: 0, MAX: 25 },
  RANGE: { MIN: 1, MAX: 5 },
} as const;

// =============================================================================
// ABILITY SYSTEM CONSTANTS
// =============================================================================

/**
 * Ability system parameters.
 */
export const ABILITY_CONSTANTS = {
  MAX_COOLDOWN: 5,
  MAX_RANGE: 5,
  MAX_AOE_RADIUS: 2,
  DEFAULT_DURATION: 3,
} as const;

/**
 * Ability effect value ranges.
 */
export const ABILITY_EFFECT_RANGES = {
  DAMAGE: { MIN: 15, MAX: 50 },
  HEAL: { MIN: 20, MAX: 40 },
  BUFF_PERCENT: { MIN: 10, MAX: 50 },
  STUN_DURATION: { MIN: 1, MAX: 2 },
} as const;

// =============================================================================
// MATCHMAKING CONSTANTS
// =============================================================================

/**
 * Matchmaking system parameters.
 */
export const MATCHMAKING_CONSTANTS = {
  DEFAULT_ELO: 1200,
  MIN_ELO: 800,
  MAX_ELO: 2400,
  ELO_K_FACTOR: 32,
  MAX_QUEUE_TIME_MINUTES: 5,
  MAX_RATING_DIFFERENCE: 200,
  RATING_EXPANSION_PER_MINUTE: 50,
  MIN_PLAYERS_FOR_MATCH: 2,
  QUEUE_CLEANUP_INTERVAL_MINUTES: 1,
} as const;

// =============================================================================
// PERFORMANCE CONSTANTS
// =============================================================================

/**
 * Performance and optimization parameters.
 */
export const PERFORMANCE_CONSTANTS = {
  TARGET_SIMULATION_TIME_MS: 100,
  MAX_BATTLE_EVENTS: 1000,
  DB_QUERY_TIMEOUT_MS: 5000,
} as const;

// =============================================================================
// GAMEPLAY VALUES
// =============================================================================

/**
 * Specific gameplay values.
 */
export const GAMEPLAY_VALUES = {
  HEAL_AMOUNT: 15,
  MVP_TEAM_SIZE: 3,
  BATTLE_HISTORY_LIMIT: 10,
} as const;

// =============================================================================
// COST CALCULATION CONSTANTS
// =============================================================================

/**
 * Unit cost calculation weights.
 */
export const COST_CALCULATION_WEIGHTS = {
  HP_DIVISOR: 20,
  ATK_DIVISOR: 10,
  ARMOR_DIVISOR: 2,
  MOBILITY_DIVISOR: 4,
  DODGE_DIVISOR: 5,
  RANGE_MULTIPLIER: 0.5,
  NORMALIZATION_COEFFICIENT: 0.8,
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Ability type enumeration.
 */
export const ABILITY_TYPES = {
  ACTIVE: 'active',
  PASSIVE: 'passive',
} as const;

export type AbilityType = (typeof ABILITY_TYPES)[keyof typeof ABILITY_TYPES];

/**
 * Ability target type enumeration.
 */
export const ABILITY_TARGET_TYPES = {
  SELF: 'self',
  ALLY: 'ally',
  ENEMY: 'enemy',
  AREA: 'area',
} as const;

export type AbilityTargetType = (typeof ABILITY_TARGET_TYPES)[keyof typeof ABILITY_TARGET_TYPES];

/**
 * Ability effect type enumeration.
 */
export const ABILITY_EFFECT_TYPES = {
  DAMAGE: 'damage',
  HEAL: 'heal',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  SUMMON: 'summon',
  TELEPORT: 'teleport',
  STUN: 'stun',
} as const;

export type AbilityEffectType = (typeof ABILITY_EFFECT_TYPES)[keyof typeof ABILITY_EFFECT_TYPES];
