/**
 * Tier 3: Phalanx (Formation) - Public API
 *
 * Provides defensive bonuses to units in tight formations.
 * Units gain armor and resolve bonuses based on adjacent allies.
 *
 * @module core/mechanics/tier3/phalanx
 */

export { createPhalanxProcessor, default } from './phalanx.processor';
export type { PhalanxProcessor } from './phalanx.types';
export type {
  UnitWithPhalanx,
  PhalanxFormationState,
  PhalanxEligibility,
  PhalanxBlockReason,
  FormationDetectionResult,
  PhalanxBonusResult,
  PhalanxRecalculationResult,
  RecalculationTrigger,
  AdjacentAlly,
} from './phalanx.types';
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
} from './phalanx.types';
