import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import {
  UpgradeService,
  GetAvailableUpgradesResponse,
  UpgradeUnitRequest,
  UpgradeUnitResponse,
} from './upgrade.service';

/**
 * Upgrade API controller for roguelike mode.
 * Handles HTTP endpoints for unit tier upgrades.
 *
 * Endpoints:
 * - GET /api/upgrade/:runId/available - Get available upgrades
 * - POST /api/upgrade/:runId/upgrade - Upgrade a unit
 *
 * Upgrade flow:
 * 1. After battle win, player can view available upgrades
 * 2. Each unit can be upgraded from T1 -> T2 -> T3
 * 3. Upgrades cost gold (5 for T1->T2, 10 for T2->T3)
 * 4. Player selects a unit to upgrade if they have sufficient budget
 *
 * @module api/upgrade
 */
@ApiTags('upgrade')
@Controller('api/upgrade')
export class UpgradeController {
  private readonly logger = new Logger(UpgradeController.name);

  constructor(private readonly upgradeService: UpgradeService) {}

  /**
   * Get available upgrades for a run.
   *
   * Returns all units in the deck that can be upgraded to the next tier.
   * Units at max tier (T3) are not included.
   *
   * @param runId - Run identifier
   * @returns List of upgradeable units with costs
   *
   * @example
   * GET /api/upgrade/run_abc123/available
   *
   * Response:
   * {
   *   "upgradeable": [
   *     { "unitId": "knight", "currentTier": 1, "nextTier": 2, "cost": 5 },
   *     { "unitId": "archer", "currentTier": 2, "nextTier": 3, "cost": 10 }
   *   ]
   * }
   */
  @Get(':runId/available')
  @ApiOperation({
    summary: 'Get available upgrades',
    description:
      'Returns all units in the deck that can be upgraded to the next tier. ' +
      'Units at max tier (T3) are not included. ' +
      'Upgrade costs: T1->T2 = 5 gold, T2->T3 = 10 gold.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Available upgrades retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        upgradeable: {
          type: 'array',
          description: 'List of units that can be upgraded',
          items: {
            type: 'object',
            properties: {
              unitId: {
                type: 'string',
                description: 'Unit identifier',
                example: 'knight',
              },
              currentTier: {
                type: 'number',
                description: 'Current tier (1 or 2)',
                example: 1,
              },
              nextTier: {
                type: 'number',
                description: 'Next tier after upgrade (2 or 3)',
                example: 2,
              },
              cost: {
                type: 'number',
                description: 'Gold cost for upgrade (5 for T1->T2, 10 for T2->T3)',
                example: 5,
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  getAvailableUpgrades(
    @Param('runId') runId: string,
  ): GetAvailableUpgradesResponse {
    this.logger.debug('Getting available upgrades', { runId });

    return this.upgradeService.getAvailableUpgrades(runId);
  }

  /**
   * Upgrade a unit to the next tier.
   *
   * Increases the unit's tier by 1 and deducts the upgrade cost from the run's budget.
   * Unit must be in the deck and not at max tier.
   * Run must have sufficient budget.
   *
   * @param runId - Run identifier
   * @param request - Upgrade request with unitId
   * @returns Success status, updated unit, and remaining budget
   *
   * @example
   * POST /api/upgrade/run_abc123/upgrade
   * {
   *   "unitId": "knight"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "unit": { "unitId": "knight", "tier": 2, "cost": 6 },
   *   "remainingGold": 5
   * }
   */
  @Post(':runId/upgrade')
  @ApiOperation({
    summary: 'Upgrade a unit',
    description:
      'Increases the unit\'s tier by 1 and deducts the upgrade cost from the run\'s budget. ' +
      'Unit must be in the deck and not at max tier (T3). ' +
      'Run must have sufficient budget (5 gold for T1->T2, 10 gold for T2->T3).',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiBody({
    description: 'Upgrade unit request',
    schema: {
      type: 'object',
      required: ['unitId'],
      properties: {
        unitId: {
          type: 'string',
          description: 'Unit identifier to upgrade',
          example: 'knight',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Unit upgraded successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation succeeded',
          example: true,
        },
        unit: {
          type: 'object',
          description: 'Updated unit after upgrade',
          properties: {
            unitId: { type: 'string', example: 'knight' },
            tier: { type: 'number', description: 'New tier after upgrade', example: 2 },
            cost: { type: 'number', description: 'Updated cost after upgrade', example: 6 },
          },
        },
        remainingGold: {
          type: 'number',
          description: 'Remaining gold after upgrade',
          example: 5,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run or unit not found' })
  @ApiResponse({ status: 400, description: 'Insufficient budget or unit at max tier' })
  upgradeUnit(
    @Param('runId') runId: string,
    @Body() request: UpgradeUnitRequest,
  ): UpgradeUnitResponse {
    this.logger.debug('Upgrading unit', { runId, unitId: request.unitId });

    return this.upgradeService.upgradeUnit(runId, request.unitId);
  }
}
