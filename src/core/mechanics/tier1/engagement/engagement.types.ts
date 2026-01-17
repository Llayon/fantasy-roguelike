/**
 * Tier 1: Engagement (Zone of Control) - Type Definitions
 *
 * Defines types for the engagement/Zone of Control system which controls
 * how units interact when in close proximity. Engaged units are locked
 * in combat and suffer penalties when trying to disengage or use ranged attacks.
 *
 * Key concepts:
 * - Zone of Control (ZoC): Adjacent cells around a melee unit
 * - Engagement: When an enemy enters a unit's ZoC
 * - Attack of Opportunity: Free attack when enemy leaves ZoC
 * - Archer Penalty: Ranged units suffer accuracy penalty when engaged
 *
 * @module core/mechanics/tier1/engagement
 */

import type { EngagementConfig } from '../../config/mechanics.types';
import type { BattleState } from '../../../types/battle-state';
import type { BattleUnit } from '../../../types/battle-unit';
import type { Position } from '../../../types/grid.types';

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT STATE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Engagement status for a unit.
 *
 * - free: Unit is not engaged with any enemy
 * - engaged: Unit is in Zone of Control of one or more enemies
 * - pinned: Unit is engaged by multiple enemies (harder to disengage)
 *
 * @example
 * const status = processor.getEngagementStatus(unit, state);
 * if (status === 'engaged') {
 *   // Apply archer penalty if ranged unit
 * }
 */
export type EngagementStatus = 'free' | 'engaged' | 'pinned';

// ═══════════════════════════════════════════════════════════════
// UNIT EXTENSION TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Extended unit properties for the engagement system.
 * These properties are added to BattleUnit when engagement mechanic is enabled.
 *
 * @example
 * interface MyBattleUnit extends BattleUnit, UnitWithEngagement {}
 *
 * const unit: MyBattleUnit = {
 *   ...baseUnit,
 *   engaged: true,
 *   engagedBy: ['enemy_1', 'enemy_2'],
 *   hasZoneOfControl: true,
 * };
 */
export interface UnitWithEngagement {
  /** Whether unit is currently engaged in melee combat */
  engaged?: boolean;

  /** List of unit IDs that are engaging this unit */
  engagedBy?: string[];

  /** Whether this unit projects a Zone of Control */
  hasZoneOfControl?: boolean;

  /** Whether unit is a ranged type (for archer penalty) */
  isRanged?: boolean;

  /** Whether unit used Attack of Opportunity this turn */
  usedAttackOfOpportunity?: boolean;

  /**
   * Damage multiplier from archer penalty when engaged.
   * Set during pre_attack phase for ranged units in melee.
   * Value of 1.0 means no penalty, 0.5 means 50% damage.
   */
  archerPenaltyModifier?: number;
}

// ═══════════════════════════════════════════════════════════════
// ZONE OF CONTROL TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Zone of Control information for a unit.
 * Contains the cells that are within the unit's ZoC.
 *
 * @example
 * const zoc = processor.getZoneOfControl(unit);
 * if (zoc.cells.some(c => c.x === target.x && c.y === target.y)) {
 *   // Target is in unit's Zone of Control
 * }
 */
export interface ZoneOfControl {
  /** Unit that owns this Zone of Control */
  unitId: string;

  /** Cells within the Zone of Control (adjacent cells) */
  cells: Position[];

  /** Whether ZoC is currently active */
  active: boolean;
}

/**
 * Result of checking Zone of Control for a position.
 *
 * @example
 * const check = processor.checkZoneOfControl(position, state);
 * if (check.inZoC) {
 *   console.log(`Position is in ZoC of: ${check.controllingUnits.join(', ')}`);
 * }
 */
export interface ZoCCheckResult {
  /** Whether the position is in any unit's Zone of Control */
  inZoC: boolean;

  /** IDs of units whose ZoC covers this position */
  controllingUnits: string[];

  /** Whether moving through this position triggers Attack of Opportunity */
  triggersAoO: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ATTACK OF OPPORTUNITY TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Attack of Opportunity trigger information.
 *
 * @example
 * const trigger: AoOTrigger = {
 *   type: 'leave_zoc',
 *   attacker: engagingUnit,
 *   target: movingUnit,
 *   fromPosition: { x: 3, y: 4 },
 *   toPosition: { x: 4, y: 4 },
 * };
 */
export interface AoOTrigger {
  /** Type of trigger that caused the Attack of Opportunity */
  type: 'leave_zoc' | 'move_through_zoc';

  /** Unit that gets the free attack */
  attacker: BattleUnit;

  /** Unit that triggered the Attack of Opportunity */
  target: BattleUnit;

  /** Position the target is moving from */
  fromPosition: Position;

  /** Position the target is moving to */
  toPosition: Position;
}

/**
 * Result of an Attack of Opportunity.
 *
 * @example
 * const result = processor.executeAttackOfOpportunity(trigger, state, seed);
 * if (result.hit) {
 *   console.log(`AoO dealt ${result.damage} damage`);
 * }
 */
export interface AoOResult {
  /** Whether the attack hit */
  hit: boolean;

  /** Damage dealt (0 if missed) */
  damage: number;

  /** Whether the target's movement was interrupted */
  movementInterrupted: boolean;

  /** Updated battle state after AoO */
  state: BattleState;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Engagement processor interface.
 * Handles all engagement-related mechanics including Zone of Control,
 * Attack of Opportunity, and archer penalties.
 *
 * @example
 * const processor = createEngagementProcessor(config);
 *
 * // Check if unit is engaged
 * const status = processor.getEngagementStatus(unit, state);
 *
 * // Get Zone of Control cells
 * const zoc = processor.getZoneOfControl(unit);
 *
 * // Check for Attack of Opportunity
 * const aoo = processor.checkAttackOfOpportunity(unit, fromPos, toPos, state);
 */
export interface EngagementProcessor {
  /**
   * Gets the engagement status of a unit.
   * Checks if unit is in any enemy's Zone of Control.
   *
   * @param unit - Unit to check engagement for
   * @param state - Current battle state
   * @returns Engagement status (free, engaged, or pinned)
   */
  getEngagementStatus(
    unit: BattleUnit & UnitWithEngagement,
    state: BattleState,
  ): EngagementStatus;

  /**
   * Gets the Zone of Control for a unit.
   * Returns adjacent cells that the unit controls.
   *
   * @param unit - Unit to get ZoC for
   * @returns Zone of Control information
   */
  getZoneOfControl(unit: BattleUnit & UnitWithEngagement): ZoneOfControl;

  /**
   * Checks if a position is in any unit's Zone of Control.
   *
   * @param position - Position to check
   * @param state - Current battle state
   * @param excludeUnitId - Optional unit ID to exclude from check
   * @returns ZoC check result
   */
  checkZoneOfControl(
    position: Position,
    state: BattleState,
    excludeUnitId?: string,
  ): ZoCCheckResult;

  /**
   * Checks if movement triggers Attack of Opportunity.
   *
   * @param unit - Unit that is moving
   * @param fromPosition - Starting position
   * @param toPosition - Target position
   * @param state - Current battle state
   * @returns Array of AoO triggers (empty if none)
   */
  checkAttackOfOpportunity(
    unit: BattleUnit & UnitWithEngagement,
    fromPosition: Position,
    toPosition: Position,
    state: BattleState,
  ): AoOTrigger[];

  /**
   * Executes an Attack of Opportunity.
   *
   * @param trigger - AoO trigger information
   * @param state - Current battle state
   * @param seed - Random seed for determinism
   * @returns AoO result with updated state
   */
  executeAttackOfOpportunity(
    trigger: AoOTrigger,
    state: BattleState,
    seed: number,
  ): AoOResult;

  /**
   * Calculates archer penalty when engaged.
   * Returns damage multiplier (1.0 = no penalty, 0.5 = 50% damage).
   *
   * @param unit - Ranged unit to check
   * @param state - Current battle state
   * @param config - Engagement configuration
   * @returns Damage multiplier (0.0 to 1.0)
   */
  getArcherPenalty(
    unit: BattleUnit & UnitWithEngagement,
    state: BattleState,
    config: EngagementConfig,
  ): number;

  /**
   * Updates engagement status for all units.
   * Should be called after movement to recalculate engagements.
   *
   * @param state - Current battle state
   * @returns Updated battle state with engagement info
   */
  updateEngagements(state: BattleState): BattleState;

  /**
   * Reset Attack of Opportunity usage for a unit at turn end.
   *
   * @param state - Current battle state
   * @param unitId - Unit to reset AoO for
   * @returns Updated battle state
   */
  resetAoOUsage(state: BattleState, unitId: string): BattleState;
}

