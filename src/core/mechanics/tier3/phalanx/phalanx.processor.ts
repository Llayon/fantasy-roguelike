/**
 * Tier 3: Phalanx Processor
 *
 * Implements the phalanx (formation) system which provides defensive bonuses
 * to units in tight formations. Units gain armor and resolve bonuses
 * based on the number of adjacent allies facing the same direction.
 *
 * Phalanx requires the facing mechanic (Tier 0) to be enabled,
 * as formation alignment depends on unit facing direction.
 *
 * Key mechanics:
 * - Formation detection: Units with adjacent allies facing same direction
 * - Armor bonus: +2 per adjacent ally (max +6 with 3 allies)
 * - Resolve bonus: +3 per adjacent ally (max +9)
 * - Recalculation: Bonuses update after casualties
 *
 * @module core/mechanics/tier3/phalanx
 */

import type { BattleState, BattleUnit, Position } from '../../../types';
import type { PhalanxConfig } from '../../config/mechanics.types';
import type {
  PhalanxProcessor,
  UnitWithPhalanx,
  PhalanxEligibility,
  FormationDetectionResult,
  PhalanxBonusResult,
  PhalanxRecalculationResult,
  PhalanxFormationState,
  RecalculationTrigger,
  AdjacentAlly,
} from './phalanx.types';
import {
  PHALANX_TAG,
  PHALANX_IMMUNE_TAG,
  ORTHOGONAL_OFFSETS,
  DEFAULT_MAX_ARMOR_BONUS,
  DEFAULT_MAX_RESOLVE_BONUS,
  DEFAULT_ARMOR_PER_ALLY,
  DEFAULT_RESOLVE_PER_ALLY,
  MAX_ADJACENT_ALLIES,
} from './phalanx.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the phalanx tag.
 */
function hasPhalanxTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(PHALANX_TAG) ?? false;
}

/**
 * Checks if a unit has the phalanx immunity tag.
 */
function hasImmunityTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(PHALANX_IMMUNE_TAG) ?? false;
}

/**
 * Checks if a unit is alive.
 */
function isUnitAlive(unit: BattleUnit): boolean {
  return unit.currentHp > 0 && unit.alive !== false;
}

/**
 * Gets the unit's unique identifier.
 */
function getUnitId(unit: BattleUnit): string {
  return unit.instanceId ?? unit.id;
}

/**
 * Gets the unit's team.
 */
function getUnitTeam(unit: BattleUnit): string {
  return String(unit.team ?? '');
}

/**
 * Checks if two units are on the same team.
 */
function isSameTeam(unit1: BattleUnit, unit2: BattleUnit): boolean {
  return getUnitTeam(unit1) === getUnitTeam(unit2);
}

/**
 * Gets the unit's base armor value.
 */
function getBaseArmor(unit: BattleUnit): number {
  const phalanxProps = unit as unknown as UnitWithPhalanx;
  if (phalanxProps.baseArmor !== undefined) {
    return phalanxProps.baseArmor;
  }
  return unit.stats?.armor ?? 0;
}

/**
 * Gets the unit's base resolve value.
 */
function getBaseResolve(unit: BattleUnit, defaultResolve = 100): number {
  const phalanxProps = unit as unknown as UnitWithPhalanx;
  if (phalanxProps.baseResolve !== undefined) {
    return phalanxProps.baseResolve;
  }
  return unit.resolve ?? defaultResolve;
}

/**
 * Determines formation state based on adjacent ally count.
 */
function determineFormationState(adjacentCount: number): PhalanxFormationState {
  if (adjacentCount === 0) return 'none';
  if (adjacentCount >= MAX_ADJACENT_ALLIES) return 'full';
  return 'partial';
}

/**
 * Gets phalanx-specific properties from a unit.
 */
function getPhalanxProps(unit: BattleUnit): Partial<UnitWithPhalanx> {
  return unit as unknown as Partial<UnitWithPhalanx>;
}

/**
 * Creates an updated unit with phalanx properties.
 */
function withPhalanxProps(
  unit: BattleUnit,
  phalanxProps: Partial<UnitWithPhalanx>,
): BattleUnit & UnitWithPhalanx {
  return { ...unit, ...phalanxProps } as BattleUnit & UnitWithPhalanx;
}

/**
 * Updates units in state immutably.
 */
function updateUnits(state: BattleState, updatedUnits: BattleUnit[]): BattleState {
  const unitMap = new Map(updatedUnits.map((u) => [getUnitId(u), u]));
  return {
    ...state,
    units: state.units.map((u) => unitMap.get(getUnitId(u)) ?? u),
  };
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a phalanx processor instance.
 *
 * The phalanx processor handles:
 * - Checking if units can join phalanx formations
 * - Detecting adjacent allies for formation
 * - Calculating armor and resolve bonuses
 * - Recalculating bonuses after state changes
 *
 * @param config - Phalanx configuration with bonus settings
 * @returns PhalanxProcessor instance
 *
 * @example
 * const processor = createPhalanxProcessor({
 *   maxArmorBonus: 6,
 *   maxResolveBonus: 9,
 *   armorPerAlly: 2,
 *   resolvePerAlly: 3,
 * });
 *
 * // Check if unit can join phalanx
 * const eligibility = processor.canJoinPhalanx(spearman);
 *
 * // Detect formation for a unit
 * const detection = processor.detectFormation(spearman, state);
 */
export function createPhalanxProcessor(config: PhalanxConfig): PhalanxProcessor {
  const maxArmorBonus = config.maxArmorBonus ?? DEFAULT_MAX_ARMOR_BONUS;
  const maxResolveBonus = config.maxResolveBonus ?? DEFAULT_MAX_RESOLVE_BONUS;
  const armorPerAlly = config.armorPerAlly ?? DEFAULT_ARMOR_PER_ALLY;
  const resolvePerAlly = config.resolvePerAlly ?? DEFAULT_RESOLVE_PER_ALLY;

  return {
    /**
     * Checks if a unit can join a phalanx formation.
     */
    canJoinPhalanx(unit: BattleUnit & UnitWithPhalanx): PhalanxEligibility {
      const baseUnit = unit as BattleUnit;

      if (!isUnitAlive(baseUnit)) {
        return {
          canJoinPhalanx: false,
          reason: 'dead',
          hasTag: hasPhalanxTag(baseUnit),
          isAlive: false,
        };
      }

      if (hasImmunityTag(baseUnit)) {
        return {
          canJoinPhalanx: false,
          reason: 'immune_tag',
          hasTag: hasPhalanxTag(baseUnit),
          isAlive: true,
        };
      }

      if (!hasPhalanxTag(baseUnit)) {
        return {
          canJoinPhalanx: false,
          reason: 'no_phalanx_tag',
          hasTag: false,
          isAlive: true,
        };
      }

      if (!baseUnit.facing) {
        return {
          canJoinPhalanx: false,
          reason: 'no_facing',
          hasTag: true,
          isAlive: true,
        };
      }

      return {
        canJoinPhalanx: true,
        hasTag: true,
        isAlive: true,
      };
    },

    /**
     * Detects adjacent allies for formation.
     */
    detectFormation(
      unit: BattleUnit & UnitWithPhalanx,
      state: BattleState,
    ): FormationDetectionResult {
      const baseUnit = unit as BattleUnit;
      const position = baseUnit.position;
      const facing = baseUnit.facing;

      if (!position || !facing) {
        return {
          adjacentAllies: [],
          alignedAllies: [],
          totalAdjacent: 0,
          alignedCount: 0,
          canFormPhalanx: false,
        };
      }

      const adjacentAllies: AdjacentAlly[] = [];
      const alignedAllies: AdjacentAlly[] = [];

      for (const offset of ORTHOGONAL_OFFSETS) {
        const neighborPos: Position = {
          x: position.x + offset.dx,
          y: position.y + offset.dy,
        };

        const neighbor = state.units.find(
          (u) => u.position && u.position.x === neighborPos.x && u.position.y === neighborPos.y,
        );

        if (
          neighbor &&
          isUnitAlive(neighbor) &&
          isSameTeam(baseUnit, neighbor) &&
          getUnitId(neighbor) !== getUnitId(baseUnit)
        ) {
          const neighborFacing = neighbor.facing;
          const facingAligned = neighborFacing === facing;

          const allyInfo: AdjacentAlly = {
            unit: neighbor as BattleUnit & UnitWithPhalanx,
            position: neighborPos,
            direction: offset.direction,
            facingAligned,
          };

          adjacentAllies.push(allyInfo);

          if (facingAligned && hasPhalanxTag(neighbor)) {
            alignedAllies.push(allyInfo);
          }
        }
      }

      return {
        adjacentAllies,
        alignedAllies,
        totalAdjacent: adjacentAllies.length,
        alignedCount: alignedAllies.length,
        canFormPhalanx: alignedAllies.length > 0,
      };
    },

    /**
     * Calculates phalanx bonuses based on adjacent ally count.
     *
     * Formulas:
     * - armorBonus = min(maxArmorBonus, adjacentCount * armorPerAlly)
     * - resolveBonus = min(maxResolveBonus, adjacentCount * resolvePerAlly)
     */
    calculateBonuses(adjacentCount: number, phalanxConfig: PhalanxConfig): PhalanxBonusResult {
      const cfgMaxArmor = phalanxConfig.maxArmorBonus ?? maxArmorBonus;
      const cfgMaxResolve = phalanxConfig.maxResolveBonus ?? maxResolveBonus;
      const cfgArmorPerAlly = phalanxConfig.armorPerAlly ?? armorPerAlly;
      const cfgResolvePerAlly = phalanxConfig.resolvePerAlly ?? resolvePerAlly;

      const rawArmorBonus = adjacentCount * cfgArmorPerAlly;
      const rawResolveBonus = adjacentCount * cfgResolvePerAlly;

      const armorBonusCapped = Math.min(cfgMaxArmor, rawArmorBonus);
      const resolveBonusCapped = Math.min(cfgMaxResolve, rawResolveBonus);

      return {
        armorBonus: armorBonusCapped,
        resolveBonus: resolveBonusCapped,
        adjacentCount,
        formationState: determineFormationState(adjacentCount),
        cappedArmor: rawArmorBonus > cfgMaxArmor,
        cappedResolve: rawResolveBonus > cfgMaxResolve,
        rawArmorBonus,
        rawResolveBonus,
      };
    },

    /**
     * Gets the effective armor for a unit including phalanx bonus.
     */
    getEffectiveArmor(unit: BattleUnit & UnitWithPhalanx): number {
      const baseUnit = unit as BattleUnit;
      const phalanxProps = getPhalanxProps(baseUnit);
      const base = getBaseArmor(baseUnit);
      const bonus = phalanxProps.phalanxArmorBonus ?? 0;
      return base + bonus;
    },

    /**
     * Gets the effective resolve for a unit including phalanx bonus.
     */
    getEffectiveResolve(unit: BattleUnit & UnitWithPhalanx): number {
      const baseUnit = unit as BattleUnit;
      const phalanxProps = getPhalanxProps(baseUnit);
      const base = getBaseResolve(baseUnit);
      const bonus = phalanxProps.phalanxResolveBonus ?? 0;
      return base + bonus;
    },

    /**
     * Updates phalanx state for a single unit.
     */
    updateUnitPhalanx(
      unit: BattleUnit & UnitWithPhalanx,
      state: BattleState,
      phalanxConfig: PhalanxConfig,
    ): BattleUnit & UnitWithPhalanx {
      const baseUnit = unit as BattleUnit;

      const eligibility = this.canJoinPhalanx(unit);

      if (!eligibility.canJoinPhalanx) {
        return this.clearPhalanx(unit);
      }

      const detection = this.detectFormation(unit, state);

      if (!detection.canFormPhalanx) {
        return this.clearPhalanx(unit);
      }

      const bonuses = this.calculateBonuses(detection.alignedCount, phalanxConfig);

      const phalanxProps = getPhalanxProps(baseUnit);
      const baseArmor = phalanxProps.baseArmor ?? getBaseArmor(baseUnit);
      const baseResolve = phalanxProps.baseResolve ?? getBaseResolve(baseUnit);

      return withPhalanxProps(baseUnit, {
        canFormPhalanx: true,
        inPhalanx: true,
        phalanxState: bonuses.formationState,
        adjacentAlliesCount: detection.alignedCount,
        adjacentAllyIds: detection.alignedAllies.map((a) => getUnitId(a.unit as BattleUnit)),
        phalanxArmorBonus: bonuses.armorBonus,
        phalanxResolveBonus: bonuses.resolveBonus,
        baseArmor,
        baseResolve,
      });
    },

    /**
     * Recalculates phalanx bonuses for all units.
     */
    recalculate(state: BattleState, _trigger: RecalculationTrigger): PhalanxRecalculationResult {
      const unitsUpdated: string[] = [];
      let formationsChanged = 0;
      let totalArmorBonusChange = 0;
      let totalResolveBonusChange = 0;

      const updatedUnits: BattleUnit[] = [];

      for (const unit of state.units) {
        const phalanxProps = getPhalanxProps(unit);
        const previousArmorBonus = phalanxProps.phalanxArmorBonus ?? 0;
        const previousResolveBonus = phalanxProps.phalanxResolveBonus ?? 0;
        const wasInPhalanx = phalanxProps.inPhalanx ?? false;

        const updatedUnit = this.updateUnitPhalanx(
          unit as BattleUnit & UnitWithPhalanx,
          state,
          config,
        );

        const updatedPhalanxProps = getPhalanxProps(updatedUnit);
        const newArmorBonus = updatedPhalanxProps.phalanxArmorBonus ?? 0;
        const newResolveBonus = updatedPhalanxProps.phalanxResolveBonus ?? 0;
        const isInPhalanx = updatedPhalanxProps.inPhalanx ?? false;

        if (previousArmorBonus !== newArmorBonus || previousResolveBonus !== newResolveBonus) {
          unitsUpdated.push(getUnitId(updatedUnit));
          totalArmorBonusChange += newArmorBonus - previousArmorBonus;
          totalResolveBonusChange += newResolveBonus - previousResolveBonus;
        }

        if (wasInPhalanx !== isInPhalanx) {
          formationsChanged++;
        }

        updatedUnits.push(updatedUnit);
      }

      const updatedState = updateUnits(state, updatedUnits);

      return {
        unitsUpdated,
        formationsChanged,
        totalArmorBonusChange,
        totalResolveBonusChange,
        state: updatedState,
      };
    },

    /**
     * Clears phalanx state for a unit.
     */
    clearPhalanx(unit: BattleUnit & UnitWithPhalanx): BattleUnit & UnitWithPhalanx {
      const baseUnit = unit as BattleUnit;
      const phalanxProps = getPhalanxProps(baseUnit);

      const baseArmor = phalanxProps.baseArmor ?? getBaseArmor(baseUnit);
      const baseResolve = phalanxProps.baseResolve ?? getBaseResolve(baseUnit);

      return withPhalanxProps(baseUnit, {
        inPhalanx: false,
        phalanxState: 'none',
        adjacentAlliesCount: 0,
        adjacentAllyIds: [],
        phalanxArmorBonus: 0,
        phalanxResolveBonus: 0,
        baseArmor,
        baseResolve,
      });
    },

    /**
     * Checks if a unit is currently in a phalanx formation.
     */
    isInPhalanx(unit: BattleUnit & UnitWithPhalanx): boolean {
      const phalanxProps = getPhalanxProps(unit as BattleUnit);
      return phalanxProps.inPhalanx === true && (phalanxProps.adjacentAlliesCount ?? 0) > 0;
    },
  };
}

export default createPhalanxProcessor;
