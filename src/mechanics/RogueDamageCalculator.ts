import {AttackResult, AttackType, CharacterStats, SimulationConfig, RogueTalents} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';

export class RogueDamageCalculator extends MeleeDamageCalculator {
   constructor(
      stats: CharacterStats,
      config: SimulationConfig,
      protected talents: RogueTalents,
   ) {
      super(stats, config);
   }

   protected getDualWieldSpecBonus(): number {
      return this.talents.dualWieldSpecialization * 0.05;
   }

   calculateSinisterStrikeDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const baseDamage = weaponDamage + 68;

      let damage = baseDamage;

      if (this.talents.aggression > 0) {
         damage *= (1 + (this.talents.aggression * 0.02));
      }

      if (this.talents.lethality > 0) {
         damage *= (1 + (this.talents.lethality * 0.06));
      }

      const attackTableResult = this.attackTable.roll(true);

      if (attackTableResult.amountModifier === 0) {
         return {
            type: attackTableResult.type,
            amountModifier: attackTableResult.amountModifier,
            baseAmount: baseDamage,
            amount: 0
         };
      }

      damage *= attackTableResult.amountModifier;
      damage = Math.floor(this.applyArmorReduction(damage));

      return {
         type: attackTableResult.type,
         amountModifier: attackTableResult.amountModifier,
         baseAmount: baseDamage,
         amount: damage
      };
   }

   calculateBackstabDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const baseDamage = weaponDamage + 210;

      let damage = baseDamage * 1.5;

      if (this.talents.opportunism > 0) {
         damage *= (1 + (this.talents.opportunism * 0.04));
      }

      if (this.talents.lethality > 0) {
         damage *= (1 + (this.talents.lethality * 0.06));
      }

      if (this.talents.daggerSpecialization > 0) {
         damage *= (1 + (this.talents.daggerSpecialization * 0.01));
      }

      const attackTableResult = this.attackTable.roll(true);

      if (attackTableResult.amountModifier === 0) {
         return {
            type: attackTableResult.type,
            amountModifier: attackTableResult.amountModifier,
            baseAmount: baseDamage * 1.5,
            amount: 0
         };
      }

      damage *= attackTableResult.amountModifier;
      damage = Math.floor(this.applyArmorReduction(damage));

      return {
         type: attackTableResult.type,
         amountModifier: attackTableResult.amountModifier,
         baseAmount: baseDamage * 1.5,
         amount: damage
      };
   }

   calculateHemorrhageDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const baseDamage = weaponDamage + 110;

      let damage = baseDamage * 1.1;

      if (this.talents.lethality > 0) {
         damage *= (1 + (this.talents.lethality * 0.06));
      }

      if (this.talents.daggerSpecialization > 0) {
         damage *= (1 + (this.talents.daggerSpecialization * 0.01));
      }

      const attackTableResult = this.attackTable.roll(true);

      if (attackTableResult.amountModifier === 0) {
         return {
            type: attackTableResult.type,
            amountModifier: attackTableResult.amountModifier,
            baseAmount: baseDamage * 1.1,
            amount: 0
         };
      }

      damage *= attackTableResult.amountModifier;
      damage = Math.floor(this.applyArmorReduction(damage));

      return {
         type: attackTableResult.type,
         amountModifier: attackTableResult.amountModifier,
         baseAmount: baseDamage * 1.1,
         amount: damage
      };
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      const damagePerCP = [0, 223, 325, 427, 529, 631];
      let baseDamage = damagePerCP[comboPoints] || 0;

      baseDamage = baseDamage + (this.stats.attackPower * 0.03 * comboPoints);

      let damage = baseDamage;

      if (this.talents.improvedEviscerate > 0) {
         damage *= (1 + (this.talents.improvedEviscerate * 0.05));
      }

      if (this.talents.aggression > 0) {
         damage *= (1 + (this.talents.aggression * 0.02));
      }

      if (this.talents.lethality > 0) {
         damage *= (1 + (this.talents.lethality * 0.06));
      }

      const attackTableResult = this.attackTable.roll(true);

      if (attackTableResult.amountModifier === 0) {
         return {
            type: attackTableResult.type,
            amountModifier: attackTableResult.amountModifier,
            baseAmount: baseDamage,
            amount: 0
         };
      }

      damage *= attackTableResult.amountModifier;
      damage = Math.floor(this.applyArmorReduction(damage));

      return {
         type: attackTableResult.type,
         amountModifier: attackTableResult.amountModifier,
         baseAmount: baseDamage,
         amount: damage
      };
   }
}
