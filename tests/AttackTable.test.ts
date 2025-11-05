import {GearStats, WeaponEnchant, WeaponType} from '../src/types';
import {AttackTable, PlayerStatsProvider} from '../src/mechanics/AttackTable';

describe('Attack Table Mechanics', () => {
  const createTestStats = (weaponSkill: number, hasOffHand: boolean = true): GearStats => ({
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
      enchant: WeaponEnchant.None,
    },
    offHandWeapon: hasOffHand ? {
      minDamage: 80,
      maxDamage: 120,
      speed: 2.0,
      type: WeaponType.Sword,
      enchant: WeaponEnchant.None,
    } : undefined,
  });

  const wrapStats = (gearStats: GearStats, targetLevel: number): PlayerStatsProvider => ({
    critChance: () => gearStats.critChance,
    get weaponSkill() { return gearStats.weaponSkill; },
    get hitChance() { return gearStats.hitChance; },
    get playerLevel() { return 60; },
    get targetLevel() { return targetLevel; },
    get isDualWielding() { return gearStats.offHandWeapon !== undefined; },
  });

  describe('Single-Wield against Level 63 Raid Boss', () => {
    it('should have 8.0% miss and 40% glancing (65% damage) with 300 skill', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(8.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(65, 1);
    });

    it('should have 6.0% miss and 40% glancing (85% damage) with 305 skill', () => {
      const stats = createTestStats(305, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(6.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(85, 1);
    });

    it('should have 5.7% miss and 40% glancing (95% damage) with 308 skill', () => {
      const stats = createTestStats(308, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
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
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
      const targetDefense = 315;
      const defenseSkillDiff = targetDefense - 300;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });

    it('should calculate DW miss as (base_miss × 0.8) + 20% with 305 skill', () => {
      const stats = createTestStats(305, true);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
      const targetDefense = 315;
      const defenseSkillDiff = targetDefense - 305;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });

    it('should calculate DW miss as (base_miss × 0.8) + 20% with 308 skill', () => {
      const stats = createTestStats(308, true);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).missChance;
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
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).missChance;

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
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).missChance;

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
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).missChance;

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });
  });

  describe('Target Level 60 (Same Level)', () => {
    it('should have 5.0% miss with 300 skill against level 60', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).missChance;
      expect(missChance * 100).toBeCloseTo(5.0, 1);
    });

    it('should have 10% glancing with 300 skill against level 60', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const glancingChance = (attackTable as any).glancingChance;
      expect(glancingChance * 100).toBeCloseTo(10, 1);
    });

    it('should have ~24% DW miss with 300 skill and 0% hit against level 60', () => {
      const stats = createTestStats(300, true);
      stats.hitChance = 0;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).missChance;
      const targetDefense = 300;
      const defenseSkillDiff = targetDefense - 300;

      const skillModifier = defenseSkillDiff >= 11 ? 0.002 : 0.001;
      const baseMissNoHit = 0.05 + (defenseSkillDiff * skillModifier);
      const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
      expect(missChance * 100).toBeCloseTo(24, 1);
    });

    it('should have 4.5% miss with 305 skill against level 60 (DW)', () => {
      const stats = createTestStats(305, true);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).missChance;
      const targetDefense = 300;
      const defenseSkillDiff = targetDefense - 305;

      const baseMiss = 0.05 + (defenseSkillDiff * 0.001);
      const expectedDWMiss = (baseMiss * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedDWMiss * 100, 1);
    });

    it('should reach 0% miss with sufficient hit rating against level 60', () => {
      const stats = createTestStats(300, false);
      stats.hitChance = 5;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).missChance;
      expect(missChance * 100).toBeCloseTo(0, 1);
    });

    it('should have reduced DW miss with hit rating against level 60', () => {
      const testCases = [
        { hitPercent: 0, expectedMissMin: 23, expectedMissMax: 25 },
        { hitPercent: 3, expectedMissMin: 20, expectedMissMax: 22 },
        { hitPercent: 6, expectedMissMin: 17, expectedMissMax: 20 },
      ];

      testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
        const stats = createTestStats(300, true);
        stats.hitChance = hitPercent;
        const attackTable = new AttackTable(wrapStats(stats, 60));
        const missChance = (attackTable as any).missChance;

        expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
        expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
      });
    });

    it('should still have 10% glancing with 305 skill against level 60', () => {
      const stats = createTestStats(305, false);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const glancingChance = (attackTable as any).glancingChance;
      expect(glancingChance * 100).toBeCloseTo(10, 1);
    });

    it('should have better glancing damage with higher skill against level 60', () => {
      const testCases = [
        { skill: 300, expectedDamage: 95 },
        { skill: 305, expectedDamage: 95 },
        { skill: 308, expectedDamage: 95 },
      ];

      testCases.forEach(({ skill, expectedDamage }) => {
        const stats = createTestStats(skill, false);
        const attackTable = new AttackTable(wrapStats(stats, 60));
        const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

        expect(glancingDamage * 100).toBeCloseTo(expectedDamage, 1);
      });
    });

    it('should approach ~8% DW miss floor with high hit rating against level 60', () => {
      const stats = createTestStats(300, true);
      stats.hitChance = 20;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).missChance;

      const baseMiss = 0.05 - 0.2;
      const expectedMiss = (baseMiss * 0.8) + 0.2;

      expect(missChance * 100).toBeCloseTo(expectedMiss * 100, 1);
      expect(missChance * 100).toBeGreaterThan(7);
      expect(missChance * 100).toBeLessThan(9);
    });
  });
});
