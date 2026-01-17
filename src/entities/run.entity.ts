/**
 * Run entity for roguelike progression.
 * Represents a player's roguelike run with progression tracking.
 * 
 * @fileoverview Run entity with status tracking, stage progression,
 * and win/loss records for roguelike mode.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

/**
 * Run status enumeration.
 */
export enum RunStatus {
  ACTIVE = 'active',
  WON = 'won',
  LOST = 'lost',
  ABANDONED = 'abandoned',
}

/**
 * Run entity representing a player's roguelike progression.
 * Tracks stage, wins, losses, budget, and gold throughout the run.
 */
@Entity('runs')
@Index('IDX_RUNS_PLAYER', ['playerId'])
@Index('IDX_RUNS_STATUS', ['status'])
@Index('IDX_RUNS_PLAYER_STATUS', ['playerId', 'status'])
export class Run {
  /**
   * Unique run identifier.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID of the player who owns this run.
   */
  @Column({ type: 'uuid' })
  playerId!: string;

  /**
   * Faction ID for this run (e.g., 'human', 'undead').
   * Determines available units and abilities.
   */
  @Column({ type: 'varchar', length: 50 })
  factionId!: string;

  /**
   * Leader unit ID for this run.
   * Determines starting unit and bonuses.
   */
  @Column({ type: 'varchar', length: 50 })
  leaderId!: string;

  /**
   * Current stage of the run (1-9).
   * Increases after each win, determines enemy difficulty.
   */
  @Column({ type: 'int', default: 1 })
  stage!: number;

  /**
   * Number of battles won in this run.
   * Run ends when wins reach 9.
   */
  @Column({ type: 'int', default: 0 })
  wins!: number;

  /**
   * Number of battles lost in this run.
   * Run ends when losses reach 4.
   */
  @Column({ type: 'int', default: 0 })
  losses!: number;

  /**
   * Current team budget in gold.
   * Starts at 10, increases with wins and upgrades.
   */
  @Column({ type: 'int', default: 10 })
  budget!: number;

  /**
   * Current gold accumulated in this run.
   * Used for unit upgrades and purchases.
   */
  @Column({ type: 'int', default: 0 })
  gold!: number;

  /**
   * Current status of the run.
   * Determines if run is active, completed, or abandoned.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: RunStatus.ACTIVE,
    enum: RunStatus,
  })
  status!: RunStatus;

  /**
   * Battles in this run.
   * One-to-many relationship with Battle entity.
   */
  @OneToMany('Battle', 'run', { cascade: true })
  battles!: any[];

  /**
   * Run deck (units in current run).
   * One-to-many relationship with RunDeck entity.
   */
  @OneToMany('RunDeck', 'run', { cascade: true })
  deck!: any[];

  /**
   * Snapshots created from this run.
   * One-to-many relationship with Snapshot entity.
   */
  @OneToMany('Snapshot', 'run', { cascade: true })
  snapshots!: any[];

  /**
   * Run creation timestamp.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Run last update timestamp.
   */
  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Checks if the run is still active.
   * 
   * @returns True if run status is ACTIVE
   * @example
   * if (run.isActive()) {
   *   // Continue the run
   * }
   */
  isActive(): boolean {
    return this.status === RunStatus.ACTIVE;
  }

  /**
   * Checks if the run has ended (won or lost).
   * 
   * @returns True if run has reached end condition
   * @example
   * if (run.isEnded()) {
   *   // Show run summary
   * }
   */
  isEnded(): boolean {
    return this.wins >= 9 || this.losses >= 4;
  }

  /**
   * Checks if the run is won.
   * 
   * @returns True if run has 9 wins
   * @example
   * if (run.isWon()) {
   *   // Award victory rewards
   * }
   */
  isWon(): boolean {
    return this.wins >= 9;
  }

  /**
   * Checks if the run is lost.
   * 
   * @returns True if run has 4 losses
   * @example
   * if (run.isLost()) {
   *   // Show defeat screen
   * }
   */
  isLost(): boolean {
    return this.losses >= 4;
  }

  /**
   * Records a battle win and updates run state.
   * Increments wins, increases stage and budget.
   * 
   * @example
   * run.recordWin();
   * if (run.isWon()) {
   *   run.status = RunStatus.WON;
   * }
   */
  recordWin(): void {
    this.wins += 1;
    this.stage += 1;
    this.budget += 5; // Budget increases by 5 per win
  }

  /**
   * Records a battle loss and updates run state.
   * Increments losses.
   * 
   * @example
   * run.recordLoss();
   * if (run.isLost()) {
   *   run.status = RunStatus.LOST;
   * }
   */
  recordLoss(): void {
    this.losses += 1;
  }

  /**
   * Gets a summary of the run for display purposes.
   * 
   * @returns Run summary object
   * @example
   * const summary = run.getSummary();
   * console.log(`Stage ${summary.stage}: ${summary.wins}W-${summary.losses}L`);
   */
  getSummary(): {
    id: string;
    stage: number;
    wins: number;
    losses: number;
    budget: number;
    gold: number;
    status: RunStatus;
    isActive: boolean;
    isEnded: boolean;
  } {
    return {
      id: this.id,
      stage: this.stage,
      wins: this.wins,
      losses: this.losses,
      budget: this.budget,
      gold: this.gold,
      status: this.status,
      isActive: this.isActive(),
      isEnded: this.isEnded(),
    };
  }
}
