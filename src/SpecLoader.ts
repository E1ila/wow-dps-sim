import {readFileSync} from 'fs';
import {CharacterClass,} from './types';
import path from "node:path";
import {EquippedItem, EquippedItemQueue, EquippedItemSlot, SimulationSpec} from "./SimulationSpec";

export class SpecLoader {
   static load(specFile: string, allowInvalid: boolean = false): SimulationSpec {
      try {
         if (!specFile.endsWith('.json'))
            specFile += '.json';
         const filePath = path.join(__dirname, '..', 'specs', specFile);
         const fileContent = readFileSync(filePath, 'utf-8');
         const spec: any = JSON.parse(fileContent);

        if (!allowInvalid) {
            if (!spec.name || !spec.class || !spec.talents) {
                throw new Error('Invalid spec file: missing required fields (name, class, talents)');
            }

            // gearStats is optional now - can be built from gear array or provided directly
            if (!spec.gearStats && !spec.gear) {
                throw new Error('Invalid spec file: must have either gearStats or gear array');
            }

            if (!spec.playerLevel) {
                throw new Error('Invalid spec file: missing required field playerLevel');
            }
        }

         // Set defaults for simulation parameters if not provided
         spec.fightLength = spec.fightLength ?? spec.simulationConfig?.fightLength ?? 60;
         spec.targetLevel = spec.targetLevel ?? spec.simulationConfig?.targetLevel ?? 63;
         spec.targetArmor = spec.targetArmor ?? spec.simulationConfig?.targetArmor ?? 3731;
         spec.targetType = spec.targetType ?? spec.simulationConfig?.targetType;
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

        if (spec.class) {
            const characterClass = classMap[spec.class.toLowerCase()];
            if (!characterClass && !allowInvalid) {
                throw new Error(`Unknown class "${spec.class}". Available classes: rogue, warrior, mage, shaman`);
            }
            if (characterClass) {
                spec.class = characterClass;
                // Determine if this is a healer spec based on class
                spec.isHealerSpec = characterClass === CharacterClass.Shaman;
            }
        }

        // Normalize gear items: convert itemIds arrays to EquippedItemQueue
        if (spec.gear && Array.isArray(spec.gear)) {
            spec.gear = spec.gear.map((item: any): EquippedItemSlot => {
                if (!item) return item;

                // If item has itemIds (array), create a queue
                if (item.itemIds && Array.isArray(item.itemIds)) {
                    const queue: EquippedItemQueue = item.itemIds.map((itemId: number, index: number) => {
                        const equippedItem: EquippedItem = {
                            itemId: itemId,
                            randomSuffixId: item.randomSuffixId,
                        };
                        // Apply spellId only to the first item in the queue
                        if (index === 0 && item.spellId) {
                            equippedItem.spellId = item.spellId;
                        }
                        return equippedItem;
                    });
                    return queue;
                }

                // Otherwise, keep as single item
                return item as EquippedItem;
            });
        }

         return spec as SimulationSpec;
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Spec file not found: ${specFile}`);
         }
         throw error;
      }
   }
}
