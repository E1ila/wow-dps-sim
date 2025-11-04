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

    private getCharacterClass(): CharacterClass {
        const classMap: { [key: string]: CharacterClass } = {
            'rogue': CharacterClass.Rogue,
            'warrior': CharacterClass.Warrior,
        };

        const characterClass = classMap[this.spec.class.toLowerCase()];
        if (!characterClass) {
            throw new Error(`Unknown class "${this.spec.class}". Available classes: rogue, warrior`);
        }

        return characterClass;
    }

    private buildBaseStats(): GearStats {
        return {
            level: 60,
            attackPower: this.options.attackPower,
            critChance: this.options.critChance,
            hitChance: this.options.hitChance,
            agility: 300,
            strength: 100,
            weaponSkill: this.options.weaponSkill,
            mainHandWeapon: {
                minDamage: this.options.mainHand.minDamage,
                maxDamage: this.options.mainHand.maxDamage,
                speed: this.options.mainHand.speed,
                type: this.options.mainHand.type,
            },
            offHandWeapon: this.options.offHand ? {
                minDamage: this.options.offHand.minDamage,
                maxDamage: this.options.offHand.maxDamage,
                speed: this.options.offHand.speed,
                type: this.options.offHand.type,
            } : undefined,
        };
    }

    private buildConfig(): SimulationConfig {
        return {
            fightLength: this.options.fightLength,
            targetLevel: this.options.targetLevel,
            targetArmor: this.options.targetArmor,
            iterations: this.options.iterations,
            postResGen: this.options.postResGen,
        };
    }

    private createSimulator(
        characterClass: CharacterClass,
        baseStats: GearStats,
        config: SimulationConfig
    ): BaseSimulator {
        switch (characterClass) {
            case CharacterClass.Rogue:
                return new RogueSimulator(
                    baseStats,
                    config,
                    this.spec.talents as RogueTalents,
                    this.spec.rotation as RogueRotation
                );

            case CharacterClass.Warrior:
                return new WarriorSimulator(baseStats, config, this.spec.talents as WarriorTalents);

            default:
                throw new Error(`Class ${characterClass} is not implemented yet.`);
        }
    }

    private printSimulationInfo(
        characterClass: CharacterClass,
        baseStats: GearStats,
        config: SimulationConfig
    ): void {
        if (this.options.quiet) {
            return;
        }

        console.log(`${c.brightMagenta}WoW Classic Era - DPS Simulator${c.reset}`);
        console.log(` ## ${colorByClass(characterClass)}${characterClass.toUpperCase()}${c.reset} ##`);
        console.log(`${c.cyan}Config: ${c.reset}${JSON.stringify(baseStats)}`);
        console.log(`${c.cyan}Base stats (inc. gear): ${c.reset}${JSON.stringify(config)}`);
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

    async run(): Promise<void> {
        this.loadSpec();
        this.applyTalentOverrides();

        const characterClass = this.getCharacterClass();
        const baseStats = this.buildBaseStats();
        const config = this.buildConfig();

        this.printSimulationInfo(characterClass, baseStats, config);

        const simulator = this.createSimulator(characterClass, baseStats, config);

        if (this.options.playbackSpeed !== undefined) {
            await this.runWithPlayback(simulator);
        } else {
            this.runMultipleIterations(simulator);
        }
    }
}

