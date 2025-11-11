import {
  Buff,
  CharacterClass,
  GearStats,
  PlayerStatsProvider,
  RogueTalents,
  SimulationConfig,
  WeaponEnchant,
  WeaponType
} from '../src/types';
import {SimulationSpec} from '../src/SpecLoader';
import {BuffsProvider} from '../src/mechanics/DamageCalculator';
import {RogueDamageCalculator} from '../src/mechanics/RogueDamageCalculator';

export const createMockBuffsProvider = (activeBuffs: string[] = []): BuffsProvider => ({
  hasBuff: (name: string) => activeBuffs.includes(name)
});

export const createMockStatsProvider = (spec: SimulationSpec, buffsProvider: BuffsProvider): PlayerStatsProvider => {
  const baseAttackPower = spec.gearStats.attackPower;
  return {
    critChance: () => spec.gearStats.critChance,
    get weaponSkill() { return spec.gearStats.weaponSkill; },
    get attackPower() {
      let ap = baseAttackPower;
      if (buffsProvider.hasBuff(Buff.Crusader)) {
        ap += 100;
      }
      return ap;
    },
    get hitChance() { return spec.gearStats.hitChance; },
    get playerLevel() { return spec.playerLevel; },
    get isDualWielding() { return spec.gearStats.offHandWeapon !== undefined; },
    get targetLevel() { return spec.targetLevel; },
    get haste() { return 1; }
  };
};

export const createCalculator = (spec: SimulationSpec, activeBuffs: string[] = []): RogueDamageCalculator => {
  const buffs = createMockBuffsProvider(activeBuffs);
  return new RogueDamageCalculator(spec, buffs, createMockStatsProvider(spec, buffs));
};

export const baseStats: GearStats = {
  critChance: 30,
  hitChance: 9,
  agility: 300,
  strength: 100,
  weaponSkill: 300,
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

export function createTestSpec(stats: GearStats, config: SimulationConfig, talents: RogueTalents): SimulationSpec {
  return {
    name: 'test',
    description: 'test spec',
    class: CharacterClass.Rogue,
    playerLevel: 60,
    gearStats: stats,
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
export const createTestStats = (weaponSkill: number, hasOffHand: boolean = true): GearStats => ({
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

export const wrapStats = (gearStats: GearStats, targetLevel: number): PlayerStatsProvider => ({
  critChance: () => gearStats.critChance,
  get weaponSkill() { return gearStats.weaponSkill; },
  get attackPower() { return gearStats.attackPower; },
  get hitChance() { return gearStats.hitChance; },
  get playerLevel() { return 60; },
  get targetLevel() { return targetLevel; },
  get isDualWielding() { return gearStats.offHandWeapon !== undefined; },
  get haste() { return 1; }
});
