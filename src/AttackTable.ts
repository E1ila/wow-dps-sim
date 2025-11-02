import { AttackResult, AttackTableResult, CharacterStats, SimulationConfig } from './types.js';

export class AttackTable {
  private readonly missChance: number;
  private readonly dodgeChance: number;
  private readonly glancingChance: number;

  constructor(
    private stats: CharacterStats,
    private config: SimulationConfig
  ) {
    this.missChance = this.calculateMissChance();
    this.dodgeChance = this.calculateDodgeChance();
    this.glancingChance = this.calculateGlancingChance();
  }

  private calculateMissChance(): number {
    const targetDefense = this.config.targetLevel * 5;
    const weaponSkill = this.stats.weaponSkill;
    const defenseSkillDiff = targetDefense - weaponSkill;

    let baseMissChance: number;
    if (defenseSkillDiff >= 11) {
      baseMissChance = 0.05 + (defenseSkillDiff * 0.002);
    } else {
      baseMissChance = 0.05 + (defenseSkillDiff * 0.001);
    }

    const missReduction = this.stats.hitChance / 100;
    let missChance = baseMissChance - missReduction;

    if (this.stats.offHandWeapon) {
      missChance = (missChance * 0.8) + 0.2;
    }

    return Math.max(0, missChance);
  }

  private calculateDodgeChance(): number {
    const baseDodge = this.config.targetLevel === 63 ? 0.065 : 0.05;
    const weaponSkillOver300 = Math.max(0, this.stats.weaponSkill - 300);
    const dodgeReduction = weaponSkillOver300 * 0.0004;

    return Math.max(0, baseDodge - dodgeReduction);
  }

  private calculateGlancingChance(): number {
    const targetLevel = this.config.targetLevel;
    const playerLevel = this.stats.level;
    const weaponSkill = this.stats.weaponSkill;

    if (targetLevel < playerLevel) {
      return 0;
    }

    const targetDefense = targetLevel * 5;
    const effectiveSkill = Math.min(playerLevel * 5, weaponSkill);
    const skillDiff = targetDefense - effectiveSkill;

    const glancingChance = 0.1 + (skillDiff * 0.02);
    return Math.max(0, Math.min(0.4, glancingChance));
  }

  private calculateGlancingDamageModifier(): number {
    const weaponSkill = this.stats.weaponSkill;
    const targetLevel = this.config.targetLevel;
    const targetDefense = targetLevel * 5;

    if (targetLevel <= this.stats.level) {
      return 0.95;
    }

    if (weaponSkill >= 308) {
      return 0.95;
    } else if (weaponSkill >= 305) {
      return 0.85;
    } else if (weaponSkill >= 300) {
      return 0.65;
    }

    const lowEnd = 0.01;
    const highEnd = 0.05;
    const skillDiff = targetDefense - weaponSkill;
    const penalty = Math.min(0.6, skillDiff * 0.015);

    return Math.max(lowEnd, highEnd + 0.6 - penalty);
  }

  roll(isSpecialAttack: boolean = false): AttackTableResult {
    const roll = Math.random();
    let cumulative = 0;

    cumulative += this.missChance;
    if (roll < cumulative) {
      return { result: AttackResult.Miss, damageModifier: 0 };
    }

    cumulative += this.dodgeChance;
    if (roll < cumulative) {
      return { result: AttackResult.Dodge, damageModifier: 0 };
    }

    if (!isSpecialAttack) {
      cumulative += this.glancingChance;
      if (roll < cumulative) {
        return {
          result: AttackResult.Glancing,
          damageModifier: this.calculateGlancingDamageModifier()
        };
      }
    }

    const critChance = this.stats.critChance / 100;
    cumulative += critChance;
    if (roll < cumulative) {
      return { result: AttackResult.Crit, damageModifier: 2.0 };
    }

    return { result: AttackResult.Hit, damageModifier: 1.0 };
  }

  rollCrit(): boolean {
    return Math.random() < (this.stats.critChance / 100);
  }
}
