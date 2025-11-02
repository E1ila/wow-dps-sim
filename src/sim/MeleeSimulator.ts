import {BaseSimulator} from './BaseSimulator';
import {CharacterStats, MeleeSimulationState, SimulationConfig} from '../types';

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;

   protected constructor(
      protected stats: CharacterStats,
      protected config: SimulationConfig
   ) {
      super();
   }

   protected processAutoAttacks(
      onMainHandHit: (damage: number, isCrit: boolean) => void,
      onOffHandHit?: (damage: number, isCrit: boolean) => void
   ): void {
      if (this.state.currentTime >= this.state.mainHandNextSwing) {
         const {damage, isCrit} = this.calculateMainHandDamage();
         if (damage > 0) {
            onMainHandHit(damage, isCrit);
         }
         this.state.mainHandNextSwing = this.state.currentTime + this.stats.mainHandWeapon.speed;
      }

      if (this.stats.offHandWeapon && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const {damage, isCrit} = this.calculateOffHandDamage();
         if (damage > 0) {
            onOffHandHit(damage, isCrit);
         }
         this.state.offHandNextSwing = this.state.currentTime + this.stats.offHandWeapon.speed;
      }
   }

   protected abstract calculateMainHandDamage(): { damage: number; isCrit: boolean };
   protected abstract calculateOffHandDamage(): { damage: number; isCrit: boolean };
}
