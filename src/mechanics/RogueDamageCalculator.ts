import {AttackResult, GearStats, RogueTalents, SimulationConfig} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';

export class RogueDamageCalculator extends MeleeDamageCalculator {
   constructor(
      stats: GearStats,
      config: SimulationConfig,
      protected talents: RogueTalents,
   ) {
      super(stats, config);
   }

   get dualWieldSpecBonus(): number {
      return this.talents.dualWieldSpecialization * 0.05;
   }

   get critChance(): number {
      return super.critChance + this.talents.malice;
   }

   calculateSinisterStrikeDamage(): AttackResult {
      const weaponDamage = this.getWeaponDamage(this.stats.mainHandWeapon);
      const baseDamage = weaponDamage + 68;

      const multipliers = [];
      if (this.talents.aggression > 0) {
         multipliers.push(1 + (this.talents.aggression * 0.02));
      }
      if (this.talents.lethality > 0) {
         multipliers.push(1 + (this.talents.lethality * 0.06));
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
      });
   }

   calculateBackstabDamage(): AttackResult {
      const weaponDamage = this.getWeaponDamage(this.stats.mainHandWeapon);
      const baseDamage = (weaponDamage + 210) * 1.5;

      const multipliers = [];
      if (this.talents.opportunity > 0) {
         multipliers.push(1 + (this.talents.opportunity * 0.04));
      }
      if (this.talents.lethality > 0) {
         multipliers.push(1 + (this.talents.lethality * 0.06));
      }
      if (this.talents.daggerSpecialization > 0) {
         multipliers.push(1 + (this.talents.daggerSpecialization * 0.01));
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
      });
   }

   calculateHemorrhageDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = (weaponDamage + 110) * 1.1;

      const multipliers = [];
      if (this.talents.lethality > 0) {
         multipliers.push(1 + (this.talents.lethality * 0.06));
      }
      if (this.talents.daggerSpecialization > 0) {
         multipliers.push(1 + (this.talents.daggerSpecialization * 0.01));
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
      });
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      const damagePerCP = [0, 223, 325, 427, 529, 631];
      const baseDamage = (damagePerCP[comboPoints] || 0) + (this.stats.attackPower * 0.03 * comboPoints);

      const multipliers = [];
      if (this.talents.improvedEviscerate > 0) {
         multipliers.push(1 + (this.talents.improvedEviscerate * 0.05));
      }
      if (this.talents.aggression > 0) {
         multipliers.push(1 + (this.talents.aggression * 0.02));
      }
      if (this.talents.lethality > 0) {
         multipliers.push(1 + (this.talents.lethality * 0.06));
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
      });
   }
}
