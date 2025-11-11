export interface SpecOverrides {
   talents: string;
   setup?: string;
   gear?: string;
   rotation?: string;
}

export enum Buff {
   SnD = 'SnD',
   ColdBlood = 'ColdBlood',
   Crusader = 'Crusader',
   BattleStance = 'BattleStance',
   DefensiveStance = 'DefensiveStance',
   BerserkerStance = 'BerserkerStance',
   Flurry = 'Flurry',
   Enrage = 'Enrage',
   DeepWounds = 'DeepWounds',
   Rend = 'Rend',
   SweepingStrikes = 'SweepingStrikes',
   // Mage buffs
   ArcanePower = 'ArcanePower',
   Combustion = 'Combustion',
   Clearcast = 'Clearcast',
   PresenceOfMind = 'PresenceOfMind',
   IceArmor = 'IceArmor',
   MageArmor = 'MageArmor',
   IceBarrier = 'IceBarrier',
   Ignite = 'Ignite',
   ImprovedScorch = 'ImprovedScorch',
}

export enum CharacterClass {
   Rogue = 'rogue',
   Warrior = 'warrior',
   Mage = 'mage',
   Shaman = 'shaman',
}

export enum Race {
   Human = 'human',
   Orc = 'orc',
   Dwarf = 'dwarf',
   NightElf = 'night elf',
   Undead = 'undead',
   Troll = 'troll',
   Gnome = 'gnome',
   Tauren = 'tauren',
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
   Unknown = 0,
   Axe = 1,
   Sword = 2,
   Mace = 3,
   Dagger = 4,
   Fist = 5,
   TwoHandedAxe = 6,
   TwoHandedSword = 7,
   TwoHandedMace = 8,
   Polearm = 9,
   Staff = 10,
   Thrown = 11,
   Bow = 12,
   Crossbow = 13,
   Gun = 14,
   FeralCombat = 15,
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
   ColdBlood = 'coldblood',

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

   // mage
   Fireball = 'fb',
   Frostbolt = 'frostb',
   Scorch = 'scorch',
   FireBlast = 'fireblast',
   ArcaneMissiles = 'am',
   ArcaneExplosion = 'ae',
   Evocation = 'evoc',
   ArcanePower = 'ap',
   PresenceOfMind = 'pom',
   Combustion = 'combustion',

   // shaman healing
   HealingWave = 'hw',
   LesserHealingWave = 'lhw',
   ChainHeal = 'ch',
   NaturesSwiftness = 'ns',
}

export interface Attack {
   ability: Ability;
   isSpecialAttack: boolean;
   weapon: Weapon;
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

   // Internal cooldowns for procs
   swordSpecICD: number;
   sealFateICD: number;

   // Ability cooldowns
   coldBloodCooldown: number;
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

export interface MageSimulationState extends SimulationState {
   mana: number;
   currentCastEnd: number;
   castingSpell: Ability | null;
   nextManaTick: number;

   // Buff stacks
   combustionStacks: number;
   improvedScorchStacks: number;
   igniteStacks: number;

   // Cooldowns
   fireBlastCooldown: number;
   arcanePowerCooldown: number;
   combustionCooldown: number;
   presenceOfMindCooldown: number;
   evocationCooldown: number;
   iceBarrierCooldown: number;
}

export interface ShamanSimulationState extends SimulationState {
   mana: number;
   currentCastEnd: number;
   castingSpell: Ability | null;
   nextManaTick: number;

   // Healing throughput tracking
   totalHealing: number;
   overhealing: number;

   // Target health (simulating a tank being healed)
   targetCurrentHealth: number;
   targetMaxHealth: number;

   // Cooldowns
   naturesSwiftnessCooldown: number;
   manaTideCooldown: number;
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

export interface HealingEvent {
   timestamp: number;
   ability: string;
   eventType: 'healing';
   amount: number;
   overhealing: number;
   crit: boolean;
   hidden?: boolean
}

export type SimulationEvent = DamageEvent | BuffEvent | ProcEvent | BuffFadeEvent | HealingEvent;

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
   attackCritChance(attack: Attack): number;
   get weaponSkill(): number;
   get attackPower(): number;
   get hitChance(): number;
   get playerLevel(): number;
   get isDualWielding(): boolean;
   get targetLevel(): number;
   get haste(): number;
}
