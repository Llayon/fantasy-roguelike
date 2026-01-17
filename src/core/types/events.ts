/**
 * Battle event type definitions for the Core 2.0 battle engine.
 * Contains all event interfaces and factory functions for battle replay.
 *
 * Events are the primary mechanism for:
 * - Battle replay (frontend reconstructs battle from events)
 * - Debugging (events provide full audit trail)
 * - Analytics (events can be aggregated for statistics)
 *
 * @module core/types/events
 * @see {@link BattleState} for state structure
 * @see {@link Phase} for phase definitions
 *
 * @example
 * import { createAttackEvent, createMoveEvent, BattleEventType } from './events';
 *
 * // Create an attack event
 * const attackEvent = createAttackEvent({
 *   round: 3,
 *   turn: 7,
 *   actorId: 'player_knight_0',
 *   targetId: 'enemy_rogue_0',
 *   damage: 15,
 *   damageType: 'physical',
 * });
 */

import { FacingDirection } from './battle-unit';
import { Position } from './grid.types';

// =============================================================================
// PHASE TYPE (re-exported for convenience)
// =============================================================================

/**
 * Battle phase identifiers representing the execution order within a turn.
 */
export type Phase =
  | 'turn_start'
  | 'ai_decision'
  | 'movement'
  | 'pre_attack'
  | 'attack'
  | 'post_attack'
  | 'turn_end';

// =============================================================================
// EVENT TYPE CONSTANTS
// =============================================================================

/**
 * All possible battle event types.
 * Use this for type-safe event type checking.
 */
export const BATTLE_EVENT_TYPES = {
  // Core battle events
  BATTLE_START: 'battle_start',
  BATTLE_END: 'battle_end',
  ROUND_START: 'round_start',
  ROUND_END: 'round_end',
  TURN_START: 'turn_start',
  TURN_END: 'turn_end',

  // Movement events
  MOVE: 'move',
  INTERCEPT_TRIGGERED: 'intercept_triggered',
  ENGAGEMENT_CHANGED: 'engagement_changed',

  // Combat events
  ATTACK: 'attack',
  DAMAGE: 'damage',
  DODGE: 'dodge',
  UNIT_DIED: 'unit_died',

  // Mechanic events - Tier 0
  FACING_ROTATED: 'facing_rotated',

  // Mechanic events - Tier 1
  FLANKING_APPLIED: 'flanking_applied',
  RESOLVE_CHANGED: 'resolve_changed',
  ROUTING_STARTED: 'routing_started',
  UNIT_RALLIED: 'unit_rallied',

  // Mechanic events - Tier 2
  RIPOSTE_TRIGGERED: 'riposte_triggered',
  RIPOSTE_RESET: 'riposte_reset',
  AURA_PULSE: 'aura_pulse',

  // Mechanic events - Tier 3
  AMMO_CONSUMED: 'ammo_consumed',
  CHARGE_STARTED: 'charge_started',
  CHARGE_IMPACT: 'charge_impact',
  PHALANX_FORMED: 'phalanx_formed',
  PHALANX_BROKEN: 'phalanx_broken',
  OVERWATCH_SET: 'overwatch_set',
  OVERWATCH_TRIGGERED: 'overwatch_triggered',
  LOS_BLOCKED: 'los_blocked',

  // Mechanic events - Tier 4
  CONTAGION_SPREAD: 'contagion_spread',
  ARMOR_SHRED_APPLIED: 'armor_shred_applied',
  SHRED_DECAYED: 'shred_decayed',

  // Ability events
  ABILITY_USED: 'ability_used',
  STATUS_APPLIED: 'status_applied',
  STATUS_REMOVED: 'status_removed',
  COOLDOWN_TICKED: 'cooldown_ticked',
} as const;

/**
 * Union type of all event type strings.
 */
export type BattleEventType = (typeof BATTLE_EVENT_TYPES)[keyof typeof BATTLE_EVENT_TYPES];


// =============================================================================
// BASE EVENT INTERFACE
// =============================================================================

/**
 * Base event structure for all battle events.
 * All events must include these fields for proper ordering and context.
 *
 * @see {@link MechanicEvent} for mechanic-specific event types
 * @see {@link BattleState.events} for event storage
 *
 * @example
 * const event: BaseBattleEvent = {
 *   type: 'attack',
 *   round: 3,
 *   turn: 7,
 *   phase: 'attack',
 *   timestamp: 1234567890,
 * };
 */
export interface BaseBattleEvent {
  /** Event type identifier */
  type: string;

  /** Battle round (1-based) */
  round: number;

  /** Turn within round (1-based) */
  turn: number;

  /** Phase when event occurred */
  phase: Phase;

  /** Monotonic timestamp for ordering events */
  timestamp: number;
}

/**
 * Generic battle event with optional actor and target.
 * Extends BaseBattleEvent with common fields.
 */
export interface BattleEvent extends BaseBattleEvent {
  /** Instance ID of the unit performing the action (if applicable) */
  actorId?: string;

  /** Instance ID of the target unit (if applicable) */
  targetId?: string;

  /** Additional event-specific data */
  metadata: Record<string, unknown>;
}

// =============================================================================
// CORE BATTLE EVENTS
// =============================================================================

/**
 * Event emitted when a battle starts.
 */
export interface BattleStartEvent extends BaseBattleEvent {
  type: 'battle_start';
  metadata: {
    battleId: string;
    seed: number;
    playerUnitCount: number;
    enemyUnitCount: number;
  };
}

/**
 * Event emitted when a battle ends.
 */
export interface BattleEndEvent extends BaseBattleEvent {
  type: 'battle_end';
  metadata: {
    result: 'win' | 'loss' | 'draw';
    winner: 'player' | 'enemy' | null;
    totalRounds: number;
    playerSurvivors: number;
    enemySurvivors: number;
  };
}

/**
 * Event emitted at the start of a new round.
 */
export interface RoundStartEvent extends BaseBattleEvent {
  type: 'round_start';
  metadata: {
    roundNumber: number;
    turnQueueOrder: string[];
  };
}

/**
 * Event emitted at the end of a round.
 */
export interface RoundEndEvent extends BaseBattleEvent {
  type: 'round_end';
  metadata: {
    roundNumber: number;
    playerUnitsAlive: number;
    enemyUnitsAlive: number;
  };
}

/**
 * Event emitted at the start of a unit's turn.
 */
export interface TurnStartEvent extends BaseBattleEvent {
  type: 'turn_start';
  actorId: string;
  metadata: {
    unitId: string;
    turnNumber: number;
  };
}

/**
 * Event emitted at the end of a unit's turn.
 */
export interface TurnEndEvent extends BaseBattleEvent {
  type: 'turn_end';
  actorId: string;
  metadata: {
    unitId: string;
    turnNumber: number;
  };
}

// =============================================================================
// MOVEMENT EVENTS
// =============================================================================

/**
 * Event emitted when a unit moves.
 */
export interface MoveEvent extends BaseBattleEvent {
  type: 'move';
  actorId: string;
  metadata: {
    fromPosition: Position;
    toPosition: Position;
    reason: 'normal' | 'routing' | 'charge' | 'ability';
    pathLength: number;
  };
}

/**
 * Event emitted when movement is intercepted.
 */
export interface InterceptTriggeredEvent extends BaseBattleEvent {
  type: 'intercept_triggered';
  actorId: string;
  targetId: string;
  metadata: {
    interceptorId: string;
    movingUnitId: string;
    interceptType: 'hard' | 'soft';
    stoppedAt: Position;
    counterDamage?: number;
  };
}

/**
 * Event emitted when engagement status changes.
 */
export interface EngagementChangedEvent extends BaseBattleEvent {
  type: 'engagement_changed';
  actorId: string;
  metadata: {
    unitId: string;
    engaged: boolean;
    engagedBy: string[];
    reason: 'entered_zoc' | 'left_zoc' | 'unit_died' | 'disengaged';
  };
}


// =============================================================================
// COMBAT EVENTS
// =============================================================================

/**
 * Event emitted when a unit attacks.
 */
export interface AttackEvent extends BaseBattleEvent {
  type: 'attack';
  actorId: string;
  targetId: string;
  metadata: {
    damage: number;
    damageType: 'physical' | 'magic';
    isCritical?: boolean;
    isRiposte?: boolean;
  };
}

/**
 * Event emitted when damage is dealt (separate from attack for clarity).
 */
export interface DamageEvent extends BaseBattleEvent {
  type: 'damage';
  actorId?: string;
  targetId: string;
  metadata: {
    amount: number;
    damageType: 'physical' | 'magic' | 'true';
    source: 'attack' | 'riposte' | 'ability' | 'status' | 'intercept';
    newHp: number;
    maxHp: number;
  };
}

/**
 * Event emitted when an attack is dodged.
 */
export interface DodgeEvent extends BaseBattleEvent {
  type: 'dodge';
  actorId: string;
  targetId: string;
  metadata: {
    dodgeChance: number;
    roll: number;
  };
}

/**
 * Event emitted when a unit dies.
 */
export interface UnitDiedEvent extends BaseBattleEvent {
  type: 'unit_died';
  targetId: string;
  metadata: {
    unitId: string;
    killerId?: string;
    cause: 'damage' | 'riposte' | 'ability' | 'status' | 'crumble' | 'intercept';
    position: Position;
  };
}

// =============================================================================
// TIER 0: FACING EVENTS
// =============================================================================

/**
 * Event emitted when a unit's facing direction changes.
 */
export interface FacingRotatedEvent extends BaseBattleEvent {
  type: 'facing_rotated';
  actorId: string;
  metadata: {
    from: FacingDirection;
    to: FacingDirection;
    reason: 'attack' | 'ability' | 'manual';
  };
}

// =============================================================================
// TIER 1: FLANKING, RESOLVE, ENGAGEMENT EVENTS
// =============================================================================

/**
 * Event emitted when flanking bonus is applied to an attack.
 */
export interface FlankingAppliedEvent extends BaseBattleEvent {
  type: 'flanking_applied';
  actorId: string;
  targetId: string;
  metadata: {
    attackerId: string;
    targetId: string;
    arc: 'front' | 'flank' | 'rear';
    modifier: number;
  };
}

/**
 * Event emitted when a unit's resolve changes.
 */
export interface ResolveChangedEvent extends BaseBattleEvent {
  type: 'resolve_changed';
  actorId: string;
  metadata: {
    unitId: string;
    delta: number;
    newValue: number;
    maxValue: number;
    source:
      | 'regeneration'
      | 'ally_death'
      | 'surrounded'
      | 'flanking'
      | 'phalanx'
      | 'ability';
  };
}

/**
 * Event emitted when a unit starts routing.
 */
export interface RoutingStartedEvent extends BaseBattleEvent {
  type: 'routing_started';
  actorId: string;
  metadata: {
    unitId: string;
    resolve: number;
    faction: 'human' | 'undead';
  };
}

/**
 * Event emitted when a unit rallies from routing.
 */
export interface UnitRalliedEvent extends BaseBattleEvent {
  type: 'unit_rallied';
  actorId: string;
  metadata: {
    unitId: string;
    resolve: number;
  };
}

// =============================================================================
// TIER 2: RIPOSTE, INTERCEPT, AURA EVENTS
// =============================================================================

/**
 * Event emitted when a riposte counter-attack is triggered.
 */
export interface RiposteTriggeredEvent extends BaseBattleEvent {
  type: 'riposte_triggered';
  actorId: string;
  targetId: string;
  metadata: {
    defenderId: string;
    attackerId: string;
    damage: number;
    chance: number;
    roll: number;
    chargesRemaining: number;
  };
}

/**
 * Event emitted when riposte charges are reset at turn start.
 */
export interface RiposteResetEvent extends BaseBattleEvent {
  type: 'riposte_reset';
  actorId: string;
  metadata: {
    unitId: string;
    charges: number;
  };
}

/**
 * Event emitted when an aura effect pulses.
 */
export interface AuraPulseEvent extends BaseBattleEvent {
  type: 'aura_pulse';
  actorId: string;
  metadata: {
    sourceId: string;
    auraType: string;
    affectedUnits: string[];
    effect: string;
  };
}


// =============================================================================
// TIER 3: AMMUNITION, CHARGE, PHALANX, OVERWATCH, LOS EVENTS
// =============================================================================

/**
 * Event emitted when ammunition is consumed.
 */
export interface AmmoConsumedEvent extends BaseBattleEvent {
  type: 'ammo_consumed';
  actorId: string;
  metadata: {
    unitId: string;
    ammoType: 'arrow' | 'bolt' | 'spell';
    consumed: number;
    remaining: number;
    maxAmmo: number;
  };
}

/**
 * Event emitted when a charge attack starts.
 */
export interface ChargeStartedEvent extends BaseBattleEvent {
  type: 'charge_started';
  actorId: string;
  metadata: {
    unitId: string;
    startPosition: Position;
    targetPosition: Position;
    momentum: number;
  };
}

/**
 * Event emitted when a charge attack impacts.
 */
export interface ChargeImpactEvent extends BaseBattleEvent {
  type: 'charge_impact';
  actorId: string;
  targetId: string;
  metadata: {
    attackerId: string;
    targetId: string;
    momentum: number;
    bonusDamage: number;
    wasCountered: boolean;
  };
}

/**
 * Event emitted when a phalanx formation is formed.
 */
export interface PhalanxFormedEvent extends BaseBattleEvent {
  type: 'phalanx_formed';
  metadata: {
    unitIds: string[];
    armorBonus: number;
    resolveBonus: number;
  };
}

/**
 * Event emitted when a phalanx formation is broken.
 */
export interface PhalanxBrokenEvent extends BaseBattleEvent {
  type: 'phalanx_broken';
  metadata: {
    unitIds: string[];
    reason: 'unit_moved' | 'unit_died' | 'unit_routed';
  };
}

/**
 * Event emitted when a unit enters overwatch stance.
 */
export interface OverwatchSetEvent extends BaseBattleEvent {
  type: 'overwatch_set';
  actorId: string;
  metadata: {
    unitId: string;
    range: number;
  };
}

/**
 * Event emitted when overwatch is triggered.
 */
export interface OverwatchTriggeredEvent extends BaseBattleEvent {
  type: 'overwatch_triggered';
  actorId: string;
  targetId: string;
  metadata: {
    watcherId: string;
    triggerId: string;
    triggerAction: 'move' | 'ability';
    damage: number;
  };
}

/**
 * Event emitted when line of sight is blocked.
 */
export interface LosBlockedEvent extends BaseBattleEvent {
  type: 'los_blocked';
  actorId: string;
  targetId: string;
  metadata: {
    shooterId: string;
    targetId: string;
    blockedBy: string;
    blockerPosition: Position;
  };
}

// =============================================================================
// TIER 4: CONTAGION, ARMOR SHRED EVENTS
// =============================================================================

/**
 * Event emitted when a status effect spreads via contagion.
 */
export interface ContagionSpreadEvent extends BaseBattleEvent {
  type: 'contagion_spread';
  metadata: {
    fromId: string;
    toId: string;
    effect: 'fire' | 'poison' | 'fear';
    duration: number;
    spreadChance: number;
    roll: number;
  };
}

/**
 * Event emitted when armor shred is applied.
 */
export interface ArmorShredAppliedEvent extends BaseBattleEvent {
  type: 'armor_shred_applied';
  actorId: string;
  targetId: string;
  metadata: {
    attackerId: string;
    targetId: string;
    amount: number;
    totalShred: number;
    effectiveArmor: number;
  };
}

/**
 * Event emitted when armor shred decays.
 */
export interface ShredDecayedEvent extends BaseBattleEvent {
  type: 'shred_decayed';
  actorId: string;
  metadata: {
    unitId: string;
    decayAmount: number;
    remaining: number;
  };
}

// =============================================================================
// ABILITY EVENTS
// =============================================================================

/**
 * Event emitted when an ability is used.
 */
export interface AbilityUsedEvent extends BaseBattleEvent {
  type: 'ability_used';
  actorId: string;
  targetId?: string;
  metadata: {
    abilityId: string;
    abilityName: string;
    targetIds?: string[];
    targetPosition?: Position;
    cooldownSet: number;
  };
}

/**
 * Event emitted when a status effect is applied.
 */
export interface StatusAppliedEvent extends BaseBattleEvent {
  type: 'status_applied';
  actorId?: string;
  targetId: string;
  metadata: {
    statusId: string;
    statusName: string;
    duration: number;
    stacks?: number;
    source: 'ability' | 'contagion' | 'mechanic';
  };
}

/**
 * Event emitted when a status effect is removed.
 */
export interface StatusRemovedEvent extends BaseBattleEvent {
  type: 'status_removed';
  targetId: string;
  metadata: {
    statusId: string;
    statusName: string;
    reason: 'expired' | 'cleansed' | 'death';
  };
}

/**
 * Event emitted when ability cooldowns tick down.
 */
export interface CooldownTickedEvent extends BaseBattleEvent {
  type: 'cooldown_ticked';
  actorId: string;
  metadata: {
    unitId: string;
    abilities: Array<{
      abilityId: string;
      previousCooldown: number;
      newCooldown: number;
    }>;
  };
}


// =============================================================================
// UNION TYPES
// =============================================================================

/**
 * Union type of all core battle events.
 */
export type CoreBattleEvent =
  | BattleStartEvent
  | BattleEndEvent
  | RoundStartEvent
  | RoundEndEvent
  | TurnStartEvent
  | TurnEndEvent;

/**
 * Union type of all movement events.
 */
export type MovementEvent =
  | MoveEvent
  | InterceptTriggeredEvent
  | EngagementChangedEvent;

/**
 * Union type of all combat events.
 */
export type CombatEvent =
  | AttackEvent
  | DamageEvent
  | DodgeEvent
  | UnitDiedEvent;

/**
 * Union type of all mechanic-specific events.
 */
export type MechanicEvent =
  // Tier 0
  | FacingRotatedEvent
  // Tier 1
  | FlankingAppliedEvent
  | ResolveChangedEvent
  | RoutingStartedEvent
  | UnitRalliedEvent
  // Tier 2
  | RiposteTriggeredEvent
  | RiposteResetEvent
  | AuraPulseEvent
  // Tier 3
  | AmmoConsumedEvent
  | ChargeStartedEvent
  | ChargeImpactEvent
  | PhalanxFormedEvent
  | PhalanxBrokenEvent
  | OverwatchSetEvent
  | OverwatchTriggeredEvent
  | LosBlockedEvent
  // Tier 4
  | ContagionSpreadEvent
  | ArmorShredAppliedEvent
  | ShredDecayedEvent;

/**
 * Union type of all ability events.
 */
export type AbilityEvent =
  | AbilityUsedEvent
  | StatusAppliedEvent
  | StatusRemovedEvent
  | CooldownTickedEvent;

/**
 * Union type of all possible battle events.
 * Use this when handling events that could be any type.
 *
 * @example
 * function handleEvent(event: AnyBattleEvent): void {
 *   switch (event.type) {
 *     case 'attack':
 *       console.log(`Attack dealt ${event.metadata.damage} damage`);
 *       break;
 *     case 'riposte_triggered':
 *       console.log(`Riposte dealt ${event.metadata.damage} damage`);
 *       break;
 *     // ... handle other event types
 *   }
 * }
 */
export type AnyBattleEvent =
  | CoreBattleEvent
  | MovementEvent
  | CombatEvent
  | MechanicEvent
  | AbilityEvent;

// =============================================================================
// EVENT CONTEXT (for factory functions)
// =============================================================================

/**
 * Context required for creating events.
 * Provides round, turn, and phase information.
 */
export interface EventContext {
  /** Current battle round (1-based) */
  round: number;
  /** Current turn within round (1-based) */
  turn: number;
  /** Current phase */
  phase: Phase;
}

/**
 * Creates a monotonic timestamp for event ordering.
 * Uses high-resolution time when available.
 */
let eventCounter = 0;
export function createEventTimestamp(): number {
  return Date.now() * 1000 + eventCounter++;
}

/**
 * Resets the event counter (for testing).
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}


// =============================================================================
// EVENT FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates a battle start event.
 *
 * @param ctx - Event context (round, turn, phase)
 * @param data - Event-specific data
 * @returns BattleStartEvent
 *
 * @example
 * const event = createBattleStartEvent(
 *   { round: 1, turn: 0, phase: 'turn_start' },
 *   { battleId: 'battle_001', seed: 12345, playerUnitCount: 4, enemyUnitCount: 4 }
 * );
 */
export function createBattleStartEvent(
  ctx: EventContext,
  data: BattleStartEvent['metadata'],
): BattleStartEvent {
  return {
    type: 'battle_start',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates a battle end event.
 *
 * @param ctx - Event context
 * @param data - Event-specific data
 * @returns BattleEndEvent
 */
export function createBattleEndEvent(
  ctx: EventContext,
  data: BattleEndEvent['metadata'],
): BattleEndEvent {
  return {
    type: 'battle_end',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates a round start event.
 *
 * @param ctx - Event context
 * @param data - Event-specific data
 * @returns RoundStartEvent
 */
export function createRoundStartEvent(
  ctx: EventContext,
  data: RoundStartEvent['metadata'],
): RoundStartEvent {
  return {
    type: 'round_start',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates a round end event.
 *
 * @param ctx - Event context
 * @param data - Event-specific data
 * @returns RoundEndEvent
 */
export function createRoundEndEvent(
  ctx: EventContext,
  data: RoundEndEvent['metadata'],
): RoundEndEvent {
  return {
    type: 'round_end',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates a turn start event.
 *
 * @param ctx - Event context
 * @param actorId - Unit starting their turn
 * @param turnNumber - Turn number within round
 * @returns TurnStartEvent
 */
export function createTurnStartEvent(
  ctx: EventContext,
  actorId: string,
  turnNumber: number,
): TurnStartEvent {
  return {
    type: 'turn_start',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: { unitId: actorId, turnNumber },
  };
}

/**
 * Creates a turn end event.
 *
 * @param ctx - Event context
 * @param actorId - Unit ending their turn
 * @param turnNumber - Turn number within round
 * @returns TurnEndEvent
 */
export function createTurnEndEvent(
  ctx: EventContext,
  actorId: string,
  turnNumber: number,
): TurnEndEvent {
  return {
    type: 'turn_end',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: { unitId: actorId, turnNumber },
  };
}

/**
 * Creates a move event.
 *
 * @param ctx - Event context
 * @param actorId - Unit that moved
 * @param data - Movement data
 * @returns MoveEvent
 *
 * @example
 * const event = createMoveEvent(
 *   { round: 2, turn: 3, phase: 'movement' },
 *   'player_knight_0',
 *   { fromPosition: { x: 3, y: 1 }, toPosition: { x: 4, y: 2 }, reason: 'normal', pathLength: 2 }
 * );
 */
export function createMoveEvent(
  ctx: EventContext,
  actorId: string,
  data: MoveEvent['metadata'],
): MoveEvent {
  return {
    type: 'move',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates an attack event.
 *
 * @param ctx - Event context
 * @param actorId - Attacking unit
 * @param targetId - Target unit
 * @param data - Attack data
 * @returns AttackEvent
 *
 * @example
 * const event = createAttackEvent(
 *   { round: 3, turn: 7, phase: 'attack' },
 *   'player_knight_0',
 *   'enemy_rogue_0',
 *   { damage: 15, damageType: 'physical' }
 * );
 */
export function createAttackEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: AttackEvent['metadata'],
): AttackEvent {
  return {
    type: 'attack',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a damage event.
 *
 * @param ctx - Event context
 * @param targetId - Unit receiving damage
 * @param data - Damage data
 * @param actorId - Optional source of damage
 * @returns DamageEvent
 */
export function createDamageEvent(
  ctx: EventContext,
  targetId: string,
  data: DamageEvent['metadata'],
  actorId?: string,
): DamageEvent {
  return {
    type: 'damage',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a dodge event.
 *
 * @param ctx - Event context
 * @param actorId - Attacking unit
 * @param targetId - Dodging unit
 * @param data - Dodge data
 * @returns DodgeEvent
 */
export function createDodgeEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: DodgeEvent['metadata'],
): DodgeEvent {
  return {
    type: 'dodge',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a unit died event.
 *
 * @param ctx - Event context
 * @param targetId - Unit that died
 * @param data - Death data
 * @returns UnitDiedEvent
 */
export function createUnitDiedEvent(
  ctx: EventContext,
  targetId: string,
  data: UnitDiedEvent['metadata'],
): UnitDiedEvent {
  return {
    type: 'unit_died',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    targetId,
    metadata: data,
  };
}


/**
 * Creates a facing rotated event.
 *
 * @param ctx - Event context
 * @param actorId - Unit that rotated
 * @param data - Facing data
 * @returns FacingRotatedEvent
 */
export function createFacingRotatedEvent(
  ctx: EventContext,
  actorId: string,
  data: FacingRotatedEvent['metadata'],
): FacingRotatedEvent {
  return {
    type: 'facing_rotated',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a flanking applied event.
 *
 * @param ctx - Event context
 * @param actorId - Attacking unit
 * @param targetId - Target unit
 * @param data - Flanking data
 * @returns FlankingAppliedEvent
 */
export function createFlankingAppliedEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: FlankingAppliedEvent['metadata'],
): FlankingAppliedEvent {
  return {
    type: 'flanking_applied',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a resolve changed event.
 *
 * @param ctx - Event context
 * @param actorId - Unit whose resolve changed
 * @param data - Resolve data
 * @returns ResolveChangedEvent
 */
export function createResolveChangedEvent(
  ctx: EventContext,
  actorId: string,
  data: ResolveChangedEvent['metadata'],
): ResolveChangedEvent {
  return {
    type: 'resolve_changed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a routing started event.
 *
 * @param ctx - Event context
 * @param actorId - Unit that started routing
 * @param data - Routing data
 * @returns RoutingStartedEvent
 */
export function createRoutingStartedEvent(
  ctx: EventContext,
  actorId: string,
  data: RoutingStartedEvent['metadata'],
): RoutingStartedEvent {
  return {
    type: 'routing_started',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a unit rallied event.
 *
 * @param ctx - Event context
 * @param actorId - Unit that rallied
 * @param data - Rally data
 * @returns UnitRalliedEvent
 */
export function createUnitRalliedEvent(
  ctx: EventContext,
  actorId: string,
  data: UnitRalliedEvent['metadata'],
): UnitRalliedEvent {
  return {
    type: 'unit_rallied',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a riposte triggered event.
 *
 * @param ctx - Event context
 * @param actorId - Defending unit (riposting)
 * @param targetId - Attacking unit (receiving riposte)
 * @param data - Riposte data
 * @returns RiposteTriggeredEvent
 */
export function createRiposteTriggeredEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: RiposteTriggeredEvent['metadata'],
): RiposteTriggeredEvent {
  return {
    type: 'riposte_triggered',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a riposte reset event.
 *
 * @param ctx - Event context
 * @param actorId - Unit whose charges were reset
 * @param charges - Number of charges reset to
 * @returns RiposteResetEvent
 */
export function createRiposteResetEvent(
  ctx: EventContext,
  actorId: string,
  charges: number,
): RiposteResetEvent {
  return {
    type: 'riposte_reset',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: { unitId: actorId, charges },
  };
}

/**
 * Creates an ammo consumed event.
 *
 * @param ctx - Event context
 * @param actorId - Unit that consumed ammo
 * @param data - Ammo data
 * @returns AmmoConsumedEvent
 */
export function createAmmoConsumedEvent(
  ctx: EventContext,
  actorId: string,
  data: AmmoConsumedEvent['metadata'],
): AmmoConsumedEvent {
  return {
    type: 'ammo_consumed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a charge started event.
 *
 * @param ctx - Event context
 * @param actorId - Charging unit
 * @param data - Charge data
 * @returns ChargeStartedEvent
 */
export function createChargeStartedEvent(
  ctx: EventContext,
  actorId: string,
  data: ChargeStartedEvent['metadata'],
): ChargeStartedEvent {
  return {
    type: 'charge_started',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates a charge impact event.
 *
 * @param ctx - Event context
 * @param actorId - Charging unit
 * @param targetId - Target unit
 * @param data - Impact data
 * @returns ChargeImpactEvent
 */
export function createChargeImpactEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: ChargeImpactEvent['metadata'],
): ChargeImpactEvent {
  return {
    type: 'charge_impact',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a phalanx formed event.
 *
 * @param ctx - Event context
 * @param data - Phalanx data
 * @returns PhalanxFormedEvent
 */
export function createPhalanxFormedEvent(
  ctx: EventContext,
  data: PhalanxFormedEvent['metadata'],
): PhalanxFormedEvent {
  return {
    type: 'phalanx_formed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates a phalanx broken event.
 *
 * @param ctx - Event context
 * @param data - Phalanx data
 * @returns PhalanxBrokenEvent
 */
export function createPhalanxBrokenEvent(
  ctx: EventContext,
  data: PhalanxBrokenEvent['metadata'],
): PhalanxBrokenEvent {
  return {
    type: 'phalanx_broken',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}


/**
 * Creates a contagion spread event.
 *
 * @param ctx - Event context
 * @param data - Contagion data
 * @returns ContagionSpreadEvent
 */
export function createContagionSpreadEvent(
  ctx: EventContext,
  data: ContagionSpreadEvent['metadata'],
): ContagionSpreadEvent {
  return {
    type: 'contagion_spread',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    metadata: data,
  };
}

/**
 * Creates an armor shred applied event.
 *
 * @param ctx - Event context
 * @param actorId - Unit applying shred
 * @param targetId - Unit receiving shred
 * @param data - Shred data
 * @returns ArmorShredAppliedEvent
 */
export function createArmorShredAppliedEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: ArmorShredAppliedEvent['metadata'],
): ArmorShredAppliedEvent {
  return {
    type: 'armor_shred_applied',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a shred decayed event.
 *
 * @param ctx - Event context
 * @param actorId - Unit whose shred decayed
 * @param data - Decay data
 * @returns ShredDecayedEvent
 */
export function createShredDecayedEvent(
  ctx: EventContext,
  actorId: string,
  data: ShredDecayedEvent['metadata'],
): ShredDecayedEvent {
  return {
    type: 'shred_decayed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates an ability used event.
 *
 * @param ctx - Event context
 * @param actorId - Unit using ability
 * @param data - Ability data
 * @param targetId - Optional target unit
 * @returns AbilityUsedEvent
 */
export function createAbilityUsedEvent(
  ctx: EventContext,
  actorId: string,
  data: AbilityUsedEvent['metadata'],
  targetId?: string,
): AbilityUsedEvent {
  return {
    type: 'ability_used',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a status applied event.
 *
 * @param ctx - Event context
 * @param targetId - Unit receiving status
 * @param data - Status data
 * @param actorId - Optional source unit
 * @returns StatusAppliedEvent
 */
export function createStatusAppliedEvent(
  ctx: EventContext,
  targetId: string,
  data: StatusAppliedEvent['metadata'],
  actorId?: string,
): StatusAppliedEvent {
  return {
    type: 'status_applied',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a status removed event.
 *
 * @param ctx - Event context
 * @param targetId - Unit losing status
 * @param data - Status data
 * @returns StatusRemovedEvent
 */
export function createStatusRemovedEvent(
  ctx: EventContext,
  targetId: string,
  data: StatusRemovedEvent['metadata'],
): StatusRemovedEvent {
  return {
    type: 'status_removed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    targetId,
    metadata: data,
  };
}

/**
 * Creates a cooldown ticked event.
 *
 * @param ctx - Event context
 * @param actorId - Unit whose cooldowns ticked
 * @param data - Cooldown data
 * @returns CooldownTickedEvent
 */
export function createCooldownTickedEvent(
  ctx: EventContext,
  actorId: string,
  data: CooldownTickedEvent['metadata'],
): CooldownTickedEvent {
  return {
    type: 'cooldown_ticked',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates an intercept triggered event.
 *
 * @param ctx - Event context
 * @param actorId - Intercepting unit
 * @param targetId - Moving unit being intercepted
 * @param data - Intercept data
 * @returns InterceptTriggeredEvent
 */
export function createInterceptTriggeredEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: InterceptTriggeredEvent['metadata'],
): InterceptTriggeredEvent {
  return {
    type: 'intercept_triggered',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates an engagement changed event.
 *
 * @param ctx - Event context
 * @param actorId - Unit whose engagement changed
 * @param data - Engagement data
 * @returns EngagementChangedEvent
 */
export function createEngagementChangedEvent(
  ctx: EventContext,
  actorId: string,
  data: EngagementChangedEvent['metadata'],
): EngagementChangedEvent {
  return {
    type: 'engagement_changed',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates an aura pulse event.
 *
 * @param ctx - Event context
 * @param actorId - Unit with the aura
 * @param data - Aura data
 * @returns AuraPulseEvent
 */
export function createAuraPulseEvent(
  ctx: EventContext,
  actorId: string,
  data: AuraPulseEvent['metadata'],
): AuraPulseEvent {
  return {
    type: 'aura_pulse',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: data,
  };
}

/**
 * Creates an overwatch set event.
 *
 * @param ctx - Event context
 * @param actorId - Unit entering overwatch
 * @param range - Overwatch range
 * @returns OverwatchSetEvent
 */
export function createOverwatchSetEvent(
  ctx: EventContext,
  actorId: string,
  range: number,
): OverwatchSetEvent {
  return {
    type: 'overwatch_set',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    metadata: { unitId: actorId, range },
  };
}

/**
 * Creates an overwatch triggered event.
 *
 * @param ctx - Event context
 * @param actorId - Unit in overwatch
 * @param targetId - Unit that triggered overwatch
 * @param data - Overwatch data
 * @returns OverwatchTriggeredEvent
 */
export function createOverwatchTriggeredEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: OverwatchTriggeredEvent['metadata'],
): OverwatchTriggeredEvent {
  return {
    type: 'overwatch_triggered',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}

/**
 * Creates a line of sight blocked event.
 *
 * @param ctx - Event context
 * @param actorId - Shooting unit
 * @param targetId - Intended target
 * @param data - LoS data
 * @returns LosBlockedEvent
 */
export function createLosBlockedEvent(
  ctx: EventContext,
  actorId: string,
  targetId: string,
  data: LosBlockedEvent['metadata'],
): LosBlockedEvent {
  return {
    type: 'los_blocked',
    round: ctx.round,
    turn: ctx.turn,
    phase: ctx.phase,
    timestamp: createEventTimestamp(),
    actorId,
    targetId,
    metadata: data,
  };
}
