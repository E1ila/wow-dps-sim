export interface Item {
   id: number;
   name: string;
   icon: string;
   type: number;
   weaponType?: number;
   handType?: number;
   armorType?: number;
   stats: number[];
   randomSuffixOptions?: number[];
   weaponDamageMin?: number;
   weaponDamageMax?: number;
   weaponSpeed?: number;
   weaponSkills: number[];
   ilvl: number;
   phase: number;
   quality: number;
   unique?: boolean;
   expansion?: number;
   sources?: Array<{
      drop?: { npcId?: number; zoneId?: number; difficulty?: number; otherName?: string };
      quest?: { id: number; name: string };
      soldBy?: { npcId: number; npcName: string };
   }>;
   factionRestriction?: number;
   classAllowlist?: number[];
   setName?: string;
   setId?: number;
}

export interface Enchant {
   effectId: number;
   spellId?: number;
   itemId?: number;
   name: string;
   type: number;
   extraTypes?: number[];
   enchantType?: number;
   stats: number[];
   quality: number;
}

export interface RandomSuffix {
   id: number;
   name: string;
   stats: number[];
}

export interface Zone {
   id: number;
   name: string;
   expansion?: number;
}

export interface NPC {
   id: number;
   name: string;
   zoneId?: number;
}

export interface EncounterTarget {
   path: string;
   target: {
      id: number;
      name: string;
      level: number;
      mobType?: number;
      stats: number[];
      minBaseDamage: number;
      damageSpread: number;
      swingSpeed: number;
      parryHaste: boolean;
   };
}

export interface Encounter {
   path: string;
   targets: EncounterTarget[];
}

export interface Faction {
   id: number;
   name: string;
   expansion?: number;
}

export interface ItemIcon {
   id: number;
   name: string;
   icon: string;
}

export interface SpellIcon {
   id: number;
   name: string;
   icon: string;
   rank?: number;
   hasBuff?: boolean;
}

export interface DatabaseJSON {
   items: Item[];
   enchants: Enchant[];
   randomSuffixes: RandomSuffix[];
   zones: Zone[];
   npcs: NPC[];
   encounters: Encounter[];
   factions: Faction[];
   itemIcons: ItemIcon[];
   spellIcons: SpellIcon[];
}
