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
}

export interface DamageEvent {
   timestamp: number;
   ability: string;
   damage: number;
   isCrit: boolean;
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
