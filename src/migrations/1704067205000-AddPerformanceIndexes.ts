import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Migration: Add performance indexes to all tables.
 *
 * Creates additional indexes for common query patterns:
 * - Runs: Query by player and status for active run lookup
 * - RunDeck: Query by run for deck retrieval
 * - Battles: Query by run and result for battle history
 * - Snapshots: Query by stage and wins for matchmaking
 * - BotTeams: Query by stage and difficulty for bot selection
 *
 * These indexes are already created in the table creation migrations,
 * but this migration serves as documentation and can be used to add
 * additional composite indexes if needed.
 *
 * @migration 1704067205000
 */
export class AddPerformanceIndexes1704067205000 implements MigrationInterface {
  /**
   * Run migration up - adds additional performance indexes.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite index for runs: player + status (for finding active runs)
    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'IDX_RUNS_PLAYER_STATUS_CREATED',
        columnNames: ['playerId', 'status', 'createdAt'],
        isUnique: false,
      }),
    );

    // Add composite index for battles: run + result (for battle history)
    await queryRunner.createIndex(
      'battles',
      new TableIndex({
        name: 'IDX_BATTLES_RUN_RESULT_CREATED',
        columnNames: ['runId', 'result', 'createdAt'],
        isUnique: false,
      }),
    );

    // Add composite index for snapshots: stage + wins + created (for matchmaking)
    await queryRunner.createIndex(
      'snapshots',
      new TableIndex({
        name: 'IDX_SNAPSHOTS_STAGE_WINS_CREATED',
        columnNames: ['stage', 'wins', 'createdAt'],
        isUnique: false,
      }),
    );

    // Add composite index for bot_teams: stage + difficulty (for bot selection)
    await queryRunner.createIndex(
      'bot_teams',
      new TableIndex({
        name: 'IDX_BOT_TEAMS_STAGE_DIFFICULTY_CREATED',
        columnNames: ['stage', 'difficulty', 'createdAt'],
        isUnique: false,
      }),
    );

    // Add index for run_deck: run + tier (for deck queries with tier filtering)
    await queryRunner.createIndex(
      'run_deck',
      new TableIndex({
        name: 'IDX_RUN_DECK_RUN_TIER',
        columnNames: ['runId', 'tier'],
        isUnique: false,
      }),
    );
  }

  /**
   * Run migration down - removes the performance indexes.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes
    await queryRunner.dropIndex('runs', 'IDX_RUNS_PLAYER_STATUS_CREATED');
    await queryRunner.dropIndex('battles', 'IDX_BATTLES_RUN_RESULT_CREATED');
    await queryRunner.dropIndex('snapshots', 'IDX_SNAPSHOTS_STAGE_WINS_CREATED');
    await queryRunner.dropIndex('bot_teams', 'IDX_BOT_TEAMS_STAGE_DIFFICULTY_CREATED');
    await queryRunner.dropIndex('run_deck', 'IDX_RUN_DECK_RUN_TIER');
  }
}
