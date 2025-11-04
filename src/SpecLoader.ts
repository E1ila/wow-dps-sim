import {readFileSync} from 'fs';
import {CharacterClass, GearStats, RogueRotation, RogueTalents, SimulationConfig, WarriorRotation, WarriorTalents} from './types.js';

export interface SpecFile {
   name: string;
   class: CharacterClass;
   description: string;
   rotation?: RogueRotation | WarriorRotation;
   talents: RogueTalents | WarriorTalents;
   gearStats: GearStats;
   simulationConfig: SimulationConfig;
}

export class SpecLoader {
   static load(filePath: string): SpecFile {
      try {
         const fileContent = readFileSync(filePath, 'utf-8');
         const spec: SpecFile = JSON.parse(fileContent);

         if (!spec.name || !spec.class || !spec.talents || !spec.gearStats || !spec.simulationConfig) {
            throw new Error('Invalid spec file: missing required fields (name, class, talents, gearStats, simulationConfig)');
         }

         const classMap: { [key: string]: CharacterClass } = {
            'rogue': CharacterClass.Rogue,
            'warrior': CharacterClass.Warrior,
         };

         const characterClass = classMap[this.spec.class.toLowerCase()];
         if (!characterClass) {
            throw new Error(`Unknown class "${this.spec.class}". Available classes: rogue, warrior`);
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
