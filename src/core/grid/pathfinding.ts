/**
 * A* pathfinding algorithm for battle engine.
 * Provides optimal pathfinding with obstacle avoidance and unit collision detection.
 *
 * @fileoverview A* pathfinding implementation with priority queue optimization,
 * Manhattan distance heuristic, and deterministic path generation.
 *
 * @module core/grid/pathfinding
 */

import type { Position, Grid } from '../types/grid.types';
import type { GridConfig, PathfindingConfig } from '../types/config.types';
import {
  manhattanDistance,
  isValidPosition,
  getNeighbors,
  positionToKey,
  GridUnit,
  DEFAULT_GRID_CONFIG,
} from './grid';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default pathfinding configuration.
 */
export const DEFAULT_PATHFINDING_CONFIG: PathfindingConfig = {
  maxIterations: 1000,
  movementCost: 1,
  diagonalCost: 1.414,
};

// =============================================================================
// PRIORITY QUEUE IMPLEMENTATION
// =============================================================================

/**
 * Node in the A* pathfinding algorithm.
 * Contains position, costs, and parent reference for path reconstruction.
 */
interface PathNode {
  /** Position on the grid */
  position: Position;
  /** Cost from start (g-cost) */
  gCost: number;
  /** Heuristic cost to goal (h-cost) */
  hCost: number;
  /** Total cost (f-cost = g + h) */
  fCost: number;
  /** Parent node for path reconstruction */
  parent: PathNode | null;
}

/**
 * Priority queue implementation for A* algorithm.
 * Maintains nodes sorted by f-cost for optimal pathfinding performance.
 */
class PriorityQueue {
  private nodes: PathNode[] = [];

  /**
   * Add a node to the priority queue.
   * Maintains heap property with lowest f-cost at front.
   *
   * @param node - Node to add to queue
   */
  enqueue(node: PathNode): void {
    this.nodes.push(node);
    this.bubbleUp(this.nodes.length - 1);
  }

  /**
   * Remove and return the node with lowest f-cost.
   *
   * @returns Node with lowest f-cost or undefined if empty
   */
  dequeue(): PathNode | undefined {
    if (this.nodes.length === 0) return undefined;
    if (this.nodes.length === 1) return this.nodes.pop();

    const result = this.nodes[0];
    const last = this.nodes.pop();
    if (last && this.nodes.length > 0) {
      this.nodes[0] = last;
      this.bubbleDown(0);
    }
    return result;
  }

  /**
   * Check if the priority queue is empty.
   *
   * @returns True if queue has no nodes
   */
  isEmpty(): boolean {
    return this.nodes.length === 0;
  }

  /**
   * Get the number of nodes in the queue.
   *
   * @returns Number of nodes in queue
   */
  size(): number {
    return this.nodes.length;
  }

  /**
   * Bubble up a node to maintain heap property.
   *
   * @param index - Index of node to bubble up
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.nodes[index];
      const parent = this.nodes[parentIndex];

      if (!current || !parent || current.fCost >= parent.fCost) break;

      // Swap with parent
      this.nodes[index] = parent;
      this.nodes[parentIndex] = current;
      index = parentIndex;
    }
  }

  /**
   * Bubble down a node to maintain heap property.
   *
   * @param index - Index of node to bubble down
   */
  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      const current = this.nodes[index];
      const left = this.nodes[leftChild];
      const right = this.nodes[rightChild];

      if (left && left.fCost < (current?.fCost ?? Infinity)) {
        smallest = leftChild;
      }

      const smallestNode = this.nodes[smallest];
      if (right && right.fCost < (smallestNode?.fCost ?? Infinity)) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      // Swap with smallest child
      const temp = this.nodes[index];
      const smallestTemp = this.nodes[smallest];
      if (temp && smallestTemp) {
        this.nodes[index] = smallestTemp;
        this.nodes[smallest] = temp;
      }
      index = smallest;
    }
  }
}

// =============================================================================
// PATHFINDING UTILITIES
// =============================================================================

/**
 * Check if a position is walkable for pathfinding.
 * Considers grid bounds, cell types, and unit positions.
 *
 * @param pos - Position to check
 * @param grid - Current grid state
 * @param units - Array of units that block movement
 * @param excludeUnit - Unit to exclude from collision (usually the moving unit)
 * @param config - Grid configuration
 * @returns True if position can be moved to
 */
function isWalkableForPathfinding<T extends GridUnit>(
  pos: Position,
  grid: Grid,
  units: T[],
  excludeUnit: T | undefined,
  config: GridConfig
): boolean {
  // Check grid bounds
  if (!isValidPosition(pos, config)) {
    return false;
  }

  // Check grid cell type
  const row = grid[pos.y];
  if (!row) return false;

  const cell = row[pos.x];
  if (!cell || cell.type === 'blocked') {
    return false;
  }

  // Check for unit collision (excluding the moving unit)
  for (const unit of units) {
    if (!unit.alive) continue;
    if (excludeUnit && unit.instanceId === excludeUnit.instanceId) continue;

    if (unit.position.x === pos.x && unit.position.y === pos.y) {
      return false; // Position occupied by another unit
    }
  }

  return true;
}

/**
 * Create a path node for A* algorithm.
 *
 * @param position - Grid position
 * @param gCost - Cost from start
 * @param hCost - Heuristic cost to goal
 * @param parent - Parent node for path reconstruction
 * @returns New path node
 */
function createPathNode(
  position: Position,
  gCost: number,
  hCost: number,
  parent: PathNode | null = null
): PathNode {
  return {
    position,
    gCost,
    hCost,
    fCost: gCost + hCost,
    parent,
  };
}

/**
 * Reconstruct path from goal node to start.
 *
 * @param goalNode - Final node in the path
 * @returns Array of positions from start to goal
 */
function reconstructPath(goalNode: PathNode): Position[] {
  const path: Position[] = [];
  let current: PathNode | null = goalNode;

  while (current) {
    path.unshift(current.position);
    current = current.parent;
  }

  return path;
}


// =============================================================================
// A* PATHFINDING ALGORITHM
// =============================================================================

/**
 * Find optimal path using A* algorithm.
 * Uses Manhattan distance heuristic and considers unit collisions.
 *
 * @param start - Starting position
 * @param goal - Target position
 * @param grid - Current grid state
 * @param units - Array of units that can block movement
 * @param movingUnit - The unit that is moving (excluded from collision)
 * @param gridConfig - Grid configuration (defaults to 8×10)
 * @param pathConfig - Pathfinding configuration
 * @returns Array of positions forming the path, empty if no path found
 * @example
 * const path = findPath(
 *   { x: 0, y: 0 },
 *   { x: 3, y: 3 },
 *   grid,
 *   allUnits,
 *   currentUnit
 * );
 * if (path.length > 0) {
 *   console.log(`Path found with ${path.length} steps`);
 * }
 */
export function findPath<T extends GridUnit>(
  start: Position,
  goal: Position,
  grid: Grid,
  units: T[],
  movingUnit?: T,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
  pathConfig: PathfindingConfig = DEFAULT_PATHFINDING_CONFIG
): Position[] {
  // Validate inputs
  if (!isValidPosition(start, gridConfig) || !isValidPosition(goal, gridConfig)) {
    return [];
  }

  // If start equals goal, return path with just the start position
  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }

  // Check if goal is reachable
  if (!isWalkableForPathfinding(goal, grid, units, movingUnit, gridConfig)) {
    return [];
  }

  // Initialize data structures
  const openSet = new PriorityQueue();
  const closedSet = new Set<string>();
  const gScores = new Map<string, number>();

  // Add start node to open set
  const startNode = createPathNode(start, 0, manhattanDistance(start, goal));
  openSet.enqueue(startNode);
  gScores.set(positionToKey(start), 0);

  let iterations = 0;

  // Main A* loop
  while (!openSet.isEmpty() && iterations < pathConfig.maxIterations) {
    iterations++;

    const current = openSet.dequeue();
    if (!current) break;

    const currentKey = positionToKey(current.position);

    // Skip if already processed
    if (closedSet.has(currentKey)) {
      continue;
    }

    // Mark as processed
    closedSet.add(currentKey);

    // Check if we reached the goal
    if (current.position.x === goal.x && current.position.y === goal.y) {
      return reconstructPath(current);
    }

    // Explore neighbors
    const neighbors = getNeighbors(current.position, gridConfig);

    for (const neighborPos of neighbors) {
      const neighborKey = positionToKey(neighborPos);

      // Skip if already processed
      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Skip if not walkable
      if (!isWalkableForPathfinding(neighborPos, grid, units, movingUnit, gridConfig)) {
        continue;
      }

      // Calculate costs
      const tentativeGCost = current.gCost + pathConfig.movementCost;
      const existingGCost = gScores.get(neighborKey) ?? Infinity;

      // Skip if we found a worse path
      if (tentativeGCost >= existingGCost) {
        continue;
      }

      // Record this path as the best so far
      gScores.set(neighborKey, tentativeGCost);

      const hCost = manhattanDistance(neighborPos, goal);
      const neighborNode = createPathNode(neighborPos, tentativeGCost, hCost, current);

      openSet.enqueue(neighborNode);
    }
  }

  // No path found
  return [];
}

/**
 * Find path with maximum length constraint.
 * Useful for movement with limited range.
 *
 * @param start - Starting position
 * @param goal - Target position
 * @param maxLength - Maximum path length (including start)
 * @param grid - Current grid state
 * @param units - Array of units that can block movement
 * @param movingUnit - The unit that is moving (excluded from collision)
 * @param gridConfig - Grid configuration
 * @param pathConfig - Pathfinding configuration
 * @returns Array of positions forming the path, empty if no path found or too long
 * @example
 * const path = findPathWithMaxLength(
 *   { x: 0, y: 0 },
 *   { x: 5, y: 5 },
 *   3, // Maximum 3 steps
 *   grid,
 *   allUnits,
 *   currentUnit
 * );
 */
export function findPathWithMaxLength<T extends GridUnit>(
  start: Position,
  goal: Position,
  maxLength: number,
  grid: Grid,
  units: T[],
  movingUnit?: T,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
  pathConfig: PathfindingConfig = DEFAULT_PATHFINDING_CONFIG
): Position[] {
  const fullPath = findPath(start, goal, grid, units, movingUnit, gridConfig, pathConfig);

  if (fullPath.length === 0 || fullPath.length > maxLength) {
    return [];
  }

  return fullPath;
}

/**
 * Find the closest reachable position to a target.
 * Useful when the exact target is unreachable.
 *
 * @param start - Starting position
 * @param target - Desired target position
 * @param maxRange - Maximum search range
 * @param grid - Current grid state
 * @param units - Array of units that can block movement
 * @param movingUnit - The unit that is moving (excluded from collision)
 * @param gridConfig - Grid configuration
 * @param pathConfig - Pathfinding configuration
 * @returns Closest reachable position or start if none found
 * @example
 * const closest = findClosestReachablePosition(
 *   { x: 0, y: 0 },
 *   { x: 5, y: 5 }, // Target might be blocked
 *   4, // Search within 4 cells
 *   grid,
 *   allUnits,
 *   currentUnit
 * );
 */
export function findClosestReachablePosition<T extends GridUnit>(
  start: Position,
  target: Position,
  maxRange: number,
  grid: Grid,
  units: T[],
  movingUnit?: T,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
  pathConfig: PathfindingConfig = DEFAULT_PATHFINDING_CONFIG
): Position {
  let closestPosition = start;
  let closestDistance = manhattanDistance(start, target);

  // Search in expanding rings around the target
  for (let range = 0; range <= maxRange; range++) {
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        // Only check positions on the current ring
        if (Math.abs(dx) !== range && Math.abs(dy) !== range && range > 0) {
          continue;
        }

        const candidate = {
          x: target.x + dx,
          y: target.y + dy,
        };

        // Skip if not valid or not walkable
        if (
          !isValidPosition(candidate, gridConfig) ||
          !isWalkableForPathfinding(candidate, grid, units, movingUnit, gridConfig)
        ) {
          continue;
        }

        // Check if we can reach this position
        const path = findPath(start, candidate, grid, units, movingUnit, gridConfig, pathConfig);
        if (path.length === 0) continue;

        // Check if this is closer to the target
        const distanceToTarget = manhattanDistance(candidate, target);
        if (distanceToTarget < closestDistance) {
          closestDistance = distanceToTarget;
          closestPosition = candidate;
        }
      }
    }

    // If we found a reachable position, return it
    if (closestPosition.x !== start.x || closestPosition.y !== start.y) {
      break;
    }
  }

  return closestPosition;
}

/**
 * Check if a path exists between two positions.
 * More efficient than findPath when you only need to know if path exists.
 *
 * @param start - Starting position
 * @param goal - Target position
 * @param grid - Current grid state
 * @param units - Array of units that can block movement
 * @param movingUnit - The unit that is moving (excluded from collision)
 * @param gridConfig - Grid configuration
 * @param pathConfig - Pathfinding configuration
 * @returns True if a path exists
 * @example
 * if (hasPath(unitPos, targetPos, grid, allUnits, unit)) {
 *   // Plan movement
 * } else {
 *   // Find alternative target
 * }
 */
export function hasPath<T extends GridUnit>(
  start: Position,
  goal: Position,
  grid: Grid,
  units: T[],
  movingUnit?: T,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
  pathConfig: PathfindingConfig = DEFAULT_PATHFINDING_CONFIG
): boolean {
  const path = findPath(start, goal, grid, units, movingUnit, gridConfig, pathConfig);
  return path.length > 0;
}
