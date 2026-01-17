/**
 * BotTeam entity for fallback opponents in roguelike mode.
 * Represents a pre-generated bot team used when no player snapshots are available.
 * 
 * @fileoverview BotTeam entity with difficulty scaling, stage tracking,
 * and team composition storage.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Team snapshot interface for storing team data.
 * Contains unit IDs and their positions on the battlefield.
 */
export interface TeamSnapshot {
  units: Array<{
    unitId: string;
    tier: number;
    position: { x: number; y: number };
  }>;
}

/**
 * BotTeam entity representing a pre-generated bot opponent.
 * Used as fallback when no player snapshots match the current stage.
 */
@Entity('bot_teams')
@Index('IDX_BOT_TEAMS_STAGE', ['stage'])
@Index('IDX_BOT_TEAMS_DIFFICULTY', ['difficulty'])
@Index('IDX_BOT_TEAMS_STAGE_DIFFICULTY', ['stage', 'difficulty'])
export class BotTeam {
  /**
   * Unique bot team identifier.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Stage at which this bot team is available (1-9).
   * Determines when this bot can be encountered.
   */
  @Column({ type: 'int' })
  stage!: number;

  /**
   * Difficulty level of this bot team (1-10).
   * 1 = easiest, 10 = hardest.
   * Scales with player progression (wins count).
   */
  @Column({ type: 'int' })
  difficulty!: number;

  /**
   * Team composition and positioning data.
   * Stored as JSON object containing units array with positions.
   */
  @Column({
    type: 'json',
    comment: 'Team snapshot with units and positions',
  })
  team!: TeamSnapshot;

  /**
   * Bot team creation timestamp.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Gets the number of units in this bot team.
   * 
   * @returns Number of units in the team
   * @example
   * const unitCount = botTeam.getUnitCount();
   * console.log(`Bot team has ${unitCount} units`);
   */
  getUnitCount(): number {
    return this.team?.units?.length ?? 0;
  }

  /**
   * Gets the total cost of all units in this bot team.
   * Used for validation that team respects budget constraints.
   * 
   * @param getUnitCost - Function to get unit cost by ID
   * @returns Total cost of all units
   * @example
   * const cost = botTeam.getTotalCost((unitId) => getUnitTemplate(unitId)?.cost ?? 0);
   * console.log(`Bot team costs ${cost} points`);
   */
  getTotalCost(getUnitCost: (unitId: string) => number): number {
    if (!this.team?.units) return 0;
    return this.team.units.reduce((total, unit) => {
      return total + getUnitCost(unit.unitId);
    }, 0);
  }

  /**
   * Gets the difficulty label for display purposes.
   * 
   * @returns Human-readable difficulty label
   * @example
   * const label = botTeam.getDifficultyLabel();
   * console.log(`Difficulty: ${label}`); // "Hard"
   */
  getDifficultyLabel(): string {
    if (this.difficulty <= 2) return 'Easy';
    if (this.difficulty <= 4) return 'Normal';
    if (this.difficulty <= 6) return 'Hard';
    if (this.difficulty <= 8) return 'Very Hard';
    return 'Nightmare';
  }

  /**
   * Checks if this bot team is appropriate for a given player progression.
   * 
   * @param playerStage - Current stage of the player
   * @param playerWins - Number of wins the player has
   * @returns True if bot team is appropriate for player
   * @example
   * if (botTeam.isAppropriateFor(3, 2)) {
   *   // Use this bot team as opponent
   * }
   */
  isAppropriateFor(playerStage: number, playerWins: number): boolean {
    // Bot team must be at the player's current stage
    if (this.stage !== playerStage) return false;

    // Difficulty should roughly match player progression
    // Difficulty 1-3 for early game (0-2 wins)
    // Difficulty 4-6 for mid game (3-5 wins)
    // Difficulty 7-10 for late game (6+ wins)
    if (playerWins <= 2 && this.difficulty > 3) return false;
    if (playerWins >= 3 && playerWins <= 5 && this.difficulty < 4) return false;
    if (playerWins >= 6 && this.difficulty < 7) return false;

    return true;
  }

  /**
   * Gets a summary of this bot team.
   * 
   * @returns Bot team summary object
   * @example
   * const summary = botTeam.getSummary();
   * console.log(`Stage ${summary.stage}: ${summary.difficultyLabel}`);
   */
  getSummary(): {
    id: string;
    stage: number;
    difficulty: number;
    difficultyLabel: string;
    unitCount: number;
    createdAt: Date;
  } {
    return {
      id: this.id,
      stage: this.stage,
      difficulty: this.difficulty,
      difficultyLabel: this.getDifficultyLabel(),
      unitCount: this.getUnitCount(),
      createdAt: this.createdAt,
    };
  }
}
