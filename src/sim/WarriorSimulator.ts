import {AttackResult, GearStats, MeleeSimulationState, SimulationConfig, WarriorTalents} from '../types';
import {MeleeSimulator} from './MeleeSimulator';
import {MeleeDamageCalculator} from '../mechanics/MeleeDamageCalculator';

export class WarriorSimulator extends MeleeSimulator {
   protected state!: MeleeSimulationState;
   protected damageCalculator!: MeleeDamageCalculator;

   constructor(
      stats: GearStats,
      config: SimulationConfig,
      protected talents: WarriorTalents,
   ) {
      super(stats, config);
   }

   protected initializeState(): MeleeSimulationState {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected handleResourceGeneration(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected executeRotation(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected updateBuffs(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected getStateText(): string {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected calculateMainHandDamage(): AttackResult {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected calculateOffHandDamage(): AttackResult {
      throw new Error('Warrior simulator is not yet implemented.');
   }
}
