import { Controller, Post, Get, Param, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { RunService, StartRunResponse, GetRunResponse, AbandonRunResponse } from './run.service';

/**
 * Request body for starting a new run.
 */
export interface StartRunRequest {
  /** Faction ID for the run */
  factionId: string;
  /** Leader unit ID for the run */
  leaderId: string;
}

/**
 * Run management API controller.
 * Handles HTTP endpoints for roguelike run management.
 *
 * Endpoints:
 * - POST /api/run/start - Start a new run
 * - GET /api/run/:runId - Get run details
 * - POST /api/run/:runId/abandon - Abandon a run
 *
 * @module api/run
 */
@ApiTags('run')
@Controller('api/run')
export class RunController {
  private readonly logger = new Logger(RunController.name);

  constructor(private readonly runService: RunService) {}

  /**
   * Start a new roguelike run.
   *
   * Creates a new run with the specified faction and leader unit.
   * Returns initial deck and budget for the run.
   *
   * @param request - Start run request with factionId and leaderId
   * @returns Run details with initial deck and budget
   *
   * @example
   * POST /api/run/start
   * {
   *   "factionId": "human",
   *   "leaderId": "knight"
   * }
   *
   * Response:
   * {
   *   "runId": "run_abc123",
   *   "initialDeck": [
   *     { "unitId": "knight", "tier": 1, "cost": 5 }
   *   ],
   *   "budget": 10,
   *   "stage": 1
   * }
   */
  @Post('start')
  @ApiOperation({
    summary: 'Start a new roguelike run',
    description:
      'Creates a new run with the specified faction and leader unit. ' +
      'Returns initial deck (leader + 2 random units) and starting budget (10 points).',
  })
  @ApiBody({
    description: 'Start run request',
    schema: {
      type: 'object',
      required: ['factionId', 'leaderId'],
      properties: {
        factionId: {
          type: 'string',
          description: 'Faction identifier (e.g., "human", "undead")',
          example: 'human',
        },
        leaderId: {
          type: 'string',
          description: 'Leader unit identifier (e.g., "knight", "necromancer")',
          example: 'knight',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Run created successfully',
    schema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Unique run identifier',
          example: 'run_abc123',
        },
        initialDeck: {
          type: 'array',
          description: 'Starting deck with leader and 2 random units',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'knight' },
              tier: { type: 'number', example: 1 },
              cost: { type: 'number', example: 5 },
            },
          },
        },
        budget: {
          type: 'number',
          description: 'Starting budget in points',
          example: 10,
        },
        stage: {
          type: 'number',
          description: 'Current stage (always 1 for new runs)',
          example: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid faction or leader ID' })
  startRun(@Body() request: StartRunRequest): StartRunResponse {
    this.logger.debug('Starting new run', {
      factionId: request.factionId,
      leaderId: request.leaderId,
    });

    return this.runService.startRun(request.factionId, request.leaderId);
  }

  /**
   * Get details of an existing run.
   *
   * Returns current run state including stage, wins, losses, deck, and upgrades.
   *
   * @param runId - Run identifier
   * @returns Run details
   *
   * @example
   * GET /api/run/run_abc123
   *
   * Response:
   * {
   *   "runId": "run_abc123",
   *   "stage": 3,
   *   "wins": 2,
   *   "losses": 0,
   *   "budget": 8,
   *   "deck": [
   *     { "unitId": "knight", "tier": 1, "cost": 5 },
   *     { "unitId": "archer", "tier": 1, "cost": 4 }
   *   ],
   *   "upgrades": []
   * }
   */
  @Get(':runId')
  @ApiOperation({
    summary: 'Get run details',
    description:
      'Returns current run state including stage, wins, losses, deck, and upgrades. ' +
      'Used to resume a run or display run progress.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Run details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        runId: { type: 'string', example: 'run_abc123' },
        stage: { type: 'number', description: 'Current stage (1-9)', example: 3 },
        wins: { type: 'number', description: 'Total wins in this run', example: 2 },
        losses: { type: 'number', description: 'Total losses in this run', example: 0 },
        budget: { type: 'number', description: 'Current budget in points', example: 8 },
        deck: {
          type: 'array',
          description: 'Current deck of units',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'knight' },
              tier: { type: 'number', example: 1 },
              cost: { type: 'number', example: 5 },
            },
          },
        },
        upgrades: {
          type: 'array',
          description: 'History of upgrades performed',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'knight' },
              fromTier: { type: 'number', example: 1 },
              toTier: { type: 'number', example: 2 },
              stage: { type: 'number', example: 2 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  getRun(@Param('runId') runId: string): GetRunResponse {
    this.logger.debug('Getting run details', { runId });

    return this.runService.getRun(runId);
  }

  /**
   * Abandon an active run.
   *
   * Marks the run as lost and prevents further progression.
   * Can only be called on active runs.
   *
   * @param runId - Run identifier
   * @returns Success status
   *
   * @example
   * POST /api/run/run_abc123/abandon
   *
   * Response:
   * {
   *   "success": true
   * }
   */
  @Post(':runId/abandon')
  @ApiOperation({
    summary: 'Abandon a run',
    description:
      'Marks the run as lost and prevents further progression. ' +
      'Can only be called on active runs. This action is irreversible.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Run abandoned successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation succeeded',
          example: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  @ApiResponse({ status: 400, description: 'Run is not active' })
  abandonRun(@Param('runId') runId: string): AbandonRunResponse {
    this.logger.debug('Abandoning run', { runId });

    return this.runService.abandonRun(runId);
  }
}
