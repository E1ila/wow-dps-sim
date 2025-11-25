import {Command} from 'commander';
import {readFileSync} from 'fs';
import {SimulationRunner} from './SimulationRunner';
import * as fs from "node:fs";
import path from "node:path";
import {SpecOverrides} from './types';
import {c, parseSpecString} from "./globals";
import {SimulationOptions} from "./SimulationSpec";

interface SimulationResult {
   name?: string;
   dps: number;
   specOverrides: string;
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

function runSimulation(baseOptions: SimulationOptions, overrides: SpecOverrides, specString: string): SimulationResult {
   try {
      const options = {...baseOptions};
      options.talentOverrides = overrides.talents;
      options.setupOverrides = overrides.setup;
      options.gearOverrides = overrides.gear;
      options.rotationOverrides = overrides.rotation;

      const runner = new SimulationRunner(options);
      const result = runner.runAndGetResults();
      result.specOverrides = specString;
      return result;
   } catch (error) {
      console.error(`Error running simulation for spec: ${specString}`);
      throw error;
   }
}

function printTable(results: SimulationResult[]): void {
   console.log('='.repeat(120));
   console.log('Comparison Results');
   console.log('='.repeat(120));
   console.log(`Iterations: ${results[0].iterations}\n`);

   console.log(`${'Spec'.padEnd(20)} | ${'DPS'.padStart(10)} | Spec String`);
   console.log('-'.repeat(120));

   // Find the maximum DPS
   const maxDPS = Math.max(...results.map(r => r.dps));

   results.forEach((result, index) => result.name ??= `Spec ${index+1}`);
   results
      .sort((a,b)=>b.dps-a.dps)
      .forEach((result) => {

      const dpsString = result.dps.toFixed(2).padStart(10);
      const coloredDPS = result.dps === maxDPS ? `${c.brightGreen}${dpsString}${c.reset}` : dpsString;
      console.log(`${result.name!.padEnd(20)} | ${coloredDPS} | ${result.specOverrides}`);
   });
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
      console.log(`Simulating spec #${i+1}...`);
      const spec = specs[i];
      const specString = [
         spec.talents,
         spec.setup,
         spec.gear,
         spec.rotation
      ].filter(part => part !== undefined).join('|');

      const result = runSimulation({
         specFile,
         quiet: true,
         iterations: opts.iterations,
         fightLength: opts.fightLength,
      }, spec, specString);
      if (!results) {
         console.log(`Failed running simulation!`);
         process.exit(1);
      }
      result.name = spec.name;
      results.push(result);
   }

   printTable(results);
} catch (error: any) {
   console.error(error.stack ?? error);
   process.exit(1);
}
