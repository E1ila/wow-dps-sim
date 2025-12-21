import {Command} from 'commander';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs';
import {Database} from './Database';
import {Item} from './Database.types';
import {EquippedItem, EquippedItemSlot} from './SimulationSpec';
import {c, EQUIPMENT_SLOTS, getEnchantTypesForItem} from "./globals";
import {SpecLoader} from './SpecLoader';
import {EquipmentSlot, ItemSlotType, TargetType} from "./types";

class SpecBuilder {
    private db: Database;
    private equippedItems: EquippedItemSlot[] = [];
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

    private async promptForItem(slot: EquipmentSlot): Promise<EquippedItemSlot | null> {
        console.log(`\n--- ${slot.name.toUpperCase()} ---`);

        const isTrinketSlot = slot.name === 'trinket1' || slot.name === 'trinket2';
        const itemQueue: EquippedItem[] = [];

        while (true) {
            const isFirstItem = itemQueue.length === 0;
            const promptMessage = isFirstItem
                ? `Search for ${slot.name} item (or press Enter to skip):`
                : `Search for another ${slot.name} item (or press Enter to finish):`;

            const { query } = await inquirer.prompt([{
                type: 'input',
                name: 'query',
                message: promptMessage,
            }]);

            if (!query.trim()) {
                if (isFirstItem && !slot.optional) {
                    console.log('This slot is required. Please enter a search term.');
                    continue;
                }
                // If it's the first item and optional, or subsequent items, break
                break;
            }

            const matchingItems = this.searchItems(query, slot.slotTypes);

            if (matchingItems.length === 0) {
                console.log('No items found. Please try again.');
                continue;
            }

            let selectedItem: Item | null;

            if (matchingItems.length === 1) {
                selectedItem = matchingItems[0];
                console.log(`\n${c.yellow}${selectedItem.name}${c.reset} (ID: ${selectedItem.id}, iLvl: ${selectedItem.ilvl})\n`);
            } else {
                const choices: Array<{ name: string; value: Item | null }> = matchingItems.slice(0, 20).map(item => ({
                    name: `${item.name} (ID: ${item.id}, iLvl: ${item.ilvl})`,
                    value: item,
                }));

                choices.push({ name: '← Search again', value: null });

                const result = await inquirer.prompt<{ selectedItem: Item | null }>([{
                    type: 'list',
                    name: 'selectedItem',
                    message: `Select ${slot.name}:`,
                    choices,
                    pageSize: 15,
                }]);

                selectedItem = result.selectedItem;

                if (!selectedItem) {
                    continue;
                }
            }

            // Apply enchant only to the first item
            const equippedItem = await this.promptForEnchantAndSuffix(selectedItem, isFirstItem);
            itemQueue.push(equippedItem);

            // For trinket slots, ask if they want to add more items
            if (isTrinketSlot) {
                const { addMore } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'addMore',
                    message: 'Add another item to this trinket slot queue?',
                    default: false,
                }]);

                if (!addMore) {
                    break;
                }
            } else {
                // For non-trinket slots, only allow one item
                break;
            }
        }

        if (itemQueue.length === 0) {
            return null;
        } else if (itemQueue.length === 1) {
            return itemQueue[0];
        } else {
            return itemQueue;
        }
    }

    private async promptForEnchantAndSuffix(item: Item, allowEnchant: boolean = true): Promise<EquippedItem> {
        let spellId: number | undefined;
        let randomSuffixId: number | undefined;

        const allEnchants = this.db.getAllEnchants();
        const enchantTypes = getEnchantTypesForItem(item.type);

        const compatibleEnchants = allEnchants
            .filter(enchant =>
                enchantTypes.includes(enchant.type) ||
                (enchant.extraTypes && enchant.extraTypes.includes(item.type))
            )
            .sort((a, b) => {
                if (b.quality !== a.quality) return b.quality - a.quality;
                return a.name.localeCompare(b.name);
            });

        // Only prompt for enchant if allowed (first item in queue)
        if (allowEnchant && compatibleEnchants.length > 0) {
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

    loadSpecString(specString: string): void {
        if (!this.spec) {
            this.createNewSpec();
        }

        const parts = specString.split('|');

        // Parse talents (first part)
        if (parts[0]) {
            const talentPairs = parts[0].split(',');
            for (const pair of talentPairs) {
                const [key, value] = pair.split(':');
                if (key && value !== undefined) {
                    const numValue = parseInt(value, 10);
                    this.spec!.talents[key] = isNaN(numValue) ? value : numValue;
                }
            }
            console.log(`Loaded talents from spec string.`);
        }

        // Parse setup/rotation (second part)
        if (parts[1]) {
            const setupPairs = parts[1].split(',');
            for (const pair of setupPairs) {
                const [key, value] = pair.split(':');
                if (key && value !== undefined) {
                    const numValue = parseInt(value, 10);
                    this.spec!.setup[key] = isNaN(numValue) ? value : numValue;
                }
            }
            console.log(`Loaded setup from spec string.`);
        }
    }

    async buildGear(): Promise<EquippedItemSlot[]> {
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

    async editGear(): Promise<EquippedItemSlot[]> {
        console.log('=== WoW Classic Gear Editor ===\n');
        console.log('Current gear loaded. Select slots to edit.\n');

        while (true) {
            const slotChoices = EQUIPMENT_SLOTS.map((slot, index) => {
                const slotData = this.equippedItems[index];

                let displayName: string;
                if (!slotData) {
                    displayName = '(empty)';
                } else if (Array.isArray(slotData)) {
                    // It's a queue
                    const firstItem = this.db.getItem(slotData[0].itemId);
                    displayName = `[Queue: ${slotData.length} items] ${firstItem?.name || 'Unknown'}`;
                } else {
                    // Single item
                    const item = this.db.getItem(slotData.itemId);
                    displayName = item ? item.name : 'Unknown';
                }

                return {
                    name: `${slot.name}: ${displayName}`,
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
        this.equippedItems.forEach((slot, index) => {
            // Check if it's a queue or single item
            if (Array.isArray(slot)) {
                // It's a queue - display all items
                console.log(`${index + 1}. [Queue with ${slot.length} items]`);
                slot.forEach((equipped, queueIndex) => {
                    const item = this.db.getItem(equipped.itemId);
                    const enchant = equipped.spellId ? this.db.getEnchant(equipped.spellId) : null;
                    const suffix = equipped.randomSuffixId ? this.db.getRandomSuffix(equipped.randomSuffixId) : null;

                    let description = `   ${queueIndex + 1}) ${item?.name || 'Unknown'} (ID: ${equipped.itemId})`;
                    if (enchant) description += ` + ${enchant.name}`;
                    if (suffix) description += ` of ${suffix.name}`;

                    console.log(description);
                });
            } else {
                // Single item
                const equipped = slot;
                if (!equipped) return;

                const item = this.db.getItem(equipped.itemId);
                const enchant = equipped.spellId ? this.db.getEnchant(equipped.spellId) : null;
                const suffix = equipped.randomSuffixId ? this.db.getRandomSuffix(equipped.randomSuffixId) : null;

                let description = `${index + 1}. ${item?.name || 'Unknown'} (ID: ${equipped.itemId})`;
                if (enchant) description += ` + ${enchant.name}`;
                if (suffix) description += ` of ${suffix.name}`;

                console.log(description);
            }
        });

        console.log('\n=== GEAR SPEC (Copy this to your spec file) ===\n');
        const gearSpec = this.equippedItems.map(slot => {
            if (!slot) return null;

            // Check if it's a queue or single item
            if (Array.isArray(slot)) {
                // It's a queue - output with itemIds array
                const firstItem = slot[0];
                const itemIds = slot.map(item => item.itemId);
                const itemNames = slot.map(item => {
                    const itemData = this.db.getItem(item.itemId);
                    return itemData?.name || 'Unknown';
                });

                const obj: any = {
                    itemIds: itemIds,
                    names: itemNames,
                };
                // Add enchant from first item if present
                if (firstItem.spellId) {
                    obj.spellId = firstItem.spellId;
                    const enchantData = this.db.getEnchant(firstItem.spellId);
                    obj.enchantName = enchantData?.name || 'Unknown';
                }
                if (firstItem.randomSuffixId) {
                    obj.randomSuffixId = firstItem.randomSuffixId;
                }
                return obj;
            } else {
                // Single item
                const item = slot;
                const itemData = this.db.getItem(item.itemId);
                const enchantData = item.spellId ? this.db.getEnchant(item.spellId) : null;

                const obj: any = {
                    itemId: item.itemId,
                    name: itemData?.name || 'Unknown'
                };
                if (item.randomSuffixId) obj.randomSuffixId = item.randomSuffixId;
                if (item.spellId) {
                    obj.spellId = item.spellId;
                    obj.enchantName = enchantData?.name || 'Unknown';
                }
                return obj;
            }
        }).filter(item => item !== null);
        console.log(c.green + JSON.stringify(gearSpec, null, 2) + c.reset);
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

            // Transform raw gear JSON into EquippedItemSlot format
            this.equippedItems = (this.spec.gear || []).map((rawItem: any): EquippedItemSlot => {
                if (!rawItem) return rawItem;

                // Check if it's already an array (old format: direct array of items)
                if (Array.isArray(rawItem)) {
                    return rawItem.map((item: any): EquippedItem => {
                        const equipped: EquippedItem = { itemId: item.itemId };
                        if (item.spellId) equipped.spellId = item.spellId;
                        if (item.randomSuffixId) equipped.randomSuffixId = item.randomSuffixId;
                        return equipped;
                    });
                }

                // Check if it's a queue (new format: has itemIds array)
                if (rawItem.itemIds && Array.isArray(rawItem.itemIds)) {
                    return rawItem.itemIds.map((itemId: number, index: number): EquippedItem => {
                        const equipped: EquippedItem = { itemId };
                        if (index === 0 && rawItem.spellId) {
                            equipped.spellId = rawItem.spellId;
                        }
                        if (rawItem.randomSuffixId) {
                            equipped.randomSuffixId = rawItem.randomSuffixId;
                        }
                        return equipped;
                    });
                }

                // Single item
                const equipped: EquippedItem = { itemId: rawItem.itemId };
                if (rawItem.spellId) equipped.spellId = rawItem.spellId;
                if (rawItem.randomSuffixId) equipped.randomSuffixId = rawItem.randomSuffixId;
                return equipped;
            });

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

        // Transform equipped items to include names
        this.spec.gear = this.equippedItems.map(slot => {
            if (!slot) return slot;

            // Check if it's a queue or single item
            if (Array.isArray(slot)) {
                // It's a queue
                const firstItem = slot[0];
                const itemIds = slot.map(item => item.itemId);
                const itemNames = slot.map(item => {
                    const itemData = this.db.getItem(item.itemId);
                    return itemData?.name || 'Unknown';
                });

                const obj: any = {
                    itemIds: itemIds,
                    names: itemNames,
                };
                if (firstItem.spellId) {
                    obj.spellId = firstItem.spellId;
                }
                if (firstItem.randomSuffixId) {
                    obj.randomSuffixId = firstItem.randomSuffixId;
                }
                return obj;
            } else {
                // Single item
                const itemData = this.db.getItem(slot.itemId);
                const obj: any = {
                    itemId: slot.itemId,
                    name: itemData?.name || 'Unknown'
                };
                if (slot.randomSuffixId) {
                    obj.randomSuffixId = slot.randomSuffixId;
                }
                if (slot.spellId) {
                    obj.spellId = slot.spellId;
                }
                return obj;
            }
        });

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
                { name: 'Player Setup', value: 'setup' },
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

        const { targetType } = await inquirer.prompt([{
            type: 'list',
            name: 'targetType',
            message: 'Target type:',
            choices: [
                { name: 'Undefined', value: TargetType.Undefined },
                { name: 'Humanoid', value: TargetType.Humanoid },
                { name: 'Beast', value: TargetType.Beast },
                { name: 'Dragonkin', value: TargetType.Dragonkin },
                { name: 'Giant', value: TargetType.Giant },
                { name: 'Undead', value: TargetType.Undead },
                { name: 'Demon', value: TargetType.Demon },
                { name: 'Elemental', value: TargetType.Elemental },
            ],
            default: config.targetType || TargetType.Undefined,
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
            targetType,
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
        .argument('[specFile]', 'Spec file path (e.g., "rogue/tals" for specs/rogue/tals.json)')
        .option('-e, --edit <json>', 'Edit existing gear (provide JSON array of EquippedItem[])')
        .option('-s, --spec <spec>', 'Load spec string (e.g., "ruthlessness:3,murder:2|avoidEviscerate:1")');

    program.parse();

    const specFilePath = program.args[0];
    const options = program.opts<{ edit?: string; spec?: string }>();
    const dbPath = path.resolve(__dirname, 'db.json');
    const builder = new SpecBuilder(dbPath);

    try {
        if (specFilePath) {
            builder.loadSpecFile(specFilePath);
            if (options.spec) {
                builder.loadSpecString(options.spec);
            }
            await builder.editSpecMenu();
        } else if (options.edit) {
            if (options.spec) {
                builder.loadSpecString(options.spec);
            }
            builder.loadExistingGear(options.edit);
            await builder.editGear();
        } else if (options.spec) {
            builder.loadSpecString(options.spec);
            await builder.editSpecMenu();
        } else {
            await builder.buildGear();
        }

        if (!specFilePath && !options.spec) {
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
