import {readFileSync} from 'fs';
import {
   CharacterClass,
   GearStats,
   RogueRotation,
   RogueTalents,
   SimulationConfig,
   WarriorRotation,
   WarriorTalents
} from './types';

export interface SimulationSpec {
   name: string;
   description: string;
   class: CharacterClass;
   rotation?: RogueRotation | WarriorRotation;
   talents: RogueTalents | WarriorTalents;
   gearStats: GearStats;
   simulationConfig: SimulationConfig;
   fightLength: number;
   targetLevel: number;
   targetArmor: number;
   iterations: number;
   postResGen?: boolean;
}

export class SpecLoader {
   static load(filePath: string): SimulationSpec {
      try {
         const fileContent = readFileSync(filePath, 'utf-8');
         const spec: SimulationSpec = JSON.parse(fileContent);

         if (!spec.name || !spec.class || !spec.talents || !spec.gearStats) {
            throw new Error('Invalid spec file: missing required fields (name, class, talents, gearStats)');
         }

         // Set defaults for simulation parameters if not provided
         spec.fightLength = spec.fightLength ?? spec.simulationConfig?.fightLength ?? 60;
         spec.targetLevel = spec.targetLevel ?? spec.simulationConfig?.targetLevel ?? 63;
         spec.targetArmor = spec.targetArmor ?? spec.simulationConfig?.targetArmor ?? 3731;
         spec.iterations = spec.iterations ?? spec.simulationConfig?.iterations ?? 1000;
         spec.postResGen = spec.postResGen ?? spec.simulationConfig?.postResGen ?? false;

        const classMap: { [key: string]: CharacterClass } = {
            'rogue': CharacterClass.Rogue,
            'warrior': CharacterClass.Warrior,
        };

        const characterClass = classMap[spec.class.toLowerCase()];
        if (!characterClass) {
            throw new Error(`Unknown class "${spec.class}". Available classes: rogue, warrior`);
        }
        spec.class = characterClass;

         return spec;
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Spec file not found: ${filePath}`);
         }
         throw error;
      }
   }
}
