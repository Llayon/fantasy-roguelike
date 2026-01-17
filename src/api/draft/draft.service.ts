import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { RunService, UnitCard } from '../run/run.service';

/**
 * Unit card option in draft.
 */
export interface DraftOption {
  /** Unit template ID */
  unitId: string;
  /** Current upgrade tier (1-3) */
  tier: number;
  /** Cost at current tier */
  cost: number;
}

/**
 * Response for getting draft options.
 */
export interface GetDraftOptionsResponse {
  /** 3 cards available to choose from */
  options: DraftOption[];
  /** Number of rerolls remaining */
  rerollsRemaining: number;
}

/**
 * Request body for picking a card.
 */
export interface PickCardRequest {
  /** Unit ID to pick */
  cardId: string;
}

/**
 * Response for picking a card.
 */
export interface PickCardResponse {
  /** Whether pick was successful */
  success: boolean;
  /** Updated deck after pick */
  deck: UnitCard[];
}

/**
 * Response for rerolling draft options.
 */
export interface RerollResponse {
  /** New draft options after reroll */
  options: DraftOption[];
  /** Number of rerolls remaining */
  rerollsRemaining: number;
}

/**
 * Draft service for roguelike mode.
 * Handles card drafting after battles.
 *
 * Responsibilities:
 * - Generate draft options (3 cards to choose from)
 * - Handle card picks (add to deck)
 * - Handle rerolls (generate new options)
 * - Track reroll count per run
 *
 * @module api/draft
 */
@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name);

  /** In-memory storage for draft state (in production, use database) */
  private draftState: Map<
    string,
    {
      runId: string;
      currentOptions: DraftOption[];
      rerollsRemaining: number;
      rerollsUsed: number;
    }
  > = new Map();

  /** Available units for drafting */
  private readonly AVAILABLE_UNITS: DraftOption[] = [
    // Tanks
    { unitId: 'knight', tier: 1, cost: 5 },
    { unitId: 'guardian', tier: 1, cost: 5 },
    { unitId: 'berserker', tier: 1, cost: 5 },
    // Melee DPS
    { unitId: 'rogue', tier: 1, cost: 4 },
    { unitId: 'duelist', tier: 1, cost: 4 },
    { unitId: 'assassin', tier: 1, cost: 4 },
    // Ranged DPS
    { unitId: 'archer', tier: 1, cost: 4 },
    { unitId: 'crossbowman', tier: 1, cost: 4 },
    { unitId: 'hunter', tier: 1, cost: 4 },
    // Mages
    { unitId: 'mage', tier: 1, cost: 5 },
    { unitId: 'warlock', tier: 1, cost: 5 },
    { unitId: 'elementalist', tier: 1, cost: 5 },
    // Support
    { unitId: 'priest', tier: 1, cost: 4 },
    { unitId: 'bard', tier: 1, cost: 4 },
    // Control
    { unitId: 'enchanter', tier: 1, cost: 5 },
  ];

  /** Maximum rerolls per run */
  private readonly MAX_REROLLS = 2;

  /** Draft options count */
  private readonly DRAFT_OPTIONS_COUNT = 3;

  constructor(private readonly runService: RunService) {}

  /**
   * Get available draft options for a run.
   *
   * Returns 3 cards available for the player to pick from.
   * Options are generated randomly from available units.
   *
   * @param runId - Run identifier
   * @returns Draft options with 3 cards and reroll count
   * @throws NotFoundException if run does not exist
   *
   * @example
   * const options = await draftService.getDraftOptions('run_123');
   * // Returns: { options: [...3 cards], rerollsRemaining: 2 }
   */
  getDraftOptions(runId: string): GetDraftOptionsResponse {
    // Validate run exists
    const run = this.runService.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Get or create draft state for this run
    let state = this.draftState.get(runId);
    if (!state) {
      state = {
        runId,
        currentOptions: this.generateDraftOptions(),
        rerollsRemaining: this.MAX_REROLLS,
        rerollsUsed: 0,
      };
      this.draftState.set(runId, state);
    }

    this.logger.debug('Draft options retrieved', {
      runId,
      optionsCount: state.currentOptions.length,
      rerollsRemaining: state.rerollsRemaining,
    });

    return {
      options: state.currentOptions,
      rerollsRemaining: state.rerollsRemaining,
    };
  }

  /**
   * Pick a card from draft options.
   *
   * Adds the selected card to the player's deck.
   * Clears draft options after pick (next draft will generate new options).
   *
   * @param runId - Run identifier
   * @param cardId - Unit ID to pick
   * @returns Success status and updated deck
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if card is not in current options
   *
   * @example
   * const result = await draftService.pickCard('run_123', 'archer');
   * // Returns: { success: true, deck: [...updated deck] }
   */
  pickCard(runId: string, cardId: string): PickCardResponse {
    // Validate run exists
    const run = this.runService.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Get current draft state
    const state = this.draftState.get(runId);
    if (!state || state.currentOptions.length === 0) {
      throw new BadRequestException('No draft options available');
    }

    // Validate card is in current options
    const selectedCard = state.currentOptions.find((opt) => opt.unitId === cardId);
    if (!selectedCard) {
      throw new BadRequestException(`Card ${cardId} not in current draft options`);
    }

    // Add card to run deck
    const unitCard: UnitCard = {
      unitId: selectedCard.unitId,
      tier: selectedCard.tier,
      cost: selectedCard.cost,
    };
    this.runService.addUnitToDeck(runId, unitCard);

    // Clear draft options (next draft will generate new ones)
    state.currentOptions = [];
    state.rerollsRemaining = this.MAX_REROLLS; // Reset rerolls for next draft

    this.logger.debug('Card picked from draft', {
      runId,
      cardId,
      tier: selectedCard.tier,
      cost: selectedCard.cost,
    });

    return {
      success: true,
      deck: run.deck,
    };
  }

  /**
   * Reroll draft options.
   *
   * Generates new draft options if rerolls are available.
   * Limited rerolls per draft phase (typically 2).
   *
   * @param runId - Run identifier
   * @returns New draft options and remaining reroll count
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if no rerolls remaining
   *
   * @example
   * const result = await draftService.rerollOptions('run_123');
   * // Returns: { options: [...3 new cards], rerollsRemaining: 1 }
   */
  rerollOptions(runId: string): RerollResponse {
    // Validate run exists
    const run = this.runService.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Get current draft state
    const state = this.draftState.get(runId);
    if (!state) {
      throw new BadRequestException('No draft in progress');
    }

    // Check if rerolls available
    if (state.rerollsRemaining <= 0) {
      throw new BadRequestException('No rerolls remaining');
    }

    // Generate new options
    state.currentOptions = this.generateDraftOptions();
    state.rerollsRemaining -= 1;
    state.rerollsUsed += 1;

    this.logger.debug('Draft options rerolled', {
      runId,
      rerollsUsed: state.rerollsUsed,
      rerollsRemaining: state.rerollsRemaining,
    });

    return {
      options: state.currentOptions,
      rerollsRemaining: state.rerollsRemaining,
    };
  }

  /**
   * Generate random draft options.
   *
   * Selects DRAFT_OPTIONS_COUNT random units from available units.
   * Uses simple random selection (in production, could use weighted selection).
   *
   * @returns Array of draft options
   * @private
   */
  private generateDraftOptions(): DraftOption[] {
    const shuffled = [...this.AVAILABLE_UNITS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, this.DRAFT_OPTIONS_COUNT);
  }
}
