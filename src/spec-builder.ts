import {Command} from 'commander';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';
import {Database} from './Database';
import {Item} from './Database.types';
import {EquippedItem} from './SimulationSpec';
import {c} from "./globals";
import {SpecLoader} from './SpecLoader';

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

class SpecBuilder {
    private db: Database;
    private equippedItems: EquippedItem[] = [];
    private spec: any = null;  // Raw JSON spec file format (gets transformed by SpecLoader when used)
    private specPath: string | null = null;

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
        let spellId: number | undefined;
        let randomSuffixId: number | undefined;

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
                    const enchantSpellId = enchant.spellId;
                    const color = qualityColors[enchant.quality] || '';
                    return {
                        name: `${color}${enchant.name}${c.reset} (ID: ${enchantSpellId})`,
                        value: enchantSpellId,
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

            spellId = selectedEnchant;
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
            spellId,
        };
    }

    loadExistingGear(gearJson: string): void {
        try {
            const gear = JSON.parse(gearJson) as any[];
            this.equippedItems = gear.map(item => ({
                itemId: item.itemId,
                randomSuffixId: item.randomSuffixId,
                spellId: item.spellId,
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
            const enchant = equipped.spellId ? this.db.getEnchant(equipped.spellId) : null;
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
            if (item.spellId) obj.spellId = item.spellId;
            return obj;
        });
        console.log(c.green + JSON.stringify(gearSpec) + c.reset);
    }

    loadSpecFile(specFile: string): void {
        // Use SpecLoader for path resolution and loading
        const fullPath = path.join(__dirname, '..', 'specs', specFile.endsWith('.json') ? specFile : `${specFile}.json`);
        this.specPath = fullPath;

        try {
            // Load with allowInvalid=true to permit editing of incomplete specs
            const loadedSpec = SpecLoader.load(specFile, true);
            // Convert back to raw format (untransformed) for editing
            this.spec = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            this.equippedItems = this.spec.gear || [];
            console.log(`${c.green}Loaded spec from:${c.reset} ${specFile}`);

            // Validate the spec can be loaded normally (non-blocking warning)
            try {
                SpecLoader.load(specFile, true);
            } catch (error) {
                console.log(`${c.yellow}Warning: Spec file has validation issues: ${(error as Error).message}${c.reset}`);
                console.log(`${c.yellow}You can fix these issues using the editor.${c.reset}`);
            }
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                console.log(`${c.yellow}Spec file not found. Creating new spec:${c.reset} ${specFile}`);
                this.createNewSpec();
            } else if (error instanceof SyntaxError) {
                console.log(`${c.red}Error parsing JSON: ${error.message}${c.reset}`);
                console.log(`${c.yellow}Creating new spec instead.${c.reset}`);
                this.createNewSpec();
            } else {
                throw error;
            }
        }
    }

    private createNewSpec(): void {
        this.spec = {
            name: '',
            class: 'Rogue',
            playerLevel: 60,
            race: 'undead',
            setup: {},
            rotation: '',
            talents: {},
            gear: [],
            simulationConfig: {
                targetLevel: 63,
                targetArmor: 3731,
                fightLength: 120,
                iterations: 4000,
            }
        };
        this.equippedItems = [];
    }

    saveSpecFile(): void {
        if (!this.specPath || !this.spec) return;

        this.spec.gear = this.equippedItems;

        const dir = path.dirname(this.specPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.specPath, JSON.stringify(this.spec, null, 4));
        console.log(`\n${c.green}Spec saved to:${c.reset} ${this.specPath}`);
    }

    async editSpecMenu(): Promise<void> {
        if (!this.spec) return;

        while (true) {
            const choices = [
                { name: `Name: ${this.spec.name || '(not set)'}`, value: 'name' },
                { name: `Class: ${this.spec.class}`, value: 'class' },
                { name: `Race: ${this.spec.race || '(not set)'}`, value: 'race' },
                { name: `Player Level: ${this.spec.playerLevel}`, value: 'playerLevel' },
                { name: 'Talents', value: 'talents' },
                { name: `Rotation: ${this.spec.rotation || '(not set)'}`, value: 'rotation' },
                { name: 'Setup', value: 'setup' },
                { name: 'Simulation Config', value: 'simulationConfig' },
                { name: `Gear (${this.equippedItems.length} items)`, value: 'gear' },
                { name: '✓ Save and exit', value: 'save' },
                { name: '✗ Exit without saving', value: 'exit' },
            ];

            const { action } = await inquirer.prompt<{ action: string }>([{
                type: 'list',
                name: 'action',
                message: 'Select section to edit:',
                choices,
                pageSize: 15,
            }]);

            if (action === 'save') {
                this.saveSpecFile();
                break;
            } else if (action === 'exit') {
                break;
            } else if (action === 'name') {
                await this.editName();
            } else if (action === 'class') {
                await this.editClass();
            } else if (action === 'race') {
                await this.editRace();
            } else if (action === 'playerLevel') {
                await this.editPlayerLevel();
            } else if (action === 'talents') {
                await this.editTalents();
            } else if (action === 'rotation') {
                await this.editRotation();
            } else if (action === 'setup') {
                await this.editSetup();
            } else if (action === 'simulationConfig') {
                await this.editSimulationConfig();
            } else if (action === 'gear') {
                await this.editGear();
            }
        }
    }

    private async editName(): Promise<void> {
        const { name } = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'Enter spec name:',
            default: this.spec!.name,
        }]);
        this.spec!.name = name;
    }

    private async editClass(): Promise<void> {
        const { className } = await inquirer.prompt([{
            type: 'list',
            name: 'className',
            message: 'Select class:',
            choices: ['Rogue', 'Warrior', 'Mage', 'Shaman'],
            default: this.spec!.class,
        }]);
        this.spec!.class = className;
    }

    private async editRace(): Promise<void> {
        const { race } = await inquirer.prompt([{
            type: 'list',
            name: 'race',
            message: 'Select race:',
            choices: ['human', 'orc', 'undead', 'troll', 'gnome', 'dwarf', 'nightelf', 'tauren'],
            default: this.spec!.race,
        }]);
        this.spec!.race = race;
    }

    private async editPlayerLevel(): Promise<void> {
        const { level } = await inquirer.prompt([{
            type: 'number',
            name: 'level',
            message: 'Enter player level:',
            default: this.spec!.playerLevel,
        }]);
        this.spec!.playerLevel = level;
    }

    private async editTalents(): Promise<void> {
        console.log(`\n${c.yellow}Current talents:${c.reset}`);
        console.log(JSON.stringify(this.spec!.talents, null, 2));

        const { editMode } = await inquirer.prompt([{
            type: 'list',
            name: 'editMode',
            message: 'How would you like to edit talents?',
            choices: [
                { name: 'Edit as JSON', value: 'json' },
                { name: 'Interactive edit (one by one)', value: 'interactive' },
                { name: '← Back', value: 'back' },
            ],
        }]);

        if (editMode === 'json') {
            const { talentsJson } = await inquirer.prompt([{
                type: 'editor',
                name: 'talentsJson',
                message: 'Edit talents (JSON):',
                default: JSON.stringify(this.spec!.talents, null, 2),
            }]);
            try {
                this.spec!.talents = JSON.parse(talentsJson);
            } catch (error) {
                console.log(`${c.red}Invalid JSON. Changes not saved.${c.reset}`);
            }
        } else if (editMode === 'interactive') {
            await this.editTalentsInteractive();
        }
    }

    private async editTalentsInteractive(): Promise<void> {
        const talentKeys = Object.keys(this.spec!.talents);

        for (const key of talentKeys) {
            const currentValue = this.spec!.talents[key];
            const isBoolean = typeof currentValue === 'boolean';

            if (isBoolean) {
                const { value } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'value',
                    message: `${key}:`,
                    default: currentValue,
                }]);
                this.spec!.talents[key] = value;
            } else {
                const { value } = await inquirer.prompt([{
                    type: 'number',
                    name: 'value',
                    message: `${key}:`,
                    default: currentValue,
                }]);
                this.spec!.talents[key] = value;
            }
        }
    }

    private async editRotation(): Promise<void> {
        const { rotation } = await inquirer.prompt([{
            type: 'input',
            name: 'rotation',
            message: 'Enter rotation:',
            default: this.spec!.rotation,
        }]);
        this.spec!.rotation = rotation;
    }

    private async editSetup(): Promise<void> {
        console.log(`\n${c.yellow}Current setup:${c.reset}`);
        console.log(JSON.stringify(this.spec!.setup, null, 2));

        const { setupJson } = await inquirer.prompt([{
            type: 'editor',
            name: 'setupJson',
            message: 'Edit setup (JSON):',
            default: JSON.stringify(this.spec!.setup, null, 2),
        }]);

        try {
            this.spec!.setup = JSON.parse(setupJson);
        } catch (error) {
            console.log(`${c.red}Invalid JSON. Changes not saved.${c.reset}`);
        }
    }

    private async editSimulationConfig(): Promise<void> {
        const config = this.spec!.simulationConfig;

        const { targetLevel } = await inquirer.prompt([{
            type: 'number',
            name: 'targetLevel',
            message: 'Target level:',
            default: config.targetLevel,
        }]);

        const { targetArmor } = await inquirer.prompt([{
            type: 'number',
            name: 'targetArmor',
            message: 'Target armor:',
            default: config.targetArmor,
        }]);

        const { fightLength } = await inquirer.prompt([{
            type: 'number',
            name: 'fightLength',
            message: 'Fight length (seconds):',
            default: config.fightLength,
        }]);

        const { iterations } = await inquirer.prompt([{
            type: 'number',
            name: 'iterations',
            message: 'Number of iterations:',
            default: config.iterations,
        }]);

        this.spec!.simulationConfig = {
            targetLevel,
            targetArmor,
            fightLength,
            iterations,
        };
    }
}

async function main() {
    const program = new Command();

    program
        .name('gear-builder')
        .description('Interactive gear builder for WoW Classic DPS Simulator')
        .version('1.0.0')
        .option('-s, --spec <path>', 'Spec file path (e.g., "rogue/tals" for specs/rogue/tals.json)')
        .option('-e, --edit <json>', 'Edit existing gear (provide JSON array of EquippedItem[])');

    program.parse();

    const options = program.opts<{ spec?: string; edit?: string }>();
    const dbPath = path.resolve(__dirname, 'db.json');
    const builder = new SpecBuilder(dbPath);

    try {
        if (options.spec) {
            builder.loadSpecFile(options.spec);
            await builder.editSpecMenu();
        } else if (options.edit) {
            builder.loadExistingGear(options.edit);
            await builder.editGear();
        } else {
            await builder.buildGear();
        }

        if (!options.spec) {
            builder.displayGear();
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

main();
