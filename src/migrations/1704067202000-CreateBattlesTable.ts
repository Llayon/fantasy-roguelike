import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Create battles table for tracking roguelike battles.
 *
 * Stores individual battles in a player's run with results, seeds, and events.
 * References the runs table with cascade delete and snapshots table with set null.
 *
 * @migration 1704067202000
 */
export class CreateBattlesTable1704067202000 implements MigrationInterface {
  /**
   * Run migration up - creates the battles table.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'battles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'Unique battle identifier',
          },
          {
            name: 'runId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the run this battle belongs to',
          },
          {
            name: 'enemySnapshotId',
            type: 'uuid',
            isNullable: true,
            comment: 'ID of the enemy snapshot (if battling a player)',
          },
          {
            name: 'seed',
            type: 'int',
            isNullable: false,
            comment: 'Random seed used for battle simulation',
          },
          {
            name: 'result',
            type: 'varchar',
            length: '10',
            default: "'pending'",
            isNullable: false,
            comment: 'Result of the battle (win, loss, pending)',
          },
          {
            name: 'events',
            type: 'json',
            isNullable: true,
            comment: 'Array of BattleEvent objects from simulation',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Battle creation timestamp',
          },
        ],
      }),
      true,
    );

    // Create foreign key to runs table with cascade delete
    await queryRunner.createForeignKey(
      'battles',
      new TableForeignKey({
        columnNames: ['runId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'runs',
        onDelete: 'CASCADE',
        name: 'FK_BATTLES_RUN',
      }),
    );

    // Create foreign key to snapshots table with set null
    await queryRunner.createForeignKey(
      'battles',
      new TableForeignKey({
        columnNames: ['enemySnapshotId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'snapshots',
        onDelete: 'SET NULL',
        name: 'FK_BATTLES_SNAPSHOT',
      }),
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'battles',
      new TableIndex({
        name: 'IDX_BATTLES_RUN',
        columnNames: ['runId'],
      }),
    );

    await queryRunner.createIndex(
      'battles',
      new TableIndex({
        name: 'IDX_BATTLES_SNAPSHOT',
        columnNames: ['enemySnapshotId'],
      }),
    );

    await queryRunner.createIndex(
      'battles',
      new TableIndex({
        name: 'IDX_BATTLES_RESULT',
        columnNames: ['result'],
      }),
    );
  }

  /**
   * Run migration down - drops the battles table.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('battles', true);
  }
}
