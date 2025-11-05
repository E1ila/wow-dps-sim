import {CharacterClass, GearStats, RogueTalents, SimulationConfig, WeaponEnchant, WeaponType} from '../src/types';
import {RogueSimulator} from '../src/sim/RogueSimulator';
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
    speed: 1.8,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.Crusader
  },
  offHandWeapon: {
    minDamage: 80,
    maxDamage: 80,
    speed: 1.6,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.Crusader
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

describe('Procs', () => {
  describe('Crusader Enchant', () => {
    it('should proc on mainhand hits', () => {
      const spec = createTestSpec(baseStats, config, baseTalents);
      const simulator = new RogueSimulator(spec);

      // Run multiple iterations to get statistical significance
      const iterations = 100;
      let totalProcs = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const crusaderProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Crusader'
        );
        totalProcs += crusaderProcs.length;
      }

      // With 1.8 speed weapon, proc chance is 3% per hit (1.8/60)
      // In a 60 second fight, we expect roughly (60/1.8) * 0.03 = ~1 proc per fight
      // Over 100 iterations, we expect around 100 procs, give or take variance
      expect(totalProcs).toBeGreaterThan(0);
    });

    it('should proc at approximately 1 PPM rate for mainhand', () => {
      const spec = createTestSpec(baseStats, config, baseTalents);
      const simulator = new RogueSimulator(spec);

      const iterations = 500;
      let totalProcs = 0;
      let totalMHHits = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const crusaderProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Crusader'
        );
        totalProcs += crusaderProcs.length;

        // Count mainhand hits
        const mhHits = result.events.filter(e =>
          e.eventType === 'damage' &&
          'ability' in e &&
          e.ability === 'MH' &&
          e.amount > 0
        );
        totalMHHits += mhHits.length;
      }

      // Proc chance should be weapon_speed / 60 = 1.8 / 60 = 0.03 (3%)
      const expectedProcRate = baseStats.mainHandWeapon.speed / 60;
      const actualProcRate = totalProcs / totalMHHits;

      // Allow 25% variance due to RNG (0.03 * 0.75 = 0.0225, 0.03 * 1.25 = 0.0375)
      expect(actualProcRate).toBeGreaterThan(expectedProcRate * 0.75);
      expect(actualProcRate).toBeLessThan(expectedProcRate * 1.25);
    });

    it('should activate Crusader buff when it procs', () => {
      const spec = createTestSpec(baseStats, config, baseTalents);
      const simulator = new RogueSimulator(spec);

      const iterations = 100;
      let foundBuffAfterProc = false;

      for (let i = 0; i < iterations && !foundBuffAfterProc; i++) {
        const result = simulator.simulate();

        // Find first Crusader proc
        for (let j = 0; j < result.events.length; j++) {
          const event = result.events[j];
          if (event.eventType === 'proc' && 'procName' in event && event.procName === 'Crusader') {
            // Check if buff is active after this proc
            const procTime = event.timestamp;
            const buffActive = result.events.some(e =>
              e.eventType === 'buff' &&
              'buffName' in e &&
              e.buffName === 'Crusader' &&
              e.timestamp === procTime
            );

            if (buffActive) {
              foundBuffAfterProc = true;
              break;
            }
          }
        }
      }

      expect(foundBuffAfterProc).toBe(true);
    });

    it('should not proc when enchant is not Crusader', () => {
      const statsNoCrusader = {
        ...baseStats,
        mainHandWeapon: {
          ...baseStats.mainHandWeapon,
          enchant: WeaponEnchant.Dmg5
        },
        offHandWeapon: {
          ...baseStats.offHandWeapon!,
          enchant: WeaponEnchant.Dmg5
        }
      };

      const spec = createTestSpec(statsNoCrusader, config, baseTalents);
      const simulator = new RogueSimulator(spec);

      const iterations = 50;
      let totalProcs = 0;

      for (let i = 0; i < iterations; i++) {
        const result = simulator.simulate();
        const crusaderProcs = result.events.filter(e =>
          e.eventType === 'proc' && 'procName' in e && e.procName === 'Crusader'
        );
        totalProcs += crusaderProcs.length;
      }

      expect(totalProcs).toBe(0);
    });

    it('should have 15 second duration', () => {
      const spec = createTestSpec(baseStats, config, baseTalents);
      const simulator = new RogueSimulator(spec);

      const iterations = 100;
      let foundCorrectDuration = false;

      for (let i = 0; i < iterations && !foundCorrectDuration; i++) {
        const result = simulator.simulate();

        const buffEvents = result.events.filter(e =>
          e.eventType === 'buff' &&
          'buffName' in e &&
          e.buffName === 'Crusader'
        );

        if (buffEvents.length > 0) {
          const buffEvent = buffEvents[0];
          // Check that duration is 15000ms (15 seconds)
          if (buffEvent.eventType === 'buff' && 'duration' in buffEvent) {
            expect(buffEvent.duration).toBe(15000);
            foundCorrectDuration = true;
          }
        }
      }

      expect(foundCorrectDuration).toBe(true);
    });
  });
});
