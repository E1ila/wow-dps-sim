import {Attack, AttackTableResult, AttackType, PlayerStatsProvider} from '../types';

/**
 * WoW Classic (Era) Attack Table Mechanics
 * based on https://bookdown.org/marrowwar/marrow_compendium/mechanics.html
 * and https://github.com/magey/classic-warrior/wiki/Attack-table
 */
export class AttackTable {
   private readonly baseMissChance: number;
   private readonly dodgeChance: number;
   private readonly parryChance: number;
   private readonly blockChance: number;
   private readonly glancingChance: number;
   private readonly glanceMultiplierMin: number;
   private readonly glanceMultiplierMax: number;

   constructor(
      private stats: PlayerStatsProvider,
   ) {
      this.baseMissChance = this.calculateBaseMissChance();
      this.dodgeChance = this.calculateDodgeChance();
      this.parryChance = this.calculateParryChance();
      this.blockChance = this.calculateBlockChance();
      this.glancingChance = this.calculateGlancingChance();
      const glanceMultipliers = this.calculateGlancingDamageMultipliers();
      this.glanceMultiplierMin = glanceMultipliers.min;
      this.glanceMultiplierMax = glanceMultipliers.max;
   }

   private calculateBaseMissChance(): number {
      const targetDefense = this.stats.targetLevel * 5;
      const weaponSkill = this.stats.weaponSkill;
      const defenseSkillDiff = targetDefense - weaponSkill;

      let baseMissChance: number;
      if (defenseSkillDiff > 10) {
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

   private calculateParryChance(): number {
      const targetDefense = this.stats.targetLevel * 5;
      const baseWeaponSkill = this.stats.playerLevel * 5;
      const skillDiff = targetDefense - baseWeaponSkill;

      // Parry chance varies based on skill difference:
      // - If skill gap > 10: 5% + 0.6% per point
      // - Otherwise: 5% + 0.1% per point
      let parryChance: number;
      if (skillDiff > 10) {
         parryChance = 0.05 + (skillDiff * 0.006);
      } else {
         parryChance = 0.05 + (skillDiff * 0.001);
      }

      return Math.max(0, parryChance);
   }

   // FIXED: Added missing Block chance calculation from wow-sims reference
   private calculateBlockChance(): number {
      // Base block chance is always 5% for enemies
      // Note: Player block may vary by level differences but we use enemy attack here
      return 0.05;
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
      return Math.max(0, glancingChance);
   }

   private calculateGlancingDamageMultipliers(): { min: number; max: number } {
      const weaponSkill = this.stats.weaponSkill;
      const targetLevel = this.stats.targetLevel;
      const playerLevel = this.stats.playerLevel;
      const targetDefense = targetLevel * 5;
      const skillDiff = targetDefense - weaponSkill;

      // For same level or lower, use simplified calculation
      if (targetLevel <= playerLevel) {
         // Note: wow-sims doesn't specify exact bounds for same-level,
         // using mid-range estimates
         return {min: 0.75, max: 0.95};
      }

      // For higher level targets, scale damage based on skill difference:
      // Minimum glance damage: 1.3 - 0.05*skillDiff, clamped [0.01, 0.91]
      // Maximum glance damage: 1.2 - 0.03*skillDiff, clamped [0.2, 0.99]
      const lowEnd = Math.max(Math.min(1.3 - 0.05 * skillDiff, 0.91), 0.01);
      const highEnd = Math.max(Math.min(1.2 - 0.03 * skillDiff, 0.99), 0.2);

      return {min: lowEnd, max: highEnd};
   }

   private getGlancingDamageModifier(): number {
      return this.glanceMultiplierMin + Math.random() * (this.glanceMultiplierMax - this.glanceMultiplierMin);
   }

   roll(attack: Attack): AttackTableResult {
      const roll = Math.random();
      let cumulative = 0;

      const isWhiteAttack = !attack.isSpecialAttack;
      const missChance = this.getMissChance(isWhiteAttack);

      // In front of target: Miss -> Dodge -> Parry -> Glance -> Block -> Crit -> Hit
      // Behind target: Miss -> Dodge -> Glance -> Crit -> Hit

      // Step 1: Miss check
      cumulative += missChance;
      if (roll < cumulative) {
         return {type: AttackType.Miss, amountModifier: 0};
      }

      // Step 2: Dodge check
      cumulative += this.dodgeChance;
      if (roll < cumulative) {
         return {type: AttackType.Dodge, amountModifier: 0};
      }

      // Step 3: Parry check (only if in front, not for special attacks)
      if (attack.inFrontOfEnemy && !attack.isSpecialAttack) {
         cumulative += this.parryChance;
         if (roll < cumulative) {
            return {type: AttackType.Parry, amountModifier: 0};
         }
      }

      // Step 4: Glance check (only for white attacks)
      if (!attack.isSpecialAttack) {
         cumulative += this.glancingChance;
         if (roll < cumulative) {
            return {
               type: AttackType.Glancing,
               amountModifier: this.getGlancingDamageModifier()
            };
         }
      }

      // Step 5: Block check (only if in front)
      if (attack.inFrontOfEnemy && !attack.isSpecialAttack) {
         cumulative += this.blockChance;
         if (roll < cumulative) {
            return {type: AttackType.Block, amountModifier: 0};
         }
      }

      // Step 6: Critical strike check
      const critChance = this.stats.attackCritChance(attack) / 100;
      cumulative += critChance;
      if (roll < cumulative) {
         return {type: AttackType.Crit, amountModifier: 2.0};
      }

      // Step 7: Regular hit (fallback)
      return {type: AttackType.Hit, amountModifier: 1.0};
   }
}
