import {Command} from 'commander';
import {readFileSync} from 'fs';
import {SimulationOptions, SimulationRunner} from './SimulationRunner';
import * as fs from "node:fs";
import path from "node:path";
import {c} from './types';

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

   // Find the maximum DPS
   const maxDPS = Math.max(...results.map(r => r.dps));

   for (const result of results) {
      const talentString = Object.entries(result.talentOverrides)
         .map(([name, value]) => `${name}:${value}`)
         .join(', ');

      const dpsString = result.dps.toFixed(2).padStart(10);
      const coloredDPS = result.dps === maxDPS ? `${c.brightGreen}${dpsString}${c.reset}` : dpsString;

      console.log(
         `${result.buildName.padEnd(20)} | ${coloredDPS} | ${talentString}`
      );
   }
}

function parseBuilds(buildsArg?: string, specFile?: string): string[] {
   if (!buildsArg) {
      if (specFile) {
         specFile = path.join(__dirname, '..', 'specs', specFile + '.compare');
         if (fs.existsSync(specFile)) {
            const fileContent = readFileSync(specFile, 'utf-8');
            return fileContent.split('\n').filter(line => line && !line.trim().startsWith('--'))
               .filter(line => line.trim())
               .map(line => line.trim());
         }
      }
      return [];
   }

   return buildsArg.split(';').map(talents => talents.trim());
}

const program = new Command();

program
   .name('wow-classic-compare')
   .description('WoW Classic Era DPS Simulator - Build Comparison Tool')
   .version('1.0.0')
   .argument('<spec-file>', 'Path to spec file (e.g., specs/rogue/daggers)')
   .option(
      '-b, --builds <builds>',
      'Custom builds to compare (format: talents1;talents2). Example: "sealFate:5;sealFate:0"'
   )
   .parse(process.argv);

const specFile = program.args[0];
const opts = program.opts();

try {
   const builds = parseBuilds(opts.builds, specFile);

   console.log(`Running build comparison for: ${specFile}`);
   console.log(`Testing ${builds.length} builds...`);
   console.log();

   const results: BuildResult[] = [];

   for (let i = 0; i < builds.length; i++) {
      const buildName = `Build ${i + 1}`;
      console.log(`Running: ${buildName}...`);
      const result = runSimulation({
         specFile,
         quiet: true,
      }, builds[i]);
      results.push({
         ...result,
         buildName,
      });
   }

   printTable(results);
} catch (error) {
   console.error(`Error: ${(error as Error).message}`);
   process.exit(1);
}
