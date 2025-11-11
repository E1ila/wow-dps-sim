import {Command} from 'commander';
import inquirer from 'inquirer';
import * as path from 'path';
import {Database} from './Database';
import {Item} from './Database.types';
import {EquippedItem} from './SimulationSpec';
import {c} from "./globals";

enum ItemSlotType {
    Head = 1,
    Neck = 2,
    Shoulders = 3,
    Back = 4,
    Chest = 5,
    Wrist = 6,
    Hands = 7,
    Waist = 8,
    Legs = 9,
    Feet = 10,
    Finger = 11,
    Trinket = 12,
    Weapon = 13,
    Ranged = 14,
    TwoHand = 17,
    Tabard = 19,
}

interface EquipmentSlot {
    name: string;
    slotTypes: ItemSlotType[];
    optional?: boolean;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
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
    { name: 'mainhand', slotTypes: [ItemSlotType.Weapon, ItemSlotType.TwoHand] },
    { name: 'offhand', slotTypes: [ItemSlotType.Weapon], optional: true },
    { name: 'ranged', slotTypes: [ItemSlotType.Ranged], optional: true },
];

class GearBuilder {
    private db: Database;
    private equippedItems: EquippedItem[] = [];

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
    }

    private searchItems(query: string, slotTypes: ItemSlotType[]): Item[] {
        const allItems = this.db.getAllItems();
        const lowerQuery = query.toLowerCase();

        return allItems.filter(item =>
            slotTypes.includes(item.type as ItemSlotType) &&
            item.name.toLowerCase().includes(lowerQuery)
        ).sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowerQuery;
            const bExact = b.name.toLowerCase() === lowerQuery;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
            const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return b.ilvl - a.ilvl;
        });
    }

    private async promptForItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
        console.log(`\n--- ${slot.name.toUpperCase()} ---`);

        const { query } = await inquirer.prompt([{
            type: 'input',
            name: 'query',
            message: `Search for ${slot.name} item (or press Enter to skip):`,
        }]);

        if (!query.trim()) {
            if (slot.optional) {
                return null;
            }
            console.log('This slot is required. Please enter a search term.');
            return this.promptForItem(slot);
        }

        const matchingItems = this.searchItems(query, slot.slotTypes);

        if (matchingItems.length === 0) {
            console.log('No items found. Please try again.');
            return this.promptForItem(slot);
        }

        if (matchingItems.length === 1) {
            const item = matchingItems[0];
            console.log(`\n${c.yellow}${item.name}${c.reset} (ID: ${item.id}, iLvl: ${item.ilvl})\n`);
            return await this.promptForEnchantAndSuffix(item);
        }

        const choices: Array<{ name: string; value: Item | null }> = matchingItems.slice(0, 20).map(item => ({
            name: `${item.name} (ID: ${item.id}, iLvl: ${item.ilvl})`,
            value: item,
        }));

        choices.push({ name: '← Search again', value: null });

        const { selectedItem } = await inquirer.prompt<{ selectedItem: Item | null }>([{
            type: 'list',
            name: 'selectedItem',
            message: `Select ${slot.name}:`,
            choices,
            pageSize: 15,
        }]);

        if (!selectedItem) {
            return this.promptForItem(slot);
        }

        return await this.promptForEnchantAndSuffix(selectedItem);
    }

    private getEnchantTypesForItem(itemType: number): number[] {
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

    private async promptForEnchantAndSuffix(item: Item): Promise<EquippedItem> {
        let enchantId = 0;
        let randomSuffixId = 0;

        const allEnchants = this.db.getAllEnchants();
        const enchantTypes = this.getEnchantTypesForItem(item.type);

        const compatibleEnchants = allEnchants
            .filter(enchant =>
                enchantTypes.includes(enchant.type) ||
                (enchant.extraTypes && enchant.extraTypes.includes(item.type))
            )
            .sort((a, b) => {
                if (b.quality !== a.quality) return b.quality - a.quality;
                return a.name.localeCompare(b.name);
            });

        if (compatibleEnchants.length > 0) {
            const qualityColors = ['', c.white, c.green, c.blue, c.magenta, c.yellow];
            const enchantChoices = [
                { name: 'None', value: 0 },
                ...compatibleEnchants.map(enchant => {
                    const color = qualityColors[enchant.quality] || '';
                    const enchantId = enchant.spellId || enchant.effectId;
                    return {
                        name: `${color}${enchant.name}${c.reset} (ID: ${enchantId})`,
                        value: enchantId,
                    };
                })
            ];

            const { selectedEnchant } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedEnchant',
                message: `Select enchant (${compatibleEnchants.length} available):`,
                choices: enchantChoices,
                pageSize: 25,
            }]);

            enchantId = selectedEnchant;
        }

        if (item.randomSuffixOptions && item.randomSuffixOptions.length > 0) {
            const suffixChoices = [
                { name: 'None', value: 0 },
                ...item.randomSuffixOptions.map(suffixId => {
                    const suffix = this.db.getRandomSuffix(suffixId);
                    return {
                        name: suffix ? `${suffix.name} (ID: ${suffixId})` : `Unknown Suffix (ID: ${suffixId})`,
                        value: suffixId,
                    };
                })
            ];

            const { selectedSuffix } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedSuffix',
                message: 'Select random suffix:',
                choices: suffixChoices,
            }]);

            randomSuffixId = selectedSuffix;
        }

        return {
            itemId: item.id,
            randomSuffixId,
            enchantId,
        };
    }

    loadExistingGear(gearJson: string): void {
        try {
            const gear = JSON.parse(gearJson) as EquippedItem[];
            this.equippedItems = gear.map(item => ({
                itemId: item.itemId,
                randomSuffixId: item.randomSuffixId || 0,
                enchantId: item.enchantId || 0,
            }));
            console.log(`Loaded ${this.equippedItems.length} items from existing gear.`);
        } catch (error) {
            throw new Error('Invalid JSON format for gear');
        }
    }

    async buildGear(): Promise<EquippedItem[]> {
        console.log('=== WoW Classic Gear Builder ===\n');
        console.log('Build your character\'s equipment by searching for items.');
        console.log('You can use partial item names to search.\n');

        for (const slot of EQUIPMENT_SLOTS) {
            const equippedItem = await this.promptForItem(slot);
            if (equippedItem) {
                this.equippedItems.push(equippedItem);
            }
        }

        return this.equippedItems;
    }

    async editGear(): Promise<EquippedItem[]> {
        console.log('=== WoW Classic Gear Editor ===\n');
        console.log('Current gear loaded. Select slots to edit.\n');

        while (true) {
            const slotChoices = EQUIPMENT_SLOTS.map((slot, index) => {
                const equipped = this.equippedItems[index];
                const item = equipped ? this.db.getItem(equipped.itemId) : null;
                const itemName = item ? item.name : '(empty)';
                return {
                    name: `${slot.name}: ${itemName}`,
                    value: index,
                };
            });

            slotChoices.push({ name: '✓ Finish editing', value: -1 });

            const { slotIndex } = await inquirer.prompt<{ slotIndex: number }>([{
                type: 'list',
                name: 'slotIndex',
                message: 'Select slot to edit:',
                choices: slotChoices,
                pageSize: 20,
            }]);

            if (slotIndex === -1) {
                break;
            }

            const slot = EQUIPMENT_SLOTS[slotIndex];
            const newItem = await this.promptForItem(slot);

            if (newItem) {
                this.equippedItems[slotIndex] = newItem;
            } else if (!slot.optional) {
                console.log('Required slot cannot be empty.');
            }
        }

        return this.equippedItems;
    }

    displayGear(): void {
        console.log('\n=== SUMMARY ===');
        this.equippedItems.forEach((equipped, index) => {
            const item = this.db.getItem(equipped.itemId);
            const enchant = equipped.enchantId ? this.db.getEnchant(equipped.enchantId) : null;
            const suffix = equipped.randomSuffixId ? this.db.getRandomSuffix(equipped.randomSuffixId) : null;

            let description = `${index + 1}. ${item?.name || 'Unknown'} (ID: ${equipped.itemId})`;
            if (enchant) description += ` + ${enchant.name}`;
            if (suffix) description += ` of ${suffix.name}`;

            console.log(description);
        });

        console.log('\n=== GEAR SPEC (Copy this to your spec file) ===\n');
        const gearSpec = this.equippedItems.map(item => {
            const obj: any = { itemId: item.itemId };
            if (item.randomSuffixId) obj.randomSuffixId = item.randomSuffixId;
            if (item.enchantId) obj.enchantId = item.enchantId;
            return obj;
        });
        console.log(c.green + JSON.stringify(gearSpec) + c.reset);
    }
}

async function main() {
    const program = new Command();

    program
        .name('gear-builder')
        .description('Interactive gear builder for WoW Classic DPS Simulator')
        .version('1.0.0')
        .option('-e, --edit <json>', 'Edit existing gear (provide JSON array of EquippedItem[])');

    program.parse();

    const options = program.opts<{ edit?: string }>();
    const dbPath = path.resolve(__dirname, 'db.json');
    const builder = new GearBuilder(dbPath);

    try {
        if (options.edit) {
            builder.loadExistingGear(options.edit);
            await builder.editGear();
        } else {
            await builder.buildGear();
        }
        builder.displayGear();
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

main();
