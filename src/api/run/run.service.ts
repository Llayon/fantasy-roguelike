import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { generateId } from '../../roguelike/types';
import { Run, RunConfig, RunStatus, RunPhase } from '../../roguelike/types';

/**
 * Unit card in a run deck.
 */
export interface UnitCard {
  /** Unit template ID */
  unitId: string;
  /** Current upgrade tier (1-3) */
  tier: number;
  /** Cost at current tier */
  cost: number;
}

/**
 * Upgrade record for a unit.
 */
export interface UpgradeRecord {
  /** Unit template ID */
  unitId: string;
  /** Tier after upgrade */
  tier: number;
  /** Cost of upgrade */
  cost: number;
  /** Timestamp of upgrade */
  timestamp: number;
}

/**
 * Run state specific to roguelike mode.
 */
export interface RoguelikeRunState {
  /** Current deck of units */
  deck: UnitCard[];
  /** Upgrade history */
  upgrades: UpgradeRecord[];
  /** Current budget (gold) */
  budget: number;
  /** Faction ID for this run */
  factionId: string;
  /** Leader unit ID for this run */
  leaderId: string;
}

/**
 * Response for starting a new run.
 */
export interface StartRunResponse {
  /** Unique run identifier */
  runId: string;
  /** Initial deck of units */
  initialDeck: UnitCard[];
  /** Starting budget */
  budget: number;
  /** Starting stage */
  stage: number;
}

/**
 * Response for getting run details.
 */
export interface GetRunResponse {
  /** Unique run identifier */
  runId: string;
  /** Current stage (1-9) */
  stage: number;
  /** Number of wins */
  wins: number;
  /** Number of losses */
  losses: number;
  /** Current budget */
  budget: number;
  /** Current deck */
  deck: UnitCard[];
  /** Upgrade history */
  upgrades: UpgradeRecord[];
}

/**
 * Response for abandoning a run.
 */
export interface AbandonRunResponse {
  /** Whether abandon was successful */
  success: boolean;
}

/**
 * Run management service for roguelike mode.
 * Handles run creation, progression, and state management.
 *
 * @module api/run
 */
@Injectable()
export class RunService {
  private readonly logger = new Logger(RunService.name);

  /** In-memory storage for runs (in production, use database) */
  private runs: Map<string, Run<RoguelikeRunState>> = new Map();

  /**
   * Start a new roguelike run.
   *
   * @param factionId - Faction ID for the run
   * @param leaderId - Leader unit ID for the run
   * @returns Run details with initial deck and budget
   * @throws BadRequestException if faction or leader is invalid
   *
   * @example
   * const response = await runService.startRun('human', 'knight');
   * // Returns: { runId: 'run_123', initialDeck: [...], budget: 10, stage: 1 }
   */
  startRun(factionId: string, leaderId: string): StartRunResponse {
    // Validate inputs
    if (!factionId || typeof factionId !== 'string') {
      throw new BadRequestException('Invalid factionId');
    }
    if (!leaderId || typeof leaderId !== 'string') {
      throw new BadRequestException('Invalid leaderId');
    }

    const runId = generateId();

    // Create initial deck with leader unit
    const initialDeck: UnitCard[] = [
      {
        unitId: leaderId,
        tier: 1,
        cost: 5, // Placeholder cost
      },
    ];

    // Create run configuration
    const config: RunConfig = {
      winsToComplete: 9,
      maxLosses: 4,
      phases: ['draft', 'battle', 'shop'],
      trackStreaks: true,
      enableRating: false,
    };

    // Create run state
    const runState: RoguelikeRunState = {
      deck: initialDeck,
      upgrades: [],
      budget: 10, // Starting budget
      factionId,
      leaderId,
    };

    // Create run
    const run: Run<RoguelikeRunState> = {
      id: runId,
      config,
      wins: 0,
      losses: 0,
      currentPhaseIndex: 0,
      winStreak: 0,
      loseStreak: 0,
      status: 'active',
      state: runState,
      history: [
        {
          type: 'phase_change',
          timestamp: Date.now(),
          data: { phase: 'draft' },
        },
      ],
    };

    // Store run
    this.runs.set(runId, run);

    this.logger.debug(`Run started: ${runId} with faction ${factionId} and leader ${leaderId}`, {
      runId,
      factionId,
      leaderId,
    });

    return {
      runId,
      initialDeck,
      budget: 10,
      stage: 1,
    };
  }

  /**
   * Get details of an existing run.
   *
   * @param runId - Run identifier
   * @returns Run details including deck, budget, and progress
   * @throws NotFoundException if run does not exist
   *
   * @example
   * const run = await runService.getRun('run_123');
   * // Returns: { runId: 'run_123', stage: 3, wins: 2, losses: 0, ... }
   */
  getRun(runId: string): GetRunResponse {
    const run = this.runs.get(runId);

    if (!run) {
      this.logger.warn(`Run not found: ${runId}`, { runId });
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Calculate current stage based on wins
    const stage = Math.min(run.wins + 1, 9);

    return {
      runId: run.id,
      stage,
      wins: run.wins,
      losses: run.losses,
      budget: run.state.budget,
      deck: run.state.deck,
      upgrades: run.state.upgrades,
    };
  }

  /**
   * Abandon an active run.
   *
   * @param runId - Run identifier
   * @returns Success status
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if run is already completed
   *
   * @example
   * const result = await runService.abandonRun('run_123');
   * // Returns: { success: true }
   */
  abandonRun(runId: string): AbandonRunResponse {
    const run = this.runs.get(runId);

    if (!run) {
      this.logger.warn(`Run not found for abandon: ${runId}`, { runId });
      throw new NotFoundException(`Run ${runId} not found`);
    }

    if (run.status !== 'active') {
      throw new BadRequestException(`Cannot abandon run with status: ${run.status}`);
    }

    // Mark run as lost
    run.status = 'lost';
    run.history.push({
      type: 'loss',
      timestamp: Date.now(),
      data: { reason: 'abandoned' },
    });

    this.logger.debug(`Run abandoned: ${runId}`, { runId });

    return { success: true };
  }

  /**
   * Record a battle win for a run.
   * Internal method used by battle service.
   *
   * @param runId - Run identifier
   * @throws NotFoundException if run does not exist
   *
   * @internal
   */
  recordWin(runId: string): void {
    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    run.wins += 1;
    run.winStreak += 1;
    run.loseStreak = 0;

    // Check if run is complete
    if (run.wins >= run.config.winsToComplete) {
      run.status = 'won';
    }

    run.history.push({
      type: 'win',
      timestamp: Date.now(),
    });

    this.logger.debug(`Win recorded for run: ${runId}`, { runId, wins: run.wins });
  }

  /**
   * Record a battle loss for a run.
   * Internal method used by battle service.
   *
   * @param runId - Run identifier
   * @throws NotFoundException if run does not exist
   *
   * @internal
   */
  recordLoss(runId: string): void {
    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    run.losses += 1;
    run.loseStreak += 1;
    run.winStreak = 0;

    // Check if run is complete
    if (run.losses >= run.config.maxLosses) {
      run.status = 'lost';
    }

    run.history.push({
      type: 'loss',
      timestamp: Date.now(),
    });

    this.logger.debug(`Loss recorded for run: ${runId}`, { runId, losses: run.losses });
  }

  /**
   * Add a unit to a run's deck.
   * Internal method used by draft service.
   *
   * @param runId - Run identifier
   * @param unitCard - Unit card to add
   * @throws NotFoundException if run does not exist
   *
   * @internal
   */
  addUnitToDeck(runId: string, unitCard: UnitCard): void {
    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    run.state.deck.push(unitCard);
    this.logger.debug(`Unit added to deck: ${runId}`, { runId, unitId: unitCard.unitId });
  }

  /**
   * Upgrade a unit in a run's deck.
   * Internal method used by upgrade service.
   *
   * @param runId - Run identifier
   * @param unitId - Unit template ID to upgrade
   * @param cost - Cost of upgrade
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if unit not in deck or insufficient budget
   *
   * @internal
   */
  upgradeUnit(runId: string, unitId: string, cost: number): void {
    const run = this.runs.get(runId);

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Find unit in deck
    const unitCard = run.state.deck.find((u) => u.unitId === unitId);
    if (!unitCard) {
      throw new BadRequestException(`Unit ${unitId} not in deck`);
    }

    // Check budget
    if (run.state.budget < cost) {
      throw new BadRequestException('Insufficient budget for upgrade');
    }

    // Perform upgrade
    unitCard.tier += 1;
    run.state.budget -= cost;

    // Record upgrade
    run.state.upgrades.push({
      unitId,
      tier: unitCard.tier,
      cost,
      timestamp: Date.now(),
    });

    this.logger.debug(`Unit upgraded: ${runId}`, { runId, unitId, tier: unitCard.tier });
  }
}
