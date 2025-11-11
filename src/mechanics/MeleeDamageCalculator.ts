import {Ability, Attack, AttackResult, AttackType, PlayerStatsProvider, Weapon, WeaponEnchant} from '../types';
import {AttackTable} from './AttackTable';
import {BuffsProvider, DamageCalculator} from './DamageCalculator';
import {SimulationSpec} from "../SimulationSpec";

interface MeleeDamageParams {
   baseDamage: number;
   damageMultipliers?: number[];
   ability: Ability;
   isSpecialAttack: boolean;
   isOffhand?: boolean;
   weapon: Weapon;
   critMultiplier?: number; // Additional crit multiplier for talents like Lethality
}

export abstract class MeleeDamageCalculator extends DamageCalculator {
   protected readonly attackTable: AttackTable;
   protected readonly targetArmorReduction: number;

   abstract get dualWieldSpecBonus(): number;

   protected constructor(spec: SimulationSpec, buffsProvider: BuffsProvider, statsProvider: PlayerStatsProvider) {
      super(spec, buffsProvider, statsProvider);
      this.attackTable = new AttackTable(statsProvider);
      this.targetArmorReduction = this.calculateArmorReduction();
   }

   private calculateArmorReduction(): number {
      const armor = this.spec.targetArmor;
      const levelModifier = 400 + 85 * this.spec.playerLevel;
      const reduction = armor / (armor + levelModifier);
      return 1 - reduction;
   }

   protected applyArmorReduction(damage: number): number {
      return damage * this.targetArmorReduction;
   }

   protected getWeaponDamage(weapon: Weapon): number {
      let minDamage = weapon.minDamage;
      let maxDamage = weapon.maxDamage;
      if (weapon.enchant === WeaponEnchant.Dmg5) {
         minDamage += 5;
         maxDamage += 5;
      }
      else if (weapon.enchant === WeaponEnchant.Dmg4) {
         minDamage += 4;
         maxDamage += 4;
      }
      else if (weapon.enchant === WeaponEnchant.Dmg3) {
         minDamage += 3;
         maxDamage += 3;
      }
      return minDamage + Math.random() * (maxDamage - minDamage);
   }

   /**
    * Calc final damage according to attack table, armor and other multipliers.
    *
    * This func doesn't add attack power to baseDamage, since it's affected differently
    * by special abilities, like a Rogue's backstab.
    */
   protected calculateMeleeDamage(params: MeleeDamageParams): AttackResult {
      const {baseDamage, damageMultipliers = [], ability, isSpecialAttack, weapon, critMultiplier} = params;

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

      // Apply additional crit multiplier (e.g., Lethality) if it's a crit
      if (attackTableResult.type === AttackType.Crit && critMultiplier) {
         damage *= critMultiplier;
      }

      damage = Math.floor(this.applyArmorReduction(damage));

      return {
         type: attackTableResult.type,
         amountModifier: attackTableResult.amountModifier,
         baseAmount: baseDamage,
         amount: damage
      };
   }

   get autoAttackMultiplier(): number {
      return 1;
   }

   calcAttackPowerDamage(weapon: Weapon, normalize: boolean = true): number {
      let speed = weapon.speed;

      if (normalize) {
         switch (weapon.type) {
            case 'Dagger':
               speed = 1.7;
               break;
            case 'Sword':
            case 'Mace':
            case 'Fist':
               speed = 2.4;
               break;
            default:
               speed = 2.4;
         }
      }

      return Math.round((this.statsProvider.attackPower / 14) * speed);
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
      // Auto-attacks use actual weapon speed, NOT normalized speed
      let baseDamage = weaponDamage + this.calcAttackPowerDamage(weapon, false);

      const multipliers = [
         this.autoAttackMultiplier,
      ];
      if (isOffhand) {
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
