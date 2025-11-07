import {AttackTable} from '../src/mechanics/AttackTable';
import {createTestStats, wrapStats} from './fixtures';

describe('Attack Table Mechanics', () => {
  describe('Single-Wield against Level 63 Raid Boss', () => {
    it('should have 8.0% miss and 40% glancing (65% damage) with 300 skill', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).baseMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(8.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(65, 1);
    });

    it('should have 6.0% miss and 40% glancing (85% damage) with 305 skill', () => {
      const stats = createTestStats(305, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).baseMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(6.0, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(85, 1);
    });

    it('should have 5.7% miss and 40% glancing (95% damage) with 308 skill', () => {
      const stats = createTestStats(308, false);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const missChance = (attackTable as any).baseMissChance;
      const glancingChance = (attackTable as any).glancingChance;
      const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

      expect(missChance * 100).toBeCloseTo(5.7, 1);
      expect(glancingChance * 100).toBeCloseTo(40, 1);
      expect(glancingDamage * 100).toBeCloseTo(95, 1);
    });
  });

  describe('Dual-Wield Miss Calculation', () => {
    it('should add 19% DW penalty to base miss with 300 skill', () => {
      const stats = createTestStats(300, true);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);
      const yellowAttackMiss = (attackTable as any).baseMissChance;

      // DW adds 19% to white attacks only
      expect(whiteAttackMiss * 100).toBeCloseTo((yellowAttackMiss + 0.19) * 100, 1);
      expect(whiteAttackMiss * 100).toBeCloseTo(27.0, 1); // 8% base + 19% = 27%
    });

    it('should add 19% DW penalty to base miss with 305 skill', () => {
      const stats = createTestStats(305, true);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);
      const yellowAttackMiss = (attackTable as any).baseMissChance;

      expect(whiteAttackMiss * 100).toBeCloseTo((yellowAttackMiss + 0.19) * 100, 1);
      expect(whiteAttackMiss * 100).toBeCloseTo(25.0, 1); // 6% base + 19% = 25%
    });

    it('should add 19% DW penalty to base miss with 308 skill', () => {
      const stats = createTestStats(308, true);
      const attackTable = new AttackTable(wrapStats(stats, 63));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);
      const yellowAttackMiss = (attackTable as any).baseMissChance;

      expect(whiteAttackMiss * 100).toBeCloseTo((yellowAttackMiss + 0.19) * 100, 1);
      expect(whiteAttackMiss * 100).toBeCloseTo(24.7, 1); // 5.7% base + 19% = 24.7%
    });
  });

  describe('Hit Cap Verification', () => {
    describe('300 weapon skill', () => {
      it('should have correct white attack miss chances with varying hit percentages', () => {
        const skill = 300;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 26, expectedMissMax: 28 },
          { hitPercent: 3, expectedMissMin: 23, expectedMissMax: 25 },
          { hitPercent: 6, expectedMissMin: 20, expectedMissMax: 22 },
          { hitPercent: 9, expectedMissMin: 17, expectedMissMax: 20 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).getMissChance(true);

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });

    describe('305 weapon skill', () => {
      it('should have correct white attack miss chances with varying hit percentages', () => {
        const skill = 305;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 24, expectedMissMax: 26 },
          { hitPercent: 3, expectedMissMin: 21, expectedMissMax: 23 },
          { hitPercent: 6, expectedMissMin: 18, expectedMissMax: 20 },
          { hitPercent: 9, expectedMissMin: 15, expectedMissMax: 18 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).getMissChance(true);

          expect(missChance * 100).toBeGreaterThanOrEqual(expectedMissMin);
          expect(missChance * 100).toBeLessThanOrEqual(expectedMissMax);
        });
      });
    });

    describe('308 weapon skill', () => {
      it('should have correct white attack miss chances with varying hit percentages', () => {
        const skill = 308;
        const testCases = [
          { hitPercent: 0, expectedMissMin: 24, expectedMissMax: 26 },
          { hitPercent: 3, expectedMissMin: 21, expectedMissMax: 23 },
          { hitPercent: 6, expectedMissMin: 18, expectedMissMax: 20 },
          { hitPercent: 9, expectedMissMin: 15, expectedMissMax: 18 },
        ];

        testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
          const stats = createTestStats(skill, true);
          stats.hitChance = hitPercent;
          const attackTable = new AttackTable(wrapStats(stats, 63));
          const missChance = (attackTable as any).getMissChance(true);

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

      const missChance = (attackTable as any).baseMissChance;
      expect(missChance * 100).toBeCloseTo(5.0, 1);
    });

    it('should have 10% glancing with 300 skill against level 60', () => {
      const stats = createTestStats(300, false);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const glancingChance = (attackTable as any).glancingChance;
      expect(glancingChance * 100).toBeCloseTo(10, 1);
    });

    it('should have ~24% DW white miss with 300 skill and 0% hit against level 60', () => {
      const stats = createTestStats(300, true);
      stats.hitChance = 0;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);
      const baseMiss = (attackTable as any).baseMissChance;

      expect(whiteAttackMiss * 100).toBeCloseTo((baseMiss + 0.19) * 100, 1);
      expect(whiteAttackMiss * 100).toBeCloseTo(24, 1);
    });

    it('should have 23.5% white miss with 305 skill against level 60 (DW)', () => {
      const stats = createTestStats(305, true);
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);
      const baseMiss = (attackTable as any).baseMissChance;

      expect(whiteAttackMiss * 100).toBeCloseTo((baseMiss + 0.19) * 100, 1);
      expect(whiteAttackMiss * 100).toBeCloseTo(23.5, 1); // 4.5% base + 19% = 23.5%
    });

    it('should reach 0% miss with sufficient hit rating against level 60', () => {
      const stats = createTestStats(300, false);
      stats.hitChance = 5;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const missChance = (attackTable as any).baseMissChance;
      expect(missChance * 100).toBeCloseTo(0, 1);
    });

    it('should have reduced DW white miss with hit rating against level 60', () => {
      const testCases = [
        { hitPercent: 0, expectedMissMin: 23, expectedMissMax: 25 },
        { hitPercent: 3, expectedMissMin: 20, expectedMissMax: 22 },
        { hitPercent: 6, expectedMissMin: 17, expectedMissMax: 20 },
      ];

      testCases.forEach(({ hitPercent, expectedMissMin, expectedMissMax }) => {
        const stats = createTestStats(300, true);
        stats.hitChance = hitPercent;
        const attackTable = new AttackTable(wrapStats(stats, 60));
        const missChance = (attackTable as any).getMissChance(true);

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

    it('should approach 19% DW miss floor with high hit rating against level 60', () => {
      const stats = createTestStats(300, true);
      stats.hitChance = 20;
      const attackTable = new AttackTable(wrapStats(stats, 60));

      const whiteAttackMiss = (attackTable as any).getMissChance(true);

      // Base miss floor is 0, DW adds 19%
      expect(whiteAttackMiss * 100).toBeCloseTo(19, 1);
      expect(whiteAttackMiss * 100).toBeGreaterThan(18);
      expect(whiteAttackMiss * 100).toBeLessThan(20);
    });
  });
});
