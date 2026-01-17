import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import {
  DraftService,
  GetDraftOptionsResponse,
  PickCardRequest,
  PickCardResponse,
  RerollResponse,
} from './draft.service';

/**
 * Draft API controller for roguelike mode.
 * Handles HTTP endpoints for card drafting mechanics.
 *
 * Endpoints:
 * - GET /api/draft/:runId/options - Get available draft options
 * - POST /api/draft/:runId/pick - Pick a card from draft options
 * - POST /api/draft/:runId/reroll - Reroll draft options
 *
 * Draft flow:
 * 1. After battle win, player gets draft options (3 cards to choose from)
 * 2. Player picks 1 card to add to their deck
 * 3. Player can reroll options (limited rerolls per run)
 *
 * @module api/draft
 */
@ApiTags('draft')
@Controller('api/draft')
export class DraftController {
  private readonly logger = new Logger(DraftController.name);

  constructor(private readonly draftService: DraftService) {}

  /**
   * Get available draft options for a run.
   *
   * Returns 3 cards available for the player to pick from.
   * Available after each battle win when cards remain in the deck.
   *
   * @param runId - Run identifier
   * @returns Draft options with 3 cards and reroll count
   *
   * @example
   * GET /api/draft/run_abc123/options
   *
   * Response:
   * {
   *   "options": [
   *     { "unitId": "archer", "tier": 1, "cost": 4 },
   *     { "unitId": "mage", "tier": 1, "cost": 5 },
   *     { "unitId": "priest", "tier": 1, "cost": 4 }
   *   ],
   *   "rerollsRemaining": 2
   * }
   */
  @Get(':runId/options')
  @ApiOperation({
    summary: 'Get draft options',
    description:
      'Returns 3 cards available for the player to pick from. ' +
      'Available after each battle win when cards remain in the deck. ' +
      "Cards are randomly selected from the faction's unit pool.",
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Draft options retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          description: '3 cards to choose from',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'archer' },
              tier: { type: 'number', example: 1 },
              cost: { type: 'number', example: 4 },
            },
          },
        },
        rerollsRemaining: {
          type: 'number',
          description: 'Number of rerolls remaining',
          example: 2,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  @ApiResponse({ status: 400, description: 'No draft available (run not in draft phase)' })
  getDraftOptions(@Param('runId') runId: string): GetDraftOptionsResponse {
    this.logger.debug('Getting draft options', { runId });

    return this.draftService.getDraftOptions(runId);
  }

  /**
   * Pick a card from draft options.
   *
   * Adds the selected card to the player's deck.
   * Returns updated deck after the pick.
   *
   * @param runId - Run identifier
   * @param request - Pick request with cardId
   * @returns Success status and updated deck
   *
   * @example
   * POST /api/draft/run_abc123/pick
   * {
   *   "cardId": "archer"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "deck": [
   *     { "unitId": "knight", "tier": 1, "cost": 5 },
   *     { "unitId": "archer", "tier": 1, "cost": 4 }
   *   ]
   * }
   */
  @Post(':runId/pick')
  @ApiOperation({
    summary: 'Pick a card from draft',
    description:
      "Adds the selected card to the player's deck. " +
      'Card must be one of the current draft options. ' +
      'Returns updated deck after the pick.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiBody({
    description: 'Pick card request',
    schema: {
      type: 'object',
      required: ['cardId'],
      properties: {
        cardId: {
          type: 'string',
          description: 'Unit ID of the card to pick',
          example: 'archer',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Card picked successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation succeeded',
          example: true,
        },
        deck: {
          type: 'array',
          description: 'Updated deck after picking the card',
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'knight' },
              tier: { type: 'number', example: 1 },
              cost: { type: 'number', example: 5 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  @ApiResponse({ status: 400, description: 'Invalid card ID or not in draft phase' })
  pickCard(@Param('runId') runId: string, @Body() request: PickCardRequest): PickCardResponse {
    this.logger.debug('Picking card from draft', { runId, cardId: request.cardId });

    return this.draftService.pickCard(runId, request.cardId);
  }

  /**
   * Reroll draft options.
   *
   * Generates new draft options if rerolls are available.
   * Limited rerolls per run (typically 2-3).
   *
   * @param runId - Run identifier
   * @returns New draft options and remaining reroll count
   *
   * @example
   * POST /api/draft/run_abc123/reroll
   * {}
   *
   * Response:
   * {
   *   "options": [
   *     { "unitId": "rogue", "tier": 1, "cost": 4 },
   *     { "unitId": "duelist", "tier": 1, "cost": 5 },
   *     { "unitId": "assassin", "tier": 1, "cost": 6 }
   *   ],
   *   "rerollsRemaining": 1
   * }
   */
  @Post(':runId/reroll')
  @ApiOperation({
    summary: 'Reroll draft options',
    description:
      'Generates new draft options if rerolls are available. ' +
      'Limited rerolls per run (typically 2-3). ' +
      'Returns new set of 3 cards to choose from.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run identifier',
    example: 'run_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Draft options rerolled successfully',
    schema: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          description: 'New set of 3 cards to choose from',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              unitId: { type: 'string', example: 'rogue' },
              tier: { type: 'number', example: 1 },
              cost: { type: 'number', example: 4 },
            },
          },
        },
        rerollsRemaining: {
          type: 'number',
          description: 'Number of rerolls remaining after this reroll',
          example: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  @ApiResponse({ status: 400, description: 'No rerolls remaining or not in draft phase' })
  rerollOptions(@Param('runId') runId: string): RerollResponse {
    this.logger.debug('Rerolling draft options', { runId });

    return this.draftService.rerollOptions(runId);
  }
}
