/**
 * Snapshot entity for async PvP matchmaking.
 * Represents a saved team state for use as an opponent in future battles.
 * 
 * @fileoverview Snapshot entity with team data storage, stage tracking,
 * and win record for matchmaking purposes.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
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
 * Snapshot entity representing a saved team state for async PvP.
 * Created after each battle win to serve as an opponent for other players.
 */
@Entity('snapshots')
@Index('IDX_SNAPSHOTS_PLAYER', ['playerId'])
@Index('IDX_SNAPSHOTS_STAGE', ['stage'])
@Index('IDX_SNAPSHOTS_STAGE_WINS', ['stage', 'wins'])
export class Snapshot {
  /**
   * Unique snapshot identifier.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID of the player who created this snapshot.
   */
  @Column({ type: 'uuid' })
  playerId!: string;

  /**
   * ID of the run this snapshot was created from.
   */
  @Column({ type: 'uuid' })
  runId!: string;

  /**
   * Run entity relationship.
   * Cascade delete ensures snapshots are removed when run is deleted.
   */
  @ManyToOne('Run', 'snapshots', {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'runId' })
  run!: any;

  /**
   * Stage at which this snapshot was created (1-9).
   * Used for matchmaking to find opponents at similar progression.
   */
  @Column({ type: 'int' })
  stage!: number;

  /**
   * Number of wins the player had when this snapshot was created.
   * Used for difficulty scaling in matchmaking.
   */
  @Column({ type: 'int' })
  wins!: number;

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
   * Battles where this snapshot was used as opponent.
   * One-to-many relationship with Battle entity.
   */
  @OneToMany('Battle', 'enemySnapshot', {
    cascade: false,
  })
  battles!: any[];

  /**
   * Snapshot creation timestamp.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Gets the number of units in this snapshot.
   * 
   * @returns Number of units in the team
   * @example
   * const unitCount = snapshot.getUnitCount();
   * console.log(`Team has ${unitCount} units`);
   */
  getUnitCount(): number {
    return this.team?.units?.length ?? 0;
  }

  /**
   * Gets the number of times this snapshot has been used as opponent.
   * 
   * @returns Number of battles using this snapshot
   * @example
   * const timesUsed = snapshot.getTimesUsedAsOpponent();
   * console.log(`This team has been faced ${timesUsed} times`);
   */
  getTimesUsedAsOpponent(): number {
    return this.battles?.length ?? 0;
  }

  /**
   * Gets the win rate of battles using this snapshot as opponent.
   * 
   * @returns Win rate as percentage (0-100), or 0 if no battles
   * @example
   * const winRate = snapshot.getOpponentWinRate();
   * console.log(`Opponents win ${winRate}% of the time`);
   */
  getOpponentWinRate(): number {
    const totalBattles = this.getTimesUsedAsOpponent();
    if (totalBattles === 0) return 0;

    const wins = this.battles?.filter((b) => b.result === 'win').length ?? 0;
    return Math.round((wins / totalBattles) * 100);
  }

  /**
   * Checks if this snapshot is still valid for matchmaking.
   * Snapshots are valid if they're from recent runs.
   * 
   * @param maxAgeHours - Maximum age in hours (default 24)
   * @returns True if snapshot is within age limit
   * @example
   * if (snapshot.isValidForMatchmaking(24)) {
   *   // Use this snapshot for matchmaking
   * }
   */
  isValidForMatchmaking(maxAgeHours: number = 24): boolean {
    const ageMs = Date.now() - this.createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours <= maxAgeHours;
  }

  /**
   * Gets a summary of this snapshot.
   * 
   * @returns Snapshot summary object
   * @example
   * const summary = snapshot.getSummary();
   * console.log(`Stage ${summary.stage}: ${summary.unitCount} units`);
   */
  getSummary(): {
    id: string;
    stage: number;
    wins: number;
    unitCount: number;
    timesUsedAsOpponent: number;
    opponentWinRate: number;
    createdAt: Date;
  } {
    return {
      id: this.id,
      stage: this.stage,
      wins: this.wins,
      unitCount: this.getUnitCount(),
      timesUsedAsOpponent: this.getTimesUsedAsOpponent(),
      opponentWinRate: this.getOpponentWinRate(),
      createdAt: this.createdAt,
    };
  }
}
