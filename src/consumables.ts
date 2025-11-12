import {GearBuffsStats} from './SimulationSpec';

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
export function applyConsumables(consumables: Consumable[], gearStats: GearBuffsStats): void {
   for (const consumable of consumables) {
      switch (consumable) {
         case Consumable.ElixirOfTheMongoose:
            applyElixirOfTheMongoose(gearStats);
            break;
         case Consumable.ElixirOfGiants:
            applyElixirOfGiants(gearStats);
            break;
         case Consumable.ElixirOfGreaterAgility:
            applyElixirOfGreaterAgility(gearStats);
            break;
         case Consumable.WinterfallFirewater:
            applyWinterfallFirewater(gearStats);
            break;
         case Consumable.JujuMight:
            applyJujuMight(gearStats);
            break;
         case Consumable.JujuPower:
            applyJujuPower(gearStats);
            break;
         case Consumable.FlaskOfTheTitans:
            applyFlaskOfTheTitans(gearStats);
            break;
         case Consumable.ElixirOfFortitude:
            applyElixirOfFortitude(gearStats);
            break;
         case Consumable.SmokedDesertDumplings:
            applySmokedDesertDumplings(gearStats);
            break;
         case Consumable.GrilledSquid:
            applyGrilledSquid(gearStats);
            break;
         case Consumable.BlessedSunfruitJuice:
            applyBlessedSunfruitJuice(gearStats);
            break;
         case Consumable.NightfinSoup:
            applyNightfinSoup(gearStats);
            break;
         case Consumable.TenderWolfSteak:
            applyTenderWolfSteak(gearStats);
            break;
         case Consumable.FlaskOfSupremePower:
            applyFlaskOfSupremePower(gearStats);
            break;
         case Consumable.GreaterArcaneElixir:
            applyGreaterArcaneElixir(gearStats);
            break;
         case Consumable.ElixirOfShadowPower:
            applyElixirOfShadowPower(gearStats);
            break;
         case Consumable.CerebralCortexCompound:
            applyCerebralCortexCompound(gearStats);
            break;
         case Consumable.RunnTumTuberSurprise:
            applyRunnTumTuberSurprise(gearStats);
            break;
      }
   }
}

// Battle Elixirs

/**
 * Elixir of the Mongoose
 * +25 Agility, +2% Crit
 */
function applyElixirOfTheMongoose(gearStats: GearBuffsStats): void {
   gearStats.agility += 25;
   gearStats.critChance += 2;
}

/**
 * Elixir of Giants
 * +25 Strength
 */
function applyElixirOfGiants(gearStats: GearBuffsStats): void {
   gearStats.strength += 25;
}

/**
 * Elixir of Greater Agility
 * +25 Agility
 */
function applyElixirOfGreaterAgility(gearStats: GearBuffsStats): void {
   gearStats.agility += 25;
}

/**
 * Winterfall Firewater
 * +35 Attack Power
 */
function applyWinterfallFirewater(gearStats: GearBuffsStats): void {
   if (gearStats.attackPower !== undefined)
      gearStats.attackPower += 35;
   else
      gearStats.attackPower = 35;
}

/**
 * Juju Might
 * +40 Attack Power
 */
function applyJujuMight(gearStats: GearBuffsStats): void {
   if (gearStats.attackPower !== undefined)
      gearStats.attackPower += 40;
   else
      gearStats.attackPower = 40;
}

/**
 * Juju Power
 * +30 Strength
 */
function applyJujuPower(gearStats: GearBuffsStats): void {
   gearStats.strength += 30;
}

// Guardian Elixirs

/**
 * Flask of the Titans
 * +400 HP
 */
function applyFlaskOfTheTitans(gearStats: GearBuffsStats): void {
   if (gearStats.health !== undefined)
      gearStats.health += 400;
   else
      gearStats.health = 400;
}

/**
 * Elixir of Fortitude
 * +120 HP
 */
function applyElixirOfFortitude(gearStats: GearBuffsStats): void {
   if (gearStats.health !== undefined)
      gearStats.health += 120;
   else
      gearStats.health = 120;
}

// Food Buffs

/**
 * Smoked Desert Dumplings
 * +20 Strength
 */
function applySmokedDesertDumplings(gearStats: GearBuffsStats): void {
   gearStats.strength += 20;
}

/**
 * Grilled Squid
 * +10 Agility
 */
function applyGrilledSquid(gearStats: GearBuffsStats): void {
   gearStats.agility += 10;
}

/**
 * Blessed Sunfruit Juice
 * +10 Strength
 */
function applyBlessedSunfruitJuice(gearStats: GearBuffsStats): void {
   gearStats.strength += 10;
}

/**
 * Nightfin Soup
 * +8 mp5
 */
function applyNightfinSoup(gearStats: GearBuffsStats): void {
   if (gearStats.mp5 !== undefined)
      gearStats.mp5 += 8;
   else
      gearStats.mp5 = 8;
}

/**
 * Tender Wolf Steak
 * +12 Spirit
 */
function applyTenderWolfSteak(gearStats: GearBuffsStats): void {
   if (gearStats.spirit !== undefined)
      gearStats.spirit += 12;
   else
      gearStats.spirit = 12;
}

// Mage/Caster Consumables

/**
 * Flask of Supreme Power
 * +150 Spell Damage
 */
function applyFlaskOfSupremePower(gearStats: GearBuffsStats): void {
   if (gearStats.spellPower !== undefined)
      gearStats.spellPower += 150;
   else
      gearStats.spellPower = 150;
}

/**
 * Greater Arcane Elixir
 * +35 Spell Damage
 */
function applyGreaterArcaneElixir(gearStats: GearBuffsStats): void {
   if (gearStats.spellPower !== undefined)
      gearStats.spellPower += 35;
   else
      gearStats.spellPower = 35;
}

/**
 * Elixir of Shadow Power
 * +40 Shadow Spell Damage (simplified to general spell damage)
 */
function applyElixirOfShadowPower(gearStats: GearBuffsStats): void {
   if (gearStats.spellPower !== undefined)
      gearStats.spellPower += 40;
   else
      gearStats.spellPower = 40;
}

/**
 * Cerebral Cortex Compound
 * +25 Intellect
 */
function applyCerebralCortexCompound(gearStats: GearBuffsStats): void {
   if (gearStats.intellect !== undefined)
      gearStats.intellect += 25;
   else
      gearStats.intellect = 25;
}

/**
 * Runn Tum Tuber Surprise
 * +10 Intellect
 */
function applyRunnTumTuberSurprise(gearStats: GearBuffsStats): void {
   if (gearStats.intellect !== undefined)
      gearStats.intellect += 10;
   else
      gearStats.intellect = 10;
}
