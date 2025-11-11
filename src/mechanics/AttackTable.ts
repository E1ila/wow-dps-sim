import {Attack, AttackTableResult, AttackType, PlayerStatsProvider} from '../types';

/**
 * WoW Classic (Era) Attack Table Mechanics
 * based on https://bookdown.org/marrowwar/marrow_compendium/mechanics.html
 */
export class AttackTable {
   private readonly baseMissChance: number;
   private readonly dodgeChance: number;
   private readonly glancingChance: number;

   constructor(
      private stats: PlayerStatsProvider,
   ) {
      this.baseMissChance = this.calculateBaseMissChance();
      this.dodgeChance = this.calculateDodgeChance();
      this.glancingChance = this.calculateGlancingChance();
   }

   private calculateBaseMissChance(): number {
      const targetDefense = this.stats.targetLevel * 5;
      const weaponSkill = this.stats.weaponSkill;
      const defenseSkillDiff = targetDefense - weaponSkill;

      let baseMissChance: number;
      if (defenseSkillDiff >= 11) {
         baseMissChance = 0.05 + (defenseSkillDiff * 0.002);
      } else {
         baseMissChance = 0.05 + (defenseSkillDiff * 0.001);
      }

      let missReduction = this.stats.hitChance / 100;

      // Hit suppression: when skill deficit > 10, hit is less effective
      if (defenseSkillDiff > 10) {
         const hitSuppression = (defenseSkillDiff - 10) * 0.002;
         missReduction = Math.max(0, missReduction - hitSuppression);
      }

      const missChance = baseMissChance - missReduction;

      return Math.max(0, missChance);
   }

   private getMissChance(isWhiteAttack: boolean): number {
      if (isWhiteAttack && this.stats.isDualWielding) {
         return Math.max(0, this.baseMissChance + 0.19);
      }
      return this.baseMissChance;
   }

   private calculateDodgeChance(): number {
      const targetDefense = this.stats.targetLevel * 5;
      const weaponSkill = this.stats.weaponSkill;
      const skillDiff = targetDefense - weaponSkill;

      const dodgeChance = 0.05 + (skillDiff * 0.001);

      return Math.max(0, dodgeChance);
   }

   private calculateGlancingChance(): number {
      const targetLevel = this.stats.targetLevel;
      const playerLevel = this.stats.playerLevel;

      if (targetLevel < playerLevel) {
         return 0;
      }

      const targetDefense = targetLevel * 5;
      const baseWeaponSkill = playerLevel * 5;
      const skillDiff = targetDefense - baseWeaponSkill;

      const glancingChance = 0.1 + (skillDiff * 0.02);
      return Math.max(0, Math.min(0.4, glancingChance));
   }

   private calculateGlancingDamageModifier(): number {
      const weaponSkill = this.stats.weaponSkill;
      const targetLevel = this.stats.targetLevel;
      const targetDefense = targetLevel * 5;
      const skillDiff = targetDefense - weaponSkill;

      if (targetLevel <= this.stats.playerLevel) {
         return 0.95;
      }

      const lowEnd = Math.min(1.3 - 0.05 * skillDiff, 0.91);
      const highEnd = Math.max(Math.min(1.2 - 0.03 * skillDiff, 0.99), 0.2);

      return (lowEnd + highEnd) / 2;
   }

   roll(attack: Attack): AttackTableResult {
      const roll = Math.random();
      let cumulative = 0;

      const isWhiteAttack = !attack.isSpecialAttack;
      const missChance = this.getMissChance(isWhiteAttack);

      cumulative += missChance;
      if (roll < cumulative) {
         return {type: AttackType.Miss, amountModifier: 0};
      }

      cumulative += this.dodgeChance;
      if (roll < cumulative) {
         return {type: AttackType.Dodge, amountModifier: 0};
      }

      if (!attack.isSpecialAttack) {
         cumulative += this.glancingChance;
         if (roll < cumulative) {
            return {
               type: AttackType.Glancing,
               amountModifier: this.calculateGlancingDamageModifier()
            };
         }
      }

      const critChance = this.stats.attackCritChance(attack) / 100;
      cumulative += critChance;
      if (roll < cumulative) {
         return {type: AttackType.Crit, amountModifier: 2.0};
      }

      return {type: AttackType.Hit, amountModifier: 1.0};
   }
}
