import {CharacterStats, RogueTalents, Weapon, SimulationConfig} from '../types';
import {AttackTable} from './AttackTable';

export class DamageCalculator {
   private readonly attackTable: AttackTable;
   private readonly targetArmorReduction: number;

   constructor(
      private stats: CharacterStats,
      private talents: RogueTalents,
      private config: SimulationConfig
   ) {
      this.attackTable = new AttackTable(stats, config);
      this.targetArmorReduction = this.calculateArmorReduction();
   }

   private calculateArmorReduction(): number {
      const armor = this.config.targetArmor;
      const levelModifier = 400 + (85 * (this.stats.level - 60));
      const reduction = armor / (armor + levelModifier);
      return 1 - reduction;
   }

   private getWeaponDamage(weapon: Weapon): number {
      return weapon.minDamage + Math.random() * (weapon.maxDamage - weapon.minDamage);
   }

   private applyArmorReduction(damage: number): number {
      return damage * this.targetArmorReduction;
   }

   calculateAutoAttackDamage(isMainHand: boolean = true): number {
      const weapon = isMainHand ? this.stats.mainHandWeapon : this.stats.offHandWeapon;
      if (!weapon) return 0;

      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = (this.stats.attackPower / 14) * weapon.speed;

      let baseDamage = weaponDamage + apBonus;

      if (!isMainHand) {
         const dualWieldPenalty = 0.5;
         const dualWieldSpecBonus = this.talents.dualWieldSpecialization * 0.05;
         baseDamage *= (dualWieldPenalty + dualWieldSpecBonus);
      }

      const attackResult = this.attackTable.roll(false);

      if (attackResult.damageModifier === 0) {
         return 0;
      }

      let damage = baseDamage * attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateSinisterStrikeDamage(): number {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const flatBonus = 68;
      let baseDamage = weaponDamage + flatBonus;

      const improvedSSBonus = 1 + (this.talents.improvedSinisterStrike * 0.02);
      baseDamage *= improvedSSBonus;

      const aggressionBonus = 1 + (this.talents.aggression * 0.02);
      baseDamage *= aggressionBonus;

      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return 0;
      }

      let critMultiplier = attackResult.damageModifier;
      if (attackResult.damageModifier >= 2.0) {
         const lethalityBonus = this.talents.lethality * 0.06;
         critMultiplier = 2.0 + lethalityBonus;
      }

      let damage = baseDamage * critMultiplier;
      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateBackstabDamage(): number {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const flatBonus = 210;
      const backstabMultiplier = 1.5;
      let baseDamage = (weaponDamage + flatBonus) * backstabMultiplier;

      const improvedBSBonus = 1 + (this.talents.improvedBackstab * 0.1);
      baseDamage *= improvedBSBonus;

      const opportunityBonus = 1 + (this.talents.opportunism * 0.04);
      baseDamage *= opportunityBonus;

      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return 0;
      }

      let critMultiplier = attackResult.damageModifier;
      if (attackResult.damageModifier >= 2.0) {
         const lethalityBonus = this.talents.lethality * 0.06;
         critMultiplier = 2.0 + lethalityBonus;
      }

      let damage = baseDamage * critMultiplier;
      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateHemorrhageDamage(): number {
      const weapon = this.stats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);

      const flatBonus = 110;
      let baseDamage = weaponDamage + flatBonus;

      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return 0;
      }

      let critMultiplier = attackResult.damageModifier;
      if (attackResult.damageModifier >= 2.0) {
         const lethalityBonus = this.talents.lethality * 0.06;
         critMultiplier = 2.0 + lethalityBonus;
      }

      let damage = baseDamage * critMultiplier;
      damage = this.applyArmorReduction(damage);

      return Math.floor(damage);
   }

   calculateEviscerateDamage(comboPoints: number): number {
      const apBonus = this.stats.attackPower * 0.03 * comboPoints;

      const baseDamageByCP = [0, 223, 318, 413, 508, 603];
      let baseDamage = baseDamageByCP[comboPoints] + apBonus;

      const improvedEvisBonus = 1 + (this.talents.improvedEviscerate * 0.05);
      baseDamage *= improvedEvisBonus;

      const aggressionBonus = 1 + (this.talents.aggression * 0.02);
      baseDamage *= aggressionBonus;

      const attackResult = this.attackTable.roll(true);

      if (attackResult.damageModifier === 0) {
         return 0;
      }

      let critMultiplier = attackResult.damageModifier;
      if (attackResult.damageModifier >= 2.0) {
         const lethalityBonus = this.talents.lethality * 0.06;
         critMultiplier = 2.0 + lethalityBonus;
      }

      const damage = baseDamage * critMultiplier;

      return Math.floor(damage);
   }

   getAttackTable(): AttackTable {
      return this.attackTable;
   }
}
