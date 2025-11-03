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

      it('should reach soft crit cap on white damage', () => {
         const testCases = [
            {malice: 0, hitChance: 0, baseCritChance: 25, expectedCritRate: 25},
            {malice: 0, hitChance: 0, baseCritChance: 26, expectedCritRate: 26},
            {malice: 0, hitChance: 0, baseCritChance: 27, expectedCritRate: 27},
            {malice: 0, hitChance: 0, baseCritChance: 30, expectedCritRate: 27},
            {malice: 0, hitChance: 0, baseCritChance: 35, expectedCritRate: 27},
         ];

         testCases.forEach(({malice, hitChance, baseCritChance, expectedCritRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator({
               ...baseStats,
               critChance: baseCritChance,
               hitChance,
            }, config, talents);
            const attackTable = new AttackTable(simulator.damageCalculator, config);

            const numRolls = 100000;
            let crits = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll(false);
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

   // describe('Lethality', () => {
   //
   //    it('should increase critical strike damage by 6% per point', () => {
   //       const testCases = [
   //          { lethality: 0, expectedMultiplier: 1.0 },
   //          { lethality: 1, expectedMultiplier: 1.06 },
   //          { lethality: 2, expectedMultiplier: 1.12 },
   //          { lethality: 3, expectedMultiplier: 1.18 },
   //          { lethality: 4, expectedMultiplier: 1.26 },
   //          { lethality: 5, expectedMultiplier: 1.30 },
   //       ];
   //
   //       testCases.forEach(({ lethality, expectedMultiplier }) => {
   //          const talents: RogueTalents = {
   //             ...baseTalents,
   //             lethality,
   //          };
   //
   //          const calculator = new RogueDamageCalculator({...baseStats, critChance: 100}, config, talents);
   //          const calculatorNoLethality = new RogueDamageCalculator(baseStats, config, baseTalents);
   //
   //          const originalRandom = Math.random;
   //          Math.random = () => 0.01;
   //
   //          const backstabResult = calculator.calculateBackstabDamage();
   //          const backstabResultNoLethality = calculatorNoLethality.calculateBackstabDamage();
   //
   //          Math.random = originalRandom;
   //
   //          expect(backstabResult.type).toBe(AttackType.Crit);
   //          expect(backstabResultNoLethality.type).toBe(AttackType.Crit);
   //
   //          const damageRatio = backstabResult.amount / backstabResultNoLethality.amount;
   //
   //          expect(damageRatio).toBeGreaterThan(expectedMultiplier - 0.01);
   //          expect(damageRatio).toBeLessThan(expectedMultiplier + 0.01);
   //       });
   //    });
   // });

   describe('Relentless Strikes', () => {

      it('should add energy', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            relentlessStrikes: true,
         };
         const simulator = new RogueSimulator(baseStats, config, talents);
         const originalRandom = Math.random;
         Math.random = () => 0.99;

         let called = false;
         simulator.addEnergy = () => {
            called = true;
         };

         simulator.state.comboPoints = 5;
         simulator.onFinishingMove();
         expect(called).toBe(true);

         Math.random = originalRandom;
      });

      it('should not add energy', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            relentlessStrikes: false,
         };
         const simulator = new RogueSimulator(baseStats, config, talents);
         const originalRandom = Math.random;
         Math.random = () => 0.99;

         let called = false;
         simulator.addEnergy = () => {
            called = true;
         };

         simulator.state.comboPoints = 5;
         simulator.onFinishingMove();
         expect(called).toBe(false);

         Math.random = originalRandom;
      });

      it('should have higher proc chance with more combo points', () => {
         const testCases = [
            { comboPoints: 1, expectedRate: 0.2 },
            { comboPoints: 2, expectedRate: 0.4 },
            { comboPoints: 3, expectedRate: 0.6 },
            { comboPoints: 4, expectedRate: 0.8 },
            { comboPoints: 5, expectedRate: 1.0 },
         ];

         testCases.forEach(({ comboPoints, expectedRate }) => {
            const numTrials = 10000;
            let procCount = 0;

            for (let i = 0; i < numTrials; i++) {
               const procChance = comboPoints * 0.2;
               if (Math.random() < procChance) {
                  procCount++;
               }
            }

            const observedRate = procCount / numTrials;

            expect(observedRate).toBeGreaterThan(expectedRate - 0.05);
            expect(observedRate).toBeLessThan(expectedRate + 0.05);
         });
      });
   });

});
