/**
 * Roguelike Preset - All mechanics enabled
 *
 * @module core/mechanics/config/presets
 */

import type { MechanicsConfig } from '../mechanics.types';

/**
 * Roguelike Preset: All mechanics enabled with balanced defaults.
 */
export const ROGUELIKE_PRESET: MechanicsConfig = {
  facing: true,
  resolve: {
    maxResolve: 100,
    baseRegeneration: 5,
    humanRetreat: true,
    undeadCrumble: true,
    flankingResolveDamage: 12,
    rearResolveDamage: 20,
  },
  engagement: {
    attackOfOpportunity: true,
    archerPenalty: true,
    archerPenaltyPercent: 0.5,
  },
  flanking: true,
  riposte: {
    initiativeBased: true,
    chargesPerRound: 'attackCount',
    baseChance: 0.5,
    guaranteedThreshold: 10,
  },
  intercept: {
    hardIntercept: true,
    softIntercept: true,
    disengageCost: 2,
  },
  aura: true,
  charge: {
    momentumPerCell: 0.2,
    maxMomentum: 1.0,
    shockResolveDamage: 10,
    minChargeDistance: 3,
  },
  overwatch: true,
  phalanx: {
    maxArmorBonus: 10,
    maxResolveBonus: 20,
    armorPerAlly: 5,
    resolvePerAlly: 10,
  },
  lineOfSight: {
    directFire: true,
    arcFire: true,
    arcFirePenalty: 0.2,
  },
  ammunition: {
    enabled: true,
    mageCooldowns: true,
    defaultAmmo: 6,
    defaultCooldown: 3,
  },
  contagion: {
    fireSpread: 0.5,
    poisonSpread: 0.3,
    curseSpread: 0.25,
    frostSpread: 0.2,
    plagueSpread: 0.6,
    phalanxSpreadBonus: 0.15,
  },
  armorShred: {
    shredPerAttack: 1,
    maxShredPercent: 0.4,
    decayPerTurn: 0,
  },
};
