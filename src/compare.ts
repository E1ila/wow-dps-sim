import {SimulationRunner, SimulationOptions} from './SimulationRunner';
import {WeaponType} from './types';

interface TalentBuild {
   name: string;
   talents: string;
}

interface SimulationResult {
   dps: number;
   talentOverrides: Record<string, number>;
   executionTimeMs: number;
   iterations: number;
   abilityBreakdown: Record<string, {
      percentage: string;
      avgHitDamage: string;
      hitCount: number;
      totalDamage: number;
   }>;
   hitStats: {
      totalAttacks: number;
      wornCrit: string;
      actualCrit: string;
      actualHit: string;
      actualGlancing: string;
      actualMiss: string;
      actualDodge: string;
      critCount: number;
      hitCount: number;
      glancingCount: number;
      missCount: number;
      dodgeCount: number;
   };
}

interface BuildResult extends SimulationResult {
   buildName: string;
}

const TESTED_TALENTS: TalentBuild[] = [
   {
      name: 'Seal Fate',
      talents: 'improvedSliceAndDice:1,ruthlessness:3,lethality:5,relentlessStrikes:1,sealFate:5'
   },
   {
      name: 'No Seal Fate',
      talents: 'improvedSliceAndDice:1,ruthlessness:3,lethality:5,relentlessStrikes:1,sealFate:0'
   },
   {
      name: 'Combat Potency',
      talents: 'improvedSliceAndDice:1,ruthlessness:3,lethality:5,relentlessStrikes:1,combatPotency:5'
   },
];

function getDefaultOptions(specFile: string): SimulationOptions {
   return {
      specFile,
      attackPower: 1200,
      critChance: 35,
      hitChance: 9,
      weaponSkill: 300,
      mainHand: {
         minDamage: 76,
         maxDamage: 142,
         speed: 1.7,
         type: WeaponType.Dagger,
      },
      offHand: {
         minDamage: 58,
         maxDamage: 108,
         speed: 1.5,
         type: WeaponType.Dagger,
      },
      targetLevel: 63,
      targetArmor: 3731,
      fightLength: 300,
      iterations: 2000,
      postResGen: true,
      quiet: true,
   };
}

function runSimulation(specFile: string, talents: string): SimulationResult {
   try {
      const options = getDefaultOptions(specFile);
      options.talentOverrides = talents;
      
      const runner = new SimulationRunner(options);
      return runner.runAndGetResults();
   } catch (error) {
      console.error(`Error running simulation for talents: ${talents}`);
      throw error;
   }
}

function printTable(results: BuildResult[]): void {
   console.log('\n='.repeat(120));
   console.log('Build Comparison Results');
   console.log('='.repeat(120));
   console.log();

   console.log(`${'Build Name'.padEnd(20)} | ${'DPS'.padStart(10)} | ${'Iterations'.padStart(10)} | ${'Time (s)'.padStart(10)} | Talents`);
   console.log('-'.repeat(120));

   for (const result of results) {
      const talentString = Object.entries(result.talentOverrides)
         .map(([name, value]) => `${name}:${value}`)
         .join(', ');

      console.log(
         `${result.buildName.padEnd(20)} | ${result.dps.toFixed(2).padStart(10)} | ${result.iterations.toString().padStart(10)} | ${(result.executionTimeMs / 1000).toFixed(2).padStart(10)} | ${talentString}`
      );
   }

   console.log();
   console.log('='.repeat(120));
   console.log('Ability Breakdown');
   console.log('='.repeat(120));
   console.log();

   for (const result of results) {
      console.log(`\n${result.buildName}:`);
      console.log(`${'Ability'.padEnd(15)} | ${'% of DMG'.padStart(10)} | ${'Avg Hit'.padStart(12)} | ${'Hit Count'.padStart(12)} | ${'Total DMG'.padStart(15)}`);
      console.log('-'.repeat(80));

      for (const [ability, data] of Object.entries(result.abilityBreakdown)) {
         console.log(
            `${ability.padEnd(15)} | ${data.percentage.padStart(10)} | ${parseFloat(data.avgHitDamage).toFixed(2).padStart(12)} | ${data.hitCount.toString().padStart(12)} | ${data.totalDamage.toLocaleString().padStart(15)}`
         );
      }
   }

   console.log();
   console.log('='.repeat(120));
   console.log('Hit Statistics');
   console.log('='.repeat(120));
   console.log();

   console.log(`${'Build'.padEnd(20)} | ${'Total Atks'.padStart(12)} | ${'Crit %'.padStart(10)} | ${'Hit %'.padStart(10)} | ${'Glance %'.padStart(10)} | ${'Miss %'.padStart(10)} | ${'Dodge %'.padStart(10)}`);
   console.log('-'.repeat(120));

   for (const result of results) {
      const stats = result.hitStats;
      console.log(
         `${result.buildName.padEnd(20)} | ${stats.totalAttacks.toString().padStart(12)} | ${stats.actualCrit.padStart(10)} | ${stats.actualHit.padStart(10)} | ${stats.actualGlancing.padStart(10)} | ${stats.actualMiss.padStart(10)} | ${stats.actualDodge.padStart(10)}`
      );
   }

   console.log();
   console.log('='.repeat(120));

   const sortedByDps = [...results].sort((a, b) => b.dps - a.dps);
   const best = sortedByDps[0];

   console.log(`\nBest Build: ${best.buildName} with ${best.dps.toFixed(2)} DPS`);
   console.log();

   for (let i = 1; i < sortedByDps.length; i++) {
      const diff = best.dps - sortedByDps[i].dps;
      const percentDiff = ((diff / sortedByDps[i].dps) * 100).toFixed(2);
      console.log(`  ${sortedByDps[i].buildName}: -${diff.toFixed(2)} DPS (-${percentDiff}%)`);
   }

   console.log('='.repeat(120));
}

function main(): void {
   const specFile = process.argv[2] || 'specs/rogue/daggers.json';

   console.log(`Running build comparison for: ${specFile}`);
   console.log(`Testing ${TESTED_TALENTS.length} builds...`);
   console.log();

   const results: BuildResult[] = [];

   for (const build of TESTED_TALENTS) {
      console.log(`Running: ${build.name}...`);
      const result = runSimulation(specFile, build.talents);
      results.push({
         ...result,
         buildName: build.name,
      });
   }

   printTable(results);
}

main();
