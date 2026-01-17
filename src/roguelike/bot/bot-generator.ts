/**
 * Bot team generator for roguelike mode.
 * Generates deterministic bot teams with difficulty scaling.
 *
 * Responsibilities:
 * - Generate valid unit compositions within budget constraints
 * - Scale difficulty based on run progress (wins count)
 * - Ensure balanced team composition (mix of roles)
 * - Use seeded random for determinism
 * - Place units in enemy deployment zone
 *
 * @module roguelike/bot
 */

import { Logger } from '@nestjs/common';
import { SeededRandom } from '../../core/utils/random';
import { TeamSetup, TeamSetupUnit, Position } from '../../core/types';
import { UNIT_TEMPLATES } from '../../game/units/unit.data';
import { UNIT_ROLES, UnitRole, TEAM_LIMITS } from '../../game/constants/game.constants';

/**
 * Configuration for bot team generation.
 */
export interface BotGenerationConfig {
  /** Difficulty level (1-10) */
  difficulty: number;
  /** Run stage (1-9) */
  stage: number;
  /** Random seed for determinism */
  seed: number;
}

/**
 * Bot team generator.
 * Generates deterministic bot teams with difficulty scaling.
 *
 * @example
 * const generator = new BotTeamGenerator();
 * const team = generator.generateTeam({
 *   difficulty: 5,
 *   stage: 3,
 *   seed: 12345
 * });
 */
export class BotTeamGenerator {
  private readonly logger = new Logger(BotTeamGenerator.name);

  /**
   * Generate a bot team with given configuration.
   *
   * Strategy:
   * 1. Calculate budget based on difficulty
   * 2. Determine unit count based on difficulty
   * 3. Select units ensuring role diversity
   * 4. Generate positions in enemy deployment zone
   * 5. Validate team composition
   *
   * @param config - Bot generation configuration
   * @returns Team setup with units and positions
   *
   * @example
   * const team = generator.generateTeam({
   *   difficulty: 3,
   *   stage: 2,
   *   seed: 54321
   * });
   * // Returns: { units: [...], positions: [...] }
   */
  generateTeam(config: BotGenerationConfig): TeamSetup {
    const rng = new SeededRandom(config.seed);

    // Calculate budget: 10 at difficulty 1, 30 at difficulty 10
    const budget = this.calculateBudget(config.difficulty);

    // Determine unit count: 3-4 at difficulty 1, 7-8 at difficulty 10
    const unitCount = this.calculateUnitCount(config.difficulty, rng);

    this.logger.debug('Generating bot team', {
      difficulty: config.difficulty,
      stage: config.stage,
      budget,
      unitCount,
    });

    // Select units with role diversity
    const units = this.selectUnits(budget, unitCount, rng);

    // Generate positions in enemy deployment zone (rows 8-9)
    const positions = this.generatePositions(units.length, rng);

    // Validate team
    this.validateTeam(units, positions, budget);

    this.logger.debug('Bot team generated successfully', {
      unitCount: units.length,
      totalCost: units.reduce((sum, u) => {
        const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
        return sum + (template?.cost || 0);
      }, 0),
      roles: this.getRoleDistribution(units),
    });

    return { units, positions };
  }

  /**
   * Calculate budget based on difficulty.
   *
   * Formula: 10 + (difficulty - 1) * (20 / 9)
   * - Difficulty 1: 10 budget
   * - Difficulty 5: 20 budget
   * - Difficulty 10: 30 budget
   *
   * @param difficulty - Difficulty level (1-10)
   * @returns Budget in points
   *
   * @internal
   */
  private calculateBudget(difficulty: number): number {
    const normalized = Math.max(1, Math.min(10, difficulty));
    return Math.round(10 + (normalized - 1) * (20 / 9));
  }

  /**
   * Calculate unit count based on difficulty.
   *
   * Formula: minUnits + random(0, maxUnits - minUnits)
   * - Difficulty 1: 3-4 units
   * - Difficulty 5: 5-6 units
   * - Difficulty 10: 7-8 units
   *
   * @param difficulty - Difficulty level (1-10)
   * @param rng - Seeded random number generator
   * @returns Unit count
   *
   * @internal
   */
  private calculateUnitCount(difficulty: number, rng: SeededRandom): number {
    const normalized = Math.max(1, Math.min(10, difficulty));
    const minUnits = Math.ceil(3 + (normalized - 1) * (4 / 9));
    const maxUnits = Math.ceil(4 + (normalized - 1) * (4 / 9));
    return minUnits + Math.floor(rng.next() * (maxUnits - minUnits + 1));
  }

  /**
   * Select units ensuring role diversity and budget constraints.
   *
   * Strategy:
   * 1. Try to select one unit from each role (balanced composition)
   * 2. Fill remaining slots with random units
   * 3. Respect budget constraints
   * 4. Ensure at least one tank and one DPS
   *
   * @param budget - Total budget in points
   * @param targetCount - Target number of units
   * @param rng - Seeded random number generator
   * @returns Array of team setup units
   *
   * @internal
   */
  private selectUnits(budget: number, targetCount: number, rng: SeededRandom): TeamSetupUnit[] {
    const units: TeamSetupUnit[] = [];
    let remainingBudget = budget;

    // Get all available units
    const allUnits = Object.values(UNIT_TEMPLATES);

    // Group units by role
    const unitsByRole = this.groupUnitsByRole(allUnits);

    // Try to select one unit from each role for diversity
    const roles = Object.keys(unitsByRole) as UnitRole[];
    for (const role of roles) {
      if (units.length >= targetCount || remainingBudget <= 0) {
        break;
      }

      const roleUnits = unitsByRole[role];
      const validUnits = roleUnits.filter((u) => u.cost <= remainingBudget);

      if (validUnits.length > 0) {
        const selected = validUnits[Math.floor(rng.next() * validUnits.length)];
        units.push({
          unitId: selected.id,
          tier: 1,
        });
        remainingBudget -= selected.cost;
      }
    }

    // Fill remaining slots with random units
    while (units.length < targetCount && remainingBudget > 0) {
      const validUnits = allUnits.filter((u) => u.cost <= remainingBudget);

      if (validUnits.length === 0) {
        break;
      }

      const selected = validUnits[Math.floor(rng.next() * validUnits.length)];
      units.push({
        unitId: selected.id,
        tier: 1,
      });
      remainingBudget -= selected.cost;
    }

    // Ensure at least one tank
    const hasTank = units.some((u) => {
      const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
      return template?.role === UNIT_ROLES.TANK;
    });

    if (!hasTank && allUnits.length > 0) {
      const tanks = allUnits.filter((u) => u.role === UNIT_ROLES.TANK);
      if (tanks.length > 0) {
        const cheapestTank = tanks.reduce((prev, curr) => (prev.cost < curr.cost ? prev : curr));
        if (units.length > 0) {
          units[0] = {
            unitId: cheapestTank.id,
            tier: 1,
          };
        }
      }
    }

    return units;
  }

  /**
   * Group units by role.
   *
   * @param units - Array of unit templates
   * @returns Units grouped by role
   *
   * @internal
   */
  private groupUnitsByRole(
    units: (typeof UNIT_TEMPLATES)[keyof typeof UNIT_TEMPLATES][],
  ): Record<UnitRole, (typeof UNIT_TEMPLATES)[keyof typeof UNIT_TEMPLATES][]> {
    const grouped: Record<UnitRole, (typeof UNIT_TEMPLATES)[keyof typeof UNIT_TEMPLATES][]> = {
      [UNIT_ROLES.TANK]: [],
      [UNIT_ROLES.MELEE_DPS]: [],
      [UNIT_ROLES.RANGED_DPS]: [],
      [UNIT_ROLES.MAGE]: [],
      [UNIT_ROLES.SUPPORT]: [],
      [UNIT_ROLES.CONTROL]: [],
    };

    for (const unit of units) {
      if (grouped[unit.role]) {
        grouped[unit.role].push(unit);
      }
    }

    return grouped;
  }

  /**
   * Generate positions in enemy deployment zone.
   *
   * Enemy deployment zone: rows 8-9, columns 0-7
   * Positions are randomized to avoid predictable patterns.
   *
   * @param unitCount - Number of units to position
   * @param rng - Seeded random number generator
   * @returns Array of positions
   *
   * @internal
   */
  private generatePositions(unitCount: number, rng: SeededRandom): Position[] {
    const positions: Position[] = [];
    const occupied = new Set<string>();

    for (let i = 0; i < unitCount; i++) {
      let position: Position;
      let attempts = 0;
      const maxAttempts = 10;

      // Try to find an unoccupied position
      do {
        position = {
          x: Math.floor(rng.next() * 8), // Columns 0-7
          y: 8 + Math.floor(rng.next() * 2), // Rows 8-9
        };
        attempts++;
      } while (occupied.has(`${position.x},${position.y}`) && attempts < maxAttempts);

      positions.push(position);
      occupied.add(`${position.x},${position.y}`);
    }

    return positions;
  }

  /**
   * Validate team composition.
   *
   * Checks:
   * - All units are valid
   * - Total cost does not exceed budget
   * - Positions are valid
   * - Unit count matches position count
   *
   * @param units - Team units
   * @param positions - Unit positions
   * @param budget - Budget constraint
   * @throws Error if validation fails
   *
   * @internal
   */
  private validateTeam(units: TeamSetupUnit[], positions: Position[], budget: number): void {
    // Check unit count matches position count
    if (units.length !== positions.length) {
      throw new Error(
        `Unit count (${units.length}) does not match position count (${positions.length})`,
      );
    }

    // Check all units are valid
    for (const unit of units) {
      const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
      if (!template) {
        throw new Error(`Invalid unit ID: ${unit.unitId}`);
      }

      if (unit.tier < 1 || unit.tier > 3) {
        throw new Error(`Invalid tier: ${unit.tier}`);
      }
    }

    // Check total cost does not exceed budget
    const totalCost = units.reduce((sum, u) => {
      const template = UNIT_TEMPLATES[u.unitId as keyof typeof UNIT_TEMPLATES];
      return sum + (template?.cost || 0);
    }, 0);

    if (totalCost > budget) {
      throw new Error(`Total cost (${totalCost}) exceeds budget (${budget})`);
    }

    // Check positions are valid
    for (const pos of positions) {
      if (pos.x < 0 || pos.x >= 8 || pos.y < 8 || pos.y >= 10) {
        throw new Error(
          `Invalid position: (${pos.x}, ${pos.y}). Must be in enemy deployment zone (0-7, 8-9)`,
        );
      }
    }
  }

  /**
   * Get role distribution of team.
   *
   * @param units - Team units
   * @returns Role distribution as object
   *
   * @internal
   */
  private getRoleDistribution(units: TeamSetupUnit[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const unit of units) {
      const template = UNIT_TEMPLATES[unit.unitId as keyof typeof UNIT_TEMPLATES];
      if (template) {
        distribution[template.role] = (distribution[template.role] || 0) + 1;
      }
    }

    return distribution;
  }
}

/**
 * Create a bot team generator instance.
 *
 * @returns New BotTeamGenerator instance
 *
 * @example
 * const generator = createBotTeamGenerator();
 * const team = generator.generateTeam({
 *   difficulty: 5,
 *   stage: 3,
 *   seed: 12345
 * });
 */
export function createBotTeamGenerator(): BotTeamGenerator {
  return new BotTeamGenerator();
}
