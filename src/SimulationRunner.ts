import {CharacterClass, ENCHANT_NAME_TO_SPELL_ID} from './types';
import {c, colorByClass, EQUIPMENT_SLOTS, GEAR_SLOT_NAMES} from './globals';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SpecLoader} from './SpecLoader';
import {RogueSimulator} from "./sim/RogueSimulator";
import {ShamanSimulator} from "./sim/ShamanSimulator";
import path from "node:path";
import {Database} from "./Database";
import {EquippedItemQueue, getItemFromSlot, PlayerSetup, SimulationOptions, SimulationSpec} from "./SimulationSpec";
import {RogueTalents, ShamanTalents, WarriorTalents} from "./talents";
import {GearParser} from "./GearParser";
import {applyWorldBuffs} from "./worldbuffs";
import {applyConsumables} from "./consumables";

export class SimulationRunner {
    private readonly options: SimulationOptions;
    private spec!: SimulationSpec;
    private appliedTalentOverrides: Record<string, any> = {};

    db: Database;
    gearParser: GearParser;

    constructor(options: SimulationOptions) {
        this.options = options;

        const dbPath = path.resolve(__dirname, 'db.json');
        this.db = new Database(dbPath);
        this.gearParser = new GearParser(this.db);
    }

    private loadSpec(): void {
        try {
            this.spec = SpecLoader.load(this.options.specFile);
            this.applySpecOverrides();
            this.applyGearStats();
            this.applyTalentOverrides();
            this.applySetupOverrides();
            this.applyRotationOverrides();
            this.applyCliOverrides();
        } catch (error) {
            throw new Error(`Error loading spec file: ${(error as Error).message}`);
        }
    }

    private applyGearStats(): void {
        this.spec.extraStats = this.gearParser.aggregateStats(this.spec.gear);
        if (this.spec.worldBuffs)
            applyWorldBuffs(this.spec.worldBuffs, this.spec.extraStats)
        if (this.spec.consumables)
            applyConsumables(this.spec.consumables, this.spec.extraStats)
    }

    private applyCliOverrides(): void {
        if (this.options.critChance !== undefined) {
            this.spec.extraStats.critChance = this.options.critChance;
        }
        if (this.options.hitChance !== undefined) {
            this.spec.extraStats.hitChance = this.options.hitChance;
        }
        if (this.options.weaponSkill !== undefined) {
            // For backward compatibility, apply weapon skill to main hand weapon type
            const mainHandType = this.spec.extraStats.mh.type;
            this.spec.extraStats.weaponSkills.set(mainHandType, this.options.weaponSkill);
        }
        if (this.options.mainHand) {
            this.spec.extraStats.mh = {
                ...this.spec.extraStats.mh,
                min: this.options.mainHand.minDamage,
                max: this.options.mainHand.maxDamage,
                speed: this.options.mainHand.speed,
                type: this.options.mainHand.type,
            };
        }
        if (this.options.offHand && this.spec.extraStats.oh) {
            this.spec.extraStats.oh = {
                ...this.spec.extraStats.oh,
                min: this.options.offHand.minDamage,
                max: this.options.offHand.maxDamage,
                speed: this.options.offHand.speed,
                type: this.options.offHand.type,
            };
        } else if (this.options.offHand === null) {
            this.spec.extraStats.oh = undefined;
        }

        if (this.options.targetLevel !== undefined) {
            this.spec.targetLevel = this.options.targetLevel;
        }
        if (this.options.targetArmor !== undefined) {
            this.spec.targetArmor = this.options.targetArmor;
        }
        if (this.options.fightLength !== undefined) {
            this.spec.fightLength = this.options.fightLength;
        }
        if (this.options.iterations !== undefined) {
            this.spec.iterations = this.options.iterations;
        }
        if (this.options.postCycleResourceGeneration !== undefined) {
            this.spec.postCycleResourceGeneration = this.options.postCycleResourceGeneration;
        }
    }

    private parseOverrides(overrideString: string, type: string): string[][] {
        try {
            return overrideString.split(',').map((pair: string) => {
                return pair.split(':').map(o => o.trim());
            });
        } catch (error) {
            throw new Error(
                `Error parsing ${type} overrides: ${(error as Error).message}\n` +
                `Format should be: NAME:VALUE,NAME:VALUE`
            );
        }
    }

    private parseValue(valueStr: string, originalValue?: any): any {
        if (typeof originalValue === 'boolean') {
            return valueStr === 'true' || valueStr === '1';
        }

        if (valueStr === 'true' || valueStr === '1') return true;
        if (valueStr === 'false' || valueStr === '0') return false;

        return parseFloat(valueStr);
    }

    private applyTalentOverrides(): void {
        if (!this.options.talentOverrides) {
            return;
        }

        const overrides = this.parseOverrides(this.options.talentOverrides, 'talent');

        for (const override of overrides) {
            const talentName = override[0];
            if (talentName in this.spec.talents) {
                const originalValue = (this.spec.talents as any)[talentName];
                const newValue = this.parseValue(override[1], originalValue);
                (this.spec.talents as any)[talentName] = newValue;
                this.appliedTalentOverrides[talentName] = newValue;
            } else {
                console.warn(`Warning: Talent "${talentName}" not found in spec file, ignoring.`);
            }
        }
    }

    private applySetupOverrides(): void {
        if (!this.options.setupOverrides) {
            return;
        }

        if (!this.spec.setup) {
            this.spec.setup = {};
        }

        const overrides = this.parseOverrides(this.options.setupOverrides, 'setup');

        for (const override of overrides) {
            (this.spec.setup as any)[override[0]] = this.parseValue(override[1]);
        }
    }

    private applySpecOverrides(): void {
        if (!this.options.gearOverrides) {
            return;
        }

        const overrides = this.parseOverrides(this.options.gearOverrides, 'gear');

        for (const override of overrides) {
            const name = override[0];
            if (GEAR_SLOT_NAMES.includes(name)) {
                this.applySlotItemOverride(name, override[1], override[2]);
            }
        }
    }

    private applySlotItemOverride(slotName: string, itemSpec: string, enchant: string): void {
        // Find the slot index
        const slotIndex = EQUIPMENT_SLOTS.findIndex(slot => slot.name === slotName);
        if (slotIndex === -1) {
            console.warn(`Warning: Slot "${slotName}" not found, ignoring gear override`);
            return;
        }

        // Ensure gear array exists and has enough slots
        if (!this.spec.gear) {
            this.spec.gear = [];
        }

        // Check if itemSpec is a queue (wrapped in brackets)
        if (itemSpec.startsWith('(') && itemSpec.endsWith(')')) {
            // Parse as queue - extract content and split by dots
            const queueContent = itemSpec.slice(1, -1);
            const itemSpecs = queueContent.split('.');

            const queue: EquippedItemQueue = [];
            for (let i = 0; i < itemSpecs.length; i++) {
                const singleItemSpec = itemSpecs[i].trim();
                if (!singleItemSpec) continue;

                const item = this.parseItemSpec(singleItemSpec, slotName);
                if (!item) continue;

                // Apply enchant only to the first item in the queue
                const spellId = (i === 0) ? this.parseEnchant(enchant) : undefined;

                queue.push({
                    itemId: item.id,
                    spellId: spellId || 0
                });
            }

            if (queue.length === 0) {
                console.warn(`Warning: No valid items found in queue for slot "${slotName}"`);
                return;
            }

            this.spec.gear[slotIndex] = queue;
        } else {
            // Parse as single item
            const item = this.parseItemSpec(itemSpec, slotName);
            if (!item) return;

            const spellId = this.parseEnchant(enchant);

            this.spec.gear[slotIndex] = {
                itemId: item.id,
                spellId: spellId || 0
            };
        }

        // Recalculate gear stats after modification
        this.applyGearStats();
    }

    private parseItemSpec(itemSpec: string, slotName: string): any {
        if (/^\d+$/.test(itemSpec)) {
            // It's an item ID (pure numeric string)
            const itemId = parseInt(itemSpec);
            const item = this.db.getItem(itemId);
            if (!item) {
                console.warn(`Warning: Item with ID ${itemId} not found in database, ignoring for slot "${slotName}"`);
                return null;
            }
            return item;
        } else {
            // It's an item name - convert underscores to spaces
            const itemName = itemSpec.replace(/_/g, ' ');
            const item = this.db.findItemByName(itemName);
            if (!item) {
                console.warn(`Warning: Item "${itemName}" not found in database, ignoring for slot "${slotName}"`);
                return null;
            }
            return item;
        }
    }

    private parseEnchant(enchant: string): number | undefined {
        if (!enchant) return undefined;

        if (/^\d+$/.test(enchant)) {
            // It's a spell ID (pure numeric string)
            return parseInt(enchant);
        } else {
            // It's an enchant name - convert underscores to spaces and look up spell ID
            const enchantName = enchant.replace(/_/g, ' ');
            const spellId = this.getSpellIdFromEnchantName(enchantName);
            if (spellId === undefined) {
                console.warn(`Warning: Enchant "${enchantName}" not found, applying item without enchant`);
            }
            return spellId;
        }
    }

    private getSpellIdFromEnchantName(enchantName: string): number | undefined {
        return ENCHANT_NAME_TO_SPELL_ID[enchantName];
    }

    private applyRotationOverrides(): void {
        if (!this.options.rotationOverrides) {
            return;
        }

        this.spec.rotation = this.options.rotationOverrides.toLowerCase()
            .split(',')
            .map(ability => ability.trim())
            .filter(ability => ability.length > 0);
    }

    private createSimulator(): BaseSimulator {
        switch (this.spec.class) {
            case CharacterClass.Rogue:
                return new RogueSimulator(this.spec as SimulationSpec & { talents: RogueTalents; setup?: PlayerSetup });

            case CharacterClass.Warrior:
                return new WarriorSimulator(this.spec as SimulationSpec & { talents: WarriorTalents });

            case CharacterClass.Shaman:
                return new ShamanSimulator(this.spec as SimulationSpec & { talents: ShamanTalents });

            default:
                throw new Error(`Class ${this.spec.class} is not implemented yet.`);
        }
    }

    private printSimulationInfo(simulator: BaseSimulator): void {
        if (this.options.quiet) {
            return;
        }

        console.log(`${c.brightMagenta}WoW Classic Era - DPS Simulator${c.reset}`);
        console.log(` ## ${colorByClass(this.spec.class)}${this.spec.class.toUpperCase()}${c.reset} [${this.spec.playerLevel}] ##`);

        console.log(`\n${c.cyan}Equipped Gear:${c.reset}`);
        this.spec.gear.forEach((slot, index) => {
            const slotName = EQUIPMENT_SLOTS[index]?.name;
            const equippedItem = getItemFromSlot(slot);
            if (!slotName || !equippedItem || equippedItem.itemId === 0) return;

            const item = this.db.getItem(equippedItem.itemId);
            const itemName = item?.name || `Unknown Item (${equippedItem.itemId})`;

            let enchantText = '';
            if (equippedItem.spellId) {
                const enchant = this.db.getEnchant(equippedItem.spellId);
                const enchantName = enchant?.name || `Unknown Enchant (${equippedItem.spellId})`;
                enchantText = ` ${c.magenta}[${enchantName}]${c.reset}`;
            }

            console.log(`  ${slotName.padEnd(10)}: ${c.white}${itemName}${c.reset}${enchantText}`);
        });
        console.log();

        // Print gear stats nicely formatted
        console.log(`${c.cyan}Total Stats:${c.reset}`);
        const gs = this.spec.extraStats;

        // Primary stats
        if (simulator.strength > 0) console.log(`  Strength: ${c.green}${simulator.strength}${c.reset}`);
        if (simulator.agility > 0) console.log(`  Agility: ${c.green}${simulator.agility}${c.reset}`);
        // if (simulator.intellect !== undefined && simulator.intellect > 0) console.log(`  Intellect: ${c.green}${simulator.intellect}${c.reset}`);
        // if (simulator.spirit !== undefined && simulator.spirit > 0) console.log(`  Spirit: ${c.green}${simulator.spirit}${c.reset}`);
        
        // Combat stats
        if (simulator.attackPower > 0) console.log(`  Attack Power: ${c.green}${simulator.attackPower}${c.reset}`);
        console.log(`  Crit Chance: ${c.green}${simulator.critChance.toFixed(2)}%${c.reset}`);
        console.log(`  Hit Chance: ${c.green}${simulator.hitChance.toFixed(2)}%${c.reset}`);
        console.log(`  Weapon Skill: ${c.green}${simulator.weaponSkill}${c.reset}`);
        
        // Spell stats
        if (gs.spellPower !== undefined && gs.spellPower > 0) console.log(`  Spell Power: ${c.green}${gs.spellPower}${c.reset}`);
        if (gs.spellCrit !== undefined && gs.spellCrit > 0) console.log(`  Spell Crit: ${c.green}${gs.spellCrit.toFixed(2)}%${c.reset}`);
        if (gs.spellHit !== undefined && gs.spellHit > 0) console.log(`  Spell Hit: ${c.green}${gs.spellHit.toFixed(2)}%${c.reset}`);
        
        // Healer stats
        if (gs.healingPower !== undefined && gs.healingPower > 0) console.log(`  Healing Power: ${c.green}${gs.healingPower}${c.reset}`);
        if (gs.mp5 !== undefined && gs.mp5 > 0) console.log(`  MP5: ${c.green}${gs.mp5}${c.reset}`);
        if (gs.mana !== undefined && gs.mana > 0) console.log(`  Mana: ${c.green}${gs.mana}${c.reset}`);
        
        // Weapons
        console.log(`  Main Hand: ${c.yellow}${gs.mh.min}-${gs.mh.max}${c.reset} dmg, ${c.yellow}${gs.mh.speed}${c.reset} speed, ${c.yellow}${gs.mh.type}${c.reset}${gs.mh.enchant !== 'None' ? ` (${c.magenta}${gs.mh.enchant}${c.reset})` : ''}`);
        if (gs.oh) {
            console.log(`  Off Hand: ${c.yellow}${gs.oh.min}-${gs.oh.max}${c.reset} dmg, ${c.yellow}${gs.oh.speed}${c.reset} speed, ${c.yellow}${gs.oh.type}${c.reset}${gs.oh.enchant !== 'None' ? ` (${c.magenta}${gs.oh.enchant}${c.reset})` : ''}`);
        }
        
        console.log(`${c.cyan}Simulation params: ${c.reset}fightLength=${this.spec.fightLength}, targetLevel=${this.spec.targetLevel}, targetArmor=${this.spec.targetArmor}, iterations=${this.spec.iterations}, postCycleResourceGeneration=${this.spec.postCycleResourceGeneration}`);
        console.log(`${c.cyan}Talents: ${c.reset}${JSON.stringify(this.spec.talents)}`);
        console.log(`${c.cyan}Setup: ${c.reset}${JSON.stringify(this.spec.setup)}`);
        console.log(`${c.brightCyan}Running simulation...${c.reset}`);
    }

    private async runWithPlayback(simulator: BaseSimulator): Promise<void> {
        await simulator.simulateWithPlayback(this.options.playbackSpeed!);
    }

    private runMultipleIterations(simulator: BaseSimulator): void {
        const {results, executionTimeMs} = simulator.runMultipleIterations();
        const jsonResults = BaseSimulator.printResults(
            results,
            simulator,
            executionTimeMs,
            this.appliedTalentOverrides,
            this.options.quiet
        );

        if (this.options.quiet) {
            console.log(jsonResults);
        }
    }

    runAndGetResults(): any {
        this.loadSpec();

        const simulator = this.createSimulator();
        const {results, executionTimeMs} = simulator.runMultipleIterations();

        return BaseSimulator.printResults(
            results,
            simulator,
            executionTimeMs,
            this.appliedTalentOverrides,
            true
        );
    }

    async run(): Promise<void> {
        this.loadSpec();

        const simulator = this.createSimulator();
        this.printSimulationInfo(simulator);

        if (this.options.playbackSpeed !== undefined) {
            await this.runWithPlayback(simulator);
        } else {
            this.runMultipleIterations(simulator);
        }
    }
}

