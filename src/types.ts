export const c = {
   black: '\x1b[30m',
   red: '\x1b[31m',
   green: '\x1b[32m',
   yellow: '\x1b[33m',
   blue: '\x1b[34m',
   magenta: '\x1b[35m',
   cyan: '\x1b[36m',
   white: '\x1b[37m',
   gray: '\x1b[90m',
   brightRed: '\x1b[91m',
   brightGreen: '\x1b[92m',
   brightYellow: '\x1b[93m',
   brightBlue: '\x1b[94m',
   brightMagenta: '\x1b[95m',
   brightCyan: '\x1b[96m',
   brightWhite: '\x1b[97m',
   reset: '\x1b[0m',
} as const;

export function colorByClass(characterClass: CharacterClass): string {
   switch (characterClass) {
      case CharacterClass.Rogue:
         return c.yellow;
      case CharacterClass.Warrior:
         return c.red;
   }
}

export enum Buffs {
   SnD = 'SnD',
}

export enum CharacterClass {
   Rogue = 'rogue',
   Warrior = 'warrior',
}

export interface GearStats {
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
   relentlessStrikes: boolean;
   ruthlessness: number;
   lethality: number;
   sealFate: number;
   coldBlood: boolean;
   improvedSliceAndDice: number;
   daggerSpecialization: number;
   swordSpecialization: number;
   maceSpecialization: number;
   fistWeaponSpecialization: number;
   bladeFurry: boolean;
   adrenalineRush: boolean;
   aggression: number;
   dualWieldSpecialization: number;
   opportunity: number;
   improvedBackstab: number;
   hemorrhage: boolean;
   precision: number;
   weaponExpertise: number;
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

export interface Buff {
   name: string;
   expiry: number;
}

export interface SimulationState {
   currentTime: number;
   targetHealth: number;
   globalCooldownExpiry: number;
   activeBuffs: Buff[];
}

export interface MeleeSimulationState extends SimulationState {
   mainHandNextSwing: number;
   offHandNextSwing: number;
}

export interface RogueSimulationState extends MeleeSimulationState {
   energy: number;
   comboPoints: number;
   nextEnergyTick: number;
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
   eventType: 'damage';
}

export interface RogueDamageEvent extends DamageEvent {
   comboPointsGained: number;
   comboPointsSpent: number;
}

export interface BuffEvent {
   timestamp: number;
   buffName: string;
   duration: number;
   eventType: 'buff';
}

export interface RogueBuffEvent extends BuffEvent {
   comboPointsUsed: number;
}

export interface ProcEvent {
   timestamp: number;
   procName: string;
   eventType: 'proc';
}

export type SimulationEvent = DamageEvent | BuffEvent | ProcEvent;

export interface SimulationStatistics {
   critCount: number;
   hitCount: number;
   glancingCount: number;
   missCount: number;
   dodgeCount: number;
}

export interface SimulationResult {
   totalDamage: number;
   dps: number;
   events: SimulationEvent[];
   damageBreakdown: Map<string, number>;
   statistics: SimulationStatistics;
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
