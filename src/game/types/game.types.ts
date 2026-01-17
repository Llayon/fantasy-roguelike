/**
 * Game-specific type definitions for Fantasy Roguelike.
 * Contains unit templates, roles, and battle unit types.
 *
 * @module game/types
 */

import { Position } from '../../core/types/grid.types';
import { UNIT_ROLES, UnitRole } from '../constants/game.constants';

// Re-export for convenience
export { UNIT_ROLES, UnitRole };

// =============================================================================
// TEAM TYPES
// =============================================================================

/**
 * Team affiliation for battle units.
 */
export type TeamType = 'player' | 'enemy';

/**
 * Battle outcome.
 */
export type BattleWinner = 'player' | 'enemy' | 'draw';

// =============================================================================
// UNIT STATS
// =============================================================================

/**
 * Base unit statistics.
 */
export interface UnitStats {
  /** Hit points */
  hp: number;
  /** Attack power */
  atk: number;
  /** Number of attacks per turn */
  atkCount: number;
  /** Armor (reduces physical damage) */
  armor: number;
  /** Movement speed (cells per turn) */
  speed: number;
  /** Turn order priority (higher = first) */
  initiative: number;
  /** Dodge chance percentage (0-100) */
  dodge: number;
}

// =============================================================================
// FACING DIRECTION
// =============================================================================

/**
 * Cardinal direction for unit facing.
 */
export type FacingDirection = 'N' | 'S' | 'E' | 'W';

// =============================================================================
// UNIT TEMPLATE
// =============================================================================

/**
 * Unit template definition from game data.
 * Immutable blueprint for creating unit instances.
 */
export interface UnitTemplate {
  /** Unique unit identifier */
  id: string;
  /** Display name */
  name: string;
  /** Unit role classification */
  role: UnitRole;
  /** Team budget cost (3-8 points) */
  cost: number;
  /** Base statistics */
  stats: UnitStats;
  /** Attack range in cells */
  range: number;
  /** Available ability IDs */
  abilities: string[];

  // =========================================================================
  // MECHANICS 2.0 EXTENSIONS (Roguelike mode)
  // =========================================================================

  /**
   * Initial facing direction (Tier 0: Facing mechanic).
   * Defaults to 'S' (South) for player units, 'N' (North) for enemy units.
   */
  facing?: FacingDirection;

  /**
   * Base resolve/morale value (Tier 1: Resolve mechanic).
   * Higher resolve = more resistant to morale damage.
   * Defaults to 100 if not specified.
   */
  resolve?: number;

  /**
   * Unit faction for resolve behavior (Tier 1: Resolve mechanic).
   * - 'human': Retreats when resolve reaches 0
   * - 'undead': Crumbles when resolve reaches 0
   * Defaults to 'human' if not specified.
   */
  faction?: 'human' | 'undead' | string;

  /**
   * Unit classification tags (Tier 2+: Various mechanics).
   * Common tags:
   * - 'melee': Close combat unit
   * - 'ranged': Uses ranged attacks (affected by engagement penalty)
   * - 'mage': Uses magic (cooldowns instead of ammo)
   * - 'cavalry': Can perform charge attacks with momentum
   * - 'spear_wall': Can counter cavalry charges
   * - 'phalanx': Can form defensive formations
   * - 'heavy': Reduced knockback/displacement
   * - 'light': Increased mobility
   */
  tags?: string[];

  /**
   * Base ammunition count for ranged units (Tier 3: Ammunition mechanic).
   * Only used by units with 'ranged' tag.
   */
  ammo?: number;

  /**
   * Base riposte charges per round (Tier 2: Riposte mechanic).
   * Defaults to unit's atkCount if not specified.
   */
  riposteCharges?: number;
}

// =============================================================================
// BATTLE UNIT
// =============================================================================

/**
 * Active unit instance in battle.
 * Extends template with runtime state and positioning.
 */
export interface BattleUnit extends UnitTemplate {
  /** Current position on battlefield */
  position: Position;
  /** Current hit points (can be less than stats.hp) */
  currentHp: number;
  /** Maximum hit points (equals stats.hp) */
  maxHp: number;
  /** Team affiliation */
  team: TeamType;
  /** Whether unit is alive and can act */
  alive: boolean;
  /** Unique instance identifier for battle */
  instanceId: string;
}

// =============================================================================
// FINAL UNIT STATE
// =============================================================================

/**
 * Final state of a unit after battle ends.
 */
export interface FinalUnitState {
  /** Unit instance ID */
  instanceId: string;
  /** Unit template ID */
  unitId: string;
  /** Final HP (0 if dead) */
  hp: number;
  /** Maximum HP */
  maxHp: number;
  /** Whether unit survived */
  alive: boolean;
  /** Final position */
  position: Position;
}
