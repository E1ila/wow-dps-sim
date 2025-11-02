import {CharacterStats, SimulationConfig, RogueTalents} from '../types';
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

   calculateSinisterStrikeDamage(): { damage: number; isCrit: boolean } {
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

      // Roll attack table for miss/dodge/hit/crit
      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return { damage: 0, isCrit: false };
      }

      damage *= attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return {
         damage: Math.floor(damage),
         isCrit: attackResult.result === 'Crit'
      };
   }

   calculateBackstabDamage(): { damage: number; isCrit: boolean } {
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

      // Roll attack table for miss/dodge/hit/crit
      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return { damage: 0, isCrit: false };
      }

      damage *= attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return {
         damage: Math.floor(damage),
         isCrit: attackResult.result === 'Crit'
      };
   }

   calculateHemorrhageDamage(): { damage: number; isCrit: boolean } {
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

      // Roll attack table for miss/dodge/hit/crit
      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return { damage: 0, isCrit: false };
      }

      damage *= attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return {
         damage: Math.floor(damage),
         isCrit: attackResult.result === 'Crit'
      };
   }

   calculateEviscerateDamage(comboPoints: number): { damage: number; isCrit: boolean } {
      const damagePerCP = [0, 223, 325, 427, 529, 631];
      const baseDamage = damagePerCP[comboPoints] || 0;

      let damage = baseDamage + (this.stats.attackPower * 0.03 * comboPoints);

      if (this.talents.improvedEviscerate > 0) {
         damage *= (1 + (this.talents.improvedEviscerate * 0.05));
      }

      if (this.talents.aggression > 0) {
         damage *= (1 + (this.talents.aggression * 0.02));
      }

      if (this.talents.lethality > 0) {
         damage *= (1 + (this.talents.lethality * 0.06));
      }

      // Roll attack table for miss/dodge/hit/crit
      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return { damage: 0, isCrit: false };
      }

      damage *= attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return {
         damage: Math.floor(damage),
         isCrit: attackResult.result === 'Crit'
      };
   }
}
