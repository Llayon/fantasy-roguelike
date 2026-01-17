/**
 * Battle repository for database access.
 * Provides query methods for battle persistence and retrieval.
 *
 * @fileoverview Repository pattern implementation for Battle entity
 * with methods for CRUD operations and battle-specific queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Battle, BattleResult } from '../entities/battle.entity';

/**
 * Battle repository for database operations.
 * Extends TypeORM Repository with custom query methods.
 *
 * @example
 * const battles = await battleRepository.findBattlesByRun(runId);
 */
@Injectable()
export class BattleRepository extends Repository<Battle> {
  private readonly logger = new Logger(BattleRepository.name);

  /**
   * Constructor for dependency injection.
   *
   * @param dataSource - TypeORM DataSource for database connection
   */
  constructor(dataSource: DataSource) {
    super(Battle, dataSource.createEntityManager());
  }

  /**
   * Find all battles for a run.
   *
   * @param runId - Run UUID
   * @returns Array of battles in the run
   *
   * @example
   * const battles = await battleRepository.findBattlesByRun(runId);
   * // Returns: [{ id: 'battle_1', result: 'win', ... }]
   */
  async findBattlesByRun(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding battles for run: ${runId}`, { runId });

    return this.find({
      where: { runId },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Find a battle by ID with all relationships.
   *
   * @param battleId - Battle UUID
   * @returns Battle entity with run and snapshot, or null if not found
   *
   * @example
   * const battle = await battleRepository.findBattleWithRelations(battleId);
   */
  async findBattleWithRelations(battleId: string): Promise<Battle | null> {
    this.logger.debug(`Finding battle with relations: ${battleId}`, {
      battleId,
    });

    return this.findOne({
      where: { id: battleId },
      relations: ['run', 'enemySnapshot'],
    });
  }

  /**
   * Find battles for a run with pagination.
   *
   * @param runId - Run UUID
   * @param skip - Number of records to skip
   * @param take - Number of records to return
   * @returns Array of battles and total count
   *
   * @example
   * const { battles, total } = await battleRepository.findBattlesByRunPaginated(
   *   runId,
   *   0,
   *   10
   * );
   */
  async findBattlesByRunPaginated(
    runId: string,
    skip: number,
    take: number,
  ): Promise<{ battles: Battle[]; total: number }> {
    this.logger.debug(`Finding paginated battles for run: ${runId}`, {
      runId,
      skip,
      take,
    });

    const [battles, total] = await this.findAndCount({
      where: { runId },
      order: {
        createdAt: 'ASC',
      },
      skip,
      take,
    });

    return { battles, total };
  }

  /**
   * Find won battles for a run.
   *
   * @param runId - Run UUID
   * @returns Array of won battles
   *
   * @example
   * const wonBattles = await battleRepository.findWonBattles(runId);
   */
  async findWonBattles(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding won battles for run: ${runId}`, { runId });

    return this.find({
      where: {
        runId,
        result: BattleResult.WIN,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Find lost battles for a run.
   *
   * @param runId - Run UUID
   * @returns Array of lost battles
   *
   * @example
   * const lostBattles = await battleRepository.findLostBattles(runId);
   */
  async findLostBattles(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding lost battles for run: ${runId}`, { runId });

    return this.find({
      where: {
        runId,
        result: BattleResult.LOSS,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Find pending battles (not yet simulated).
   *
   * @param runId - Run UUID
   * @returns Array of pending battles
   *
   * @example
   * const pending = await battleRepository.findPendingBattles(runId);
   */
  async findPendingBattles(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding pending battles for run: ${runId}`, { runId });

    return this.find({
      where: {
        runId,
        result: BattleResult.PENDING,
      },
    });
  }

  /**
   * Find battles against a specific snapshot.
   * Used to track how many times a snapshot has been used as opponent.
   *
   * @param snapshotId - Snapshot UUID
   * @returns Array of battles using this snapshot
   *
   * @example
   * const battles = await battleRepository.findBattlesBySnapshot(snapshotId);
   */
  async findBattlesBySnapshot(snapshotId: string): Promise<Battle[]> {
    this.logger.debug(`Finding battles for snapshot: ${snapshotId}`, {
      snapshotId,
    });

    return this.find({
      where: { enemySnapshotId: snapshotId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find player battles (against snapshots) for a run.
   *
   * @param runId - Run UUID
   * @returns Array of player battles
   *
   * @example
   * const playerBattles = await battleRepository.findPlayerBattles(runId);
   */
  async findPlayerBattles(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding player battles for run: ${runId}`, { runId });

    return this.find({
      where: {
        runId,
        enemySnapshotId: undefined,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Find bot battles (against generated teams) for a run.
   *
   * @param runId - Run UUID
   * @returns Array of bot battles
   *
   * @example
   * const botBattles = await battleRepository.findBotBattles(runId);
   */
  async findBotBattles(runId: string): Promise<Battle[]> {
    this.logger.debug(`Finding bot battles for run: ${runId}`, { runId });

    return this.find({
      where: {
        runId,
        enemySnapshotId: undefined,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Get battle statistics for a run.
   * Calculates win rate, average event count, etc.
   *
   * @param runId - Run UUID
   * @returns Battle statistics object
   *
   * @example
   * const stats = await battleRepository.getBattleStats(runId);
   * // Returns: { totalBattles: 5, wins: 3, losses: 2, winRate: 60 }
   */
  async getBattleStats(runId: string): Promise<{
    totalBattles: number;
    wins: number;
    losses: number;
    pending: number;
    winRate: number;
    avgEventCount: number;
  }> {
    this.logger.debug(`Getting battle stats for run: ${runId}`, { runId });

    const battles = await this.find({
      where: { runId },
    });

    const totalBattles = battles.length;
    const wins = battles.filter((b) => b.result === BattleResult.WIN).length;
    const losses = battles.filter((b) => b.result === BattleResult.LOSS).length;
    const pending = battles.filter((b) => b.result === BattleResult.PENDING).length;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
    const avgEventCount =
      totalBattles > 0
        ? Math.round(battles.reduce((sum, b) => sum + b.getEventCount(), 0) / totalBattles)
        : 0;

    return {
      totalBattles,
      wins,
      losses,
      pending,
      winRate,
      avgEventCount,
    };
  }

  /**
   * Find the last battle in a run.
   *
   * @param runId - Run UUID
   * @returns Last battle or null if no battles exist
   *
   * @example
   * const lastBattle = await battleRepository.findLastBattle(runId);
   */
  async findLastBattle(runId: string): Promise<Battle | null> {
    this.logger.debug(`Finding last battle for run: ${runId}`, { runId });

    return this.findOne({
      where: { runId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Create and save a new battle.
   *
   * @param battle - Battle entity to save
   * @returns Saved battle with ID
   *
   * @example
   * const newBattle = await battleRepository.createBattle(battle);
   */
  async createBattle(battle: Battle): Promise<Battle> {
    this.logger.debug(`Creating new battle for run: ${battle.runId}`, {
      runId: battle.runId,
      seed: battle.seed,
    });

    return this.save(battle);
  }

  /**
   * Update an existing battle.
   *
   * @param battle - Battle entity with updated values
   * @returns Updated battle
   *
   * @example
   * battle.result = BattleResult.WIN;
   * const updated = await battleRepository.updateBattle(battle);
   */
  async updateBattle(battle: Battle): Promise<Battle> {
    this.logger.debug(`Updating battle: ${battle.id}`, { battleId: battle.id });

    return this.save(battle);
  }

  /**
   * Delete a battle.
   *
   * @param battleId - Battle UUID
   * @returns True if deletion was successful
   *
   * @example
   * const deleted = await battleRepository.deleteBattle(battleId);
   */
  async deleteBattle(battleId: string): Promise<boolean> {
    this.logger.debug(`Deleting battle: ${battleId}`, { battleId });

    const result = await this.delete(battleId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Count battles for a run.
   *
   * @param runId - Run UUID
   * @returns Number of battles in the run
   *
   * @example
   * const count = await battleRepository.countBattles(runId);
   */
  async countBattles(runId: string): Promise<number> {
    return this.count({
      where: { runId },
    });
  }

  /**
   * Count won battles for a run.
   *
   * @param runId - Run UUID
   * @returns Number of won battles
   *
   * @example
   * const wins = await battleRepository.countWins(runId);
   */
  async countWins(runId: string): Promise<number> {
    return this.count({
      where: {
        runId,
        result: BattleResult.WIN,
      },
    });
  }
}
