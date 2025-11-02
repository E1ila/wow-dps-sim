import {BaseSimulator} from './BaseSimulator';
import {MeleeSimulationState} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;
   protected abstract damageCalculator: MeleeDamageCalculator;

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

   protected calculateMainHandDamage(): { damage: number; isCrit: boolean } {
      const damage = this.damageCalculator.calculateAutoAttackDamage(true);
      const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();
      return {damage, isCrit};
   }

   protected calculateOffHandDamage(): { damage: number; isCrit: boolean } {
      const damage = this.damageCalculator.calculateAutoAttackDamage(false);
      const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();
      return {damage, isCrit};
   }
}
