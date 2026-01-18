/**
 * RunDeck entity for tracking units in a roguelike run.
 * Represents a single unit card in a player's run deck.
 *
 * @fileoverview RunDeck entity with unit tracking, tier management,
 * and deck position ordering.
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
import { Run } from './run.entity';

/**
 * RunDeck entity representing a unit card in a roguelike run.
 * Tracks unit ID, tier level, and position in the deck.
 */
@Entity('run_deck')
@Index('IDX_RUN_DECK_RUN', ['runId'])
@Index('IDX_RUN_DECK_POSITION', ['runId', 'position'])
export class RunDeck {
  /**
   * Unique run deck entry identifier.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID of the run this deck entry belongs to.
   */
  @Column({ type: 'uuid' })
  runId!: string;

  /**
   * Run entity relationship.
   * Cascade delete ensures deck entries are removed when run is deleted.
   */
  @ManyToOne('Run', 'deck', {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'runId' })
  run!: Run;

  /**
   * Unit template ID from game/units/unit.data.ts.
   * Identifies which unit type this deck entry represents.
   */
  @Column({ type: 'varchar', length: 50 })
  unitId!: string;

  /**
   * Current tier level of this unit (1-3).
   * Tier 1 is base unit, Tier 2 and 3 are upgrades.
   * Affects stats and cost.
   */
  @Column({ type: 'int', default: 1 })
  tier!: number;

  /**
   * Position in the deck for ordering.
   * Determines the order units appear in the deck list.
   * Can be null if position is not yet assigned.
   */
  @Column({ type: 'int', nullable: true })
  position!: number | null;

  /**
   * Deck entry creation timestamp.
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Gets the display name for this deck entry.
   * Combines unit ID with tier information.
   *
   * @returns Display name string
   * @example
   * const name = deckEntry.getDisplayName();
   * console.log(name); // "Knight (T2)"
   */
  getDisplayName(): string {
    const tierSuffix = this.tier > 1 ? ` (T${this.tier})` : '';
    return `${this.unitId}${tierSuffix}`;
  }

  /**
   * Checks if this unit can be upgraded to the next tier.
   *
   * @returns True if tier is less than 3
   * @example
   * if (deckEntry.canUpgrade()) {
   *   // Show upgrade button
   * }
   */
  canUpgrade(): boolean {
    return this.tier < 3;
  }

  /**
   * Upgrades this unit to the next tier.
   *
   * @throws Error if unit is already at max tier
   * @example
   * deckEntry.upgrade();
   * console.log(deckEntry.tier); // 2
   */
  upgrade(): void {
    if (!this.canUpgrade()) {
      throw new Error(`Unit ${this.unitId} is already at maximum tier 3`);
    }
    this.tier += 1;
  }

  /**
   * Gets a summary of this deck entry.
   *
   * @returns Deck entry summary object
   * @example
   * const summary = deckEntry.getSummary();
   * console.log(`${summary.unitId} at tier ${summary.tier}`);
   */
  getSummary(): {
    id: string;
    unitId: string;
    tier: number;
    position: number | null;
    displayName: string;
    canUpgrade: boolean;
  } {
    return {
      id: this.id,
      unitId: this.unitId,
      tier: this.tier,
      position: this.position,
      displayName: this.getDisplayName(),
      canUpgrade: this.canUpgrade(),
    };
  }
}
