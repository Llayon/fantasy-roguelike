/**
 * Grid system for battle engine.
 * Provides pure functions for grid operations, pathfinding, and spatial calculations.
 *
 * @fileoverview Grid utilities for battlefield management, unit positioning,
 * range calculations, and movement validation.
 *
 * @module core/grid
 */

import type { Position, GridCell, CellType, Grid } from '../types/grid.types';
import type { GridConfig } from '../types/config.types';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default grid configuration.
 * Standard 8×10 battlefield with deployment zones.
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  width: 8,
  height: 10,
  playerRows: [0, 1],
  enemyRows: [8, 9],
};

// =============================================================================
// UNIT INTERFACE (minimal for core)
// =============================================================================

/**
 * Minimal unit interface for grid operations.
 * Game-specific unit types should extend this.
 */
export interface GridUnit {
  /** Unique instance identifier */
  instanceId: string;
  /** Current position on grid */
  position: Position;
  /** Whether unit is alive */
  alive: boolean;
}

// =============================================================================
// GRID CREATION FUNCTIONS
// =============================================================================

/**
 * Create an empty battlefield grid.
 * All cells are initialized as empty and walkable.
 *
 * @param config - Grid configuration (defaults to 8×10)
 * @returns 2D array of empty grid cells
 * @example
 * const grid = createEmptyGrid();
 * console.log(grid.length); // 10 (height)
 * console.log(grid[0].length); // 8 (width)
 *
 * // Custom grid size
 * const smallGrid = createEmptyGrid({ width: 4, height: 4, playerRows: [0], enemyRows: [3] });
 */
export function createEmptyGrid(config: GridConfig = DEFAULT_GRID_CONFIG): Grid {
  const grid: Grid = [];

  for (let y = 0; y < config.height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < config.width; x++) {
      row.push({
        position: { x, y },
        type: 'empty' as CellType,
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Create a grid with units placed at their positions.
 * Updates cell types and unit references based on unit positions.
 *
 * @param units - Array of units with positions
 * @param config - Grid configuration (defaults to 8×10)
 * @returns Grid with units placed
 * @example
 * const units = [{ instanceId: 'unit1', position: { x: 0, y: 0 }, alive: true }];
 * const grid = createGridWithUnits(units);
 * console.log(grid[0][0].type); // 'occupied'
 */
export function createGridWithUnits(
  units: GridUnit[],
  config: GridConfig = DEFAULT_GRID_CONFIG
): Grid {
  const grid = createEmptyGrid(config);

  for (const unit of units) {
    if (unit.alive && isValidPosition(unit.position, config)) {
      const { x, y } = unit.position;
      const row = grid[y];
      if (row) {
        row[x] = {
          position: unit.position,
          type: 'occupied' as CellType,
          unitId: unit.instanceId,
        };
      }
    }
  }

  return grid;
}

// =============================================================================
// POSITION VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a position is within the valid grid bounds.
 * Grid coordinates are 0-based.
 *
 * @param pos - Position to validate
 * @param config - Grid configuration (defaults to 8×10)
 * @returns True if position is within grid bounds
 * @example
 * console.log(isValidPosition({ x: 0, y: 0 })); // true
 * console.log(isValidPosition({ x: 8, y: 0 })); // false (out of bounds)
 * console.log(isValidPosition({ x: -1, y: 5 })); // false (negative)
 */
export function isValidPosition(
  pos: Position,
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  return pos.x >= 0 && pos.x < config.width && pos.y >= 0 && pos.y < config.height;
}

/**
 * Check if a position is walkable (not occupied or blocked).
 *
 * @param pos - Position to check
 * @param grid - Current grid state
 * @param config - Grid configuration (defaults to 8×10)
 * @returns True if position can be moved to
 * @example
 * const grid = createEmptyGrid();
 * console.log(isWalkable({ x: 0, y: 0 }, grid)); // true
 */
export function isWalkable(
  pos: Position,
  grid: Grid,
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  if (!isValidPosition(pos, config)) {
    return false;
  }

  const row = grid[pos.y];
  if (!row) return false;

  const cell = row[pos.x];
  if (!cell) return false;

  return cell.type === 'empty';
}

/**
 * Check if a position is in the player deployment zone.
 *
 * @param pos - Position to check
 * @param config - Grid configuration (defaults to 8×10)
 * @returns True if position is in player deployment zone
 * @example
 * console.log(isPlayerDeploymentZone({ x: 0, y: 0 })); // true
 * console.log(isPlayerDeploymentZone({ x: 0, y: 2 })); // false
 */
export function isPlayerDeploymentZone(
  pos: Position,
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  return config.playerRows.includes(pos.y);
}

/**
 * Check if a position is in the enemy deployment zone.
 *
 * @param pos - Position to check
 * @param config - Grid configuration (defaults to 8×10)
 * @returns True if position is in enemy deployment zone
 * @example
 * console.log(isEnemyDeploymentZone({ x: 0, y: 8 })); // true
 * console.log(isEnemyDeploymentZone({ x: 0, y: 7 })); // false
 */
export function isEnemyDeploymentZone(
  pos: Position,
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  return config.enemyRows.includes(pos.y);
}

// =============================================================================
// NEIGHBOR AND MOVEMENT FUNCTIONS
// =============================================================================

/**
 * Get all valid neighboring positions (4-directional).
 * Returns positions for up, down, left, right movement.
 *
 * @param pos - Center position
 * @param config - Grid configuration (defaults to 8×10)
 * @returns Array of valid neighboring positions
 * @example
 * const neighbors = getNeighbors({ x: 1, y: 1 });
 * console.log(neighbors.length); // 4 (all directions valid)
 *
 * const cornerNeighbors = getNeighbors({ x: 0, y: 0 });
 * console.log(cornerNeighbors.length); // 2 (only right and down)
 */
export function getNeighbors(
  pos: Position,
  config: GridConfig = DEFAULT_GRID_CONFIG
): Position[] {
  const neighbors: Position[] = [];

  // 4-directional movement: up, down, left, right
  const directions = [
    { x: 0, y: -1 }, // up
    { x: 0, y: 1 }, // down
    { x: -1, y: 0 }, // left
    { x: 1, y: 0 }, // right
  ];

  for (const dir of directions) {
    const newPos = {
      x: pos.x + dir.x,
      y: pos.y + dir.y,
    };

    if (isValidPosition(newPos, config)) {
      neighbors.push(newPos);
    }
  }

  return neighbors;
}

/**
 * Get all positions within movement range.
 * Returns all positions reachable within the specified number of steps.
 *
 * @param center - Starting position
 * @param range - Maximum movement distance
 * @param grid - Current grid state for walkability
 * @param config - Grid configuration (defaults to 8×10)
 * @returns Array of reachable positions
 * @example
 * const grid = createEmptyGrid();
 * const reachable = getPositionsInMovementRange({ x: 0, y: 0 }, 2, grid);
 */
export function getPositionsInMovementRange(
  center: Position,
  range: number,
  grid: Grid,
  config: GridConfig = DEFAULT_GRID_CONFIG
): Position[] {
  if (range <= 0) return [];

  const visited = new Set<string>();
  const reachable: Position[] = [];
  const queue: Array<{ pos: Position; distance: number }> = [{ pos: center, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const posKey = `${current.pos.x},${current.pos.y}`;
    if (visited.has(posKey)) continue;
    visited.add(posKey);

    if (current.distance > 0) {
      reachable.push(current.pos);
    }

    if (current.distance < range) {
      const neighbors = getNeighbors(current.pos, config);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(neighborKey) && isWalkable(neighbor, grid, config)) {
          queue.push({ pos: neighbor, distance: current.distance + 1 });
        }
      }
    }
  }

  return reachable;
}

// =============================================================================
// DISTANCE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate Manhattan distance between two positions.
 * Manhattan distance = |x1 - x2| + |y1 - y2|
 *
 * @param a - First position
 * @param b - Second position
 * @returns Manhattan distance in grid cells
 * @example
 * const dist = manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
 * console.log(dist); // 7 (3 + 4)
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate Euclidean distance between two positions.
 * Euclidean distance = √((x1 - x2)² + (y1 - y2)²)
 *
 * @param a - First position
 * @param b - Second position
 * @returns Euclidean distance in grid cells
 * @example
 * const dist = euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
 * console.log(dist); // 5.0 (√(9 + 16))
 */
export function euclideanDistance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two positions are within a specified range.
 * Uses Manhattan distance for range calculation.
 *
 * @param a - First position
 * @param b - Second position
 * @param range - Maximum range in cells
 * @returns True if positions are within range
 * @example
 * const inRange = isInRange({ x: 0, y: 0 }, { x: 2, y: 1 }, 3);
 * console.log(inRange); // true (distance = 3, range = 3)
 */
export function isInRange(a: Position, b: Position, range: number): boolean {
  return manhattanDistance(a, b) <= range;
}

// =============================================================================
// UNIT QUERY FUNCTIONS
// =============================================================================

/**
 * Get all units within range of a center position.
 * Uses Manhattan distance for range calculation.
 *
 * @param center - Center position for range check
 * @param range - Maximum range in cells
 * @param units - Array of units to check
 * @returns Array of units within range
 * @example
 * const nearbyUnits = getUnitsInRange({ x: 2, y: 2 }, 2, allUnits);
 */
export function getUnitsInRange<T extends GridUnit>(
  center: Position,
  range: number,
  units: T[]
): T[] {
  return units.filter((unit) => unit.alive && isInRange(center, unit.position, range));
}

/**
 * Get the closest unit to a position.
 * Returns the unit with minimum Manhattan distance.
 *
 * @param center - Reference position
 * @param units - Array of units to check
 * @returns Closest unit or undefined if no units
 * @example
 * const closest = getClosestUnit({ x: 0, y: 0 }, enemyUnits);
 */
export function getClosestUnit<T extends GridUnit>(
  center: Position,
  units: T[]
): T | undefined {
  let closestUnit: T | undefined;
  let minDistance = Infinity;

  for (const unit of units) {
    if (!unit.alive) continue;

    const distance = manhattanDistance(center, unit.position);
    if (distance < minDistance) {
      minDistance = distance;
      closestUnit = unit;
    }
  }

  return closestUnit;
}

/**
 * Get unit at a specific position.
 *
 * @param pos - Position to check
 * @param units - Array of units to search
 * @returns Unit at position or undefined if none
 * @example
 * const unitAtPos = getUnitAtPosition({ x: 0, y: 0 }, allUnits);
 */
export function getUnitAtPosition<T extends GridUnit>(
  pos: Position,
  units: T[]
): T | undefined {
  return units.find(
    (unit) => unit.alive && unit.position.x === pos.x && unit.position.y === pos.y
  );
}


// =============================================================================
// AREA OF EFFECT FUNCTIONS
// =============================================================================

/**
 * Get all positions within an area of effect.
 * Returns positions in a square area around the center.
 *
 * @param center - Center position of AoE
 * @param radius - Radius of effect (0 = single cell, 1 = 3x3 area, etc.)
 * @param config - Grid configuration (defaults to 8×10)
 * @returns Array of positions within AoE
 * @example
 * const aoePositions = getAoEPositions({ x: 2, y: 2 }, 1);
 * console.log(aoePositions.length); // 9 (3x3 area)
 */
export function getAoEPositions(
  center: Position,
  radius: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
): Position[] {
  const positions: Position[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const pos = {
        x: center.x + dx,
        y: center.y + dy,
      };

      if (isValidPosition(pos, config)) {
        positions.push(pos);
      }
    }
  }

  return positions;
}

/**
 * Get all units within an area of effect.
 *
 * @param center - Center position of AoE
 * @param radius - Radius of effect
 * @param units - Array of units to check
 * @param config - Grid configuration (defaults to 8×10)
 * @returns Array of units within AoE
 * @example
 * const affectedUnits = getUnitsInAoE({ x: 2, y: 2 }, 1, allUnits);
 */
export function getUnitsInAoE<T extends GridUnit>(
  center: Position,
  radius: number,
  units: T[],
  config: GridConfig = DEFAULT_GRID_CONFIG
): T[] {
  const aoePositions = getAoEPositions(center, radius, config);
  const affectedUnits: T[] = [];

  for (const pos of aoePositions) {
    const unit = getUnitAtPosition(pos, units);
    if (unit) {
      affectedUnits.push(unit);
    }
  }

  return affectedUnits;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert position to string key for maps and sets.
 *
 * @param pos - Position to convert
 * @returns String representation "x,y"
 * @example
 * const key = positionToKey({ x: 2, y: 3 });
 * console.log(key); // "2,3"
 */
export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Convert string key back to position.
 *
 * @param key - String key in format "x,y"
 * @returns Position object
 * @throws Error if key format is invalid
 * @example
 * const pos = keyToPosition("2,3");
 * console.log(pos); // { x: 2, y: 3 }
 */
export function keyToPosition(key: string): Position {
  const parts = key.split(',').map(Number);
  const x = parts[0];
  const y = parts[1];

  if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
    throw new Error(`Invalid position key: ${key}`);
  }

  return { x, y };
}

/**
 * Check if two positions are equal.
 *
 * @param a - First position
 * @param b - Second position
 * @returns True if positions have same coordinates
 * @example
 * const equal = positionsEqual({ x: 1, y: 2 }, { x: 1, y: 2 });
 * console.log(equal); // true
 */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
