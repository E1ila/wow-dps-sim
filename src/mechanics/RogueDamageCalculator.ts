import {Ability, Attack, AttackResult, GearStats, RogueTalents, SimulationConfig, Weapon, WeaponType} from '../types';
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

   get weaponSkill(): number {
      let baseSkill = super.weaponSkill;

      if ((this.talents?.weaponExpertise || 0) > 0) {
         const mainHandType = this.stats.mainHandWeapon.type;
         if (mainHandType === WeaponType.Sword ||
             mainHandType === WeaponType.Fist ||
             mainHandType === WeaponType.Dagger) {
            baseSkill += this.talents.weaponExpertise === 1 ? 3 : 5;
         }
      }

      return baseSkill;
   }

   critChance(attack: Attack): number {
      let critChance = super.critChance(attack) + this.talents.malice;
      if (this.talents.daggerSpecialization > 0 && attack.weapon.type === WeaponType.Dagger) {
         critChance += this.talents.daggerSpecialization;
      }
      
      // Add ability-specific crit bonuses
      if (attack.ability === Ability.Backstab && this.talents.improvedBackstab > 0) {
         critChance += this.talents.improvedBackstab * 10;
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
         ability: Ability.SinisterStrike,
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
         ability: Ability.Backstab,
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
         ability: Ability.Hemorrhage,
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
         ability: Ability.Eviscerate,
         isSpecialAttack: true,
         weapon,
      });
   }
}
