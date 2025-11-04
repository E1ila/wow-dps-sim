import {Ability, AttackType, CharacterClass, GearStats, RogueTalents, SimulationConfig, WeaponType} from '../src/types';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';
import {SimulationSpec} from '../src/SpecLoader';

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
  },
  offHandWeapon: {
    minDamage: 80,
    maxDamage: 80,
    speed: 1.5,
    type: WeaponType.Dagger,
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
    iterations: config.iterations ?? 1,
    postResGen: config.postResGen ?? false,
  };
}

describe('RogueDamageCalculator', () => {
  describe('Precision Talent', () => {
    it('should increase hit chance by 1% per point', () => {
      const testCases = [
        {precision: 0, expectedHit: 9},
        {precision: 1, expectedHit: 10},
        {precision: 2, expectedHit: 11},
        {precision: 3, expectedHit: 12},
        {precision: 4, expectedHit: 13},
        {precision: 5, expectedHit: 14},
      ];

      testCases.forEach(({precision, expectedHit}) => {
        const talents = {...baseTalents, precision};
        const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

        expect(calculator.hitChance).toBe(expectedHit);
      });
    });
  });

  describe('Weapon Expertise Talent', () => {
    it('should increase weapon skill by 3 for 1 point with daggers', () => {
      const talents = {...baseTalents, weaponExpertise: 1};
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

      expect(calculator.weaponSkill).toBe(303);
    });

    it('should increase weapon skill by 5 for 2 points with daggers', () => {
      const talents = {...baseTalents, weaponExpertise: 2};
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

      expect(calculator.weaponSkill).toBe(305);
    });

    it('should increase weapon skill by 3 for 1 point with swords', () => {
      const swordStats = {
        ...baseStats,
        mainHandWeapon: {...baseStats.mainHandWeapon, type: WeaponType.Sword},
      };
      const talents = {...baseTalents, weaponExpertise: 1};
      const calculator = new RogueDamageCalculator(createTestSpec(swordStats, config, talents));

      expect(calculator.weaponSkill).toBe(303);
    });

    it('should increase weapon skill by 3 for 1 point with fist weapons', () => {
      const fistStats = {
        ...baseStats,
        mainHandWeapon: {...baseStats.mainHandWeapon, type: WeaponType.Fist},
      };
      const talents = {...baseTalents, weaponExpertise: 1};
      const calculator = new RogueDamageCalculator(createTestSpec(fistStats, config, talents));

      expect(calculator.weaponSkill).toBe(303);
    });

    it('should NOT increase weapon skill with maces', () => {
      const maceStats = {
        ...baseStats,
        mainHandWeapon: {...baseStats.mainHandWeapon, type: WeaponType.Mace},
      };
      const talents = {...baseTalents, weaponExpertise: 2};
      const calculator = new RogueDamageCalculator(createTestSpec(maceStats, config, talents));

      expect(calculator.weaponSkill).toBe(300);
    });
  });

  describe('Malice Talent', () => {
    it('should increase crit chance by 1% per point', () => {
      const testCases = [
        {malice: 0, expectedCrit: 30},
        {malice: 1, expectedCrit: 31},
        {malice: 3, expectedCrit: 33},
        {malice: 5, expectedCrit: 35},
      ];

      testCases.forEach(({malice, expectedCrit}) => {
        const talents = {...baseTalents, malice};
        const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

        const critChance = calculator.critChance({
          ability: Ability.MainHand,
          isSpecialAttack: false,
          weapon: baseStats.mainHandWeapon,
        });

        expect(critChance).toBe(expectedCrit);
      });
    });
  });

  describe('Dagger Specialization Talent', () => {
    it('should increase crit chance by 1% per point for dagger attacks', () => {
      const testCases = [
        {daggerSpec: 0, expectedCrit: 30},
        {daggerSpec: 1, expectedCrit: 31},
        {daggerSpec: 3, expectedCrit: 33},
        {daggerSpec: 5, expectedCrit: 35},
      ];

      testCases.forEach(({daggerSpec, expectedCrit}) => {
        const talents = {...baseTalents, daggerSpecialization: daggerSpec};
        const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

        const critChance = calculator.critChance({
          ability: Ability.Backstab,
          isSpecialAttack: true,
          weapon: baseStats.mainHandWeapon,
        });

        expect(critChance).toBe(expectedCrit);
      });
    });

    it('should NOT increase crit chance for non-dagger attacks', () => {
      const swordStats = {
        ...baseStats,
        mainHandWeapon: {...baseStats.mainHandWeapon, type: WeaponType.Sword},
      };
      const talents = {...baseTalents, daggerSpecialization: 5};
      const calculator = new RogueDamageCalculator(createTestSpec(swordStats, config, talents));

      const critChance = calculator.critChance({
        ability: Ability.SinisterStrike,
        isSpecialAttack: true,
        weapon: swordStats.mainHandWeapon,
      });

      expect(critChance).toBe(30);
    });

    it('should stack with malice talent', () => {
      const talents = {...baseTalents, malice: 5, daggerSpecialization: 5};
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

      const critChance = calculator.critChance({
        ability: Ability.Backstab,
        isSpecialAttack: true,
        weapon: baseStats.mainHandWeapon,
      });

      expect(critChance).toBe(40);
    });
  });

  describe('Improved Backstab Talent', () => {
    it('should increase backstab crit chance by 10% per point', () => {
      const testCases = [
        {improvedBS: 0, expectedCrit: 30},
        {improvedBS: 1, expectedCrit: 40},
        {improvedBS: 2, expectedCrit: 50},
        {improvedBS: 3, expectedCrit: 60},
      ];

      testCases.forEach(({improvedBS, expectedCrit}) => {
        const talents = {...baseTalents, improvedBackstab: improvedBS};
        const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

        const critChance = calculator.critChance({
          ability: Ability.Backstab,
          isSpecialAttack: true,
          weapon: baseStats.mainHandWeapon,
        });

        expect(critChance).toBe(expectedCrit);
      });
    });

    it('should NOT affect other abilities', () => {
      const talents = {...baseTalents, improvedBackstab: 3};
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

      const critChance = calculator.critChance({
        ability: Ability.SinisterStrike,
        isSpecialAttack: true,
        weapon: baseStats.mainHandWeapon,
      });

      expect(critChance).toBe(30);
    });

    it('should stack with malice and dagger specialization', () => {
      const talents = {
        ...baseTalents,
        malice: 5,
        daggerSpecialization: 5,
        improvedBackstab: 3,
      };
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

      const critChance = calculator.critChance({
        ability: Ability.Backstab,
        isSpecialAttack: true,
        weapon: baseStats.mainHandWeapon,
      });

      expect(critChance).toBe(70);
    });
  });

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
        const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, talents));

        expect(calculator.dualWieldSpecBonus).toBeCloseTo(expectedBonus, 5);
      });
    });
  });

  describe('Sinister Strike', () => {
    it('should calculate base damage correctly', () => {
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      expect(result.baseAmount).toBe(168);
    });

    it('should apply aggression talent bonus to actual damage', () => {
      const talentsNoAggro = {...baseTalents, aggression: 0};
      const talentsWithAggro = {...baseTalents, aggression: 3};

      const calcNoAggro = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoAggro));
      const calcWithAggro = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithAggro));

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

      const calcNoLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithLeth));

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

      const calcNone = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcBoth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsBoth));

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
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateBackstabDamage();

      Math.random = originalRandom;

      const expectedBase = (100 + 210) * 1.5;
      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should apply opportunity talent bonus', () => {
      const talentsNoOpp = {...baseTalents, opportunity: 0};
      const talentsWithOpp = {...baseTalents, opportunity: 5};

      const calcNoOpp = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoOpp));
      const calcWithOpp = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithOpp));

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

      const calcNoLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithLeth));

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

      const calcNone = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcBoth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsBoth));

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

  describe('Hemorrhage', () => {
    it('should calculate base damage correctly', () => {
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateHemorrhageDamage();

      Math.random = originalRandom;

      const expectedBase = (100 + 110) * 1.1;
      expect(result.baseAmount).toBe(expectedBase);
    });

    it('should apply lethality talent bonus', () => {
      const talentsNoLeth = {...baseTalents, lethality: 0};
      const talentsWithLeth = {...baseTalents, lethality: 5};

      const calcNoLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithLeth));

      const numTrials = 5000;
      let totalNoLeth = 0;
      let totalWithLeth = 0;

      for (let i = 0; i < numTrials; i++) {
        const resultNoLeth = calcNoLeth.calculateHemorrhageDamage();
        const resultWithLeth = calcWithLeth.calculateHemorrhageDamage();

        if (resultNoLeth.amount > 0) totalNoLeth += resultNoLeth.amount;
        if (resultWithLeth.amount > 0) totalWithLeth += resultWithLeth.amount;
      }

      const expectedMultiplier = 1.30;
      expect(totalWithLeth / totalNoLeth).toBeGreaterThan(expectedMultiplier - 0.05);
      expect(totalWithLeth / totalNoLeth).toBeLessThan(expectedMultiplier + 0.05);
    });

    it('should NOT apply opportunity or aggression bonuses', () => {
      const talentsNone = {...baseTalents};
      const talentsOthers = {...baseTalents, opportunity: 5, aggression: 5};

      const calcNone = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcOthers = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsOthers));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const resultNone = calcNone.calculateHemorrhageDamage();
      const resultOthers = calcOthers.calculateHemorrhageDamage();

      Math.random = originalRandom;

      expect(resultOthers.baseAmount).toBe(resultNone.baseAmount);
    });
  });

  describe('Eviscerate', () => {
    it('should calculate base damage correctly for each combo point level', () => {
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const expectedBaseDamage = [
        0,
        223 + (1200 * 0.03 * 1),
        325 + (1200 * 0.03 * 2),
        427 + (1200 * 0.03 * 3),
        529 + (1200 * 0.03 * 4),
        631 + (1200 * 0.03 * 5),
      ];

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      for (let cp = 1; cp <= 5; cp++) {
        const result = calculator.calculateEviscerateDamage(cp);
        expect(result.baseAmount).toBeCloseTo(expectedBaseDamage[cp], 1);
      }

      Math.random = originalRandom;
    });

    it('should apply improved eviscerate talent bonus', () => {
      const talentsNoImp = {...baseTalents, improvedEviscerate: 0};
      const talentsWithImp = {...baseTalents, improvedEviscerate: 3};

      const calcNoImp = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoImp));
      const calcWithImp = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithImp));

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

      const calcNoAggro = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoAggro));
      const calcWithAggro = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithAggro));

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

      const calcNoLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoLeth));
      const calcWithLeth = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithLeth));

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

      const calcNone = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNone));
      const calcAll = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsAll));

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
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

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
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateAutoAttackDamage(false);

      Math.random = originalRandom;

      const expectedWeaponDamage = 100;
      const expectedAPBonus = (1200 / 14) * 2.0;
      const expectedBase = expectedWeaponDamage + expectedAPBonus;

      expect(result.baseAmount).toBeCloseTo(expectedBase, 1);
    });

    it('should apply dual wield penalty to mainhand final damage', () => {
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

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
      const calculator = new RogueDamageCalculator(createTestSpec(baseStats, config, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const result = calculator.calculateAutoAttackDamage(true);

      Math.random = originalRandom;

      const expectedWeaponDamage = 80;
      const expectedAPBonus = (1200 / 14) * 1.5;
      const expectedBase = expectedWeaponDamage + expectedAPBonus;

      expect(result.baseAmount).toBeCloseTo(expectedBase, 1);
    });

    it('should benefit from dual wield specialization on mainhand', () => {
      const talentsNoDW = {...baseTalents, dualWieldSpecialization: 0};
      const talentsWithDW = {...baseTalents, dualWieldSpecialization: 5};

      const calcNoDW = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsNoDW));
      const calcWithDW = new RogueDamageCalculator(createTestSpec(baseStats, config, talentsWithDW));

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
      expect(totalWithDW / totalNoDW).toBeGreaterThan(expectedRatio - 0.05);
      expect(totalWithDW / totalNoDW).toBeLessThan(expectedRatio + 0.05);
    });

    it('should return NoWeapon result when offhand does not exist', () => {
      const statsNoOffhand = {
        ...baseStats,
        offHandWeapon: undefined,
      };
      const calculator = new RogueDamageCalculator(createTestSpec(statsNoOffhand, config, baseTalents));

      const result = calculator.calculateAutoAttackDamage(true);

      expect(result.type).toBe(AttackType.NoWeapon);
      expect(result.amount).toBe(0);
    });
  });

  describe('Armor Reduction', () => {
    it('should reduce damage based on target armor', () => {
      const lowArmorConfig = {...config, targetArmor: 0};
      const highArmorConfig = {...config, targetArmor: 5000};

      const calcLowArmor = new RogueDamageCalculator(createTestSpec(baseStats, lowArmorConfig, baseTalents));
      const calcHighArmor = new RogueDamageCalculator(createTestSpec(baseStats, highArmorConfig, baseTalents));

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

      const calcLowArmor = new RogueDamageCalculator(createTestSpec(baseStats, lowArmorConfig, baseTalents));
      const calcHighArmor = new RogueDamageCalculator(createTestSpec(baseStats, highArmorConfig, baseTalents));

      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const resultLowArmor = calcLowArmor.calculateSinisterStrikeDamage();
      const resultHighArmor = calcHighArmor.calculateSinisterStrikeDamage();

      Math.random = originalRandom;

      expect(resultLowArmor.baseAmount).toBe(resultHighArmor.baseAmount);
    });
  });
});
