/**
 * Tier 4: Contagion Processor
 *
 * Implements the contagion (status effect spreading) system which handles
 * the spreading of status effects between adjacent units at turn_end phase.
 *
 * Key mechanics:
 * - Status effects spread to adjacent allies (same team)
 * - Each effect type has a base spread chance
 * - Phalanx formation increases spread chance
 * - Spread effects have reduced duration (original - 1, min 1)
 * - Same effect cannot stack, but refreshes duration
 * - Spread blocked if target has immunity
 *
 * @module core/mechanics/tier4/contagion
 */

import type { BattleState, BattleUnit, Position } from '../../../types';
import type { ContagionConfig } from '../../config/mechanics.types';
import type {
  ContagionProcessor,
  UnitWithContagion,
  ContagionEffectType,
  StatusEffect,
  SpreadEligibility,
  SpreadBlockReason,
  SpreadAttemptResult,
  ContagionSpreadResult,
  AdjacentTarget,
} from './contagion.types';
import {
  CONTAGION_IMMUNE_TAG,
  NO_SPREAD_TAG,
  MIN_SPREAD_DURATION,
  ORTHOGONAL_OFFSETS,
  DEFAULT_FIRE_SPREAD,
  DEFAULT_POISON_SPREAD,
  DEFAULT_CURSE_SPREAD,
  DEFAULT_FROST_SPREAD,
  DEFAULT_PLAGUE_SPREAD,
  DEFAULT_FEAR_SPREAD,
  DEFAULT_PHALANX_SPREAD_BONUS,
} from './contagion.types';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Checks if a unit has the contagion immunity tag.
 */
function hasImmunityTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(CONTAGION_IMMUNE_TAG) ?? false;
}

/**
 * Checks if a unit has the no-spread tag.
 */
function hasNoSpreadTag(unit: BattleUnit): boolean {
  return unit.tags?.includes(NO_SPREAD_TAG) ?? false;
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
 * Checks if two positions are orthogonally adjacent.
 */
function isOrthogonallyAdjacent(pos1: Position, pos2: Position): boolean {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/**
 * Gets contagion-specific properties from a unit.
 */
function getContagionProps(unit: BattleUnit): Partial<UnitWithContagion> {
  return unit as unknown as Partial<UnitWithContagion>;
}

/**
 * Creates an updated unit with contagion properties.
 */
function withContagionProps(
  unit: BattleUnit,
  contagionProps: Partial<UnitWithContagion>,
): BattleUnit & UnitWithContagion {
  return { ...unit, ...contagionProps } as BattleUnit & UnitWithContagion;
}

/**
 * Updates units in state immutably.
 */
function updateUnits(state: BattleState, updatedUnits: BattleUnit[]): BattleState {
  const unitMap = new Map(updatedUnits.map(u => [getUnitId(u), u]));
  return {
    ...state,
    units: state.units.map(u => unitMap.get(getUnitId(u)) ?? u),
  };
}

/**
 * Gets the base spread chance for an effect type from config.
 */
function getBaseSpreadChance(
  effectType: ContagionEffectType,
  config: ContagionConfig,
): number {
  switch (effectType) {
    case 'fire':
      return config.fireSpread ?? DEFAULT_FIRE_SPREAD;
    case 'poison':
      return config.poisonSpread ?? DEFAULT_POISON_SPREAD;
    case 'curse':
      return config.curseSpread ?? DEFAULT_CURSE_SPREAD;
    case 'frost':
      return config.frostSpread ?? DEFAULT_FROST_SPREAD;
    case 'plague':
      return config.plagueSpread ?? DEFAULT_PLAGUE_SPREAD;
    case 'fear':
      return DEFAULT_FEAR_SPREAD; // Fear not in config, use default
    default:
      return 0;
  }
}

/**
 * Checks if an effect type is spreadable.
 */
function isSpreadableEffect(effectType: string): effectType is ContagionEffectType {
  return ['fire', 'poison', 'curse', 'frost', 'plague', 'fear'].includes(effectType);
}

// ═══════════════════════════════════════════════════════════════
// PROCESSOR FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a contagion processor instance.
 *
 * The contagion processor handles:
 * - Calculating spread chances for different effect types
 * - Checking spread eligibility between units
 * - Processing spread attempts with random rolls
 * - Applying spread effects to target units
 *
 * @param config - Contagion configuration with spread chances
 * @returns ContagionProcessor instance
 *
 * @example
 * const processor = createContagionProcessor({
 *   fireSpread: 0.5,
 *   poisonSpread: 0.3,
 *   phalanxSpreadBonus: 0.15,
 * });
 *
 * // Get spread chance for fire effect
 * const chance = processor.getSpreadChance('fire', true);
 *
 * // Process spread for a unit
 * const result = processor.processSpread(state, 'player_knight_0', [0.3, 0.7]);
 */
export function createContagionProcessor(config: ContagionConfig): ContagionProcessor {
  const phalanxBonus = config.phalanxSpreadBonus ?? DEFAULT_PHALANX_SPREAD_BONUS;

  return {
    /**
     * Gets the spread chance for an effect type.
     */
    getSpreadChance(
      effectType: ContagionEffectType,
      targetInPhalanx: boolean,
    ): number {
      const baseChance = getBaseSpreadChance(effectType, config);
      const bonus = targetInPhalanx ? phalanxBonus : 0;
      return Math.min(1, baseChance + bonus);
    },

    /**
     * Checks if an effect can spread from source to target.
     */
    canSpread(
      source: BattleUnit & UnitWithContagion,
      target: BattleUnit & UnitWithContagion,
      effectType: ContagionEffectType,
      _state: BattleState,
    ): SpreadEligibility {
      const baseSource = source as BattleUnit;
      const baseTarget = target as BattleUnit;

      // Check if source can spread effects
      if (hasNoSpreadTag(baseSource)) {
        return {
          canSpread: false,
          reason: 'source_no_spread',
          spreadChance: 0,
          targetInPhalanx: baseTarget.inPhalanx ?? false,
        };
      }

      // Check if target is alive
      if (!isUnitAlive(baseTarget)) {
        return {
          canSpread: false,
          reason: 'target_dead',
          spreadChance: 0,
          targetInPhalanx: false,
        };
      }

      // Check if target is immune
      if (hasImmunityTag(baseTarget)) {
        return {
          canSpread: false,
          reason: 'target_immune',
          spreadChance: 0,
          targetInPhalanx: baseTarget.inPhalanx ?? false,
        };
      }

      // Check if same team (contagion only spreads to allies)
      if (!isSameTeam(baseSource, baseTarget)) {
        return {
          canSpread: false,
          reason: 'different_team',
          spreadChance: 0,
          targetInPhalanx: baseTarget.inPhalanx ?? false,
        };
      }

      // Check if adjacent
      if (!isOrthogonallyAdjacent(baseSource.position, baseTarget.position)) {
        return {
          canSpread: false,
          reason: 'not_adjacent',
          spreadChance: 0,
          targetInPhalanx: baseTarget.inPhalanx ?? false,
        };
      }

      // Check if effect type is spreadable
      if (!isSpreadableEffect(effectType)) {
        return {
          canSpread: false,
          reason: 'effect_not_spreadable',
          spreadChance: 0,
          targetInPhalanx: baseTarget.inPhalanx ?? false,
        };
      }

      // Check if target already has this effect (can refresh but counts as "active")
      const targetProps = getContagionProps(baseTarget);
      const existingEffect = targetProps.statusEffects?.find(e => e.type === effectType);
      if (existingEffect) {
        // Effect exists - spread will refresh duration, not stack
        // We still allow the spread attempt
      }

      const targetInPhalanx = baseTarget.inPhalanx ?? false;
      const spreadChance = this.getSpreadChance(effectType, targetInPhalanx);

      return {
        canSpread: true,
        spreadChance,
        targetInPhalanx,
      };
    },

    /**
     * Gets adjacent allies that could receive spread effects.
     */
    getAdjacentTargets(
      unit: BattleUnit & UnitWithContagion,
      state: BattleState,
    ): AdjacentTarget[] {
      const baseUnit = unit as BattleUnit;
      const position = baseUnit.position;
      const targets: AdjacentTarget[] = [];

      for (const offset of ORTHOGONAL_OFFSETS) {
        const neighborPos: Position = {
          x: position.x + offset.dx,
          y: position.y + offset.dy,
        };

        const neighbor = state.units.find(
          (u) =>
            u.position &&
            u.position.x === neighborPos.x &&
            u.position.y === neighborPos.y,
        );

        if (
          neighbor &&
          isUnitAlive(neighbor) &&
          isSameTeam(baseUnit, neighbor) &&
          getUnitId(neighbor) !== getUnitId(baseUnit)
        ) {
          const neighborProps = getContagionProps(neighbor);
          const existingEffects = (neighborProps.statusEffects ?? [])
            .map(e => e.type)
            .filter(isSpreadableEffect);

          targets.push({
            unit: neighbor as BattleUnit & UnitWithContagion,
            position: neighborPos,
            inPhalanx: neighbor.inPhalanx ?? false,
            existingEffects,
          });
        }
      }

      return targets;
    },

    /**
     * Gets spreadable effects from a unit.
     */
    getSpreadableEffects(
      unit: BattleUnit & UnitWithContagion,
    ): StatusEffect[] {
      const props = getContagionProps(unit as BattleUnit);
      const effects = props.statusEffects ?? [];
      return effects.filter(e => isSpreadableEffect(e.type));
    },

    /**
     * Attempts to spread an effect to a target.
     */
    attemptSpread(
      source: BattleUnit & UnitWithContagion,
      target: BattleUnit & UnitWithContagion,
      effect: StatusEffect,
      roll: number,
      state: BattleState,
    ): SpreadAttemptResult {
      const eligibility = this.canSpread(source, target, effect.type, state);

      if (!eligibility.canSpread) {
        return {
          success: false,
          roll,
          spreadChance: eligibility.spreadChance,
          failureReason: eligibility.reason,
        };
      }

      // Check if roll succeeds
      if (roll >= eligibility.spreadChance) {
        return {
          success: false,
          roll,
          spreadChance: eligibility.spreadChance,
          failureReason: 'roll_failed',
        };
      }

      // Spread succeeds - create new effect with reduced duration
      const newDuration = Math.max(MIN_SPREAD_DURATION, effect.duration - 1);
      const spreadEffect: StatusEffect = {
        type: effect.type,
        duration: newDuration,
        sourceId: getUnitId(source as BattleUnit),
        spreadCount: (effect.spreadCount ?? 0) + 1,
      };

      return {
        success: true,
        roll,
        spreadChance: eligibility.spreadChance,
        spreadEffect,
      };
    },

    /**
     * Applies a spread effect to a target unit.
     */
    applySpreadEffect(
      target: BattleUnit & UnitWithContagion,
      effect: StatusEffect,
      state: BattleState,
    ): BattleState {
      const baseTarget = target as BattleUnit;
      const targetId = getUnitId(baseTarget);
      const props = getContagionProps(baseTarget);
      const existingEffects = props.statusEffects ?? [];

      // Check if effect already exists - refresh duration if so
      const existingIndex = existingEffects.findIndex(e => e.type === effect.type);
      let newEffects: StatusEffect[];

      if (existingIndex >= 0) {
        // Refresh duration (take max of existing and new)
        newEffects = existingEffects.map((e, i) =>
          i === existingIndex
            ? { ...e, duration: Math.max(e.duration, effect.duration) }
            : e,
        );
      } else {
        // Add new effect
        newEffects = [...existingEffects, effect];
      }

      const updatedTarget = withContagionProps(baseTarget, {
        statusEffects: newEffects,
      });

      return updateUnits(state, [updatedTarget]);
    },

    /**
     * Processes contagion spread for a unit at turn_end.
     */
    processSpread(
      state: BattleState,
      unitId: string,
      rolls: number[],
    ): ContagionSpreadResult {
      const unit = state.units.find(u => getUnitId(u) === unitId);

      if (!unit || !isUnitAlive(unit)) {
        return {
          affectedUnits: [],
          spreadAttempts: [],
          state,
          totalSpreads: 0,
        };
      }

      const unitWithContagion = unit as BattleUnit & UnitWithContagion;
      const spreadableEffects = this.getSpreadableEffects(unitWithContagion);

      if (spreadableEffects.length === 0) {
        return {
          affectedUnits: [],
          spreadAttempts: [],
          state,
          totalSpreads: 0,
        };
      }

      const adjacentTargets = this.getAdjacentTargets(unitWithContagion, state);

      if (adjacentTargets.length === 0) {
        return {
          affectedUnits: [],
          spreadAttempts: [],
          state,
          totalSpreads: 0,
        };
      }

      let currentState = state;
      const affectedUnits: string[] = [];
      const spreadAttempts: ContagionSpreadResult['spreadAttempts'] = [];
      let rollIndex = 0;
      let totalSpreads = 0;

      // Try to spread each effect to each adjacent target
      for (const effect of spreadableEffects) {
        for (const target of adjacentTargets) {
          const roll = rolls[rollIndex] ?? Math.random();
          rollIndex++;

          const result = this.attemptSpread(
            unitWithContagion,
            target.unit,
            effect,
            roll,
            currentState,
          );

          spreadAttempts.push({
            targetId: getUnitId(target.unit as BattleUnit),
            effectType: effect.type,
            result,
          });

          if (result.success && result.spreadEffect) {
            currentState = this.applySpreadEffect(
              target.unit,
              result.spreadEffect,
              currentState,
            );

            const targetId = getUnitId(target.unit as BattleUnit);
            if (!affectedUnits.includes(targetId)) {
              affectedUnits.push(targetId);
            }
            totalSpreads++;
          }
        }
      }

      return {
        affectedUnits,
        spreadAttempts,
        state: currentState,
        totalSpreads,
      };
    },

    /**
     * Checks if a unit has immunity to contagion.
     */
    isImmune(unit: BattleUnit & UnitWithContagion): boolean {
      const baseUnit = unit as BattleUnit;
      const props = getContagionProps(baseUnit);
      return hasImmunityTag(baseUnit) || props.contagionImmune === true;
    },

    /**
     * Checks if a unit can spread its effects.
     */
    canSpreadFrom(unit: BattleUnit & UnitWithContagion): boolean {
      const baseUnit = unit as BattleUnit;
      const props = getContagionProps(baseUnit);
      return !hasNoSpreadTag(baseUnit) && props.canSpreadEffects !== false;
    },
  };
}

export default createContagionProcessor;
