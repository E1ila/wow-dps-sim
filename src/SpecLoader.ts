import {readFileSync} from 'fs';
import {CharacterClass, RogueRotation, RogueTalents, WarriorRotation, WarriorTalents} from './types.js';

export interface SpecFile {
   name: string;
   class: CharacterClass;
   description: string;
   rotation?: RogueRotation | WarriorRotation;
   talents: RogueTalents | WarriorTalents;
}

export class SpecLoader {
   static load(filePath: string): SpecFile {
      try {
         const fileContent = readFileSync(filePath, 'utf-8');
         const spec: SpecFile = JSON.parse(fileContent);

         if (!spec.name || !spec.class || !spec.talents) {
            throw new Error('Invalid spec file: missing required fields (name, class, talents)');
         }

         return spec;
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Spec file not found: ${filePath}`);
         }
         throw error;
      }
   }

   static validateClass(spec: SpecFile, expectedClass: CharacterClass): void {
      if (spec.class.toLowerCase() !== expectedClass.toLowerCase()) {
         throw new Error(
            `Spec class mismatch: expected ${expectedClass}, got ${spec.class}`
         );
      }
   }
}
