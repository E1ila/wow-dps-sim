import * as fs from 'fs';
import {
   DatabaseJSON,
   Enchant,
   Encounter,
   Faction,
   Item,
   ItemIcon,
   NPC,
   RandomSuffix,
   SpellIcon,
   Zone
} from "./Database.types";

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
      this.enchants = new Map(data.enchants.map(enchant => [enchant.spellId || enchant.effectId, enchant]));
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

   getEnchant(spellId: number): Enchant | undefined {
      return this.enchants.get(spellId);
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
