import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { simulateBattle } from '../../simulator/simulator';
import { BattleResult, TeamSetup, BattleEvent } from '../../core/types';
import { RunService } from '../run/run.service';
import { MatchmakingService } from '../../roguelike/matchmaking';
import { SnapshotService } from '../../roguelike/snapshot/snapshot.service';

/**
 * Request body for starting a battle.
 */
export interface StartBattleRequest {
  /** Run identifier */
  runId: string;
  /** Player team setup */
  playerTeam: TeamSetup;
}

/**
 * Response for starting a battle.
 */
export interface StartBattleResponse {
  /** Battle identifier */
  battleId: string;
  /** Enemy team setup (snapshot or bot) */
  enemyTeam: TeamSetup;
  /** Random seed for determinism */
  seed: number;
}

/**
 * Request body for simulating a battle.
 */
export interface SimulateBattleRequest {
  // Empty - uses stored teams from battle initialization
  /** Optional player ID for snapshot creation after win */
  playerId?: string;
}

/**
 * Response for simulating a battle.
 */
export interface SimulateBattleResponse {
  /** Battle outcome */
  result: 'win' | 'loss' | 'draw';
  /** All events from the battle (Core 2.0 mechanic events included) */
  events: readonly BattleEvent[];
  /** Final battle state */
  finalState: {
    /** Surviving player units */
    playerUnits: Array<{
      instanceId: string;
      unitId: string;
      alive: boolean;
      currentHp: number;
      maxHp: number;
      position: { x: number; y: number };
    }>;
    /** Surviving enemy units */
    enemyUnits: Array<{
      instanceId: string;
      unitId: string;
      alive: boolean;
      currentHp: number;
      maxHp: number;
      position: { x: number; y: number };
    }>;
  };
  /** Battle rewards (if won) */
  rewards?: {
    gold: number;
    draftOptions: Array<{ unitId: string; tier: number; cost: number }>;
  };
}

/**
 * Response for getting battle replay.
 */
export interface GetBattleReplayResponse {
  /** All events from the battle */
  events: readonly BattleEvent[];
  /** Initial battle state */
  initialState: {
    playerUnits: Array<{
      instanceId: string;
      unitId: string;
      position: { x: number; y: number };
      currentHp: number;
      maxHp: number;
    }>;
    enemyUnits: Array<{
      instanceId: string;
      unitId: string;
      position: { x: number; y: number };
      currentHp: number;
      maxHp: number;
    }>;
  };
}

/**
 * Battle simulation service for roguelike mode.
 * Handles battle creation, simulation, and replay.
 *
 * Responsibilities:
 * - Initialize battles with player and enemy teams
 * - Execute battle simulations using the core simulator
 * - Store battle results for replay
 * - Return Core 2.0 mechanic events in responses
 *
 * @module api/battle
 */
@Injectable()
export class BattleService {
  private readonly logger = new Logger(BattleService.name);

  /** In-memory storage for battles (in production, use database) */
  private battles: Map<
    string,
    {
      battleId: string;
      runId: string;
      playerTeam: TeamSetup;
      enemyTeam: TeamSetup;
      seed: number;
      result?: BattleResult;
    }
  > = new Map();

  constructor(
    private readonly runService: RunService,
    private readonly matchmakingService: MatchmakingService,
    private readonly snapshotService: SnapshotService,
  ) {}

  /**
   * Start a new battle.
   *
   * Creates a battle with the player's team and generates or finds an enemy team.
   * Returns battle ID and enemy team setup for display.
   *
   * @param request - Start battle request with runId and playerTeam
   * @returns Battle details with enemy team and seed
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if team setup is invalid
   *
   * @example
   * const response = await battleService.startBattle({
   *   runId: 'run_123',
   *   playerTeam: {
   *     units: [{ unitId: 'knight', tier: 1 }],
   *     positions: [{ x: 3, y: 0 }]
   *   }
   * });
   * // Returns: { battleId: 'battle_abc', enemyTeam: {...}, seed: 12345 }
   */
  startBattle(request: StartBattleRequest): StartBattleResponse {
    // Validate run exists
    const run = this.runService.getRun(request.runId);
    if (!run) {
      throw new NotFoundException(`Run ${request.runId} not found`);
    }

    // Validate player team
    if (!request.playerTeam || !request.playerTeam.units || request.playerTeam.units.length === 0) {
      throw new BadRequestException('Player team must have at least one unit');
    }

    if (request.playerTeam.units.length !== request.playerTeam.positions.length) {
      throw new BadRequestException('Units and positions arrays must have same length');
    }

    // Generate seed for determinism
    const seed = Math.floor(Math.random() * 2147483647);

    // Find or generate enemy team using matchmaking service
    const stage = Math.min(run.wins + 1, 9);
    const opponent = this.matchmakingService.findOpponent(stage, run.wins, seed);

    const enemyTeam = opponent.team;

    // Create battle
    const battleId = `battle_${seed}_${Date.now()}`;
    this.battles.set(battleId, {
      battleId,
      runId: request.runId,
      playerTeam: request.playerTeam,
      enemyTeam,
      seed,
    });

    this.logger.debug('Battle started', {
      battleId,
      runId: request.runId,
      seed,
      stage,
      playerUnits: request.playerTeam.units.length,
      enemyUnits: enemyTeam.units.length,
      opponentType: 'botId' in opponent ? 'bot' : 'snapshot',
    });

    return {
      battleId,
      enemyTeam,
      seed,
    };
  }

  /**
   * Simulate a battle.
   *
   * Executes the battle simulation using the core simulator.
   * Returns all events including Core 2.0 mechanic events.
   * Updates run progression (wins/losses) based on result.
   * Creates a snapshot after a win for async PvP matchmaking.
   *
   * @param battleId - Battle identifier
   * @param playerId - Player ID for snapshot creation (optional, for async snapshot creation)
   * @returns Battle result with events and final state
   * @throws NotFoundException if battle does not exist
   *
   * @example
   * const response = await battleService.simulateBattle('battle_abc', 'player_123');
   * // Returns: {
   * //   result: 'win',
   * //   events: [...all events including facing_rotated, riposte_triggered, etc.],
   * //   finalState: {...},
   * //   rewards: { gold: 5, draftOptions: [...] }
   * // }
   */
  async simulateBattle(battleId: string, playerId?: string): Promise<SimulateBattleResponse> {
    const battle = this.battles.get(battleId);

    if (!battle) {
      this.logger.warn(`Battle not found: ${battleId}`, { battleId });
      throw new NotFoundException(`Battle ${battleId} not found`);
    }

    // Execute simulation
    const result = simulateBattle(battle.playerTeam, battle.enemyTeam, battle.seed);

    // Store result
    this.battles.set(battleId, { ...battle, result });

    // Update run progression
    if (result.result === 'win') {
      this.runService.recordWin(battle.runId);

      // Create snapshot after battle win for async PvP matchmaking
      // Get run details to determine stage and wins
      const run = this.runService.getRun(battle.runId);
      const stage = Math.min(run.wins, 9); // Current stage after win
      const snapshotPlayerId = playerId || 'unknown'; // Use provided playerId or fallback

      try {
        await this.snapshotService.createSnapshot({
          playerId: snapshotPlayerId,
          runId: battle.runId,
          stage,
          wins: run.wins - 1, // Wins before this battle
          playerTeam: battle.playerTeam,
        });

        this.logger.debug('Snapshot created after battle win', {
          battleId,
          runId: battle.runId,
          playerId: snapshotPlayerId,
          stage,
          wins: run.wins - 1,
        });
      } catch (error) {
        this.logger.warn('Failed to create snapshot after battle win', {
          battleId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't fail the battle if snapshot creation fails
      }
    } else if (result.result === 'loss') {
      this.runService.recordLoss(battle.runId);
    }

    this.logger.debug('Battle simulated', {
      battleId,
      result: result.result,
      rounds: result.rounds,
      events: result.events.length,
    });

    // Build response with Core 2.0 mechanic events
    const response: SimulateBattleResponse = {
      result: result.result,
      events: result.events,
      finalState: {
        playerUnits: result.finalState.units
          .filter((u) => u.team === 'player')
          .map((u) => ({
            instanceId: u.instanceId,
            unitId: u.id,
            alive: u.alive,
            currentHp: u.currentHp,
            maxHp: u.maxHp,
            position: u.position,
          })),
        enemyUnits: result.finalState.units
          .filter((u) => u.team === 'enemy')
          .map((u) => ({
            instanceId: u.instanceId,
            unitId: u.id,
            alive: u.alive,
            currentHp: u.currentHp,
            maxHp: u.maxHp,
            position: u.position,
          })),
      },
    };

    // Add rewards if won
    if (result.result === 'win') {
      response.rewards = {
        gold: 5, // TODO: Calculate based on run stage
        draftOptions: [
          // TODO: Generate draft options
          { unitId: 'archer', tier: 1, cost: 4 },
          { unitId: 'mage', tier: 1, cost: 5 },
          { unitId: 'priest', tier: 1, cost: 4 },
        ],
      };
    }

    return response;
  }

  /**
   * Get battle replay.
   *
   * Returns all events and initial state for replaying a battle.
   * Used by frontend to animate the battle.
   *
   * @param battleId - Battle identifier
   * @returns Battle events and initial state
   * @throws NotFoundException if battle does not exist or not yet simulated
   *
   * @example
   * const replay = await battleService.getBattleReplay('battle_abc');
   * // Returns: { events: [...], initialState: {...} }
   */
  getBattleReplay(battleId: string): GetBattleReplayResponse {
    const battle = this.battles.get(battleId);

    if (!battle || !battle.result) {
      this.logger.warn(`Battle replay not found: ${battleId}`, { battleId });
      throw new NotFoundException(`Battle ${battleId} not found or not yet simulated`);
    }

    // Build initial state from team setups
    const initialState = {
      playerUnits: battle.playerTeam.units.map((unit, index) => {
        const position = battle.playerTeam.positions[index];
        return {
          instanceId: `player_${unit.unitId}_${index}`,
          unitId: unit.unitId,
          position: position || { x: 0, y: 0 },
          currentHp: 100, // TODO: Get from unit template
          maxHp: 100,
        };
      }),
      enemyUnits: battle.enemyTeam.units.map((unit, index) => {
        const position = battle.enemyTeam.positions[index];
        return {
          instanceId: `enemy_${unit.unitId}_${index}`,
          unitId: unit.unitId,
          position: position || { x: 0, y: 9 },
          currentHp: 100, // TODO: Get from unit template
          maxHp: 100,
        };
      }),
    };

    this.logger.debug('Battle replay retrieved', {
      battleId,
      events: battle.result.events.length,
    });

    return {
      events: battle.result.events,
      initialState,
    };
  }
}
