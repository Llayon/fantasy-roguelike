/**
 * Core Mechanics 2.0 - Default Configurations
 *
 * @module core/mechanics/config
 */

import type {
  ResolveConfig,
  EngagementConfig,
  RiposteConfig,
  InterceptConfig,
  ChargeConfig,
  PhalanxConfig,
  LoSConfig,
  AmmoConfig,
  ContagionConfig,
  ShredConfig,
} from './mechanics.types';

export const DEFAULT_RESOLVE_CONFIG: ResolveConfig = {
  maxResolve: 100,
  baseRegeneration: 5,
  humanRetreat: true,
  undeadCrumble: true,
  flankingResolveDamage: 12,
  rearResolveDamage: 20,
};

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  attackOfOpportunity: true,
  archerPenalty: true,
  archerPenaltyPercent: 0.5,
};

export const DEFAULT_RIPOSTE_CONFIG: RiposteConfig = {
  initiativeBased: true,
  chargesPerRound: 'attackCount',
  baseChance: 0.5,
  guaranteedThreshold: 10,
};

export const DEFAULT_INTERCEPT_CONFIG: InterceptConfig = {
  hardIntercept: true,
  softIntercept: true,
  disengageCost: 2,
};

export const DEFAULT_CHARGE_CONFIG: ChargeConfig = {
  momentumPerCell: 0.2,
  maxMomentum: 1.0,
  shockResolveDamage: 10,
  minChargeDistance: 3,
};

export const DEFAULT_PHALANX_CONFIG: PhalanxConfig = {
  maxArmorBonus: 5,
  maxResolveBonus: 25,
  armorPerAlly: 1,
  resolvePerAlly: 5,
};

export const DEFAULT_LOS_CONFIG: LoSConfig = {
  directFire: true,
  arcFire: true,
  arcFirePenalty: 0.2,
};

export const DEFAULT_AMMO_CONFIG: AmmoConfig = {
  enabled: true,
  mageCooldowns: true,
  defaultAmmo: 6,
  defaultCooldown: 3,
};

export const DEFAULT_CONTAGION_CONFIG: ContagionConfig = {
  fireSpread: 0.5,
  poisonSpread: 0.3,
  curseSpread: 0.25,
  frostSpread: 0.2,
  plagueSpread: 0.6,
  phalanxSpreadBonus: 0.15,
};

export const DEFAULT_SHRED_CONFIG: ShredConfig = {
  shredPerAttack: 1,
  maxShredPercent: 0.4,
  decayPerTurn: 2,
};
