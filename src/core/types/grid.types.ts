/**
 * Grid-related type definitions for the core battle engine.
 * These types are game-agnostic and can be used across different projects.
 *
 * @module core/types/grid
 */

/**
 * 2D position on the battlefield grid.
 * Uses zero-based indexing.
 *
 * @example
 * const pos: Position = { x: 3, y: 5 };
 */
export interface Position {
  /** X coordinate (column) */
  x: number;
  /** Y coordinate (row) */
  y: number;
}

/**
 * Grid cell state enumeration.
 */
export type CellType = 'empty' | 'occupied' | 'blocked';

/**
 * Grid cell information.
 */
export interface GridCell {
  /** Cell position */
  position: Position;
  /** Cell state */
  type: CellType;
  /** Unit occupying this cell (if any) */
  unitId?: string;
}

/**
 * 2D grid represented as array of arrays.
 */
export type Grid = GridCell[][];

/**
 * Pathfinding node for A* algorithm.
 */
export interface PathNode {
  /** Node position */
  position: Position;
  /** Cost from start (g-score) */
  gCost: number;
  /** Heuristic cost to goal (h-score) */
  hCost: number;
  /** Total cost (f-score = g + h) */
  fCost: number;
  /** Parent node for path reconstruction */
  parent?: PathNode;
}

/**
 * Pathfinding result.
 */
export interface PathfindingResult {
  /** Path as array of positions (empty if not found) */
  path: Position[];
  /** Whether path was found */
  found: boolean;
  /** Path length in cells */
  length: number;
  /** Total movement cost */
  cost: number;
}
