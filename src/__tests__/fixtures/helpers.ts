/**
 * Test helper functions for common test setup and assertions.
 *
 * Provides utilities for:
 * - Setting up test scenarios
 * - Creating complex test data
 * - Common assertions and validations
 * - Test data builders
 *
 * @module __tests__/fixtures/helpers
 *
 * @example
 * import { setupBattleScenario, assertUnitAlive, assertDamageDealt } from './fixtures/helpers';
 *
 * // Setup a complete battle scenario
 * const { state, playerUnit, enemyUnit } = setupBattleScenario();
 *
 * // Make assertions
 * assertUnitAlive(playerUnit);
 * assertDamageDealt(playerUnit, enemyUnit, 10);
 */

import { BattleState, Phase } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { Position } from '../../core/types/grid.types';
import {
  createPlayerKnight,
  createEnemyKnight,
  createPlayerArcher,
  createEnemyArcher,
} from './units';
import { createTestBattleState, isValidBattleState } from './states';

// =============================================================================
// SCENARIO SETUP HELPERS
// =============================================================================

/**
 * Setup a complete battle scenario with player and enemy units.
 *
 * Returns a ready-to-use battle state with common units.
 * Useful for integration tests that need a full setup.
 *
 * @param playerUnitCount - Number of player units (default: 1)
 * @param enemyUnitCount - Number of enemy units (default: 1)
 * @returns Object with state, playerUnits, and enemyUnits
 *
 * @example
 * const { state, playerUnits, enemyUnits } = setupBattleScenario();
 * const { state, playerUnits, enemyUnits } = setupBattleScenario(3, 3);
 */
export function setupBattleScenario(
  playerUnitCount: number = 1,
  enemyUnitCount: number = 1,
): {
  state: BattleState;
  playerUnits: BattleUnit[];
  enemyUnits: BattleUnit[];
} {
  const playerUnits: BattleUnit[] = [];
  const enemyUnits: BattleUnit[] = [];

  // Create player units
  for (let i = 0; i < playerUnitCount; i++) {
    if (i % 2 === 0) {
      playerUnits.push(createPlayerKnight({}, i));
    } else {
      playerUnits.push(createPlayerArcher({}, i));
    }
  }

  // Create enemy units
  for (let i = 0; i < enemyUnitCount; i++) {
    if (i % 2 === 0) {
      enemyUnits.push(createEnemyKnight({}, i));
    } else {
      enemyUnits.push(createEnemyArcher({}, i));
    }
  }

  const state = createTestBattleState([...playerUnits, ...enemyUnits]);

  return { state, playerUnits, enemyUnits };
}

/**
 * Setup a 1v1 duel scenario.
 *
 * Creates a simple player vs enemy battle.
 *
 * @param playerUnit - Player unit (default: knight)
 * @param enemyUnit - Enemy unit (default: knight)
 * @returns Object with state, playerUnit, and enemyUnit
 *
 * @example
 * const { state, playerUnit, enemyUnit } = setupDuelScenario();
 * const { state, playerUnit, enemyUnit } = setupDuelScenario(
 *   createPlayerArcher(),
 *   createEnemyRogue()
 * );
 */
export function setupDuelScenario(
  playerUnit: BattleUnit = createPlayerKnight(),
  enemyUnit: BattleUnit = createEnemyKnight(),
): {
  state: BattleState;
  playerUnit: BattleUnit;
  enemyUnit: BattleUnit;
} {
  const state = createTestBattleState([playerUnit, enemyUnit]);
  return { state, playerUnit, enemyUnit };
}

/**
 * Setup a scenario with units at specific positions.
 *
 * Useful for testing movement and positioning mechanics.
 *
 * @param positions - Array of [unit, position] tuples
 * @returns Object with state and units
 *
 * @example
 * const { state, units } = setupPositionScenario([
 *   [createPlayerKnight(), { x: 0, y: 0 }],
 *   [createEnemyKnight(), { x: 7, y: 9 }],
 * ]);
 */
export function setupPositionScenario(positions: Array<[BattleUnit, Position]>): {
  state: BattleState;
  units: BattleUnit[];
} {
  const units = positions.map(([unit, pos]) => ({
    ...unit,
    position: pos,
  }));

  const state = createTestBattleState(units);
  return { state, units };
}

/**
 * Setup a scenario with units in engagement.
 *
 * Creates units that are adjacent and engaged.
 *
 * @returns Object with state and engaged units
 *
 * @example
 * const { state, attacker, defender } = setupEngagementScenario();
 */
export function setupEngagementScenario(): {
  state: BattleState;
  attacker: BattleUnit;
  defender: BattleUnit;
} {
  const attacker = createPlayerKnight({ position: { x: 3, y: 1 } });
  const defender = createEnemyKnight({
    position: { x: 3, y: 2 },
    engaged: true,
    engagedBy: [attacker.instanceId],
  });

  const state = createTestBattleState([attacker, defender]);
  return { state, attacker, defender };
}

// =============================================================================
// UNIT MODIFICATION HELPERS
// =============================================================================

/**
 * Damage a unit by a specific amount.
 *
 * Updates currentHp and alive status.
 *
 * @param unit - Unit to damage
 * @param damage - Damage amount
 * @returns Damaged unit
 *
 * @example
 * const unit = createPlayerKnight();
 * const damaged = damageUnit(unit, 25);
 */
export function damageUnit(unit: BattleUnit, damage: number): BattleUnit {
  const newHp = Math.max(0, unit.currentHp - damage);
  return {
    ...unit,
    currentHp: newHp,
    alive: newHp > 0,
  };
}

/**
 * Heal a unit by a specific amount.
 *
 * Updates currentHp (capped at maxHp).
 *
 * @param unit - Unit to heal
 * @param healing - Healing amount
 * @returns Healed unit
 *
 * @example
 * const unit = createPlayerKnight({ currentHp: 50 });
 * const healed = healUnit(unit, 25);
 */
export function healUnit(unit: BattleUnit, healing: number): BattleUnit {
  const newHp = Math.min(unit.maxHp, unit.currentHp + healing);
  return {
    ...unit,
    currentHp: newHp,
    alive: newHp > 0,
  };
}

/**
 * Move a unit to a new position.
 *
 * @param unit - Unit to move
 * @param newPosition - Target position
 * @returns Unit at new position
 *
 * @example
 * const unit = createPlayerKnight();
 * const moved = moveUnit(unit, { x: 5, y: 3 });
 */
export function moveUnit(unit: BattleUnit, newPosition: Position): BattleUnit {
  return {
    ...unit,
    position: newPosition,
  };
}

/**
 * Apply armor shred to a unit.
 *
 * @param unit - Unit to shred
 * @param shredAmount - Amount of shred to apply
 * @returns Unit with armor shred
 *
 * @example
 * const unit = createPlayerKnight();
 * const shredded = applyArmorShred(unit, 5);
 */
export function applyArmorShred(unit: BattleUnit, shredAmount: number): BattleUnit {
  return {
    ...unit,
    armorShred: Math.min(unit.stats.armor, unit.armorShred + shredAmount),
  };
}

/**
 * Consume ammunition from a unit.
 *
 * @param unit - Unit to consume ammo from
 * @param amount - Amount to consume (default: 1)
 * @returns Unit with reduced ammo
 *
 * @example
 * const unit = createPlayerArcher();
 * const consumed = consumeAmmo(unit, 1);
 */
export function consumeAmmo(unit: BattleUnit, amount: number = 1): BattleUnit {
  if (unit.ammo === null) {
    return unit; // Unlimited ammo
  }

  return {
    ...unit,
    ammo: Math.max(0, unit.ammo - amount),
  };
}

/**
 * Apply resolve damage to a unit.
 *
 * @param unit - Unit to apply resolve damage to
 * @param damage - Resolve damage amount
 * @returns Unit with reduced resolve
 *
 * @example
 * const unit = createPlayerKnight();
 * const damaged = applyResolveDamage(unit, 15);
 */
export function applyResolveDamage(unit: BattleUnit, damage: number): BattleUnit {
  const newResolve = Math.max(0, unit.resolve - damage);
  const isRouting = newResolve === 0 && unit.faction === 'human';

  return {
    ...unit,
    resolve: newResolve,
    isRouting: isRouting || unit.isRouting,
  };
}

/**
 * Regenerate resolve for a unit.
 *
 * @param unit - Unit to regenerate resolve for
 * @param amount - Regeneration amount (default: 5)
 * @returns Unit with increased resolve
 *
 * @example
 * const unit = createPlayerKnight({ resolve: 50 });
 * const regen = regenerateResolve(unit, 5);
 */
export function regenerateResolve(unit: BattleUnit, amount: number = 5): BattleUnit {
  const newResolve = Math.min(unit.maxResolve, unit.resolve + amount);
  const isRouting = newResolve >= 25 ? false : unit.isRouting;

  return {
    ...unit,
    resolve: newResolve,
    isRouting,
  };
}

// =============================================================================
// STATE MODIFICATION HELPERS
// =============================================================================

/**
 * Update a unit in a battle state.
 *
 * @param state - Battle state
 * @param unitId - Unit instance ID
 * @param updates - Partial unit updates
 * @returns Updated battle state
 *
 * @example
 * const state = createTestBattleState();
 * const updated = updateUnitInState(state, 'player_knight_0', { currentHp: 50 });
 */
export function updateUnitInState(
  state: BattleState,
  unitId: string,
  updates: Partial<BattleUnit>,
): BattleState {
  const units = state.units.map((u) => (u.instanceId === unitId ? { ...u, ...updates } : u));

  // Rebuild occupied positions
  const occupiedPositions = new Set<string>();
  for (const unit of units) {
    if (unit.alive) {
      occupiedPositions.add(`${unit.position.x},${unit.position.y}`);
    }
  }

  return {
    ...state,
    units,
    occupiedPositions,
  };
}

/**
 * Advance to the next turn in a battle state.
 *
 * Increments turn counter and moves to next unit in queue.
 *
 * @param state - Battle state
 * @returns Updated battle state
 *
 * @example
 * const state = createTestBattleState();
 * const nextTurn = advanceToNextTurn(state);
 */
export function advanceToNextTurn(state: BattleState): BattleState {
  const nextIndex = (state.currentTurnIndex + 1) % state.turnQueue.length;
  const nextRound = nextIndex === 0 ? state.round + 1 : state.round;
  const nextTurn = nextIndex === 0 ? 1 : state.turn + 1;

  return {
    ...state,
    currentTurnIndex: nextIndex,
    round: nextRound,
    turn: nextTurn,
  };
}

/**
 * Advance to a specific phase in a battle state.
 *
 * @param state - Battle state
 * @param phase - Target phase
 * @returns Updated battle state
 *
 * @example
 * const state = createTestBattleState();
 * const attackPhase = advanceToPhase(state, 'attack');
 */
export function advanceToPhase(state: BattleState, phase: string): BattleState {
  return {
    ...state,
    currentPhase: phase as Phase,
  };
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Assert that a unit is alive.
 *
 * @param unit - Unit to check
 * @throws Error if unit is dead
 *
 * @example
 * const unit = createPlayerKnight();
 * assertUnitAlive(unit); // Passes
 */
export function assertUnitAlive(unit: BattleUnit): void {
  if (!unit.alive) {
    throw new Error(`Unit ${unit.instanceId} is dead (HP: ${unit.currentHp})`);
  }
}

/**
 * Assert that a unit is dead.
 *
 * @param unit - Unit to check
 * @throws Error if unit is alive
 *
 * @example
 * const unit = createPlayerKnight({ alive: false, currentHp: 0 });
 * assertUnitDead(unit); // Passes
 */
export function assertUnitDead(unit: BattleUnit): void {
  if (unit.alive) {
    throw new Error(`Unit ${unit.instanceId} is alive (HP: ${unit.currentHp})`);
  }
}

/**
 * Assert that a unit has specific HP.
 *
 * @param unit - Unit to check
 * @param expectedHp - Expected HP value
 * @throws Error if HP doesn't match
 *
 * @example
 * const unit = createPlayerKnight({ currentHp: 50 });
 * assertUnitHp(unit, 50); // Passes
 */
export function assertUnitHp(unit: BattleUnit, expectedHp: number): void {
  if (unit.currentHp !== expectedHp) {
    throw new Error(
      `Unit ${unit.instanceId} HP mismatch: expected ${expectedHp}, got ${unit.currentHp}`,
    );
  }
}

/**
 * Assert that a unit has at least minimum HP.
 *
 * @param unit - Unit to check
 * @param minHp - Minimum HP value
 * @throws Error if HP is below minimum
 *
 * @example
 * const unit = createPlayerKnight({ currentHp: 50 });
 * assertUnitMinHp(unit, 25); // Passes
 */
export function assertUnitMinHp(unit: BattleUnit, minHp: number): void {
  if (unit.currentHp < minHp) {
    throw new Error(
      `Unit ${unit.instanceId} HP below minimum: expected >= ${minHp}, got ${unit.currentHp}`,
    );
  }
}

/**
 * Assert that a unit is at a specific position.
 *
 * @param unit - Unit to check
 * @param expectedPosition - Expected position
 * @throws Error if position doesn't match
 *
 * @example
 * const unit = createPlayerKnight({ position: { x: 3, y: 1 } });
 * assertUnitPosition(unit, { x: 3, y: 1 }); // Passes
 */
export function assertUnitPosition(unit: BattleUnit, expectedPosition: Position): void {
  if (unit.position.x !== expectedPosition.x || unit.position.y !== expectedPosition.y) {
    throw new Error(
      `Unit ${unit.instanceId} position mismatch: expected (${expectedPosition.x}, ${expectedPosition.y}), got (${unit.position.x}, ${unit.position.y})`,
    );
  }
}

/**
 * Assert that a battle state is valid.
 *
 * @param state - State to validate
 * @throws Error if state is invalid
 *
 * @example
 * const state = createTestBattleState();
 * assertValidBattleState(state); // Passes
 */
export function assertValidBattleState(state: BattleState): void {
  if (!isValidBattleState(state)) {
    throw new Error('Battle state is invalid');
  }
}

/**
 * Assert that a team has a specific unit count.
 *
 * @param state - Battle state
 * @param team - Team affiliation
 * @param expectedCount - Expected unit count
 * @throws Error if count doesn't match
 *
 * @example
 * const state = createTestBattleState();
 * assertTeamUnitCount(state, 'player', 1); // Passes
 */
export function assertTeamUnitCount(
  state: BattleState,
  team: 'player' | 'enemy',
  expectedCount: number,
): void {
  const count = state.units.filter((u) => u.team === team && u.alive).length;
  if (count !== expectedCount) {
    throw new Error(`Team ${team} unit count mismatch: expected ${expectedCount}, got ${count}`);
  }
}

/**
 * Assert that a unit has specific resolve.
 *
 * @param unit - Unit to check
 * @param expectedResolve - Expected resolve value
 * @throws Error if resolve doesn't match
 *
 * @example
 * const unit = createPlayerKnight({ resolve: 75 });
 * assertUnitResolve(unit, 75); // Passes
 */
export function assertUnitResolve(unit: BattleUnit, expectedResolve: number): void {
  if (unit.resolve !== expectedResolve) {
    throw new Error(
      `Unit ${unit.instanceId} resolve mismatch: expected ${expectedResolve}, got ${unit.resolve}`,
    );
  }
}

/**
 * Assert that a unit is routing.
 *
 * @param unit - Unit to check
 * @throws Error if unit is not routing
 *
 * @example
 * const unit = createPlayerKnight({ isRouting: true });
 * assertUnitRouting(unit); // Passes
 */
export function assertUnitRouting(unit: BattleUnit): void {
  if (!unit.isRouting) {
    throw new Error(`Unit ${unit.instanceId} is not routing`);
  }
}

/**
 * Assert that a unit is not routing.
 *
 * @param unit - Unit to check
 * @throws Error if unit is routing
 *
 * @example
 * const unit = createPlayerKnight({ isRouting: false });
 * assertUnitNotRouting(unit); // Passes
 */
export function assertUnitNotRouting(unit: BattleUnit): void {
  if (unit.isRouting) {
    throw new Error(`Unit ${unit.instanceId} is routing`);
  }
}
