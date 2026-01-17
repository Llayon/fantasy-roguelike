/**
 * Turn order system for battle engine.
 * Manages initiative-based turn queue with deterministic sorting and unit lifecycle.
 *
 * @fileoverview Turn order implementation with deterministic sorting.
 * Provides deterministic turn ordering based on initiative, speed, and ID tiebreaking.
 *
 * @module core/battle/turn-order
 */

// =============================================================================
// RESOLVE STATE (imported from mechanics when available)
// =============================================================================

/**
 * Resolve state for units (morale system).
 * Routing units skip their turns in the turn order.
 */
export enum ResolveState {
  STEADY = 'steady',
  WAVERING = 'wavering',
  ROUTING = 'routing',
}

// =============================================================================
// VIGILANCE STATE (for overwatch mechanic)
// =============================================================================

/**
 * Vigilance state for units (overwatch mechanic).
 */
export enum VigilanceState {
  /** Unit acts normally */
  NORMAL = 'normal',
  /** Unit is in overwatch mode, skips normal turn but reacts to enemy movement */
  VIGILANT = 'vigilant',
}

// =============================================================================
// UNIT INTERFACE (minimal for core)
// =============================================================================

/**
 * Minimal unit interface for turn order management.
 * Game-specific unit types should extend this.
 */
export interface TurnOrderUnit {
  /** Unit identifier */
  id: string;
  /** Unique instance identifier */
  instanceId: string;
  /** Whether unit is alive */
  alive: boolean;
  /** Current hit points */
  currentHp: number;
  /** Unit stats */
  stats: {
    /** Initiative (turn order priority) */
    initiative: number;
    /** Speed (tiebreaker) */
    speed: number;
  };
  /** Team affiliation */
  team: 'player' | 'bot';
  /** Optional resolve state for morale system */
  resolveState?: ResolveState;
  /** Optional vigilance state for overwatch mechanic */
  vigilanceState?: VigilanceState;
}

// =============================================================================
// TURN QUEUE MANAGEMENT
// =============================================================================

/**
 * Check if a unit can act in the turn order.
 * A unit can act if it is alive, not routing, and not in vigilance mode.
 *
 * @param unit - Unit to check
 * @returns True if unit can act
 */
export function canUnitAct<T extends TurnOrderUnit>(unit: T): boolean {
  if (!unit.alive) {
    return false;
  }

  if (unit.resolveState === ResolveState.ROUTING) {
    return false;
  }

  if (unit.vigilanceState === VigilanceState.VIGILANT) {
    return false;
  }

  return true;
}

/**
 * Build turn queue from units with deterministic sorting.
 * Sorting rules:
 * 1. Initiative (descending) - higher initiative goes first
 * 2. Speed (descending) - higher speed breaks initiative ties
 * 3. ID (ascending) - alphabetical order for complete determinism
 *
 * @param units - Array of units to sort
 * @returns Sorted array of units in turn order
 */
export function buildTurnQueue<T extends TurnOrderUnit>(units: T[]): T[] {
  return units
    .filter((unit) => canUnitAct(unit))
    .sort((a, b) => {
      if (b.stats.initiative !== a.stats.initiative) {
        return b.stats.initiative - a.stats.initiative;
      }

      if (b.stats.speed !== a.stats.speed) {
        return b.stats.speed - a.stats.speed;
      }

      return a.id.localeCompare(b.id);
    });
}

/**
 * Get the next unit to act from the turn queue.
 *
 * @param queue - Turn queue array of units
 * @returns Next unit to act, or null if no units can act
 */
export function getNextUnit<T extends TurnOrderUnit>(queue: T[]): T | null {
  for (const unit of queue) {
    if (canUnitAct(unit)) {
      return unit;
    }
  }
  return null;
}

/**
 * Remove dead units from the turn queue.
 *
 * @param queue - Current turn queue
 * @returns New queue with only living units
 */
export function removeDeadUnits<T extends TurnOrderUnit>(queue: T[]): T[] {
  return queue.filter((unit) => unit.alive);
}

/**
 * Remove units that cannot act from the turn queue.
 *
 * @param queue - Current turn queue
 * @returns New queue with only units that can act
 */
export function removeInactiveUnits<T extends TurnOrderUnit>(queue: T[]): T[] {
  return queue.filter((unit) => canUnitAct(unit));
}

// =============================================================================
// TURN QUEUE UTILITIES
// =============================================================================

/**
 * Check if any units remain alive in the queue.
 *
 * @param queue - Turn queue to check
 * @returns True if at least one unit is alive
 */
export function hasLivingUnits<T extends TurnOrderUnit>(queue: T[]): boolean {
  return queue.some((unit) => unit.alive);
}

/**
 * Check if any units can act in the queue.
 *
 * @param queue - Turn queue to check
 * @returns True if at least one unit can act
 */
export function hasActiveUnits<T extends TurnOrderUnit>(queue: T[]): boolean {
  return queue.some((unit) => canUnitAct(unit));
}

/**
 * Get all living units from a specific team.
 *
 * @param queue - Turn queue to filter
 * @param team - Team to filter for ('player' or 'bot')
 * @returns Array of living units from the specified team
 */
export function getLivingUnitsByTeam<T extends TurnOrderUnit>(
  queue: T[],
  team: 'player' | 'bot'
): T[] {
  return queue.filter((unit) => unit.alive && unit.team === team);
}

/**
 * Count living units by team.
 *
 * @param queue - Turn queue to analyze
 * @returns Object with player and bot unit counts
 */
export function countLivingUnitsByTeam<T extends TurnOrderUnit>(queue: T[]): {
  player: number;
  bot: number;
} {
  let playerCount = 0;
  let botCount = 0;

  for (const unit of queue) {
    if (unit.alive) {
      if (unit.team === 'player') {
        playerCount++;
      } else if (unit.team === 'bot') {
        botCount++;
      }
    }
  }

  return { player: playerCount, bot: botCount };
}

/**
 * Find unit in queue by instance ID.
 *
 * @param queue - Turn queue to search
 * @param instanceId - Unique instance ID to find
 * @returns Found unit or null if not found
 */
export function findUnitById<T extends TurnOrderUnit>(queue: T[], instanceId: string): T | null {
  return queue.find((unit) => unit.instanceId === instanceId) || null;
}

/**
 * Get turn order preview for UI display.
 *
 * @param queue - Current turn queue
 * @param maxTurns - Maximum number of turns to preview (default: 5)
 * @returns Array of unit instance IDs in turn order
 */
export function getTurnOrderPreview<T extends TurnOrderUnit>(
  queue: T[],
  maxTurns: number = 5
): string[] {
  const activeUnits = removeInactiveUnits(queue);
  const preview: string[] = [];

  for (let i = 0; i < maxTurns && activeUnits.length > 0; i++) {
    const unitIndex = i % activeUnits.length;
    const unit = activeUnits[unitIndex];
    if (unit) {
      preview.push(unit.instanceId);
    }
  }

  return preview;
}


// =============================================================================
// TURN QUEUE VALIDATION
// =============================================================================

/**
 * Validate turn queue integrity.
 *
 * @param queue - Turn queue to validate
 * @returns Validation result with success status and any errors
 */
export function validateTurnQueue<T extends TurnOrderUnit>(queue: T[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (const unit of queue) {
    if (seenIds.has(unit.instanceId)) {
      errors.push(`Duplicate unit instance ID: ${unit.instanceId}`);
    }
    seenIds.add(unit.instanceId);
  }

  for (const unit of queue) {
    if (unit.currentHp < 0) {
      errors.push(`Unit ${unit.instanceId} has negative HP: ${unit.currentHp}`);
    }

    if (unit.currentHp === 0 && unit.alive) {
      errors.push(`Unit ${unit.instanceId} has 0 HP but is marked alive`);
    }

    if (unit.currentHp > 0 && !unit.alive) {
      errors.push(`Unit ${unit.instanceId} has HP but is marked dead`);
    }

    if (unit.resolveState === ResolveState.ROUTING && unit.alive) {
      warnings.push(`Unit ${unit.instanceId} is routing and should skip turns`);
    }

    if (unit.vigilanceState === VigilanceState.VIGILANT && unit.alive) {
      warnings.push(`Unit ${unit.instanceId} is vigilant and should skip normal turns`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if turn queue is properly sorted according to rules.
 *
 * @param queue - Turn queue to check
 * @returns True if queue is properly sorted
 */
export function isTurnQueueSorted<T extends TurnOrderUnit>(queue: T[]): boolean {
  const activeUnits = queue.filter((unit) => canUnitAct(unit));

  for (let i = 1; i < activeUnits.length; i++) {
    const prev = activeUnits[i - 1];
    const curr = activeUnits[i];

    if (!prev || !curr) continue;

    if (prev.stats.initiative < curr.stats.initiative) {
      return false;
    }

    if (prev.stats.initiative === curr.stats.initiative) {
      if (prev.stats.speed < curr.stats.speed) {
        return false;
      }

      if (prev.stats.speed === curr.stats.speed) {
        if (prev.id.localeCompare(curr.id) > 0) {
          return false;
        }
      }
    }
  }

  return true;
}

// =============================================================================
// ROUND MANAGEMENT
// =============================================================================

/**
 * Advance to next turn in the queue.
 *
 * @param queue - Current turn queue
 * @param allUnits - All units in battle (for queue rebuilding)
 * @returns Updated turn queue for next turn
 */
export function advanceToNextTurn<T extends TurnOrderUnit>(queue: T[], allUnits: T[]): T[] {
  const remainingQueue = queue.slice(1);

  const activeInQueue = remainingQueue.filter((unit) => canUnitAct(unit));
  if (activeInQueue.length === 0) {
    return buildTurnQueue(allUnits);
  }

  return remainingQueue;
}

/**
 * Check if a new round should start.
 *
 * @param queue - Current turn queue
 * @param allUnits - All units in battle
 * @returns True if new round should start
 */
export function shouldStartNewRound<T extends TurnOrderUnit>(queue: T[], allUnits: T[]): boolean {
  const activeUnits = allUnits.filter((unit) => canUnitAct(unit));
  const activeInQueue = queue.filter((unit) => canUnitAct(unit));

  return activeInQueue.length === 0 && activeUnits.length > 0;
}
