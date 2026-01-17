import { Controller, Post, Get, Param, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import {
  BattleService,
  StartBattleRequest,
  StartBattleResponse,
  SimulateBattleRequest,
  SimulateBattleResponse,
  GetBattleReplayResponse,
} from './battle.service';

/**
 * Battle simulation API controller.
 * Handles HTTP endpoints for battle management and simulation.
 *
 * Endpoints:
 * - POST /api/battle/start - Start a new battle
 * - POST /api/battle/:battleId/simulate - Simulate a battle
 * - GET /api/battle/:battleId/replay - Get battle replay
 *
 * All responses include Core 2.0 mechanic events:
 * - facing_rotated
 * - flanking_applied
 * - riposte_triggered
 * - ammo_consumed
 * - charge_impact
 * - resolve_changed
 * - routing_started
 * - unit_rallied
 * - phalanx_formed
 * - contagion_spread
 * - And all standard combat events (attack, damage, dodge, unit_died)
 *
 * @module api/battle
 */
@ApiTags('battle')
@Controller('api/battle')
export class BattleController {
  private readonly logger = new Logger(BattleController.name);

  constructor(private readonly battleService: BattleService) {}

  /**
   * Start a new battle.
   *
   * Creates a battle with the player's team and generates or finds an enemy team.
   * Returns battle ID and enemy team setup for display.
   *
   * @param request - Start battle request with runId and playerTeam
   * @returns Battle details with enemy team and seed
   *
   * @example
   * POST /api/battle/start
   * {
   *   "runId": "run_abc123",
   *   "playerTeam": {
   *     "units": [
   *       { "unitId": "knight", "tier": 1 },
   *       { "unitId": "archer", "tier": 1 }
   *     ],
   *     "positions": [
   *       { "x": 3, "y": 0 },
   *       { "x": 5, "y": 1 }
   *     ]
   *   }
   * }
   *
   * Response:
   * {
   *   "battleId": "battle_abc123",
   *   "enemyTeam": {
   *     "units": [{ "unitId": "rogue", "tier": 1 }],
   *     "positions": [{ "x": 3, "y": 9 }]
   *   },
   *   "seed": 12345
   * }
   */
  @Post('start')
  @ApiOperation({
    summary: 'Start a new battle',
    description:
      "Creates a battle with the player's team and generates or finds an enemy team. " +
      'Enemy team is selected from player snapshots at the same stage, or a bot team is generated. ' +
      'Returns battle ID, enemy team setup, and random seed for deterministic simulation.',
  })
  @ApiBody({
    description: 'Start battle request',
    schema: {
      type: 'object',
      required: ['runId', 'playerTeam'],
      properties: {
        runId: {
          type: 'string',
          description: 'Run identifier',
          example: 'run_abc123',
        },
        playerTeam: {
          type: 'object',
          required: ['units', 'positions'],
          properties: {
            units: {
              type: 'array',
              description: 'Player units with tier information',
              items: {
                type: 'object',
                properties: {
                  unitId: { type: 'string', example: 'knight' },
                  tier: { type: 'number', example: 1 },
                },
              },
            },
            positions: {
              type: 'array',
              description: 'Unit positions on the grid (rows 0-1 for player)',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number', minimum: 0, maximum: 7, example: 3 },
                  y: { type: 'number', minimum: 0, maximum: 1, example: 0 },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Battle created successfully',
    schema: {
      type: 'object',
      properties: {
        battleId: { type: 'string', example: 'battle_abc123' },
        enemyTeam: {
          type: 'object',
          properties: {
            units: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  unitId: { type: 'string', example: 'rogue' },
                  tier: { type: 'number', example: 1 },
                },
              },
            },
            positions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number', example: 3 },
                  y: { type: 'number', example: 9 },
                },
              },
            },
          },
        },
        seed: {
          type: 'number',
          description: 'Random seed for deterministic simulation',
          example: 12345,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid team setup or run not found' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  startBattle(@Body() request: StartBattleRequest): StartBattleResponse {
    this.logger.debug('Starting new battle', {
      runId: request.runId,
      playerUnits: request.playerTeam.units.length,
    });

    return this.battleService.startBattle(request);
  }

  /**
   * Simulate a battle.
   *
   * Executes the battle simulation using the core simulator.
   * Returns all events including Core 2.0 mechanic events.
   * Updates run progression (wins/losses) based on result.
   * Creates a snapshot after a win for async PvP matchmaking.
   *
   * @param battleId - Battle identifier
   * @param request - Simulate battle request with optional playerId
   * @returns Battle result with events and final state
   *
   * @example
   * POST /api/battle/battle_abc123/simulate
   * { "playerId": "player_123" }
   *
   * Response:
   * {
   *   "result": "win",
   *   "events": [
   *     {
   *       "type": "battle_start",
   *       "round": 1,
   *       "turn": 0,
   *       "phase": "turn_start",
   *       "timestamp": 1234567890,
   *       "metadata": { "battleId": "battle_abc123", "seed": 12345, ... }
   *     },
   *     {
   *       "type": "facing_rotated",
   *       "round": 1,
   *       "turn": 1,
   *       "phase": "pre_attack",
   *       "timestamp": 1234567891,
   *       "actorId": "player_knight_0",
   *       "metadata": { "from": "S", "to": "S" }
   *     },
   *     {
   *       "type": "flanking_applied",
   *       "round": 1,
   *       "turn": 1,
   *       "phase": "pre_attack",
   *       "timestamp": 1234567892,
   *       "actorId": "player_knight_0",
   *       "targetId": "enemy_rogue_0",
   *       "metadata": { "arc": "front", "modifier": 1.0 }
   *     },
   *     {
   *       "type": "attack",
   *       "round": 1,
   *       "turn": 1,
   *       "phase": "attack",
   *       "timestamp": 1234567893,
   *       "actorId": "player_knight_0",
   *       "targetId": "enemy_rogue_0",
   *       "metadata": { "damage": 15, "damageType": "physical" }
   *     },
   *     {
   *       "type": "riposte_triggered",
   *       "round": 1,
   *       "turn": 1,
   *       "phase": "attack",
   *       "timestamp": 1234567894,
   *       "targetId": "enemy_rogue_0",
   *       "actorId": "player_knight_0",
   *       "metadata": { "damage": 8, "chance": 0.30 }
   *     },
   *     ...more events...
   *   ],
   *   "finalState": {
   *     "playerUnits": [
   *       {
   *         "instanceId": "player_knight_0",
   *         "unitId": "knight",
   *         "alive": true,
   *         "currentHp": 85,
   *         "maxHp": 100,
   *         "position": { "x": 3, "y": 2 }
   *       }
   *     ],
   *     "enemyUnits": []
   *   },
   *   "rewards": {
   *     "gold": 5,
   *     "draftOptions": [
   *       { "unitId": "archer", "tier": 1, "cost": 4 },
   *       { "unitId": "mage", "tier": 1, "cost": 5 },
   *       { "unitId": "priest", "tier": 1, "cost": 4 }
   *     ]
   *   }
   * }
   */
  @Post(':battleId/simulate')
  @ApiOperation({
    summary: 'Simulate a battle',
    description:
      'Executes the battle simulation using the core simulator. ' +
      'Returns all events including Core 2.0 mechanic events (facing, flanking, riposte, charge, resolve, etc.). ' +
      'Updates run progression (wins/losses) based on result. ' +
      'Creates a snapshot after a win for async PvP matchmaking.',
  })
  @ApiParam({
    name: 'battleId',
    description: 'Battle identifier',
    example: 'battle_abc123',
  })
  @ApiBody({
    description: 'Simulate battle request',
    required: false,
    schema: {
      type: 'object',
      properties: {
        playerId: {
          type: 'string',
          description: 'Optional player identifier for snapshot creation',
          example: 'player_123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Battle simulated successfully',
    schema: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          enum: ['win', 'loss'],
          description: 'Battle outcome',
          example: 'win',
        },
        events: {
          type: 'array',
          description: 'All battle events including Core 2.0 mechanic events',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'attack' },
              round: { type: 'number', example: 1 },
              turn: { type: 'number', example: 1 },
              phase: { type: 'string', example: 'attack' },
              timestamp: { type: 'number', example: 1234567890 },
              actorId: { type: 'string', example: 'player_knight_0' },
              targetId: { type: 'string', example: 'enemy_rogue_0' },
              metadata: { type: 'object', example: { damage: 15 } },
            },
          },
        },
        finalState: {
          type: 'object',
          properties: {
            playerUnits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  instanceId: { type: 'string', example: 'player_knight_0' },
                  unitId: { type: 'string', example: 'knight' },
                  alive: { type: 'boolean', example: true },
                  currentHp: { type: 'number', example: 85 },
                  maxHp: { type: 'number', example: 100 },
                  position: {
                    type: 'object',
                    properties: {
                      x: { type: 'number', example: 3 },
                      y: { type: 'number', example: 2 },
                    },
                  },
                },
              },
            },
            enemyUnits: { type: 'array', items: { type: 'object' } },
          },
        },
        rewards: {
          type: 'object',
          description: 'Rewards for winning (only present if result is "win")',
          properties: {
            gold: { type: 'number', example: 5 },
            draftOptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  unitId: { type: 'string', example: 'archer' },
                  tier: { type: 'number', example: 1 },
                  cost: { type: 'number', example: 4 },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Battle not found' })
  async simulateBattle(
    @Param('battleId') battleId: string,
    @Body() request: SimulateBattleRequest & { playerId?: string },
  ): Promise<SimulateBattleResponse> {
    this.logger.debug('Simulating battle', { battleId, playerId: request.playerId });

    return this.battleService.simulateBattle(battleId, request.playerId);
  }

  /**
   * Get battle replay.
   *
   * Returns all events and initial state for replaying a battle.
   * Used by frontend to animate the battle with all Core 2.0 mechanic events.
   *
   * @param battleId - Battle identifier
   * @returns Battle events and initial state
   *
   * @example
   * GET /api/battle/battle_abc123/replay
   *
   * Response:
   * {
   *   "events": [
   *     { "type": "battle_start", ... },
   *     { "type": "facing_rotated", ... },
   *     { "type": "flanking_applied", ... },
   *     { "type": "attack", ... },
   *     { "type": "riposte_triggered", ... },
   *     ...
   *   ],
   *   "initialState": {
   *     "playerUnits": [
   *       {
   *         "instanceId": "player_knight_0",
   *         "unitId": "knight",
   *         "position": { "x": 3, "y": 0 },
   *         "currentHp": 100,
   *         "maxHp": 100
   *       }
   *     ],
   *     "enemyUnits": [
   *       {
   *         "instanceId": "enemy_rogue_0",
   *         "unitId": "rogue",
   *         "position": { "x": 3, "y": 9 },
   *         "currentHp": 100,
   *         "maxHp": 100
   *       }
   *     ]
   *   }
   * }
   */
  @Get(':battleId/replay')
  @ApiOperation({
    summary: 'Get battle replay',
    description:
      'Returns all events and initial state for replaying a battle. ' +
      'Used by frontend to animate the battle with all Core 2.0 mechanic events. ' +
      'Events include facing rotations, flanking bonuses, riposte triggers, charge impacts, and more.',
  })
  @ApiParam({
    name: 'battleId',
    description: 'Battle identifier',
    example: 'battle_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Battle replay retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          description: 'All battle events',
          items: { type: 'object' },
        },
        initialState: {
          type: 'object',
          description: 'Initial battle state before simulation',
          properties: {
            playerUnits: { type: 'array', items: { type: 'object' } },
            enemyUnits: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Battle not found' })
  getBattleReplay(@Param('battleId') battleId: string): GetBattleReplayResponse {
    this.logger.debug('Getting battle replay', { battleId });

    return this.battleService.getBattleReplay(battleId);
  }
}
