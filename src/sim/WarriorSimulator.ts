import {AttackResult, MeleeSimulationState, WarriorTalents} from '../types';
import {MeleeSimulator} from './MeleeSimulator';
import {MeleeDamageCalculator} from '../mechanics/MeleeDamageCalculator';
import {SimulationSpec} from '../SpecLoader';

export class WarriorSimulator extends MeleeSimulator {
   protected state!: MeleeSimulationState;
   protected damageCalculator!: MeleeDamageCalculator;
   protected talents: WarriorTalents;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as WarriorTalents;
   }

   protected initializeState(): MeleeSimulationState {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected handleResourceGeneration(): void {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected executeHardcodedRotation() {
      throw new Error('Warrior simulator is not yet implemented.');
   }

   protected executeCommand(cmd: string): boolean {
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
