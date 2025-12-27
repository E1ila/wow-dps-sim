import {
   AttackResult,
   AttackType,
   CharacterClass,
   EquipmentSlot,
   ItemSlotType,
   SpecOverrides,
   WeaponType
} from "./types";

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

// Item IDs
export const ITEM_IDS = {
   // Trinkets
   KissOfTheSpider: 22954,
   Earthstrike: 21180,
   JomGabbar: 23570,
   MarkOfTheChampionSpells: 23207,
   MarkOfTheChampionMelee: 23206,

   // Weapons
   Thunderfury: 19019,
} as const;

export function colorByClass(characterClass: CharacterClass): string {
   switch (characterClass) {
      case CharacterClass.Rogue:
         return c.yellow;
      case CharacterClass.Warrior:
         return c.red;
      case CharacterClass.Mage:
         return c.cyan;
      case CharacterClass.Shaman:
         return c.blue;
   }
}

export function parseSpecString(specStr: string): SpecOverrides {
   let name: string | undefined;
   let remainingSpec = specStr;

   const nameDelimiterIndex = specStr.indexOf('!');
   if (nameDelimiterIndex !== -1) {
      name = specStr.substring(0, nameDelimiterIndex).trim();
      remainingSpec = specStr.substring(nameDelimiterIndex + 1);
   }

   const parts = remainingSpec.split('|');
   if (parts.length >= 1 &&  parts.length <= 4) {
      return {
         name,
         talents: parts[0].trim(),
         setup: parts.length >= 2 && parts[1].trim() || undefined,
         gear: parts.length >= 3 && parts[2].trim() || undefined,
         rotation: parts.length >= 4 && parts[3].trim() || undefined
      };
   } else {
      throw new Error(`Invalid spec format: ${specStr}. Expected format: [name!]talents|setup|gear|rotation (name, setup, gear, and rotation optional)`);
   }
}

const HitAttackTypes = [AttackType.Hit, AttackType.Crit, AttackType.Glancing];

export function isHit(attackResult: AttackResult) {
   return HitAttackTypes.includes(attackResult.type);
}

// -- gear ---------------------------------------

export function getEnchantTypesForItem(itemType: number): number[] {
   const mapping: Record<number, number[]> = {
      1: [1],      // Head → Head enchants
      3: [3],      // Shoulders → Shoulder enchants
      4: [4],      // Back → Cloak enchants
      5: [5],      // Chest → Chest enchants
      6: [6],      // Wrist → Bracer enchants
      7: [7],      // Hands → Gloves enchants
      9: [1],      // Legs → Head enchants (leg armor patches)
      10: [10],    // Feet → Boot enchants
      13: [13],    // Weapon → Weapon enchants
      14: [14],    // Ranged → Ranged enchants
      17: [13],    // TwoHand → Weapon enchants
   };
   return mapping[itemType] || [];
}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
   { name: 'head', slotTypes: [ItemSlotType.Head] },
   { name: 'neck', slotTypes: [ItemSlotType.Neck] },
   { name: 'shoulders', slotTypes: [ItemSlotType.Shoulders] },
   { name: 'back', slotTypes: [ItemSlotType.Back] },
   { name: 'chest', slotTypes: [ItemSlotType.Chest] },
   { name: 'wrist', slotTypes: [ItemSlotType.Wrist] },
   { name: 'hands', slotTypes: [ItemSlotType.Hands] },
   { name: 'waist', slotTypes: [ItemSlotType.Waist] },
   { name: 'legs', slotTypes: [ItemSlotType.Legs] },
   { name: 'feet', slotTypes: [ItemSlotType.Feet] },
   { name: 'finger1', slotTypes: [ItemSlotType.Finger] },
   { name: 'finger2', slotTypes: [ItemSlotType.Finger] },
   { name: 'trinket1', slotTypes: [ItemSlotType.Trinket] },
   { name: 'trinket2', slotTypes: [ItemSlotType.Trinket] },
   { name: 'mh', slotTypes: [ItemSlotType.Weapon, ItemSlotType.TwoHand] },
   { name: 'oh', slotTypes: [ItemSlotType.Weapon], optional: true },
   { name: 'ranged', slotTypes: [ItemSlotType.Ranged], optional: true },
];

export const weaponTypeMap: { [key: string]: WeaponType } = {
   'dagger': WeaponType.Dagger,
   'sword': WeaponType.Sword,
   'sword2h': WeaponType.TwoHandedSword,
   'axe': WeaponType.Axe,
   'axe2h': WeaponType.TwoHandedAxe,
   'mace': WeaponType.Mace,
   'mace2h': WeaponType.TwoHandedMace,
   'fist': WeaponType.Fist,
};

export const GEAR_SLOT_NAMES = EQUIPMENT_SLOTS.map(slot => slot.name);
