import {BaseSimulator} from './BaseSimulator';
import {AttackResult, MeleeSimulationState} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";

export enum MeleeAbility {
   MainHand = 'MH',
   OffHand = 'OH',
}

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;
   protected abstract damageCalculator: MeleeDamageCalculator;

   protected handleAutoAttacks(): void {
      this.processAutoAttacks(
         (result) => {
            this.onMainHandHit(result);
            this.addDamage('MH', result);
         },
         (result) => {
            this.onOffHandHit(result);
            this.addDamage('OH', result);
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

   protected getHasteMultiplier(): number {
      return 1;
   }

   protected processAutoAttacks(
      onMainHandHit: (result: AttackResult) => void,
      onOffHandHit?: (result: AttackResult) => void
   ): void {
      if (this.state.currentTime >= this.state.mainHandNextSwing) {
         const result = this.calculateMainHandDamage();
         onMainHandHit(result);
         this.state.mainHandNextSwing = this.state.currentTime + (this.stats.mainHandWeapon.speed * 1000 / this.getHasteMultiplier());
      }

      if (this.stats.offHandWeapon && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const result = this.calculateOffHandDamage();
         onOffHandHit(result);
         this.state.offHandNextSwing = this.state.currentTime + (this.stats.offHandWeapon.speed * 1000 / this.getHasteMultiplier());
      }
   }

   protected calculateMainHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }

   protected calculateOffHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }
}
