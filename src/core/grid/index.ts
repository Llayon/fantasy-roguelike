/**
 * Core grid module barrel export.
 * @module core/grid
 */

// Grid utilities
export {
  DEFAULT_GRID_CONFIG,
  createEmptyGrid,
  createGridWithUnits,
  isValidPosition,
  isWalkable,
  isPlayerDeploymentZone,
  isEnemyDeploymentZone,
  getNeighbors,
  getPositionsInMovementRange,
  manhattanDistance,
  euclideanDistance,
  isInRange,
  getUnitsInRange,
  getClosestUnit,
  getUnitAtPosition,
  getAoEPositions,
  getUnitsInAoE,
  positionToKey,
  keyToPosition,
  positionsEqual,
} from './grid';

export type { GridUnit } from './grid';

// Pathfinding
export {
  DEFAULT_PATHFINDING_CONFIG,
  findPath,
  findPathWithMaxLength,
  findClosestReachablePosition,
  hasPath,
} from './pathfinding';
