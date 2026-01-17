import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Create run_deck table for tracking units in a roguelike run.
 * 
 * Stores individual unit cards in a player's run deck with tier and position tracking.
 * References the runs table with cascade delete.
 * 
 * @migration 1704067201000
 */
export class CreateRunDeckTable1704067201000 implements MigrationInterface {
  /**
   * Run migration up - creates the run_deck table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'run_deck',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'Unique run deck entry identifier',
          },
          {
            name: 'runId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the run this deck entry belongs to',
          },
          {
            name: 'unitId',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Unit template ID from game/units/unit.data.ts',
          },
          {
            name: 'tier',
            type: 'int',
            default: 1,
            isNullable: false,
            comment: 'Current tier level of this unit (1-3)',
          },
          {
            name: 'position',
            type: 'int',
            isNullable: true,
            comment: 'Position in the deck for ordering',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Deck entry creation timestamp',
          },
        ],
      }),
      true,
    );

    // Create foreign key to runs table with cascade delete
    await queryRunner.createForeignKey(
      'run_deck',
      new TableForeignKey({
        columnNames: ['runId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'runs',
        onDelete: 'CASCADE',
        name: 'FK_RUN_DECK_RUN',
      }),
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'run_deck',
      new TableIndex({
        name: 'IDX_RUN_DECK_RUN',
        columnNames: ['runId'],
      }),
    );

    await queryRunner.createIndex(
      'run_deck',
      new TableIndex({
        name: 'IDX_RUN_DECK_POSITION',
        columnNames: ['runId', 'position'],
      }),
    );
  }

  /**
   * Run migration down - drops the run_deck table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('run_deck', true);
  }
}
