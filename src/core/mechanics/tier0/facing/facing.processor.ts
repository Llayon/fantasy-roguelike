/**
 * Tier 0: Facing Processor
 *
 * Implements the facing/direction system for directional combat.
 * Units have a facing direction (N/S/E/W) and attacks from different angles
 * (front/flank/rear) have different effects.
 *
 * @module core/mechanics/tier0/facing
 * @see {@link FacingProcessor} for interface definition
 * @see Requirements 1.3 for phase hook specification
 */

import type { BattleState, BattleEvent } from '../../../types';
import { createFacingRotatedEvent } from '../../../types/events';
import type { FacingDirection } from '../../../types/battle-unit';
import type { Position } from '../../../types/grid.types';
import { findUnit, updateUnit } from '../../../utils/state-helpers';
import type { AttackArc, FacingProcessor, FacingContext, FacingResult } from './facing.types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Angle mappings for each facing direction (in degrees).
 * North = 0°, East = 90°, South = 180°, West = 270°
 */
const FACING_ANGLES: Record<FacingDirection, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};

/**
 * Arc thresholds in degrees.
 * - Front: 0° - 45° from facing
 * - Flank: 45° - 135° from facing
 * - Rear: 135° - 180° from facing
 */
const ARC_THRESHOLDS = {
  FRONT: 45,
  FLANK: 135,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculates the angle from origin to target in degrees.
 * Returns angle in range [0, 360) where:
 * - 0° = North (negative Y)
 * - 90° = East (positive X)
 * - 180° = South (positive Y)
 * - 270° = West (negative X)
 *
 * @param origin - Origin position
 * @param target - Target position
 * @returns Angle in degrees [0, 360)
 */
function calculateAngle(
  origin: { x: number; y: number },
  target: { x: number; y: number },
): number {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  // atan2(dx, -dy) rotates coordinate system so North = 0°
  // -dy inverts Y axis because screen coordinates have Y increasing downward
  const radians = Math.atan2(dx, -dy);
  const degrees = radians * (180 / Math.PI);

  // Normalize to [0, 360) range
  return (degrees + 360) % 360;
}

/**
 * Calculates the smallest angle difference between two angles.
 * Result is always in range [0, 180].
 *
 * @param angle1 - First angle in degrees
 * @param angle2 - Second angle in degrees
 * @returns Absolute angle difference [0, 180]
 */
function angleDifference(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Determines the primary facing direction based on angle.
 *
 * @param angle - Angle in degrees [0, 360)
 * @returns Closest cardinal direction
 */
function angleToFacing(angle: number): FacingDirection {
  const normalized = ((angle % 360) + 360) % 360;

  if (normalized >= 315 || normalized < 45) return 'N';
  if (normalized >= 45 && normalized < 135) return 'E';
  if (normalized >= 135 && normalized < 225) return 'S';
  return 'W';
}

// =============================================================================
// FACING PROCESSOR FACTORY
// =============================================================================

/**
 * Creates a facing processor instance.
 *
 * The facing processor handles:
 * - Getting unit facing direction
 * - Rotating units to face targets
 * - Calculating attack arcs (front/flank/rear)
 *
 * @returns FacingProcessor instance
 *
 * @example
 * const processor = createFacingProcessor();
 *
 * // Get attack arc for damage calculation
 * const arc = processor.getAttackArc(attacker.position, target.position, target.facing);
 * const damageModifier = arc === 'rear' ? 1.3 : arc === 'flank' ? 1.15 : 1.0;
 *
 * // Rotate unit to face enemy
 * const result = processor.faceTarget(state, unitId, enemy.position, ctx);
 */
export function createFacingProcessor(): FacingProcessor {
  return {
    /**
     * Gets unit's current facing direction.
     * Returns 'S' (South) as default if unit has no facing set.
     */
    getFacing(unit: { facing?: FacingDirection }): FacingDirection {
      return unit.facing ?? 'S';
    },

    /**
     * Calculates the facing direction from one position to another.
     */
    calculateFacingDirection(from: Position, to: Position): FacingDirection {
      const angle = calculateAngle(from, to);
      return angleToFacing(angle);
    },

    /**
     * Rotates unit to face target position and updates state.
     * Emits facing_rotated event if facing changed.
     */
    faceTarget(
      state: BattleState,
      unitId: string,
      targetPosition: Position,
      context: FacingContext,
    ): FacingResult {
      const events: BattleEvent[] = [];
      let currentState = state;

      const unit = findUnit(currentState, unitId);
      if (!unit || !unit.alive) {
        return { state: currentState, events };
      }

      // Calculate new facing direction
      const newFacing = this.calculateFacingDirection(unit.position, targetPosition);

      // Skip if already facing the correct direction
      if (unit.facing === newFacing) {
        return { state: currentState, events };
      }

      const oldFacing = unit.facing;

      // Update unit facing
      currentState = updateUnit(currentState, unitId, {
        facing: newFacing,
      });

      // Emit facing rotated event
      const facingEvent = createFacingRotatedEvent(context, unitId, {
        from: oldFacing,
        to: newFacing,
        reason: 'attack',
      });
      events.push(facingEvent);

      return { state: currentState, events };
    },

    /**
     * Determines attack arc (front/flank/rear) based on attacker position
     * relative to target's facing direction.
     */
    getAttackArc(
      attackerPos: Position,
      targetPos: Position,
      targetFacing: FacingDirection,
    ): AttackArc {
      // Calculate angle from target to attacker
      const attackAngle = calculateAngle(targetPos, attackerPos);

      // Get target's facing angle
      const facingAngle = FACING_ANGLES[targetFacing];

      // Calculate relative angle (how far off from facing the attack comes from)
      const relativeAngle = angleDifference(attackAngle, facingAngle);

      // Determine arc based on relative angle
      if (relativeAngle <= ARC_THRESHOLDS.FRONT) {
        return 'front';
      }
      if (relativeAngle <= ARC_THRESHOLDS.FLANK) {
        return 'flank';
      }
      return 'rear';
    },
  };
}

/**
 * Default export for convenience.
 */
export default createFacingProcessor;
