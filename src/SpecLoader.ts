import {readFileSync} from 'fs';
import {CharacterClass,} from './types';
import path from "node:path";
import {SimulationSpec} from "./SimulationSpec";

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

         if (!spec.playerLevel) {
            throw new Error('Invalid spec file: missing required field playerLevel');
         }

         // Set defaults for simulation parameters if not provided
         spec.fightLength = spec.fightLength ?? spec.simulationConfig?.fightLength ?? 60;
         spec.targetLevel = spec.targetLevel ?? spec.simulationConfig?.targetLevel ?? 63;
         spec.targetArmor = spec.targetArmor ?? spec.simulationConfig?.targetArmor ?? 3731;
         spec.iterations = spec.iterations ?? spec.simulationConfig?.iterations ?? 1000;
         spec.postCycleResourceGeneration = spec.postCycleResourceGeneration ?? spec.simulationConfig?.postCycleResourceGeneration ?? false;

         // Parse rotation string into array
         if (spec.rotation && typeof spec.rotation === 'string') {
            spec.rotation = spec.rotation.split(',').map((instruction: string) => instruction.trim());
         }

        const classMap: { [key: string]: CharacterClass } = {
            'rogue': CharacterClass.Rogue,
            'warrior': CharacterClass.Warrior,
            'mage': CharacterClass.Mage,
            'shaman': CharacterClass.Shaman,
        };

        const characterClass = classMap[spec.class.toLowerCase()];
        if (!characterClass) {
            throw new Error(`Unknown class "${spec.class}". Available classes: rogue, warrior, mage, shaman`);
        }
        spec.class = characterClass;

        // Determine if this is a healer spec based on class
        spec.isHealerSpec = characterClass === CharacterClass.Shaman;

         return spec as SimulationSpec;
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Spec file not found: ${specFile}`);
         }
         throw error;
      }
   }
}
