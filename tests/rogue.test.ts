import {AttackType, GearStats, RogueTalents, SimulationConfig, WeaponType} from '../src/types';
import {AttackTable} from '../src/mechanics/AttackTable';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';

describe('Rogue Talents', () => {
  const baseStats: GearStats = {
    level: 60,
    attackPower: 1200,
    critChance: 30,
    hitChance: 9,
    agility: 300,
    strength: 100,
    weaponSkill: 300,
    mainHandWeapon: {
      minDamage: 76,
      maxDamage: 142,
      speed: 1.7,
      type: WeaponType.Dagger,
    },
    offHandWeapon: {
      minDamage: 68,
      maxDamage: 132,
      speed: 1.5,
      type: WeaponType.Dagger,
    },
  };

  const config: SimulationConfig = {
    fightLength: 60,
    targetLevel: 63,
    targetArmor: 4000,
    iterations: 1,
  };

  const baseTalents: RogueTalents = {
    malice: 0,
    murder: 0,
    improvedSinisterStrike: 0,
    improvedEviscerate: 0,
    relentlessStrikes: 0,
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
  };

  it('should increase crit chance by 1% per point in malice', () => {
    const testCases = [
      { malice: 0, expectedCritBonus: 0 },
      { malice: 1, expectedCritBonus: 1 },
      { malice: 2, expectedCritBonus: 2 },
      { malice: 3, expectedCritBonus: 3 },
      { malice: 4, expectedCritBonus: 4 },
      { malice: 5, expectedCritBonus: 5 },
    ];

    testCases.forEach(({ malice, expectedCritBonus }) => {
      const talents: RogueTalents = {
        ...baseTalents,
        malice,
      };

      const statsWithMalice: GearStats = {
        ...baseStats,
        critChance: baseStats.critChance + expectedCritBonus,
      };

      const attackTable = new AttackTable(statsWithMalice, config);

      const numRolls = 10000;
      let crits = 0;

      for (let i = 0; i < numRolls; i++) {
        const result = attackTable.roll(true);
        if (result.type === AttackType.Crit) {
          crits++;
        }
      }

      const observedCritRate = (crits / numRolls) * 100;
      const expectedCritRate = baseStats.critChance + expectedCritBonus;

      expect(observedCritRate).toBeGreaterThan(expectedCritRate - 1);
      expect(observedCritRate).toBeLessThan(expectedCritRate + 1);
    });
  });

  it('should apply malice talent bonus to base crit chance', () => {
    const baseCrit = 30;
    const malicePoints = 5;
    const expectedTotalCrit = baseCrit + (malicePoints * 1);

    const talents: RogueTalents = {
      ...baseTalents,
      malice: malicePoints,
    };

    const statsWithMalice: GearStats = {
      ...baseStats,
      critChance: expectedTotalCrit,
    };

    const attackTable = new AttackTable(statsWithMalice, config);

    const numRolls = 10000;
    let crits = 0;

    for (let i = 0; i < numRolls; i++) {
      const result = attackTable.roll(true);
      if (result.type === 'Crit') {
        crits++;
      }
    }

    const observedCritRate = (crits / numRolls) * 100;

    expect(observedCritRate).toBeGreaterThanOrEqual(expectedTotalCrit - 1.5);
    expect(observedCritRate).toBeLessThanOrEqual(expectedTotalCrit + 1.5);
  });

  it('should handle maximum malice (5 points) correctly', () => {
    const baseCrit = 25;
    const malicePoints = 5;
    const expectedTotalCrit = baseCrit + 5;

    const talents: RogueTalents = {
      ...baseTalents,
      malice: malicePoints,
    };

    const statsWithMalice: GearStats = {
      ...baseStats,
      critChance: expectedTotalCrit,
    };

    const attackTable = new AttackTable(statsWithMalice, config);

    const numRolls = 20000;
    let crits = 0;

    for (let i = 0; i < numRolls; i++) {
      const result = attackTable.roll(true);
      if (result.type === 'Crit') {
        crits++;
      }
    }

    const observedCritRate = (crits / numRolls) * 100;

    expect(observedCritRate).toBeGreaterThan(expectedTotalCrit - 1.5);
    expect(observedCritRate).toBeLessThan(expectedTotalCrit + 1.5);
  });
});

describe('Opportunity Talent', () => {
  const baseStats: GearStats = {
    level: 60,
    attackPower: 1200,
    critChance: 0,
    hitChance: 100,
    agility: 300,
    strength: 100,
    weaponSkill: 305,
    mainHandWeapon: {
      minDamage: 100,
      maxDamage: 100,
      speed: 1.7,
      type: WeaponType.Dagger,
    },
  };

  const config: SimulationConfig = {
    fightLength: 60,
    targetLevel: 60,
    targetArmor: 0,
    iterations: 1,
  };

  const baseTalents: RogueTalents = {
    malice: 0,
    murder: 0,
    improvedSinisterStrike: 0,
    improvedEviscerate: 0,
    relentlessStrikes: 0,
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
  };

  it('should increase backstab damage by 4% per point in opportunity', () => {
    const testCases = [
      { opportunity: 1, expectedMultiplier: 1.04 },
      { opportunity: 3, expectedMultiplier: 1.12 },
      { opportunity: 5, expectedMultiplier: 1.20 },
    ];

    testCases.forEach(({ opportunity, expectedMultiplier }) => {
      const talents: RogueTalents = {
        ...baseTalents,
        opportunity,
      };

      const calculator = new RogueDamageCalculator(baseStats, config, talents);

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
      const calculatorNoOpportunity = new RogueDamageCalculator(baseStats, config, talentsWithoutOpportunity);

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

    const calculator = new RogueDamageCalculator(baseStats, config, talentsWithOpportunity);
    const calculatorNoOpportunity = new RogueDamageCalculator(baseStats, config, baseTalents);

    const ssResult = calculator.calculateSinisterStrikeDamage();
    const ssResultNoOpportunity = calculatorNoOpportunity.calculateSinisterStrikeDamage();

    expect(ssResult.baseAmount).toBe(ssResultNoOpportunity.baseAmount);
  });

  it('should calculate backstab damage correctly with maximum opportunity (5 points)', () => {
    const talents: RogueTalents = {
      ...baseTalents,
      opportunity: 5,
    };

    const calculator = new RogueDamageCalculator(baseStats, config, talents);
    const calculatorNoOpportunity = new RogueDamageCalculator(baseStats, config, baseTalents);

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
