import {
    c,
    CharacterClass,
    colorByClass,
    GearStats,
    RogueRotation,
    RogueTalents,
    SimulationConfig,
    WarriorTalents,
    WeaponType
} from './types';
import {WarriorSimulator} from './sim/WarriorSimulator';
import {BaseSimulator} from './sim/BaseSimulator';
import {SpecLoader} from './SpecLoader';
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
    private spec: any;
    private appliedTalentOverrides: Record<string, any> = {};

    constructor(options: SimulationOptions) {
        this.options = options;
    }

    private loadSpec(): void {
        try {
            this.spec = SpecLoader.load(this.options.specFile);
        } catch (error) {
            throw new Error(`Error loading spec file: ${(error as Error).message}`);
        }
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
                return new RogueSimulator(
                    this.spec.gearStats,
                    this.spec.simulationConfig,
                    this.spec.talents as RogueTalents,
                    this.spec.rotation as RogueRotation
                );

            case CharacterClass.Warrior:
                return new WarriorSimulator(this.spec.gearStats, this.spec.simulationConfig, this.spec.talents as WarriorTalents);

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
        console.log(`${c.cyan}Base stats (inc. gear): ${c.reset}${JSON.stringify(this.spec.simulationConfig)}`);
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

        const config = this.buildConfig();

        const simulator = this.createSimulator(this.spec.class, this.spec.gearStats, config);
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

