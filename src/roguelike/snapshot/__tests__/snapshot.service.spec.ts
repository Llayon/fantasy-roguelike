/**
 * Tests for snapshot service.
 * Verifies snapshot creation, storage, and retrieval functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SnapshotService, CreateSnapshotRequest } from '../snapshot.service';
import { SnapshotRepository } from '../../../repositories/snapshot.repository';
import { Snapshot, TeamSnapshot } from '../../../entities/snapshot.entity';

describe('SnapshotService', () => {
  let service: SnapshotService;
  let repository: SnapshotRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotService,
        {
          provide: SnapshotRepository,
          useValue: {
            createSnapshot: jest.fn(),
            findOne: jest.fn(),
            findOpponentsForStage: jest.fn(),
            findSnapshotsByPlayerAndStage: jest.fn(),
            findSnapshotsByPlayer: jest.fn(),
            getStageStats: jest.fn(),
            deleteSnapshot: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SnapshotService>(SnapshotService);
    repository = module.get<SnapshotRepository>(SnapshotRepository);
  });

  describe('createSnapshot', () => {
    it('should create a snapshot after a battle win', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [
            { unitId: 'knight', tier: 1 },
            { unitId: 'archer', tier: 1 },
          ],
          positions: [
            { x: 3, y: 0 },
            { x: 5, y: 1 },
          ],
        },
      };

      const savedSnapshot = new Snapshot();
      savedSnapshot.id = 'snap_abc';
      savedSnapshot.playerId = request.playerId;
      savedSnapshot.runId = request.runId;
      savedSnapshot.stage = request.stage;
      savedSnapshot.wins = request.wins;
      savedSnapshot.team = {
        units: [
          { unitId: 'knight', tier: 1, position: { x: 3, y: 0 } },
          { unitId: 'archer', tier: 1, position: { x: 5, y: 1 } },
        ],
      };

      jest.spyOn(repository, 'createSnapshot').mockResolvedValue(savedSnapshot);

      // Act
      const result = await service.createSnapshot(request);

      // Assert
      expect(result).toEqual({
        snapshotId: 'snap_abc',
        stage: 3,
        unitCount: 2,
      });
      expect(repository.createSnapshot).toHaveBeenCalled();
    });

    it('should store team composition and positions', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 5,
        wins: 4,
        playerTeam: {
          units: [
            { unitId: 'knight', tier: 2 },
            { unitId: 'mage', tier: 1 },
            { unitId: 'archer', tier: 2 },
          ],
          positions: [
            { x: 2, y: 0 },
            { x: 4, y: 1 },
            { x: 6, y: 0 },
          ],
        },
      };

      const savedSnapshot = new Snapshot();
      savedSnapshot.id = 'snap_xyz';
      savedSnapshot.team = {
        units: [
          { unitId: 'knight', tier: 2, position: { x: 2, y: 0 } },
          { unitId: 'mage', tier: 1, position: { x: 4, y: 1 } },
          { unitId: 'archer', tier: 2, position: { x: 6, y: 0 } },
        ],
      };

      jest.spyOn(repository, 'createSnapshot').mockResolvedValue(savedSnapshot);

      // Act
      const result = await service.createSnapshot(request);

      // Assert
      expect(result.unitCount).toBe(3);
      const savedCall = (repository.createSnapshot as jest.Mock).mock.calls[0][0];
      expect(savedCall.team.units).toHaveLength(3);
      expect(savedCall.team.units[0]).toEqual({
        unitId: 'knight',
        tier: 2,
        position: { x: 2, y: 0 },
      });
    });

    it('should index snapshot by stage for efficient matchmaking', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [{ unitId: 'knight', tier: 1 }],
          positions: [{ x: 3, y: 0 }],
        },
      };

      const savedSnapshot = new Snapshot();
      savedSnapshot.id = 'snap_abc';
      savedSnapshot.stage = 3;

      jest.spyOn(repository, 'createSnapshot').mockResolvedValue(savedSnapshot);

      // Act
      await service.createSnapshot(request);

      // Assert
      const savedCall = (repository.createSnapshot as jest.Mock).mock.calls[0][0];
      expect(savedCall.stage).toBe(3);
    });

    it('should reject invalid playerId', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: '',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [{ unitId: 'knight', tier: 1 }],
          positions: [{ x: 3, y: 0 }],
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid stage', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 10, // Invalid: must be 1-9
        wins: 2,
        playerTeam: {
          units: [{ unitId: 'knight', tier: 1 }],
          positions: [{ x: 3, y: 0 }],
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });

    it('should reject empty team', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [],
          positions: [],
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });

    it('should reject mismatched units and positions', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [
            { unitId: 'knight', tier: 1 },
            { unitId: 'archer', tier: 1 },
          ],
          positions: [{ x: 3, y: 0 }], // Only 1 position for 2 units
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });

    it('should reject positions outside grid bounds', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: 2,
        playerTeam: {
          units: [{ unitId: 'knight', tier: 1 }],
          positions: [{ x: 10, y: 0 }], // x=10 is outside 8x10 grid
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });

    it('should reject negative wins', async () => {
      // Arrange
      const request: CreateSnapshotRequest = {
        playerId: 'player_123',
        runId: 'run_456',
        stage: 3,
        wins: -1,
        playerTeam: {
          units: [{ unitId: 'knight', tier: 1 }],
          positions: [{ x: 3, y: 0 }],
        },
      };

      // Act & Assert
      await expect(service.createSnapshot(request)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSnapshotsForStage', () => {
    it('should retrieve snapshots for a specific stage', async () => {
      // Arrange
      const snapshots: Snapshot[] = [
        { id: 'snap_1', stage: 3, wins: 2 } as Snapshot,
        { id: 'snap_2', stage: 3, wins: 1 } as Snapshot,
      ];

      jest.spyOn(repository, 'findOpponentsForStage').mockResolvedValue(snapshots);

      // Act
      const result = await service.getSnapshotsForStage(3, 10);

      // Assert
      expect(result).toEqual(snapshots);
      expect(repository.findOpponentsForStage).toHaveBeenCalledWith(3, 10);
    });

    it('should reject invalid stage', async () => {
      // Act & Assert
      await expect(service.getSnapshotsForStage(0)).rejects.toThrow(BadRequestException);
      await expect(service.getSnapshotsForStage(10)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPlayerSnapshotsAtStage', () => {
    it('should retrieve player snapshots at a specific stage', async () => {
      // Arrange
      const snapshots: Snapshot[] = [
        { id: 'snap_1', playerId: 'player_123', stage: 5 } as Snapshot,
      ];

      jest.spyOn(repository, 'findSnapshotsByPlayerAndStage').mockResolvedValue(snapshots);

      // Act
      const result = await service.getPlayerSnapshotsAtStage('player_123', 5);

      // Assert
      expect(result).toEqual(snapshots);
      expect(repository.findSnapshotsByPlayerAndStage).toHaveBeenCalledWith('player_123', 5);
    });
  });

  describe('getPlayerSnapshots', () => {
    it('should retrieve all snapshots for a player', async () => {
      // Arrange
      const snapshots: Snapshot[] = [
        { id: 'snap_1', playerId: 'player_123', stage: 3 } as Snapshot,
        { id: 'snap_2', playerId: 'player_123', stage: 5 } as Snapshot,
      ];

      jest.spyOn(repository, 'findSnapshotsByPlayer').mockResolvedValue(snapshots);

      // Act
      const result = await service.getPlayerSnapshots('player_123');

      // Assert
      expect(result).toEqual(snapshots);
      expect(repository.findSnapshotsByPlayer).toHaveBeenCalledWith('player_123');
    });
  });

  describe('getStageStats', () => {
    it('should retrieve statistics for a stage', async () => {
      // Arrange
      const stats = {
        totalSnapshots: 50,
        avgWins: 2.5,
        maxWins: 8,
        minWins: 0,
      };

      jest.spyOn(repository, 'getStageStats').mockResolvedValue(stats);

      // Act
      const result = await service.getStageStats(3);

      // Assert
      expect(result).toEqual(stats);
      expect(repository.getStageStats).toHaveBeenCalledWith(3);
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete a snapshot', async () => {
      // Arrange
      jest.spyOn(repository, 'deleteSnapshot').mockResolvedValue(true);

      // Act
      const result = await service.deleteSnapshot('snap_123');

      // Assert
      expect(result).toBe(true);
      expect(repository.deleteSnapshot).toHaveBeenCalledWith('snap_123');
    });
  });
});
