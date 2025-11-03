import {AttackResult, AttackType, GearStats, SimulationConfig, Weapon} from '../types';
import {AttackTable} from './AttackTable';
import {DamageCalculator} from './DamageCalculator';

interface MeleeDamageParams {
   baseDamage: number;
   damageMultipliers?: number[];
   isSpecialAttack?: boolean;
}

export abstract class MeleeDamageCalculator extends DamageCalculator {
   protected readonly attackTable: AttackTable;
   protected readonly targetArmorReduction: number;

   protected constructor(
      stats: GearStats,
      config: SimulationConfig
   ) {
      super(stats, config);
      this.attackTable = new AttackTable(stats, config);
      this.targetArmorReduction = this.calculateArmorReduction();
   }

   private calculateArmorReduction(): number {
      const armor = this.config.targetArmor;
      const levelDifference = Math.max(0, this.config.targetLevel - this.stats.level);
      const effectiveLevel = this.stats.level + 1.5 * levelDifference;
      const levelModifier = 400 + 85 * effectiveLevel;
      const reduction = armor / (armor + levelModifier);
      return 1 - reduction;
   }

   protected getWeaponDamage(weapon: Weapon): number {
      return weapon.minDamage + Math.random() * (weapon.maxDamage - weapon.minDamage);
   }

   protected applyArmorReduction(damage: number): number {
      return damage * this.targetArmorReduction;
   }

   protected calculateMeleeDamage(params: MeleeDamageParams): AttackResult {
      const {baseDamage, damageMultipliers = [], isSpecialAttack = true} = params;

      let damage = baseDamage;

      for (const multiplier of damageMultipliers) {
         damage *= multiplier;
      }

      const attackTableResult = this.attackTable.roll(isSpecialAttack);

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

   protected abstract getDualWieldSpecBonus(): number;

   calculateAutoAttackDamage(isMainHand: boolean = true): AttackResult {
      const weapon = isMainHand ? this.stats.mainHandWeapon : this.stats.offHandWeapon;
      if (!weapon) {
         return {
            type: AttackType.NoWeapon,
            amountModifier: 0,
            baseAmount: 0,
            amount: 0
         };
      }

      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = (this.stats.attackPower / 14) * weapon.speed;
      let baseDamage = weaponDamage + apBonus;

      const multipliers = [];
      if (!isMainHand) {
         const dualWieldPenalty = 0.5;
         const dualWieldSpecBonus = this.getDualWieldSpecBonus();
         multipliers.push(dualWieldPenalty + dualWieldSpecBonus);
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: false
      });
   }
}
