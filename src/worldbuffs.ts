import {GearBuffsStats} from './SimulationSpec';

export enum WorldBuff {
   RallyingCryOfTheDragonslayer = "dragonslayer",
   WarchiefsBlessing = "rend",
}

/**
 * Applies world buff stats to the given GearStats object.
 * Modifies the gearStats object in place.
 */
export function applyWorldBuffs(worldBuffs: WorldBuff[], gearStats: GearBuffsStats): void {
   for (const buff of worldBuffs) {
      switch (buff) {
         case WorldBuff.RallyingCryOfTheDragonslayer:
            applyRallyingCry(gearStats);
            break;
         case WorldBuff.WarchiefsBlessing:
            applyWarchiefsBlessing(gearStats);
            break;
      }
   }
}

/**
 * Rallying Cry of the Dragonslayer
 * +10% spell crit, +5% melee crit, +140 AP, +140 ranged AP
 */
function applyRallyingCry(gearStats: GearBuffsStats): void {
   // Add 10% spell crit
   if (gearStats.spellCrit !== undefined)
      gearStats.spellCrit += 10;
   else
      gearStats.spellCrit = 10;

   // Add 5% melee crit
   gearStats.critChance += 5;

   // Add 140 attack power (includes ranged AP in vanilla)
   if (gearStats.attackPower !== undefined)
      gearStats.attackPower += 140;
   else 
      gearStats.attackPower = 140;
}

/**
 * Warchief's Blessing (Rend's buff from Orgrimmar)
 * +300 HP, +10 mp5, +15% melee haste
 */
function applyWarchiefsBlessing(gearStats: GearBuffsStats): void {
   // Add 300 HP
   if (gearStats.health !== undefined)
      gearStats.health += 300;
   else
      gearStats.health = 300;

   // Add 10 mp5
   if (gearStats.mp5 !== undefined)
      gearStats.mp5 += 10;
   else
      gearStats.mp5 = 10;

   // Add 15% melee haste (multiply by 1.15)
   if (gearStats.meleeHaste !== undefined)
      gearStats.meleeHaste *= 1.15;
   else
      gearStats.meleeHaste = 1.15;
}
