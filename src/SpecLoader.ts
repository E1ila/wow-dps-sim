import {readFileSync} from 'fs';
import {
   CharacterClass,
   GearStats,
   RogueRotation,
   RogueTalents,
   SimulationConfig,
   TargetType,
   WarriorRotation,
   WarriorTalents
} from './types';
import path from "node:path";

export interface SimulationSpec {
   name: string;
   description: string;
   class: CharacterClass;
   playerLevel: number;
   rotation?: RogueRotation | WarriorRotation;
   talents: RogueTalents | WarriorTalents;
   gearStats: GearStats;
   simulationConfig: SimulationConfig;
   fightLength: number;
   targetLevel: number;
   targetType?: TargetType;
   targetArmor: number;
   iterations: number;
   postCycleResourceGeneration?: boolean;
}

export class SpecLoader {
   static load(specFile: string): SimulationSpec {
      try {
         if (!specFile.endsWith('.json'))
            specFile += '.json';
         const filePath = path.join(__dirname, '..', 'specs', specFile);
         const fileContent = readFileSync(filePath, 'utf-8');
         const spec: any = JSON.parse(fileContent);

         if (!spec.name || !spec.class || !spec.talents || !spec.gearStats) {
            throw new Error('Invalid spec file: missing required fields (name, class, talents, gearStats)');
         }

         // Migrate old format: move level from gearStats to playerLevel
         if (spec.gearStats.level !== undefined && !spec.playerLevel) {
            spec.playerLevel = spec.gearStats.level;
            delete spec.gearStats.level;
         }

         if (!spec.playerLevel) {
            throw new Error('Invalid spec file: missing required field playerLevel');
         }

         // Set defaults for simulation parameters if not provided
         spec.fightLength = spec.fightLength ?? spec.simulationConfig?.fightLength ?? 60;
         spec.targetLevel = spec.targetLevel ?? spec.simulationConfig?.targetLevel ?? 63;
         spec.targetArmor = spec.targetArmor ?? spec.simulationConfig?.targetArmor ?? 3731;
         spec.iterations = spec.iterations ?? spec.simulationConfig?.iterations ?? 1000;
         spec.postCycleResourceGeneration = spec.postCycleResourceGeneration ?? spec.simulationConfig?.postCycleResourceGeneration ?? false;

        const classMap: { [key: string]: CharacterClass } = {
            'rogue': CharacterClass.Rogue,
            'warrior': CharacterClass.Warrior,
        };

        const characterClass = classMap[spec.class.toLowerCase()];
        if (!characterClass) {
            throw new Error(`Unknown class "${spec.class}". Available classes: rogue, warrior`);
        }
        spec.class = characterClass;

         return spec as SimulationSpec;
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Spec file not found: ${specFile}`);
         }
         throw error;
      }
   }
}
