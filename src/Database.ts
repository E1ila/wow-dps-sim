import * as fs from 'fs';

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

interface DatabaseJSON {
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

export class Database {
   private items: Map<number, Item>;
   private enchants: Map<number, Enchant>;
   private randomSuffixes: Map<number, RandomSuffix>;
   private zones: Map<number, Zone>;
   private npcs: Map<number, NPC>;
   private encounters: Map<string, Encounter>;
   private factions: Map<number, Faction>;
   private itemIcons: Map<number, ItemIcon>;
   private spellIcons: Map<number, SpellIcon>;

   constructor(dbPath: string) {
      const rawData = fs.readFileSync(dbPath, 'utf-8');
      const data: DatabaseJSON = JSON.parse(rawData);

      this.items = new Map(data.items.map(item => [item.id, item]));
      this.enchants = new Map(data.enchants.map(enchant => [enchant.effectId, enchant]));
      this.randomSuffixes = new Map(data.randomSuffixes.map(suffix => [suffix.id, suffix]));
      this.zones = new Map(data.zones.map(zone => [zone.id, zone]));
      this.npcs = new Map(data.npcs.map(npc => [npc.id, npc]));
      this.encounters = new Map(data.encounters.map(encounter => [encounter.path, encounter]));
      this.factions = new Map(data.factions.map(faction => [faction.id, faction]));
      this.itemIcons = new Map(data.itemIcons.map(icon => [icon.id, icon]));
      this.spellIcons = new Map(data.spellIcons.map(icon => [icon.id, icon]));
   }

   getItem(id: number): Item | undefined {
      return this.items.get(id);
   }

   getEnchant(effectId: number): Enchant | undefined {
      return this.enchants.get(effectId);
   }

   getRandomSuffix(id: number): RandomSuffix | undefined {
      return this.randomSuffixes.get(id);
   }

   getZone(id: number): Zone | undefined {
      return this.zones.get(id);
   }

   getNPC(id: number): NPC | undefined {
      return this.npcs.get(id);
   }

   getEncounter(path: string): Encounter | undefined {
      return this.encounters.get(path);
   }

   getFaction(id: number): Faction | undefined {
      return this.factions.get(id);
   }

   getItemIcon(id: number): ItemIcon | undefined {
      return this.itemIcons.get(id);
   }

   getSpellIcon(id: number): SpellIcon | undefined {
      return this.spellIcons.get(id);
   }

   getAllItems(): Item[] {
      return Array.from(this.items.values());
   }

   getAllEnchants(): Enchant[] {
      return Array.from(this.enchants.values());
   }

   getAllRandomSuffixes(): RandomSuffix[] {
      return Array.from(this.randomSuffixes.values());
   }

   getAllZones(): Zone[] {
      return Array.from(this.zones.values());
   }

   getAllNPCs(): NPC[] {
      return Array.from(this.npcs.values());
   }

   getAllEncounters(): Encounter[] {
      return Array.from(this.encounters.values());
   }

   getAllFactions(): Faction[] {
      return Array.from(this.factions.values());
   }

   getAllItemIcons(): ItemIcon[] {
      return Array.from(this.itemIcons.values());
   }

   getAllSpellIcons(): SpellIcon[] {
      return Array.from(this.spellIcons.values());
   }
}
