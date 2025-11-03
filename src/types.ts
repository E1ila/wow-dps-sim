export const c = {
   gray: '\x1b[90m',
   white: '\x1b[37m',
   yellow: '\x1b[33m',
   red: '\x1b[31m',
   reset: '\x1b[0m',
} as const;

export enum CharacterClass {
   Rogue = 'rogue',
   Warrior = 'warrior',
}

export interface CharacterStats {
   class: CharacterClass;
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

export interface RogueTalents {
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

export interface WarriorTalents {
   armsTree: Record<string, number>;
   furyTree: Record<string, number>;
   protectionTree: Record<string, number>;
}

export interface RogueRotation {
   refreshSndSecondsAhead5Combo: number;
}

export interface WarriorRotation {
   // Placeholder for warrior rotation config
}

export interface SimulationState {
   currentTime: number;
   targetHealth: number;
   globalCooldownExpiry: number;
}

export interface MeleeSimulationState extends SimulationState {
   mainHandNextSwing: number;
   offHandNextSwing: number;
}

export interface RogueSimulationState extends MeleeSimulationState {
   energy: number;
   comboPoints: number;
   nextEnergyTick: number;
   sliceAndDiceActive: boolean;
   sliceAndDiceExpiry: number;
}

export interface SimulationConfig {
   fightLength: number;
   targetLevel: number;
   targetArmor: number;
   iterations: number;
   postResGen?: boolean;
}

export interface DamageEvent extends AttackResult {
   timestamp: number;
   ability: string;
}

export interface RogueDamageEvent extends DamageEvent {
   comboPointsGained: number;
}

export interface SimulationResult {
   totalDamage: number;
   dps: number;
   events: DamageEvent[];
   damageBreakdown: Map<string, number>;
}

export enum AttackType {
   NoWeapon = 'Fists',
   Miss = 'Miss',
   Dodge = 'Dodge',
   Glancing = 'Glancing',
   Hit = 'Hit',
   Crit = 'Crit',
   Block = 'Block',
}

export interface AttackTableResult {
   type: AttackType;
   amountModifier: number;
}

export interface AttackResult extends AttackTableResult {
   baseAmount: number;
   amount: number;
}
