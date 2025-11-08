import {AttackResult, AttackType, CharacterClass, SpecOverrides} from "./types";

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
      case CharacterClass.Mage:
         return c.cyan;
   }
}

export function parseSpecString(specStr: string): SpecOverrides {
   const parts = specStr.split('|');
   if (parts.length >= 1 &&  parts.length <= 4) {
      return {
         talents: parts[0].trim(),
         setup: parts.length >= 2 && parts[1].trim() || undefined,
         gear: parts.length >= 3 && parts[2].trim() || undefined,
         rotation: parts.length >= 4 && parts[3].trim() || undefined
      };
   } else {
      throw new Error(`Invalid spec format: ${specStr}. Expected format: talents|setup|gear|rotation (setup, gear, and rotation optional)`);
   }
}

const HitAttackTypes = [AttackType.Hit, AttackType.Crit, AttackType.Glancing];

export function isHit(attackResult: AttackResult) {
   return HitAttackTypes.includes(attackResult.type);
}
