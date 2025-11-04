import {Command} from 'commander';
import {WeaponType} from './types';
import {SimulationRunner, SimulationOptions} from './SimulationRunner';

const program = new Command();

program
   .name('wow-classic-sim')
   .description('WoW Classic Era DPS Simulator. All option stats are base stats, from gear only.')
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
   .option('--speed <number>', 'Playback speed (0 = instant, 1 = real-time, 0.5 = half speed, etc.)')
   .option('-t, --talent <csv>', 'Override talents (format: NAME:VALUE,NAME:VALUE)')
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

const simulationOptions: SimulationOptions = {
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
   postResGen: opts.postResGen ? opts.postResGen != '0' : false,
   talentOverrides: opts.talent,
   playbackSpeed: opts.speed !== undefined ? parseFloat(opts.speed) : undefined,
   quiet: opts.quiet === true,
};

const runner = new SimulationRunner(simulationOptions);
runner.run().catch((error) => {
   console.error(`Error: ${error.message}`);
   process.exit(1);
});
