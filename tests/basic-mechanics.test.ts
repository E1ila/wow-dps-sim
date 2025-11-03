import {GearStats, SimulationConfig, WeaponType} from '../src/types';
import {AttackTable, AttackTableStatsProvider} from '../src/mechanics/AttackTable';

describe('Attack Table Mechanics', () => {
  const createTestStats = (weaponSkill: number, hasOffHand: boolean = true): GearStats => ({
    level: 60,
    attackPower: 1000,
    critChance: 30,
    hitChance: 0,
    agility: 300,
    strength: 100,
    weaponSkill,
    mainHandWeapon: {
      minDamage: 100,
      maxDamage: 150,
      speed: 2.0,
      type: WeaponType.Sword,
    },
    offHandWeapon: hasOffHand ? {
      minDamage: 80,
      maxDamage: 120,
      speed: 2.0,
      type: WeaponType.Sword,
    } : undefined,
  });

  const wrapStats = (stats: GearStats): AttackTableStatsProvider => ({
    get critChance() { return stats.critChance; },
    get weaponSkill() { return stats.weaponSkill; },
    get hitChance() { return stats.hitChance; },
    get playerLevel() { return stats.level; },
    get isDualWielding() { return stats.offHandWeapon !== undefined; },
  });

  const raidBossConfig: SimulationConfig = {
    fightLength: 60,
    targetLevel: 63,
    targetArmor: 3731,
    iterations: 1,
  };

  describe('Single-Wield against Level 63 Raid Boss', () => {
    it('should have 8.0% miss and 40% glancing (65% damage) with 300 skill', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(8.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(65, 1);
    });

    it('should have 6.0% miss and 40% glancing (85% damage) with 305 skill', () => {
      const stats = createTestStats(305, false);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(6.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(85, 1);
    });

    it('should have 5.7% miss and 40% glancing (95% damage) with 308 skill', () => {
      const stats = createTestStats(308, false);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(5.7, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(95, 1);
    });
  });

  describe('Dual-Wield Miss Calculation', () => {
    it('should calculate DW miss as (base_miss × 0.8) + 20% with 300 skill', () => {
      const stats = createTestStats(300, true);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const targetDefense = 315;
      const defenseSkillDiff = targetDefense - 300;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });

    it('should calculate DW miss as (base_miss × 0.8) + 20% with 305 skill', () => {
      const stats = createTestStats(305, true);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const targetDefense = 315;
      const defenseSkillDiff = targetDefense - 305;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });

    it('should calculate DW miss as (base_miss × 0.8) + 20% with 308 skill', () => {
      const stats = createTestStats(308, true);
      const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);

      const missChance = (attackTable as any).mhMissChance;
      const targetDefense = 315;
      const defenseSkillDiff = targetDefense - 308;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });
  });

  describe('Hit Cap Verification', () => {
    describe('300 weapon skill', () => {
      it('should have correct miss chances with varying hit percentages', () => {
        const skill = 300;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 26, expectedMissMax: 27 },
          { hitPercent: 3, expectedMissMin: 23, expectedMissMax: 25 },
          { hitPercent: 6, expectedMissMin: 20, expectedMissMax: 22 },
          { hitPercent: 9, expectedMissMin: 17, expectedMissMax: 20 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);
          const missChance = (attackTable as any).mhMissChance;

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });

    describe('305 weapon skill', () => {
      it('should have correct miss chances with varying hit percentages', () => {
        const skill = 305;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 24, expectedMissMax: 25 },
          { hitPercent: 3, expectedMissMin: 21, expectedMissMax: 23 },
          { hitPercent: 6, expectedMissMin: 18, expectedMissMax: 20 },
          { hitPercent: 9, expectedMissMin: 15, expectedMissMax: 18 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);
          const missChance = (attackTable as any).mhMissChance;

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });

    describe('308 weapon skill', () => {
      it('should have correct miss chances with varying hit percentages', () => {
        const skill = 308;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 24, expectedMissMax: 25 },
          { hitPercent: 3, expectedMissMin: 21, expectedMissMax: 23 },
          { hitPercent: 6, expectedMissMin: 18, expectedMissMax: 20 },
          { hitPercent: 9, expectedMissMin: 15, expectedMissMax: 18 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats), raidBossConfig);
          const missChance = (attackTable as any).mhMissChance;

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });
  });
});
