/**
 * Run repository for database access.
 * Provides query methods for run persistence and retrieval.
 *
 * @fileoverview Repository pattern implementation for Run entity
 * with methods for CRUD operations and run-specific queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Run, RunStatus } from '../entities/run.entity';

/**
 * Run repository for database operations.
 * Extends TypeORM Repository with custom query methods.
 *
 * @example
 * const activeRuns = await runRepository.findActiveRunsByPlayer(playerId);
 */
@Injectable()
export class RunRepository extends Repository<Run> {
  private readonly logger = new Logger(RunRepository.name);

  /**
   * Constructor for dependency injection.
   *
   * @param dataSource - TypeORM DataSource for database connection
   */
  constructor(dataSource: DataSource) {
    super(Run, dataSource.createEntityManager());
  }

  /**
   * Find all active runs for a player.
   *
   * @param playerId - Player UUID
   * @returns Array of active runs
   *
   * @example
   * const activeRuns = await runRepository.findActiveRunsByPlayer(playerId);
   * // Returns: [{ id: 'run_1', stage: 3, wins: 2, ... }]
   */
  async findActiveRunsByPlayer(playerId: string): Promise<Run[]> {
    this.logger.debug(`Finding active runs for player: ${playerId}`, { playerId });

    return this.find({
      where: {
        playerId,
        status: RunStatus.ACTIVE,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find a run by ID with all relationships.
   *
   * @param runId - Run UUID
   * @returns Run entity with battles and deck, or null if not found
   *
   * @example
   * const run = await runRepository.findRunWithRelations(runId);
   * // Returns: { id: 'run_1', battles: [...], deck: [...], ... }
   */
  async findRunWithRelations(runId: string): Promise<Run | null> {
    this.logger.debug(`Finding run with relations: ${runId}`, { runId });

    return this.findOne({
      where: { id: runId },
      relations: ['battles', 'deck', 'snapshots'],
    });
  }

  /**
   * Find all runs for a player with pagination.
   *
   * @param playerId - Player UUID
   * @param skip - Number of records to skip
   * @param take - Number of records to return
   * @returns Array of runs and total count
   *
   * @example
   * const { runs, total } = await runRepository.findRunsByPlayerPaginated(
   *   playerId,
   *   0,
   *   10
   * );
   */
  async findRunsByPlayerPaginated(
    playerId: string,
    skip: number,
    take: number,
  ): Promise<{ runs: Run[]; total: number }> {
    this.logger.debug(`Finding paginated runs for player: ${playerId}`, {
      playerId,
      skip,
      take,
    });

    const [runs, total] = await this.findAndCount({
      where: { playerId },
      order: {
        createdAt: 'DESC',
      },
      skip,
      take,
    });

    return { runs, total };
  }

  /**
   * Find completed runs (won or lost) for a player.
   *
   * @param playerId - Player UUID
   * @returns Array of completed runs
   *
   * @example
   * const completedRuns = await runRepository.findCompletedRunsByPlayer(playerId);
   */
  async findCompletedRunsByPlayer(playerId: string): Promise<Run[]> {
    this.logger.debug(`Finding completed runs for player: ${playerId}`, {
      playerId,
    });

    return this.find({
      where: [
        { playerId, status: RunStatus.WON },
        { playerId, status: RunStatus.LOST },
      ],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find runs by status for a player.
   *
   * @param playerId - Player UUID
   * @param status - Run status to filter by
   * @returns Array of runs with specified status
   *
   * @example
   * const wonRuns = await runRepository.findRunsByStatus(playerId, RunStatus.WON);
   */
  async findRunsByStatus(playerId: string, status: RunStatus): Promise<Run[]> {
    this.logger.debug(`Finding runs by status for player: ${playerId}`, {
      playerId,
      status,
    });

    return this.find({
      where: { playerId, status },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find runs at a specific stage for a player.
   * Used for matchmaking to find opponents at similar progression.
   *
   * @param playerId - Player UUID
   * @param stage - Stage number (1-9)
   * @returns Array of runs at specified stage
   *
   * @example
   * const stageRuns = await runRepository.findRunsByStage(playerId, 5);
   */
  async findRunsByStage(playerId: string, stage: number): Promise<Run[]> {
    this.logger.debug(`Finding runs at stage for player: ${playerId}`, {
      playerId,
      stage,
    });

    return this.find({
      where: { playerId, stage },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get run statistics for a player.
   * Calculates total wins, losses, and completion rate.
   *
   * @param playerId - Player UUID
   * @returns Run statistics object
   *
   * @example
   * const stats = await runRepository.getRunStats(playerId);
   * // Returns: { totalRuns: 10, totalWins: 3, totalLosses: 7, winRate: 30 }
   */
  async getRunStats(playerId: string): Promise<{
    totalRuns: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    averageStage: number;
  }> {
    this.logger.debug(`Getting run stats for player: ${playerId}`, { playerId });

    const runs = await this.find({
      where: { playerId },
    });

    const totalRuns = runs.length;
    const totalWins = runs.filter((r) => r.status === RunStatus.WON).length;
    const totalLosses = runs.filter((r) => r.status === RunStatus.LOST).length;
    const winRate = totalRuns > 0 ? Math.round((totalWins / totalRuns) * 100) : 0;
    const averageStage =
      totalRuns > 0 ? Math.round(runs.reduce((sum, r) => sum + r.stage, 0) / totalRuns) : 0;

    return {
      totalRuns,
      totalWins,
      totalLosses,
      winRate,
      averageStage,
    };
  }

  /**
   * Find the best run for a player (highest stage reached).
   *
   * @param playerId - Player UUID
   * @returns Best run or null if no runs exist
   *
   * @example
   * const bestRun = await runRepository.findBestRun(playerId);
   */
  async findBestRun(playerId: string): Promise<Run | null> {
    this.logger.debug(`Finding best run for player: ${playerId}`, { playerId });

    return this.findOne({
      where: { playerId },
      order: {
        stage: 'DESC',
        wins: 'DESC',
      },
    });
  }

  /**
   * Create and save a new run.
   *
   * @param run - Run entity to save
   * @returns Saved run with ID
   *
   * @example
   * const newRun = await runRepository.createRun(run);
   */
  async createRun(run: Run): Promise<Run> {
    this.logger.debug(`Creating new run for player: ${run.playerId}`, {
      playerId: run.playerId,
      factionId: run.factionId,
    });

    return this.save(run);
  }

  /**
   * Update an existing run.
   *
   * @param run - Run entity with updated values
   * @returns Updated run
   *
   * @example
   * run.wins += 1;
   * const updated = await runRepository.updateRun(run);
   */
  async updateRun(run: Run): Promise<Run> {
    this.logger.debug(`Updating run: ${run.id}`, { runId: run.id });

    return this.save(run);
  }

  /**
   * Delete a run and all associated data.
   *
   * @param runId - Run UUID
   * @returns True if deletion was successful
   *
   * @example
   * const deleted = await runRepository.deleteRun(runId);
   */
  async deleteRun(runId: string): Promise<boolean> {
    this.logger.debug(`Deleting run: ${runId}`, { runId });

    const result = await this.delete(runId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Count active runs for a player.
   *
   * @param playerId - Player UUID
   * @returns Number of active runs
   *
   * @example
   * const count = await runRepository.countActiveRuns(playerId);
   */
  async countActiveRuns(playerId: string): Promise<number> {
    return this.count({
      where: {
        playerId,
        status: RunStatus.ACTIVE,
      },
    });
  }
}
