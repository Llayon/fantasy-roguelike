/**
 * Snapshot repository for database access.
 * Provides query methods for snapshot persistence and matchmaking.
 *
 * @fileoverview Repository pattern implementation for Snapshot entity
 * with methods for CRUD operations and matchmaking-specific queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Snapshot } from '../entities/snapshot.entity';

/**
 * Snapshot repository for database operations.
 * Extends TypeORM Repository with custom query methods for matchmaking.
 *
 * @example
 * const opponents = await snapshotRepository.findOpponentsForStage(stage);
 */
@Injectable()
export class SnapshotRepository extends Repository<Snapshot> {
  private readonly logger = new Logger(SnapshotRepository.name);

  /**
   * Constructor for dependency injection.
   *
   * @param dataSource - TypeORM DataSource for database connection
   */
  constructor(dataSource: DataSource) {
    super(Snapshot, dataSource.createEntityManager());
  }

  /**
   * Find snapshots for a specific stage (for matchmaking).
   * Returns snapshots ordered by win count for difficulty scaling.
   *
   * @param stage - Stage number (1-9)
   * @param limit - Maximum number of snapshots to return
   * @returns Array of snapshots at the specified stage
   *
   * @example
   * const opponents = await snapshotRepository.findOpponentsForStage(3, 10);
   * // Returns: [{ id: 'snap_1', stage: 3, wins: 2, ... }]
   */
  async findOpponentsForStage(stage: number, limit: number = 10): Promise<Snapshot[]> {
    this.logger.debug(`Finding opponents for stage: ${stage}`, { stage, limit });

    return this.find({
      where: { stage },
      order: {
        wins: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Find snapshots for a specific stage and win range (for difficulty scaling).
   * Used to find opponents with similar progression.
   *
   * @param stage - Stage number (1-9)
   * @param minWins - Minimum wins
   * @param maxWins - Maximum wins
   * @param limit - Maximum number of snapshots to return
   * @returns Array of snapshots matching criteria
   *
   * @example
   * const opponents = await snapshotRepository.findOpponentsByWinRange(
   *   3,
   *   1,
   *   3,
   *   10
   * );
   */
  async findOpponentsByWinRange(
    stage: number,
    minWins: number,
    maxWins: number,
    limit: number = 10,
  ): Promise<Snapshot[]> {
    this.logger.debug(`Finding opponents for stage ${stage} with wins ${minWins}-${maxWins}`, {
      stage,
      minWins,
      maxWins,
      limit,
    });

    return this.find({
      where: {
        stage,
      },
      order: {
        wins: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
    }).then((snapshots) => snapshots.filter((s) => s.wins >= minWins && s.wins <= maxWins));
  }

  /**
   * Find all snapshots for a player.
   *
   * @param playerId - Player UUID
   * @returns Array of snapshots created by the player
   *
   * @example
   * const snapshots = await snapshotRepository.findSnapshotsByPlayer(playerId);
   */
  async findSnapshotsByPlayer(playerId: string): Promise<Snapshot[]> {
    this.logger.debug(`Finding snapshots for player: ${playerId}`, { playerId });

    return this.find({
      where: { playerId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find snapshots for a specific run.
   *
   * @param runId - Run UUID
   * @returns Array of snapshots created from the run
   *
   * @example
   * const snapshots = await snapshotRepository.findSnapshotsByRun(runId);
   */
  async findSnapshotsByRun(runId: string): Promise<Snapshot[]> {
    this.logger.debug(`Finding snapshots for run: ${runId}`, { runId });

    return this.find({
      where: { runId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find a snapshot by ID with all relationships.
   *
   * @param snapshotId - Snapshot UUID
   * @returns Snapshot entity with battles, or null if not found
   *
   * @example
   * const snapshot = await snapshotRepository.findSnapshotWithRelations(snapshotId);
   */
  async findSnapshotWithRelations(snapshotId: string): Promise<Snapshot | null> {
    this.logger.debug(`Finding snapshot with relations: ${snapshotId}`, {
      snapshotId,
    });

    return this.findOne({
      where: { id: snapshotId },
      relations: ['battles'],
    });
  }

  /**
   * Find snapshots for a player at a specific stage.
   *
   * @param playerId - Player UUID
   * @param stage - Stage number (1-9)
   * @returns Array of snapshots at the specified stage
   *
   * @example
   * const snapshots = await snapshotRepository.findSnapshotsByPlayerAndStage(
   *   playerId,
   *   5
   * );
   */
  async findSnapshotsByPlayerAndStage(playerId: string, stage: number): Promise<Snapshot[]> {
    this.logger.debug(`Finding snapshots for player ${playerId} at stage ${stage}`, {
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
   * Find the most recent snapshot for a player at a specific stage.
   *
   * @param playerId - Player UUID
   * @param stage - Stage number (1-9)
   * @returns Most recent snapshot or null if none exist
   *
   * @example
   * const snapshot = await snapshotRepository.findLatestSnapshotByStage(
   *   playerId,
   *   5
   * );
   */
  async findLatestSnapshotByStage(playerId: string, stage: number): Promise<Snapshot | null> {
    this.logger.debug(`Finding latest snapshot for player ${playerId} at stage ${stage}`, {
      playerId,
      stage,
    });

    return this.findOne({
      where: { playerId, stage },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Find snapshots with pagination.
   *
   * @param skip - Number of records to skip
   * @param take - Number of records to return
   * @returns Array of snapshots and total count
   *
   * @example
   * const { snapshots, total } = await snapshotRepository.findSnapshotsPaginated(
   *   0,
   *   20
   * );
   */
  async findSnapshotsPaginated(
    skip: number,
    take: number,
  ): Promise<{ snapshots: Snapshot[]; total: number }> {
    this.logger.debug(`Finding paginated snapshots`, { skip, take });

    const [snapshots, total] = await this.findAndCount({
      order: {
        createdAt: 'DESC',
      },
      skip,
      take,
    });

    return { snapshots, total };
  }

  /**
   * Get snapshot statistics for a stage.
   * Calculates average wins, total snapshots, etc.
   *
   * @param stage - Stage number (1-9)
   * @returns Snapshot statistics object
   *
   * @example
   * const stats = await snapshotRepository.getStageStats(3);
   * // Returns: { totalSnapshots: 50, avgWins: 2.5, maxWins: 8 }
   */
  async getStageStats(stage: number): Promise<{
    totalSnapshots: number;
    avgWins: number;
    maxWins: number;
    minWins: number;
  }> {
    this.logger.debug(`Getting stats for stage: ${stage}`, { stage });

    const snapshots = await this.find({
      where: { stage },
    });

    const totalSnapshots = snapshots.length;
    const avgWins =
      totalSnapshots > 0
        ? Math.round((snapshots.reduce((sum, s) => sum + s.wins, 0) / totalSnapshots) * 10) / 10
        : 0;
    const maxWins = totalSnapshots > 0 ? Math.max(...snapshots.map((s) => s.wins)) : 0;
    const minWins = totalSnapshots > 0 ? Math.min(...snapshots.map((s) => s.wins)) : 0;

    return {
      totalSnapshots,
      avgWins,
      maxWins,
      minWins,
    };
  }

  /**
   * Find valid snapshots for matchmaking (recent and not too old).
   *
   * @param stage - Stage number (1-9)
   * @param maxAgeHours - Maximum age in hours (default 24)
   * @param limit - Maximum number of snapshots to return
   * @returns Array of valid snapshots
   *
   * @example
   * const validOpponents = await snapshotRepository.findValidSnapshotsForMatchmaking(
   *   3,
   *   24,
   *   10
   * );
   */
  async findValidSnapshotsForMatchmaking(
    stage: number,
    maxAgeHours: number = 24,
    limit: number = 10,
  ): Promise<Snapshot[]> {
    this.logger.debug(`Finding valid snapshots for matchmaking at stage ${stage}`, {
      stage,
      maxAgeHours,
      limit,
    });

    const snapshots = await this.find({
      where: { stage },
      order: {
        wins: 'DESC',
        createdAt: 'DESC',
      },
      take: limit * 2, // Get extra to filter by age
    });

    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    return snapshots.filter((s) => now - s.createdAt.getTime() <= maxAgeMs).slice(0, limit);
  }

  /**
   * Create and save a new snapshot.
   *
   * @param snapshot - Snapshot entity to save
   * @returns Saved snapshot with ID
   *
   * @example
   * const newSnapshot = await snapshotRepository.createSnapshot(snapshot);
   */
  async createSnapshot(snapshot: Snapshot): Promise<Snapshot> {
    this.logger.debug(`Creating new snapshot for player: ${snapshot.playerId}`, {
      playerId: snapshot.playerId,
      stage: snapshot.stage,
      wins: snapshot.wins,
    });

    return this.save(snapshot);
  }

  /**
   * Update an existing snapshot.
   *
   * @param snapshot - Snapshot entity with updated values
   * @returns Updated snapshot
   *
   * @example
   * snapshot.wins = 5;
   * const updated = await snapshotRepository.updateSnapshot(snapshot);
   */
  async updateSnapshot(snapshot: Snapshot): Promise<Snapshot> {
    this.logger.debug(`Updating snapshot: ${snapshot.id}`, { snapshotId: snapshot.id });

    return this.save(snapshot);
  }

  /**
   * Delete a snapshot.
   *
   * @param snapshotId - Snapshot UUID
   * @returns True if deletion was successful
   *
   * @example
   * const deleted = await snapshotRepository.deleteSnapshot(snapshotId);
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    this.logger.debug(`Deleting snapshot: ${snapshotId}`, { snapshotId });

    const result = await this.delete(snapshotId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Count snapshots for a stage.
   *
   * @param stage - Stage number (1-9)
   * @returns Number of snapshots at the stage
   *
   * @example
   * const count = await snapshotRepository.countSnapshotsByStage(3);
   */
  async countSnapshotsByStage(stage: number): Promise<number> {
    return this.count({
      where: { stage },
    });
  }

  /**
   * Count snapshots for a player.
   *
   * @param playerId - Player UUID
   * @returns Number of snapshots created by the player
   *
   * @example
   * const count = await snapshotRepository.countSnapshotsByPlayer(playerId);
   */
  async countSnapshotsByPlayer(playerId: string): Promise<number> {
    return this.count({
      where: { playerId },
    });
  }
}
