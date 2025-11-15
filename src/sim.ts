import {Command} from 'commander';
import {SimulationRunner} from './SimulationRunner';
import {parseSpecString} from "./globals";
import {SimulationOptions} from "./SimulationSpec";

const program = new Command();

program
   .name('wow-classic-sim')
   .description('WoW Classic Era DPS Simulator. All option stats are base stats, from gear only.')
   .version('1.0.0')
   .argument('<spec-file>', 'Path to spec file (e.g., specs/rogue/daggers.json)')
   .option('--crit <number>', 'Crit chance percentage')
   .option('--hit <number>', 'Hit chance percentage')
   .option('--weapon-skill <number>', 'Weapon skill')
   .option('--no-offhand', 'Disable off hand weapon')
   .option('--target-level <number>', 'Target level')
   .option('--armor <number>', 'Target armor')
   .option('--length <number>', 'Fight length in seconds')
   .option('--iterations <number>', 'Number of iterations')
   .option('--post-res-gen <number>', 'Generate resource AFTER cycle, simulates a more realistic latency')
   .option('-d, --speed <number>', 'Playback speed (0 = instant, 1 = real-time, 0.5 = half speed, etc.)')
   .option('-s, --spec <spec>', 'Override simulation spec (format: talents|setup|gear|rotation, setup, gear, and rotation optional). Example: "sealFate:5|avoidEviscerate:1|backstab,sinisterStrike"')
   .option('-q, --quiet', 'Quiet mode: only print final average DPS')
   .parse(process.argv);

const specFile = program.args[0];
const opts = program.opts();

const spec = opts.spec ? parseSpecString(opts.spec) : undefined;

const simulationOptions: SimulationOptions = {
   specFile,
   critChance: opts.crit !== undefined ? parseFloat(opts.crit) : undefined,
   hitChance: opts.hit !== undefined ? parseFloat(opts.hit) : undefined,
   weaponSkill: opts.weaponSkill !== undefined ? parseInt(opts.weaponSkill) : undefined,
   targetLevel: opts.targetLevel !== undefined ? parseInt(opts.targetLevel) : undefined,
   targetArmor: opts.armor !== undefined ? parseInt(opts.armor) : undefined,
   fightLength: opts.length !== undefined ? parseInt(opts.length) : undefined,
   iterations: opts.iterations !== undefined ? parseInt(opts.iterations) : undefined,
   postCycleResourceGeneration: opts.postCycleResourceGeneration ? opts.postCycleResourceGeneration != '0' : false,
   talentOverrides: spec?.talents,
   setupOverrides: spec?.setup,
   gearOverrides: spec?.gear,
   rotationOverrides: spec?.rotation,
   playbackSpeed: opts.speed !== undefined ? parseFloat(opts.speed) : undefined,
   quiet: opts.quiet === true,
};

const runner = new SimulationRunner(simulationOptions);
runner.run().catch((error) => {
   console.error(error.stack);
   process.exit(1);
});
