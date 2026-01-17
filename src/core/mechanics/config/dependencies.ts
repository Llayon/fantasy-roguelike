/**
 * Core Mechanics 2.0 - Dependency Resolution
 *
 * @module core/mechanics/config
 */

import type { MechanicsConfig } from './mechanics.types';
import {
  DEFAULT_RESOLVE_CONFIG,
  DEFAULT_ENGAGEMENT_CONFIG,
  DEFAULT_RIPOSTE_CONFIG,
  DEFAULT_INTERCEPT_CONFIG,
  DEFAULT_CHARGE_CONFIG,
  DEFAULT_PHALANX_CONFIG,
  DEFAULT_LOS_CONFIG,
  DEFAULT_AMMO_CONFIG,
  DEFAULT_CONTAGION_CONFIG,
  DEFAULT_SHRED_CONFIG,
} from './defaults';
import { MVP_PRESET } from './presets/mvp';

/**
 * Dependency graph for mechanics.
 */
export const MECHANIC_DEPENDENCIES: Record<keyof MechanicsConfig, (keyof MechanicsConfig)[]> = {
  facing: [],
  armorShred: [],
  resolve: [],
  engagement: [],
  flanking: ['facing'],
  ammunition: [],
  riposte: ['flanking'],
  intercept: ['engagement'],
  aura: [],
  charge: ['intercept'],
  overwatch: ['intercept', 'ammunition'],
  phalanx: ['facing'],
  lineOfSight: ['facing'],
  contagion: [],
};

/**
 * Returns default configuration for a mechanic.
 */
export function getDefaultConfig(mechanic: keyof MechanicsConfig): boolean | object {
  const defaults: Record<keyof MechanicsConfig, boolean | object> = {
    facing: true,
    resolve: DEFAULT_RESOLVE_CONFIG,
    engagement: DEFAULT_ENGAGEMENT_CONFIG,
    flanking: true,
    riposte: DEFAULT_RIPOSTE_CONFIG,
    intercept: DEFAULT_INTERCEPT_CONFIG,
    aura: true,
    charge: DEFAULT_CHARGE_CONFIG,
    overwatch: true,
    phalanx: DEFAULT_PHALANX_CONFIG,
    lineOfSight: DEFAULT_LOS_CONFIG,
    ammunition: DEFAULT_AMMO_CONFIG,
    contagion: DEFAULT_CONTAGION_CONFIG,
    armorShred: DEFAULT_SHRED_CONFIG,
  };

  return defaults[mechanic] ?? true;
}

/**
 * Resolves mechanic dependencies recursively.
 */
export function resolveDependencies(config: Partial<MechanicsConfig>): MechanicsConfig {
  const resolved: MechanicsConfig = { ...MVP_PRESET, ...config };

  let changed = true;
  while (changed) {
    changed = false;

    for (const [mechanic, deps] of Object.entries(MECHANIC_DEPENDENCIES)) {
      const key = mechanic as keyof MechanicsConfig;

      if (resolved[key]) {
        for (const dep of deps) {
          if (!resolved[dep]) {
            (resolved as Record<keyof MechanicsConfig, unknown>)[dep] = getDefaultConfig(dep);
            changed = true;
          }
        }
      }
    }
  }

  return resolved;
}
