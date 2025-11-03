import {BaseSimulator} from './BaseSimulator';
import {MeleeSimulationState} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;
   protected abstract damageCalculator: MeleeDamageCalculator;

   protected handleAutoAttacks(): void {
      this.processAutoAttacks(
         (damage, isCrit) => {
            this.onMainHandHit(damage, isCrit);
            this.addDamage('Main Hand', damage, isCrit);
         },
         (damage, isCrit) => {
            this.onOffHandHit(damage, isCrit);
            this.addDamage('Off Hand', damage, isCrit);
         }
      );
   }

   protected onMainHandHit(damage: number, isCrit: boolean): void {
      // Override in subclasses for class-specific logic (e.g., Sword Specialization)
   }

   protected onOffHandHit(damage: number, isCrit: boolean): void {
      // Override in subclasses for class-specific logic
   }

   protected processTimeStep(): void {
      if (!this.config.postResGen) {
         this.handleResourceGeneration();
      }
      this.handleAutoAttacks();
      this.updateBuffs();
      this.executeRotation();
      if (this.config.postResGen) {
         this.handleResourceGeneration();
      }
   }

   protected abstract handleResourceGeneration(): void;

   protected processAutoAttacks(
      onMainHandHit: (damage: number, isCrit: boolean) => void,
      onOffHandHit?: (damage: number, isCrit: boolean) => void
   ): void {
      if (this.state.currentTime >= this.state.mainHandNextSwing) {
         const {damage, isCrit} = this.calculateMainHandDamage();
         if (damage > 0) {
            onMainHandHit(damage, isCrit);
         }
         this.state.mainHandNextSwing = this.state.currentTime + (this.stats.mainHandWeapon.speed * 1000);
      }

      if (this.stats.offHandWeapon && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const {damage, isCrit} = this.calculateOffHandDamage();
         if (damage > 0) {
            onOffHandHit(damage, isCrit);
         }
         this.state.offHandNextSwing = this.state.currentTime + (this.stats.offHandWeapon.speed * 1000);
      }
   }

   protected calculateMainHandDamage(): { damage: number; isCrit: boolean } {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }

   protected calculateOffHandDamage(): { damage: number; isCrit: boolean } {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }
}
