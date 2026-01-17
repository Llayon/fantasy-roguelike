/**
 * Game abilities module exports.
 * @fileoverview Ability definitions for Fantasy Roguelike.
 */

export {
  GameAbilityId,
  ABILITIES,
  getAbility,
  getActiveAbilities,
  getPassiveAbilities,
  getAllAbilityIds,
  hasAbility,
  getAbilitiesByEffectType,
  getAbilitiesByTargetType,
  calculateCooldownReduction,
  getFormattedDescription,
  isOnCooldown,
  isInAbilityRange,
  UNIT_ABILITY_MAP,
  getUnitAbility,
  unitHasActiveAbility,
  unitHasPassiveAbility,
} from './ability.data';
