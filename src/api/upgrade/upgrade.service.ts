import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { RunService, UnitCard, GetRunResponse } from '../run/run.service';

/**
 * Upgradeable unit information.
 */
export interface UpgradeableUnit {
  /** Unit template ID */
  unitId: string;
  /** Current upgrade tier (1-3) */
  currentTier: number;
  /** Next tier after upgrade */
  nextTier: number;
  /** Cost to upgrade to next tier */
  cost: number;
}

/**
 * Response for getting available upgrades.
 */
export interface GetAvailableUpgradesResponse {
  /** Units that can be upgraded */
  upgradeable: UpgradeableUnit[];
}

/**
 * Request body for upgrading a unit.
 */
export interface UpgradeUnitRequest {
  /** Unit template ID to upgrade */
  unitId: string;
}

/**
 * Response for upgrading a unit.
 */
export interface UpgradeUnitResponse {
  /** Whether upgrade was successful */
  success: boolean;
  /** Updated unit card after upgrade */
  unit: UnitCard;
  /** Remaining budget after upgrade */
  remainingGold: number;
}

/**
 * Upgrade cost table by tier.
 * Defines the cost to upgrade from one tier to the next.
 */
const UPGRADE_COSTS: Record<number, number> = {
  1: 5, // T1 -> T2 costs 5 gold
  2: 10, // T2 -> T3 costs 10 gold
};

/**
 * Maximum upgrade tier.
 */
const MAX_TIER = 3;

/**
 * Upgrade service for roguelike mode.
 * Handles unit tier upgrades during a run.
 *
 * Responsibilities:
 * - Get available upgrades for a run
 * - Perform unit upgrades (tier progression)
 * - Track upgrade history
 * - Manage upgrade costs and budget
 *
 * Upgrade flow:
 * 1. After battle win, player can upgrade units in their deck
 * 2. Each unit can be upgraded from T1 -> T2 -> T3
 * 3. Upgrades cost gold (5 for T1->T2, 10 for T2->T3)
 * 4. Player must have sufficient budget to upgrade
 *
 * @module api/upgrade
 */
@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(private readonly runService: RunService) {}

  /**
   * Get available upgrades for a run.
   *
   * Returns all units in the deck that can be upgraded to the next tier.
   * Units at max tier (T3) are not included.
   *
   * @param runId - Run identifier
   * @returns List of upgradeable units with costs
   * @throws NotFoundException if run does not exist
   *
   * @example
   * const upgrades = await upgradeService.getAvailableUpgrades('run_123');
   * // Returns: {
   * //   upgradeable: [
   * //     { unitId: 'knight', currentTier: 1, nextTier: 2, cost: 5 },
   * //     { unitId: 'archer', currentTier: 2, nextTier: 3, cost: 10 }
   * //   ]
   * // }
   */
  getAvailableUpgrades(runId: string): GetAvailableUpgradesResponse {
    // Validate run exists
    const run = this.runService.getRun(runId);

    // Get upgradeable units (not at max tier)
    const upgradeable: UpgradeableUnit[] = run.deck
      .filter((unit) => unit.tier < MAX_TIER)
      .map((unit) => ({
        unitId: unit.unitId,
        currentTier: unit.tier,
        nextTier: unit.tier + 1,
        cost: UPGRADE_COSTS[unit.tier] || 0,
      }));

    this.logger.debug('Available upgrades retrieved', {
      runId,
      upgradeableCount: upgradeable.length,
    });

    return { upgradeable };
  }

  /**
   * Upgrade a unit to the next tier.
   *
   * Increases the unit's tier by 1 and deducts the upgrade cost from the run's budget.
   * Unit must be in the deck and not at max tier.
   * Run must have sufficient budget.
   *
   * @param runId - Run identifier
   * @param unitId - Unit template ID to upgrade
   * @returns Success status, updated unit, and remaining budget
   * @throws NotFoundException if run does not exist
   * @throws BadRequestException if unit not in deck, already at max tier, or insufficient budget
   *
   * @example
   * const result = await upgradeService.upgradeUnit('run_123', 'knight');
   * // Returns: {
   * //   success: true,
   * //   unit: { unitId: 'knight', tier: 2, cost: 6 },
   * //   remainingGold: 5
   * // }
   */
  upgradeUnit(runId: string, unitId: string): UpgradeUnitResponse {
    // Validate run exists
    const run = this.runService.getRun(runId);

    // Find unit in deck
    const unit = run.deck.find((u) => u.unitId === unitId);
    if (!unit) {
      throw new BadRequestException(`Unit ${unitId} not in deck`);
    }

    // Check if unit can be upgraded
    if (unit.tier >= MAX_TIER) {
      throw new BadRequestException(
        `Unit ${unitId} is already at max tier (${MAX_TIER})`
      );
    }

    // Get upgrade cost
    const upgradeCost = UPGRADE_COSTS[unit.tier];
    if (upgradeCost === undefined) {
      throw new BadRequestException(`Invalid tier for unit ${unitId}`);
    }

    // Check budget
    if (run.budget < upgradeCost) {
      throw new BadRequestException(
        `Insufficient budget. Need ${upgradeCost}, have ${run.budget}`
      );
    }

    // Perform upgrade via RunService
    this.runService.upgradeUnit(runId, unitId, upgradeCost);

    // Get updated run state
    const updatedRun = this.runService.getRun(runId);
    const upgradedUnit = updatedRun.deck.find((u) => u.unitId === unitId);

    if (!upgradedUnit) {
      throw new BadRequestException(`Failed to upgrade unit ${unitId}`);
    }

    this.logger.debug('Unit upgraded', {
      runId,
      unitId,
      newTier: upgradedUnit.tier,
      cost: upgradeCost,
      remainingBudget: updatedRun.budget,
    });

    return {
      success: true,
      unit: upgradedUnit,
      remainingGold: updatedRun.budget,
    };
  }
}
