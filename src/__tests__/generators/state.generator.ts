/**
 * Property-based test generators for BattleState.
 *
 * Generates random BattleState instances for property-based testing.
 * Uses fast-check to create valid battle states across the entire input domain.
 *
 * @module __tests__/generators/state.generator
 * @see {@link BattleState} for state type definition
 * @see {@link https://github.com/dubzzz/fast-check} for fast-check documentation
 *
 * @example
 * import fc from 'fast-check';
 * import { arbitraryBattleState } from './generators/state.generator';
 *
 * // Generate random battle states for property testing
 * fc.assert(
 *   fc.property(arbitraryBattleState(), (state) => {
 *     // Property: All units have valid HP
 *     state.units.forEach(unit => {
 *       expect(unit.currentHp).toBeGreaterThanOrEqual(0);
 *       expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
 *     });
 *   })
 * );
 */

import fc from 'fast-check';
import { BattleState, Phase, PHASE_ORDER } from '../../core/types/battle-state';
import { BattleUnit } from '../../core/types/battle-unit';
import { BattleEvent } from '../../core/types/events';
import {
  arbitraryBattleUnit,
  arbitraryDeadUnit,
  arbitraryRoutingUnit,
} from './unit.generator';

// =============================================================================
// PHASE GENERATORS
// =============================================================================

/**
 * Generate a valid battle phase.
 *
 * @returns Arbitrary<Phase>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPhase(), (phase) => {
 *     expect(PHASE_ORDER).toContain(phase);
 *   })
 * );
 */
export function arbitraryPhase(): fc.Arbitrary<Phase> {
  return fc.constantFrom(...PHASE_ORDER);
}

// =============================================================================
// ROUND/TURN GENERATORS
// =============================================================================

/**
 * Generate a valid round number (1-100).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryRound(), (round) => {
 *     expect(round).toBeGreaterThanOrEqual(1);
 *     expect(round).toBeLessThanOrEqual(100);
 *   })
 * );
 */
export function arbitraryRound(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 100 });
}

/**
 * Generate a valid turn number (1-20).
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryTurn(), (turn) => {
 *     expect(turn).toBeGreaterThanOrEqual(1);
 *   })
 * );
 */
export function arbitraryTurn(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 20 });
}

// =============================================================================
// SEED GENERATORS
// =============================================================================

/**
 * Generate a random seed for deterministic simulation.
 *
 * @returns Arbitrary<number>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitrarySeed(), (seed) => {
 *     expect(typeof seed).toBe('number');
 *   })
 * );
 */
export function arbitrarySeed(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 2147483647 });
}

// =============================================================================
// TURN QUEUE GENERATORS
// =============================================================================

/**
 * Generate a turn queue from a list of units.
 *
 * Creates a queue of unit instance IDs, sorted by initiative (descending).
 * Only includes alive units.
 *
 * @param units - Units to create queue from
 * @returns Turn queue (array of instance IDs)
 */
function createTurnQueue(units: BattleUnit[]): string[] {
  return units
    .filter((u) => u.alive)
    .sort((a, b) => {
      if (b.stats.initiative !== a.stats.initiative) {
        return b.stats.initiative - a.stats.initiative;
      }
      return a.instanceId.localeCompare(b.instanceId);
    })
    .map((u) => u.instanceId);
}

/**
 * Generate occupied positions set from units.
 *
 * @param units - Units to create positions from
 * @returns Set of occupied positions in "x,y" format
 */
function createOccupiedPositions(units: BattleUnit[]): Set<string> {
  const positions = new Set<string>();
  for (const unit of units) {
    if (unit.alive) {
      positions.add(`${unit.position.x},${unit.position.y}`);
    }
  }
  return positions;
}

// =============================================================================
// EVENT GENERATORS
// =============================================================================

/**
 * Generate a random battle event.
 *
 * @returns Arbitrary<BattleEvent>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBattleEvent(), (event) => {
 *     expect(event.type).toBeDefined();
 *     expect(event.round).toBeGreaterThanOrEqual(1);
 *   })
 * );
 */
export function arbitraryBattleEvent(): fc.Arbitrary<BattleEvent> {
  return fc.record({
    type: fc.constantFrom(
      'turn_start',
      'attack',
      'damage',
      'death',
      'facing_rotated',
      'riposte_triggered',
      'ammo_consumed',
      'resolve_changed',
    ),
    round: arbitraryRound(),
    turn: arbitraryTurn(),
    phase: arbitraryPhase(),
    timestamp: fc.integer({ min: 0, max: 1000000 }),
    actorId: fc.string({ minLength: 1, maxLength: 20 }),
    targetId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    metadata: fc.record({
      damage: fc.option(fc.integer({ min: 1, max: 100 })),
      source: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    }),
  });
}

/**
 * Generate an array of battle events.
 *
 * @returns Arbitrary<BattleEvent[]>
 */
export function arbitraryBattleEvents(): fc.Arbitrary<BattleEvent[]> {
  return fc.array(arbitraryBattleEvent(), { maxLength: 50 });
}

// =============================================================================
// FULL STATE GENERATORS
// =============================================================================

/**
 * Generate a random valid BattleState.
 *
 * Creates states with:
 * - 2-6 units per team (4-12 total)
 * - Valid HP bounds for all units
 * - Consistent alive status
 * - Valid turn queue (only alive units)
 * - Valid occupied positions
 * - Valid round/turn numbers
 * - Valid phase
 * - Event history
 *
 * This is the primary generator for property-based testing of battle states.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBattleState(), (state) => {
 *     // Property: All units have valid HP
 *     state.units.forEach(unit => {
 *       expect(unit.currentHp).toBeGreaterThanOrEqual(0);
 *       expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
 *     });
 *
 *     // Property: Turn queue contains only alive units
 *     const aliveIds = new Set(state.units.filter(u => u.alive).map(u => u.instanceId));
 *     state.turnQueue.forEach(id => {
 *       expect(aliveIds.has(id)).toBe(true);
 *     });
 *   })
 * );
 */
export function arbitraryBattleState(): fc.Arbitrary<BattleState> {
  return fc
    .tuple(
      fc.array(arbitraryBattleUnit(), { minLength: 2, maxLength: 6 }),
      fc.array(arbitraryBattleUnit(), { minLength: 2, maxLength: 6 }),
      arbitraryRound(),
      arbitraryTurn(),
      arbitraryPhase(),
      arbitraryBattleEvents(),
      arbitrarySeed(),
    )
    .map(([playerUnits, enemyUnits, round, turn, phase, events, seed]) => {
      // Ensure units have correct team
      const allUnits = [
        ...playerUnits.map((u) => ({ ...u, team: 'player' as const })),
        ...enemyUnits.map((u) => ({ ...u, team: 'enemy' as const })),
      ];

      // Create turn queue and occupied positions
      const turnQueue = createTurnQueue(allUnits);
      const occupiedPositions = createOccupiedPositions(allUnits);

      // Ensure currentTurnIndex is valid
      const currentTurnIndex = Math.min(
        fc.sample(fc.integer({ min: 0, max: Math.max(0, turnQueue.length - 1) }), 1)[0],
        Math.max(0, turnQueue.length - 1),
      );

      return {
        battleId: `battle_${fc.sample(fc.string({ minLength: 5, maxLength: 10 }), 1)[0]}`,
        units: allUnits,
        round,
        turn,
        currentPhase: phase,
        events,
        occupiedPositions,
        seed,
        turnQueue,
        currentTurnIndex,
      };
    });
}

/**
 * Generate a BattleState with specific constraints.
 *
 * Useful for testing specific scenarios.
 *
 * @param constraints - Partial state properties to enforce
 * @returns Arbitrary<BattleState>
 *
 * @example
 * // Generate only late-round states
 * const lateRoundState = arbitraryBattleStateWith({
 *   round: fc.integer({ min: 50, max: 100 }),
 * });
 */
export function arbitraryBattleStateWith(
  constraints: Partial<Record<keyof BattleState, fc.Arbitrary<any>>>,
): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => {
    const result: BattleState = { ...state };

    // Apply constraints
    for (const [key, arbitrary] of Object.entries(constraints)) {
      if (arbitrary) {
        (result as any)[key] = fc.sample(arbitrary, 1)[0];
      }
    }

    return result;
  });
}

/**
 * Generate a BattleState where one team is eliminated.
 *
 * All enemy units are dead.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPlayerVictoryState(), (state) => {
 *     const enemyAlive = state.units.filter(u => u.team === 'enemy' && u.alive);
 *     expect(enemyAlive.length).toBe(0);
 *   })
 * );
 */
export function arbitraryPlayerVictoryState(): fc.Arbitrary<BattleState> {
  return fc
    .tuple(
      fc.array(arbitraryBattleUnit(), { minLength: 1, maxLength: 3 }),
      fc.array(arbitraryDeadUnit(), { minLength: 1, maxLength: 3 }),
    )
    .chain(([playerUnits, deadEnemies]) => {
      return arbitraryBattleState().map((state) => ({
        ...state,
        units: [
          ...playerUnits.map((u) => ({ ...u, team: 'player' as const })),
          ...deadEnemies.map((u) => ({ ...u, team: 'enemy' as const })),
        ],
      }));
    });
}

/**
 * Generate a BattleState where enemy team is winning.
 *
 * All player units are dead.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryEnemyVictoryState(), (state) => {
 *     const playerAlive = state.units.filter(u => u.team === 'player' && u.alive);
 *     expect(playerAlive.length).toBe(0);
 *   })
 * );
 */
export function arbitraryEnemyVictoryState(): fc.Arbitrary<BattleState> {
  return fc
    .tuple(
      fc.array(arbitraryDeadUnit(), { minLength: 1, maxLength: 3 }),
      fc.array(arbitraryBattleUnit(), { minLength: 1, maxLength: 3 }),
    )
    .chain(([deadPlayers, enemyUnits]) => {
      return arbitraryBattleState().map((state) => ({
        ...state,
        units: [
          ...deadPlayers.map((u) => ({ ...u, team: 'player' as const })),
          ...enemyUnits.map((u) => ({ ...u, team: 'enemy' as const })),
        ],
      }));
    });
}

/**
 * Generate a BattleState with all units at low HP.
 *
 * All units have <= 20% of max HP.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryLowHpState(), (state) => {
 *     state.units.forEach(unit => {
 *       if (unit.alive) {
 *         expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp * 0.2);
 *       }
 *     });
 *   })
 * );
 */
export function arbitraryLowHpState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => ({
    ...state,
    units: state.units.map((unit) => {
      if (!unit.alive) return unit;
      const lowHp = Math.max(1, Math.floor(unit.maxHp * 0.2));
      return {
        ...unit,
        currentHp: fc.sample(fc.integer({ min: 1, max: lowHp }), 1)[0],
      };
    }),
  }));
}

/**
 * Generate a BattleState at a specific phase.
 *
 * @param phase - Target phase
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryBattleStateAtPhase('attack'), (state) => {
 *     expect(state.currentPhase).toBe('attack');
 *   })
 * );
 */
export function arbitraryBattleStateAtPhase(phase: Phase): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => ({
    ...state,
    currentPhase: phase,
  }));
}

/**
 * Generate a BattleState at a late round (50+).
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryLateRoundState(), (state) => {
 *     expect(state.round).toBeGreaterThanOrEqual(50);
 *   })
 * );
 */
export function arbitraryLateRoundState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => ({
    ...state,
    round: fc.sample(fc.integer({ min: 50, max: 100 }), 1)[0],
  }));
}

/**
 * Generate a BattleState with routing units.
 *
 * At least one unit is routing.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryRoutingState(), (state) => {
 *     const routing = state.units.filter(u => u.isRouting);
 *     expect(routing.length).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryRoutingState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => {
    // Ensure at least one unit is routing
    const units = [...state.units];
    if (units.length > 0) {
      const routingIndex = fc.sample(fc.integer({ min: 0, max: units.length - 1 }), 1)[0];
      units[routingIndex] = {
        ...units[routingIndex],
        resolve: 0,
        isRouting: true,
      };
    }

    return {
      ...state,
      units,
    };
  });
}

/**
 * Generate a BattleState with engaged units.
 *
 * At least one unit is engaged.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryEngagedState(), (state) => {
 *     const engaged = state.units.filter(u => u.engaged);
 *     expect(engaged.length).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryEngagedState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => {
    // Ensure at least one unit is engaged
    const units = [...state.units];
    if (units.length > 1) {
      const engagedIndex = fc.sample(fc.integer({ min: 0, max: units.length - 1 }), 1)[0];
      const engagerIndex = fc.sample(
        fc.integer({ min: 0, max: units.length - 1 }).filter((i) => i !== engagedIndex),
        1,
      )[0];

      units[engagedIndex] = {
        ...units[engagedIndex],
        engaged: true,
        engagedBy: [units[engagerIndex].instanceId],
      };
    }

    return {
      ...state,
      units,
    };
  });
}

/**
 * Generate a BattleState with phalanx formations.
 *
 * At least one unit is in phalanx.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryPhalanxState(), (state) => {
 *     const inPhalanx = state.units.filter(u => u.inPhalanx);
 *     expect(inPhalanx.length).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryPhalanxState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => {
    // Ensure at least one unit is in phalanx
    const units = [...state.units];
    if (units.length > 0) {
      const phalanxIndex = fc.sample(fc.integer({ min: 0, max: units.length - 1 }), 1)[0];
      units[phalanxIndex] = {
        ...units[phalanxIndex],
        inPhalanx: true,
      };
    }

    return {
      ...state,
      units,
    };
  });
}

/**
 * Generate a BattleState with armor shred applied.
 *
 * At least one unit has armor shred.
 *
 * @returns Arbitrary<BattleState>
 *
 * @example
 * fc.assert(
 *   fc.property(arbitraryShredState(), (state) => {
 *     const shredded = state.units.filter(u => u.armorShred > 0);
 *     expect(shredded.length).toBeGreaterThan(0);
 *   })
 * );
 */
export function arbitraryShredState(): fc.Arbitrary<BattleState> {
  return arbitraryBattleState().map((state) => {
    // Ensure at least one unit has armor shred
    const units = [...state.units];
    if (units.length > 0) {
      const shredIndex = fc.sample(fc.integer({ min: 0, max: units.length - 1 }), 1)[0];
      units[shredIndex] = {
        ...units[shredIndex],
        armorShred: fc.sample(fc.integer({ min: 1, max: 30 }), 1)[0],
      };
    }

    return {
      ...state,
      units,
    };
  });
}
