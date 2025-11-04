import {c, CharacterClass, colorByClass, RogueRotation, RogueTalents, WarriorTalents, WeaponType} from './types';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SimulationSpec, SpecLoader} from './SpecLoader';
import {RogueSimulator} from "./sim/RogueSimulator";

export interface SimulationOptions {
    specFile: string;
    attackPower: number;
    critChance: number;
    hitChance: number;
    weaponSkill: number;
    mainHand: {
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
    targetLevel: number;
    targetArmor: number;
    fightLength: number;
    iterations: number;
    postResGen: boolean;
    talentOverrides?: string;
    playbackSpeed?: number;
    quiet: boolean;
}

export class SimulationRunner {
    private readonly options: SimulationOptions;
    private spec!: SimulationSpec;
    private appliedTalentOverrides: Record<string, any> = {};

    constructor(options: SimulationOptions) {
        this.options = options;
    }

    private loadSpec(): void {
        try {
            this.spec = SpecLoader.load(this.options.specFile);
            this.applyCliOverrides();
        } catch (error) {
            throw new Error(`Error loading spec file: ${(error as Error).message}`);
        }
    }

    private applyCliOverrides(): void {
        this.spec.gearStats.attackPower = this.options.attackPower;
        this.spec.gearStats.critChance = this.options.critChance;
        this.spec.gearStats.hitChance = this.options.hitChance;
        this.spec.gearStats.weaponSkill = this.options.weaponSkill;
        this.spec.gearStats.mainHandWeapon = {
            minDamage: this.options.mainHand.minDamage,
            maxDamage: this.options.mainHand.maxDamage,
            speed: this.options.mainHand.speed,
            type: this.options.mainHand.type,
        };
        if (this.options.offHand) {
            this.spec.gearStats.offHandWeapon = {
                minDamage: this.options.offHand.minDamage,
                maxDamage: this.options.offHand.maxDamage,
                speed: this.options.offHand.speed,
                type: this.options.offHand.type,
            };
        } else {
            this.spec.gearStats.offHandWeapon = undefined;
        }
        
        this.spec.targetLevel = this.options.targetLevel;
        this.spec.targetArmor = this.options.targetArmor;
        this.spec.fightLength = this.options.fightLength;
        this.spec.iterations = this.options.iterations;
        this.spec.postResGen = this.options.postResGen;
    }

    private applyTalentOverrides(): void {
        if (!this.options.talentOverrides) {
            return;
        }

        try {
            const talentOverrides = this.options.talentOverrides.split(',').map((pair: string) => {
                const [name, value] = pair.split(':');
                if (!name || value === undefined) {
                    throw new Error(`Invalid talent format: ${pair}`);
                }
                return {name: name.trim(), value: value.trim()};
            });

            for (const override of talentOverrides) {
                const talentName = override.name;
                if (talentName in this.spec.talents) {
                    const originalValue = (this.spec.talents as any)[talentName];
                    if (typeof originalValue === 'boolean') {
                        const newValue = override.value === 'true' || override.value === '1';
                        (this.spec.talents as any)[talentName] = newValue;
                        this.appliedTalentOverrides[talentName] = newValue;
                    } else {
                        const newValue = parseFloat(override.value);
                        (this.spec.talents as any)[talentName] = newValue;
                        this.appliedTalentOverrides[talentName] = newValue;
                    }
                } else {
                    console.warn(`Warning: Talent "${talentName}" not found in spec file, ignoring.`);
                }
            }
        } catch (error) {
            throw new Error(
                `Error parsing talent overrides: ${(error as Error).message}\n` +
                `Format should be: NAME:VALUE,NAME:VALUE (e.g., malice:5,lethality:5)`
            );
        }
    }

    private createSimulator(): BaseSimulator {
        switch (this.spec.class) {
            case CharacterClass.Rogue:
                return new RogueSimulator(this.spec as SimulationSpec & { talents: RogueTalents; rotation?: RogueRotation });

            case CharacterClass.Warrior:
                return new WarriorSimulator(this.spec as SimulationSpec & { talents: WarriorTalents });

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
        console.log(`${c.cyan}Simulation params: ${c.reset}fightLength=${this.spec.fightLength}, targetLevel=${this.spec.targetLevel}, targetArmor=${this.spec.targetArmor}, iterations=${this.spec.iterations}, postResGen=${this.spec.postResGen}`);
        console.log(`${c.cyan}Talents: ${c.reset}${JSON.stringify(this.spec.talents)}`);
        console.log(`${c.cyan}Rotation: ${c.reset}${JSON.stringify(this.spec.rotation)}`);
        console.log(`${c.brightCyan}Running simulation...${c.reset}`);
    }

    private async runWithPlayback(simulator: BaseSimulator): Promise<void> {
        await simulator.simulateWithPlayback(this.options.playbackSpeed!);
        console.log('\nSimulation complete!');
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
        this.applyTalentOverrides();

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
        this.applyTalentOverrides();

        this.printSimulationInfo();

        const simulator = this.createSimulator();

        if (this.options.playbackSpeed !== undefined) {
            await this.runWithPlayback(simulator);
        } else {
            this.runMultipleIterations(simulator);
        }
    }
}

