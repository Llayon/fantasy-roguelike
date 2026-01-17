/**
 * Unit Tests for Battle Simulator
 *
 * Tests core simulator functionality:
 * - Battle initialization
 * - Turn execution flow
 * - Battle end detection
 * - Determinism (same seed = same result)
 *
 * @module simulator/__tests__/simulator.spec
 * @see {@link simulateBattle} for main simulation function
 * @see {@link initializeBattle} for initialization logic
 * @see {@link checkBattleEnd} for end detection logic
 */

import { simulateBattle, initializeBattle, checkBattleEnd } from '../simulator';
import { TeamSetup } from '../../core/types/battle-state';
import {
  createPlayerTeam,
  createEnemyTeam,
  createSingleUnitTeam,
  createBalancedTeam,
} from '../../__tests__/fixtures';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum rounds before battle ends */
const MAX_ROUNDS = 100;

/** Test seed for deterministic tests */
const TEST_SEED = 12345;

// =============================================================================
// TEST SUITE: BATTLE INITIALIZATION (Task 38.1)
// =============================================================================

describe('Battle Simulator - Initialization', () => {
  describe('initializeBattle', () => {
    it('should create initial battle state with correct structure', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Verify state structure
      expect(state).toBeDefined();
      expect(state.battleId).toBeDefined();
      expect(state.battleId).toContain('battle_');
      expect(state.seed).toBe(TEST_SEED);
      expect(state.round).toBe(1);
      expect(state.turn).toBe(1);
      expect(state.currentPhase).toBe('turn_start');
      expect(state.events).toEqual([]);
    });

    it('should initialize all player units correctly', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Count player units
      const playerUnits = state.units.filter((u) => u.team === 'player');
      expect(playerUnits.length).toBe(playerTeam.units.length);

      // Verify each player unit
      for (let i = 0; i < playerUnits.length; i++) {
        const unit = playerUnits[i];
        const setup = playerTeam.units[i];
        const position = playerTeam.positions[i];

        expect(unit).toBeDefined();
        expect(unit.team).toBe('player');
        expect(unit.id).toBe(setup?.unitId);
        expect(unit.alive).toBe(true);
        expect(unit.currentHp).toBeGreaterThan(0);
        expect(unit.currentHp).toBe(unit.maxHp);
        expect(unit.position).toEqual(position);
        expect(unit.facing).toBe('S'); // Player units face south
      }
    });

    it('should initialize all enemy units correctly', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Count enemy units
      const enemyUnits = state.units.filter((u) => u.team === 'enemy');
      expect(enemyUnits.length).toBe(enemyTeam.units.length);

      // Verify each enemy unit
      for (let i = 0; i < enemyUnits.length; i++) {
        const unit = enemyUnits[i];
        const setup = enemyTeam.units[i];
        const position = enemyTeam.positions[i];

        expect(unit).toBeDefined();
        expect(unit.team).toBe('enemy');
        expect(unit.id).toBe(setup?.unitId);
        expect(unit.alive).toBe(true);
        expect(unit.currentHp).toBeGreaterThan(0);
        expect(unit.currentHp).toBe(unit.maxHp);
        expect(unit.position).toEqual(position);
        expect(unit.facing).toBe('N'); // Enemy units face north
      }
    });

    it('should apply tier scaling to unit stats', () => {
      const tier1Team: TeamSetup = {
        units: [{ unitId: 'knight', tier: 1 }],
        positions: [{ x: 3, y: 0 }],
      };

      const tier2Team: TeamSetup = {
        units: [{ unitId: 'knight', tier: 2 }],
        positions: [{ x: 3, y: 0 }],
      };

      const tier3Team: TeamSetup = {
        units: [{ unitId: 'knight', tier: 3 }],
        positions: [{ x: 3, y: 0 }],
      };

      const state1 = initializeBattle(tier1Team, createEnemyTeam(), TEST_SEED);
      const state2 = initializeBattle(tier2Team, createEnemyTeam(), TEST_SEED + 1);
      const state3 = initializeBattle(tier3Team, createEnemyTeam(), TEST_SEED + 2);

      const unit1 = state1.units.find((u) => u.team === 'player');
      const unit2 = state2.units.find((u) => u.team === 'player');
      const unit3 = state3.units.find((u) => u.team === 'player');

      expect(unit1).toBeDefined();
      expect(unit2).toBeDefined();
      expect(unit3).toBeDefined();

      // Tier 2 should have 10% more stats than tier 1
      expect(unit2!.maxHp).toBeGreaterThan(unit1!.maxHp);
      expect(unit2!.stats.atk).toBeGreaterThan(unit1!.stats.atk);

      // Tier 3 should have 20% more stats than tier 1
      expect(unit3!.maxHp).toBeGreaterThan(unit2!.maxHp);
      expect(unit3!.stats.atk).toBeGreaterThan(unit2!.stats.atk);
    });

    it('should build initial turn queue sorted by initiative', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Verify turn queue exists and has correct length
      expect(state.turnQueue).toBeDefined();
      expect(state.turnQueue.length).toBe(state.units.length);

      // Verify turn queue is sorted by initiative (descending)
      for (let i = 0; i < state.turnQueue.length - 1; i++) {
        const currentId = state.turnQueue[i];
        const nextId = state.turnQueue[i + 1];

        const currentUnit = state.units.find((u) => u.instanceId === currentId);
        const nextUnit = state.units.find((u) => u.instanceId === nextId);

        expect(currentUnit).toBeDefined();
        expect(nextUnit).toBeDefined();

        // Current unit should have >= initiative than next unit
        expect(currentUnit!.stats.initiative).toBeGreaterThanOrEqual(
          nextUnit!.stats.initiative,
        );
      }
    });

    it('should track occupied positions correctly', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Verify occupied positions set
      expect(state.occupiedPositions).toBeDefined();
      expect(state.occupiedPositions.size).toBe(state.units.length);

      // Verify each unit's position is in the set
      for (const unit of state.units) {
        const key = `${unit.position.x},${unit.position.y}`;
        expect(state.occupiedPositions.has(key)).toBe(true);
      }
    });

    it('should initialize Core 2.0 mechanic properties', () => {
      const playerTeam = createSingleUnitTeam('player', { units: [{ unitId: 'knight', tier: 1 }] });
      const enemyTeam = createSingleUnitTeam('enemy', { units: [{ unitId: 'rogue', tier: 1 }] });

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      const playerUnit = state.units.find((u) => u.team === 'player');
      expect(playerUnit).toBeDefined();

      // Verify Core 2.0 properties are initialized
      expect(playerUnit!.facing).toBeDefined();
      expect(['N', 'S', 'E', 'W']).toContain(playerUnit!.facing);
      expect(playerUnit!.resolve).toBeGreaterThanOrEqual(0);
      expect(playerUnit!.maxResolve).toBeGreaterThan(0);
      expect(playerUnit!.isRouting).toBe(false);
      expect(playerUnit!.engaged).toBe(false);
      expect(playerUnit!.engagedBy).toEqual([]);
      expect(playerUnit!.riposteCharges).toBeGreaterThanOrEqual(0);
      expect(playerUnit!.momentum).toBe(0);
      expect(playerUnit!.armorShred).toBe(0);
      expect(playerUnit!.inPhalanx).toBe(false);
      expect(Array.isArray(playerUnit!.tags)).toBe(true);
      expect(playerUnit!.faction).toBeDefined();
    });
  });
});

// =============================================================================
// TEST SUITE: TURN EXECUTION FLOW (Task 38.2)
// =============================================================================

describe('Battle Simulator - Turn Execution', () => {
  describe('simulateBattle - turn flow', () => {
    it('should execute turns in initiative order', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      // Find turn_start events to verify order
      const turnStartEvents = result.events.filter((e) => e.type === 'turn_start');

      expect(turnStartEvents.length).toBeGreaterThan(0);

      // Verify events are in chronological order within each round
      let currentRound = 1;
      let lastTurnInRound = 0;

      for (const event of turnStartEvents) {
        if (event.round > currentRound) {
          // New round started - reset turn counter
          currentRound = event.round;
          lastTurnInRound = 0;
        }

        // Within a round, turn numbers should increase
        expect(event.turn).toBeGreaterThan(lastTurnInRound);
        lastTurnInRound = event.turn;
      }
    });

    it('should emit turn_start and turn_end events for each turn', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      const turnStartEvents = result.events.filter((e) => e.type === 'turn_start');
      const turnEndEvents = result.events.filter((e) => e.type === 'turn_end');

      // Should have matching turn_start and turn_end events
      expect(turnStartEvents.length).toBeGreaterThan(0);
      expect(turnEndEvents.length).toBeGreaterThan(0);
      expect(turnStartEvents.length).toBe(turnEndEvents.length);
    });

    it('should emit round_start and round_end events for each round', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      const roundStartEvents = result.events.filter((e) => e.type === 'round_start');
      const roundEndEvents = result.events.filter((e) => e.type === 'round_end');

      // Should have at least one round
      expect(roundStartEvents.length).toBeGreaterThan(0);
      expect(roundEndEvents.length).toBeGreaterThan(0);

      // Should have matching round_start and round_end events
      expect(roundStartEvents.length).toBe(roundEndEvents.length);
    });

    it('should process all alive units in each round', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      // Get first round events
      const firstRoundStart = result.events.find((e) => e.type === 'round_start');
      expect(firstRoundStart).toBeDefined();

      // Count turn_start events in first round
      const firstRoundTurns = result.events.filter(
        (e) => e.type === 'turn_start' && e.round === 1,
      );

      // Should have one turn per unit (player + enemy)
      const totalUnits = playerTeam.units.length + enemyTeam.units.length;
      expect(firstRoundTurns.length).toBeLessThanOrEqual(totalUnits);
    });

    it('should skip dead units in turn queue', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      // Find when a unit dies
      const deathEvent = result.events.find((e) => e.type === 'unit_died');

      if (deathEvent) {
        // Find turn_start events after death
        const deathTurn = deathEvent.turn;
        const laterTurnStarts = result.events.filter(
          (e) => e.type === 'turn_start' && e.turn > deathTurn,
        );

        // Dead unit should not have any turn_start events after death
        const deadUnitId = deathEvent.metadata?.unitId;
        const deadUnitTurns = laterTurnStarts.filter(
          (e) => e.metadata?.unitId === deadUnitId,
        );

        expect(deadUnitTurns.length).toBe(0);
      }
    });

    it('should rebuild turn queue at start of each round', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      const roundStartEvents = result.events.filter((e) => e.type === 'round_start');

      // Each round should have a turn queue
      for (const roundStart of roundStartEvents) {
        expect(roundStart.metadata?.turnQueueOrder).toBeDefined();
        expect(Array.isArray(roundStart.metadata?.turnQueueOrder)).toBe(true);
      }
    });

    it('should advance round counter correctly', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      const roundStartEvents = result.events.filter((e) => e.type === 'round_start');

      // Verify round numbers are sequential
      for (let i = 0; i < roundStartEvents.length; i++) {
        const event = roundStartEvents[i];
        expect(event.round).toBe(i + 1);
        expect(event.metadata?.roundNumber).toBe(i + 1);
      }
    });
  });
});

// =============================================================================
// TEST SUITE: BATTLE END DETECTION (Task 38.3)
// =============================================================================

describe('Battle Simulator - Battle End Detection', () => {
  describe('checkBattleEnd', () => {
    it('should detect player victory when all enemies are dead', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Kill all enemy units
      const updatedUnits = state.units.map((u) =>
        u.team === 'enemy' ? { ...u, alive: false, currentHp: 0 } : u,
      );

      const endState = { ...state, units: updatedUnits };
      const result = checkBattleEnd(endState);

      expect(result).not.toBeNull();
      expect(result?.result).toBe('win');
      expect(result?.winner).toBe('player');
      expect(result?.playerSurvivors.length).toBeGreaterThan(0);
      expect(result?.enemySurvivors.length).toBe(0);
    });

    it('should detect player loss when all player units are dead', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Kill all player units
      const updatedUnits = state.units.map((u) =>
        u.team === 'player' ? { ...u, alive: false, currentHp: 0 } : u,
      );

      const endState = { ...state, units: updatedUnits };
      const result = checkBattleEnd(endState);

      expect(result).not.toBeNull();
      expect(result?.result).toBe('loss');
      expect(result?.winner).toBe('enemy');
      expect(result?.playerSurvivors.length).toBe(0);
      expect(result?.enemySurvivors.length).toBeGreaterThan(0);
    });

    it('should detect draw when max rounds reached', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Set round to MAX_ROUNDS + 1
      const endState = { ...state, round: MAX_ROUNDS + 1 };
      const result = checkBattleEnd(endState);

      expect(result).not.toBeNull();
      expect(result?.result).toBe('draw');
      expect(result?.winner).toBeNull();
      expect(result?.rounds).toBe(MAX_ROUNDS);
    });

    it('should return null when battle should continue', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();

      const state = initializeBattle(playerTeam, enemyTeam, TEST_SEED);

      // Battle just started - should continue
      const result = checkBattleEnd(state);

      expect(result).toBeNull();
    });
  });

  describe('simulateBattle - end conditions', () => {
    it('should end battle when player wins', () => {
      // Create weak enemy team
      const playerTeam: TeamSetup = {
        units: [
          { unitId: 'knight', tier: 3 },
          { unitId: 'knight', tier: 3 },
        ],
        positions: [
          { x: 3, y: 0 },
          { x: 4, y: 0 },
        ],
      };

      const enemyTeam: TeamSetup = {
        units: [{ unitId: 'rogue', tier: 1 }],
        positions: [{ x: 3, y: 9 }],
      };

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      expect(result.result).toBe('win');
      expect(result.winner).toBe('player');
      expect(result.enemySurvivors.length).toBe(0);
      expect(result.playerSurvivors.length).toBeGreaterThan(0);
    });

    it('should end battle when player loses', () => {
      // Create weak player team
      const playerTeam: TeamSetup = {
        units: [{ unitId: 'rogue', tier: 1 }],
        positions: [{ x: 3, y: 0 }],
      };

      const enemyTeam: TeamSetup = {
        units: [
          { unitId: 'knight', tier: 3 },
          { unitId: 'knight', tier: 3 },
        ],
        positions: [
          { x: 3, y: 9 },
          { x: 4, y: 9 },
        ],
      };

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      expect(result.result).toBe('loss');
      expect(result.winner).toBe('enemy');
      expect(result.playerSurvivors.length).toBe(0);
      expect(result.enemySurvivors.length).toBeGreaterThan(0);
    });

    it('should emit battle_start and battle_end events', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      // Find battle events
      const battleStart = result.events.find((e) => e.type === 'battle_start');
      const battleEnd = result.events.find((e) => e.type === 'battle_end');

      expect(battleStart).toBeDefined();
      expect(battleEnd).toBeDefined();

      // battle_start should be first event
      expect(result.events[0]).toEqual(battleStart);

      // battle_end should be last event
      expect(result.events[result.events.length - 1]).toEqual(battleEnd);
    });

    it('should include final state in result', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      expect(result.finalState).toBeDefined();
      expect(result.finalState.units).toBeDefined();
      expect(result.finalState.round).toBeGreaterThanOrEqual(1);
      expect(result.finalState.events).toBeDefined();
      expect(result.finalState.events.length).toBe(result.events.length);
    });

    it('should track round count correctly', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');

      const result = simulateBattle(playerTeam, enemyTeam, TEST_SEED);

      expect(result.rounds).toBeGreaterThanOrEqual(1);
      expect(result.rounds).toBeLessThanOrEqual(MAX_ROUNDS);
    });
  });
});

// =============================================================================
// TEST SUITE: DETERMINISM (Task 38.4)
// =============================================================================

describe('Battle Simulator - Determinism', () => {
  describe('same seed = same result', () => {
    it('should produce identical results with same seed', () => {
      const playerTeam = createPlayerTeam();
      const enemyTeam = createEnemyTeam();
      const seed = 42;

      // Run battle twice with same seed
      const result1 = simulateBattle(playerTeam, enemyTeam, seed);
      const result2 = simulateBattle(playerTeam, enemyTeam, seed);

      // Results should be identical
      expect(result1.result).toBe(result2.result);
      expect(result1.winner).toBe(result2.winner);
      expect(result1.rounds).toBe(result2.rounds);
      expect(result1.playerSurvivors).toEqual(result2.playerSurvivors);
      expect(result1.enemySurvivors).toEqual(result2.enemySurvivors);
    });

    it('should produce identical event sequences with same seed', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy');
      const seed = 12345;

      // Run battle twice with same seed
      const result1 = simulateBattle(playerTeam, enemyTeam, seed);
      const result2 = simulateBattle(playerTeam, enemyTeam, seed);

      // Event counts should match
      expect(result1.events.length).toBe(result2.events.length);

      // Event types should match in order
      const types1 = result1.events.map((e) => e.type);
      const types2 = result2.events.map((e) => e.type);
      expect(types1).toEqual(types2);
    });

    it('should produce identical final states with same seed', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');
      const seed = 99999;

      // Run battle twice with same seed
      const result1 = simulateBattle(playerTeam, enemyTeam, seed);
      const result2 = simulateBattle(playerTeam, enemyTeam, seed);

      // Final state unit counts should match
      const alive1 = result1.finalState.units.filter((u) => u.alive);
      const alive2 = result2.finalState.units.filter((u) => u.alive);
      expect(alive1.length).toBe(alive2.length);

      // Final state HP values should match
      for (let i = 0; i < result1.finalState.units.length; i++) {
        const unit1 = result1.finalState.units[i];
        const unit2 = result2.finalState.units[i];

        expect(unit1.currentHp).toBe(unit2.currentHp);
        expect(unit1.alive).toBe(unit2.alive);
      }
    });

    it('should produce different results with different seeds', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');

      // Run battle with different seeds
      const result1 = simulateBattle(playerTeam, enemyTeam, 111);
      const result2 = simulateBattle(playerTeam, enemyTeam, 222);
      const result3 = simulateBattle(playerTeam, enemyTeam, 333);

      // At least one result should differ (very high probability)
      const allSame =
        result1.result === result2.result &&
        result2.result === result3.result &&
        result1.rounds === result2.rounds &&
        result2.rounds === result3.rounds;

      // With different seeds, results should vary
      // (This might occasionally fail if all three battles have identical outcomes,
      // but probability is extremely low with balanced teams)
      expect(allSame).toBe(false);
    });

    it('should maintain determinism across multiple runs', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy', { units: [{ unitId: 'archer', tier: 1 }] });
      const seed = 54321;

      // Run battle 5 times with same seed
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(simulateBattle(playerTeam, enemyTeam, seed));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].result).toBe(results[0].result);
        expect(results[i].winner).toBe(results[0].winner);
        expect(results[i].rounds).toBe(results[0].rounds);
        expect(results[i].events.length).toBe(results[0].events.length);
      }
    });

    it('should produce deterministic turn order', () => {
      const playerTeam = createBalancedTeam('player');
      const enemyTeam = createBalancedTeam('enemy');
      const seed = 77777;

      // Run battle twice with same seed
      const result1 = simulateBattle(playerTeam, enemyTeam, seed);
      const result2 = simulateBattle(playerTeam, enemyTeam, seed);

      // Extract turn_start events
      const turns1 = result1.events.filter((e) => e.type === 'turn_start');
      const turns2 = result2.events.filter((e) => e.type === 'turn_start');

      expect(turns1.length).toBe(turns2.length);

      // Turn order should be identical
      for (let i = 0; i < turns1.length; i++) {
        expect(turns1[i].metadata?.unitId).toBe(turns2[i].metadata?.unitId);
      }
    });

    it('should produce deterministic damage rolls', () => {
      const playerTeam = createSingleUnitTeam('player');
      const enemyTeam = createSingleUnitTeam('enemy', { units: [{ unitId: 'rogue', tier: 1 }] });
      const seed = 11111;

      // Run battle twice with same seed
      const result1 = simulateBattle(playerTeam, enemyTeam, seed);
      const result2 = simulateBattle(playerTeam, enemyTeam, seed);

      // Final HP should be identical
      const playerUnit1 = result1.finalState.units.find((u) => u.team === 'player');
      const playerUnit2 = result2.finalState.units.find((u) => u.team === 'player');
      const enemyUnit1 = result1.finalState.units.find((u) => u.team === 'enemy');
      const enemyUnit2 = result2.finalState.units.find((u) => u.team === 'enemy');

      if (playerUnit1 && playerUnit2) {
        expect(playerUnit1.currentHp).toBe(playerUnit2.currentHp);
      }

      if (enemyUnit1 && enemyUnit2) {
        expect(enemyUnit1.currentHp).toBe(enemyUnit2.currentHp);
      }
    });
  });
});
