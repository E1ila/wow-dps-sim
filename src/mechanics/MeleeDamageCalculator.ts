import {AttackResult, AttackType, GearStats, SimulationConfig, Weapon} from '../types';
import {AttackTable} from './AttackTable';
import {DamageCalculator} from './DamageCalculator';

interface MeleeDamageParams {
   baseDamage: number;
   damageMultipliers?: number[];
   isSpecialAttack: boolean;
   isOffhand?: boolean;
}

export abstract class MeleeDamageCalculator extends DamageCalculator {
   protected readonly attackTable: AttackTable;
   protected readonly targetArmorReduction: number;

   abstract get dualWieldSpecBonus(): number;

   protected constructor(
      stats: GearStats,
      config: SimulationConfig
   ) {
      super(stats, config);
      this.attackTable = new AttackTable(this, config);
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

   protected applyArmorReduction(damage: number): number {
      return damage * this.targetArmorReduction;
   }

   protected getWeaponDamage(weapon: Weapon): number {
      return weapon.minDamage + Math.random() * (weapon.maxDamage - weapon.minDamage);
   }

   protected calculateMeleeDamage(params: MeleeDamageParams): AttackResult {
      const {baseDamage, damageMultipliers = [], isSpecialAttack, isOffhand} = params;

      let damage = baseDamage;

      for (const multiplier of damageMultipliers) {
         damage *= multiplier;
      }

      const attackTableResult = this.attackTable.roll(isSpecialAttack, isOffhand);

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

   calculateAutoAttackDamage(isOffhand: boolean = false): AttackResult {
      const weapon = isOffhand ? this.stats.offHandWeapon : this.stats.mainHandWeapon;
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
      if (!isOffhand) {
         const dualWieldPenalty = 0.5;
         multipliers.push(dualWieldPenalty + this.dualWieldSpecBonus);
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         isSpecialAttack: false,
         isOffhand,
      });
   }
}
