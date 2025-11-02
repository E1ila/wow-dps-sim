import {CharacterStats, SimulationConfig, SimulationResult, WarriorTalents} from '../types';
import {BaseSimulator} from './BaseSimulator';

export class WarriorSimulator extends BaseSimulator {
   constructor(
      private stats: CharacterStats,
      private talents: WarriorTalents,
      private config: SimulationConfig
   ) {
      super();
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
