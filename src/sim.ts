import {Command} from 'commander';
import {WeaponType} from './types';
import {SimulationOptions, SimulationRunner} from './SimulationRunner';

interface BuildConfig {
   talents: string;
   rotation?: string;
   gear?: string;
}

function parseBuild(buildStr: string): BuildConfig {
   const parts = buildStr.split('|');
   if (parts.length === 1) {
      return { talents: parts[0].trim() };
   } else if (parts.length === 2) {
      return {
         talents: parts[0].trim(),
         rotation: parts[1].trim() || undefined
      };
   } else if (parts.length === 3) {
      return {
         talents: parts[0].trim(),
         rotation: parts[1].trim() || undefined,
         gear: parts[2].trim() || undefined
      };
   } else {
      throw new Error(`Invalid build format: ${buildStr}. Expected format: talents|rotation|gear (rotation and gear optional)`);
   }
}

const program = new Command();

program
   .name('wow-classic-sim')
   .description('WoW Classic Era DPS Simulator. All option stats are base stats, from gear only.')
   .version('1.0.0')
   .argument('<spec-file>', 'Path to spec file (e.g., specs/rogue/daggers.json)')
   .option('--ap, --attack-power <number>', 'Attack power')
   .option('--crit <number>', 'Crit chance percentage')
   .option('--hit <number>', 'Hit chance percentage')
   .option('--weapon-skill <number>', 'Weapon skill')
   .option('--mh-min <number>', 'Main hand min damage')
   .option('--mh-max <number>', 'Main hand max damage')
   .option('--mh-speed <number>', 'Main hand speed')
   .option('--mh-type <type>', 'Main hand type (Dagger, Sword, Mace, Fist)')
   .option('--oh-min <number>', 'Off hand min damage',)
   .option('--oh-max <number>', 'Off hand max damage')
   .option('--oh-speed <number>', 'Off hand speed')
   .option('--oh-type <type>', 'Off hand type (Dagger, Sword, Mace, Fist)')
   .option('--no-offhand', 'Disable off hand weapon')
   .option('--target-level <number>', 'Target level')
   .option('--armor <number>', 'Target armor')
   .option('--length <number>', 'Fight length in seconds')
   .option('--iterations <number>', 'Number of iterations')
   .option('--post-res-gen <number>', 'Generate resource AFTER cycle, simulates a more realistic latency')
   .option('--speed <number>', 'Playback speed (0 = instant, 1 = real-time, 0.5 = half speed, etc.)')
   .option('-b, --build <build>', 'Override build (format: talents|rotation|gear, rotation and gear optional). Example: "sealFate:5|avoidEviscerate:1|attackPower:1500"')
   .option('-q, --quiet', 'Quiet mode: only print final average DPS')
   .parse(process.argv);

const specFile = program.args[0];
const opts = program.opts();

const weaponTypeMap: { [key: string]: WeaponType } = {
   'dagger': WeaponType.Dagger,
   'sword': WeaponType.Sword,
   'mace': WeaponType.Mace,
   'fist': WeaponType.Fist,
};

const buildConfig = opts.build ? parseBuild(opts.build) : undefined;

const simulationOptions: SimulationOptions = {
   specFile,
   attackPower: (opts.attackPower || opts.ap) !== undefined ? parseInt(opts.attackPower || opts.ap) : undefined,
   critChance: opts.crit !== undefined ? parseFloat(opts.crit) : undefined,
   hitChance: opts.hit !== undefined ? parseFloat(opts.hit) : undefined,
   weaponSkill: opts.weaponSkill !== undefined ? parseInt(opts.weaponSkill) : undefined,
   mainHand: opts.mhMin !== undefined ? {
      minDamage: parseFloat(opts.mhMin),
      maxDamage: parseFloat(opts.mhMax),
      speed: parseFloat(opts.mhSpeed),
      type: weaponTypeMap[(opts.mhType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
   } : undefined,
   offHand: opts.offhand && opts.ohMin !== undefined ? {
      minDamage: parseFloat(opts.ohMin),
      maxDamage: parseFloat(opts.ohMax),
      speed: parseFloat(opts.ohSpeed),
      type: weaponTypeMap[(opts.ohType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
   } : undefined,
   targetLevel: opts.targetLevel !== undefined ? parseInt(opts.targetLevel) : undefined,
   targetArmor: opts.armor !== undefined ? parseInt(opts.armor) : undefined,
   fightLength: opts.length !== undefined ? parseInt(opts.length) : undefined,
   iterations: opts.iterations !== undefined ? parseInt(opts.iterations) : undefined,
   postCycleResourceGeneration: opts.postCycleResourceGeneration ? opts.postCycleResourceGeneration != '0' : false,
   talentOverrides: buildConfig?.talents,
   rotationOverrides: buildConfig?.rotation,
   gearOverrides: buildConfig?.gear,
   playbackSpeed: opts.speed !== undefined ? parseFloat(opts.speed) : undefined,
   quiet: opts.quiet === true,
};

const runner = new SimulationRunner(simulationOptions);
runner.run().catch((error) => {
   console.error(`Error: ${error.message}`);
   process.exit(1);
});
