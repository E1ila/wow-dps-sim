import {Command} from 'commander';
import {
   c,
   CharacterClass,
   colorByClass,
   GearStats,
   RogueRotation,
   RogueTalents,
   SimulationConfig,
   WarriorTalents,
   WeaponType
} from './types';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SpecLoader} from './SpecLoader';
import {RogueSimulator} from "./sim/RogueSimulator";

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
   .option('--iterations <number>', 'Number of iterations', '5000')
   .option('--post-res-gen <number>', 'Generate resource AFTER cycle, simulates a more realistic latency', '1')
   .option('--speed <number>', 'Playback speed (0 = instant, 1 = real-time, 0.5 = half speed, etc.)')
   .parse(process.argv);

const specFile = program.args[0];

const opts = program.opts();

const weaponTypeMap: { [key: string]: WeaponType } = {
   'dagger': WeaponType.Dagger,
   'sword': WeaponType.Sword,
   'mace': WeaponType.Mace,
   'fist': WeaponType.Fist,
};

// Load spec file
let spec;
try {
   spec = SpecLoader.load(specFile);
} catch (error) {
   console.error(`Error loading spec file: ${(error as Error).message}`);
   process.exit(1);
}

const classMap: { [key: string]: CharacterClass } = {
   'rogue': CharacterClass.Rogue,
   'warrior': CharacterClass.Warrior,
};

const characterClass = classMap[spec.class.toLowerCase()];
if (!characterClass) {
   console.error(`Error: Unknown class "${spec.class}". Available classes: rogue, warrior`);
   process.exit(1);
}

const baseStats: GearStats = {
   level: 60,
   attackPower: parseInt(opts.attackPower || opts.ap),
   critChance: parseFloat(opts.crit),
   hitChance: parseFloat(opts.hit),
   agility: 300,
   strength: 100,
   weaponSkill: parseInt(opts.weaponSkill),
   mainHandWeapon: {
      minDamage: parseFloat(opts.mhMin),
      maxDamage: parseFloat(opts.mhMax),
      speed: parseFloat(opts.mhSpeed),
      type: weaponTypeMap[(opts.mhType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
   },
   offHandWeapon: opts.offhand ? {
      minDamage: parseFloat(opts.ohMin),
      maxDamage: parseFloat(opts.ohMax),
      speed: parseFloat(opts.ohSpeed),
      type: weaponTypeMap[(opts.ohType || 'Dagger').toLowerCase()] || WeaponType.Dagger,
   } : undefined,
};

const config: SimulationConfig = {
   fightLength: parseInt(opts.length),
   targetLevel: parseInt(opts.targetLevel),
   targetArmor: parseInt(opts.armor),
   iterations: parseInt(opts.iterations),
   postResGen: opts.postResGen ? opts.postResGen != '0' : false,
};

console.log(`${c.brightMagenta}WoW Classic Era - DPS Simulator${c.reset}`);
console.log(` ## ${colorByClass(characterClass)}${characterClass.toUpperCase()}${c.reset} ##`);
console.log(`${c.cyan}Config: ${c.reset}${JSON.stringify(baseStats)}`);
console.log(`${c.cyan}Base stats (inc. gear): ${c.reset}${JSON.stringify(config)}`);
console.log(`${c.cyan}Talents: ${c.reset}${JSON.stringify(spec.talents)}`);
console.log(`${c.cyan}Rotation: ${c.reset}${JSON.stringify(spec.rotation)}`);
console.log(`${c.brightCyan}Running simulation...${c.reset}`);

let simulator: BaseSimulator;

switch (characterClass) {
   case CharacterClass.Rogue:
      simulator = new RogueSimulator(
         baseStats,
         config,
         spec.talents as RogueTalents,
         spec.rotation as RogueRotation
      );
      break;

   case CharacterClass.Warrior:
      simulator = new WarriorSimulator(baseStats, config, spec.talents as WarriorTalents);
      break;

   default:
      console.error(`Error: Class ${characterClass} is not implemented yet.`);
      process.exit(1);
}

const playbackSpeed = opts.speed !== undefined ? parseFloat(opts.speed) : undefined;

if (playbackSpeed !== undefined) {
   // Run single simulation with playback
   (async () => {
      await simulator.simulateWithPlayback(playbackSpeed);
      console.log('\nSimulation complete!');
   })();
} else {
   // Run multiple iterations
   const { results, executionTimeMs } = simulator.runMultipleIterations();
   BaseSimulator.printResults(results, simulator, executionTimeMs);
   console.log('\nSimulation complete!');
}
