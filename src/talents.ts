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

export interface MageTalents {
   // Arcane Tree
   arcaneSubtlety: number; // -10% threat per rank
   arcaneFocus: number; // +2% spell hit on Arcane per rank
   improvedArcaneMissiles: number; // -0.5s channel time per rank
   arcaneMind: number; // +2% max mana per rank
   arcaneMeditation: number; // +5% spirit regen while casting per rank
   arcaneConcentration: number; // 2% proc chance per rank for clearcasting
   arcanePower: boolean; // +30% damage, +30% cost, 15s duration, 3min CD
   arcaneInstability: number; // +1% damage and +1% crit per rank

   // Fire Tree
   improvedFireball: number; // -0.1s cast time per rank
   ignite: boolean; // 40% of fire crit damage as DoT over 4s
   flameThrowing: number; // +3 yards range per rank
   improvedScorch: number; // 33%/66%/100% chance to apply debuff per rank
   masterOfElements: number; // 10% per rank mana refund on spell crit
   criticalMass: number; // +2% fire crit per rank
   firePower: number; // +2% fire damage per rank (excludes Ignite)
   combustion: boolean; // +10% crit per stack, consumed after 3 crits
   burningSoul: number; // -15% threat on fire spells per rank

   // Frost Tree
   improvedFrostbolt: number; // -0.1s cast time per rank
   iceShards: number; // +20% crit damage on frost spells per rank
   piercingIce: number; // +2% frost damage per rank
   frostChanneling: number; // -5% mana cost, -10% threat on frost per rank
   elementalPrecision: number; // +2% spell hit on Fire/Frost per rank
   iceBarrier: boolean; // Absorbs damage, 1min CD
   arcticReach: number; // +10% range on frost spells per rank
   wintersChill: number; // 20% proc chance per rank to apply debuff
}

export interface ShamanTalents {
   // Restoration Tree
   tidalFocus: number; // -1% mana cost per rank on healing spells
   improvedHealingWave: number; // -0.1s cast time per rank on Healing Wave
   tidalMastery: number; // +1% crit per rank on healing and lightning spells
   healingFocus: number; // Reduces pushback on healing spells by 23%/46%/70%
   naturesGuidance: number; // +3% spell hit per rank
   healingGrace: number; // -5% threat per rank on healing spells
   restorativeTotems: number; // +5% effect per rank on healing totems
   tidalWaves: boolean; // Chain Heal/Riptide make next HW/LHW faster
   naturesSwiftness: boolean; // 3min CD, next spell instant
   manaTideTotem: boolean; // Totem restores mana
   purification: number; // +2% healing per rank
   earthShield: boolean; // Place shield on target that heals when damaged

   // Elemental Tree
   convection: number; // -2% mana cost per rank on elemental spells
   concussion: number; // +1% damage per rank on lightning/shock spells
   callOfFlame: number; // +5% damage per rank on fire totems
   elementalFocus: boolean; // Clearcasting proc (10% on crit)
   reverberation: number; // -5% mana cost per rank on shock spells
   callOfThunder: number; // +1% crit per rank on lightning spells
   improvedFireTotems: number; // +6% spell power bonus per rank from fire totems
   eyeOfTheStorm: number; // -3.3% pushback per rank on lightning spells
   elementalFury: number; // +20% crit damage per rank on elemental spells
   stormreach: number; // +3% range per rank on lightning spells
   elementalPrecision: number; // -2% threat per rank, +1% spell hit per rank
   lightningMastery: number; // -0.2s cast time per rank on Lightning Bolt/Chain Lightning
   elementalMastery: boolean; // 3min CD, next spell instant + guaranteed crit
   lightningOverload: number; // 4%/8%/12%/16%/20% chance per rank to cast second lightning spell at reduced damage
   totemOfWrath: boolean; // Totem increases spell power and spell crit for party

   // Enhancement Tree
   ancestralKnowledge: number; // +1% max mana per rank
   shieldSpecialization: number; // +5% block chance per rank
   thunderingStrikes: number; // +1% crit per rank with elemental weapons
   improvedGhostWolf: number; // -0.5s cast time per rank on Ghost Wolf
   enhancingTotems: number; // +8% strength per rank from strength of earth totem
   shamanisticFocus: number; // -10%/20%/30% mana cost on shock spells after crit
   flurry: number; // +5%/10%/15%/20%/25% attack speed after crit
   spiritWeapons: boolean; // Reduces threat by 30%
   mentalDexterity: number; // +100%/200%/300% of attack power as spell power
   unleashedRage: number; // 2%/4%/6% attack power bonus to party after crit
   weaponMastery: number; // +2% damage per rank with melee weapons
   dualWieldSpec: number; // +10%/20%/30%/40%/50% offhand damage
   stormstrike: boolean; // Instant attack, increases nature damage taken
   mentalQuickness: number; // +6%/12%/18%/20%/25% of attack power as spell/healing power
   shamanisticRage: boolean; // 1min CD, 30% of intellect as mana over 15s, damage reduction
}
