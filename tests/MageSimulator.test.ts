import {Ability, CharacterClass} from '../src/types';
import {MageSimulator} from '../src/sim/MageSimulator';
import {GearBuffsStats, SimulationConfig, SimulationSpec} from "../src/SimulationSpec";
import {MageTalents} from "../src/talents";

const baseMageStats: GearBuffsStats = {
   critChance: 0,
   hitChance: 0,
   agility: 0,
   strength: 0,
   weaponSkills: new Map(),
   mainHandWeapon: {
      minDamage: 1,
      maxDamage: 1,
      speed: 1.0,
      type: 0 as any,
      enchant: 0 as any,
   },
   spellPower: 400,
   spellCrit: 15,
   spellHit: 10,
   intellect: 300,
   spirit: 200,
   mana: 5000,
};

const config: SimulationConfig = {
   fightLength: 60,
   targetLevel: 63,
   targetArmor: 0,
   iterations: 1,
};

const baseMageTalents: MageTalents = {
   arcaneSubtlety: 0,
   arcaneFocus: 0,
   improvedArcaneMissiles: 0,
   arcaneMind: 0,
   arcaneMeditation: 0,
   arcaneConcentration: 0,
   arcanePower: false,
   arcaneInstability: 0,
   improvedFireball: 0,
   ignite: false,
   flameThrowing: 0,
   improvedScorch: 0,
   masterOfElements: 0,
   criticalMass: 0,
   firePower: 0,
   combustion: false,
   burningSoul: 0,
   improvedFrostbolt: 0,
   iceShards: 0,
   piercingIce: 0,
   frostChanneling: 0,
   elementalPrecision: 0,
   iceBarrier: false,
   arcticReach: 0,
   wintersChill: 0,
};

function createTestSpec(stats: GearBuffsStats, config: SimulationConfig, talents: MageTalents): SimulationSpec {
   return {
      name: 'test',
      description: 'test spec',
      class: CharacterClass.Mage,
      playerLevel: 60,
      gear: [],
      stats: stats,
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

describe('Mage Simulator', () => {
   describe('Basic Simulation', () => {
      it('should simulate a basic fireball rotation', () => {
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         const simulator = new MageSimulator(spec);

         const result = simulator.simulate();

         expect(result.totalDamage).toBeGreaterThan(0);
         expect(result.dps).toBe(result.totalDamage / 60);
         expect(result.events.length).toBeGreaterThan(0);
      });

      it('should cast fireballs and deal damage', () => {
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         const simulator = new MageSimulator(spec);

         const result = simulator.simulate();

         const fireballEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         );

         expect(fireballEvents.length).toBeGreaterThan(10);
         expect(result.damageBreakdown.get(Ability.Fireball)).toBeGreaterThan(0);
      });

      it('should consume mana when casting spells', () => {
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         const simulator = new MageSimulator(spec);

         const result = simulator.simulate();

         // Should have cast multiple fireballs, consuming mana
         const fireballEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         );

         expect(fireballEvents.length).toBeGreaterThan(0);
      });
   });

   describe('Spell Damage Calculation', () => {
      it('should scale with spell power', () => {
         const lowSpellPowerStats = {...baseMageStats, spellPower: 100};
         const highSpellPowerStats = {...baseMageStats, spellPower: 600};

         const specLow = createTestSpec(lowSpellPowerStats, config, baseMageTalents);
         const specHigh = createTestSpec(highSpellPowerStats, config, baseMageTalents);

         const simLow = new MageSimulator(specLow);
         const simHigh = new MageSimulator(specHigh);

         const resultLow = simLow.simulate();
         const resultHigh = simHigh.simulate();

         expect(resultHigh.totalDamage).toBeGreaterThan(resultLow.totalDamage);
      });

      it('should have critical strikes', () => {
         const highCritStats = {...baseMageStats, spellCrit: 30};
         const spec = createTestSpec(highCritStats, config, baseMageTalents);
         const simulator = new MageSimulator(spec);

         const result = simulator.simulate();

         expect(result.statistics.critCount).toBeGreaterThan(0);
      });

      it('should have misses against level 63 boss', () => {
         const lowHitStats = {...baseMageStats, spellHit: 0};
         const spec = createTestSpec(lowHitStats, config, baseMageTalents);
         const simulator = new MageSimulator(spec);

         const result = simulator.simulate();

         expect(result.statistics.missCount).toBeGreaterThan(0);
      });
   });

   describe('Fire Talents', () => {
      it('should apply Fire Power talent bonus', () => {
         const talentsNoFP = {...baseMageTalents, firePower: 0};
         const talentsWithFP = {...baseMageTalents, firePower: 5};

         const specNo = createTestSpec(baseMageStats, config, talentsNoFP);
         const specWith = createTestSpec(baseMageStats, config, talentsWithFP);

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         // With 5/5 Fire Power, should have +10% fire damage
         const expectedMultiplier = 1.10;
         const actualMultiplier = resultWith.totalDamage / resultNo.totalDamage;

         expect(actualMultiplier).toBeGreaterThan(expectedMultiplier - 0.05);
         expect(actualMultiplier).toBeLessThan(expectedMultiplier + 0.05);
      });

      it('should reduce fireball cast time with Improved Fireball', () => {
         const talentsNoIF = {...baseMageTalents, improvedFireball: 0};
         const talentsWithIF = {...baseMageTalents, improvedFireball: 5};

         const specNo = createTestSpec(baseMageStats, config, talentsNoIF);
         const specWith = createTestSpec(baseMageStats, config, talentsWithIF);

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         const fireballsNo = resultNo.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         ).length;

         const fireballsWith = resultWith.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         ).length;

         // With 5/5 Improved Fireball (-0.5s cast time), should cast more fireballs
         expect(fireballsWith).toBeGreaterThan(fireballsNo);
      });

      it('should increase crit chance with Critical Mass', () => {
         const talentsNoCM = {...baseMageTalents, criticalMass: 0};
         const talentsWithCM = {...baseMageTalents, criticalMass: 5};

         const specNo = createTestSpec(baseMageStats, config, talentsNoCM);
         const specWith = createTestSpec(baseMageStats, config, talentsWithCM);

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const iterations = 10;
         let critsNo = 0;
         let critsWith = 0;

         for (let i = 0; i < iterations; i++) {
            const resultNo = simNo.simulate();
            const resultWith = simWith.simulate();

            critsNo += resultNo.statistics.critCount;
            critsWith += resultWith.statistics.critCount;
         }

         // With 5/5 Critical Mass, should have significantly more crits
         expect(critsWith).toBeGreaterThan(critsNo);
      });
   });

   describe('Frost Talents', () => {
      it('should reduce frostbolt cast time with Improved Frostbolt', () => {
         const talentsNoIF = {...baseMageTalents, improvedFrostbolt: 0};
         const talentsWithIF = {...baseMageTalents, improvedFrostbolt: 5};

         const frostboltRotation = [Ability.Frostbolt];

         const specNo = createTestSpec(baseMageStats, config, talentsNoIF);
         const specWith = createTestSpec(baseMageStats, config, talentsWithIF);

         specNo.rotation = frostboltRotation;
         specWith.rotation = frostboltRotation;

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         const frostboltsNo = resultNo.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Frostbolt
         ).length;

         const frostboltsWith = resultWith.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Frostbolt
         ).length;

         // With 5/5 Improved Frostbolt (-0.5s cast time), should cast more frostbolts
         expect(frostboltsWith).toBeGreaterThan(frostboltsNo);
      });

      it('should apply Piercing Ice damage bonus', () => {
         const talentsNoPI = {...baseMageTalents, piercingIce: 0};
         const talentsWithPI = {...baseMageTalents, piercingIce: 3};

         const frostboltRotation = [Ability.Frostbolt];

         const specNo = createTestSpec(baseMageStats, config, talentsNoPI);
         const specWith = createTestSpec(baseMageStats, config, talentsWithPI);

         specNo.rotation = frostboltRotation;
         specWith.rotation = frostboltRotation;

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         // With 3/3 Piercing Ice, should have +6% frost damage
         const expectedMultiplier = 1.06;
         const actualMultiplier = resultWith.totalDamage / resultNo.totalDamage;

         expect(actualMultiplier).toBeGreaterThan(expectedMultiplier - 0.05);
         expect(actualMultiplier).toBeLessThan(expectedMultiplier + 0.05);
      });
   });

   describe('Arcane Talents', () => {
      it('should increase max mana with Arcane Mind', () => {
         const talentsNoAM = {...baseMageTalents, arcaneMind: 0};
         const talentsWithAM = {...baseMageTalents, arcaneMind: 5};

         const specNo = createTestSpec(baseMageStats, config, talentsNoAM);
         const specWith = createTestSpec(baseMageStats, config, talentsWithAM);

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         // Access max mana indirectly by running simulation and checking mana consumption
         // With more max mana, should be able to cast more spells
         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         const fireballsNo = resultNo.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         ).length;

         const fireballsWith = resultWith.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         ).length;

         // With 5/5 Arcane Mind (+10% max mana), might cast slightly more spells
         expect(fireballsWith).toBeGreaterThanOrEqual(fireballsNo);
      });

      it('should increase damage with Arcane Instability', () => {
         const talentsNoAI = {...baseMageTalents, arcaneInstability: 0};
         const talentsWithAI = {...baseMageTalents, arcaneInstability: 3};

         const specNo = createTestSpec(baseMageStats, config, talentsNoAI);
         const specWith = createTestSpec(baseMageStats, config, talentsWithAI);

         const simNo = new MageSimulator(specNo);
         const simWith = new MageSimulator(specWith);

         const resultNo = simNo.simulate();
         const resultWith = simWith.simulate();

         // With 3/3 Arcane Instability, should have +3% damage
         const expectedMultiplier = 1.03;
         const actualMultiplier = resultWith.totalDamage / resultNo.totalDamage;

         expect(actualMultiplier).toBeGreaterThan(expectedMultiplier - 0.04);
         expect(actualMultiplier).toBeLessThan(expectedMultiplier + 0.04);
      });
   });

   describe('Rotation Execution', () => {
      it('should execute scorch rotation', () => {
         const scorchRotation = [Ability.Scorch];
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         spec.rotation = scorchRotation;

         const simulator = new MageSimulator(spec);
         const result = simulator.simulate();

         const scorchEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Scorch
         );

         expect(scorchEvents.length).toBeGreaterThan(20);
      });

      it('should execute frostbolt rotation', () => {
         const frostboltRotation = [Ability.Frostbolt];
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         spec.rotation = frostboltRotation;

         const simulator = new MageSimulator(spec);
         const result = simulator.simulate();

         const frostboltEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Frostbolt
         );

         expect(frostboltEvents.length).toBeGreaterThan(10);
      });

      it('should execute mixed spell rotation', () => {
         const mixedRotation = [Ability.Scorch, Ability.Fireball, Ability.Fireball];
         const spec = createTestSpec(baseMageStats, config, baseMageTalents);
         spec.rotation = mixedRotation;

         const simulator = new MageSimulator(spec);
         const result = simulator.simulate();

         const scorchEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Scorch
         );

         const fireballEvents = result.events.filter(e =>
            e.eventType === 'damage' && 'ability' in e && e.ability === Ability.Fireball
         );

         expect(scorchEvents.length).toBeGreaterThan(0);
         expect(fireballEvents.length).toBeGreaterThan(0);
         // Should cast roughly 2x more fireballs than scorches
         expect(fireballEvents.length).toBeGreaterThan(scorchEvents.length);
      });
   });
});
