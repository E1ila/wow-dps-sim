import {AttackResult, CharacterStats, Weapon, SimulationConfig} from '../types';
import {AttackTable} from './AttackTable';
import {DamageCalculator} from './DamageCalculator';

export abstract class MeleeDamageCalculator extends DamageCalculator {
   protected readonly attackTable: AttackTable;
   protected readonly targetArmorReduction: number;

   constructor(
      stats: CharacterStats,
      config: SimulationConfig
   ) {
      super(stats, config);
      this.attackTable = new AttackTable(stats, config);
      this.targetArmorReduction = this.calculateArmorReduction();
   }

   private calculateArmorReduction(): number {
      const armor = this.config.targetArmor;
      const levelModifier = 400 + (85 * (this.stats.level - 60));
      const reduction = armor / (armor + levelModifier);
      return 1 - reduction;
   }

   protected getWeaponDamage(weapon: Weapon): number {
      return weapon.minDamage + Math.random() * (weapon.maxDamage - weapon.minDamage);
   }

   protected applyArmorReduction(damage: number): number {
      return damage * this.targetArmorReduction;
   }

   protected abstract getDualWieldSpecBonus(): number;

   calculateAutoAttackDamage(isMainHand: boolean = true): { damage: number; isCrit: boolean } {
      const weapon = isMainHand ? this.stats.mainHandWeapon : this.stats.offHandWeapon;
      if (!weapon) return { damage: 0, isCrit: false };

      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = (this.stats.attackPower / 14) * weapon.speed;

      let baseDamage = weaponDamage + apBonus;

      if (!isMainHand) {
         const dualWieldPenalty = 0.5;
         const dualWieldSpecBonus = this.getDualWieldSpecBonus();
         baseDamage *= (dualWieldPenalty + dualWieldSpecBonus);
      }

      const attackResult = this.attackTable.roll(false);

      if (attackResult.damageModifier === 0) {
         return { damage: 0, isCrit: false };
      }

      let damage = baseDamage * attackResult.damageModifier;
      damage = this.applyArmorReduction(damage);

      return {
         damage: Math.floor(damage),
         isCrit: attackResult.result === 'Crit'
      };
   }

   getAttackTable(): AttackTable {
      return this.attackTable;
   }
}
