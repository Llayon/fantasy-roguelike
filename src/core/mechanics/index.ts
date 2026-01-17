/**
 * Core Mechanics 2.0 - Public API
 *
 * Modular battle mechanics with feature flags for the autobattler engine.
 * All mechanics are optional and can be enabled/disabled independently.
 *
 * @module core/mechanics
 */

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════

export type {
  MechanicsConfig,
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
} from './config/mechanics.types';

// ═══════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

export {
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
} from './config/defaults';

// ═══════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════

export { MVP_PRESET } from './config/presets/mvp';
export { ROGUELIKE_PRESET } from './config/presets/roguelike';
export { TACTICAL_PRESET } from './config/presets/tactical';

// ═══════════════════════════════════════════════════════════════
// DEPENDENCY RESOLUTION
// ═══════════════════════════════════════════════════════════════

export {
  MECHANIC_DEPENDENCIES,
  resolveDependencies,
  getDefaultConfig,
} from './config/dependencies';

// ═══════════════════════════════════════════════════════════════
// CONFIG VALIDATION
// ═══════════════════════════════════════════════════════════════

export { validateMechanicsConfig } from './config/validator';
export type { ValidationResult } from './config/validator';

// ═══════════════════════════════════════════════════════════════
// TIER 0: FACING
// ═══════════════════════════════════════════════════════════════

export { createFacingProcessor } from './tier0/facing';
export type {
  FacingProcessor,
  FacingDirection,
  AttackArc,
  FacingContext,
  FacingResult,
} from './tier0/facing';

// ═══════════════════════════════════════════════════════════════
// TIER 1: FLANKING, RESOLVE, ENGAGEMENT
// ═══════════════════════════════════════════════════════════════

export {
  createFlankingProcessor,
  FLANKING_DAMAGE_MODIFIERS,
  DEFAULT_FLANKING_RESOLVE_DAMAGE,
} from './tier1/flanking';
export type { FlankingProcessor, FlankingResult, FlankingProcessorOptions } from './tier1/flanking';

// Resolve
export {
  createResolveProcessor,
  RESOLVE_DAMAGE_ADJACENT,
  RESOLVE_DAMAGE_NEARBY,
  RESOLVE_DAMAGE_NEARBY_RANGE,
} from './tier1/resolve';
export type {
  ResolveProcessor,
  MechanicsResolveState,
  UnitWithResolve,
  ResolveFaction,
  ResolveDamageSource,
  ResolveRegenerateResult,
  ResolveDamageResult,
  ResolveStateCheckResult,
} from './tier1/resolve';

// Engagement (Zone of Control)
export {
  createEngagementProcessor,
  AOO_HIT_CHANCE,
  AOO_DAMAGE_MULTIPLIER,
} from './tier1/engagement';
export type {
  EngagementProcessor,
  EngagementStatus,
  UnitWithEngagement,
  ZoneOfControl,
  ZoCCheckResult,
  AoOTrigger,
  AoOResult,
} from './tier1/engagement';

// ═══════════════════════════════════════════════════════════════
// TIER 2: RIPOSTE, INTERCEPT, AURA
// ═══════════════════════════════════════════════════════════════

export {
  createRiposteProcessor,
  RIPOSTE_DAMAGE_MULTIPLIER,
  MIN_RIPOSTE_CHANCE,
  MAX_RIPOSTE_CHANCE,
} from './tier2/riposte';
export type {
  RiposteProcessor,
  UnitWithRiposte,
  RiposteEligibility,
  RiposteBlockReason,
  RiposteChanceResult,
  RiposteExecutionResult,
  RiposteProcessorOptions,
  RiposteContext,
  RiposteCheckResult,
} from './tier2/riposte';

// Note: Riposte event types (RiposteTriggeredEvent, etc.) are defined in core/types/events.ts
// to maintain a single source of truth for all battle events.

// Intercept
export {
  createInterceptProcessor,
  HARD_INTERCEPT_DAMAGE_MULTIPLIER,
  DEFAULT_DISENGAGE_COST,
  HARD_INTERCEPT_TAG,
  CAVALRY_TAG as INTERCEPT_CAVALRY_TAG,
} from './tier2/intercept';
export type {
  InterceptProcessor,
  InterceptType,
  InterceptResult,
  UnitWithIntercept,
  InterceptOpportunity,
  InterceptBlockReason,
  InterceptCheckResult,
  InterceptExecutionResult,
  DisengageResult,
  DisengageFailReason,
} from './tier2/intercept';

// ═══════════════════════════════════════════════════════════════
// TIER 3: AMMUNITION, CHARGE, PHALANX, LOS, OVERWATCH
// ═══════════════════════════════════════════════════════════════

export { createAmmunitionProcessor } from './tier3/ammunition';
export type {
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
  AmmoBlockReason,
  CooldownBlockReason,
  ReloadBlockReason,
} from './tier3/ammunition';
export {
  DEFAULT_AMMO_COUNT,
  DEFAULT_COOLDOWN_DURATION,
  RANGED_TAG,
  MAGE_TAG,
  UNLIMITED_AMMO_TAG,
  QUICK_COOLDOWN_TAG,
} from './tier3/ammunition';

// ═══════════════════════════════════════════════════════════════
// TIER 3: CHARGE (CAVALRY MOMENTUM)
// ═══════════════════════════════════════════════════════════════

export { createChargeProcessor } from './tier3/charge';
export type {
  ChargeProcessor,
  UnitWithCharge,
  ChargeEligibility,
  ChargeBlockReason,
  SpearWallCounterResult,
  ChargeExecutionResult,
} from './tier3/charge';
export {
  DEFAULT_MOMENTUM_PER_CELL,
  DEFAULT_MAX_MOMENTUM,
  DEFAULT_MIN_CHARGE_DISTANCE,
  DEFAULT_SHOCK_RESOLVE_DAMAGE,
  SPEAR_WALL_COUNTER_MULTIPLIER,
  SPEAR_WALL_TAG,
  CAVALRY_TAG,
  CHARGE_TAG,
} from './tier3/charge';

// ═══════════════════════════════════════════════════════════════
// TIER 3: PHALANX (FORMATION BONUSES)
// ═══════════════════════════════════════════════════════════════

export { createPhalanxProcessor } from './tier3/phalanx';
export type {
  PhalanxProcessor,
  UnitWithPhalanx,
  PhalanxFormationState,
  PhalanxEligibility,
  PhalanxBlockReason,
  FormationDetectionResult,
  PhalanxBonusResult,
  PhalanxRecalculationResult,
  RecalculationTrigger,
  AdjacentAlly,
} from './tier3/phalanx';
export {
  PHALANX_TAG,
  ELITE_PHALANX_TAG,
  PHALANX_IMMUNE_TAG,
  DEFAULT_MAX_ARMOR_BONUS,
  DEFAULT_MAX_RESOLVE_BONUS,
  DEFAULT_ARMOR_PER_ALLY,
  DEFAULT_RESOLVE_PER_ALLY,
  MAX_ADJACENT_ALLIES,
  ORTHOGONAL_OFFSETS,
} from './tier3/phalanx';

// ═══════════════════════════════════════════════════════════════
// TIER 3: LINE OF SIGHT (RANGED BLOCKING)
// ═══════════════════════════════════════════════════════════════

export { createLoSProcessor } from './tier3/los';
export type {
  LoSProcessor,
  UnitWithLoS,
  FireType,
  LoSBlockStatus,
  LoSCheckResult,
  LoSPathResult,
  LoSPathCell,
  LoSProcessorOptions,
  LoSBlockReason,
} from './tier3/los';
export {
  DEFAULT_ARC_FIRE_PENALTY,
  PARTIAL_COVER_HIT_CHANCE,
  COVER_DODGE_BONUS,
  ARC_FIRE_TAG,
  SIEGE_TAG,
  IGNORE_LOS_TAG,
  ARC_FIRE_MIN_RANGE,
} from './tier3/los';

// ═══════════════════════════════════════════════════════════════
// TIER 4: CONTAGION (STATUS EFFECT SPREADING)
// ═══════════════════════════════════════════════════════════════

export { createContagionProcessor } from './tier4/contagion';
export type {
  ContagionProcessor,
  UnitWithContagion,
  ContagionEffectType,
  StatusEffect,
  SpreadEligibility,
  SpreadBlockReason,
  SpreadAttemptResult,
  ContagionSpreadResult,
  AdjacentTarget,
} from './tier4/contagion';
export {
  CONTAGION_IMMUNE_TAG,
  NO_SPREAD_TAG,
  MIN_SPREAD_DURATION,
  DEFAULT_FIRE_SPREAD,
  DEFAULT_POISON_SPREAD,
  DEFAULT_CURSE_SPREAD,
  DEFAULT_FROST_SPREAD,
  DEFAULT_PLAGUE_SPREAD,
  DEFAULT_FEAR_SPREAD,
  DEFAULT_PHALANX_SPREAD_BONUS,
} from './tier4/contagion';

// ═══════════════════════════════════════════════════════════════
// TIER 4: ARMOR SHRED (ARMOR DEGRADATION)
// ═══════════════════════════════════════════════════════════════

export { createArmorShredProcessor } from './tier4/armor-shred';
export type {
  ArmorShredProcessor,
  UnitWithArmorShred,
  ShredApplicationResult,
  ShredDecayResult,
  ArmorShredDecayResult,
  ArmorShredAttackResult,
  EffectiveArmorResult,
  ShredDecaySkipReason,
} from './tier4/armor-shred';
export {
  DEFAULT_SHRED_PER_ATTACK,
  DEFAULT_MAX_SHRED_PERCENT,
  DEFAULT_DECAY_PER_TURN,
  SHRED_IMMUNE_TAG,
  ARMORED_TAG,
  ARMORED_SHRED_CAP_PERCENT,
} from './tier4/armor-shred';

// ═══════════════════════════════════════════════════════════════
// NOTE: Additional tier3 mechanic processor (Overwatch)
// will be implemented in subsequent tasks
// ═══════════════════════════════════════════════════════════════
