import {CharacterStats, SimulationConfig, SimulationResult, WarriorTalents, MeleeSimulationState} from '../types';
import {MeleeSimulator} from './MeleeSimulator';
import {MeleeDamageCalculator} from '../mechanics/MeleeDamageCalculator';

export class WarriorSimulator extends MeleeSimulator {
   protected state!: MeleeSimulationState;
   protected damageCalculator!: MeleeDamageCalculator;

   constructor(
      stats: CharacterStats,
      config: SimulationConfig,
      protected talents: WarriorTalents,
   ) {
      super(stats, config);
   }

   protected calculateMainHandDamage(): { damage: number; isCrit: boolean } {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected calculateOffHandDamage(): { damage: number; isCrit: boolean } {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   simulate(): SimulationResult {
      throw new Error(
         'Warrior simulator is not yet implemented. Currently only Rogue class is supported.'
      );
   }

   runMultipleIterations(): SimulationResult[] {
      throw new Error(
         'Warrior simulator is not yet implemented. Currently only Rogue class is supported.'
      );
   }
}
