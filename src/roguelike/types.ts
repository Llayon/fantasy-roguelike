/**
 * Core Progression Types
 *
 * Base types for deck, hand, draft, upgrade, economy, run, and snapshot systems.
 *
 * @module roguelike/types
 */

// ═══════════════════════════════════════════════════════════════
// BASE CARD INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Base interface for any card type.
 * Games extend this with their specific properties.
 */
export interface BaseCard {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Base cost (for economy) */
  baseCost: number;

  /** Current tier (for upgrades), starts at 1 */
  tier: number;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Result type for operations that can fail.
 */
export interface Result<T> {
  success: boolean;
  value?: T;
  error?: string;
}

/**
 * Generic ID generator function type.
 */
export type IdGenerator = () => string;

/**
 * Default ID generator using crypto.randomUUID or fallback.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════════════════════
// DECK TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Configuration for deck behavior.
 */
export interface DeckConfig<TCard extends BaseCard> {
  maxDeckSize: number;
  minDeckSize: number;
  allowDuplicates: boolean;
  maxCopies: number;
  validateCard?: (card: TCard) => boolean;
}

/**
 * Deck state containing cards and configuration.
 */
export interface Deck<TCard extends BaseCard> {
  cards: TCard[];
  config: DeckConfig<TCard>;
}

/**
 * Result of deck validation.
 */
export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════
// DRAFT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Draft type determines available actions.
 */
export type DraftType = 'pick' | 'ban' | 'pick-and-ban';

/**
 * Configuration for draft behavior.
 */
export interface DraftConfig {
  optionsCount: number;
  picksCount: number;
  type: DraftType;
  allowSkip: boolean;
  rerollsAllowed: number;
}

/**
 * Draft state containing pool, options, and picks.
 */
export interface Draft<TCard extends BaseCard> {
  pool: TCard[];
  options: TCard[];
  picked: TCard[];
  banned: TCard[];
  config: DraftConfig;
  rerollsUsed: number;
  seed: number;
}

/**
 * Result of a completed draft.
 */
export interface DraftResult<TCard extends BaseCard> {
  picked: TCard[];
  banned: TCard[];
  skipped: boolean;
}

// ═══════════════════════════════════════════════════════════════
// RUN TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Run phase types.
 */
export type RunPhase = 'draft' | 'battle' | 'shop' | 'event' | 'boss' | 'rest';

/**
 * Run status.
 */
export type RunStatus = 'active' | 'won' | 'lost';

/**
 * Configuration for run behavior.
 */
export interface RunConfig {
  winsToComplete: number;
  maxLosses: number;
  phases: RunPhase[];
  trackStreaks: boolean;
  enableRating: boolean;
}

/**
 * Run event for history tracking.
 */
export interface RunEvent {
  type: 'win' | 'loss' | 'phase_change' | 'draft' | 'shop';
  timestamp: number;
  data?: unknown;
}

/**
 * Run state containing progress and history.
 */
export interface Run<TState> {
  id: string;
  config: RunConfig;
  wins: number;
  losses: number;
  currentPhaseIndex: number;
  winStreak: number;
  loseStreak: number;
  status: RunStatus;
  state: TState;
  history: RunEvent[];
}

/**
 * Run statistics.
 */
export interface RunStats {
  wins: number;
  losses: number;
  winRate: number;
  longestWinStreak: number;
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Cleanup strategy for snapshot pool.
 */
export type CleanupStrategy = 'oldest' | 'lowest-rating' | 'random';

/**
 * Configuration for snapshot behavior.
 */
export interface SnapshotConfig {
  expiryMs: number;
  maxSnapshotsPerPlayer: number;
  includeFullState: boolean;
  maxTotalSnapshots: number;
  cleanupStrategy: CleanupStrategy;
}

/**
 * Snapshot of a player's run state.
 */
export interface Snapshot<TState> {
  id: string;
  playerId: string;
  runId: string;
  wins: number;
  losses: number;
  rating: number;
  state: TState;
  createdAt: number;
  sizeBytes?: number | undefined;
}

/**
 * Configuration for matchmaking behavior.
 */
export interface MatchmakingConfig {
  ratingRange: number;
  winsRange: number;
  botFallback: boolean;
  botDifficultyScale: (wins: number) => number;
}

/**
 * Configuration for bot generation.
 */
export interface BotConfig {
  baseDifficulty: number;
  difficultyPerWin: number;
  maxDifficulty: number;
  nameGenerator?: (wins: number) => string;
}

/**
 * Statistics about the snapshot pool.
 */
export interface SnapshotPoolStats {
  totalCount: number;
  totalSizeBytes: number;
  oldestTimestamp: number;
  byWins: Map<number, number>;
}
