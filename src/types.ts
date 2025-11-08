export interface SpecOverrides {
   talents: string;
   setup?: string;
   gear?: string;
   rotation?: string;
}

export enum Buff {
   SnD = 'SnD',
   Crusader = 'Crusader',
   BattleStance = 'BattleStance',
   DefensiveStance = 'DefensiveStance',
   BerserkerStance = 'BerserkerStance',
   Flurry = 'Flurry',
   Enrage = 'Enrage',
   DeepWounds = 'DeepWounds',
   Rend = 'Rend',
   SweepingStrikes = 'SweepingStrikes',
}

export enum CharacterClass {
   Rogue = 'rogue',
   Warrior = 'warrior',
}

export enum TargetType {
   Undefined = 'undefined',
   Humanoid = 'humanoid',
   Beast = 'beast',
   Dragonkin = 'dragonkin',
   Giant = 'giant',
   Undead = 'undead',
   Demon = 'demon',
   Elemental = 'elemental',
}

export interface GearStats {
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
   enchant: WeaponEnchant;
}

export enum WeaponEnchant {
   None = 'None',
   Crusader = 'Crusader',
   Dmg3 = '+3 damage',
   Dmg4 = '+4 damage',
   Dmg5 = '+5 damage',
   Agility25 = '+25 agility',
   Agility15 = '+15 agility',
}

export enum WeaponType {
   Sword = 'Sword',
   Dagger = 'Dagger',
   Mace = 'Mace',
   Fist = 'Fist',
}

export enum Ability {
   MainHand = 'MH',
   OffHand = 'OH',
   Test = 'test',
   Extra = 'EXTRA',
   Skip = 'skip',

   // rogue
   Eviscerate = 'evis',
   SinisterStrike = 'ss',
   Backstab = 'bs',
   Hemorrhage = 'hemo',
   SliceAndDice = 'snd',

   // custom rogue ops
   AddCombo = 'cp',
   Set1Combo = 'cp1',
   Set2Combo = 'cp2',
   Set3Combo = 'cp3',
   Set4Combo = 'cp4',
   Set5Combo = 'cp5',
   Energy1 = 'energy1',
   Energy2 = 'energy2',
   Energy3 = 'energy3',
   Energy4 = 'energy4',
   Energy5 = 'energy5',

   // warrior
   Bloodthirst = 'bt',
   MortalStrike = 'ms',
   Execute = 'exec',
   Whirlwind = 'ww',
   HeroicStrike = 'hs',
   Cleave = 'clv',
   Revenge = 'rvg',
   Overpower = 'op',
   Rend = 'rend',
   Slam = 'slam',
   Bloodrage = 'bldr',
   BerserkerRage = 'berage',
   BattleStance = 'batstance',
   DefensiveStance = 'defstand',
   BerserkerStance = 'berstance',
}

export interface Attack {
   ability: Ability;
   isSpecialAttack: boolean;
   weapon: Weapon;
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
   vigor: boolean;
}

export interface WarriorTalents {
   // Arms Tree
   cruelty: number; // +1% crit per rank
   improvedRend: number; // 1.15x-1.35x multiplier
   impale: number; // +10% crit damage per rank
   improvedOverpower: number; // +25% crit per rank
   twoHandedSpecialization: number; // +1% dmg per rank with 2H
   improvedMortalStrike: boolean;

   // Fury Tree
   unbridledWrath: number; // 8% per rank for 1 rage on white hit
   flurry: number; // Attack speed buff on crit (1.1x-1.3x)
   enrage: number; // +5% damage per rank on crit
   improvedBloodthirst: boolean;
   improvedBerserkerRage: number; // 5 rage per rank instant
   dualWieldSpecialization: number; // +5% OH damage per rank
   improvedHeroicStrike: number; // Reduce HS cost
   improvedCleave: number; // Increase Cleave damage

   // Protection Tree
   angerManagement: boolean; // 1 rage every 3 seconds
   defiance: number; // +3% per rank defensive stance threat
   improvedRevenge: number; // Reduces cooldown/cost
   shieldSpecialization: number; // +1 block per rank, 20% proc for 1 rage
   tacticalMastery: number; // Retain rage on stance switch

   // Generic tree for backwards compatibility
   armsTree?: Record<string, number>;
   furyTree?: Record<string, number>;
   protectionTree?: Record<string, number>;
}

export interface SimulationSetup {
   // general
   wbs?: boolean; // apply world buffs
   // rogue
   waitForSndExpiry?: number;
   refreshSndSecondsBeforeExpiry?: number;
   avoidEviscerate?: boolean;
   veiledShadowsSet?: boolean;
   disableAutoAttacks?: boolean;
   prefer5EvisOverSnd?: boolean;
}

export interface SimulationState {
   currentTime: number;
   targetHealth: number;
   globalCooldownExpiry: number;
   activeBuffs: ActiveBuff[];
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

export enum WarriorStance {
   Battle = 'battle',
   Defensive = 'defensive',
   Berserker = 'berserker',
}

export interface WarriorSimulationState extends MeleeSimulationState {
   rage: number;
   currentStance: WarriorStance;
   nextAngerManagementTick: number;

   // Proc states
   overpowerAvailable: boolean;
   overpowerExpiry: number;
   revengeAvailable: boolean;
   revengeExpiry: number;

   // Buff stacks
   flurryStacks: number;
   enrageStacks: number;
   sweepingStrikesStacks: number;

   // Cooldowns
   bloodthirstCooldown: number;
   mortalStrikeCooldown: number;
   whirlwindCooldown: number;
   revengeCooldown: number;
   overpowerCooldown: number;
   bloodrageCooldown: number;
   berserkerRageCooldown: number;
   stanceCooldown: number;

   // Queue system for Heroic Strike/Cleave
   queuedAbility: Ability | null;
   queueActivationTime: number;
}

export interface SimulationConfig {
   targetLevel: number;
   targetType?: TargetType;
   targetArmor: number;
   fightLength?: number;
   iterations?: number;
   postCycleResourceGeneration?: boolean;
}

export interface ActiveBuff {
   name: string;
   expiry: number;
}

export interface DamageEvent extends AttackResult {
   timestamp: number;
   ability: string;
   eventType: 'damage';
   hidden?: boolean
}

export interface RogueDamageEvent extends DamageEvent {
   comboPointsGained: number;
   comboPointsSpent: number;
}

export interface BuffEvent {
   timestamp: number;
   buffName: string;
   duration: number;
   eventType: 'buff++';
   hidden?: boolean
}

export interface RogueBuffEvent extends BuffEvent {
   comboPointsUsed: number;
}

export interface ProcEvent {
   timestamp: number;
   procName: string;
   eventType: 'proc';
   hidden?: boolean
}

export interface BuffFadeEvent {
   timestamp: number;
   buffName: string;
   eventType: 'buff--';
   hidden?: boolean
}

export type SimulationEvent = DamageEvent | BuffEvent | ProcEvent | BuffFadeEvent;

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

export interface PlayerStatsProvider {
   critChance(attack: Attack): number;
   get weaponSkill(): number;
   get attackPower(): number;
   get hitChance(): number;
   get playerLevel(): number;
   get isDualWielding(): boolean;
   get targetLevel(): number;
   get haste(): number;
}
