import { Injectable, Logger } from '@nestjs/common';
import { SeededRandom } from '../../core/utils/random';
import { TeamSetup, TeamSetupUnit } from '../../core/types';
import { UNIT_TEMPLATES } from '../../game/units/unit.data';
import { BotTeamGenerator } from '../bot/bot-generator';

/**
 * Bot opponent for matchmaking.
 */
export interface BotOpponent {
  /** Bot team identifier */
  botId: string;
  /** Bot team setup */
  team: TeamSetup;
  /** Difficulty level (1-10) */
  difficulty: number;
}

/**
 * Snapshot opponent for matchmaking.
 */
export interface SnapshotOpponent {
  /** Snapshot identifier */
  snapshotId: string;
  /** Player team setup from snapshot */
  team: TeamSetup;
  /** Player wins at time of snapshot */
  wins: number;
}

/**
 * Matchmaking result - either snapshot or bot opponent.
 */
export type MatchmakingResult = SnapshotOpponent | BotOpponent;

/**
 * Configuration for bot difficulty scaling.
 */
export interface BotDifficultyConfig {
  /** Base difficulty (1-10) */
  baseDifficulty: number;
  /** Difficulty increase per win */
  difficultyPerWin: number;
  /** Maximum difficulty (1-10) */
  maxDifficulty: number;
}

/**
 * Default bot difficulty configuration.
 */
const DEFAULT_BOT_DIFFICULTY_CONFIG: BotDifficultyConfig = {
  baseDifficulty: 1,
  difficultyPerWin: 0.5,
  maxDifficulty: 10,
};

/**
 * Matchmaking service for roguelike mode.
 * Handles finding opponents (snapshots) and generating bot teams as fallback.
 *
 * Responsibilities:
 * - Find player snapshots matching current run stage
 * - Generate bot teams when no snapshots available
 * - Scale bot difficulty based on run progress
 * - Ensure deterministic bot generation with seeded random
 *
 * @module roguelike/matchmaking
 */
@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  /** In-memory storage for snapshots (in production, use database) */
  private snapshots: Map<string, SnapshotOpponent> = new Map();

  /** Bot difficulty configuration */
  private botDifficultyConfig: BotDifficultyConfig = DEFAULT_BOT_DIFFICULTY_CONFIG;

  /**
   * Find an opponent for a player at a given stage.
   *
   * Strategy:
   * 1. Try to find a player snapshot at the same stage
   * 2. If no snapshot found, generate a bot team
   * 3. Scale bot difficulty based on player's wins
   *
   * @param stage - Current run stage (1-9)
   * @param playerWins - Number of wins in current run
   * @param seed - Random seed for deterministic bot generation
   * @returns Opponent (snapshot or bot)
   *
   * @example
   * const opponent = await matchmakingService.findOpponent(3, 2, 12345);
   * // Returns: { snapshotId: 'snap_123', team: {...}, wins: 2 }
   * // Or: { botId: 'bot_123', team: {...}, difficulty: 3 }
   */
  findOpponent(stage: number, playerWins: number, seed: number): MatchmakingResult {
    // Try to find snapshot at same stage
    const snapshot = this.findSnapshotAtStage(stage);
    if (snapshot) {
      this.logger.debug('Found snapshot opponent', {
        snapshotId: snapshot.snapshotId,
        stage,
        wins: snapshot.wins,
      });
      return snapshot;
    }

    // Fallback to bot generation
    this.logger.debug('No snapshot found, generating bot opponent', {
      stage,
      playerWins,
    });
    return this.generateBotOpponent(stage, playerWins, seed);
  }

  /**
   * Find a snapshot at a specific stage.
   *
   * Searches the in-memory snapshot storage for a snapshot at the given stage.
   * In production, this would query the database for snapshots at the given stage.
   *
   * Strategy:
   * 1. Filter snapshots by stage
   * 2. If multiple snapshots available, select randomly
   * 3. Return undefined if no snapshots found at stage
   *
   * @param _stage - Run stage to search for (currently unused, all snapshots considered)
   * @returns Snapshot opponent or undefined if not found
   *
   * @internal
   */
  private findSnapshotAtStage(_stage: number): SnapshotOpponent | undefined {
    // Get all snapshots (in production, would filter by stage in database query)
    const allSnapshots = Array.from(this.snapshots.values());

    if (allSnapshots.length === 0) {
      return undefined;
    }

    // For now, select a random snapshot from available pool
    // In production, would filter by stage and rating range
    const randomIndex = Math.floor(Math.random() * allSnapshots.length);
    return allSnapshots[randomIndex];
  }

  /**
   * Generate a bot opponent.
   *
   * Creates a bot team with difficulty scaled by player's wins.
   * Uses seeded random for determinism.
   *
   * @param stage - Current run stage (1-9)
   * @param playerWins - Number of wins in current run
   * @param seed - Random seed for deterministic generation
   * @returns Bot opponent with team and difficulty
   *
   * @internal
   */
  private generateBotOpponent(stage: number, playerWins: number, seed: number): BotOpponent {
    // Calculate difficulty based on player wins
    const difficulty = this.calculateBotDifficulty(playerWins);

    // Generate bot team using BotTeamGenerator
    const generator = new BotTeamGenerator();
    const team = generator.generateTeam({
      difficulty,
      stage,
      seed,
    });

    const botId = `bot_${stage}_${seed}`;

    this.logger.debug('Generated bot opponent', {
      botId,
      stage,
      playerWins,
      difficulty,
      unitCount: team.units.length,
    });

    return {
      botId,
      team,
      difficulty,
    };
  }

  /**
   * Calculate bot difficulty based on player wins.
   *
   * Formula: min(maxDifficulty, baseDifficulty + wins * difficultyPerWin)
   *
   * @param playerWins - Number of wins in current run
   * @returns Difficulty level (1-10)
   *
   * @example
   * calculateBotDifficulty(0); // 1
   * calculateBotDifficulty(5); // 3.5 (capped at 10)
   * calculateBotDifficulty(10); // 10 (max)
   *
   * @internal
   */
  private calculateBotDifficulty(playerWins: number): number {
    const config = this.botDifficultyConfig;
    const difficulty = config.baseDifficulty + playerWins * config.difficultyPerWin;
    return Math.min(difficulty, config.maxDifficulty);
  }

  /**
   * Generate a bot team with given difficulty.
   *
   * Strategy:
   * 1. Select 4-8 units based on difficulty
   * 2. Ensure valid unit composition (mix of roles)
   * 3. Respect budget constraints
   * 4. Place units in enemy deployment zone
   *
   * @param difficulty - Difficulty level (1-10)
   * @param rng - Seeded random number generator
   * @returns Team setup with units and positions
   *
   * @internal
   */
  private generateBotTeam(difficulty: number, rng: SeededRandom): TeamSetup {
    // Budget scales with difficulty: 10 at difficulty 1, 30 at difficulty 10
    const budget = 10 + (difficulty - 1) * (20 / 9);

    // Unit count scales with difficulty: 3-4 at difficulty 1, 7-8 at difficulty 10
    const minUnits = Math.ceil(3 + (difficulty - 1) * (4 / 9));
    const maxUnits = Math.ceil(4 + (difficulty - 1) * (4 / 9));
    const unitCount = minUnits + Math.floor(rng.next() * (maxUnits - minUnits + 1));

    // Select units
    const units: TeamSetupUnit[] = [];
    let remainingBudget = budget;

    // Get all available units
    const availableUnits = Object.values(UNIT_TEMPLATES);

    // Try to build a balanced team
    for (let i = 0; i < unitCount && remainingBudget > 0; i++) {
      // Select random unit that fits budget
      const validUnits = availableUnits.filter((u) => u.cost <= remainingBudget);

      if (validUnits.length === 0) {
        break;
      }

      const selectedUnit = validUnits[Math.floor(rng.next() * validUnits.length)];

      units.push({
        unitId: selectedUnit.id,
        tier: 1, // TODO: Scale tier with difficulty
      });

      remainingBudget -= selectedUnit.cost;
    }

    // Generate positions in enemy deployment zone (rows 8-9)
    const positions = units.map(() => ({
      x: Math.floor(rng.next() * 8), // Random x (0-7)
      y: 8 + Math.floor(rng.next() * 2), // Random y (8-9)
    }));

    return {
      units,
      positions,
    };
  }

  /**
   * Store a player snapshot for async PvP matchmaking.
   *
   * In production, this would save to database.
   * For now, stores in memory.
   *
   * @param snapshotId - Unique snapshot identifier
   * @param team - Player team setup
   * @param wins - Number of wins at time of snapshot
   * @param stage - Run stage at time of snapshot
   *
   * @internal
   */
  storeSnapshot(snapshotId: string, team: TeamSetup, wins: number, stage: number): void {
    this.snapshots.set(snapshotId, {
      snapshotId,
      team,
      wins,
    });

    this.logger.debug('Snapshot stored', {
      snapshotId,
      stage,
      wins,
      unitCount: team.units.length,
    });
  }

  /**
   * Get snapshot by ID.
   *
   * @param snapshotId - Snapshot identifier
   * @returns Snapshot opponent or undefined if not found
   *
   * @internal
   */
  getSnapshot(snapshotId: string): SnapshotOpponent | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Set bot difficulty configuration.
   *
   * @param config - New difficulty configuration
   *
   * @example
   * matchmakingService.setBotDifficultyConfig({
   *   baseDifficulty: 2,
   *   difficultyPerWin: 0.75,
   *   maxDifficulty: 10
   * });
   */
  setBotDifficultyConfig(config: Partial<BotDifficultyConfig>): void {
    this.botDifficultyConfig = {
      ...this.botDifficultyConfig,
      ...config,
    };

    this.logger.debug('Bot difficulty config updated', this.botDifficultyConfig);
  }
}
