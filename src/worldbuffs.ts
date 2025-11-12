import {Stats} from './SimulationSpec';

export enum WorldBuff {
   RallyingCryOfTheDragonslayer = "dragonslayer",
   WarchiefsBlessing = "rend",
}

/**
 * Applies world buff stats to the given GearStats object.
 * Modifies the gearStats object in place.
 */
export function applyWorldBuffs(worldBuffs: WorldBuff[], stats: Stats): void {
   for (const buff of worldBuffs) {
      switch (buff) {
         case WorldBuff.RallyingCryOfTheDragonslayer:
            applyRallyingCry(stats);
            break;
         case WorldBuff.WarchiefsBlessing:
            applyWarchiefsBlessing(stats);
            break;
      }
   }
}

/**
 * Rallying Cry of the Dragonslayer
 * +10% spell crit, +5% melee crit, +140 AP, +140 ranged AP
 */
function applyRallyingCry(stats: Stats): void {
   // Add 10% spell crit
   if (stats.spellCrit !== undefined)
      stats.spellCrit += 10;
   else
      stats.spellCrit = 10;

   // Add 5% melee crit
   stats.critChance += 5;

   // Add 140 attack power (includes ranged AP in vanilla)
   if (stats.attackPower !== undefined)
      stats.attackPower += 140;
   else 
      stats.attackPower = 140;
}

/**
 * Warchief's Blessing (Rend's buff from Orgrimmar)
 * +300 HP, +10 mp5, +15% melee haste
 */
function applyWarchiefsBlessing(stats: Stats): void {
   // Add 300 HP
   if (stats.health !== undefined)
      stats.health += 300;
   else
      stats.health = 300;

   // Add 10 mp5
   if (stats.mp5 !== undefined)
      stats.mp5 += 10;
   else
      stats.mp5 = 10;

   // Add 15% melee haste (multiply by 1.15)
   if (stats.meleeHaste !== undefined)
      stats.meleeHaste *= 1.15;
   else
      stats.meleeHaste = 1.15;
}
