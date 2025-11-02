import {Command} from 'commander';
import {CharacterStats, CharacterClass, RogueTalents, WarriorTalents, SimulationConfig, WeaponType} from './types.js';
import {RogueSimulator} from './sim/RogueSimulator';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SpecLoader} from './SpecLoader';

const program = new Command();

program
   .name('wow-classic-sim')
   .description('WoW Classic Era DPS Simulator')
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
   .option('--oh-speed <number>', 'Off hand speed', '1.8')
   .option('--oh-type <type>', 'Off hand type (Dagger, Sword, Mace, Fist)', 'Dagger')
   .option('--no-offhand', 'Disable off hand weapon')
   .option('--target-level <number>', 'Target level', '63')
   .option('--armor <number>', 'Target armor', '3731')
   .option('--length <number>', 'Fight length in seconds', '60')
   .option('--iterations <number>', 'Number of iterations', '100')
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

const stats: CharacterStats = {
   class: characterClass,
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
};

console.log('WoW Classic Era - DPS Simulator');
console.log('================================\n');

console.log(`Class: ${characterClass.toUpperCase()}`);
console.log(`Spec: ${spec.name}`);
console.log(`Description: ${spec.description}`);

console.log('\nCharacter Stats:');
console.log(`  Attack Power: ${stats.attackPower}`);
console.log(`  Crit Chance: ${stats.critChance}%`);
console.log(`  Hit Chance: ${stats.hitChance}%`);
console.log(`  Weapon Skill: ${stats.weaponSkill}`);
console.log(`  Main Hand: ${stats.mainHandWeapon.minDamage}-${stats.mainHandWeapon.maxDamage} (${stats.mainHandWeapon.speed}s) ${stats.mainHandWeapon.type}`);
if (stats.offHandWeapon) {
   console.log(`  Off Hand: ${stats.offHandWeapon.minDamage}-${stats.offHandWeapon.maxDamage} (${stats.offHandWeapon.speed}s) ${stats.offHandWeapon.type}`);
}

console.log(`\nSimulation Config:`);
console.log(`  Fight Length: ${config.fightLength}s`);
console.log(`  Target: Level ${config.targetLevel} (${config.targetArmor} armor)`);
console.log(`  Iterations: ${config.iterations}\n`);

console.log('Running simulation...\n');

let simulator: BaseSimulator;

switch (characterClass) {
   case CharacterClass.Rogue:
      simulator = new RogueSimulator(stats, spec.talents as RogueTalents, config);
      break;

   case CharacterClass.Warrior:
      simulator = new WarriorSimulator(stats, spec.talents as WarriorTalents, config);
      break;

   default:
      console.error(`Error: Class ${characterClass} is not implemented yet.`);
      process.exit(1);
}

const results = simulator.runMultipleIterations();
BaseSimulator.printResults(results);

console.log('\nSimulation complete!');
