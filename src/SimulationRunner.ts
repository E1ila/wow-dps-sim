import {CharacterClass, WeaponType} from './types';
import {c, colorByClass} from './globals';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SpecLoader} from './SpecLoader';
import {RogueSimulator} from "./sim/RogueSimulator";
import {ShamanSimulator} from "./sim/ShamanSimulator";
import path from "node:path";
import {Database} from "./Database";
import {SimulationOptions, SimulationSetup, SimulationSpec} from "./SimulationSpec";
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
            this.applyGearStats();
            this.applyTalentOverrides();
            this.applySetupOverrides();
            this.applyGearOverrides();
            this.applyRotationOverrides();
            this.applyCliOverrides();
        } catch (error) {
            throw new Error(`Error loading spec file: ${(error as Error).message}`);
        }
    }

    private applyGearStats(): void {
        this.spec.stats = this.gearParser.parse(this.spec.gear, this.spec.stats);
        if (this.spec.worldBuffs)
            applyWorldBuffs(this.spec.worldBuffs, this.spec.stats)
        if (this.spec.consumables)
            applyConsumables(this.spec.consumables, this.spec.stats)
    }

    private applyCliOverrides(): void {
        if (this.options.critChance !== undefined) {
            this.spec.stats.critChance = this.options.critChance;
        }
        if (this.options.hitChance !== undefined) {
            this.spec.stats.hitChance = this.options.hitChance;
        }
        if (this.options.weaponSkill !== undefined) {
            // For backward compatibility, apply weapon skill to main hand weapon type
            const mainHandType = this.spec.stats.mainHandWeapon.type;
            this.spec.stats.weaponSkills.set(mainHandType, this.options.weaponSkill);
        }
        if (this.options.mainHand) {
            this.spec.stats.mainHandWeapon = {
                ...this.spec.stats.mainHandWeapon,
                minDamage: this.options.mainHand.minDamage,
                maxDamage: this.options.mainHand.maxDamage,
                speed: this.options.mainHand.speed,
                type: this.options.mainHand.type,
            };
        }
        if (this.options.offHand && this.spec.stats.offHandWeapon) {
            this.spec.stats.offHandWeapon = {
                ...this.spec.stats.offHandWeapon,
                minDamage: this.options.offHand.minDamage,
                maxDamage: this.options.offHand.maxDamage,
                speed: this.options.offHand.speed,
                type: this.options.offHand.type,
            };
        } else if (this.options.offHand === null) {
            this.spec.stats.offHandWeapon = undefined;
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

    private parseOverrides(overrideString: string, type: string): Array<{name: string; value: string}> {
        try {
            return overrideString.split(',').map((pair: string) => {
                const [name, value] = pair.split(':');
                if (!name || value === undefined) {
                    throw new Error(`Invalid ${type} format: ${pair}`);
                }
                return {name: name.trim(), value: value.trim()};
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
            const talentName = override.name;
            if (talentName in this.spec.talents) {
                const originalValue = (this.spec.talents as any)[talentName];
                const newValue = this.parseValue(override.value, originalValue);
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
            (this.spec.setup as any)[override.name] = this.parseValue(override.value);
        }
    }

    private applyGearOverrides(): void {
        if (!this.options.gearOverrides) {
            return;
        }

        const overrides = this.parseOverrides(this.options.gearOverrides, 'gear');

        for (const override of overrides) {
            const name = override.name;
            const value = override.value;

            if (name.startsWith('mh.')) {
                const prop = name.substring('mh.'.length);
                if (prop === 'type') {
                    this.spec.stats.mainHandWeapon.type = parseInt(value) as WeaponType;
                } else {
                    (this.spec.stats.mainHandWeapon as any)[prop] = parseFloat(value);
                }
            } else if (name.startsWith('oh.')) {
                if (!this.spec.stats.offHandWeapon) {
                    console.warn(`Warning: No off-hand weapon in spec, cannot override "${name}"`);
                    continue;
                }
                const prop = name.substring('oh.'.length);
                if (prop === 'type') {
                    this.spec.stats.offHandWeapon.type = parseInt(value) as WeaponType;
                } else {
                    (this.spec.stats.offHandWeapon as any)[prop] = parseFloat(value);
                }
            } else if (name in this.spec.stats) {
                (this.spec.stats as any)[name] = parseFloat(value);
            } else {
                console.warn(`Warning: Gear stat "${name}" not found in spec file, ignoring.`);
            }
        }
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
                return new RogueSimulator(this.spec as SimulationSpec & { talents: RogueTalents; setup?: SimulationSetup });

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
        
        // Print gear stats nicely formatted
        console.log(`${c.cyan}Gear Stats:${c.reset}`);
        const gs = this.spec.stats;
        
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
        console.log(`  Main Hand: ${c.yellow}${gs.mainHandWeapon.minDamage}-${gs.mainHandWeapon.maxDamage}${c.reset} dmg, ${c.yellow}${gs.mainHandWeapon.speed}${c.reset} speed, ${c.yellow}${gs.mainHandWeapon.type}${c.reset}${gs.mainHandWeapon.enchant !== 'None' ? ` (${c.magenta}${gs.mainHandWeapon.enchant}${c.reset})` : ''}`);
        if (gs.offHandWeapon) {
            console.log(`  Off Hand: ${c.yellow}${gs.offHandWeapon.minDamage}-${gs.offHandWeapon.maxDamage}${c.reset} dmg, ${c.yellow}${gs.offHandWeapon.speed}${c.reset} speed, ${c.yellow}${gs.offHandWeapon.type}${c.reset}${gs.offHandWeapon.enchant !== 'None' ? ` (${c.magenta}${gs.offHandWeapon.enchant}${c.reset})` : ''}`);
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

