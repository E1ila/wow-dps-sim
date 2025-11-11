import {Ability, AttackResult, AttackType} from '../types';
import {BuffsProvider, DamageCalculator} from './DamageCalculator';
import {SimulationSpec} from "../SimulationSpec";
import {MageTalents} from "../talents";

// Spell constants (rank 11 for Fireball, rank 10 for Frostbolt)
const FIREBALL_11 = {
   minDamage: 596,
   maxDamage: 760,
   dotDamage: 56, // 8 ticks over 8 seconds
   castTime: 3500, // ms
   manaCost: 425,
   spellCoeff: 1.0,
   dotCoeff: 0.0,
};

const FROSTBOLT_10 = {
   minDamage: 440,
   maxDamage: 475,
   castTime: 3000, // ms
   manaCost: 290,
   spellCoeff: 0.814,
};

const SCORCH_7 = {
   minDamage: 233,
   maxDamage: 276,
   castTime: 1500, // ms
   manaCost: 180,
   spellCoeff: 0.429,
};

const FIRE_BLAST_7 = {
   minDamage: 431,
   maxDamage: 509,
   castTime: 0, // instant
   manaCost: 340,
   spellCoeff: 0.204,
   cooldown: 8000, // ms
};

export enum SpellSchool {
   Arcane = 'arcane',
   Fire = 'fire',
   Frost = 'frost',
}

interface SpellDamageParams {
   minDamage: number;
   maxDamage: number;
   spellCoeff: number;
   school: SpellSchool;
   canCrit?: boolean;
}

export class MageDamageCalculator extends DamageCalculator {
   protected talents: MageTalents;

   constructor(spec: SimulationSpec, buffsProvider: BuffsProvider) {
      super(spec, buffsProvider, null as any); // Mage doesn't use PlayerStatsProvider
      this.talents = spec.talents as MageTalents;
   }

   get spellPower(): number {
      let power = this.spec.gearStats.spellPower || 0;

      // Add Arcane Power buff (+30% spell damage)
      if (this.buffsProvider.hasBuff('ArcanePower')) {
         power = power * 1.3;
      }

      return power;
   }

   get spellCrit(): number {
      let crit = this.spec.gearStats.spellCrit || 0;

      // Add intellect contribution (1% crit per 60 int at level 60)
      const intellect = this.spec.gearStats.intellect || 0;
      crit += intellect / 60;

      // Add Arcane Instability
      crit += this.talents.arcaneInstability;

      // Add Critical Mass (fire spells)
      crit += this.talents.criticalMass * 2;

      // Add Combustion stacks if active
      if (this.buffsProvider.hasBuff('Combustion')) {
         // Combustion adds 10% crit per stack (this would need to be passed from simulator)
         // For now, we'll handle this in the simulator
      }

      return crit;
   }

   get spellHit(): number {
      let hit = this.spec.gearStats.spellHit || 0;

      // Add Elemental Precision
      hit += this.talents.elementalPrecision * 2;

      // Add Arcane Focus (arcane spells only, handle in school-specific methods)

      return hit;
   }

   /**
    * Calculate spell damage
    */
   calculateSpellDamage(params: SpellDamageParams): AttackResult {
      const {minDamage, maxDamage, spellCoeff, school, canCrit = true} = params;

      // Roll base damage
      const baseDamage = minDamage + Math.random() * (maxDamage - minDamage);

      // Add spell power contribution
      const spellPowerBonus = this.spellPower * spellCoeff;
      let totalDamage = baseDamage + spellPowerBonus;

      // Apply school-specific multipliers
      totalDamage *= this.getSchoolMultiplier(school);

      // Apply Arcane Instability (+1% damage per rank)
      if (this.talents.arcaneInstability > 0) {
         totalDamage *= 1 + (this.talents.arcaneInstability * 0.01);
      }

      // Determine hit/crit outcome
      const outcome = this.rollSpellOutcome(canCrit, school);

      let finalDamage = totalDamage;
      let finalType = AttackType.Hit;

      if (outcome === 'miss') {
         finalDamage = 0;
         finalType = AttackType.Miss;
      } else if (outcome === 'crit' && canCrit) {
         // Spell crits are 1.5x by default
         let critMultiplier = 1.5;

         // Ice Shards increases frost crit damage
         if (school === SpellSchool.Frost && this.talents.iceShards > 0) {
            critMultiplier += this.talents.iceShards * 0.2;
         }

         finalDamage *= critMultiplier;
         finalType = AttackType.Crit;
      }

      return {
         type: finalType,
         baseAmount: Math.round(baseDamage + spellPowerBonus),
         amount: Math.round(finalDamage),
         amountModifier: 1,
      };
   }

   private getSchoolMultiplier(school: SpellSchool): number {
      let multiplier = 1.0;

      switch (school) {
         case SpellSchool.Fire:
            // Fire Power talent
            if (this.talents.firePower > 0) {
               multiplier *= 1 + (this.talents.firePower * 0.02);
            }
            break;

         case SpellSchool.Frost:
            // Piercing Ice talent
            if (this.talents.piercingIce > 0) {
               multiplier *= 1 + (this.talents.piercingIce * 0.02);
            }
            break;

         case SpellSchool.Arcane:
            // No arcane damage talents in Classic
            break;
      }

      return multiplier;
   }

   private rollSpellOutcome(canCrit: boolean, school: SpellSchool): 'hit' | 'crit' | 'miss' {
      const roll = Math.random() * 100;

      // Check for miss first (16% base miss chance vs level 63 boss)
      const baseMissChance = 16;
      const hitChance = this.getSpellHit(school);
      const missChance = Math.max(0, baseMissChance - hitChance);

      if (roll < missChance) {
         return 'miss';
      }

      // Check for crit
      if (canCrit) {
         const critChance = this.getSpellCrit(school);
         if (roll < missChance + critChance) {
            return 'crit';
         }
      }

      return 'hit';
   }

   private getSpellHit(school: SpellSchool): number {
      let hit = this.spec.gearStats.spellHit || 0;

      // Elemental Precision (Fire/Frost)
      if (school === SpellSchool.Fire || school === SpellSchool.Frost) {
         hit += this.talents.elementalPrecision * 2;
      }

      // Arcane Focus (Arcane)
      if (school === SpellSchool.Arcane) {
         hit += this.talents.arcaneFocus * 2;
      }

      return hit;
   }

   private getSpellCrit(school: SpellSchool): number {
      let crit = this.spec.gearStats.spellCrit || 0;

      // Add intellect contribution (1% crit per 60 int at level 60)
      const intellect = this.spec.gearStats.intellect || 0;
      crit += intellect / 60;

      // Arcane Instability (all spells)
      crit += this.talents.arcaneInstability;

      // Critical Mass (fire spells)
      if (school === SpellSchool.Fire) {
         crit += this.talents.criticalMass * 2;
      }

      return crit;
   }

   calculateFireballDamage(): AttackResult {
      return this.calculateSpellDamage({
         minDamage: FIREBALL_11.minDamage,
         maxDamage: FIREBALL_11.maxDamage,
         spellCoeff: FIREBALL_11.spellCoeff,
         school: SpellSchool.Fire,
      });
   }

   calculateFrostboltDamage(): AttackResult {
      return this.calculateSpellDamage({
         minDamage: FROSTBOLT_10.minDamage,
         maxDamage: FROSTBOLT_10.maxDamage,
         spellCoeff: FROSTBOLT_10.spellCoeff,
         school: SpellSchool.Frost,
      });
   }

   calculateScorchDamage(): AttackResult {
      return this.calculateSpellDamage({
         minDamage: SCORCH_7.minDamage,
         maxDamage: SCORCH_7.maxDamage,
         spellCoeff: SCORCH_7.spellCoeff,
         school: SpellSchool.Fire,
      });
   }

   calculateFireBlastDamage(): AttackResult {
      return this.calculateSpellDamage({
         minDamage: FIRE_BLAST_7.minDamage,
         maxDamage: FIRE_BLAST_7.maxDamage,
         spellCoeff: FIRE_BLAST_7.spellCoeff,
         school: SpellSchool.Fire,
      });
   }

   getFireballCastTime(): number {
      let castTime = FIREBALL_11.castTime;

      // Improved Fireball talent
      castTime -= this.talents.improvedFireball * 100;

      // Presence of Mind makes next spell instant
      if (this.buffsProvider.hasBuff('PresenceOfMind')) {
         return 0;
      }

      return castTime;
   }

   getFrostboltCastTime(): number {
      let castTime = FROSTBOLT_10.castTime;

      // Improved Frostbolt talent
      castTime -= this.talents.improvedFrostbolt * 100;

      // Presence of Mind makes next spell instant
      if (this.buffsProvider.hasBuff('PresenceOfMind')) {
         return 0;
      }

      return castTime;
   }

   getScorchCastTime(): number {
      let castTime = SCORCH_7.castTime;

      // Presence of Mind makes next spell instant
      if (this.buffsProvider.hasBuff('PresenceOfMind')) {
         return 0;
      }

      return castTime;
   }

   getManaCost(ability: Ability): number {
      let cost = 0;

      switch (ability) {
         case Ability.Fireball:
            cost = FIREBALL_11.manaCost;
            break;
         case Ability.Frostbolt:
            cost = FROSTBOLT_10.manaCost;
            break;
         case Ability.Scorch:
            cost = SCORCH_7.manaCost;
            break;
         case Ability.FireBlast:
            cost = FIRE_BLAST_7.manaCost;
            break;
         default:
            return 0;
      }

      // Clearcasting makes spell free
      if (this.buffsProvider.hasBuff('Clearcast')) {
         return 0;
      }

      // Arcane Power increases mana cost by 30%
      if (this.buffsProvider.hasBuff('ArcanePower')) {
         cost *= 1.3;
      }

      // Frost Channeling reduces frost spell cost
      if (ability === Ability.Frostbolt && this.talents.frostChanneling > 0) {
         cost *= 1 - (this.talents.frostChanneling * 0.05);
      }

      return Math.round(cost);
   }
}
