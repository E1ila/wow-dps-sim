import {AttackResult, GearStats, RogueTalents, SimulationConfig, Weapon, WeaponType} from '../types';
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

   get hitChance(): number {
      return super.hitChance + (this.talents?.precision || 0);
   }

   critChance(weapon: Weapon): number {
      let critChance = super.critChance(weapon) + this.talents.malice;
      if (this.talents.daggerSpecialization > 0 && weapon.type === WeaponType.Dagger) {
         critChance += this.talents.daggerSpecialization;
      }
      return critChance;
   }

   calculateSinisterStrikeDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
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
         weapon,
      });
   }

   calculateBackstabDamage(): AttackResult {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = (weaponDamage + 210) * 1.5;

      const multipliers = [];
      if (this.talents.opportunity > 0) {
         multipliers.push(1 + (this.talents.opportunity * 0.04));
      }
      if (this.talents.lethality > 0) {
         multipliers.push(1 + (this.talents.lethality * 0.06));
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
         weapon,
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

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      const weapon = this.stats.mainHandWeapon;
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
         weapon,
      });
   }
}
