import {Ability, Attack, AttackResult, AttackType, Weapon} from '../types';
import {AttackTable} from './AttackTable';
import {DamageCalculator} from './DamageCalculator';
import {SimulationSpec} from '../SpecLoader';

interface MeleeDamageParams {
   baseDamage: number;
   damageMultipliers?: number[];
   ability: Ability;
   isSpecialAttack: boolean;
   isOffhand?: boolean;
   weapon: Weapon;
}

export abstract class MeleeDamageCalculator extends DamageCalculator {
   protected readonly attackTable: AttackTable;
   protected readonly targetArmorReduction: number;

   abstract get dualWieldSpecBonus(): number;

   protected constructor(spec: SimulationSpec) {
      super(spec);
      this.attackTable = new AttackTable(this);
      this.targetArmorReduction = this.calculateArmorReduction();
   }

   private calculateArmorReduction(): number {
      const armor = this.spec.targetArmor;
      const levelDifference = Math.max(0, this.spec.targetLevel - this.spec.playerLevel);
      const effectiveLevel = this.spec.playerLevel + 1.5 * levelDifference;
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
      const {baseDamage, damageMultipliers = [], ability, isSpecialAttack, weapon} = params;

      let damage = baseDamage;

      for (const multiplier of damageMultipliers) {
         damage *= multiplier;
      }

      const attack: Attack = {
         ability,
         isSpecialAttack,
         weapon
      };

      const attackTableResult = this.attackTable.roll(attack);

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
      const weapon = isOffhand ? this.spec.gearStats.offHandWeapon : this.spec.gearStats.mainHandWeapon;
      if (!weapon) {
         return {
            type: AttackType.NoWeapon,
            amountModifier: 0,
            baseAmount: 0,
            amount: 0
         };
      }

      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = (this.spec.gearStats.attackPower / 14) * weapon.speed;
      let baseDamage = weaponDamage + apBonus;

      const multipliers = [];
      if (!isOffhand) {
         const dualWieldPenalty = 0.5;
         multipliers.push(dualWieldPenalty + this.dualWieldSpecBonus);
      }

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: isOffhand ? Ability.OffHand : Ability.MainHand,
         isSpecialAttack: false,
         isOffhand,
         weapon,
      });
   }
}
