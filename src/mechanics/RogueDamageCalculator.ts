import {CharacterStats, SimulationConfig, RogueTalents} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';

export class RogueDamageCalculator extends MeleeDamageCalculator {
   constructor(
      stats: CharacterStats,
      protected talents: RogueTalents,
      config: SimulationConfig
   ) {
      super(stats, config);
   }

   protected getDualWieldSpecBonus(): number {
      return this.talents.dualWieldSpecialization * 0.05;
   }

   calculateSinisterStrikeDamage(): number {
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

      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateBackstabDamage(): number {
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

      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateHemorrhageDamage(): number {
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

      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateEviscerateDamage(comboPoints: number): number {
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

      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }
}
