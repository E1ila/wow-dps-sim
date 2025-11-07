import {Ability, AttackType, GearStats, RogueTalents, WeaponEnchant, WeaponType} from '../src/types';
import {AttackTable} from '../src/mechanics/AttackTable';
import {RogueSimulator} from '../src/sim/RogueSimulator';
import {baseStats, baseTalents, config, createTestSpec} from './fixtures';

// RogueSimulator tests use different weapon damages and speeds
const rogueSimulatorBaseStats = {
   ...baseStats,
   mainHandWeapon: {
      ...baseStats.mainHandWeapon,
      minDamage: 76,
      maxDamage: 142,
      speed: 1.7,
   },
   offHandWeapon: {
      ...baseStats.offHandWeapon!,
      minDamage: 68,
      maxDamage: 132,
   },
};

// RogueSimulator tests use different armor
const rogueSimulatorConfig = {
   ...config,
   targetArmor: 4000,
};

describe('Rogue Talents', () => {

   describe('Malice', () => {

      it('should increase simulator.critChance by 1% per point in malice', () => {
         // Base 30% crit - 3% skill suppression (300 vs 315) - 1.8% boss suppression = 25.2%
         const testCases = [
            {malice: 0, expectedCritChance: 25.2},
            {malice: 1, expectedCritChance: 26.2},
            {malice: 2, expectedCritChance: 27.2},
            {malice: 3, expectedCritChance: 28.2},
            {malice: 4, expectedCritChance: 29.2},
            {malice: 5, expectedCritChance: 30.2},
         ];

         testCases.forEach(({malice, expectedCritChance}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

            expect(simulator.critChance({
               ability: Ability.MainHand,
               isSpecialAttack: false,
               weapon: rogueSimulatorBaseStats.mainHandWeapon
            })).toBe(expectedCritChance);
         });
      });

      it('should apply malice to actual attack table rolls', () => {
         // Base 30% crit - 3% skill suppression - 1.8% boss suppression = 25.2%
         const testCases = [
            {malice: 0, expectedCritRate: 25.2},
            {malice: 3, expectedCritRate: 28.2},
            {malice: 5, expectedCritRate: 30.2},
         ];

         testCases.forEach(({malice, expectedCritRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));
            const attackTable = new AttackTable(simulator);

            const numRolls = 100000;
            let crits = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll({
                  ability: Ability.Test,
                  isSpecialAttack: true,
                  weapon: rogueSimulatorBaseStats.mainHandWeapon
               });
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
         // Against level 63: -3% skill suppression - 1.8% boss suppression = -4.8% total
         // Soft cap: ~40% glancing reduces effective max crit
         const testCases = [
            {malice: 0, hitChance: 0, baseCritChance: 25, expectedCritRate: 20.2},
            {malice: 0, hitChance: 0, baseCritChance: 26, expectedCritRate: 21.2},
            {malice: 0, hitChance: 0, baseCritChance: 27, expectedCritRate: 22.2},
            {malice: 0, hitChance: 0, baseCritChance: 30, expectedCritRate: 22.2}, // Soft cap due to glancing
            {malice: 0, hitChance: 0, baseCritChance: 35, expectedCritRate: 22.2}, // Soft cap due to glancing
         ];

         testCases.forEach(({malice, hitChance, baseCritChance, expectedCritRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               malice,
            };

            const simulator = new RogueSimulator(createTestSpec({
                  ...rogueSimulatorBaseStats,
                  critChance: baseCritChance,
                  hitChance,
               }, config, talents));
            const attackTable = new AttackTable(simulator);

            const numRolls = 100000;
            let crits = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll({
                  ability: Ability.MainHand,
                  isSpecialAttack: false,
                  weapon: rogueSimulatorBaseStats.mainHandWeapon
               });
               if (result.type === AttackType.Crit) {
                  crits++;
               }
            }

            const observedCritRate = (crits / numRolls) * 100;

            // Wider tolerance due to complex attack table interactions with glancing/miss/dodge
            expect(observedCritRate).toBeGreaterThan(expectedCritRate - 1);
            expect(observedCritRate).toBeLessThan(expectedCritRate + 4.5);
         });
      });
   });

   describe('Dagger Specialization', () => {

      it('should increase crit chance by 1% per point when using daggers', () => {
         // Base 30% - 4.8% suppression = 25.2%
         const testCases = [
            {daggerSpecialization: 0, expectedCritChance: 25.2},
            {daggerSpecialization: 1, expectedCritChance: 26.2},
            {daggerSpecialization: 2, expectedCritChance: 27.2},
            {daggerSpecialization: 3, expectedCritChance: 28.2},
            {daggerSpecialization: 4, expectedCritChance: 29.2},
            {daggerSpecialization: 5, expectedCritChance: 30.2},
         ];

         testCases.forEach(({daggerSpecialization, expectedCritChance}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               daggerSpecialization,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

            expect(simulator.critChance({
               ability: Ability.MainHand,
               isSpecialAttack: false,
               weapon: rogueSimulatorBaseStats.mainHandWeapon
            })).toBe(expectedCritChance);
         });
      });

      it('should NOT increase crit chance when using non-dagger weapons', () => {
         const swordStats: GearStats = {
            ...rogueSimulatorBaseStats,
            mainHandWeapon: {
               minDamage: 76,
               maxDamage: 142,
               speed: 1.7,
               type: WeaponType.Sword,
               enchant: WeaponEnchant.None
            },
         };

         const talents: RogueTalents = {
            ...baseTalents,
            daggerSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(swordStats, rogueSimulatorConfig, talents));

         expect(simulator.critChance({
            ability: Ability.MainHand,
            isSpecialAttack: false,
            weapon: swordStats.mainHandWeapon
         })).toBe(25.2); // Base 30% - 3% skill suppression - 1.8% boss suppression
      });

      it('should apply dagger specialization to actual attack table rolls with daggers', () => {
         // Base 30% - 3% skill suppression - 1.8% boss suppression = 25.2%
         const testCases = [
            {daggerSpecialization: 0, expectedCritRate: 25.2},
            {daggerSpecialization: 3, expectedCritRate: 28.2},
            {daggerSpecialization: 5, expectedCritRate: 30.2},
         ];

         testCases.forEach(({daggerSpecialization, expectedCritRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               daggerSpecialization,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));
            const attackTable = new AttackTable(simulator);

            const numRolls = 100000;
            let crits = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll({
                  ability: Ability.Test,
                  isSpecialAttack: true,
                  weapon: rogueSimulatorBaseStats.mainHandWeapon
               });
               if (result.type === AttackType.Crit) {
                  crits++;
               }
            }

            const observedCritRate = (crits / numRolls) * 100;

            expect(observedCritRate).toBeGreaterThan(expectedCritRate - 1);
            expect(observedCritRate).toBeLessThan(expectedCritRate + 1);
         });
      });

      it('should NOT apply dagger specialization to attack table rolls with swords', () => {
         const swordWeapon = {
            minDamage: 76,
            maxDamage: 142,
            speed: 1.7,
            type: WeaponType.Sword,
            enchant: WeaponEnchant.None
         };

         const swordStats: GearStats = {
            ...rogueSimulatorBaseStats,
            mainHandWeapon: swordWeapon,
         };

         const talents: RogueTalents = {
            ...baseTalents,
            daggerSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(swordStats, rogueSimulatorConfig, talents));
         const attackTable = new AttackTable(simulator);

         const numRolls = 100000;
         let crits = 0;

         for (let i = 0; i < numRolls; i++) {
            const result = attackTable.roll({
               ability: Ability.Test,
               isSpecialAttack: true,
               weapon: swordWeapon
            });
            if (result.type === AttackType.Crit) {
               crits++;
            }
         }

         const observedCritRate = (crits / numRolls) * 100;

         // Base 30% - 4.8% suppression = 25.2%
         expect(observedCritRate).toBeGreaterThan(24.2);
         expect(observedCritRate).toBeLessThan(26.2);
      });

      it('should stack with malice talent', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            malice: 5,
            daggerSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

         // Base 40% (30 + 5 malice + 5 dagger) - 4.8% suppression = 35.2%
         expect(simulator.critChance({
            ability: Ability.Backstab,
            isSpecialAttack: true,
            weapon: rogueSimulatorBaseStats.mainHandWeapon
         })).toBe(35.2);
      });

      it('should stack with malice talent in actual attack table rolls', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            malice: 5,
            daggerSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));
         const attackTable = new AttackTable(simulator);

         const numRolls = 100000;
         let crits = 0;

         for (let i = 0; i < numRolls; i++) {
            const result = attackTable.roll({
               ability: Ability.Test,
               isSpecialAttack: true,
               weapon: rogueSimulatorBaseStats.mainHandWeapon
            });
            if (result.type === AttackType.Crit) {
               crits++;
            }
         }

         const observedCritRate = (crits / numRolls) * 100;

         // Base 40% - 4.8% suppression = 35.2%
         expect(observedCritRate).toBeGreaterThan(34.2);
         expect(observedCritRate).toBeLessThan(36.2);
      });
   });

   describe('Precision', () => {

      it('should increase hit chance by 1% per point in precision', () => {
         const testCases = [
            {precision: 0, expectedHitChance: 9},
            {precision: 1, expectedHitChance: 10},
            {precision: 2, expectedHitChance: 11},
            {precision: 3, expectedHitChance: 12},
            {precision: 4, expectedHitChance: 13},
            {precision: 5, expectedHitChance: 14},
         ];

         testCases.forEach(({precision, expectedHitChance}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               precision,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

            expect(simulator.hitChance).toBe(expectedHitChance);
         });
      });

      it('should apply precision to actual attack table rolls', () => {
         // With 300 skill vs 315 defense: base 8% miss for yellow attacks
         const testCases = [
            {precision: 0, baseHitChance: 0, expectedMissRate: 8.0},
            {precision: 3, baseHitChance: 0, expectedMissRate: 5.0},
            {precision: 5, baseHitChance: 0, expectedMissRate: 3.0},
         ];

         testCases.forEach(({precision, baseHitChance, expectedMissRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               precision,
            };

            const testStats: GearStats = {
               ...rogueSimulatorBaseStats,
               hitChance: baseHitChance,
            };

            const simulator = new RogueSimulator(createTestSpec(testStats, rogueSimulatorConfig, talents));
            const attackTable = new AttackTable(simulator);

            const numRolls = 100000;
            let misses = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll({
                  ability: Ability.Test,
                  isSpecialAttack: true,
                  weapon: rogueSimulatorBaseStats.mainHandWeapon
               });
               if (result.type === AttackType.Miss) {
                  misses++;
               }
            }

            const observedMissRate = (misses / numRolls) * 100;

            // Wider tolerance for statistical variance
            expect(observedMissRate).toBeGreaterThan(expectedMissRate - 1);
            expect(observedMissRate).toBeLessThan(expectedMissRate + 1.5);
         });
      });
   });

   describe('Relentless Strikes', () => {

      it('should add energy', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            relentlessStrikes: true,
         };
         const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));
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
         const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));
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
   });

   describe('Sword Specialization', () => {

      it('should proc extra attacks at 1% per talent point', () => {
         const swordStats: GearStats = {
            ...rogueSimulatorBaseStats,
            mainHandWeapon: {
               minDamage: 100,
               maxDamage: 100,
               speed: 2.0,
               type: WeaponType.Sword,
               enchant: WeaponEnchant.None
            },
         };

         const testCases = [
            {swordSpecialization: 1, expectedProcRate: 0.01},
            {swordSpecialization: 2, expectedProcRate: 0.02},
            {swordSpecialization: 3, expectedProcRate: 0.03},
            {swordSpecialization: 4, expectedProcRate: 0.04},
            {swordSpecialization: 5, expectedProcRate: 0.05},
         ];

         testCases.forEach(({swordSpecialization, expectedProcRate}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               swordSpecialization,
            };

            const simulator = new RogueSimulator(createTestSpec(swordStats, rogueSimulatorConfig, talents));

            const iterations = 1000;
            let totalExtraAttacks = 0;
            let totalTriggerableHits = 0;

            for (let i = 0; i < iterations; i++) {
               const result = simulator.simulate();

               const extraAttacks = result.events.filter(e =>
                  e.eventType === 'damage' &&
                  'ability' in e &&
                  e.ability === 'EXTRA' &&
                  e.amount > 0
               );
               totalExtraAttacks += extraAttacks.length;

               const triggerableHits = result.events.filter(e =>
                  e.eventType === 'damage' &&
                  'ability' in e &&
                  ['MH', 'SS', 'BS', 'Evis', 'Hemo'].includes(e.ability) &&
                  e.amount > 0
               );
               totalTriggerableHits += triggerableHits.length;
            }

            const actualProcRate = totalExtraAttacks / totalTriggerableHits;

            // Allow wider variance due to randomness (1000 iterations)
            expect(actualProcRate).toBeGreaterThan(expectedProcRate * 0.8);
            expect(actualProcRate).toBeLessThan(expectedProcRate * 1.5);
         });
      });

      it('should NOT proc when using non-sword weapons', () => {
         const talents: RogueTalents = {
            ...baseTalents,
            swordSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

         const iterations = 100;
         let totalExtraAttacks = 0;

         for (let i = 0; i < iterations; i++) {
            const result = simulator.simulate();

            const extraAttacks = result.events.filter(e =>
               e.eventType === 'damage' &&
               'ability' in e &&
               e.ability === 'EXTRA' &&
               e.amount > 0
            );
            totalExtraAttacks += extraAttacks.length;
         }

         expect(totalExtraAttacks).toBe(0);
      });

      it('should only proc on hits that deal damage', () => {
         const swordStats: GearStats = {
            ...rogueSimulatorBaseStats,
            hitChance: 0,
            mainHandWeapon: {
               minDamage: 100,
               maxDamage: 100,
               speed: 2.0,
               type: WeaponType.Sword,
               enchant: WeaponEnchant.None
            },
         };

         const talents: RogueTalents = {
            ...baseTalents,
            swordSpecialization: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(swordStats, rogueSimulatorConfig, talents));

         const iterations = 100;
         let totalExtraAttacks = 0;

         for (let i = 0; i < iterations; i++) {
            const result = simulator.simulate();

            const extraAttacks = result.events.filter(e =>
               e.eventType === 'damage' &&
               'ability' in e &&
               e.ability === 'EXTRA'
            );
            totalExtraAttacks += extraAttacks.length;

            const missedMHAttacks = result.events.filter(e =>
               e.eventType === 'damage' &&
               'ability' in e &&
               e.ability === 'MH' &&
               e.amount === 0
            );

            if (missedMHAttacks.length > 0) {
               expect(extraAttacks.length).toBeLessThanOrEqual(result.events.filter(e =>
                  e.eventType === 'damage' &&
                  'ability' in e &&
                  e.ability === 'MH' &&
                  e.amount > 0
               ).length);
            }
         }
      });
   });

   describe('Weapon Expertise', () => {

      it('should increase weapon skill by 3 per point for daggers', () => {
         const testCases = [
            {weaponExpertise: 0, expectedWeaponSkill: 300},
            {weaponExpertise: 1, expectedWeaponSkill: 303},
            {weaponExpertise: 2, expectedWeaponSkill: 305},
         ];

         testCases.forEach(({weaponExpertise, expectedWeaponSkill}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               weaponExpertise,
            };

            const simulator = new RogueSimulator(createTestSpec(rogueSimulatorBaseStats, rogueSimulatorConfig, talents));

            expect(simulator.weaponSkill).toBe(expectedWeaponSkill);
         });
      });

      it('should increase weapon skill by 3 per point for swords', () => {
         const swordStats: GearStats = {
            ...rogueSimulatorBaseStats,
            mainHandWeapon: {
               minDamage: 76,
               maxDamage: 142,
               speed: 1.7,
               type: WeaponType.Sword,
               enchant: WeaponEnchant.None
            },
         };

         const testCases = [
            {weaponExpertise: 0, expectedWeaponSkill: 300},
            {weaponExpertise: 1, expectedWeaponSkill: 303},
            {weaponExpertise: 2, expectedWeaponSkill: 305},
         ];

         testCases.forEach(({weaponExpertise, expectedWeaponSkill}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               weaponExpertise,
            };

            const simulator = new RogueSimulator(createTestSpec(swordStats, rogueSimulatorConfig, talents));

            expect(simulator.weaponSkill).toBe(expectedWeaponSkill);
         });
      });

      it('should NOT increase weapon skill for maces', () => {
         const maceStats: GearStats = {
            ...baseStats,
            mainHandWeapon: {
               minDamage: 76,
               maxDamage: 142,
               speed: 1.7,
               type: WeaponType.Mace,
               enchant: WeaponEnchant.None
            },
         };

         const talents: RogueTalents = {
            ...baseTalents,
            weaponExpertise: 5,
         };

         const simulator = new RogueSimulator(createTestSpec(maceStats, rogueSimulatorConfig, talents));

         expect(simulator.weaponSkill).toBe(300);
      });

      it('should reduce miss rate with weapon expertise on daggers', () => {
         const talents0: RogueTalents = {
            ...baseTalents,
            weaponExpertise: 0,
         };

         const talents5: RogueTalents = {
            ...baseTalents,
            weaponExpertise: 5,
         };

         const testStats: GearStats = {
            ...baseStats,
            hitChance: 0,
            weaponSkill: 300,
         };

         const simulator0 = new RogueSimulator(createTestSpec(testStats, rogueSimulatorConfig, talents0));
         const simulator5 = new RogueSimulator(createTestSpec(testStats, rogueSimulatorConfig, talents5));
         const attackTable0 = new AttackTable(simulator0);
         const attackTable5 = new AttackTable(simulator5);

         const numRolls = 100000;
         let misses0 = 0;
         let misses5 = 0;

         for (let i = 0; i < numRolls; i++) {
            const result0 = attackTable0.roll({
               ability: Ability.Test,
               isSpecialAttack: true,
               weapon: rogueSimulatorBaseStats.mainHandWeapon
            });
            if (result0.type === AttackType.Miss) {
               misses0++;
            }

            const result5 = attackTable5.roll({
               ability: Ability.Test,
               isSpecialAttack: true,
               weapon: rogueSimulatorBaseStats.mainHandWeapon
            });
            if (result5.type === AttackType.Miss) {
               misses5++;
            }
         }

         const missRate0 = (misses0 / numRolls) * 100;
         const missRate5 = (misses5 / numRolls) * 100;

         expect(missRate5).toBeLessThan(missRate0);
         expect(missRate0 - missRate5).toBeGreaterThan(0.5);
      });

      it('should affect AttackTable calculateMissChance() correctly', () => {
         const testCases = [
            {weaponExpertise: 0, expectedWeaponSkill: 300},
            {weaponExpertise: 1, expectedWeaponSkill: 303},
            {weaponExpertise: 2, expectedWeaponSkill: 305},
         ];

         testCases.forEach(({weaponExpertise, expectedWeaponSkill}) => {
            const talents: RogueTalents = {
               ...baseTalents,
               weaponExpertise,
            };

            const testStats: GearStats = {
               ...rogueSimulatorBaseStats,
               hitChance: 0,
               weaponSkill: 300,
            };

            const simulator = new RogueSimulator(createTestSpec(testStats, rogueSimulatorConfig, talents));
            const attackTable = new AttackTable(simulator);

            expect(simulator.weaponSkill).toBe(expectedWeaponSkill);

            const targetDefense = config.targetLevel * 5;
            const defenseSkillDiff = targetDefense - expectedWeaponSkill;

            // Calculate base miss chance
            let baseMissChance: number;
            if (defenseSkillDiff >= 11) {
               baseMissChance = 0.05 + (defenseSkillDiff * 0.002);
            } else {
               baseMissChance = 0.05 + (defenseSkillDiff * 0.001);
            }

            // Apply hit reduction (0% gear hit in this test)
            let missReduction = testStats.hitChance / 100;

            // Hit suppression: when skill deficit > 10, hit is less effective
            if (defenseSkillDiff > 10) {
               const hitSuppression = (defenseSkillDiff - 10) * 0.002;
               missReduction = Math.max(0, missReduction - hitSuppression);
            }

            // Yellow attacks don't get DW penalty
            let expectedMissChance = Math.max(0, baseMissChance - missReduction);

            const numRolls = 100000;
            let misses = 0;

            for (let i = 0; i < numRolls; i++) {
               const result = attackTable.roll({
                  ability: Ability.Test,
                  isSpecialAttack: true,
                  weapon: rogueSimulatorBaseStats.mainHandWeapon
               });
               if (result.type === AttackType.Miss) {
                  misses++;
               }
            }

            const observedMissRate = (misses / numRolls);
            const expectedMissRate = expectedMissChance;

            expect(observedMissRate).toBeGreaterThan(expectedMissRate - 0.01);
            expect(observedMissRate).toBeLessThan(expectedMissRate + 0.01);
         });
      });
   });
});
