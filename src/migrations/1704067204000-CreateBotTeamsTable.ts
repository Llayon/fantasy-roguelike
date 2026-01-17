import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create bot_teams table for fallback opponents in roguelike mode.
 * 
 * Stores pre-generated bot teams used when no player snapshots are available.
 * Includes stage and difficulty tracking for matchmaking.
 * 
 * @migration 1704067204000
 */
export class CreateBotTeamsTable1704067204000 implements MigrationInterface {
  /**
   * Run migration up - creates the bot_teams table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'bot_teams',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'Unique bot team identifier',
          },
          {
            name: 'stage',
            type: 'int',
            isNullable: false,
            comment: 'Stage at which this bot team is available (1-9)',
          },
          {
            name: 'difficulty',
            type: 'int',
            isNullable: false,
            comment: 'Difficulty level of this bot team (1-10)',
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
            comment: 'Bot team creation timestamp',
          },
        ],
      }),
      true,
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'bot_teams',
      new TableIndex({
        name: 'IDX_BOT_TEAMS_STAGE',
        columnNames: ['stage'],
      }),
    );

    await queryRunner.createIndex(
      'bot_teams',
      new TableIndex({
        name: 'IDX_BOT_TEAMS_DIFFICULTY',
        columnNames: ['difficulty'],
      }),
    );

    await queryRunner.createIndex(
      'bot_teams',
      new TableIndex({
        name: 'IDX_BOT_TEAMS_STAGE_DIFFICULTY',
        columnNames: ['stage', 'difficulty'],
      }),
    );
  }

  /**
   * Run migration down - drops the bot_teams table.
   * 
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bot_teams', true);
  }
}
