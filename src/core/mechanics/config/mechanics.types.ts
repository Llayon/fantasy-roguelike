/**
 * Core Mechanics 2.0 - Configuration Types
 *
 * Defines all configuration interfaces for the modular mechanics system.
 *
 * @module core/mechanics/config
 */

// ═══════════════════════════════════════════════════════════════
// TIER 1: RESOLVE (MORALE) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve (Morale) system configuration.
 */
export interface ResolveConfig {
  maxResolve: number;
  baseRegeneration: number;
  humanRetreat: boolean;
  undeadCrumble: boolean;
  flankingResolveDamage: number;
  rearResolveDamage: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 1: ENGAGEMENT (ZONE OF CONTROL) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Engagement (Zone of Control) configuration.
 */
export interface EngagementConfig {
  attackOfOpportunity: boolean;
  archerPenalty: boolean;
  archerPenaltyPercent: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 2: RIPOSTE (COUNTER-ATTACK) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Riposte (Counter-attack) configuration.
 */
export interface RiposteConfig {
  initiativeBased: boolean;
  chargesPerRound: number | 'attackCount';
  baseChance: number;
  guaranteedThreshold: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 2: INTERCEPT CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Intercept configuration.
 */
export interface InterceptConfig {
  hardIntercept: boolean;
  softIntercept: boolean;
  disengageCost: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 3: CHARGE (CAVALRY MOMENTUM) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Charge (Cavalry momentum) configuration.
 */
export interface ChargeConfig {
  momentumPerCell: number;
  maxMomentum: number;
  shockResolveDamage: number;
  minChargeDistance: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 3: PHALANX (FORMATION) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Phalanx (Formation) configuration.
 */
export interface PhalanxConfig {
  maxArmorBonus: number;
  maxResolveBonus: number;
  armorPerAlly: number;
  resolvePerAlly: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 3: LINE OF SIGHT CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Line of Sight configuration.
 */
export interface LoSConfig {
  directFire: boolean;
  arcFire: boolean;
  arcFirePenalty: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 3: AMMUNITION & COOLDOWN CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Ammunition & Cooldown configuration.
 */
export interface AmmoConfig {
  enabled: boolean;
  mageCooldowns: boolean;
  defaultAmmo: number;
  defaultCooldown: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 4: CONTAGION (EFFECT SPREADING) CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Contagion (Effect spreading) configuration.
 */
export interface ContagionConfig {
  fireSpread: number;
  poisonSpread: number;
  curseSpread: number;
  frostSpread: number;
  plagueSpread: number;
  phalanxSpreadBonus: number;
}

// ═══════════════════════════════════════════════════════════════
// TIER 4: ARMOR SHRED CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Armor Shred configuration.
 */
export interface ShredConfig {
  shredPerAttack: number;
  maxShredPercent: number;
  decayPerTurn: number;
}

// ═══════════════════════════════════════════════════════════════
// MAIN MECHANICS CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/**
 * Complete mechanics configuration.
 */
export interface MechanicsConfig {
  facing: boolean;
  resolve: ResolveConfig | false;
  engagement: EngagementConfig | false;
  flanking: boolean;
  riposte: RiposteConfig | false;
  intercept: InterceptConfig | false;
  aura: boolean;
  charge: ChargeConfig | false;
  overwatch: boolean;
  phalanx: PhalanxConfig | false;
  lineOfSight: LoSConfig | false;
  ammunition: AmmoConfig | false;
  contagion: ContagionConfig | false;
  armorShred: ShredConfig | false;
}
