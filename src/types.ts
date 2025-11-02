export interface CharacterStats {
  level: number;
  attackPower: number;
  critChance: number;
  hitChance: number;
  agility: number;
  strength: number;
  weaponSkill: number;

  mainHandWeapon: Weapon;
  offHandWeapon?: Weapon;
}

export interface Weapon {
  minDamage: number;
  maxDamage: number;
  speed: number;
  type: WeaponType;
}

export enum WeaponType {
  Sword = 'Sword',
  Dagger = 'Dagger',
  Mace = 'Mace',
  Fist = 'Fist',
}

export interface Talents {
  malice: number;
  murder: number;
  improvedSinisterStrike: number;
  improvedEviscerate: number;
  relentlessStrikes: number;
  lethality: number;
  sealFate: number;
  coldBlood: boolean;
  improvedSliceAndDice: number;
  daggerSpecialization: number;
  swordSpecialization: number;
  maceSpecialization: number;
  fistWeaponSpecialization: number;
  bladeFurry: boolean;
  aggression: number;
  dualWieldSpecialization: number;
  opportunism: number;
  improvedBackstab: number;
  hemorrhage: boolean;
}

export interface SimulationState {
  currentTime: number;
  energy: number;
  comboPoints: number;
  targetHealth: number;

  sliceAndDiceActive: boolean;
  sliceAndDiceExpiry: number;

  mainHandNextSwing: number;
  offHandNextSwing: number;

  globalCooldownExpiry: number;
  nextEnergyTick: number;
}

export interface SimulationConfig {
  fightLength: number;
  targetLevel: number;
  targetArmor: number;
  iterations: number;
}

export interface DamageEvent {
  timestamp: number;
  ability: string;
  damage: number;
  isCrit: boolean;
  comboPointsGained: number;
}

export interface SimulationResult {
  totalDamage: number;
  dps: number;
  events: DamageEvent[];
  damageBreakdown: Map<string, number>;
}

export enum AttackResult {
  Miss = 'Miss',
  Dodge = 'Dodge',
  Glancing = 'Glancing',
  Hit = 'Hit',
  Crit = 'Crit',
  Block = 'Block',
}

export interface AttackTableResult {
  result: AttackResult;
  damageModifier: number;
}
