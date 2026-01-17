# Error Codes Documentation

## Overview

This document describes all error codes returned by the Fantasy Roguelike API. All errors follow the standard HTTP status code conventions and include a structured JSON response.

## Error Response Format

All errors return a JSON object with the following structure:

```json
{
  "statusCode": 400,
  "message": "Detailed error message",
  "error": "Error Type",
  "details": {
    "field": "Additional context (optional)"
  }
}
```

---

## HTTP Status Codes

### 2xx Success

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |

### 4xx Client Errors

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid request parameters or state |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource state conflict |
| 422 | Unprocessable Entity | Validation failed |

### 5xx Server Errors

| Code | Name | Description |
|------|------|-------------|
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

---

## Run Management Errors

### POST /api/run/start

#### RUN_001: Invalid Faction ID

**Status:** 400 Bad Request

**Cause:** The provided faction ID does not exist.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid faction ID: 'invalid_faction'",
  "error": "Bad Request",
  "code": "RUN_001",
  "details": {
    "factionId": "invalid_faction",
    "validFactions": ["human", "undead", "elf", "orc", "dwarf", "demon"]
  }
}
```

**Solution:** Use a valid faction ID from the list.

---

#### RUN_002: Invalid Leader ID

**Status:** 400 Bad Request

**Cause:** The provided leader ID does not exist or is not valid for the faction.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid leader ID: 'invalid_leader' for faction 'human'",
  "error": "Bad Request",
  "code": "RUN_002",
  "details": {
    "leaderId": "invalid_leader",
    "factionId": "human",
    "validLeaders": ["knight", "paladin", "warlord"]
  }
}
```

**Solution:** Use a valid leader ID for the specified faction.

---

### GET /api/run/:runId

#### RUN_003: Run Not Found

**Status:** 404 Not Found

**Cause:** The specified run ID does not exist.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Run not found: 'run_invalid'",
  "error": "Not Found",
  "code": "RUN_003",
  "details": {
    "runId": "run_invalid"
  }
}
```

**Solution:** Verify the run ID is correct.

---

### POST /api/run/:runId/abandon

#### RUN_004: Run Already Completed

**Status:** 400 Bad Request

**Cause:** Cannot abandon a run that is already won or lost.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Cannot abandon completed run",
  "error": "Bad Request",
  "code": "RUN_004",
  "details": {
    "runId": "run_abc123",
    "status": "won"
  }
}
```

**Solution:** Only active runs can be abandoned.

---

## Battle Management Errors

### POST /api/battle/start

#### BATTLE_001: Run Not Found

**Status:** 404 Not Found

**Cause:** The specified run ID does not exist.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Run not found: 'run_invalid'",
  "error": "Not Found",
  "code": "BATTLE_001",
  "details": {
    "runId": "run_invalid"
  }
}
```

**Solution:** Verify the run ID is correct.

---

#### BATTLE_002: Invalid Team Setup

**Status:** 400 Bad Request

**Cause:** Team setup is invalid (mismatched units/positions, invalid positions, etc.).

**Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid team setup: units and positions count mismatch",
  "error": "Bad Request",
  "code": "BATTLE_002",
  "details": {
    "unitsCount": 3,
    "positionsCount": 2
  }
}
```

**Solution:** Ensure units array and positions array have the same length.

---

#### BATTLE_003: Invalid Unit Position

**Status:** 400 Bad Request

**Cause:** Unit position is outside valid player deployment zone (rows 0-1).

**Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid unit position: must be in rows 0-1",
  "error": "Bad Request",
  "code": "BATTLE_003",
  "details": {
    "position": { "x": 3, "y": 5 },
    "validRows": [0, 1]
  }
}
```

**Solution:** Place units only in rows 0-1 (y coordinates).

---

#### BATTLE_004: Unit Not in Deck

**Status:** 400 Bad Request

**Cause:** Attempting to use a unit that is not in the run's deck.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Unit not in deck: 'dragon'",
  "error": "Bad Request",
  "code": "BATTLE_004",
  "details": {
    "unitId": "dragon",
    "availableUnits": ["knight", "archer", "priest"]
  }
}
```

**Solution:** Only use units that are in the current deck.

---

#### BATTLE_005: Budget Exceeded

**Status:** 400 Bad Request

**Cause:** Team cost exceeds available budget.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Team cost exceeds budget",
  "error": "Bad Request",
  "code": "BATTLE_005",
  "details": {
    "teamCost": 15,
    "availableBudget": 10
  }
}
```

**Solution:** Reduce team size or use lower-cost units.

---

#### BATTLE_006: Duplicate Position

**Status:** 400 Bad Request

**Cause:** Multiple units placed at the same position.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Duplicate position detected",
  "error": "Bad Request",
  "code": "BATTLE_006",
  "details": {
    "position": { "x": 3, "y": 0 },
    "units": ["knight", "archer"]
  }
}
```

**Solution:** Ensure each unit has a unique position.

---

### POST /api/battle/:battleId/simulate

#### BATTLE_007: Battle Not Found

**Status:** 404 Not Found

**Cause:** The specified battle ID does not exist.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Battle not found: 'battle_invalid'",
  "error": "Not Found",
  "code": "BATTLE_007",
  "details": {
    "battleId": "battle_invalid"
  }
}
```

**Solution:** Verify the battle ID is correct.

---

#### BATTLE_008: Battle Already Simulated

**Status:** 409 Conflict

**Cause:** Battle has already been simulated.

**Response:**
```json
{
  "statusCode": 409,
  "message": "Battle already simulated",
  "error": "Conflict",
  "code": "BATTLE_008",
  "details": {
    "battleId": "battle_xyz789",
    "result": "win"
  }
}
```

**Solution:** Use GET /api/battle/:battleId/replay to retrieve existing results.

---

#### BATTLE_009: Simulation Error

**Status:** 500 Internal Server Error

**Cause:** Unexpected error during battle simulation.

**Response:**
```json
{
  "statusCode": 500,
  "message": "Battle simulation failed",
  "error": "Internal Server Error",
  "code": "BATTLE_009",
  "details": {
    "battleId": "battle_xyz789",
    "error": "Unexpected error in turn execution"
  }
}
```

**Solution:** Contact support with the battle ID.

---

### GET /api/battle/:battleId/replay

#### BATTLE_010: Battle Not Simulated

**Status:** 400 Bad Request

**Cause:** Attempting to get replay for a battle that hasn't been simulated yet.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Battle not yet simulated",
  "error": "Bad Request",
  "code": "BATTLE_010",
  "details": {
    "battleId": "battle_xyz789"
  }
}
```

**Solution:** Simulate the battle first using POST /api/battle/:battleId/simulate.

---

## Draft Management Errors

### GET /api/draft/:runId/options

#### DRAFT_001: Run Not Found

**Status:** 404 Not Found

**Cause:** The specified run ID does not exist.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Run not found: 'run_invalid'",
  "error": "Not Found",
  "code": "DRAFT_001",
  "details": {
    "runId": "run_invalid"
  }
}
```

**Solution:** Verify the run ID is correct.

---

#### DRAFT_002: No Draft Available

**Status:** 400 Bad Request

**Cause:** Run is not in draft phase (no recent battle win).

**Response:**
```json
{
  "statusCode": 400,
  "message": "No draft available for this run",
  "error": "Bad Request",
  "code": "DRAFT_002",
  "details": {
    "runId": "run_abc123",
    "phase": "battle"
  }
}
```

**Solution:** Win a battle to unlock draft options.

---

### POST /api/draft/:runId/pick

#### DRAFT_003: Invalid Card ID

**Status:** 400 Bad Request

**Cause:** The specified card is not in the current draft options.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid card ID: 'dragon' not in draft options",
  "error": "Bad Request",
  "code": "DRAFT_003",
  "details": {
    "cardId": "dragon",
    "availableCards": ["mage", "guardian", "crossbowman"]
  }
}
```

**Solution:** Pick one of the available draft options.

---

#### DRAFT_004: Draft Already Completed

**Status:** 409 Conflict

**Cause:** A card has already been picked for this draft.

**Response:**
```json
{
  "statusCode": 409,
  "message": "Draft already completed",
  "error": "Conflict",
  "code": "DRAFT_004",
  "details": {
    "runId": "run_abc123",
    "pickedCard": "mage"
  }
}
```

**Solution:** Only one card can be picked per draft.

---

### POST /api/draft/:runId/reroll

#### DRAFT_005: No Rerolls Remaining

**Status:** 400 Bad Request

**Cause:** All rerolls have been used.

**Response:**
```json
{
  "statusCode": 400,
  "message": "No rerolls remaining",
  "error": "Bad Request",
  "code": "DRAFT_005",
  "details": {
    "runId": "run_abc123",
    "rerollsRemaining": 0
  }
}
```

**Solution:** Pick from the current draft options.

---

## Upgrade Management Errors

### GET /api/upgrade/:runId/available

#### UPGRADE_001: Run Not Found

**Status:** 404 Not Found

**Cause:** The specified run ID does not exist.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Run not found: 'run_invalid'",
  "error": "Not Found",
  "code": "UPGRADE_001",
  "details": {
    "runId": "run_invalid"
  }
}
```

**Solution:** Verify the run ID is correct.

---

### POST /api/upgrade/:runId/upgrade

#### UPGRADE_002: Unit Not Found

**Status:** 404 Not Found

**Cause:** The specified unit is not in the deck.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Unit not found in deck: 'dragon'",
  "error": "Not Found",
  "code": "UPGRADE_002",
  "details": {
    "unitId": "dragon",
    "availableUnits": ["knight", "archer", "priest"]
  }
}
```

**Solution:** Only upgrade units that are in the deck.

---

#### UPGRADE_003: Unit at Max Tier

**Status:** 400 Bad Request

**Cause:** Unit is already at maximum tier (T3).

**Response:**
```json
{
  "statusCode": 400,
  "message": "Unit already at max tier",
  "error": "Bad Request",
  "code": "UPGRADE_003",
  "details": {
    "unitId": "knight",
    "currentTier": 3,
    "maxTier": 3
  }
}
```

**Solution:** Units cannot be upgraded beyond tier 3.

---

#### UPGRADE_004: Insufficient Budget

**Status:** 400 Bad Request

**Cause:** Not enough gold to perform the upgrade.

**Response:**
```json
{
  "statusCode": 400,
  "message": "Insufficient budget for upgrade",
  "error": "Bad Request",
  "code": "UPGRADE_004",
  "details": {
    "unitId": "knight",
    "upgradeCost": 10,
    "availableBudget": 5
  }
}
```

**Solution:** Earn more gold by winning battles.

---

## Validation Errors

### VAL_001: Missing Required Field

**Status:** 422 Unprocessable Entity

**Cause:** Required field is missing from request body.

**Response:**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "code": "VAL_001",
  "details": {
    "field": "factionId",
    "constraint": "required"
  }
}
```

**Solution:** Include all required fields in the request.

---

### VAL_002: Invalid Field Type

**Status:** 422 Unprocessable Entity

**Cause:** Field has incorrect type.

**Response:**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "code": "VAL_002",
  "details": {
    "field": "tier",
    "expectedType": "number",
    "receivedType": "string"
  }
}
```

**Solution:** Ensure field types match the API specification.

---

### VAL_003: Invalid Field Value

**Status:** 422 Unprocessable Entity

**Cause:** Field value is outside valid range.

**Response:**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "code": "VAL_003",
  "details": {
    "field": "x",
    "value": 10,
    "constraint": "min: 0, max: 7"
  }
}
```

**Solution:** Use values within the specified range.

---

## System Errors

### SYS_001: Database Connection Error

**Status:** 503 Service Unavailable

**Cause:** Cannot connect to database.

**Response:**
```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "error": "Service Unavailable",
  "code": "SYS_001"
}
```

**Solution:** Wait and retry. Contact support if issue persists.

---

### SYS_002: Internal Server Error

**Status:** 500 Internal Server Error

**Cause:** Unexpected server error.

**Response:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "code": "SYS_002",
  "details": {
    "requestId": "req_abc123"
  }
}
```

**Solution:** Contact support with the request ID.

---

## Error Handling Best Practices

### Client-Side Handling

1. **Always check status code** before processing response
2. **Display user-friendly messages** based on error codes
3. **Implement retry logic** for 5xx errors
4. **Validate input** before sending requests
5. **Log errors** with full context for debugging

### Example Error Handler (JavaScript)

```javascript
async function handleApiCall(apiFunction) {
  try {
    const response = await apiFunction();
    return response;
  } catch (error) {
    if (error.response) {
      const { statusCode, message, code, details } = error.response.data;
      
      switch (code) {
        case 'RUN_001':
        case 'RUN_002':
          console.error('Invalid run configuration:', message);
          // Show user-friendly error
          break;
          
        case 'BATTLE_005':
          console.error('Budget exceeded:', details);
          // Suggest removing units
          break;
          
        case 'SYS_001':
        case 'SYS_002':
          console.error('Server error:', message);
          // Retry after delay
          setTimeout(() => handleApiCall(apiFunction), 5000);
          break;
          
        default:
          console.error('API error:', message);
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}
```

---

## Support

For additional help with error codes:
- Check the [API Documentation](./API.md)
- Review the [Swagger UI](http://localhost:3000/api/docs)
- Open an issue on GitHub with error details
