import {Stats} from './SimulationSpec';

export enum Consumable {
   // Battle Elixirs (only one can be active)
   ElixirOfTheMongoose = "mongoose",
   ElixirOfGiants = "giants",
   ElixirOfGreaterAgility = "greater_agility",
   WinterfallFirewater = "firewater",
   JujuMight = "jujumight",
   JujuPower = "jujupower",

   // Guardian Elixirs (only one can be active)
   FlaskOfTheTitans = "titans",
   ElixirOfFortitude = "fortitude",

   // Food Buffs
   SmokedDesertDumplings = "dumplings",
   GrilledSquid = "squid",
   BlessedSunfruitJuice = "sunfruit",
   NightfinSoup = "nightfin",
   TenderWolfSteak = "wolfsteak",

   // Mage/Caster Consumables
   FlaskOfSupremePower = "supremepower",
   GreaterArcaneElixir = "greaterarcane",
   ElixirOfShadowPower = "shadowpower",
   CerebralCortexCompound = "cerebral",
   RunnTumTuberSurprise = "runntum",
}

/**
 * Applies consumable buffs to the given GearBuffsStats object.
 * Modifies the gearStats object in place.
 */
export function applyConsumables(consumables: Consumable[], stats: Stats): void {
   for (const consumable of consumables) {
      switch (consumable) {
         case Consumable.ElixirOfTheMongoose:
            applyElixirOfTheMongoose(stats);
            break;
         case Consumable.ElixirOfGiants:
            applyElixirOfGiants(stats);
            break;
         case Consumable.ElixirOfGreaterAgility:
            applyElixirOfGreaterAgility(stats);
            break;
         case Consumable.WinterfallFirewater:
            applyWinterfallFirewater(stats);
            break;
         case Consumable.JujuMight:
            applyJujuMight(stats);
            break;
         case Consumable.JujuPower:
            applyJujuPower(stats);
            break;
         case Consumable.FlaskOfTheTitans:
            applyFlaskOfTheTitans(stats);
            break;
         case Consumable.ElixirOfFortitude:
            applyElixirOfFortitude(stats);
            break;
         case Consumable.SmokedDesertDumplings:
            applySmokedDesertDumplings(stats);
            break;
         case Consumable.GrilledSquid:
            applyGrilledSquid(stats);
            break;
         case Consumable.BlessedSunfruitJuice:
            applyBlessedSunfruitJuice(stats);
            break;
         case Consumable.NightfinSoup:
            applyNightfinSoup(stats);
            break;
         case Consumable.TenderWolfSteak:
            applyTenderWolfSteak(stats);
            break;
         case Consumable.FlaskOfSupremePower:
            applyFlaskOfSupremePower(stats);
            break;
         case Consumable.GreaterArcaneElixir:
            applyGreaterArcaneElixir(stats);
            break;
         case Consumable.ElixirOfShadowPower:
            applyElixirOfShadowPower(stats);
            break;
         case Consumable.CerebralCortexCompound:
            applyCerebralCortexCompound(stats);
            break;
         case Consumable.RunnTumTuberSurprise:
            applyRunnTumTuberSurprise(stats);
            break;
      }
   }
}

// Battle Elixirs

/**
 * Elixir of the Mongoose
 * +25 Agility, +2% Crit
 */
function applyElixirOfTheMongoose(stats: Stats): void {
   stats.agility += 25;
   stats.critChance += 2;
}

/**
 * Elixir of Giants
 * +25 Strength
 */
function applyElixirOfGiants(stats: Stats): void {
   stats.strength += 25;
}

/**
 * Elixir of Greater Agility
 * +25 Agility
 */
function applyElixirOfGreaterAgility(stats: Stats): void {
   stats.agility += 25;
}

/**
 * Winterfall Firewater
 * +35 Attack Power
 */
function applyWinterfallFirewater(stats: Stats): void {
   if (stats.attackPower !== undefined)
      stats.attackPower += 35;
   else
      stats.attackPower = 35;
}

/**
 * Juju Might
 * +40 Attack Power
 */
function applyJujuMight(stats: Stats): void {
   if (stats.attackPower !== undefined)
      stats.attackPower += 40;
   else
      stats.attackPower = 40;
}

/**
 * Juju Power
 * +30 Strength
 */
function applyJujuPower(stats: Stats): void {
   stats.strength += 30;
}

// Guardian Elixirs

/**
 * Flask of the Titans
 * +400 HP
 */
function applyFlaskOfTheTitans(stats: Stats): void {
   if (stats.health !== undefined)
      stats.health += 400;
   else
      stats.health = 400;
}

/**
 * Elixir of Fortitude
 * +120 HP
 */
function applyElixirOfFortitude(stats: Stats): void {
   if (stats.health !== undefined)
      stats.health += 120;
   else
      stats.health = 120;
}

// Food Buffs

/**
 * Smoked Desert Dumplings
 * +20 Strength
 */
function applySmokedDesertDumplings(stats: Stats): void {
   stats.strength += 20;
}

/**
 * Grilled Squid
 * +10 Agility
 */
function applyGrilledSquid(stats: Stats): void {
   stats.agility += 10;
}

/**
 * Blessed Sunfruit Juice
 * +10 Strength
 */
function applyBlessedSunfruitJuice(stats: Stats): void {
   stats.strength += 10;
}

/**
 * Nightfin Soup
 * +8 mp5
 */
function applyNightfinSoup(stats: Stats): void {
   if (stats.mp5 !== undefined)
      stats.mp5 += 8;
   else
      stats.mp5 = 8;
}

/**
 * Tender Wolf Steak
 * +12 Spirit
 */
function applyTenderWolfSteak(stats: Stats): void {
   if (stats.spirit !== undefined)
      stats.spirit += 12;
   else
      stats.spirit = 12;
}

// Mage/Caster Consumables

/**
 * Flask of Supreme Power
 * +150 Spell Damage
 */
function applyFlaskOfSupremePower(stats: Stats): void {
   if (stats.spellPower !== undefined)
      stats.spellPower += 150;
   else
      stats.spellPower = 150;
}

/**
 * Greater Arcane Elixir
 * +35 Spell Damage
 */
function applyGreaterArcaneElixir(stats: Stats): void {
   if (stats.spellPower !== undefined)
      stats.spellPower += 35;
   else
      stats.spellPower = 35;
}

/**
 * Elixir of Shadow Power
 * +40 Shadow Spell Damage (simplified to general spell damage)
 */
function applyElixirOfShadowPower(stats: Stats): void {
   if (stats.spellPower !== undefined)
      stats.spellPower += 40;
   else
      stats.spellPower = 40;
}

/**
 * Cerebral Cortex Compound
 * +25 Intellect
 */
function applyCerebralCortexCompound(stats: Stats): void {
   if (stats.intellect !== undefined)
      stats.intellect += 25;
   else
      stats.intellect = 25;
}

/**
 * Runn Tum Tuber Surprise
 * +10 Intellect
 */
function applyRunnTumTuberSurprise(stats: Stats): void {
   if (stats.intellect !== undefined)
      stats.intellect += 10;
   else
      stats.intellect = 10;
}
