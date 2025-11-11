import {CharacterClass, RogueTalents, ShamanTalents, SimulationSetup, WarriorTalents, WeaponType} from './types';
import {c, colorByClass} from './globals';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SimulationSpec, SpecLoader} from './SpecLoader';
import {RogueSimulator} from "./sim/RogueSimulator";
import {ShamanSimulator} from "./sim/ShamanSimulator";
import path from "node:path";
import {Database} from "./Database";

export interface SimulationOptions {
    specFile: string;
    // gear stats CLI override
    critChance?: number;
    hitChance?: number;
    weaponSkill?: number;
    mainHand?: {
        minDamage: number;
        maxDamage: number;
        speed: number;
        type: WeaponType;
    };
    offHand?: {
        minDamage: number;
        maxDamage: number;
        speed: number;
        type: WeaponType;
    };
    // encounter
    targetLevel?: number;
    targetArmor?: number;
    fightLength?: number;
    // simulation
    iterations?: number;
    postCycleResourceGeneration?: boolean;
    playbackSpeed?: number;
    // compare input
    talentOverrides?: string;
    setupOverrides?: string;
    gearOverrides?: string;
    rotationOverrides?: string;
    // output
    quiet: boolean;
}

export class SimulationRunner {
    private readonly options: SimulationOptions;
    private spec!: SimulationSpec;
    private appliedTalentOverrides: Record<string, any> = {};

    db: Database;

    constructor(options: SimulationOptions) {
        this.options = options;

        const dbPath = path.resolve(__dirname, 'db.json');
        this.db = new Database(dbPath);
    }

    private loadSpec(): void {
        try {
            this.spec = SpecLoader.load(this.options.specFile);
            this.applyTalentOverrides();
            this.applySetupOverrides();
            this.applyGearOverrides();
            this.applyRotationOverrides();
            this.applyCliOverrides();
        } catch (error) {
            throw new Error(`Error loading spec file: ${(error as Error).message}`);
        }
    }

    private applyCliOverrides(): void {
        if (this.options.critChance !== undefined) {
            this.spec.gearStats.critChance = this.options.critChance;
        }
        if (this.options.hitChance !== undefined) {
            this.spec.gearStats.hitChance = this.options.hitChance;
        }
        if (this.options.weaponSkill !== undefined) {
            this.spec.gearStats.weaponSkill = this.options.weaponSkill;
        }
        if (this.options.mainHand) {
            this.spec.gearStats.mainHandWeapon = {
                ...this.spec.gearStats.mainHandWeapon,
                minDamage: this.options.mainHand.minDamage,
                maxDamage: this.options.mainHand.maxDamage,
                speed: this.options.mainHand.speed,
                type: this.options.mainHand.type,
            };
        }
        if (this.options.offHand && this.spec.gearStats.offHandWeapon) {
            this.spec.gearStats.offHandWeapon = {
                ...this.spec.gearStats.offHandWeapon,
                minDamage: this.options.offHand.minDamage,
                maxDamage: this.options.offHand.maxDamage,
                speed: this.options.offHand.speed,
                type: this.options.offHand.type,
            };
        } else if (this.options.offHand === null) {
            this.spec.gearStats.offHandWeapon = undefined;
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
                    this.spec.gearStats.mainHandWeapon.type = value as WeaponType;
                } else {
                    (this.spec.gearStats.mainHandWeapon as any)[prop] = parseFloat(value);
                }
            } else if (name.startsWith('oh.')) {
                if (!this.spec.gearStats.offHandWeapon) {
                    console.warn(`Warning: No off-hand weapon in spec, cannot override "${name}"`);
                    continue;
                }
                const prop = name.substring('oh.'.length);
                if (prop === 'type') {
                    this.spec.gearStats.offHandWeapon.type = value as WeaponType;
                } else {
                    (this.spec.gearStats.offHandWeapon as any)[prop] = parseFloat(value);
                }
            } else if (name in this.spec.gearStats) {
                (this.spec.gearStats as any)[name] = parseFloat(value);
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

    private printSimulationInfo(): void {
        if (this.options.quiet) {
            return;
        }

        console.log(`${c.brightMagenta}WoW Classic Era - DPS Simulator${c.reset}`);
        console.log(` ## ${colorByClass(this.spec.class)}${this.spec.class.toUpperCase()}${c.reset} ##`);
        console.log(`${c.cyan}Config: ${c.reset}${JSON.stringify(this.spec.gearStats)}`);
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

        // this.printSimulationInfo();

        const simulator = this.createSimulator();

        if (this.options.playbackSpeed !== undefined) {
            await this.runWithPlayback(simulator);
        } else {
            this.runMultipleIterations(simulator);
        }
    }
}

