import {CharacterClass, TargetType, Weapon} from "./types";
import {MageTalents, RogueTalents, ShamanTalents, WarriorTalents} from "./talents";

export interface SimulationSpec {
   name: string;
   description: string;
   class: CharacterClass;
   playerLevel: number;
   rotation?: string[];
   setup?: SimulationSetup;
   talents: RogueTalents | WarriorTalents | MageTalents | ShamanTalents;
   gearStats: GearStats;
   simulationConfig: SimulationConfig;
   fightLength: number;
   targetLevel: number;
   targetType?: TargetType;
   targetArmor: number;
   iterations: number;
   postCycleResourceGeneration?: boolean;
   isHealerSpec?: boolean;
}

export interface GearStats {
   critChance: number;
   hitChance: number;
   agility: number;
   strength: number;
   weaponSkill: number;

   mainHandWeapon: Weapon;
   offHandWeapon?: Weapon;

   // Mage stats
   spellPower?: number;
   spellCrit?: number;
   spellHit?: number;
   intellect?: number;
   spirit?: number;
   mana?: number;

   // Healer stats
   healingPower?: number;
   mp5?: number; // Mana per 5 seconds
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

export interface SimulationConfig {
   targetLevel: number;
   targetType?: TargetType;
   targetArmor: number;
   fightLength?: number;
   iterations?: number;
   postCycleResourceGeneration?: boolean;
}
