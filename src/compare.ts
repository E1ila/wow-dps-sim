import {Command} from 'commander';
import {SimulationOptions, SimulationRunner} from './SimulationRunner';
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

const DEFAULT_BUILDS: TalentBuild[] = [
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

function buildSimulationOptions(specFile: string, opts: any): SimulationOptions {
   const weaponTypeMap: { [key: string]: WeaponType } = {
      'dagger': WeaponType.Dagger,
      'sword': WeaponType.Sword,
      'mace': WeaponType.Mace,
      'fist': WeaponType.Fist,
   };

   return {
      specFile,
      attackPower: parseInt(opts.attackPower || opts.ap),
      critChance: parseFloat(opts.crit),
      hitChance: parseFloat(opts.hit),
      weaponSkill: parseInt(opts.weaponSkill),
      mainHand: {
         minDamage: parseFloat(opts.mhMin),
         maxDamage: parseFloat(opts.mhMax),
         speed: parseFloat(opts.mhSpeed),
         type: weaponTypeMap[(opts.mhType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
      },
      offHand: opts.offhand ? {
         minDamage: parseFloat(opts.ohMin),
         maxDamage: parseFloat(opts.ohMax),
         speed: parseFloat(opts.ohSpeed),
         type: weaponTypeMap[(opts.ohType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
      } : undefined,
      targetLevel: parseInt(opts.targetLevel),
      targetArmor: parseInt(opts.armor),
      fightLength: parseInt(opts.length),
      iterations: parseInt(opts.iterations),
      postCycleResourceGeneration: opts.postCycleResourceGeneration ? opts.postCycleResourceGeneration != '0' : false,
      quiet: true,
   };
}

function runSimulation(baseOptions: SimulationOptions, talents: string): SimulationResult {
   try {
      const options = {...baseOptions};
      options.talentOverrides = talents;
      
      const runner = new SimulationRunner(options);
      return runner.runAndGetResults();
   } catch (error) {
      console.error(`Error running simulation for talents: ${talents}`);
      throw error;
   }
}

function printTable(results: BuildResult[]): void {
   console.log('='.repeat(120));
   console.log('Build Comparison Results');
   console.log('='.repeat(120));
   console.log();

   console.log(`${'Build Name'.padEnd(20)} | ${'DPS'.padStart(10)} | Talents`);
   console.log('-'.repeat(120));

   for (const result of results) {
      const talentString = Object.entries(result.talentOverrides)
         .map(([name, value]) => `${name}:${value}`)
         .join(', ');

      console.log(
         `${result.buildName.padEnd(20)} | ${result.dps.toFixed(2).padStart(10)} | ${talentString}`
      );
   }
}

function parseBuilds(buildsArg?: string): TalentBuild[] {
   if (!buildsArg) {
      return DEFAULT_BUILDS;
   }

   return buildsArg.split(';').map(buildStr => {
      const [name, talents] = buildStr.split('=');
      if (!name || !talents) {
         throw new Error(`Invalid build format: ${buildStr}. Expected: NAME=talent1:value1,talent2:value2`);
      }
      return {name: name.trim(), talents: talents.trim()};
   });
}

const program = new Command();

program
   .name('wow-classic-compare')
   .description('WoW Classic Era DPS Simulator - Build Comparison Tool')
   .version('1.0.0')
   .argument('<spec-file>', 'Path to spec file (e.g., specs/rogue/daggers.json)')
   .option('--ap, --attack-power <number>', 'Attack power', '1200')
   .option('--crit <number>', 'Crit chance percentage', '35')
   .option('--hit <number>', 'Hit chance percentage', '9')
   .option('--weapon-skill <number>', 'Weapon skill', '300')
   .option('--mh-min <number>', 'Main hand min damage', '76')
   .option('--mh-max <number>', 'Main hand max damage', '142')
   .option('--mh-speed <number>', 'Main hand speed', '1.7')
   .option('--mh-type <type>', 'Main hand type (Dagger, Sword, Mace, Fist)', 'Dagger')
   .option('--oh-min <number>', 'Off hand min damage', '58')
   .option('--oh-max <number>', 'Off hand max damage', '108')
   .option('--oh-speed <number>', 'Off hand speed', '1.5')
   .option('--oh-type <type>', 'Off hand type (Dagger, Sword, Mace, Fist)', 'Dagger')
   .option('--no-offhand', 'Disable off hand weapon')
   .option('--target-level <number>', 'Target level', '63')
   .option('--armor <number>', 'Target armor', '3731')
   .option('--length <number>', 'Fight length in seconds', '300')
   .option('--iterations <number>', 'Number of iterations', '2000')
   .option('--post-res-gen <number>', 'Generate resource AFTER cycle, simulates a more realistic latency', '1')
   .option(
      '-b, --builds <builds>',
      'Custom builds to compare (format: NAME1=talents1;NAME2=talents2). Example: "SF=sealFate:5;NoSF=sealFate:0"'
   )
   .parse(process.argv);

const specFile = program.args[0];
const opts = program.opts();

try {
   const builds = parseBuilds(opts.builds);
   const baseOptions = buildSimulationOptions(specFile, opts);

   console.log(`Running build comparison for: ${specFile}`);
   console.log(`Iterations per build: ${opts.iterations}`);
   console.log(`Testing ${builds.length} builds...`);
   console.log();

   const results: BuildResult[] = [];

   for (const build of builds) {
      console.log(`Running: ${build.name}...`);
      const result = runSimulation(baseOptions, build.talents);
      results.push({
         ...result,
         buildName: build.name,
      });
   }

   printTable(results);
} catch (error) {
   console.error(`Error: ${(error as Error).message}`);
   process.exit(1);
}
