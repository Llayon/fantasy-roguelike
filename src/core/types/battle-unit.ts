/**
 * Battle unit type definitions for the Core 2.0 battle engine.
 * Contains the unified BattleUnit interface with all mechanic-specific properties.
 *
 * @module core/types/battle-unit
 */

import { Position } from './grid.types';

// =============================================================================
// FACING DIRECTION
// =============================================================================

/**
 * Cardinal direction a unit is facing on the battlefield.
 * Determines attack arc and flanking calculations.
 *
 * - 'N' (North): Facing toward row 0 (top of grid)
 * - 'S' (South): Facing toward max row (bottom of grid)
 * - 'E' (East): Facing toward max column (right of grid)
 * - 'W' (West): Facing toward column 0 (left of grid)
 *
 * @example
 * const facing: FacingDirection = 'S'; // Unit facing south
 */
export type FacingDirection = 'N' | 'S' | 'E' | 'W';

// =============================================================================
// UNIT STATS
// =============================================================================

/**
 * Base unit statistics used in battle calculations.
 * These values are typically derived from the unit template.
 *
 * @example
 * const stats: BattleUnitStats = {
 *   hp: 100,
 *   atk: 15,
 *   atkCount: 1,
 *   armor: 20,
 *   speed: 2,
 *   initiative: 10,
 *   dodge: 5,
 * };
 */
export interface BattleUnitStats {
  /** Base hit points */
  hp: number;
  /** Base attack power */
  atk: number;
  /** Number of attacks per turn */
  atkCount: number;
  /** Armor value (reduces physical damage) */
  armor: number;
  /** Movement speed in cells per turn */
  speed: number;
  /** Turn order priority (higher values act first) */
  initiative: number;
  /** Dodge chance percentage (0-100, capped at 50) */
  dodge: number;
}

// =============================================================================
// TEAM & FACTION
// =============================================================================

/**
 * Team affiliation for battle units.
 */
export type TeamType = 'player' | 'enemy';

/**
 * Unit faction determining resolve behavior.
 *
 * - 'human': Retreats (routes) when resolve reaches 0, can rally
 * - 'undead': Crumbles (dies) when resolve reaches 0, no rally
 */
export type UnitFaction = 'human' | 'undead';

// =============================================================================
// BATTLE UNIT INTERFACE
// =============================================================================

/**
 * Battle unit with all Core 2.0 mechanic properties.
 * Single unified type - no conversion layers needed.
 *
 * This interface represents an active unit instance in battle,
 * combining identity, base stats, battle state, and all mechanic-specific properties.
 *
 * @example
 * const knight: BattleUnit = {
 *   // Identity
 *   id: 'knight',
 *   instanceId: 'player_knight_0',
 *   name: 'Knight',
 *   team: 'player',
 *
 *   // Base stats
 *   stats: { hp: 100, atk: 15, atkCount: 1, armor: 20, speed: 2, initiative: 10, dodge: 5 },
 *   range: 1,
 *   role: 'tank',
 *   cost: 5,
 *   abilities: ['shield_wall'],
 *
 *   // Battle state
 *   position: { x: 3, y: 1 },
 *   currentHp: 85,
 *   maxHp: 100,
 *   alive: true,
 *
 *   // Core 2.0 Mechanics
 *   facing: 'S',
 *   resolve: 75,
 *   maxResolve: 100,
 *   isRouting: false,
 *   engaged: true,
 *   engagedBy: ['enemy_rogue_0'],
 *   riposteCharges: 1,
 *   ammo: null,
 *   maxAmmo: null,
 *   momentum: 0,
 *   armorShred: 5,
 *   inPhalanx: false,
 *   tags: ['infantry', 'tank'],
 *   faction: 'human',
 * };
 */
export interface BattleUnit {
  // ===========================================================================
  // IDENTITY
  // ===========================================================================

  /**
   * Unit template identifier.
   * References the base unit definition (e.g., 'knight', 'archer').
   */
  id: string;

  /**
   * Unique instance identifier for this battle.
   * Format: `{team}_{unitId}_{index}` (e.g., 'player_knight_0').
   * Used to track individual units across events and state updates.
   */
  instanceId: string;

  /**
   * Display name for UI rendering.
   */
  name: string;

  /**
   * Team affiliation.
   * Determines targeting rules and win conditions.
   */
  team: TeamType;

  // ===========================================================================
  // BASE STATS
  // ===========================================================================

  /**
   * Base statistics from unit template.
   * These values are typically immutable during battle.
   */
  stats: BattleUnitStats;

  /**
   * Attack range in cells.
   * - 1: Melee (adjacent cells only)
   * - 2+: Ranged (can attack from distance)
   */
  range: number;

  /**
   * Unit role classification.
   * Used by AI for targeting decisions.
   * Common roles: 'tank', 'melee_dps', 'ranged_dps', 'mage', 'support', 'control'
   */
  role: string;

  /**
   * Team budget cost (typically 3-8 points).
   * Used for team composition validation.
   */
  cost: number;

  /**
   * Available ability IDs.
   * References ability definitions in game data.
   */
  abilities: string[];

  // ===========================================================================
  // BATTLE STATE
  // ===========================================================================

  /**
   * Current position on the battlefield grid.
   * Updated during movement phase.
   */
  position: Position;

  /**
   * Current hit points.
   * @invariant 0 <= currentHp <= maxHp
   */
  currentHp: number;

  /**
   * Maximum hit points (equals stats.hp).
   * May be modified by buffs or abilities.
   */
  maxHp: number;

  /**
   * Whether unit is alive and can act.
   * Set to false when currentHp reaches 0.
   * @invariant alive === (currentHp > 0)
   */
  alive: boolean;

  // ===========================================================================
  // CORE 2.0 MECHANICS - TIER 0: FACING
  // ===========================================================================

  /**
   * Current facing direction (Tier 0: Facing mechanic).
   * Determines attack arc for flanking calculations.
   * Updated when unit attacks or uses certain abilities.
   * @invariant facing ∈ {'N', 'S', 'E', 'W'}
   */
  facing: FacingDirection;

  // ===========================================================================
  // CORE 2.0 MECHANICS - TIER 1: RESOLVE & ENGAGEMENT
  // ===========================================================================

  /**
   * Current resolve/morale value (Tier 1: Resolve mechanic).
   * Decreases from ally deaths, flanking attacks, being surrounded.
   * Regenerates at turn start (+5 base, +3 if in phalanx).
   * @invariant 0 <= resolve <= maxResolve
   */
  resolve: number;

  /**
   * Maximum resolve value.
   * Typically 100 for most units.
   */
  maxResolve: number;

  /**
   * Whether unit is currently routing (Tier 1: Resolve mechanic).
   * Routing units can only retreat toward their deployment edge.
   * Human units route when resolve = 0, rally when resolve >= 25.
   */
  isRouting: boolean;

  /**
   * Whether unit is currently engaged in melee (Tier 1: Engagement mechanic).
   * Engaged units cannot move freely and ranged units suffer -50% ATK penalty.
   */
  engaged: boolean;

  /**
   * Instance IDs of units engaging this unit (Tier 1: Engagement mechanic).
   * Used to track Zone of Control and Attack of Opportunity triggers.
   */
  engagedBy: string[];

  // ===========================================================================
  // CORE 2.0 MECHANICS - TIER 2: RIPOSTE
  // ===========================================================================

  /**
   * Remaining riposte charges this round (Tier 2: Riposte mechanic).
   * Allows counter-attack when attacked from front arc.
   * Reset to max at turn_start phase.
   * @invariant riposteCharges >= 0
   */
  riposteCharges: number;

  // ===========================================================================
  // CORE 2.0 MECHANICS - TIER 3: AMMUNITION, CHARGE, PHALANX
  // ===========================================================================

  /**
   * Current ammunition count (Tier 3: Ammunition mechanic).
   * - null: Unlimited (melee units)
   * - number: Remaining shots/spells
   * When ammo = 0, ranged units switch to melee fallback.
   * @invariant ammo === null || ammo >= 0
   */
  ammo: number | null;

  /**
   * Maximum ammunition capacity.
   * - null: Unlimited (melee units)
   * - number: Max shots/spells
   */
  maxAmmo: number | null;

  /**
   * Current charge momentum (Tier 3: Charge mechanic).
   * Builds up during movement, adds damage bonus on attack.
   * Formula: bonusDamage = baseDamage * momentum
   * Max momentum = 1.0 (100% bonus damage).
   * @invariant 0 <= momentum <= 1.0
   */
  momentum: number;

  /**
   * Whether unit is currently in a charge state (Tier 3: Charge mechanic).
   * Set when unit moves minimum distance and has charge capability.
   */
  isCharging?: boolean;

  /**
   * Distance moved this turn for charge calculation (Tier 3: Charge mechanic).
   * Reset at turn start.
   */
  chargeDistance?: number;

  /**
   * Starting position at turn start for charge calculation (Tier 3: Charge mechanic).
   */
  chargeStartPosition?: Position;

  /**
   * Whether unit's charge was countered this turn (Tier 3: Charge mechanic).
   * Set when stopped by Spear Wall.
   */
  chargeCountered?: boolean;

  /**
   * Whether unit is currently in phalanx formation (Tier 3: Phalanx mechanic).
   * True when 2+ allies are orthogonally adjacent.
   * Provides armor bonus (+2 per ally) and resolve bonus (+3 per ally).
   */
  inPhalanx: boolean;

  // ===========================================================================
  // CORE 2.0 MECHANICS - TIER 4: ARMOR SHRED
  // ===========================================================================

  /**
   * Accumulated armor shred on this unit (Tier 4: Armor Shred mechanic).
   * Reduces effective armor: effectiveArmor = max(0, armor - armorShred).
   * Decays by 2 at turn_end. Undead units don't decay.
   * @invariant armorShred >= 0
   */
  armorShred: number;

  // ===========================================================================
  // UNIT CLASSIFICATION
  // ===========================================================================

  /**
   * Unit classification tags for mechanic interactions.
   * Common tags:
   * - 'infantry': Standard foot soldier
   * - 'cavalry': Can perform charge attacks, countered by spear_wall
   * - 'spearman': Has spear_wall ability to counter cavalry
   * - 'ranged': Uses ranged attacks, affected by engagement penalty
   * - 'mage': Uses magic abilities with cooldowns
   * - 'heavy': Reduced knockback/displacement effects
   * - 'light': Increased mobility options
   * - 'undead': Crumbles instead of routing, no shred decay
   */
  tags: string[];

  /**
   * Unit faction determining resolve behavior.
   * - 'human': Routes when resolve = 0, can rally at resolve >= 25
   * - 'undead': Crumbles (dies) when resolve = 0, no rally possible
   */
  faction: UnitFaction;
}
