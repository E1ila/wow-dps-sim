import {
   CharacterStats,
   RogueTalents,
   SimulationConfig,
   RogueSimulationState,
   SimulationResult,
   DamageEvent,
   RogueDamageEvent,
   WeaponType,
} from '../types';
import {RogueDamageCalculator} from '../mechanics/RogueDamageCalculator';
import {MeleeSimulator} from './MeleeSimulator';

export class RogueSimulator extends MeleeSimulator {
   protected override state: RogueSimulationState;
   protected override damageCalculator: RogueDamageCalculator;
   protected override events: RogueDamageEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();

   constructor(
      stats: CharacterStats,
      config: SimulationConfig,
      protected talents: RogueTalents,
   ) {
      super(stats, config);
      this.damageCalculator = new RogueDamageCalculator(stats, config, talents);
      this.state = this.initializeState();
   }

   protected initializeState(): RogueSimulationState {
      return {
         currentTime: 0,
         energy: 100,
         comboPoints: 0,
         targetHealth: 999999999,
         sliceAndDiceActive: false,
         sliceAndDiceExpiry: 0,
         mainHandNextSwing: 0,
         offHandNextSwing: 0,
         globalCooldownExpiry: 0,
         nextEnergyTick: 2.0,
      };
   }

   /**
    * Add damage with rogue-specific combo point tracking.
    */
   private addRogueDamage(ability: string, damage: number, isCrit: boolean, comboPointsGained: number = 0): void {
      if (damage > 0) {
         this.events.push({
            timestamp: this.state.currentTime,
            ability,
            damage,
            isCrit,
            comboPointsGained,
         });

         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + damage);
      }
   }

   private addEnergy(amount: number): void {
      this.state.energy = Math.min(100, this.state.energy + amount);
   }

   private spendEnergy(amount: number): boolean {
      if (this.state.energy >= amount) {
         this.state.energy -= amount;
         return true;
      }
      return false;
   }

   private addComboPoint(): void {
      if (this.state.comboPoints < 5) {
         this.state.comboPoints++;
      }
   }

   private spendComboPoints(): number {
      const cp = this.state.comboPoints;
      this.state.comboPoints = 0;
      return cp;
   }

   private handleAutoAttacks(): void {
      super.processAutoAttacks(
         (damage, isCrit) => {
            if (this.talents.swordSpecialization > 0 &&
               this.stats.mainHandWeapon.type === WeaponType.Sword &&
               Math.random() < (this.talents.swordSpecialization * 0.01)) {
               this.addDamage('Extra Attack (Sword Spec)', damage, isCrit);
            }
            this.addDamage('Main Hand', damage, isCrit);
         },
         (damage, isCrit) => {
            this.addDamage('Off Hand', damage, isCrit);
         }
      );
   }

   private executeRotation(): void {
      if (!this.canCastAbility()) {
         return;
      }

      if (this.state.comboPoints === 5) {
         if (!this.state.sliceAndDiceActive ||
            this.state.sliceAndDiceExpiry - this.state.currentTime < 3) {
            if (this.spendEnergy(25)) {
               const cp = this.spendComboPoints();
               const baseDuration = 9 + (cp * 3);
               const improvedSndBonus = this.talents.improvedSliceAndDice * 0.15;
               const duration = baseDuration * (1 + improvedSndBonus);

               this.state.sliceAndDiceActive = true;
               this.state.sliceAndDiceExpiry = this.state.currentTime + duration;
               this.triggerGlobalCooldown();
               return;
            }
         } else {
            if (this.spendEnergy(35)) {
               const cp = this.spendComboPoints();
               const damage = this.damageCalculator.calculateEviscerateDamage(cp);
               const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();
               this.addDamage('Eviscerate', damage, isCrit);
               this.triggerGlobalCooldown();
               return;
            }
         }
      }

      if (this.state.comboPoints < 5) {
         let energyCost = 45;
         const improvedSSCostReduction = this.talents.improvedSinisterStrike * 2;
         energyCost -= improvedSSCostReduction;

         if (this.spendEnergy(energyCost)) {
            let abilityName = 'Sinister Strike';
            let damage = 0;

            if (this.talents.hemorrhage &&
               this.stats.mainHandWeapon.type === WeaponType.Dagger) {
               abilityName = 'Hemorrhage';
               damage = this.damageCalculator.calculateHemorrhageDamage();
            } else if (this.stats.mainHandWeapon.type === WeaponType.Dagger) {
               abilityName = 'Backstab';
               energyCost = 60;
               if (this.state.energy + energyCost >= 60) {
                  damage = this.damageCalculator.calculateBackstabDamage();
               } else {
                  damage = this.damageCalculator.calculateSinisterStrikeDamage();
                  abilityName = 'Sinister Strike';
               }
            } else {
               damage = this.damageCalculator.calculateSinisterStrikeDamage();
            }

            const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();

            if (damage > 0) {
               this.addComboPoint();

               if (isCrit && this.talents.sealFate > 0) {
                  if (Math.random() < (this.talents.sealFate * 0.2)) {
                     this.addComboPoint();
                  }
               }

               if (this.talents.relentlessStrikes > 0 && this.state.comboPoints >= 5) {
                  if (Math.random() < (this.talents.relentlessStrikes * 0.2)) {
                     this.addEnergy(25);
                  }
               }
            }

            this.addRogueDamage(abilityName, damage, isCrit, 1);
            this.triggerGlobalCooldown();
            return;
         }
      }
   }

   private updateBuffs(): void {
      if (this.state.sliceAndDiceActive && this.state.currentTime >= this.state.sliceAndDiceExpiry) {
         this.state.sliceAndDiceActive = false;
      }
   }

   protected processTimeStep(): void {
      if (this.state.currentTime >= this.state.nextEnergyTick) {
         this.addEnergy(20);
         this.state.nextEnergyTick += 2.0;
      }

      this.handleAutoAttacks();
      this.updateBuffs();
      this.executeRotation();

      this.state.currentTime += 0.1;
   }

   /**
    * Override printEvent to show combo points for rogue damage events.
    */
   protected override printEvent(event: RogueDamageEvent): void {
      const critStr = event.isCrit ? ' (CRIT!)' : '';
      const cpStr = event.comboPointsGained > 0 ? ` [+${event.comboPointsGained} CP]` : '';
      console.log(`[${event.timestamp.toFixed(1)}s] ${event.ability}: ${event.damage}${critStr}${cpStr}`);
   }

   /**
    * Print the current rogue state during playback.
    */
   protected printState(): void {
      const sndStatus = this.state.sliceAndDiceActive
         ? ` | SnD: ${(this.state.sliceAndDiceExpiry - this.state.currentTime).toFixed(1)}s`
         : '';
      console.log(`  → Energy: ${this.state.energy} | CP: ${this.state.comboPoints}${sndStatus}`);
   }
}
