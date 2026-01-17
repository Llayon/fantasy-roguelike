/**
 * Tier 3: Ammunition Processor
 *
 * Implements the ammunition and cooldown system which tracks resource
 * consumption for ranged units and ability cooldowns for mages.
 *
 * Key mechanics:
 * - Ammo tracking: Ranged units have limited ammunition
 * - Cooldown tracking: Mages have ability cooldowns instead of ammo
 * - Consumption: Each ranged attack or ability use consumes resources
 * - Reload: Ammunition can be restored at turn start (if configured)
 * - Empty state: Units without ammo/off-cooldown cannot use ranged attacks
 *
 * @module core/mechanics/tier3/ammunition
 */

import type { BattleState, BattleUnit } from '../../../types';
import type { AmmoConfig } from '../../config/mechanics.types';
import type {
  AmmunitionProcessor,
  UnitWithAmmunition,
  ResourceType,
  AmmoState,
  CooldownState,
  AmmoCheckResult,
  CooldownCheckResult,
  AmmoConsumeResult,
  CooldownTriggerResult,
  ReloadResult,
  CooldownTickResult,
  AmmunitionProcessorOptions,
} from './ammunition.types';
import {
  DEFAULT_AMMO_COUNT,
  DEFAULT_COOLDOWN_DURATION,
  RANGED_TAG,
  MAGE_TAG,
  UNLIMITED_AMMO_TAG,
  QUICK_COOLDOWN_TAG,
} from './ammunition.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the ranged tag.
 */
function isRangedUnit(
  unit: BattleUnit & UnitWithAmmunition,
  rangedTags: string[] = [RANGED_TAG],
): boolean {
  const tags = unit.tags ?? [];
  const hasRangedTag = rangedTags.some((tag) => tags.includes(tag));
  const hasRange = (unit.range ?? 1) > 1;
  return hasRangedTag || hasRange;
}

/**
 * Checks if a unit has the mage tag.
 */
function isMageUnit(
  unit: BattleUnit & UnitWithAmmunition,
  mageTags: string[] = [MAGE_TAG],
): boolean {
  const tags = unit.tags ?? [];
  return mageTags.some((tag) => tags.includes(tag));
}

/**
 * Checks if a unit has unlimited ammunition.
 */
function hasUnlimitedAmmo(
  unit: BattleUnit & UnitWithAmmunition,
  unlimitedTags: string[] = [UNLIMITED_AMMO_TAG],
): boolean {
  if (unit.hasUnlimitedAmmo !== undefined) {
    return unit.hasUnlimitedAmmo;
  }
  const tags = unit.tags ?? [];
  return unlimitedTags.some((tag) => tags.includes(tag));
}

/**
 * Checks if a unit has quick cooldown reduction.
 */
function hasQuickCooldownTag(unit: BattleUnit & UnitWithAmmunition): boolean {
  if (unit.hasQuickCooldown !== undefined) {
    return unit.hasQuickCooldown;
  }
  const tags = unit.tags ?? [];
  return tags.includes(QUICK_COOLDOWN_TAG);
}

/**
 * Calculates the ammo state based on current and max ammo.
 */
function calculateAmmoState(
  current: number,
  max: number,
  isReloading: boolean = false,
): AmmoState {
  if (isReloading) return 'reloading';
  if (current <= 0) return 'empty';
  if (current >= max) return 'full';
  return 'partial';
}

/**
 * Calculates the cooldown state for an ability.
 */
function calculateCooldownState(
  turnsRemaining: number,
  wasReduced: boolean = false,
): CooldownState {
  if (turnsRemaining <= 0) return 'ready';
  if (wasReduced) return 'reduced';
  return 'cooling';
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an ammunition processor instance.
 *
 * @param config - Ammunition configuration
 * @param options - Optional processor configuration
 * @returns AmmunitionProcessor instance
 *
 * @example
 * const processor = createAmmunitionProcessor({
 *   enabled: true,
 *   mageCooldowns: true,
 *   defaultAmmo: 6,
 *   defaultCooldown: 3,
 * });
 *
 * // Check if unit can attack
 * const check = processor.checkAmmo(archer);
 *
 * // Consume ammunition on attack
 * const result = processor.consumeAmmo(archer, state);
 */
export function createAmmunitionProcessor(
  config: AmmoConfig,
  options: AmmunitionProcessorOptions = {},
): AmmunitionProcessor {
  const defaultAmmo = options.defaultAmmo ?? config.defaultAmmo ?? DEFAULT_AMMO_COUNT;
  const defaultCooldown = options.defaultCooldown ?? config.defaultCooldown ?? DEFAULT_COOLDOWN_DURATION;
  const rangedTags = options.rangedTags ?? [RANGED_TAG];
  const mageTags = options.mageTags ?? [MAGE_TAG];
  const unlimitedAmmoTags = options.unlimitedAmmoTags ?? [UNLIMITED_AMMO_TAG];

  return {
    getResourceType(unit: BattleUnit & UnitWithAmmunition): ResourceType {
      // If resource type is already set, use it
      if (unit.resourceType !== undefined) {
        return unit.resourceType;
      }

      // Mages use cooldowns (if mageCooldowns enabled)
      if (config.mageCooldowns && isMageUnit(unit, mageTags)) {
        return 'cooldown';
      }

      // Ranged units use ammo
      if (isRangedUnit(unit, rangedTags)) {
        return 'ammo';
      }

      // Melee units don't use resources
      return 'none';
    },

    checkAmmo(unit: BattleUnit & UnitWithAmmunition): AmmoCheckResult {
      const resourceType = this.getResourceType(unit);

      // Non-ranged units always can attack (no ammo needed)
      if (resourceType !== 'ammo') {
        return {
          canAttack: true,
          hasAmmo: true,
          ammoRemaining: Infinity,
          ammoState: 'full',
        };
      }

      // Check for unlimited ammo
      if (hasUnlimitedAmmo(unit, unlimitedAmmoTags)) {
        return {
          canAttack: true,
          hasAmmo: true,
          ammoRemaining: Infinity,
          ammoState: 'full',
        };
      }

      // Check if reloading
      if (unit.isReloading) {
        return {
          canAttack: false,
          hasAmmo: false,
          ammoRemaining: 0,
          ammoState: 'reloading',
          reason: 'reloading',
        };
      }

      const currentAmmo = unit.ammo ?? defaultAmmo;
      const maxAmmo = unit.maxAmmo ?? defaultAmmo;
      const ammoState = calculateAmmoState(
        typeof currentAmmo === 'number' ? currentAmmo : defaultAmmo,
        typeof maxAmmo === 'number' ? maxAmmo : defaultAmmo,
        unit.isReloading,
      );

      if (typeof currentAmmo === 'number' && currentAmmo <= 0) {
        return {
          canAttack: false,
          hasAmmo: false,
          ammoRemaining: 0,
          ammoState: 'empty',
          reason: 'no_ammo',
        };
      }

      return {
        canAttack: true,
        hasAmmo: true,
        ammoRemaining: typeof currentAmmo === 'number' ? currentAmmo : Infinity,
        ammoState,
      };
    },

    checkCooldown(
      unit: BattleUnit & UnitWithAmmunition,
      abilityId: string,
    ): CooldownCheckResult {
      const resourceType = this.getResourceType(unit);

      // Non-mage units don't use cooldowns
      if (resourceType !== 'cooldown') {
        return {
          canUse: true,
          isReady: true,
          turnsRemaining: 0,
          cooldownState: 'ready',
        };
      }

      const cooldowns = unit.cooldowns ?? {};
      const turnsRemaining = cooldowns[abilityId] ?? 0;
      const cooldownState = calculateCooldownState(turnsRemaining);

      if (turnsRemaining > 0) {
        return {
          canUse: false,
          isReady: false,
          turnsRemaining,
          cooldownState,
          reason: 'on_cooldown',
        };
      }

      return {
        canUse: true,
        isReady: true,
        turnsRemaining: 0,
        cooldownState: 'ready',
      };
    },

    consumeAmmo(
      unit: BattleUnit & UnitWithAmmunition,
      _state: BattleState,
      amount: number = 1,
    ): AmmoConsumeResult {
      const resourceType = this.getResourceType(unit);

      // Non-ranged units don't consume ammo
      if (resourceType !== 'ammo') {
        return {
          success: true,
          ammoConsumed: 0,
          ammoRemaining: Infinity,
          newState: 'full',
          unit: unit as BattleUnit & UnitWithAmmunition,
        };
      }

      // Unlimited ammo units don't consume
      if (hasUnlimitedAmmo(unit, unlimitedAmmoTags)) {
        return {
          success: true,
          ammoConsumed: 0,
          ammoRemaining: Infinity,
          newState: 'full',
          unit: unit as BattleUnit & UnitWithAmmunition,
        };
      }

      // Check if reloading
      if (unit.isReloading) {
        return {
          success: false,
          ammoConsumed: 0,
          ammoRemaining: 0,
          newState: 'reloading',
          unit: unit as BattleUnit & UnitWithAmmunition,
          reason: 'reloading',
        };
      }

      const currentAmmo = typeof unit.ammo === 'number' ? unit.ammo : defaultAmmo;
      const maxAmmo = typeof unit.maxAmmo === 'number' ? unit.maxAmmo : defaultAmmo;

      // Check if enough ammo
      if (currentAmmo < amount) {
        return {
          success: false,
          ammoConsumed: 0,
          ammoRemaining: currentAmmo,
          newState: calculateAmmoState(currentAmmo, maxAmmo),
          unit: unit as BattleUnit & UnitWithAmmunition,
          reason: 'no_ammo',
        };
      }

      // Consume ammo
      const newAmmo = currentAmmo - amount;
      const newState = calculateAmmoState(newAmmo, maxAmmo);

      const updatedUnit: BattleUnit & UnitWithAmmunition = {
        ...unit,
        ammo: newAmmo,
        ammoState: newState,
      };

      return {
        success: true,
        ammoConsumed: amount,
        ammoRemaining: newAmmo,
        newState,
        unit: updatedUnit,
      };
    },

    triggerCooldown(
      unit: BattleUnit & UnitWithAmmunition,
      abilityId: string,
      _state: BattleState,
      duration?: number,
    ): CooldownTriggerResult {
      const resourceType = this.getResourceType(unit);

      // Non-mage units don't use cooldowns
      if (resourceType !== 'cooldown') {
        return {
          success: true,
          abilityId,
          cooldownDuration: 0,
          unit: unit as BattleUnit & UnitWithAmmunition,
        };
      }

      // Calculate cooldown duration
      let cooldownDuration = duration ?? unit.defaultCooldown ?? defaultCooldown;

      // Quick cooldown reduces duration by 1
      if (hasQuickCooldownTag(unit)) {
        cooldownDuration = Math.max(1, cooldownDuration - 1);
      }

      // Update cooldowns
      const currentCooldowns = unit.cooldowns ?? {};
      const newCooldowns = {
        ...currentCooldowns,
        [abilityId]: cooldownDuration,
      };

      const updatedUnit: BattleUnit & UnitWithAmmunition = {
        ...unit,
        cooldowns: newCooldowns,
      };

      return {
        success: true,
        abilityId,
        cooldownDuration,
        unit: updatedUnit,
      };
    },

    reload(
      unit: BattleUnit & UnitWithAmmunition,
      _state: BattleState,
      amount?: number,
    ): ReloadResult {
      const resourceType = this.getResourceType(unit);

      // Non-ranged units can't reload
      if (resourceType !== 'ammo') {
        return {
          success: false,
          ammoRestored: 0,
          newAmmo: 0,
          newState: 'empty',
          unit: unit as BattleUnit & UnitWithAmmunition,
          reason: 'not_ranged',
        };
      }

      // Unlimited ammo units don't need to reload
      if (hasUnlimitedAmmo(unit, unlimitedAmmoTags)) {
        return {
          success: true,
          ammoRestored: 0,
          newAmmo: Infinity,
          newState: 'full',
          unit: unit as BattleUnit & UnitWithAmmunition,
        };
      }

      const currentAmmo = typeof unit.ammo === 'number' ? unit.ammo : 0;
      const maxAmmo = typeof unit.maxAmmo === 'number' ? unit.maxAmmo : defaultAmmo;

      // Check if already full
      if (currentAmmo >= maxAmmo) {
        return {
          success: false,
          ammoRestored: 0,
          newAmmo: currentAmmo,
          newState: 'full',
          unit: unit as BattleUnit & UnitWithAmmunition,
          reason: 'already_full',
        };
      }

      // Check if already reloading
      if (unit.isReloading) {
        return {
          success: false,
          ammoRestored: 0,
          newAmmo: currentAmmo,
          newState: 'reloading',
          unit: unit as BattleUnit & UnitWithAmmunition,
          reason: 'already_reloading',
        };
      }

      // Calculate reload amount
      const reloadAmount = amount ?? maxAmmo;
      const newAmmo = Math.min(maxAmmo, currentAmmo + reloadAmount);
      const ammoRestored = newAmmo - currentAmmo;
      const newState = calculateAmmoState(newAmmo, maxAmmo);

      const updatedUnit: BattleUnit & UnitWithAmmunition = {
        ...unit,
        ammo: newAmmo,
        ammoState: newState,
        isReloading: false,
      };

      return {
        success: true,
        ammoRestored,
        newAmmo,
        newState,
        unit: updatedUnit,
      };
    },

    tickCooldowns(unit: BattleUnit & UnitWithAmmunition): CooldownTickResult {
      const cooldowns = unit.cooldowns ?? {};
      const abilitiesReady: string[] = [];
      const abilitiesStillCooling: string[] = [];
      const cooldownsReduced: Record<string, number> = {};

      // Tick amount (quick cooldown reduces by 2 instead of 1)
      const tickAmount = hasQuickCooldownTag(unit) ? 2 : 1;

      // Reduce each cooldown
      for (const [abilityId, turnsRemaining] of Object.entries(cooldowns)) {
        const newTurns = Math.max(0, turnsRemaining - tickAmount);
        cooldownsReduced[abilityId] = newTurns;

        if (newTurns <= 0) {
          abilitiesReady.push(abilityId);
        } else {
          abilitiesStillCooling.push(abilityId);
        }
      }

      const updatedUnit: BattleUnit & UnitWithAmmunition = {
        ...unit,
        cooldowns: cooldownsReduced,
      };

      return {
        abilitiesReady,
        abilitiesStillCooling,
        cooldownsReduced,
        unit: updatedUnit,
      };
    },

    getAmmoState(unit: BattleUnit & UnitWithAmmunition): AmmoState {
      if (unit.ammoState !== undefined) {
        return unit.ammoState;
      }

      const resourceType = this.getResourceType(unit);
      if (resourceType !== 'ammo') {
        return 'full';
      }

      if (hasUnlimitedAmmo(unit, unlimitedAmmoTags)) {
        return 'full';
      }

      const currentAmmo = typeof unit.ammo === 'number' ? unit.ammo : defaultAmmo;
      const maxAmmo = typeof unit.maxAmmo === 'number' ? unit.maxAmmo : defaultAmmo;
      return calculateAmmoState(currentAmmo, maxAmmo, unit.isReloading);
    },

    getCooldownState(
      unit: BattleUnit & UnitWithAmmunition,
      abilityId: string,
    ): CooldownState {
      const resourceType = this.getResourceType(unit);
      if (resourceType !== 'cooldown') {
        return 'ready';
      }

      const cooldowns = unit.cooldowns ?? {};
      const turnsRemaining = cooldowns[abilityId] ?? 0;
      return calculateCooldownState(turnsRemaining);
    },

    initializeUnit(
      unit: BattleUnit & UnitWithAmmunition,
      ammoConfig: AmmoConfig,
    ): BattleUnit & UnitWithAmmunition {
      const resourceType = this.getResourceType(unit);

      if (resourceType === 'ammo') {
        const maxAmmo = typeof unit.maxAmmo === 'number' 
          ? unit.maxAmmo 
          : ammoConfig.defaultAmmo ?? defaultAmmo;
        return {
          ...unit,
          resourceType: 'ammo',
          ammo: maxAmmo,
          maxAmmo,
          ammoState: 'full',
          hasUnlimitedAmmo: hasUnlimitedAmmo(unit, unlimitedAmmoTags),
        };
      }

      if (resourceType === 'cooldown') {
        return {
          ...unit,
          resourceType: 'cooldown',
          cooldowns: unit.cooldowns ?? {},
          defaultCooldown: unit.defaultCooldown ?? ammoConfig.defaultCooldown ?? defaultCooldown,
          hasQuickCooldown: hasQuickCooldownTag(unit),
        };
      }

      return {
        ...unit,
        resourceType: 'none',
      };
    },
  };
}

export default createAmmunitionProcessor;
