import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Create snapshots table for async PvP matchmaking.
 *
 * Stores player team snapshots for use as opponents in future battles.
 * References the runs table with cascade delete.
 *
 * @migration 1704067203000
 */
export class CreateSnapshotsTable1704067203000 implements MigrationInterface {
  /**
   * Run migration up - creates the snapshots table.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'Unique snapshot identifier',
          },
          {
            name: 'playerId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the player who created this snapshot',
          },
          {
            name: 'runId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the run this snapshot was created from',
          },
          {
            name: 'stage',
            type: 'int',
            isNullable: false,
            comment: 'Stage at which this snapshot was created (1-9)',
          },
          {
            name: 'wins',
            type: 'int',
            isNullable: false,
            comment: 'Number of wins the player had when snapshot was created',
          },
          {
            name: 'team',
            type: 'json',
            isNullable: false,
            comment: 'Team snapshot with units and positions',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Snapshot creation timestamp',
          },
        ],
      }),
      true,
    );

    // Create foreign key to runs table with cascade delete
    await queryRunner.createForeignKey(
      'snapshots',
      new TableForeignKey({
        columnNames: ['runId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'runs',
        onDelete: 'CASCADE',
        name: 'FK_SNAPSHOTS_RUN',
      }),
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOTS_PLAYER',
        columnNames: ['playerId'],
      }),
    );

    await queryRunner.createIndex(
      'snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOTS_STAGE',
        columnNames: ['stage'],
      }),
    );

    await queryRunner.createIndex(
      'snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOTS_STAGE_WINS',
        columnNames: ['stage', 'wins'],
      }),
    );
  }

  /**
   * Run migration down - drops the snapshots table.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('snapshots', true);
  }
}
