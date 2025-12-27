import {BaseSimulator} from './BaseSimulator';
import {AttackResult, AttackType, Buff, MeleeSimulationState, Weapon, WeaponEnchant} from '../types';
import {isHit, ITEM_IDS} from '../globals';
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
            this.logDamage('MH', result);
         },
         (result) => {
            this.onOffHandHit(result);
            this.logDamage('OH', result);
         }
      );
   }

   protected onMainHandHit(result: AttackResult): void {
      if (isHit(result)) {
         this.checkCrusaderProc(this.spec.extraStats.mh);
         this.checkThunderfuryProc(this.spec.extraStats.mh);
         // Override in subclasses for class-specific logic (e.g., Sword Specialization)
      }
   }

   protected onOffHandHit(result: AttackResult): void {
      if (isHit(result)) {
         this.checkCrusaderProc(this.spec.extraStats.oh!);
         this.checkThunderfuryProc(this.spec.extraStats.oh!);
         // Override in subclasses for class-specific logic
      }
   }

   protected checkCrusaderProc(weapon: Weapon): void {
      // Crusader procs once per minute on average (1 PPM)
      // Proc chance per hit = weapon_speed / 60
      if (weapon.enchant === WeaponEnchant.Crusader) {
         const procChance = weapon.speed / 60;
         if (Math.random() < procChance) {
            this.addProc(Buff.Crusader, true);
            this.activateBuff(Buff.Crusader, 15000); // 15 seconds duration
         }
      }
   }

   protected checkThunderfuryProc(weapon: Weapon): void {
      // Thunderfury procs 6 times per minute on average (6.0 PPM)
      // Proc chance per hit = (weapon_speed / 60) * 6.0
      if (this.hasEquippedItem(ITEM_IDS.Thunderfury)) {
         const procChance = (weapon.speed / 60) * 6.0;
         if (Math.random() < procChance) {
            this.addProc('Thunderfury');
            // Deal 300 Nature damage (flat, not affected by spell power)
            this.logDamage('Thunderfury', {
               type: AttackType.Hit,
               amountModifier: 1,
               baseAmount: 300,
               amount: 300,
            });
         }
      }
   }

   protected processTimeStep(): void {
      if (!this.spec.postCycleResourceGeneration) {
         this.handleResourceGeneration();
      }
      this.activateTrinkets();
      this.handleAutoAttacks();
      this.updateBuffs();
      this.executeRotation();
      if (this.spec.postCycleResourceGeneration) {
         this.handleResourceGeneration();
      }
   }

   protected abstract handleResourceGeneration(): void;

   protected getHasteMultiplier(): number {
      return this.haste;
   }

   protected processAutoAttacks(
      onMainHandHit: (result: AttackResult) => void,
      onOffHandHit?: (result: AttackResult) => void
   ): void {
      if (this.state.currentTime >= this.state.mainHandNextSwing) {
         const result = this.calculateMainHandDamage();
         onMainHandHit(result);
         this.state.mainHandNextSwing = this.state.currentTime + (this.spec.extraStats.mh.speed * 1000 / this.getHasteMultiplier());
      }

      if (this.spec.extraStats.oh && onOffHandHit && this.state.currentTime >= this.state.offHandNextSwing) {
         const result = this.calculateOffHandDamage();
         onOffHandHit(result);
         this.state.offHandNextSwing = this.state.currentTime + (this.spec.extraStats.oh.speed * 1000 / this.getHasteMultiplier());
      }
   }

   protected calculateMainHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }

   protected calculateOffHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }
}
