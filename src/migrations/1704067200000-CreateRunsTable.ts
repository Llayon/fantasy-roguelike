import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create runs table for roguelike progression tracking.
 * 
 * Stores player roguelike runs with stage, wins, losses, budget, and gold tracking.
 * Includes indexes for efficient querying by player and status.
 * 
 * @migration 1704067200000
 */
export class CreateRunsTable1704067200000 implements MigrationInterface {
  /**
   * Run migration up - creates the runs table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'runs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'Unique run identifier',
          },
          {
            name: 'playerId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the player who owns this run',
          },
          {
            name: 'factionId',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Faction ID for this run (e.g., human, undead)',
          },
          {
            name: 'leaderId',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Leader unit ID for this run',
          },
          {
            name: 'stage',
            type: 'int',
            default: 1,
            isNullable: false,
            comment: 'Current stage of the run (1-9)',
          },
          {
            name: 'wins',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Number of battles won in this run',
          },
          {
            name: 'losses',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Number of battles lost in this run',
          },
          {
            name: 'budget',
            type: 'int',
            default: 10,
            isNullable: false,
            comment: 'Current team budget in gold',
          },
          {
            name: 'gold',
            type: 'int',
            default: 0,
            isNullable: false,
            comment: 'Current gold accumulated in this run',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
            isNullable: false,
            comment: 'Current status of the run (active, won, lost, abandoned)',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Run creation timestamp',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Run last update timestamp',
          },
        ],
      }),
      true,
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'IDX_RUNS_PLAYER',
        columnNames: ['playerId'],
      }),
    );

    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'IDX_RUNS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'IDX_RUNS_PLAYER_STATUS',
        columnNames: ['playerId', 'status'],
      }),
    );
  }

  /**
   * Run migration down - drops the runs table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('runs', true);
  }
}
