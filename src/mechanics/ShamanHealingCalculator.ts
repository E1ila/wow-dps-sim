import {Ability} from '../types';
import {BuffsProvider, DamageCalculator} from './DamageCalculator';
import {ShamanTalents} from "../talents";
import {SimulationSpec} from "../SimulationSpec";

// Healing spell constants (max rank)
const HEALING_WAVE_10 = {
   minHealing: 1620,
   maxHealing: 1851,
   castTime: 3000, // ms
   manaCost: 425,
   coefficient: 1.5 / 3.5, // 3.0s cast time
};

const LESSER_HEALING_WAVE_6 = {
   minHealing: 489,
   maxHealing: 557,
   castTime: 1500, // ms
   manaCost: 195,
   coefficient: 1.5 / 3.5, // 1.5s cast time
};

const CHAIN_HEAL_4 = {
   minHealing: 605,
   maxHealing: 691,
   castTime: 2500, // ms
   manaCost: 405,
   coefficient: 0.714, // 2.5s cast time with 3-target modifier
   numTargets: 3,
   reductionPerJump: 0.5, // 50% reduction per jump (vanilla)
};

export interface HealingResult {
   baseHealing: number;
   effectiveHealing: number;
   overhealing: number;
   crit: boolean;
}

export class ShamanHealingCalculator extends DamageCalculator {
   protected talents: ShamanTalents;

   constructor(spec: SimulationSpec, buffsProvider: BuffsProvider) {
      super(spec, buffsProvider, null as any);
      this.talents = spec.talents as ShamanTalents;
   }

   get healingPower(): number {
      let power = this.spec.gearStats.healingPower || 0;

      // Add spell power (healing power includes spell power)
      power += this.spec.gearStats.spellPower || 0;

      // Mental Quickness: adds % of attack power as healing power
      if (this.talents.mentalQuickness > 0) {
         const apToHealingPercent = [0, 0.06, 0.12, 0.18, 0.20, 0.25][this.talents.mentalQuickness];
         power += (this.statsProvider.attackPower || 0) * apToHealingPercent;
      }

      return power;
   }

   get healingCrit(): number {
      let crit = this.spec.gearStats.spellCrit || 0;

      // Add intellect contribution (1% crit per 60 int at level 60)
      const intellect = this.spec.gearStats.intellect || 0;
      crit += intellect / 60;

      // Tidal Mastery
      crit += this.talents.tidalMastery;

      return crit;
   }

   /**
    * Calculate healing for a single-target heal
    */
   calculateSingleTargetHeal(
      minHealing: number,
      maxHealing: number,
      coefficient: number,
      targetCurrentHealth: number,
      targetMaxHealth: number
   ): HealingResult {
      // Roll base healing
      const baseHealing = minHealing + Math.random() * (maxHealing - minHealing);

      // Add healing power contribution
      const healingPowerBonus = this.healingPower * coefficient;
      let totalHealing = baseHealing + healingPowerBonus;

      // Apply Purification talent (+2% healing per rank)
      if (this.talents.purification > 0) {
         totalHealing *= 1 + (this.talents.purification * 0.02);
      }

      // Determine crit
      const isCrit = Math.random() * 100 < this.healingCrit;
      if (isCrit) {
         totalHealing *= 1.5; // Healing crits are 1.5x
      }

      // Calculate effective healing and overhealing
      const healingNeeded = targetMaxHealth - targetCurrentHealth;
      const effectiveHealing = Math.min(totalHealing, healingNeeded);
      const overhealing = totalHealing - effectiveHealing;

      return {
         baseHealing: Math.round(baseHealing + healingPowerBonus),
         effectiveHealing: Math.round(effectiveHealing),
         overhealing: Math.round(overhealing),
         crit: isCrit,
      };
   }

   calculateHealingWave(targetCurrentHealth: number, targetMaxHealth: number): HealingResult {
      return this.calculateSingleTargetHeal(
         HEALING_WAVE_10.minHealing,
         HEALING_WAVE_10.maxHealing,
         HEALING_WAVE_10.coefficient,
         targetCurrentHealth,
         targetMaxHealth
      );
   }

   calculateLesserHealingWave(targetCurrentHealth: number, targetMaxHealth: number): HealingResult {
      return this.calculateSingleTargetHeal(
         LESSER_HEALING_WAVE_6.minHealing,
         LESSER_HEALING_WAVE_6.maxHealing,
         LESSER_HEALING_WAVE_6.coefficient,
         targetCurrentHealth,
         targetMaxHealth
      );
   }

   calculateChainHeal(
      targetCurrentHealth: number,
      targetMaxHealth: number,
      targetIndex: number = 0
   ): HealingResult {
      // Chain Heal has reduced healing per jump
      const reductionFactor = Math.pow(1 - CHAIN_HEAL_4.reductionPerJump, targetIndex);

      const minHealing = CHAIN_HEAL_4.minHealing * reductionFactor;
      const maxHealing = CHAIN_HEAL_4.maxHealing * reductionFactor;

      return this.calculateSingleTargetHeal(
         minHealing,
         maxHealing,
         CHAIN_HEAL_4.coefficient,
         targetCurrentHealth,
         targetMaxHealth
      );
   }

   getHealingWaveCastTime(): number {
      let castTime = HEALING_WAVE_10.castTime;

      // Improved Healing Wave (-0.1s per rank)
      castTime -= this.talents.improvedHealingWave * 100;

      // Nature's Swiftness makes next spell instant
      if (this.buffsProvider.hasBuff('NaturesSwiftness')) {
         return 0;
      }

      return Math.max(1000, castTime); // Minimum 1 second cast time
   }

   getLesserHealingWaveCastTime(): number {
      let castTime = LESSER_HEALING_WAVE_6.castTime;

      // Nature's Swiftness makes next spell instant
      if (this.buffsProvider.hasBuff('NaturesSwiftness')) {
         return 0;
      }

      return castTime;
   }

   getChainHealCastTime(): number {
      let castTime = CHAIN_HEAL_4.castTime;

      // Nature's Swiftness makes next spell instant
      if (this.buffsProvider.hasBuff('NaturesSwiftness')) {
         return 0;
      }

      return castTime;
   }

   getManaCost(ability: Ability): number {
      let cost = 0;

      switch (ability) {
         case Ability.HealingWave:
            cost = HEALING_WAVE_10.manaCost;
            break;
         case Ability.LesserHealingWave:
            cost = LESSER_HEALING_WAVE_6.manaCost;
            break;
         case Ability.ChainHeal:
            cost = CHAIN_HEAL_4.manaCost;
            break;
         default:
            return 0;
      }

      // Tidal Focus reduces healing spell mana cost
      if (this.talents.tidalFocus > 0) {
         cost *= 1 - (this.talents.tidalFocus * 0.01);
      }

      return Math.round(cost);
   }
}
