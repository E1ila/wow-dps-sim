import { CharacterStats, Talents, SimulationConfig, WeaponType } from './types.js';
import { RogueSimulator } from './simulator.js';

const stats: CharacterStats = {
  level: 60,
  attackPower: 1200,
  critChance: 35,
  hitChance: 9,
  agility: 300,
  strength: 100,
  weaponSkill: 300,
  mainHandWeapon: {
    minDamage: 76,
    maxDamage: 142,
    speed: 1.7,
    type: WeaponType.Dagger,
  },
  offHandWeapon: {
    minDamage: 58,
    maxDamage: 108,
    speed: 1.8,
    type: WeaponType.Dagger,
  },
};

const combatSwords: Talents = {
  malice: 5,
  murder: 2,
  improvedSinisterStrike: 2,
  improvedEviscerate: 3,
  relentlessStrikes: 1,
  lethality: 5,
  sealFate: 5,
  coldBlood: false,
  improvedSliceAndDice: 3,
  daggerSpecialization: 0,
  swordSpecialization: 5,
  maceSpecialization: 0,
  fistWeaponSpecialization: 0,
  bladeFurry: true,
  aggression: 5,
  dualWieldSpecialization: 5,
  opportunism: 0,
  improvedBackstab: 0,
  hemorrhage: false,
};

const daggersSpec: Talents = {
  malice: 5,
  murder: 2,
  improvedSinisterStrike: 0,
  improvedEviscerate: 3,
  relentlessStrikes: 1,
  lethality: 5,
  sealFate: 5,
  coldBlood: true,
  improvedSliceAndDice: 3,
  daggerSpecialization: 5,
  swordSpecialization: 0,
  maceSpecialization: 0,
  fistWeaponSpecialization: 0,
  bladeFurry: false,
  aggression: 0,
  dualWieldSpecialization: 5,
  opportunism: 5,
  improvedBackstab: 3,
  hemorrhage: false,
};

const config: SimulationConfig = {
  fightLength: 60,
  targetLevel: 63,
  targetArmor: 3731,
  iterations: 100,
};

console.log('WoW Classic Era - Rogue DPS Simulator');
console.log('=====================================\n');

console.log('Character Stats:');
console.log(`  Attack Power: ${stats.attackPower}`);
console.log(`  Crit Chance: ${stats.critChance}%`);
console.log(`  Hit Chance: ${stats.hitChance}%`);
console.log(`  Main Hand: ${stats.mainHandWeapon.minDamage}-${stats.mainHandWeapon.maxDamage} (${stats.mainHandWeapon.speed}s) ${stats.mainHandWeapon.type}`);
if (stats.offHandWeapon) {
  console.log(`  Off Hand: ${stats.offHandWeapon.minDamage}-${stats.offHandWeapon.maxDamage} (${stats.offHandWeapon.speed}s) ${stats.offHandWeapon.type}`);
}
console.log(`\nFight Length: ${config.fightLength}s`);
console.log(`Target: Level ${config.targetLevel} (${config.targetArmor} armor)`);
console.log(`Iterations: ${config.iterations}\n`);

console.log('\n--- Running Dagger Spec Simulation ---');
const daggerStats = { ...stats };
const daggerSim = new RogueSimulator(daggerStats, daggersSpec, config);
const daggerResults = daggerSim.runMultipleIterations();
RogueSimulator.printResults(daggerResults);

console.log('\n\n--- Running Combat Swords Simulation ---');
const swordStats = {
  ...stats,
  mainHandWeapon: {
    minDamage: 99,
    maxDamage: 184,
    speed: 2.6,
    type: WeaponType.Sword,
  },
  offHandWeapon: {
    minDamage: 85,
    maxDamage: 129,
    speed: 2.7,
    type: WeaponType.Sword,
  },
};
const swordSim = new RogueSimulator(swordStats, combatSwords, config);
const swordResults = swordSim.runMultipleIterations();
RogueSimulator.printResults(swordResults);

console.log('\n\nSimulation complete!');
