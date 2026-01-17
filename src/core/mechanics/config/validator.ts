/**
 * Core Mechanics 2.0 - Configuration Validator
 *
 * @module core/mechanics/config
 */

import type { MechanicsConfig } from './mechanics.types';
import { MECHANIC_DEPENDENCIES } from './dependencies';

/**
 * Validation result for mechanics configuration.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a mechanics configuration.
 */
export function validateMechanicsConfig(config: MechanicsConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate dependency consistency
  for (const [mechanic, deps] of Object.entries(MECHANIC_DEPENDENCIES)) {
    const key = mechanic as keyof MechanicsConfig;
    if (config[key]) {
      for (const dep of deps) {
        if (!config[dep]) {
          errors.push(`Mechanic '${key}' requires '${dep}' to be enabled, but it is disabled`);
        }
      }
    }
  }

  // Validate resolve config bounds
  if (config.resolve && typeof config.resolve === 'object') {
    if (config.resolve.maxResolve <= 0) {
      errors.push('resolve.maxResolve must be positive');
    }
    if (config.resolve.baseRegeneration < 0) {
      errors.push('resolve.baseRegeneration cannot be negative');
    }
  }

  // Validate engagement config bounds
  if (config.engagement && typeof config.engagement === 'object') {
    if (config.engagement.archerPenaltyPercent < 0 || config.engagement.archerPenaltyPercent > 1) {
      errors.push('engagement.archerPenaltyPercent must be between 0 and 1');
    }
  }

  // Validate riposte config bounds
  if (config.riposte && typeof config.riposte === 'object') {
    if (config.riposte.baseChance < 0 || config.riposte.baseChance > 1) {
      errors.push('riposte.baseChance must be between 0 and 1');
    }
  }

  // Warnings for potentially problematic configurations
  if (config.contagion && config.phalanx) {
    warnings.push(
      'Both contagion and phalanx are enabled. Contagion spreads faster in phalanx formations.',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
