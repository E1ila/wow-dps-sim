import { CharacterStats, CharacterClass, SimulationConfig, WeaponType } from './types.js';
import { AttackTable } from './mechanics/AttackTable';

console.log('=== Attack Table Mechanics Verification ===\n');

const createTestStats = (weaponSkill: number, hasOffHand: boolean = true): CharacterStats => ({
  class: CharacterClass.Rogue,
  level: 60,
  attackPower: 1000,
  critChance: 30,
  hitChance: 0,
  agility: 300,
  strength: 100,
  weaponSkill,
  mainHandWeapon: {
    minDamage: 100,
    maxDamage: 150,
    speed: 2.0,
    type: WeaponType.Sword,
  },
  offHandWeapon: hasOffHand ? {
    minDamage: 80,
    maxDamage: 120,
    speed: 2.0,
    type: WeaponType.Sword,
  } : undefined,
});

const raidBossConfig: SimulationConfig = {
  fightLength: 60,
  targetLevel: 63,
  targetArmor: 3731,
  iterations: 1,
};

console.log('Testing against Level 63 Raid Boss (Defense 315)\n');
console.log('Expected values from reference:');
console.log('  300 skill: 8.0% miss, 40% glancing (65% damage)');
console.log('  305 skill: 6.0% miss, 40% glancing (85% damage)');
console.log('  308 skill: 5.7% miss, 40% glancing (95% damage)\n');

console.log('--- Single-Wield Results ---');
for (const skill of [300, 305, 308]) {
  const stats = createTestStats(skill, false);
  const attackTable = new AttackTable(stats, raidBossConfig);

  const missChancePrivate = (attackTable as any).missChance;
  const glancingChancePrivate = (attackTable as any).glancingChance;
  const glancingDamage = (attackTable as any).calculateGlancingDamageModifier();

  console.log(`Weapon Skill ${skill}:`);
  console.log(`  Miss: ${(missChancePrivate * 100).toFixed(2)}%`);
  console.log(`  Glancing: ${(glancingChancePrivate * 100).toFixed(2)}%`);
  console.log(`  Glancing Damage: ${(glancingDamage * 100).toFixed(0)}%`);
  console.log();
}

console.log('\n--- Dual-Wield Results ---');
console.log('Expected: DW miss = (base_miss * 0.8) + 20%\n');

for (const skill of [300, 305, 308]) {
  const stats = createTestStats(skill, true);
  const attackTable = new AttackTable(stats, raidBossConfig);

  const missChancePrivate = (attackTable as any).missChance;
  const targetDefense = 315;
  const defenseSkillDiff = targetDefense - skill;

  let baseMissNoHit: number;
  if (defenseSkillDiff >= 11) {
    baseMissNoHit = 0.05 + (defenseSkillDiff * 0.002);
  } else {
    baseMissNoHit = 0.05 + (defenseSkillDiff * 0.001);
  }
  const expectedDWMiss = (baseMissNoHit * 0.8) + 0.2;

  console.log(`Weapon Skill ${skill}:`);
  console.log(`  Base Miss (no DW): ${(baseMissNoHit * 100).toFixed(2)}%`);
  console.log(`  DW Miss (calculated): ${(missChancePrivate * 100).toFixed(2)}%`);
  console.log(`  DW Miss (expected): ${(expectedDWMiss * 100).toFixed(2)}%`);
  console.log();
}

console.log('\n--- Hit Cap Verification ---');
console.log('Expected hit caps (with DW):');
console.log('  300 skill: 9% hit needed (8% × 0.8 + 20% = 26.4%, need 9% to reach 17.4% miss floor)');
console.log('  305 skill: 6% hit needed');
console.log('  308 skill: ~5.7% hit needed\n');

for (const skill of [300, 305, 308]) {
  const hitPercentages = [0, 3, 6, 9];
  console.log(`Weapon Skill ${skill}:`);

  for (const hitPercent of hitPercentages) {
    const stats = createTestStats(skill, true);
    stats.hitChance = hitPercent;
    const attackTable = new AttackTable(stats, raidBossConfig);
    const missChancePrivate = (attackTable as any).missChance;

    console.log(`  ${hitPercent}% hit: ${(missChancePrivate * 100).toFixed(2)}% miss`);
  }
  console.log();
}
