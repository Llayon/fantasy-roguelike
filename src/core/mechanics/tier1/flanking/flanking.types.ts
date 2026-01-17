/**
 * Tier 1: Flanking - Type Definitions
 *
 * Defines types for the flanking system which provides damage bonuses
 * and resolve damage based on attack angle relative to target's facing.
 *
 * Flanking requires the facing mechanic (Tier 0) to be enabled.
 *
 * Attack arcs and their effects:
 * - Front (0°-45°): No bonus, riposte allowed
 * - Flank (45°-135°): +15% damage, resolve damage, disables riposte
 * - Rear (135°-180°): +30% damage, higher resolve damage, disables riposte
 *
 * @module core/mechanics/tier1/flanking
 */

import type { AttackArc } from '../../tier0/facing/facing.types';

// Re-export AttackArc for convenience
export type { AttackArc } from '../../tier0/facing/facing.types';

// ═══════════════════════════════════════════════════════════════
// DAMAGE MODIFIER CONSTANTS
// ═══════════════════════════════════════════════════════════════

/**
 * Default damage modifiers for each attack arc.
 * These values are applied as multipliers to base damage.
 *
 * Flanking damage formula: finalDamage = baseDamage * modifier
 *
 * The modifiers represent the tactical advantage of attacking from
 * unexpected angles where the defender cannot effectively block or parry.
 *
 * @example
 * const modifier = FLANKING_DAMAGE_MODIFIERS.flank; // 1.15
 * const finalDamage = baseDamage * modifier;
 */
export const FLANKING_DAMAGE_MODIFIERS: Readonly<Record<AttackArc, number>> = {
  // Front attack (0°-45° from facing): no damage bonus
  // Defender can see and react to the attack
  front: 1.0,

  // Flank attack (45°-135° from facing): +15% damage bonus
  // Defender has limited ability to block attacks from the side
  flank: 1.15,

  // Rear attack (135°-180° from facing): +30% damage bonus
  // Defender cannot see or react to attacks from behind
  rear: 1.3,
} as const;

/**
 * Default resolve damage values for each attack arc.
 * These values are used when ResolveConfig is not provided.
 *
 * Resolve damage represents the psychological impact of being attacked
 * from vulnerable angles. Higher values for rear attacks reflect the
 * panic and demoralization of being struck from behind.
 *
 * @example
 * const resolveDmg = DEFAULT_FLANKING_RESOLVE_DAMAGE.rear; // 10
 */
export const DEFAULT_FLANKING_RESOLVE_DAMAGE: Readonly<Record<AttackArc, number>> = {
  // Front attack: no resolve damage (expected attack direction)
  front: 0,

  // Flank attack: moderate resolve damage (5 points)
  // Represents surprise and disorientation from side attack
  flank: 5,

  // Rear attack: high resolve damage (10 points)
  // Represents panic and fear from being struck from behind
  rear: 10,
} as const;

// ═══════════════════════════════════════════════════════════════
// FLANKING RESULT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result of a flanking calculation.
 * Contains all modifiers and effects from the attack arc.
 *
 * @example
 * const result: FlankingResult = {
 *   arc: 'flank',
 *   damageModifier: 1.15,
 *   resolveDamage: 5,
 *   disablesRiposte: true,
 * };
 */
export interface FlankingResult {
  /** The attack arc (front/flank/rear) */
  arc: AttackArc;

  /** Damage multiplier to apply (1.0 for front, 1.15 for flank, 1.3 for rear) */
  damageModifier: number;

  /** Resolve damage to apply (0 for front) */
  resolveDamage: number;

  /** Whether this attack disables the target's riposte */
  disablesRiposte: boolean;
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Flanking processor interface.
 * Handles all flanking-related mechanics including damage modifiers,
 * resolve damage calculation, and riposte disabling.
 *
 * Requires: facing (Tier 0) - uses AttackArc from facing processor
 *
 * @example
 * const processor = createFlankingProcessor();
 *
 * // Get damage modifier for a flank attack
 * const modifier = processor.getDamageModifier('flank'); // 1.15
 *
 * // Calculate resolve damage
 * const resolveDmg = processor.getResolveDamage('rear'); // 10
 *
 * // Check if riposte is disabled
 * const noRiposte = processor.disablesRiposte('flank'); // true
 */
export interface FlankingProcessor {
  /**
   * Calculates damage modifier based on attack arc.
   * Returns a multiplier to apply to base damage.
   *
   * Modifiers:
   * - front: 1.0 (no bonus)
   * - flank: 1.15 (+15% damage)
   * - rear: 1.3 (+30% damage)
   *
   * @param arc - Attack arc relative to target's facing
   * @returns Damage multiplier (1.0 to 1.3)
   *
   * @example
   * const modifier = processor.getDamageModifier('rear');
   * const finalDamage = Math.floor(baseDamage * modifier);
   */
  getDamageModifier(arc: AttackArc): number;

  /**
   * Calculates resolve damage based on attack arc.
   *
   * Default values:
   * - front: 0 (no resolve damage)
   * - flank: 5 (moderate morale shock)
   * - rear: 10 (severe morale shock)
   *
   * @param arc - Attack arc relative to target's facing
   * @returns Resolve damage amount
   *
   * @example
   * const resolveDmg = processor.getResolveDamage('flank');
   * // Apply to target's resolve
   */
  getResolveDamage(arc: AttackArc): number;

  /**
   * Checks if the attack arc disables riposte.
   * Only front attacks allow the defender to riposte.
   *
   * @param arc - Attack arc relative to target's facing
   * @returns True if riposte is disabled (flank or rear)
   *
   * @example
   * if (processor.disablesRiposte(arc)) {
   *   // Skip riposte check for defender
   * }
   */
  disablesRiposte(arc: AttackArc): boolean;

  /**
   * Calculates all flanking effects for an attack.
   * Convenience method that returns all modifiers at once.
   *
   * @param arc - Attack arc relative to target's facing
   * @returns Complete flanking result with all modifiers
   *
   * @example
   * const result = processor.calculateFlankingEffects('rear');
   * // result.damageModifier === 1.3
   * // result.resolveDamage === 10
   * // result.disablesRiposte === true
   */
  calculateFlankingEffects(arc: AttackArc): FlankingResult;
}

// ═══════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Options for creating a flanking processor with custom modifiers.
 *
 * @example
 * const options: FlankingProcessorOptions = {
 *   damageModifiers: { front: 1.0, flank: 1.2, rear: 1.4 },
 *   resolveDamage: { front: 0, flank: 8, rear: 15 },
 * };
 */
export interface FlankingProcessorOptions {
  /** Custom damage modifiers per arc */
  damageModifiers?: Partial<Record<AttackArc, number>>;

  /** Custom resolve damage per arc */
  resolveDamage?: Partial<Record<AttackArc, number>>;
}
