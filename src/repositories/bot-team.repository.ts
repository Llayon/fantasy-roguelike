/**
 * BotTeam repository for database access.
 * Provides query methods for bot team persistence and selection.
 *
 * @fileoverview Repository pattern implementation for BotTeam entity
 * with methods for CRUD operations and bot selection queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BotTeam } from '../entities/bot-team.entity';

/**
 * BotTeam repository for database operations.
 * Extends TypeORM Repository with custom query methods for bot selection.
 *
 * @example
 * const botTeams = await botTeamRepository.findBotTeamsForStage(3);
 */
@Injectable()
export class BotTeamRepository extends Repository<BotTeam> {
  private readonly logger = new Logger(BotTeamRepository.name);

  /**
   * Constructor for dependency injection.
   *
   * @param dataSource - TypeORM DataSource for database connection
   */
  constructor(dataSource: DataSource) {
    super(BotTeam, dataSource.createEntityManager());
  }

  /**
   * Find bot teams for a specific stage.
   * Returns all difficulties for the stage.
   *
   * @param stage - Stage number (1-9)
   * @returns Array of bot teams at the specified stage
   *
   * @example
   * const botTeams = await botTeamRepository.findBotTeamsForStage(3);
   * // Returns: [{ id: 'bot_1', stage: 3, difficulty: 1, ... }, ...]
   */
  async findBotTeamsForStage(stage: number): Promise<BotTeam[]> {
    this.logger.debug(`Finding bot teams for stage: ${stage}`, { stage });

    return this.find({
      where: { stage },
      order: {
        difficulty: 'ASC',
      },
    });
  }

  /**
   * Find bot teams for a specific stage and difficulty.
   *
   * @param stage - Stage number (1-9)
   * @param difficulty - Difficulty level (1-10)
   * @returns Array of bot teams matching criteria
   *
   * @example
   * const botTeams = await botTeamRepository.findBotTeamsByDifficulty(3, 5);
   */
  async findBotTeamsByDifficulty(stage: number, difficulty: number): Promise<BotTeam[]> {
    this.logger.debug(`Finding bot teams for stage ${stage} with difficulty ${difficulty}`, {
      stage,
      difficulty,
    });

    return this.find({
      where: { stage, difficulty },
    });
  }

  /**
   * Find a random bot team for a specific stage and difficulty.
   * Used for matchmaking when multiple bot teams exist.
   *
   * @param stage - Stage number (1-9)
   * @param difficulty - Difficulty level (1-10)
   * @returns Random bot team or null if none exist
   *
   * @example
   * const botTeam = await botTeamRepository.findRandomBotTeam(3, 5);
   */
  async findRandomBotTeam(stage: number, difficulty: number): Promise<BotTeam | null> {
    this.logger.debug(`Finding random bot team for stage ${stage} with difficulty ${difficulty}`, {
      stage,
      difficulty,
    });

    const botTeams = await this.find({
      where: { stage, difficulty },
    });

    if (botTeams.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * botTeams.length);
    return botTeams[randomIndex] || null;
  }

  /**
   * Find bot teams for a stage within a difficulty range.
   * Used for difficulty scaling based on player progression.
   *
   * @param stage - Stage number (1-9)
   * @param minDifficulty - Minimum difficulty (1-10)
   * @param maxDifficulty - Maximum difficulty (1-10)
   * @returns Array of bot teams in difficulty range
   *
   * @example
   * const botTeams = await botTeamRepository.findBotTeamsByDifficultyRange(
   *   3,
   *   3,
   *   7
   * );
   */
  async findBotTeamsByDifficultyRange(
    stage: number,
    minDifficulty: number,
    maxDifficulty: number,
  ): Promise<BotTeam[]> {
    this.logger.debug(
      `Finding bot teams for stage ${stage} with difficulty ${minDifficulty}-${maxDifficulty}`,
      { stage, minDifficulty, maxDifficulty },
    );

    return this.find({
      where: { stage },
      order: {
        difficulty: 'ASC',
      },
    }).then((botTeams) =>
      botTeams.filter((b) => b.difficulty >= minDifficulty && b.difficulty <= maxDifficulty),
    );
  }

  /**
   * Find all bot teams.
   *
   * @returns Array of all bot teams
   *
   * @example
   * const allBotTeams = await botTeamRepository.findAllBotTeams();
   */
  async findAllBotTeams(): Promise<BotTeam[]> {
    this.logger.debug(`Finding all bot teams`);

    return this.find({
      order: {
        stage: 'ASC',
        difficulty: 'ASC',
      },
    });
  }

  /**
   * Get bot team statistics.
   * Calculates total teams, coverage by stage, etc.
   *
   * @returns Bot team statistics object
   *
   * @example
   * const stats = await botTeamRepository.getBotTeamStats();
   * // Returns: { totalTeams: 90, stagesCovered: 9, avgTeamsPerStage: 10 }
   */
  async getBotTeamStats(): Promise<{
    totalTeams: number;
    stagesCovered: number;
    avgTeamsPerStage: number;
    teamsByStage: Record<number, number>;
    teamsByDifficulty: Record<number, number>;
  }> {
    this.logger.debug(`Getting bot team statistics`);

    const botTeams = await this.find();

    const totalTeams = botTeams.length;
    const stagesCovered = new Set(botTeams.map((b) => b.stage)).size;
    const avgTeamsPerStage = totalTeams > 0 ? Math.round(totalTeams / stagesCovered) : 0;

    const teamsByStage: Record<number, number> = {};
    const teamsByDifficulty: Record<number, number> = {};

    for (const botTeam of botTeams) {
      teamsByStage[botTeam.stage] = (teamsByStage[botTeam.stage] || 0) + 1;
      teamsByDifficulty[botTeam.difficulty] = (teamsByDifficulty[botTeam.difficulty] || 0) + 1;
    }

    return {
      totalTeams,
      stagesCovered,
      avgTeamsPerStage,
      teamsByStage,
      teamsByDifficulty,
    };
  }

  /**
   * Get bot team coverage for a stage.
   * Shows how many teams exist for each difficulty.
   *
   * @param stage - Stage number (1-9)
   * @returns Coverage object with difficulty distribution
   *
   * @example
   * const coverage = await botTeamRepository.getStageCoverage(3);
   * // Returns: { stage: 3, totalTeams: 10, difficulties: { 1: 1, 2: 1, ..., 10: 1 } }
   */
  async getStageCoverage(stage: number): Promise<{
    stage: number;
    totalTeams: number;
    difficulties: Record<number, number>;
  }> {
    this.logger.debug(`Getting coverage for stage: ${stage}`, { stage });

    const botTeams = await this.find({
      where: { stage },
    });

    const difficulties: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      difficulties[i] = botTeams.filter((b) => b.difficulty === i).length;
    }

    return {
      stage,
      totalTeams: botTeams.length,
      difficulties,
    };
  }

  /**
   * Create and save a new bot team.
   *
   * @param botTeam - BotTeam entity to save
   * @returns Saved bot team with ID
   *
   * @example
   * const newBotTeam = await botTeamRepository.createBotTeam(botTeam);
   */
  async createBotTeam(botTeam: BotTeam): Promise<BotTeam> {
    this.logger.debug(`Creating new bot team for stage ${botTeam.stage}`, {
      stage: botTeam.stage,
      difficulty: botTeam.difficulty,
    });

    return this.save(botTeam);
  }

  /**
   * Create multiple bot teams in batch.
   *
   * @param botTeams - Array of BotTeam entities to save
   * @returns Array of saved bot teams with IDs
   *
   * @example
   * const newBotTeams = await botTeamRepository.createBotTeamsBatch(botTeams);
   */
  async createBotTeamsBatch(botTeams: BotTeam[]): Promise<BotTeam[]> {
    this.logger.debug(`Creating ${botTeams.length} bot teams in batch`);

    return this.save(botTeams);
  }

  /**
   * Update an existing bot team.
   *
   * @param botTeam - BotTeam entity with updated values
   * @returns Updated bot team
   *
   * @example
   * botTeam.team = newTeamData;
   * const updated = await botTeamRepository.updateBotTeam(botTeam);
   */
  async updateBotTeam(botTeam: BotTeam): Promise<BotTeam> {
    this.logger.debug(`Updating bot team: ${botTeam.id}`, { botTeamId: botTeam.id });

    return this.save(botTeam);
  }

  /**
   * Delete a bot team.
   *
   * @param botTeamId - BotTeam UUID
   * @returns True if deletion was successful
   *
   * @example
   * const deleted = await botTeamRepository.deleteBotTeam(botTeamId);
   */
  async deleteBotTeam(botTeamId: string): Promise<boolean> {
    this.logger.debug(`Deleting bot team: ${botTeamId}`, { botTeamId });

    const result = await this.delete(botTeamId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Delete all bot teams for a stage.
   * Used for re-seeding a stage.
   *
   * @param stage - Stage number (1-9)
   * @returns Number of deleted teams
   *
   * @example
   * const deleted = await botTeamRepository.deleteStage(3);
   */
  async deleteStage(stage: number): Promise<number> {
    this.logger.debug(`Deleting all bot teams for stage: ${stage}`, { stage });

    const result = await this.delete({ stage });
    return result.affected ?? 0;
  }

  /**
   * Delete all bot teams.
   * Used for complete re-seeding.
   *
   * @returns Number of deleted teams
   *
   * @example
   * const deleted = await botTeamRepository.deleteAllBotTeams();
   */
  async deleteAllBotTeams(): Promise<number> {
    this.logger.debug(`Deleting all bot teams`);

    const result = await this.delete({});
    return result.affected ?? 0;
  }

  /**
   * Count bot teams for a stage.
   *
   * @param stage - Stage number (1-9)
   * @returns Number of bot teams at the stage
   *
   * @example
   * const count = await botTeamRepository.countByStage(3);
   */
  async countByStage(stage: number): Promise<number> {
    return this.count({
      where: { stage },
    });
  }

  /**
   * Count bot teams for a stage and difficulty.
   *
   * @param stage - Stage number (1-9)
   * @param difficulty - Difficulty level (1-10)
   * @returns Number of bot teams matching criteria
   *
   * @example
   * const count = await botTeamRepository.countByDifficulty(3, 5);
   */
  async countByDifficulty(stage: number, difficulty: number): Promise<number> {
    return this.count({
      where: { stage, difficulty },
    });
  }

  /**
   * Count total bot teams.
   *
   * @returns Total number of bot teams
   *
   * @example
   * const total = await botTeamRepository.countAll();
   */
  async countAll(): Promise<number> {
    return this.count();
  }
}
