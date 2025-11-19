import {CharacterClass, WeaponEnchant, WeaponType} from '../src/types';
import {RogueSimulator} from '../src/sim/RogueSimulator';
import {SimulationConfig, SimulationSpec, Stats} from "../src/SimulationSpec";
import {RogueTalents} from "../src/talents";

const baseStats: Stats = {
  critChance: 30,
  hitChance: 9,
  agility: 300,
  strength: 100,
  weaponSkills: new Map(),
  mh: {
    min: 60,
    max: 145,
    speed: 1.9,
    type: WeaponType.Sword,
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
  precision: 5,
  weaponExpertise: 0,
  vigor: false,
};

function createTestSpec(stats: Stats, config: SimulationConfig, talents: RogueTalents, gear: any[] = []): SimulationSpec {
  return {
    name: 'test',
    description: 'test spec',
    class: CharacterClass.Rogue,
    playerLevel: 60,
    gear,
    extraStats: stats,
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

describe('Thunderfury', () => {
  describe('Thunderfury Proc', () => {
    it('should proc when Thunderfury is equipped', () => {
      const gear = [{itemId: 19019}]; // Thunderfury, Blessed Blade of the Windseeker
      const spec = createTestSpec(baseStats, config, baseTalents, gear);
      const simulator = new RogueSimulator(spec);

      const iterations = 100;
      let totalProcs = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const thunderfuryProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Thunderfury'
        );
        totalProcs += thunderfuryProcs.length;
      }

      // With 1.9 speed weapon and 6.0 PPM, proc chance is (1.9/60) * 6.0 = 0.19 (19%)
      // In a 60 second fight, we expect roughly (60/1.9) * 0.19 = ~6 procs per fight
      // Over 100 iterations, we expect around 600 procs
      expect(totalProcs).toBeGreaterThan(0);
    });

    it('should deal 300 damage when it procs', () => {
      const gear = [{itemId: 19019}]; // Thunderfury
      const spec = createTestSpec(baseStats, config, baseTalents, gear);
      const simulator = new RogueSimulator(spec);

      const iterations = 100;
      let foundProc = false;

      for (let i = 0; i < iterations && !foundProc; i++) {
        const result = simulator.simulate();

        // Find Thunderfury proc and verify damage
        for (const event of result.events) {
          if (event.eventType === 'damage' && 'ability' in event && event.ability === 'Thunderfury') {
            expect(event.amount).toBe(300);
            foundProc = true;
            break;
          }
        }
      }

      expect(foundProc).toBe(true);
    });

    it('should proc at approximately 6.0 PPM rate', () => {
      const gear = [{itemId: 19019}]; // Thunderfury
      const spec = createTestSpec(baseStats, config, baseTalents, gear);
      const simulator = new RogueSimulator(spec);

      const iterations = 2000;
      let totalProcs = 0;
      let totalMHHits = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const thunderfuryProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Thunderfury'
        );
        totalProcs += thunderfuryProcs.length;

        // Count mainhand hits
        const mhHits = result.events.filter(e =>
          e.eventType === 'damage' &&
          'ability' in e &&
          e.ability === 'MH' &&
          e.amount > 0
        );
        totalMHHits += mhHits.length;
      }

      // Proc chance should be (weapon_speed / 60) * 6.0 = (1.9 / 60) * 6.0 = 0.19 (19%)
      const expectedProcRate = (baseStats.mh.speed / 60) * 6.0;
      const actualProcRate = totalProcs / totalMHHits;

      // Allow 35% variance due to RNG
      expect(actualProcRate).toBeGreaterThan(expectedProcRate * 0.65);
      expect(actualProcRate).toBeLessThan(expectedProcRate * 1.35);
    });

    it('should not proc when Thunderfury is not equipped', () => {
      const gear: any[] = []; // No Thunderfury
      const spec = createTestSpec(baseStats, config, baseTalents, gear);
      const simulator = new RogueSimulator(spec);

      const iterations = 50;
      let totalProcs = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const thunderfuryProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Thunderfury'
        );
        totalProcs += thunderfuryProcs.length;
      }

      expect(totalProcs).toBe(0);
    });

    it('should contribute to damage breakdown', () => {
      const gear = [{itemId: 19019}]; // Thunderfury
      const spec = createTestSpec(baseStats, config, baseTalents, gear);
      const simulator = new RogueSimulator(spec);

      const iterations = 100;
      let foundThunderfuryDamage = false;

      for (let i = 0; i < iterations && !foundThunderfuryDamage; i++) {
        const result = simulator.simulate();
        const thunderfuryDamage = result.damageBreakdown.get('Thunderfury');
        if (thunderfuryDamage && thunderfuryDamage > 0) {
          foundThunderfuryDamage = true;
          // Each proc should deal exactly 300 damage
          expect(thunderfuryDamage % 300).toBe(0);
        }
      }

      expect(foundThunderfuryDamage).toBe(true);
    });
  });
});
