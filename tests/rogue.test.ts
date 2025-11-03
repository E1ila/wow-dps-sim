import {AttackType, GearStats, RogueTalents, SimulationConfig, WeaponType} from '../src/types';
import {AttackTable} from '../src/mechanics/AttackTable';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';
import {RogueSimulator} from '../src/sim/RogueSimulator';

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

describe('Rogue Talents', () => {

   describe('Malice', () => {

      it('should increase simulator.critChance by 1% per point in malice', () => {
         const testCases = [
            {malice: 0, expectedCritChance: 30},
            {malice: 1, expectedCritChance: 31},
            {malice: 2, expectedCritChance: 32},
            {malice: 3, expectedCritChance: 33},
            {malice: 4, expectedCritChance: 34},
            {malice: 5, expectedCritChance: 35},
         ];

         testCases.forEach(({malice, expectedCritChance}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator(baseStats, config, talents);

            expect(simulator.critChance).toBe(expectedCritChance);
         });
      });

      it('should apply malice to actual attack table rolls', () => {
         const testCases = [
            {malice: 0, expectedCritRate: 30},
            {malice: 3, expectedCritRate: 33},
            {malice: 5, expectedCritRate: 35},
         ];

         testCases.forEach(({malice, expectedCritRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator(baseStats, config, talents);
            const attackTable = new AttackTable(simulator.damageCalculator, config);

            const numRolls = 100000;
            let crits = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll(true);
               if (result.type === AttackType.Crit) {
                  crits++;
               }
            }

            const observedCritRate = (crits / numRolls) * 100;

            expect(observedCritRate).toBeGreaterThan(expectedCritRate - 1);
            expect(observedCritRate).toBeLessThan(expectedCritRate + 1);
         });
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

});
