import {Ability, Attack, AttackResult, RogueTalents, WeaponType} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';
import {SimulationSpec} from '../SpecLoader';

export class RogueDamageCalculator extends MeleeDamageCalculator {
   protected talents: RogueTalents;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as RogueTalents;
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
         const mainHandType = this.spec.gearStats.mainHandWeapon.type;
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

   get lethalityMultiplier() {
      if (this.talents.lethality === 0) {
         return 1;
      }
      return 1 + (this.talents.lethality * 0.06);
   }

   get aggressionMultiplier() {
      if (this.talents.aggression === 0) {
         return 1;
      }
      return 1 + (this.talents.aggression * 0.02);
   }

   get opportunityMultiplier() {
      if (this.talents.opportunity === 0) {
         return 1;
      }
      return 1 + (this.talents.opportunity * 0.04);
   }

   get eviscerateMultiplier() {
      if (this.talents.improvedEviscerate === 0) {
         return 1;
      }
      return 1 + (this.talents.improvedEviscerate * 0.05);
   }

   calculateSinisterStrikeDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = weaponDamage + 68;

      const multipliers = [
         this.aggressionMultiplier,
         this.lethalityMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.SinisterStrike,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateBackstabDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = (weaponDamage + 210) * 1.5;

      const multipliers = [
         this.opportunityMultiplier,
         this.lethalityMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Backstab,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateHemorrhageDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = weaponDamage + 3;

      const multipliers = [
         this.lethalityMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Hemorrhage,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const damagePerCP = [0, 223, 325, 427, 529, 631];
      const baseDamage = (damagePerCP[comboPoints] || 0) + (this.spec.gearStats.attackPower * 0.03 * comboPoints);

      const multipliers = [
         this.eviscerateMultiplier,
         this.aggressionMultiplier,
         this.lethalityMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Eviscerate,
         isSpecialAttack: true,
         weapon,
      });
   }
}
