/**
 * Snapshot service for async PvP matchmaking.
 * Handles creation and management of team snapshots for opponent matching.
 *
 * @fileoverview Service for creating snapshots after battle wins,
 * storing team composition and positions for async PvP matchmaking.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Snapshot, TeamSnapshot } from '../../entities/snapshot.entity';
import { SnapshotRepository } from '../../repositories/snapshot.repository';
import { TeamSetup } from '../../core/types';

/**
 * Request to create a snapshot after a battle win.
 */
export interface CreateSnapshotRequest {
  /** Player ID who won the battle */
  playerId: string;
  /** Run ID the battle was part of */
  runId: string;
  /** Current stage of the run (1-9) */
  stage: number;
  /** Number of wins the player had when creating snapshot */
  wins: number;
  /** Player's team setup from the battle */
  playerTeam: TeamSetup;
}

/**
 * Response when snapshot is created.
 */
export interface CreateSnapshotResponse {
  /** Snapshot ID */
  snapshotId: string;
  /** Stage the snapshot was created at */
  stage: number;
  /** Number of units in the snapshot */
  unitCount: number;
}

/**
 * Snapshot service for managing team snapshots.
 * Creates snapshots after battle wins for use in async PvP matchmaking.
 *
 * @example
 * const snapshot = await snapshotService.createSnapshot({
 *   playerId: 'player_123',
 *   runId: 'run_456',
 *   stage: 3,
 *   wins: 2,
 *   playerTeam: { units: [...], positions: [...] }
 * });
 */
@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly snapshotRepository: SnapshotRepository) {}

  /**
   * Create a snapshot after a battle win.
   *
   * Stores the player's team composition and positions at the current stage.
   * Snapshots are indexed by stage for efficient matchmaking queries.
   *
   * Requirements:
   * - 34.1: Create snapshot after each battle win
   * - 34.2: Store team composition and positions
   * - 34.3: Index by stage for efficient matchmaking
   *
   * @param request - Snapshot creation request
   * @returns Created snapshot details
   * @throws BadRequestException if team setup is invalid
   *
   * @example
   * const response = await snapshotService.createSnapshot({
   *   playerId: 'player_123',
   *   runId: 'run_456',
   *   stage: 3,
   *   wins: 2,
   *   playerTeam: {
   *     units: [
   *       { unitId: 'knight', tier: 1 },
   *       { unitId: 'archer', tier: 1 }
   *     ],
   *     positions: [
   *       { x: 3, y: 0 },
   *       { x: 5, y: 1 }
   *     ]
   *   }
   * });
   * // Returns: { snapshotId: 'snap_abc', stage: 3, unitCount: 2 }
   */
  async createSnapshot(request: CreateSnapshotRequest): Promise<CreateSnapshotResponse> {
    // Validate request
    if (!request.playerId || typeof request.playerId !== 'string') {
      throw new BadRequestException('Invalid playerId');
    }

    if (!request.runId || typeof request.runId !== 'string') {
      throw new BadRequestException('Invalid runId');
    }

    if (request.stage < 1 || request.stage > 9) {
      throw new BadRequestException('Stage must be between 1 and 9');
    }

    if (request.wins < 0) {
      throw new BadRequestException('Wins cannot be negative');
    }

    // Validate team setup
    if (!request.playerTeam || !request.playerTeam.units || request.playerTeam.units.length === 0) {
      throw new BadRequestException('Player team must have at least one unit');
    }

    if (request.playerTeam.units.length !== request.playerTeam.positions.length) {
      throw new BadRequestException('Units and positions arrays must have same length');
    }

    // Validate positions are within grid bounds (8x10 grid)
    for (const position of request.playerTeam.positions) {
      if (position.x < 0 || position.x >= 8 || position.y < 0 || position.y >= 10) {
        throw new BadRequestException(
          `Invalid position: (${position.x}, ${position.y}). Must be within 8x10 grid.`,
        );
      }
    }

    // Build team snapshot with unit data and positions
    const teamSnapshot: TeamSnapshot = {
      units: request.playerTeam.units.map((unit, index) => ({
        unitId: unit.unitId,
        tier: unit.tier || 1,
        position: request.playerTeam.positions[index],
      })),
    };

    // Create snapshot entity
    const snapshot = new Snapshot();
    snapshot.playerId = request.playerId;
    snapshot.runId = request.runId;
    snapshot.stage = request.stage;
    snapshot.wins = request.wins;
    snapshot.team = teamSnapshot;

    // Save snapshot to database
    const savedSnapshot = await this.snapshotRepository.createSnapshot(snapshot);

    this.logger.debug('Snapshot created', {
      snapshotId: savedSnapshot.id,
      playerId: request.playerId,
      runId: request.runId,
      stage: request.stage,
      wins: request.wins,
      unitCount: teamSnapshot.units.length,
    });

    return {
      snapshotId: savedSnapshot.id,
      stage: savedSnapshot.stage,
      unitCount: teamSnapshot.units.length,
    };
  }

  /**
   * Get a snapshot by ID.
   *
   * @param snapshotId - Snapshot ID
   * @returns Snapshot entity or null if not found
   *
   * @example
   * const snapshot = await snapshotService.getSnapshot('snap_123');
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new BadRequestException('Invalid snapshotId');
    }

    return this.snapshotRepository.findOne({
      where: { id: snapshotId },
    });
  }

  /**
   * Get snapshots for a specific stage (for matchmaking).
   *
   * Returns snapshots ordered by win count for difficulty scaling.
   *
   * @param stage - Stage number (1-9)
   * @param limit - Maximum number of snapshots to return
   * @returns Array of snapshots at the specified stage
   *
   * @example
   * const opponents = await snapshotService.getSnapshotsForStage(3, 10);
   */
  async getSnapshotsForStage(stage: number, limit: number = 10): Promise<Snapshot[]> {
    if (stage < 1 || stage > 9) {
      throw new BadRequestException('Stage must be between 1 and 9');
    }

    return this.snapshotRepository.findOpponentsForStage(stage, limit);
  }

  /**
   * Get snapshots for a player at a specific stage.
   *
   * @param playerId - Player ID
   * @param stage - Stage number (1-9)
   * @returns Array of snapshots created by the player at the stage
   *
   * @example
   * const snapshots = await snapshotService.getPlayerSnapshotsAtStage(
   *   'player_123',
   *   5
   * );
   */
  async getPlayerSnapshotsAtStage(playerId: string, stage: number): Promise<Snapshot[]> {
    if (!playerId || typeof playerId !== 'string') {
      throw new BadRequestException('Invalid playerId');
    }

    if (stage < 1 || stage > 9) {
      throw new BadRequestException('Stage must be between 1 and 9');
    }

    return this.snapshotRepository.findSnapshotsByPlayerAndStage(playerId, stage);
  }

  /**
   * Get all snapshots for a player.
   *
   * @param playerId - Player ID
   * @returns Array of all snapshots created by the player
   *
   * @example
   * const snapshots = await snapshotService.getPlayerSnapshots('player_123');
   */
  async getPlayerSnapshots(playerId: string): Promise<Snapshot[]> {
    if (!playerId || typeof playerId !== 'string') {
      throw new BadRequestException('Invalid playerId');
    }

    return this.snapshotRepository.findSnapshotsByPlayer(playerId);
  }

  /**
   * Get statistics for a stage.
   *
   * @param stage - Stage number (1-9)
   * @returns Stage statistics
   *
   * @example
   * const stats = await snapshotService.getStageStats(3);
   * // Returns: { totalSnapshots: 50, avgWins: 2.5, maxWins: 8, minWins: 0 }
   */
  async getStageStats(stage: number): Promise<{
    totalSnapshots: number;
    avgWins: number;
    maxWins: number;
    minWins: number;
  }> {
    if (stage < 1 || stage > 9) {
      throw new BadRequestException('Stage must be between 1 and 9');
    }

    return this.snapshotRepository.getStageStats(stage);
  }

  /**
   * Delete a snapshot.
   *
   * @param snapshotId - Snapshot ID
   * @returns True if deletion was successful
   *
   * @example
   * const deleted = await snapshotService.deleteSnapshot('snap_123');
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new BadRequestException('Invalid snapshotId');
    }

    return this.snapshotRepository.deleteSnapshot(snapshotId);
  }
}
