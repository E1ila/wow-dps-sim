import {Buff, CharacterClass, PlayerStatsProvider, WeaponEnchant, WeaponType} from '../src/types';
import {BuffsProvider} from '../src/mechanics/DamageCalculator';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';
import {GearBuffsStats, SimulationConfig, SimulationSpec} from "../src/SimulationSpec";
import {RogueTalents} from "../src/talents";

export const createMockBuffsProvider = (activeBuffs: string[] = []): BuffsProvider => ({
  hasBuff: (name: string) => activeBuffs.includes(name)
});

export const createMockStatsProvider = (spec: SimulationSpec, buffsProvider: BuffsProvider): PlayerStatsProvider => {
  return {
    attackCritChance: () => spec.stats.critChance,
    get weaponSkill() {
      const mainHandType = spec.stats.mainHandWeapon.type;
      const gearBonus = spec.stats.weaponSkills.get(mainHandType) || 0;
      return 300 + gearBonus;
    },
    get attackPower() {
      // Calculate attack power from stats (Rogue formula: level*2-20 + strength + agility)
      const baseAP = Math.max(1, spec.playerLevel * 2 - 20);
      let strength = spec.stats.strength;
      let agility = spec.stats.agility;

      if (buffsProvider.hasBuff(Buff.Crusader)) {
        strength += 100;
      }

      return baseAP + strength + agility;
    },
    get hitChance() { return spec.stats.hitChance; },
    get playerLevel() { return spec.playerLevel; },
    get isDualWielding() { return spec.stats.offHandWeapon !== undefined; },
    get targetLevel() { return spec.targetLevel; },
    get haste() { return 1; }
  };
};

export const createCalculator = (spec: SimulationSpec, activeBuffs: string[] = []): RogueDamageCalculator => {
  const buffs = createMockBuffsProvider(activeBuffs);
  return new RogueDamageCalculator(spec, buffs, createMockStatsProvider(spec, buffs));
};

export const baseStats: GearBuffsStats = {
  critChance: 30,
  hitChance: 9,
  // Adjusted to produce attackPower of 1200: 100 (base) + 900 (agility) + 200 (strength) = 1200
  agility: 900,
  strength: 200,
  weaponSkills: new Map(),
  mainHandWeapon: {
    minDamage: 100,
    maxDamage: 100,
    speed: 2.0,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.None
  },
  offHandWeapon: {
    minDamage: 80,
    maxDamage: 80,
    speed: 1.5,
    type: WeaponType.Dagger,
    enchant: WeaponEnchant.None
  },
};

export const config: SimulationConfig = {
  fightLength: 60,
  targetLevel: 63,
  targetArmor: 3700,
  iterations: 1,
};

export const baseTalents: RogueTalents = {
  malice: 0,
  murder: 0,
  improvedSinisterStrike: 0,
  improvedEviscerate: 0,
  relentlessStrikes: false,
  ruthlessness: 0,
  lethality: 0,
  sealFate: 0,
  coldBlood: false,
  improvedSliceAndDice: 0,
  daggerSpecialization: 0,
  swordSpecialization: 0,
  maceSpecialization: 0,
  fistWeaponSpecialization: 0,
  bladeFurry: false,
  adrenalineRush: false,
  aggression: 0,
  dualWieldSpecialization: 0,
  opportunity: 0,
  improvedBackstab: 0,
  hemorrhage: false,
  precision: 0,
  weaponExpertise: 0,
  vigor: false,
};

export function createTestSpec(stats: GearBuffsStats, config: SimulationConfig, talents: RogueTalents): SimulationSpec {
  return {
    name: 'test',
    description: 'test spec',
    class: CharacterClass.Rogue,
    playerLevel: 60,
    gear: [],
    stats: stats,
    simulationConfig: config,
    talents,
    fightLength: config.fightLength ?? 60,
    targetLevel: config.targetLevel,
    targetArmor: config.targetArmor,
    targetType: config.targetType,
    iterations: config.iterations ?? 1,
    postCycleResourceGeneration: config.postCycleResourceGeneration ?? false,
  };
}

// Helper for AttackTable tests
export const createTestStats = (weaponSkill: number, hasOffHand: boolean = true): GearBuffsStats => ({
  critChance: 30,
  hitChance: 0,
  agility: 300,
  strength: 100,
  weaponSkills: new Map([[WeaponType.Sword, weaponSkill - 300]]),
  mainHandWeapon: {
    minDamage: 100,
    maxDamage: 150,
    speed: 2.0,
    type: WeaponType.Sword,
    enchant: WeaponEnchant.None,
  },
  offHandWeapon: hasOffHand ? {
    minDamage: 80,
    maxDamage: 120,
    speed: 2.0,
    type: WeaponType.Sword,
    enchant: WeaponEnchant.None,
  } : undefined,
});

export const wrapStats = (gearStats: GearBuffsStats, targetLevel: number): PlayerStatsProvider => ({
  attackCritChance: () => gearStats.critChance,
  get weaponSkill() {
    const mainHandType = gearStats.mainHandWeapon.type;
    const gearBonus = gearStats.weaponSkills.get(mainHandType) || 0;
    return 300 + gearBonus;
  },
  get attackPower() {
    // Calculate attack power from stats (Rogue formula: level*2-20 + strength + agility)
    const baseAP = Math.max(1, 60 * 2 - 20);
    return baseAP + gearStats.strength + gearStats.agility;
  },
  get hitChance() { return gearStats.hitChance; },
  get playerLevel() { return 60; },
  get targetLevel() { return targetLevel; },
  get isDualWielding() { return gearStats.offHandWeapon !== undefined; },
  get haste() { return 1; }
});
