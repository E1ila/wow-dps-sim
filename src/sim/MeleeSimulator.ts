import {BaseSimulator} from './BaseSimulator';
import {AttackResult, Buffs, MeleeSimulationState, Weapon, WeaponEnchant} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";

export enum MeleeAbility {
   MainHand = 'MH',
   OffHand = 'OH',
}

export abstract class MeleeSimulator extends BaseSimulator {
   protected abstract state: MeleeSimulationState;
   protected abstract damageCalculator: MeleeDamageCalculator;

   protected handleAutoAttacks(): void {
      if (this.spec.setup?.disableAutoAttacks)
         return;
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
      this.checkCrusaderProc(this.spec.gearStats.mainHandWeapon);
      // Override in subclasses for class-specific logic (e.g., Sword Specialization)
   }

   protected onOffHandHit(result: AttackResult): void {
      if (this.spec.gearStats.offHandWeapon) {
         this.checkCrusaderProc(this.spec.gearStats.offHandWeapon);
      }
      // Override in subclasses for class-specific logic
   }

   protected checkCrusaderProc(weapon: Weapon): void {
      // Crusader procs once per minute on average (1 PPM)
      // Proc chance per hit = weapon_speed / 60
      if (weapon.enchant === WeaponEnchant.Crusader) {
         const procChance = weapon.speed / 60;
         if (Math.random() < procChance) {
            this.addProc(Buffs.Crusader);
            this.activateBuff(Buffs.Crusader, 15000); // 15 seconds duration
         }
      }
   }

   protected processTimeStep(): void {
      if (!this.spec.postCycleResourceGeneration) {
         this.handleResourceGeneration();
      }
      this.handleAutoAttacks();
      this.updateBuffs();
      this.executeRotation();
      if (this.spec.postCycleResourceGeneration) {
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
         this.state.mainHandNextSwing = this.state.currentTime + (this.spec.gearStats.mainHandWeapon.speed * 1000 / this.getHasteMultiplier());
      }

      if (this.spec.gearStats.offHandWeapon && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const result = this.calculateOffHandDamage();
         onOffHandHit(result);
         this.state.offHandNextSwing = this.state.currentTime + (this.spec.gearStats.offHandWeapon.speed * 1000 / this.getHasteMultiplier());
      }
   }

   protected calculateMainHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }

   protected calculateOffHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }
}
