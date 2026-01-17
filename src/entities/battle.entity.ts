/**
 * Battle entity for tracking roguelike battles.
 * Represents a single battle in a player's run with results and events.
 *
 * @fileoverview Battle entity with result tracking, event logging,
 * and snapshot references for async PvP.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

/**
 * Battle result enumeration.
 */
export enum BattleResult {
  WIN = 'win',
  LOSS = 'loss',
  PENDING = 'pending',
}

/**
 * Battle event interface for storing battle events.
 * Represents a single event that occurred during battle simulation.
 */
export interface BattleEvent {
  type: string;
  round: number;
  turn: number;
  timestamp: number;
  actorId?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Battle entity representing a single battle in a roguelike run.
 * Stores battle result, seed for replay, and all events that occurred.
 */
@Entity('battles')
@Index('IDX_BATTLES_RUN', ['runId'])
@Index('IDX_BATTLES_SNAPSHOT', ['enemySnapshotId'])
@Index('IDX_BATTLES_RESULT', ['result'])
export class Battle {
  /**
   * Unique battle identifier.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID of the run this battle belongs to.
   */
  @Column({ type: 'uuid' })
  runId!: string;

  /**
   * Run entity relationship.
   * Cascade delete ensures battles are removed when run is deleted.
   */
  @ManyToOne('Run', 'battles', {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'runId' })
  run!: any;

  /**
   * ID of the enemy snapshot (if battling a player).
   * Null if battling a bot team.
   */
  @Column({ type: 'uuid', nullable: true })
  enemySnapshotId!: string | null;

  /**
   * Snapshot entity relationship (optional).
   * References the player snapshot used as opponent.
   */
  @ManyToOne('Snapshot', 'battles', {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'enemySnapshotId' })
  enemySnapshot!: any;

  /**
   * Random seed used for battle simulation.
   * Same seed + same teams = identical battle result (deterministic).
   * Used for replay functionality.
   */
  @Column({ type: 'int' })
  seed!: number;

  /**
   * Result of the battle.
   * PENDING if battle is still being simulated.
   */
  @Column({
    type: 'varchar',
    length: 10,
    default: BattleResult.PENDING,
    enum: BattleResult,
  })
  result!: BattleResult;

  /**
   * All events that occurred during the battle.
   * Stored as JSON array of BattleEvent objects.
   * Used for replay and analysis.
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Array of BattleEvent objects from simulation',
  })
  events!: BattleEvent[] | null;

  /**
   * Battle creation timestamp.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Checks if the battle is still pending (not yet simulated).
   *
   * @returns True if result is PENDING
   * @example
   * if (battle.isPending()) {
   *   // Simulate the battle
   * }
   */
  isPending(): boolean {
    return this.result === BattleResult.PENDING;
  }

  /**
   * Checks if the battle was won.
   *
   * @returns True if result is WIN
   * @example
   * if (battle.isWon()) {
   *   // Award victory rewards
   * }
   */
  isWon(): boolean {
    return this.result === BattleResult.WIN;
  }

  /**
   * Checks if the battle was lost.
   *
   * @returns True if result is LOSS
   * @example
   * if (battle.isLost()) {
   *   // Show defeat screen
   * }
   */
  isLost(): boolean {
    return this.result === BattleResult.LOSS;
  }

  /**
   * Checks if this battle was against a player snapshot.
   *
   * @returns True if enemySnapshotId is not null
   * @example
   * if (battle.isPlayerBattle()) {
   *   // Show player name in battle history
   * }
   */
  isPlayerBattle(): boolean {
    return this.enemySnapshotId !== null;
  }

  /**
   * Checks if this battle was against a bot team.
   *
   * @returns True if enemySnapshotId is null
   * @example
   * if (battle.isBotBattle()) {
   *   // Show bot difficulty in battle history
   * }
   */
  isBotBattle(): boolean {
    return this.enemySnapshotId === null;
  }

  /**
   * Gets the number of events that occurred in this battle.
   *
   * @returns Number of events, or 0 if events is null
   * @example
   * const eventCount = battle.getEventCount();
   * console.log(`Battle had ${eventCount} events`);
   */
  getEventCount(): number {
    return this.events?.length ?? 0;
  }

  /**
   * Gets events of a specific type from this battle.
   *
   * @param eventType - Type of events to filter for
   * @returns Array of events matching the type
   * @example
   * const damageEvents = battle.getEventsByType('damage_dealt');
   */
  getEventsByType(eventType: string): BattleEvent[] {
    if (!this.events) return [];
    return this.events.filter((event) => event.type === eventType);
  }

  /**
   * Gets a summary of this battle.
   *
   * @returns Battle summary object
   * @example
   * const summary = battle.getSummary();
   * console.log(`Battle ${summary.id}: ${summary.result}`);
   */
  getSummary(): {
    id: string;
    result: BattleResult;
    seed: number;
    eventCount: number;
    isPlayerBattle: boolean;
    createdAt: Date;
  } {
    return {
      id: this.id,
      result: this.result,
      seed: this.seed,
      eventCount: this.getEventCount(),
      isPlayerBattle: this.isPlayerBattle(),
      createdAt: this.createdAt,
    };
  }
}
