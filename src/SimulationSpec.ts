import {CharacterClass, Race, TargetType, Weapon, WeaponType} from "./types";
import {MageTalents, RogueTalents, ShamanTalents, WarriorTalents} from "./talents";
import {WorldBuff} from "./worldbuffs";
import {Consumable} from "./consumables";

export interface SimulationSpec {
   name: string;
   description: string;
   class: CharacterClass;
   race?: Race;
   playerLevel: number;
   rotation?: string[];
   setup?: PlayerSetup;
   talents: RogueTalents | WarriorTalents | MageTalents | ShamanTalents;
   extraStats: Stats; // from gear+buffs+consumes - not inc. base stats (from level) nor enchants, etc.
   gear: EquippedItemSlot[];
   worldBuffs?: WorldBuff[];
   consumables?: Consumable[];
   simulationConfig: SimulationConfig;
   fightLength: number;
   targetLevel: number;
   targetType?: TargetType;
   targetArmor: number;
   iterations: number;
   postCycleResourceGeneration?: boolean;
   isHealerSpec?: boolean;
}

export interface SimulationOptions {
   specFile: string;
   // gear stats CLI override
   critChance?: number;
   hitChance?: number;
   weaponSkill?: number;
   mainHand?: {
      minDamage: number;
      maxDamage: number;
      speed: number;
      type: WeaponType;
   };
   offHand?: {
      minDamage: number;
      maxDamage: number;
      speed: number;
      type: WeaponType;
   };
   // encounter
   targetLevel?: number;
   targetArmor?: number;
   fightLength?: number;
   // simulation
   iterations?: number;
   postCycleResourceGeneration?: boolean;
   playbackSpeed?: number;
   // compare input
   talentOverrides?: string;
   setupOverrides?: string;
   gearOverrides?: string;
   rotationOverrides?: string;
   // output
   quiet: boolean;
}

export interface EquippedItem {
   name?: string;
   itemId: number;
   randomSuffixId?: number;
   spellId?: number;
}

export type EquippedItemQueue = EquippedItem[];
export type EquippedItemSlot = EquippedItem|EquippedItemQueue;

/**
 * Extracts the relevant EquippedItem from an EquippedItemSlot.
 * Returns the item directly if it's a single item.
 * For queues, cycles through items based on the iteration number.
 *
 * @param slot The equipment slot (single item or queue)
 * @param iteration The current iteration number (0-based). Used to cycle through queues.
 */
export function getItemFromSlot(slot: EquippedItemSlot, iteration: number = 0): EquippedItem | undefined {
   if (Array.isArray(slot)) {
      if (slot.length === 0) return undefined;
      // Cycle through the queue based on iteration number
      const index = iteration % slot.length;
      return slot[index];
   }
   return slot;
}

export interface Stats {
   attackPower?: number;
   critChance: number;
   hitChance: number;
   agility: number;
   strength: number;
   weaponSkills: Map<WeaponType, number>;

   mh: Weapon;
   oh?: Weapon;

   // Mage stats
   spellPower?: number;
   spellCrit?: number;
   spellHit?: number;
   intellect?: number;
   stamina?: number;
   spirit?: number;
   mana?: number;

   // Healer stats
   healingPower?: number;
   mp5?: number; // Mana per 5 seconds

   // Additional stats (can be modified by buffs)
   health?: number;
   meleeHaste?: number; // Haste multiplier (1.15 = 15% faster)
}

export interface PlayerSetup {
   // general
   wbs?: boolean; // apply world buffs
   // rogue
   waitForSndExpiry?: number;
   refreshSndSecondsBeforeExpiry?: number;
   avoidEviscerate?: boolean;
   veiledShadowsSet?: boolean;
   darkmantle4?: boolean;
   deathdealers5?: boolean;
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
