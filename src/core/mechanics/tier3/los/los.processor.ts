/**
 * Tier 3: Line of Sight (LoS) Processor
 *
 * Implements the Line of Sight system which determines whether
 * ranged attacks can reach their targets based on obstacles.
 *
 * Key mechanics:
 * - Direct Fire: Requires clear line to target (blocked by units)
 * - Arc Fire: Ignores obstacles but has accuracy penalty
 * - Bresenham line algorithm for LoS calculation
 * - Partial cover provides dodge bonus
 *
 * @module core/mechanics/tier3/los
 */

import type { BattleState, BattleUnit } from '../../../types';
import type { LoSConfig } from '../../config/mechanics.types';
import type { Position } from '../../../types/grid.types';
import type {
  LoSProcessor,
  UnitWithLoS,
  FireType,
  LoSBlockStatus,
  LoSCheckResult,
  LoSPathResult,
  LoSPathCell,
  LoSProcessorOptions,
} from './los.types';
import {
  DEFAULT_ARC_FIRE_PENALTY,
  PARTIAL_COVER_HIT_CHANCE,
  COVER_DODGE_BONUS,
  ARC_FIRE_TAG,
  SIEGE_TAG,
  IGNORE_LOS_TAG,
  ARC_FIRE_MIN_RANGE,
} from './los.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the arc fire tag.
 */
function hasArcFireTag(
  unit: BattleUnit & UnitWithLoS,
  arcFireTags: string[] = [ARC_FIRE_TAG, SIEGE_TAG],
): boolean {
  if (unit.canArcFire !== undefined) {
    return unit.canArcFire;
  }
  const tags = unit.tags ?? [];
  return arcFireTags.some((tag) => tags.includes(tag));
}

/**
 * Checks if a unit ignores LoS.
 */
function hasIgnoreLoSTag(
  unit: BattleUnit & UnitWithLoS,
  ignoreLoSTags: string[] = [IGNORE_LOS_TAG],
): boolean {
  if (unit.ignoresLoS !== undefined) {
    return unit.ignoresLoS;
  }
  const tags = unit.tags ?? [];
  return ignoreLoSTags.some((tag) => tags.includes(tag));
}

/**
 * Calculates Manhattan distance between two positions.
 */
function manhattanDistance(from: Position, to: Position): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

/**
 * Generates cells along a line using Bresenham's algorithm.
 * This is the standard algorithm for drawing lines on a grid.
 *
 * @param from - Starting position
 * @param to - Ending position
 * @returns Array of positions along the line (excluding start and end)
 */
function bresenhamLine(from: Position, to: Position): Position[] {
  const cells: Position[] = [];

  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    // Don't include start or end positions
    if ((x0 !== from.x || y0 !== from.y) && (x0 !== to.x || y0 !== to.y)) {
      cells.push({ x: x0, y: y0 });
    }

    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

/**
 * Checks if a position is on the edge of the line (partial cover).
 * This happens when the line passes through a corner of a cell.
 * For straight horizontal or vertical lines, there are no edge cells.
 */
function isEdgePosition(pos: Position, from: Position, to: Position): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Straight horizontal or vertical lines have no edge cells
  if (dx === 0 || dy === 0) {
    return false;
  }

  // Calculate the exact line equation
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  if (lineLength === 0) return false;

  // Check if the line passes through the center of the cell
  // or through its edges
  const cellCenterX = pos.x + 0.5;
  const cellCenterY = pos.y + 0.5;

  // Calculate distance from cell center to line using point-to-line formula
  const distance =
    Math.abs(dy * cellCenterX - dx * cellCenterY + to.x * from.y - to.y * from.x) / lineLength;

  // If distance is close to 0.5 (half cell), it's an edge cell
  return distance > 0.3 && distance < 0.7;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a Line of Sight processor instance.
 *
 * @param config - LoS configuration
 * @param options - Optional processor configuration
 * @returns LoSProcessor instance
 *
 * @example
 * const processor = createLoSProcessor({
 *   directFire: true,
 *   arcFire: true,
 *   arcFirePenalty: 0.2,
 * });
 *
 * // Check if archer can hit target
 * const result = processor.checkLoS(archer, target, state);
 * if (result.canAttack) {
 *   // Proceed with attack, applying accuracy modifier
 * }
 */
export function createLoSProcessor(
  config: LoSConfig,
  options: LoSProcessorOptions = {},
): LoSProcessor {
  const arcFirePenalty =
    options.arcFirePenalty ?? config.arcFirePenalty ?? DEFAULT_ARC_FIRE_PENALTY;
  const partialCoverHitChance = options.partialCoverHitChance ?? PARTIAL_COVER_HIT_CHANCE;
  const coverDodgeBonus = options.coverDodgeBonus ?? COVER_DODGE_BONUS;
  const arcFireTags = options.arcFireTags ?? [ARC_FIRE_TAG, SIEGE_TAG];
  const ignoreLoSTags = options.ignoreLoSTags ?? [IGNORE_LOS_TAG];

  return {
    getFireType(unit: BattleUnit & UnitWithLoS): FireType {
      // Units with arc fire tags use arc fire
      if (hasArcFireTag(unit, arcFireTags)) {
        return 'arc';
      }
      // Default to direct fire
      return 'direct';
    },

    checkLoS(
      shooter: BattleUnit & UnitWithLoS,
      target: BattleUnit & UnitWithLoS,
      state: BattleState,
    ): LoSCheckResult {
      // Check if shooter ignores LoS completely
      if (hasIgnoreLoSTag(shooter, ignoreLoSTags)) {
        return {
          canAttack: true,
          fireType: 'direct',
          losStatus: 'clear',
          accuracyModifier: 1.0,
          coverDodgeBonus: 0,
        };
      }

      const distance = manhattanDistance(shooter.position, target.position);
      const fireType = this.getFireType(shooter);

      // Arc fire cannot target adjacent units
      if (fireType === 'arc' && distance < ARC_FIRE_MIN_RANGE) {
        return {
          canAttack: false,
          fireType: 'arc',
          losStatus: 'blocked',
          accuracyModifier: 1.0 - arcFirePenalty,
          coverDodgeBonus: 0,
          reason: 'arc_fire_too_close',
        };
      }

      // Arc fire ignores obstacles
      if (fireType === 'arc' && config.arcFire) {
        return {
          canAttack: true,
          fireType: 'arc',
          losStatus: 'clear',
          accuracyModifier: 1.0 - arcFirePenalty,
          coverDodgeBonus: 0,
        };
      }

      // Direct fire requires clear LoS
      if (!config.directFire) {
        return {
          canAttack: false,
          fireType: 'direct',
          losStatus: 'blocked',
          accuracyModifier: 1.0,
          coverDodgeBonus: 0,
          reason: 'no_direct_fire',
        };
      }

      // Calculate path and check for blocking units
      const pathResult = this.calculatePath(shooter.position, target.position, state, [
        shooter.instanceId ?? '',
        target.instanceId ?? '',
      ]);

      if (!pathResult.isClear && pathResult.blockingCell) {
        return {
          canAttack: false,
          fireType: 'direct',
          losStatus: 'blocked',
          accuracyModifier: 1.0,
          coverDodgeBonus: 0,
          blockingUnitId: pathResult.blockingCell.unitId,
          blockingPosition: pathResult.blockingCell.position,
          reason: 'unit_blocking',
        };
      }

      // Check for partial cover
      if (pathResult.hasPartialCover) {
        return {
          canAttack: true,
          fireType: 'direct',
          losStatus: 'partial',
          accuracyModifier: 1.0,
          coverDodgeBonus: coverDodgeBonus,
        };
      }

      return {
        canAttack: true,
        fireType: 'direct',
        losStatus: 'clear',
        accuracyModifier: 1.0,
        coverDodgeBonus: 0,
      };
    },

    calculatePath(
      from: Position,
      to: Position,
      state: BattleState,
      excludeIds: string[] = [],
    ): LoSPathResult {
      const lineCells = bresenhamLine(from, to);
      const cells: LoSPathCell[] = [];
      let blockingCell: LoSPathCell | undefined;
      let hasPartialCover = false;

      for (const pos of lineCells) {
        const blockingUnitId = this.getBlockingUnit(pos, state, excludeIds);
        const isOccupied = blockingUnitId !== undefined;
        const isEdgeCell = isEdgePosition(pos, from, to);

        const cell: LoSPathCell = {
          position: pos,
          isOccupied,
          unitId: blockingUnitId,
          isEdgeCell,
        };

        cells.push(cell);

        if (isOccupied && !blockingCell) {
          blockingCell = cell;
        }

        if (isEdgeCell && !isOccupied) {
          hasPartialCover = true;
        }
      }

      return {
        cells,
        isClear: blockingCell === undefined,
        blockingCell,
        hasPartialCover,
      };
    },

    getBlockingUnit(
      position: Position,
      state: BattleState,
      excludeIds: string[] = [],
    ): string | undefined {
      const posKey = `${position.x},${position.y}`;

      // Check occupied positions set first (fast path)
      if (!state.occupiedPositions.has(posKey)) {
        return undefined;
      }

      // Find the unit at this position
      for (const unit of state.units) {
        if (!unit.alive) continue;
        if (excludeIds.includes(unit.instanceId)) continue;
        if (unit.position.x === position.x && unit.position.y === position.y) {
          return unit.instanceId;
        }
      }

      return undefined;
    },

    getAccuracyModifier(fireType: FireType, _losStatus: LoSBlockStatus): number {
      if (fireType === 'arc') {
        return 1.0 - arcFirePenalty;
      }
      return 1.0;
    },

    getCoverDodgeBonus(losStatus: LoSBlockStatus): number {
      if (losStatus === 'partial') {
        return coverDodgeBonus;
      }
      return 0;
    },

    canUseArcFire(unit: BattleUnit & UnitWithLoS): boolean {
      return hasArcFireTag(unit, arcFireTags);
    },

    ignoresLoS(unit: BattleUnit & UnitWithLoS): boolean {
      return hasIgnoreLoSTag(unit, ignoreLoSTags);
    },
  };
}

export default createLoSProcessor;
