import {Ability, AttackResult, PlayerStatsProvider} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';
import {BuffsProvider} from "./DamageCalculator";
import {SimulationSpec} from "../SimulationSpec";
import {WarriorTalents} from "../talents";

export class WarriorDamageCalculator extends MeleeDamageCalculator {
   protected talents: WarriorTalents;

   constructor(spec: SimulationSpec, buffsProvider: BuffsProvider, statsProvider: PlayerStatsProvider) {
      super(spec, buffsProvider, statsProvider);
      this.talents = spec.talents as WarriorTalents;
   }

   get dualWieldSpecBonus(): number {
      return (this.talents.dualWieldSpecialization || 0) * 0.05;
   }

   override get autoAttackMultiplier(): number {
      let multiplier = 1;

      // Enrage: +5% damage per rank
      if (this.talents.enrage > 0 && this.buffsProvider.hasBuff('Enrage')) {
         multiplier *= (1 + this.talents.enrage * 0.05);
      }

      // Two-Handed Weapon Specialization: +1% damage per rank (only with 2H)
      if (this.talents.twoHandedSpecialization > 0 && !this.spec.stats.offHandWeapon) {
         multiplier *= (1 + this.talents.twoHandedSpecialization * 0.01);
      }

      return multiplier;
   }

   get impaleCritMultiplier(): number | undefined {
      if (!this.talents.impale || this.talents.impale === 0) {
         return undefined;
      }
      // Impale: +10% crit damage per rank
      // Normal crit: 2.0x
      // With 2/2 Impale: 2.4x (20% more)
      // Multiplier: 2.4 / 2.0 = 1.2
      return 1 + (this.talents.impale * 0.1);
   }

   calculateSpecialAttackDamage(baseDamage: number, isOffhand: boolean = false): AttackResult {
      const weapon = isOffhand ? this.spec.stats.offHandWeapon : this.spec.stats.mainHandWeapon;
      if (!weapon) {
         return {
            type: 'NoWeapon' as any,
            amountModifier: 0,
            baseAmount: 0,
            amount: 0
         };
      }

      const multipliers: number[] = [];

      // Enrage: +5% damage per rank
      if (this.talents.enrage > 0 && this.buffsProvider.hasBuff('Enrage')) {
         multipliers.push(1 + this.talents.enrage * 0.05);
      }

      // Two-Handed Weapon Specialization: +1% damage per rank (only with 2H)
      if (this.talents.twoHandedSpecialization > 0 && !this.spec.stats.offHandWeapon) {
         multipliers.push(1 + this.talents.twoHandedSpecialization * 0.01);
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.MainHand, // This will be overridden by the caller
         isSpecialAttack: true,
         isOffhand,
         weapon,
         critMultiplier: this.impaleCritMultiplier,
      });
   }
}
