import {Command} from 'commander';
import {readFileSync} from 'fs';
import {SimulationOptions, SimulationRunner} from './SimulationRunner';
import * as fs from "node:fs";
import path from "node:path";
import {c} from './types';
import {parseSpecString, SpecOverrides} from "./sim";

interface SimulationResult {
   name?: string;
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

function runSimulation(baseOptions: SimulationOptions, overrides: SpecOverrides): SimulationResult {
   try {
      const options = {...baseOptions};
      options.talentOverrides = overrides.talents;
      options.setupOverrides = overrides.setup;
      options.gearOverrides = overrides.gear;
      options.rotationOverrides = overrides.rotation;

      const runner = new SimulationRunner(options);
      return runner.runAndGetResults();
   } catch (error) {
      console.error(`Error running simulation for spec: ${overrides.talents}${overrides.setup ? ` | ${overrides.setup}` : ''}${overrides.gear ? ` | ${overrides.gear}` : ''}${overrides.rotation ? ` | ${overrides.rotation}` : ''}`);
      throw error;
   }
}

function printTable(results: SimulationResult[]): void {
   console.log('='.repeat(120));
   console.log('Comparison Results');
   console.log('='.repeat(120));
   console.log(`Iterations: ${results[0].iterations}\n`);

   console.log(`${'Spec'.padEnd(20)} | ${'DPS'.padStart(10)} | Talents`);
   console.log('-'.repeat(120));

   // Find the maximum DPS
   const maxDPS = Math.max(...results.map(r => r.dps));
   let index = 1;

   for (const result of results) {
      const talentString = Object.entries(result.talentOverrides)
         .map(([name, value]) => `${name}:${value >= 0 ? +value : "0"}`)
         .join(', ');

      const dpsString = result.dps.toFixed(2).padStart(10);
      const coloredDPS = result.dps === maxDPS ? `${c.brightGreen}${dpsString}${c.reset}` : dpsString;

      console.log(
         `${(result.name ?? `Spec ${index}`).padEnd(10)} | ${coloredDPS} | ${talentString}`
      );
      index++;
   }
}

function parseSpecOverrides(specArg?: string, specFile?: string): SpecOverrides[] {
   if (!specArg) {
      if (specFile) {
         specFile = path.join(__dirname, '..', 'specs', specFile + '.compare');
         if (fs.existsSync(specFile)) {
            const fileContent = readFileSync(specFile, 'utf-8');
            return fileContent.split('\n')
               .filter(line => line && !line.trim().startsWith('#'))
               .filter(line => line.trim())
               .map(line => parseSpecString(line.trim()));
         }
      }
      return [];
   }

   return specArg.split(';').map(spec => parseSpecString(spec.trim()));
}

const program = new Command();

program
   .name('wow-classic-compare')
   .description('WoW Classic Era DPS Simulator - Comparison Tool')
   .version('1.0.0')
   .argument('<spec-file>', 'Path to spec file (e.g., specs/rogue/daggers)')
   .option(
      '-s, --specs <specs>',
      'Custom specs to compare (format: talents1|setup1|gear1|rotation1;talents2|setup2|gear2|rotation2, setup, gear, and rotation optional). Example: "sealFate:5|avoidEviscerate:1|attackPower:1500|backstab,sinisterStrike;sealFate:0"'
   )
   .option(
      '-i, --iterations <number>',
      'Number of simulation iterations to run',
      parseInt
   )
   .option(
      '-f, --fight-length <seconds>',
      'Fight length in seconds',
      parseInt
   )
   .parse(process.argv);

const specFile = program.args[0];
const opts = program.opts();

try {
   const specs = parseSpecOverrides(opts.spec, specFile);

   console.log(`Running comparison for: ${specFile}`);
   console.log();

   const results: SimulationResult[] = [];

   for (let i = 0; i < specs.length; i++) {
      console.log(`Running spec #${i}...`);
      const result = runSimulation({
         specFile,
         quiet: true,
         iterations: opts.iterations,
         fightLength: opts.fightLength,
      }, specs[i]);
      results.push(result);
   }

   printTable(results);
} catch (error) {
   console.error(`Error: ${(error as Error).message}`);
   process.exit(1);
}
