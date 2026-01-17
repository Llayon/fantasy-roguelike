/**
 * Tier 2: Riposte (Counter-attack) Mechanic
 *
 * Allows defenders to counter-attack when hit from the front arc.
 * Riposte is disabled when attacked from flank or rear.
 *
 * @module core/mechanics/tier2/riposte
 */

export { createRiposteProcessor, default } from './riposte.processor';
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
} from './riposte.types';
export {
  RIPOSTE_DAMAGE_MULTIPLIER,
  MIN_RIPOSTE_CHANCE,
  MAX_RIPOSTE_CHANCE,
} from './riposte.types';

// Note: Event types (RiposteTriggeredEvent, etc.) are defined in core/types/events.ts
// to avoid duplication and maintain a single source of truth for event types.
