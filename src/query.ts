import {Command} from 'commander';
import * as path from 'path';
import {Database} from './Database';
import {Enchant, Item} from './Database.types';

const program = new Command();

program
  .name('query')
  .description('Query items and enchants from WoW Classic database')
  .version('1.0.0');

const dbPath = path.join(__dirname, 'db.json');
const db = new Database(dbPath);

program
  .command('item')
  .description('Query items by ID or name')
  .option('-i, --id <number>', 'Item ID')
  .option('-n, --name <string>', 'Item name (partial match)')
  .option('-t, --type <number>', 'Item type (1=Head, 5=Chest, 7=Hands, 8=Waist, 10=Feet, 11=Finger, 12=Trinket, 13=Weapon, etc.)')
  .option('-a, --all', 'List all items')
  .option('--limit <number>', 'Limit results (default: 50)', '50')
  .action((options) => {
    if (options.id) {
      const id = parseInt(options.id);
      const item = db.getItem(id);
      if (item) {
        displayItem(item);
      } else {
        console.log(`Item with ID ${id} not found`);
      }
    } else if (options.name || options.type || options.all) {
      let items = db.getAllItems();

      if (options.name) {
        items = items.filter(item =>
          item.name.toLowerCase().includes(options.name.toLowerCase())
        );
      }

      if (options.type) {
        const type = parseInt(options.type);
        items = items.filter(item => item.type === type);
      }

      const limit = parseInt(options.limit);
      displayItems(items.slice(0, limit));
    } else {
      console.log('Please specify --id, --name, --type, or --all');
    }
  });

program
  .command('enchant')
  .description('Query enchants by ID or name')
  .option('-i, --id <number>', 'Enchant spell/effect ID')
  .option('-n, --name <string>', 'Enchant name (partial match)')
  .option('-t, --type <number>', 'Enchant type (slot where enchant can be applied)')
  .option('-a, --all', 'List all enchants')
  .option('--limit <number>', 'Limit results (default: 50)', '50')
  .action((options) => {
    if (options.id) {
      const id = parseInt(options.id);
      const enchant = db.getEnchant(id);
      if (enchant) {
        displayEnchant(enchant);
      } else {
        console.log(`Enchant with ID ${id} not found`);
      }
    } else if (options.name || options.type || options.all) {
      let enchants = db.getAllEnchants();

      if (options.name) {
        enchants = enchants.filter(enchant =>
          enchant.name.toLowerCase().includes(options.name.toLowerCase())
        );
      }

      if (options.type) {
        const type = parseInt(options.type);
        enchants = enchants.filter(enchant =>
          enchant.type === type || (enchant.extraTypes && enchant.extraTypes.includes(type))
        );
      }

      const limit = parseInt(options.limit);
      displayEnchants(enchants.slice(0, limit));
    } else {
      console.log('Please specify --id, --name, --type, or --all');
    }
  });

function displayItem(item: Item): void {
  console.log('\n=== ITEM ===');
  console.log(`ID: ${item.id}`);
  console.log(`Name: ${item.name}`);
  console.log(`Icon: ${item.icon}`);
  console.log(`Item Level: ${item.ilvl}`);
  console.log(`Quality: ${item.quality} (0=Poor, 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary)`);
  console.log(`Phase: ${item.phase}`);

  if (item.weaponType !== undefined) {
    console.log(`Weapon Type: ${item.weaponType}`);
    console.log(`Hand Type: ${item.handType}`);
    if (item.weaponDamageMin && item.weaponDamageMax && item.weaponSpeed) {
      console.log(`Damage: ${item.weaponDamageMin}-${item.weaponDamageMax} (Speed: ${item.weaponSpeed})`);
      const dps = ((item.weaponDamageMin + item.weaponDamageMax) / 2) / item.weaponSpeed;
      console.log(`DPS: ${dps.toFixed(2)}`);
    }
  }

  if (item.armorType !== undefined) {
    console.log(`Armor Type: ${item.armorType}`);
  }

  const decodedStats = decodeStats(item.stats);
  if (decodedStats.length > 0) {
    console.log('Stats:');
    decodedStats.forEach(stat => {
      console.log(`  ${stat.name}: ${stat.value > 0 ? '+' : ''}${stat.value}`);
    });
  }

  if (item.unique) {
    console.log('Unique: Yes');
  }

  if (item.expansion !== undefined) {
    console.log(`Expansion: ${item.expansion}`);
  }

  if (item.setName) {
    console.log(`Set: ${item.setName} (ID: ${item.setId})`);
  }

  if (item.sources && item.sources.length > 0) {
    console.log('Sources:');
    item.sources.forEach(source => {
      if (source.drop) {
        const drop = source.drop;
        console.log(`  - Drop: NPC ${drop.npcId || 'N/A'}, Zone ${drop.zoneId || 'N/A'}${drop.difficulty ? ` (Difficulty ${drop.difficulty})` : ''}${drop.otherName ? ` (${drop.otherName})` : ''}`);
      }
      if (source.quest) {
        console.log(`  - Quest: ${source.quest.name} (ID: ${source.quest.id})`);
      }
      if (source.soldBy) {
        console.log(`  - Vendor: ${source.soldBy.npcName} (NPC ID: ${source.soldBy.npcId})`);
      }
    });
  }
  console.log('');
}

function displayItems(items: Item[]): void {
  if (items.length === 0) {
    console.log('No items found');
    return;
  }

  console.log(`\nFound ${items.length} item(s):\n`);
  console.log('ID'.padEnd(8) + 'Name'.padEnd(35) + 'iLvl'.padEnd(6) + 'Quality'.padEnd(10) + 'Type');
  console.log('-'.repeat(80));

  items.forEach(item => {
    const qualityMap = ['Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    const quality = qualityMap[item.quality] || 'Unknown';
    const typeMap: { [key: number]: string } = {
      1: 'Head', 2: 'Neck', 3: 'Shoulder', 4: 'Shirt', 5: 'Chest',
      6: 'Waist', 7: 'Legs', 8: 'Feet', 9: 'Wrist', 10: 'Hands',
      11: 'Finger', 12: 'Trinket', 13: 'Weapon', 14: 'Shield', 15: 'Ranged',
      16: 'Back', 17: 'Two-Hand', 18: 'Bag', 19: 'Tabard', 20: 'Robe',
      21: 'Main Hand', 22: 'Off Hand', 23: 'Held', 24: 'Ammo', 25: 'Thrown',
      26: 'Ranged Right', 27: 'Quiver', 28: 'Relic'
    };
    const type = typeMap[item.type] || `Type ${item.type}`;

    console.log(
      String(item.id).padEnd(8) +
      item.name.slice(0, 33).padEnd(35) +
      String(item.ilvl).padEnd(6) +
      quality.padEnd(10) +
      type
    );
  });
  console.log('');
}

function displayEnchant(enchant: Enchant): void {
  console.log('\n=== ENCHANT ===');
  console.log(`Effect ID: ${enchant.effectId}`);
  if (enchant.spellId) {
    console.log(`Spell ID: ${enchant.spellId}`);
  }
  if (enchant.itemId) {
    console.log(`Item ID: ${enchant.itemId}`);
  }
  console.log(`Name: ${enchant.name}`);
  console.log(`Type: ${enchant.type}`);
  if (enchant.extraTypes && enchant.extraTypes.length > 0) {
    console.log(`Extra Types: [${enchant.extraTypes.join(', ')}]`);
  }
  if (enchant.enchantType !== undefined) {
    console.log(`Enchant Type: ${enchant.enchantType}`);
  }
  console.log(`Quality: ${enchant.quality}`);

  const decodedStats = decodeStats(enchant.stats);
  if (decodedStats.length > 0) {
    console.log('Stats:');
    decodedStats.forEach(stat => {
      console.log(`  ${stat.name}: ${stat.value > 0 ? '+' : ''}${stat.value}`);
    });
  }
  console.log('');
}

function displayEnchants(enchants: Enchant[]): void {
  if (enchants.length === 0) {
    console.log('No enchants found');
    return;
  }

  console.log(`\nFound ${enchants.length} enchant(s):\n`);
  console.log('Effect ID'.padEnd(12) + 'Spell ID'.padEnd(12) + 'Name'.padEnd(45) + 'Type');
  console.log('-'.repeat(80));

  enchants.forEach(enchant => {
    console.log(
      String(enchant.effectId).padEnd(12) +
      String(enchant.spellId || 'N/A').padEnd(12) +
      enchant.name.slice(0, 43).padEnd(45) +
      String(enchant.type)
    );
  });
  console.log('');
}

function decodeStats(stats: number[]): Array<{ name: string; value: number }> {
  const STAT_NAMES: { [key: number]: string } = {
    0: 'Strength',
    1: 'Agility',
    2: 'Stamina',
    3: 'Intellect',
    4: 'Spirit',
    5: 'Spell Power',
    6: 'Arcane Power',
    7: 'Fire Power',
    8: 'Frost Power',
    9: 'Holy Power',
    10: 'Nature Power',
    11: 'Shadow Power',
    12: 'MP5',
    13: 'Spell Hit',
    14: 'Spell Crit',
    15: 'Spell Haste',
    16: 'Spell Penetration',
    17: 'Attack Power',
    18: 'Melee Hit',
    19: 'Melee Crit',
    20: 'Melee Haste',
    21: 'Armor Penetration',
    22: 'Expertise',
    23: 'Mana',
    24: 'Energy',
    25: 'Rage',
    26: 'Armor',
    27: 'Ranged Attack Power',
    28: 'Defense',
    29: 'Block',
    30: 'Block Value',
    31: 'Dodge',
    32: 'Parry',
    33: 'Resilience',
    34: 'Health',
    35: 'Arcane Resistance',
    36: 'Fire Resistance',
    37: 'Frost Resistance',
    38: 'Nature Resistance',
    39: 'Shadow Resistance',
    40: 'Bonus Armor',
    41: 'Healing Power',
    42: 'Spell Damage',
    43: 'Feral Attack Power',
  };

  const result: Array<{ name: string; value: number }> = [];

  for (let i = 0; i < stats.length; i++) {
    const value = stats[i];
    if (value !== 0 && STAT_NAMES[i]) {
      result.push({
        name: STAT_NAMES[i],
        value: value,
      });
    }
  }

  return result;
}

program.parse(process.argv);
