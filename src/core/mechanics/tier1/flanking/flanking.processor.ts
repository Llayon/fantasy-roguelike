/**
 * Tier 1: Flanking Processor
 *
 * Implements the flanking system which provides damage bonuses
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
 * @see {@link FlankingProcessor} for interface definition
 * @see Requirements 1.4 for flanking specification
 */

import type {
  AttackArc,
  FlankingProcessor,
  FlankingProcessorOptions,
  FlankingResult,
} from './flanking.types';
import { FLANKING_DAMAGE_MODIFIERS, DEFAULT_FLANKING_RESOLVE_DAMAGE } from './flanking.types';

/**
 * Creates a flanking processor instance.
 *
 * The flanking processor handles:
 * - Damage modifiers based on attack arc (front/flank/rear)
 * - Resolve damage calculation for flanking attacks
 * - Riposte disabling for non-front attacks
 *
 * @param options - Optional custom configuration for damage modifiers
 * @returns FlankingProcessor instance
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
export function createFlankingProcessor(options?: FlankingProcessorOptions): FlankingProcessor {
  // Merge custom modifiers with defaults
  const damageModifiers: Record<AttackArc, number> = {
    ...FLANKING_DAMAGE_MODIFIERS,
    ...options?.damageModifiers,
  };

  const resolveDamage: Record<AttackArc, number> = {
    ...DEFAULT_FLANKING_RESOLVE_DAMAGE,
    ...options?.resolveDamage,
  };

  return {
    /**
     * Calculates damage modifier based on attack arc.
     * Returns a multiplier to apply to base damage.
     *
     * Modifiers:
     * - front: 1.0 (no bonus)
     * - flank: 1.15 (+15% damage)
     * - rear: 1.3 (+30% damage)
     *
     * @param arc - Attack arc relative to target's facing ('front', 'flank', or 'rear')
     * @returns Damage multiplier (1.0 to 1.3)
     *
     * @example
     * const modifier = processor.getDamageModifier('rear');
     * const finalDamage = Math.floor(baseDamage * modifier); // +30% damage
     */
    getDamageModifier(arc: AttackArc): number {
      // Flanking damage formula: finalDamage = baseDamage * modifier
      // - Front (0°-45° from facing): modifier = 1.0 (no bonus)
      // - Flank (45°-135° from facing): modifier = 1.15 (+15% bonus)
      // - Rear (135°-180° from facing): modifier = 1.3 (+30% bonus)
      return damageModifiers[arc];
    },

    /**
     * Calculates resolve damage based on attack arc.
     *
     * Default values:
     * - front: 0 (no resolve damage)
     * - flank: 5 (moderate morale shock)
     * - rear: 10 (severe morale shock)
     *
     * @param arc - Attack arc relative to target's facing
     * @returns Resolve damage amount (0 for front attacks)
     *
     * @example
     * const resolveDmg = processor.getResolveDamage('flank');
     * // Apply to target's resolve: target.resolve -= resolveDmg;
     */
    getResolveDamage(arc: AttackArc): number {
      // Resolve damage formula: resolveDamage = arcValue
      // - Front attacks: 0 (no morale impact from expected direction)
      // - Flank attacks: 5 (moderate morale shock from unexpected angle)
      // - Rear attacks: 10 (severe morale shock from behind)
      // These values represent psychological impact of being attacked from vulnerable angles
      return resolveDamage[arc];
    },

    /**
     * Checks if the attack arc disables riposte.
     * Only front attacks allow the defender to riposte.
     *
     * @param arc - Attack arc relative to target's facing
     * @returns True if riposte is disabled (flank or rear attacks)
     *
     * @example
     * if (processor.disablesRiposte(arc)) {
     *   // Skip riposte check for defender
     * }
     */
    disablesRiposte(arc: AttackArc): boolean {
      return arc !== 'front';
    },

    /**
     * Calculates all flanking effects for an attack.
     * Convenience method that returns all modifiers at once.
     *
     * @param arc - Attack arc relative to target's facing
     * @returns Complete flanking result with damageModifier, resolveDamage, and disablesRiposte
     *
     * @example
     * const result = processor.calculateFlankingEffects('rear');
     * // result.damageModifier === 1.3
     * // result.resolveDamage === 10
     * // result.disablesRiposte === true
     */
    calculateFlankingEffects(arc: AttackArc): FlankingResult {
      return {
        arc,
        damageModifier: this.getDamageModifier(arc),
        resolveDamage: this.getResolveDamage(arc),
        disablesRiposte: this.disablesRiposte(arc),
      };
    },
  };
}

/**
 * Default export for convenience.
 */
export default createFlankingProcessor;
