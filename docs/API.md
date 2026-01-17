# Fantasy Roguelike API Documentation

## Overview

The Fantasy Roguelike API provides endpoints for managing roguelike runs, battles, drafting, and unit upgrades. All battles include Core 2.0 mechanic events (facing, flanking, riposte, charge, resolve, etc.).

**Base URL:** `http://localhost:3000`

**Interactive Documentation:** `http://localhost:3000/api/docs` (Swagger UI)

## Authentication

Currently, the API does not require authentication. This will be added in future versions.

## Core Concepts

### Run Lifecycle

1. **Start Run** - Create a new run with faction and leader
2. **Battle** - Fight against enemy teams (snapshots or bots)
3. **Draft** - Pick new units after winning battles
4. **Upgrade** - Improve units with earned gold
5. **Repeat** until 9 wins (victory) or 4 losses (defeat)

### Battle Flow

1. **Start Battle** - Set up player team and get enemy team
2. **Simulate Battle** - Execute battle simulation with Core 2.0 mechanics
3. **Get Replay** - Retrieve battle events for animation

### Core 2.0 Mechanics

All battles include events from 14 advanced mechanics:
- **Facing** - Directional combat
- **Flanking** - Bonus damage from sides/rear
- **Riposte** - Counter-attacks
- **Ammunition** - Limited ranged attacks
- **Charge** - Momentum-based damage
- **Resolve** - Morale system with routing
- **Engagement** - Zone of control
- **Intercept** - Movement blocking
- **Phalanx** - Formation bonuses
- **Contagion** - Status effect spreading
- **Armor Shred** - Armor degradation
- **Overwatch** - Vigilance mode
- **Line of Sight** - Ranged blocking
- **Aura** - Passive area effects

---

## Endpoints

### Run Management

#### POST /api/run/start

Start a new roguelike run.

**Request Body:**
```json
{
  "factionId": "human",
  "leaderId": "knight"
}
```

**Response (201):**
```json
{
  "runId": "run_abc123",
  "initialDeck": [
    { "unitId": "knight", "tier": 1, "cost": 5 },
    { "unitId": "archer", "tier": 1, "cost": 4 },
    { "unitId": "priest", "tier": 1, "cost": 4 }
  ],
  "budget": 10,
  "stage": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/run/start \
  -H "Content-Type: application/json" \
  -d '{"factionId":"human","leaderId":"knight"}'
```

---

#### GET /api/run/:runId

Get details of an existing run.

**Response (200):**
```json
{
  "runId": "run_abc123",
  "stage": 3,
  "wins": 2,
  "losses": 0,
  "budget": 8,
  "deck": [
    { "unitId": "knight", "tier": 2, "cost": 6 },
    { "unitId": "archer", "tier": 1, "cost": 4 },
    { "unitId": "priest", "tier": 1, "cost": 4 },
    { "unitId": "mage", "tier": 1, "cost": 5 }
  ],
  "upgrades": [
    {
      "unitId": "knight",
      "fromTier": 1,
      "toTier": 2,
      "stage": 2
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/run/run_abc123
```

---

#### POST /api/run/:runId/abandon

Abandon an active run.

**Response (200):**
```json
{
  "success": true
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/run/run_abc123/abandon
```

---

### Battle Management

#### POST /api/battle/start

Start a new battle.

**Request Body:**
```json
{
  "runId": "run_abc123",
  "playerTeam": {
    "units": [
      { "unitId": "knight", "tier": 2 },
      { "unitId": "archer", "tier": 1 },
      { "unitId": "priest", "tier": 1 }
    ],
    "positions": [
      { "x": 3, "y": 0 },
      { "x": 5, "y": 1 },
      { "x": 2, "y": 1 }
    ]
  }
}
```

**Response (201):**
```json
{
  "battleId": "battle_xyz789",
  "enemyTeam": {
    "units": [
      { "unitId": "rogue", "tier": 1 },
      { "unitId": "duelist", "tier": 1 }
    ],
    "positions": [
      { "x": 3, "y": 9 },
      { "x": 5, "y": 8 }
    ]
  },
  "seed": 42
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/battle/start \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "run_abc123",
    "playerTeam": {
      "units": [{"unitId":"knight","tier":2}],
      "positions": [{"x":3,"y":0}]
    }
  }'
```

---

#### POST /api/battle/:battleId/simulate

Simulate a battle.

**Request Body:**
```json
{
  "playerId": "player_123"
}
```

**Response (200):**
```json
{
  "result": "win",
  "events": [
    {
      "type": "battle_start",
      "round": 1,
      "turn": 0,
      "phase": "turn_start",
      "timestamp": 1234567890,
      "metadata": {
        "battleId": "battle_xyz789",
        "seed": 42,
        "playerUnits": 3,
        "enemyUnits": 2
      }
    },
    {
      "type": "turn_start",
      "round": 1,
      "turn": 1,
      "phase": "turn_start",
      "timestamp": 1234567891,
      "actorId": "player_knight_0",
      "metadata": {}
    },
    {
      "type": "resolve_changed",
      "round": 1,
      "turn": 1,
      "phase": "turn_start",
      "timestamp": 1234567892,
      "actorId": "player_knight_0",
      "metadata": {
        "delta": 5,
        "newValue": 105,
        "source": "regeneration"
      }
    },
    {
      "type": "movement",
      "round": 1,
      "turn": 1,
      "phase": "movement",
      "timestamp": 1234567893,
      "actorId": "player_knight_0",
      "metadata": {
        "from": { "x": 3, "y": 0 },
        "to": { "x": 3, "y": 2 },
        "distance": 2
      }
    },
    {
      "type": "charge_impact",
      "round": 1,
      "turn": 1,
      "phase": "movement",
      "timestamp": 1234567894,
      "actorId": "player_knight_0",
      "metadata": {
        "momentum": 2,
        "bonusDamage": 0.2
      }
    },
    {
      "type": "facing_rotated",
      "round": 1,
      "turn": 1,
      "phase": "pre_attack",
      "timestamp": 1234567895,
      "actorId": "player_knight_0",
      "metadata": {
        "from": "S",
        "to": "S"
      }
    },
    {
      "type": "flanking_applied",
      "round": 1,
      "turn": 1,
      "phase": "pre_attack",
      "timestamp": 1234567896,
      "actorId": "player_knight_0",
      "targetId": "enemy_rogue_0",
      "metadata": {
        "arc": "front",
        "modifier": 1.0
      }
    },
    {
      "type": "attack",
      "round": 1,
      "turn": 1,
      "phase": "attack",
      "timestamp": 1234567897,
      "actorId": "player_knight_0",
      "targetId": "enemy_rogue_0",
      "metadata": {
        "damage": 18,
        "damageType": "physical",
        "chargeBonus": 0.2
      }
    },
    {
      "type": "riposte_triggered",
      "round": 1,
      "turn": 1,
      "phase": "attack",
      "timestamp": 1234567898,
      "actorId": "enemy_rogue_0",
      "targetId": "player_knight_0",
      "metadata": {
        "damage": 8,
        "chance": 0.30,
        "chargesRemaining": 0
      }
    },
    {
      "type": "unit_died",
      "round": 1,
      "turn": 5,
      "phase": "attack",
      "timestamp": 1234567920,
      "actorId": "enemy_rogue_0",
      "metadata": {
        "killedBy": "player_knight_0"
      }
    },
    {
      "type": "battle_end",
      "round": 2,
      "turn": 8,
      "phase": "turn_end",
      "timestamp": 1234567950,
      "metadata": {
        "winner": "player",
        "totalRounds": 2,
        "totalTurns": 8
      }
    }
  ],
  "finalState": {
    "playerUnits": [
      {
        "instanceId": "player_knight_0",
        "unitId": "knight",
        "alive": true,
        "currentHp": 92,
        "maxHp": 120,
        "position": { "x": 3, "y": 5 },
        "facing": "S",
        "resolve": 105,
        "riposteCharges": 1
      },
      {
        "instanceId": "player_archer_0",
        "unitId": "archer",
        "alive": true,
        "currentHp": 60,
        "maxHp": 60,
        "position": { "x": 5, "y": 3 },
        "facing": "S",
        "resolve": 100,
        "ammo": 10
      },
      {
        "instanceId": "player_priest_0",
        "unitId": "priest",
        "alive": true,
        "currentHp": 50,
        "maxHp": 50,
        "position": { "x": 2, "y": 2 },
        "facing": "S",
        "resolve": 100
      }
    ],
    "enemyUnits": []
  },
  "rewards": {
    "gold": 5,
    "draftOptions": [
      { "unitId": "mage", "tier": 1, "cost": 5 },
      { "unitId": "guardian", "tier": 1, "cost": 6 },
      { "unitId": "crossbowman", "tier": 1, "cost": 5 }
    ]
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/battle/battle_xyz789/simulate \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_123"}'
```

---

#### GET /api/battle/:battleId/replay

Get battle replay data.

**Response (200):**
```json
{
  "events": [
    {
      "type": "battle_start",
      "round": 1,
      "turn": 0,
      "phase": "turn_start",
      "timestamp": 1234567890,
      "metadata": { "battleId": "battle_xyz789", "seed": 42 }
    },
    {
      "type": "facing_rotated",
      "round": 1,
      "turn": 1,
      "phase": "pre_attack",
      "timestamp": 1234567895,
      "actorId": "player_knight_0",
      "metadata": { "from": "S", "to": "S" }
    }
  ],
  "initialState": {
    "playerUnits": [
      {
        "instanceId": "player_knight_0",
        "unitId": "knight",
        "position": { "x": 3, "y": 0 },
        "currentHp": 120,
        "maxHp": 120,
        "facing": "S",
        "resolve": 100
      }
    ],
    "enemyUnits": [
      {
        "instanceId": "enemy_rogue_0",
        "unitId": "rogue",
        "position": { "x": 3, "y": 9 },
        "currentHp": 80,
        "maxHp": 80,
        "facing": "N",
        "resolve": 100
      }
    ]
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/battle/battle_xyz789/replay
```

---

### Draft Management

#### GET /api/draft/:runId/options

Get available draft options.

**Response (200):**
```json
{
  "options": [
    { "unitId": "mage", "tier": 1, "cost": 5 },
    { "unitId": "guardian", "tier": 1, "cost": 6 },
    { "unitId": "crossbowman", "tier": 1, "cost": 5 }
  ],
  "rerollsRemaining": 2
}
```

**Example:**
```bash
curl http://localhost:3000/api/draft/run_abc123/options
```

---

#### POST /api/draft/:runId/pick

Pick a card from draft options.

**Request Body:**
```json
{
  "cardId": "mage"
}
```

**Response (200):**
```json
{
  "success": true,
  "deck": [
    { "unitId": "knight", "tier": 2, "cost": 6 },
    { "unitId": "archer", "tier": 1, "cost": 4 },
    { "unitId": "priest", "tier": 1, "cost": 4 },
    { "unitId": "mage", "tier": 1, "cost": 5 }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/draft/run_abc123/pick \
  -H "Content-Type: application/json" \
  -d '{"cardId":"mage"}'
```

---

#### POST /api/draft/:runId/reroll

Reroll draft options.

**Response (200):**
```json
{
  "options": [
    { "unitId": "rogue", "tier": 1, "cost": 4 },
    { "unitId": "duelist", "tier": 1, "cost": 5 },
    { "unitId": "assassin", "tier": 1, "cost": 6 }
  ],
  "rerollsRemaining": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/draft/run_abc123/reroll
```

---

### Upgrade Management

#### GET /api/upgrade/:runId/available

Get available upgrades.

**Response (200):**
```json
{
  "upgradeable": [
    {
      "unitId": "knight",
      "currentTier": 2,
      "nextTier": 3,
      "cost": 10
    },
    {
      "unitId": "archer",
      "currentTier": 1,
      "nextTier": 2,
      "cost": 5
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/upgrade/run_abc123/available
```

---

#### POST /api/upgrade/:runId/upgrade

Upgrade a unit.

**Request Body:**
```json
{
  "unitId": "archer"
}
```

**Response (200):**
```json
{
  "success": true,
  "unit": {
    "unitId": "archer",
    "tier": 2,
    "cost": 5
  },
  "remainingGold": 5
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/upgrade/run_abc123/upgrade \
  -H "Content-Type: application/json" \
  -d '{"unitId":"archer"}'
```

---

## Event Types

### Core 2.0 Mechanic Events

| Event Type | Phase | Description |
|------------|-------|-------------|
| `facing_rotated` | pre_attack | Unit rotates to face target |
| `flanking_applied` | pre_attack | Flanking bonus calculated |
| `riposte_triggered` | attack | Counter-attack executed |
| `ammo_consumed` | post_attack | Ammunition spent |
| `charge_impact` | movement | Charge momentum applied |
| `resolve_changed` | turn_start, attack | Morale changed |
| `routing_started` | turn_start | Unit starts routing |
| `unit_rallied` | turn_start | Unit recovers from routing |
| `phalanx_formed` | turn_start | Formation bonus applied |
| `contagion_spread` | turn_end | Status effect spreads |
| `armor_shred_applied` | post_attack | Armor degraded |
| `armor_shred_decayed` | turn_end | Armor shred reduced |
| `intercept_triggered` | movement | Movement blocked |
| `engagement_started` | movement | Unit enters ZoC |
| `overwatch_triggered` | movement | Vigilance attack |

### Standard Combat Events

| Event Type | Phase | Description |
|------------|-------|-------------|
| `battle_start` | - | Battle begins |
| `turn_start` | turn_start | Unit's turn begins |
| `movement` | movement | Unit moves |
| `attack` | attack | Unit attacks |
| `damage` | attack | Damage dealt |
| `dodge` | attack | Attack dodged |
| `unit_died` | attack | Unit dies |
| `battle_end` | - | Battle ends |

---

## Error Responses

### 400 Bad Request

Invalid request parameters or state.

```json
{
  "statusCode": 400,
  "message": "Invalid faction or leader ID",
  "error": "Bad Request"
}
```

### 404 Not Found

Resource not found.

```json
{
  "statusCode": 404,
  "message": "Run not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error

Server error during processing.

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Complete Example Flow

### 1. Start a Run

```bash
curl -X POST http://localhost:3000/api/run/start \
  -H "Content-Type: application/json" \
  -d '{"factionId":"human","leaderId":"knight"}'
```

Response:
```json
{
  "runId": "run_abc123",
  "initialDeck": [
    { "unitId": "knight", "tier": 1, "cost": 5 },
    { "unitId": "archer", "tier": 1, "cost": 4 },
    { "unitId": "priest", "tier": 1, "cost": 4 }
  ],
  "budget": 10,
  "stage": 1
}
```

### 2. Start a Battle

```bash
curl -X POST http://localhost:3000/api/battle/start \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "run_abc123",
    "playerTeam": {
      "units": [
        {"unitId":"knight","tier":1},
        {"unitId":"archer","tier":1},
        {"unitId":"priest","tier":1}
      ],
      "positions": [
        {"x":3,"y":0},
        {"x":5,"y":1},
        {"x":2,"y":1}
      ]
    }
  }'
```

Response:
```json
{
  "battleId": "battle_xyz789",
  "enemyTeam": {
    "units": [{"unitId":"rogue","tier":1}],
    "positions": [{"x":3,"y":9}]
  },
  "seed": 42
}
```

### 3. Simulate Battle

```bash
curl -X POST http://localhost:3000/api/battle/battle_xyz789/simulate \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_123"}'
```

Response:
```json
{
  "result": "win",
  "events": [...],
  "finalState": {...},
  "rewards": {
    "gold": 5,
    "draftOptions": [...]
  }
}
```

### 4. Draft a Card

```bash
curl http://localhost:3000/api/draft/run_abc123/options
```

```bash
curl -X POST http://localhost:3000/api/draft/run_abc123/pick \
  -H "Content-Type: application/json" \
  -d '{"cardId":"mage"}'
```

### 5. Upgrade a Unit

```bash
curl http://localhost:3000/api/upgrade/run_abc123/available
```

```bash
curl -X POST http://localhost:3000/api/upgrade/run_abc123/upgrade \
  -H "Content-Type: application/json" \
  -d '{"unitId":"knight"}'
```

---

## Rate Limiting

Currently, there is no rate limiting. This will be added in future versions.

## Versioning

API Version: 1.0

The API follows semantic versioning. Breaking changes will increment the major version.

## Support

For issues or questions, please open an issue on the GitHub repository.
