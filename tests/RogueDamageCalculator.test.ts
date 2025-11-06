import {
  AttackType,
  Buff,
  CharacterClass,
  GearStats,
  PlayerStatsProvider,
  RogueTalents,
  SimulationConfig,
  TargetType,
  WeaponEnchant,
  WeaponType
} from '../src/types';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';
import {SimulationSpec} from '../src/SpecLoader';
import {BuffsProvider} from '../src/mechanics/DamageCalculator';

const createMockBuffsProvider = (activeBuffs: string[] = []): BuffsProvider => ({
  hasBuff: (name: string) => activeBuffs.includes(name)
});

const createMockStatsProvider = (spec: SimulationSpec, buffsProvider: BuffsProvider): PlayerStatsProvider => {
  const baseAttackPower = spec.gearStats.attackPower;
  return {
    critChance: () => spec.gearStats.critChance,
    get weaponSkill() { return spec.gearStats.weaponSkill; },
    get attackPower() {
      let ap = baseAttackPower;
      if (buffsProvider.hasBuff(Buff.Crusader)) {
        ap += 100;
      }
      return ap;
    },
    get hitChance() { return spec.gearStats.hitChance; },
    get playerLevel() { return spec.playerLevel; },
    get isDualWielding() { return spec.gearStats.offHandWeapon !== undefined; },
    get targetLevel() { return spec.targetLevel; },
    get haste() { return 1; }
  };
};

// Helper to create calculator with standard mocks
const createCalculator = (spec: SimulationSpec, activeBuffs: string[] = []): RogueDamageCalculator => {
  const buffs = createMockBuffsProvider(activeBuffs);
  return new RogueDamageCalculator(spec, buffs, createMockStatsProvider(spec, buffs));
};

const baseStats: GearStats = {
  attackPower: 1200,
  critChance: 30,
  hitChance: 9,
  agility: 300,
  strength: 100,
  weaponSkill: 300,
  mainHandWeapon: {
    minDamage: 100,
    maxDamage: 100,
    speed: 2.0,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.None
  },
  offHandWeapon: {
    minDamage: 80,
    maxDamage: 80,
    speed: 1.5,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.None
  },
};

const config: SimulationConfig = {
  fightLength: 60,
  targetLevel: 63,
  targetArmor: 3700,
  iterations: 1,
};

const baseTalents: RogueTalents = {
  malice: 0,
  murder: 0,
  improvedSinisterStrike: 0,
  improvedEviscerate: 0,
  relentlessStrikes: false,
  ruthlessness: 0,
  lethality: 0,
  sealFate: 0,
  coldBlood: false,
  improvedSliceAndDice: 0,
  daggerSpecialization: 0,
  swordSpecialization: 0,
  maceSpecialization: 0,
  fistWeaponSpecialization: 0,
  bladeFurry: false,
  adrenalineRush: false,
  aggression: 0,
  dualWieldSpecialization: 0,
  opportunity: 0,
  improvedBackstab: 0,
  hemorrhage: false,
  precision: 0,
  weaponExpertise: 0,
  vigor: false,
};

function createTestSpec(stats: GearStats, config: SimulationConfig, talents: RogueTalents): SimulationSpec {
  return {
    name: 'test',
    description: 'test spec',
    class: CharacterClass.Rogue,
    playerLevel: 60,
    gearStats: stats,
    simulationConfig: config,
    talents,
    fightLength: config.fightLength ?? 60,
    targetLevel: config.targetLevel,
    targetArmor: config.targetArmor,
    targetType: config.targetType,
    iterations: config.iterations ?? 1,
    postCycleResourceGeneration: config.postCycleResourceGeneration ?? false,
  };
}

describe('RogueDamageCalculator', () => {

  describe('Dual Wield Specialization', () => {
    it('should return correct bonus percentage', () => {
      const testCases = [
        {dwSpec: 0, expectedBonus: 0},
        {dwSpec: 1, expectedBonus: 0.05},
        {dwSpec: 2, expectedBonus: 0.10},
        {dwSpec: 3, expectedBonus: 0.15},
        {dwSpec: 4, expectedBonus: 0.20},
        {dwSpec: 5, expectedBonus: 0.25},
      ];

      testCases.forEach(({dwSpec, expectedBonus}) => {
        const talents = {...baseTalents, dualWieldSpecialization: dwSpec};
        const calculator = createCalculator(createTestSpec(baseStats, config, talents));

        expect(calculator.dualWieldSpecBonus).toBeCloseTo(expectedBonus, 5);
      });
    });
  });

  describe('Sinister Strike', () => {
    it('should calculate base damage correctly', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      // weaponDamage (100) + SINISTER_STRIKE_7 (68) + AP contribution (Math.round((1200/14)*2.0) = 171)
      const expectedBase = 100 + 68 + Math.round((1200 / 14) * 2.0);
      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should apply aggression talent bonus to actual damage', () => {
      const talentsNoAggro = {...baseTalents, aggression: 0};
      const talentsWithAggro = {...baseTalents, aggression: 3};

      const calcNoAggro = createCalculator(createTestSpec(baseStats, config, talentsNoAggro));
      const calcWithAggro = createCalculator(createTestSpec(baseStats, config, talentsWithAggro));

      const numTrials = 5000;
      let totalNoAggro = 0;
      let totalWithAggro = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoAggro = calcNoAggro.calculateSinisterStrikeDamage();
        const resultWithAggro = calcWithAggro.calculateSinisterStrikeDamage();

        if (resultNoAggro.amount > 0) totalNoAggro += resultNoAggro.amount;
        if (resultWithAggro.amount > 0) totalWithAggro += resultWithAggro.amount;
      }

      const expectedMultiplier = 1.06;
      expect(totalWithAggro / totalNoAggro).toBeGreaterThan(expectedMultiplier - 0.08);
      expect(totalWithAggro / totalNoAggro).toBeLessThan(expectedMultiplier + 0.08);
    });

    it('should apply lethality talent bonus to actual damage', () => {
      const talentsNoLeth = {...baseTalents, lethality: 0};
      const talentsWithLeth = {...baseTalents, lethality: 5};

      const calcNoLeth = createCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = createCalculator(createTestSpec(baseStats, config, talentsWithLeth));

      const numTrials = 5000;
      let totalNoLeth = 0;
      let totalWithLeth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoLeth = calcNoLeth.calculateSinisterStrikeDamage();
        const resultWithLeth = calcWithLeth.calculateSinisterStrikeDamage();

        if (resultNoLeth.amount > 0) totalNoLeth += resultNoLeth.amount;
        if (resultWithLeth.amount > 0) totalWithLeth += resultWithLeth.amount;
      }

      const expectedMultiplier = 1.30;
      expect(totalWithLeth / totalNoLeth).toBeGreaterThan(expectedMultiplier - 0.10);
      expect(totalWithLeth / totalNoLeth).toBeLessThan(expectedMultiplier + 0.10);
    });

    it('should stack aggression and lethality', () => {
      const talentsNone = {...baseTalents};
      const talentsBoth = {...baseTalents, aggression: 5, lethality: 5};

      const calcNone = createCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcBoth = createCalculator(createTestSpec(baseStats, config, talentsBoth));

      const numTrials = 5000;
      let totalNone = 0;
      let totalBoth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNone = calcNone.calculateSinisterStrikeDamage();
        const resultBoth = calcBoth.calculateSinisterStrikeDamage();

        if (resultNone.amount > 0) totalNone += resultNone.amount;
        if (resultBoth.amount > 0) totalBoth += resultBoth.amount;
      }

      const expectedMultiplier = 1.10 * 1.30;
      expect(totalBoth / totalNone).toBeGreaterThan(expectedMultiplier - 0.10);
      expect(totalBoth / totalNone).toBeLessThan(expectedMultiplier + 0.10);
    });
  });

  describe('Backstab', () => {
    it('should calculate base damage correctly', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateBackstabDamage();

      Math.random = originalRandom;

      // (weaponDamage (100) + BACKSTAB_9 (225) + AP contribution (Math.round((1200/14)*2.0) = 171)) * 1.5
      const expectedBase = (100 + 225 + Math.round((1200 / 14) * 2.0)) * 1.5;
      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should apply opportunity talent bonus', () => {
      const talentsNoOpp = {...baseTalents, opportunity: 0};
      const talentsWithOpp = {...baseTalents, opportunity: 5};

      const calcNoOpp = createCalculator(createTestSpec(baseStats, config, talentsNoOpp));
      const calcWithOpp = createCalculator(createTestSpec(baseStats, config, talentsWithOpp));

      const numTrials = 5000;
      let totalNoOpp = 0;
      let totalWithOpp = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoOpp = calcNoOpp.calculateBackstabDamage();
        const resultWithOpp = calcWithOpp.calculateBackstabDamage();

        if (resultNoOpp.amount > 0) totalNoOpp += resultNoOpp.amount;
        if (resultWithOpp.amount > 0) totalWithOpp += resultWithOpp.amount;
      }

      const expectedMultiplier = 1.20;
      expect(totalWithOpp / totalNoOpp).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithOpp / totalNoOpp).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should apply lethality talent bonus', () => {
      const talentsNoLeth = {...baseTalents, lethality: 0};
      const talentsWithLeth = {...baseTalents, lethality: 5};

      const calcNoLeth = createCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = createCalculator(createTestSpec(baseStats, config, talentsWithLeth));

      const numTrials = 5000;
      let totalNoLeth = 0;
      let totalWithLeth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoLeth = calcNoLeth.calculateBackstabDamage();
        const resultWithLeth = calcWithLeth.calculateBackstabDamage();

        if (resultNoLeth.amount > 0) totalNoLeth += resultNoLeth.amount;
        if (resultWithLeth.amount > 0) totalWithLeth += resultWithLeth.amount;
      }

      const expectedMultiplier = 1.30;
      expect(totalWithLeth / totalNoLeth).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithLeth / totalNoLeth).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should stack opportunity and lethality', () => {
      const talentsNone = {...baseTalents};
      const talentsBoth = {...baseTalents, opportunity: 5, lethality: 5};

      const calcNone = createCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcBoth = createCalculator(createTestSpec(baseStats, config, talentsBoth));

      const numTrials = 5000;
      let totalNone = 0;
      let totalBoth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNone = calcNone.calculateBackstabDamage();
        const resultBoth = calcBoth.calculateBackstabDamage();

        if (resultNone.amount > 0) totalNone += resultNone.amount;
        if (resultBoth.amount > 0) totalBoth += resultBoth.amount;
      }

      const expectedMultiplier = 1.20 * 1.30;
      expect(totalBoth / totalNone).toBeGreaterThan(expectedMultiplier - 0.10);
      expect(totalBoth / totalNone).toBeLessThan(expectedMultiplier + 0.10);
    });
  });

  describe('Eviscerate', () => {
    it('should calculate base damage correctly for each combo point level', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      // EVISCERATE_9 = [[224,332],[394,502],[564,672],[734,842],[904,1012]]
      // At Math.random = 0.5, cpDamage = min + 0.5 * (max - min) = min + 54
      // apBonus = calcAttackPowerDamage(weapon) * comboPoints * 0.03
      // calcAttackPowerDamage = Math.round((1200 / 14) * 2.0) = 171
      const apPerPoint = Math.round((1200 / 14) * 2.0);
      const expectedBaseDamage = [
        0, // dummy for index 0
        Math.round(278 + apPerPoint * 1 * 0.03), // 1 CP: 278 + 5.13 = 283
        Math.round(448 + apPerPoint * 2 * 0.03), // 2 CP: 448 + 10.26 = 458
        Math.round(618 + apPerPoint * 3 * 0.03), // 3 CP: 618 + 15.39 = 633
        Math.round(788 + apPerPoint * 4 * 0.03), // 4 CP: 788 + 20.52 = 809
        Math.round(958 + apPerPoint * 5 * 0.03), // 5 CP: 958 + 25.65 = 984
      ];

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      for (let cp = 1; cp <= 5; cp++) {
        const result = calculator.calculateEviscerateDamage(cp);
        expect(result.baseAmount).toBe(expectedBaseDamage[cp]);
      }

      Math.random = originalRandom;
    });

    it('should apply improved eviscerate talent bonus', () => {
      const talentsNoImp = {...baseTalents, improvedEviscerate: 0};
      const talentsWithImp = {...baseTalents, improvedEviscerate: 3};

      const calcNoImp = createCalculator(createTestSpec(baseStats, config, talentsNoImp));
      const calcWithImp = createCalculator(createTestSpec(baseStats, config, talentsWithImp));

      const numTrials = 5000;
      let totalNoImp = 0;
      let totalWithImp = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoImp = calcNoImp.calculateEviscerateDamage(5);
        const resultWithImp = calcWithImp.calculateEviscerateDamage(5);

        if (resultNoImp.amount > 0) totalNoImp += resultNoImp.amount;
        if (resultWithImp.amount > 0) totalWithImp += resultWithImp.amount;
      }

      const expectedMultiplier = 1.15;
      expect(totalWithImp / totalNoImp).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithImp / totalNoImp).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should apply aggression talent bonus', () => {
      const talentsNoAggro = {...baseTalents, aggression: 0};
      const talentsWithAggro = {...baseTalents, aggression: 5};

      const calcNoAggro = createCalculator(createTestSpec(baseStats, config, talentsNoAggro));
      const calcWithAggro = createCalculator(createTestSpec(baseStats, config, talentsWithAggro));

      const numTrials = 5000;
      let totalNoAggro = 0;
      let totalWithAggro = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoAggro = calcNoAggro.calculateEviscerateDamage(5);
        const resultWithAggro = calcWithAggro.calculateEviscerateDamage(5);

        if (resultNoAggro.amount > 0) totalNoAggro += resultNoAggro.amount;
        if (resultWithAggro.amount > 0) totalWithAggro += resultWithAggro.amount;
      }

      const expectedMultiplier = 1.10;
      expect(totalWithAggro / totalNoAggro).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithAggro / totalNoAggro).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should apply lethality talent bonus', () => {
      const talentsNoLeth = {...baseTalents, lethality: 0};
      const talentsWithLeth = {...baseTalents, lethality: 5};

      const calcNoLeth = createCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = createCalculator(createTestSpec(baseStats, config, talentsWithLeth));

      const numTrials = 5000;
      let totalNoLeth = 0;
      let totalWithLeth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoLeth = calcNoLeth.calculateEviscerateDamage(5);
        const resultWithLeth = calcWithLeth.calculateEviscerateDamage(5);

        if (resultNoLeth.amount > 0) totalNoLeth += resultNoLeth.amount;
        if (resultWithLeth.amount > 0) totalWithLeth += resultWithLeth.amount;
      }

      const expectedMultiplier = 1.30;
      expect(totalWithLeth / totalNoLeth).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithLeth / totalNoLeth).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should stack all three eviscerate talent bonuses', () => {
      const talentsNone = {...baseTalents};
      const talentsAll = {
        ...baseTalents,
        improvedEviscerate: 3,
        aggression: 5,
        lethality: 5,
      };

      const calcNone = createCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcAll = createCalculator(createTestSpec(baseStats, config, talentsAll));

      const numTrials = 5000;
      let totalNone = 0;
      let totalAll = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNone = calcNone.calculateEviscerateDamage(5);
        const resultAll = calcAll.calculateEviscerateDamage(5);

        if (resultNone.amount > 0) totalNone += resultNone.amount;
        if (resultAll.amount > 0) totalAll += resultAll.amount;
      }

      const expectedMultiplier = 1.15 * 1.10 * 1.30;
      expect(totalAll / totalNone).toBeGreaterThan(expectedMultiplier - 0.10);
      expect(totalAll / totalNone).toBeLessThan(expectedMultiplier + 0.10);
    });

    it('should scale linearly with combo points', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result1 = calculator.calculateEviscerateDamage(1);
      const result2 = calculator.calculateEviscerateDamage(2);
      const result3 = calculator.calculateEviscerateDamage(3);

      Math.random = originalRandom;

      expect(result2.baseAmount).toBeGreaterThan(result1.baseAmount);
      expect(result3.baseAmount).toBeGreaterThan(result2.baseAmount);
    });
  });

  describe('Auto Attack', () => {
    it('should calculate mainhand auto attack base damage', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateAutoAttackDamage(false);

      Math.random = originalRandom;

      const expectedWeaponDamage = 100;
      const expectedAPBonus = Math.round((1200 / 14) * 2.0);
      const expectedBase = expectedWeaponDamage + expectedAPBonus;

      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should apply dual wield penalty to mainhand final damage', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const numTrials = 5000;
      let totalDamage = 0;
      let hitCount = 0;

      for (let i = 0; i < numTrials; i++) {
        const result = calculator.calculateAutoAttackDamage(false);
        if (result.amount > 0) {
          totalDamage += result.amount;
          hitCount++;
        }
      }

      const avgDamage = totalDamage / hitCount;
      const expectedWeaponDamage = 100;
      const expectedAPBonus = (1200 / 14) * 2.0;
      const expectedFullDamage = expectedWeaponDamage + expectedAPBonus;

      expect(avgDamage).toBeLessThan(expectedFullDamage * 0.9);
    });

    it('should NOT apply dual wield penalty to offhand', () => {
      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateAutoAttackDamage(true);

      Math.random = originalRandom;

      const expectedWeaponDamage = 80;
      const expectedAPBonus = Math.round((1200 / 14) * 1.5);
      const expectedBase = expectedWeaponDamage + expectedAPBonus;

      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should benefit from dual wield specialization on mainhand', () => {
      const talentsNoDW = {...baseTalents, dualWieldSpecialization: 0};
      const talentsWithDW = {...baseTalents, dualWieldSpecialization: 5};

      const calcNoDW = createCalculator(createTestSpec(baseStats, config, talentsNoDW));
      const calcWithDW = createCalculator(createTestSpec(baseStats, config, talentsWithDW));

      const numTrials = 5000;
      let totalNoDW = 0;
      let totalWithDW = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoDW = calcNoDW.calculateAutoAttackDamage(false);
        const resultWithDW = calcWithDW.calculateAutoAttackDamage(false);

        if (resultNoDW.amount > 0) totalNoDW += resultNoDW.amount;
        if (resultWithDW.amount > 0) totalWithDW += resultWithDW.amount;
      }

      const expectedRatio = (0.5 + 0.25) / 0.5;
      expect(totalWithDW / totalNoDW).toBeGreaterThan(expectedRatio - 0.06);
      expect(totalWithDW / totalNoDW).toBeLessThan(expectedRatio + 0.06);
    });

    it('should return NoWeapon result when offhand does not exist', () => {
      const statsNoOffhand = {
        ...baseStats,
        offHandWeapon: undefined,
      };
      const calculator = createCalculator(createTestSpec(statsNoOffhand, config, baseTalents));

      const result = calculator.calculateAutoAttackDamage(true);

      expect(result.type).toBe(AttackType.NoWeapon);
      expect(result.amount).toBe(0);
    });
  });

  describe('Armor Reduction', () => {
    it('should reduce damage based on target armor', () => {
      const lowArmorConfig = {...config, targetArmor: 0};
      const highArmorConfig = {...config, targetArmor: 5000};

      const calcLowArmor = createCalculator(createTestSpec(baseStats, lowArmorConfig, baseTalents));
      const calcHighArmor = createCalculator(createTestSpec(baseStats, highArmorConfig, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const resultLowArmor = calcLowArmor.calculateSinisterStrikeDamage();
      const resultHighArmor = calcHighArmor.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      expect(resultLowArmor.amount).toBeGreaterThan(resultHighArmor.amount);
    });

    it('should have same base damage regardless of armor', () => {
      const lowArmorConfig = {...config, targetArmor: 0};
      const highArmorConfig = {...config, targetArmor: 5000};

      const calcLowArmor = createCalculator(createTestSpec(baseStats, lowArmorConfig, baseTalents));
      const calcHighArmor = createCalculator(createTestSpec(baseStats, highArmorConfig, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const resultLowArmor = calcLowArmor.calculateSinisterStrikeDamage();
      const resultHighArmor = calcHighArmor.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      expect(resultLowArmor.baseAmount).toBe(resultHighArmor.baseAmount);
    });
  });

  describe('Crusader Enchant Buff', () => {
    it('should increase attack power by 100 when Crusader buff is active', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const calcWithBuff = createCalculator(createTestSpec(baseStats, config, baseTalents), [Buff.Crusader]);
      const resultWithBuff = calcWithBuff.calculateAutoAttackDamage(false);

      const calcWithoutBuff = createCalculator(createTestSpec(baseStats, config, baseTalents));
      const resultWithoutBuff = calcWithoutBuff.calculateAutoAttackDamage(false);

      Math.random = originalRandom;

      const weaponSpeed = 2.0;
      // With buff: Math.round((1300/14)*2.0) = 186, Without: Math.round((1200/14)*2.0) = 171
      const expectedDamageIncrease = Math.round((1300 / 14) * weaponSpeed) - Math.round((1200 / 14) * weaponSpeed);

      expect(resultWithBuff.baseAmount - resultWithoutBuff.baseAmount).toBe(expectedDamageIncrease);
    });

    it('should increase Eviscerate damage when Crusader buff is active', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const comboPoints = 5;
      const calcWithBuff = createCalculator(createTestSpec(baseStats, config, baseTalents), [Buff.Crusader]);
      const resultWithBuff = calcWithBuff.calculateEviscerateDamage(comboPoints);

      const calcWithoutBuff = createCalculator(createTestSpec(baseStats, config, baseTalents));
      const resultWithoutBuff = calcWithoutBuff.calculateEviscerateDamage(comboPoints);

      Math.random = originalRandom;

      // Crusader adds 100 AP
      // Without: apBonus = 171 * 5 * 0.03 = 25.65, baseDamage = Math.round(958 + 25.65) = 984
      // With: apBonus = 186 * 5 * 0.03 = 27.9, baseDamage = Math.round(958 + 27.9) = 986
      // Difference = 2
      const apWithout = Math.round((1200 / 14) * 2.0);
      const apWith = Math.round((1300 / 14) * 2.0);
      const cpDamage = 958; // at random 0.5 and 5 CP
      const expectedWithout = Math.round(cpDamage + apWithout * comboPoints * 0.03);
      const expectedWith = Math.round(cpDamage + apWith * comboPoints * 0.03);
      const expectedDamageIncrease = expectedWith - expectedWithout;

      expect(resultWithBuff.baseAmount - resultWithoutBuff.baseAmount).toBe(expectedDamageIncrease);
    });

    it('should not increase attack power when Crusader buff is not active', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const calculator = createCalculator(createTestSpec(baseStats, config, baseTalents));
      const result1 = calculator.calculateAutoAttackDamage(false);
      const result2 = calculator.calculateAutoAttackDamage(false);

      Math.random = originalRandom;

      expect(result1.baseAmount).toBe(result2.baseAmount);
    });
  });

  describe('Murder Talent', () => {
    it('should return correct multiplier for each talent point', () => {
      const testCases = [
        {murder: 0, expectedMultiplier: 1.00, targetType: TargetType.Humanoid},
        {murder: 1, expectedMultiplier: 1.01, targetType: TargetType.Humanoid},
        {murder: 2, expectedMultiplier: 1.02, targetType: TargetType.Humanoid},
        {murder: 0, expectedMultiplier: 1.00, targetType: TargetType.Beast},
        {murder: 1, expectedMultiplier: 1.01, targetType: TargetType.Beast},
        {murder: 2, expectedMultiplier: 1.02, targetType: TargetType.Beast},
        {murder: 0, expectedMultiplier: 1.00, targetType: TargetType.Dragonkin},
        {murder: 1, expectedMultiplier: 1.01, targetType: TargetType.Dragonkin},
        {murder: 2, expectedMultiplier: 1.02, targetType: TargetType.Dragonkin},
        {murder: 0, expectedMultiplier: 1.00, targetType: TargetType.Undefined},
        {murder: 1, expectedMultiplier: 1.00, targetType: TargetType.Undefined},
        {murder: 2, expectedMultiplier: 1.00, targetType: TargetType.Undefined},
      ];

      testCases.forEach(({murder, expectedMultiplier, targetType}) => {
        const talents = {...baseTalents, murder};
        const configWithTarget = {...config, targetType};
        const calculator = createCalculator(createTestSpec(baseStats, configWithTarget, talents));

        expect(calculator.autoAttackMultiplier).toBe(expectedMultiplier);
      });
    });

    it('should increase actual auto attack damage against humanoids', () => {
      const talentsNoMurder = {...baseTalents, murder: 0};
      const talentsWithMurder = {...baseTalents, murder: 2};
      const configWithTarget = {...config, targetType: TargetType.Humanoid};

      const calcNoMurder = createCalculator(createTestSpec(baseStats, configWithTarget, talentsNoMurder));
      const calcWithMurder = createCalculator(createTestSpec(baseStats, configWithTarget, talentsWithMurder));

      const numTrials = 20000;
      let totalNoMurder = 0;
      let totalWithMurder = 0;
      const originalRandom = Math.random;
      Math.random = () => 0.9;

      for (let i = 0; i < numTrials; i++) {
        const resultNoMurder = calcNoMurder.calculateAutoAttackDamage(false);
        const resultWithMurder = calcWithMurder.calculateAutoAttackDamage(false);

        if (resultNoMurder.amount > 0) totalNoMurder += resultNoMurder.amount;
        if (resultWithMurder.amount > 0) totalWithMurder += resultWithMurder.amount;
      }
      Math.random = originalRandom;

      // maybe with armor and other multiplier in % it's not a perfect 1.02
      const expectedMultiplier = 1.018;
      expect(totalWithMurder / totalNoMurder).toBeGreaterThan(expectedMultiplier - 0.005);
      expect(totalWithMurder / totalNoMurder).toBeLessThan(expectedMultiplier + 0.005);
    });
  });

  describe('Opportunity', () => {

    it('should increase backstab damage by 4% per point in opportunity', () => {
      const testCases = [
        {opportunity: 1, expectedMultiplier: 1.04},
        {opportunity: 3, expectedMultiplier: 1.12},
        {opportunity: 5, expectedMultiplier: 1.20},
      ];

      testCases.forEach(({opportunity, expectedMultiplier}) => {
        const talents: RogueTalents = {
          ...baseTalents,
          opportunity,
        };

        const calculator = createCalculator(createTestSpec(baseStats, config, talents));

        const numRolls = 5000;
        let totalDamage = 0;
        let hitCount = 0;

        for (let i = 0; i < numRolls; i++) {
          const result = calculator.calculateBackstabDamage();
          if (result.type === 'Hit') {
            totalDamage += result.amount;
            hitCount++;
          }
        }

        const talentsWithoutOpportunity: RogueTalents = {
          ...baseTalents,
          opportunity: 0,
        };
        const calculatorNoOpportunity = createCalculator(createTestSpec(baseStats, config, talentsWithoutOpportunity));

        let totalDamageNoOpportunity = 0;
        let hitCountNoOpportunity = 0;
        for (let i = 0; i < numRolls; i++) {
          const result = calculatorNoOpportunity.calculateBackstabDamage();
          if (result.type === 'Hit') {
            totalDamageNoOpportunity += result.amount;
            hitCountNoOpportunity++;
          }
        }

        const avgDamage = totalDamage / hitCount;
        const avgDamageNoOpportunity = totalDamageNoOpportunity / hitCountNoOpportunity;
        const actualMultiplier = avgDamage / avgDamageNoOpportunity;

        expect(actualMultiplier).toBeGreaterThan(expectedMultiplier - 0.02);
        expect(actualMultiplier).toBeLessThan(expectedMultiplier + 0.02);
      });
    });

    it('should apply opportunity only to backstab, not other abilities', () => {
      const talentsWithOpportunity: RogueTalents = {
        ...baseTalents,
        opportunity: 5,
      };

      const calculator = createCalculator(createTestSpec(baseStats, config, talentsWithOpportunity));
      const calculatorNoOpportunity = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      const fixedRandomValue = 0.5;
      Math.random = () => fixedRandomValue;

      const ssResult = calculator.calculateSinisterStrikeDamage();
      const ssResultNoOpportunity = calculatorNoOpportunity.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      expect(ssResult.baseAmount).toBe(ssResultNoOpportunity.baseAmount);
    });

    it('should calculate backstab damage correctly with maximum opportunity (5 points)', () => {
      const talents: RogueTalents = {
        ...baseTalents,
        opportunity: 5,
      };

      const calculator = createCalculator(createTestSpec(baseStats, config, talents));
      const calculatorNoOpportunity = createCalculator(createTestSpec(baseStats, config, baseTalents));

      const numRolls = 10000;
      let totalDamageWithOpportunity = 0;
      let totalDamageWithoutOpportunity = 0;
      let hitCountWith = 0;
      let hitCountWithout = 0;

      for (let i = 0; i < numRolls; i++) {
        const resultWith = calculator.calculateBackstabDamage();
        if (resultWith.type === 'Hit') {
          totalDamageWithOpportunity += resultWith.amount;
          hitCountWith++;
        }

        const resultWithout = calculatorNoOpportunity.calculateBackstabDamage();
        if (resultWithout.type === 'Hit') {
          totalDamageWithoutOpportunity += resultWithout.amount;
          hitCountWithout++;
        }
      }

      const avgDamageWith = totalDamageWithOpportunity / hitCountWith;
      const avgDamageWithout = totalDamageWithoutOpportunity / hitCountWithout;
      const damageIncrease = avgDamageWith / avgDamageWithout;

      expect(damageIncrease).toBeGreaterThan(1.18);
      expect(damageIncrease).toBeLessThan(1.22);
    });
  });

});
