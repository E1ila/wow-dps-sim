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

   protected initializeState(): MeleeSimulationState {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected processTimeStep(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected printState(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected calculateMainHandDamage(): { damage: number; isCrit: boolean } {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected calculateOffHandDamage(): { damage: number; isCrit: boolean } {
      throw new Error('Warrior simulator is not yet implemented.');
   }
}
