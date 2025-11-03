import {BaseSimulator} from './BaseSimulator';
import {AttackResult, AttackType, MeleeSimulationState} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;
   protected abstract damageCalculator: MeleeDamageCalculator;

   protected handleAutoAttacks(): void {
      this.processAutoAttacks(
         (result) => {
            this.onMainHandHit(result);
            this.addDamage('Main Hand', result);
         },
         (result) => {
            this.onOffHandHit(result);
            this.addDamage('Off Hand', result);
         }
      );
   }

   protected onMainHandHit(result: AttackResult): void {
      // Override in subclasses for class-specific logic (e.g., Sword Specialization)
   }

   protected onOffHandHit(result: AttackResult): void {
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
      onMainHandHit: (result: AttackResult) => void,
      onOffHandHit?: (result: AttackResult) => void
   ): void {
      if (this.state.currentTime >= this.state.mainHandNextSwing) {
         const result = this.calculateMainHandDamage();
         onMainHandHit(result);
         this.state.mainHandNextSwing = this.state.currentTime + (this.stats.mainHandWeapon.speed * 1000);
      }

      if (this.stats.offHandWeapon && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const result = this.calculateOffHandDamage();
         onOffHandHit(result);
         this.state.offHandNextSwing = this.state.currentTime + (this.stats.offHandWeapon.speed * 1000);
      }
   }

   protected calculateMainHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }

   protected calculateOffHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }
}
