import {
   CharacterStats,
   RogueTalents,
   RogueRotation,
   SimulationConfig,
   RogueSimulationState,
   SimulationResult,
   DamageEvent,
   RogueDamageEvent,
   WeaponType,
} from '../types';
import {RogueDamageCalculator} from '../mechanics/RogueDamageCalculator';
import {MeleeSimulator} from './MeleeSimulator';

const DEFAULT_DAGGERS_ROTATION: RogueRotation = {
   refreshSndSecondsAhead5Combo: 3,
};

const DEFAULT_SWORDS_ROTATION: RogueRotation = {
   refreshSndSecondsAhead5Combo: 3,
};

export class RogueSimulator extends MeleeSimulator {
   protected override state: RogueSimulationState;
   protected override damageCalculator: RogueDamageCalculator;
   protected override events: RogueDamageEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();
   protected rotation: RogueRotation;

   constructor(
      stats: CharacterStats,
      config: SimulationConfig,
      protected talents: RogueTalents,
      rotation?: RogueRotation,
   ) {
      super(stats, config);
      this.damageCalculator = new RogueDamageCalculator(stats, config, talents);
      this.state = this.initializeState();
      
      if (rotation) {
         this.rotation = rotation;
      } else {
         // Choose default rotation based on weapon type
         const isDagger = stats.mainHandWeapon.type === WeaponType.Dagger;
         this.rotation = isDagger ? DEFAULT_DAGGERS_ROTATION : DEFAULT_SWORDS_ROTATION;
      }
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
         nextEnergyTick: 2000,
      };
   }

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

   private castSliceAndDice(): boolean {
      if (!this.spendEnergy(25)) {
         return false;
      }

      const cp = this.spendComboPoints();
      const baseDuration = 9 + (cp * 3);
      const improvedSndBonus = this.talents.improvedSliceAndDice * 0.15;
      const durationSeconds = baseDuration * (1 + improvedSndBonus);
      const durationMs = durationSeconds * 1000;

      this.state.sliceAndDiceActive = true;
      this.state.sliceAndDiceExpiry = this.state.currentTime + durationMs;
      this.triggerGlobalCooldown();
      return true;
   }

   private castEviscerate(): boolean {
      if (!this.spendEnergy(35)) {
         return false;
      }

      const cp = this.spendComboPoints();
      const {damage, isCrit} = this.damageCalculator.calculateEviscerateDamage(cp);
      this.addDamage('Eviscerate', damage, isCrit);
      this.triggerGlobalCooldown();
      return true;
   }

   private castSinisterStrike(): boolean {
      let energyCost = 45;
      const improvedSSCostReduction = this.talents.improvedSinisterStrike * 2;
      energyCost -= improvedSSCostReduction;

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const {damage, isCrit} = this.damageCalculator.calculateSinisterStrikeDamage();
      
      this.handleComboPointGeneration(damage, isCrit);
      this.addRogueDamage('Sinister Strike', damage, isCrit, 1);
      this.triggerGlobalCooldown();
      return true;
   }

   private castBackstab(): boolean {
      if (!this.spendEnergy(60)) {
         return false;
      }

      const {damage, isCrit} = this.damageCalculator.calculateBackstabDamage();
      
      this.handleComboPointGeneration(damage, isCrit);
      this.addRogueDamage('Backstab', damage, isCrit, 1);
      this.triggerGlobalCooldown();
      return true;
   }

   private castHemorrhage(): boolean {
      let energyCost = 45;
      const improvedSSCostReduction = this.talents.improvedSinisterStrike * 2;
      energyCost -= improvedSSCostReduction;

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const {damage, isCrit} = this.damageCalculator.calculateHemorrhageDamage();
      
      this.handleComboPointGeneration(damage, isCrit);
      this.addRogueDamage('Hemorrhage', damage, isCrit, 1);
      this.triggerGlobalCooldown();
      return true;
   }

   private handleComboPointGeneration(damage: number, isCrit: boolean): void {
      if (damage <= 0) {
         return;
      }

      this.addComboPoint();

      // Seal Fate: chance to gain extra combo point on crit
      if (isCrit && this.talents.sealFate > 0) {
         if (Math.random() < (this.talents.sealFate * 0.2)) {
            this.addComboPoint();
         }
      }

      // Relentless Strikes: chance to restore energy on 5 combo points
      if (this.talents.relentlessStrikes > 0 && this.state.comboPoints >= 5) {
         if (Math.random() < (this.talents.relentlessStrikes * 0.2)) {
            this.addEnergy(25);
         }
      }
   }

   protected onMainHandHit(damage: number, isCrit: boolean): void {
      if (this.talents.swordSpecialization > 0 &&
         this.stats.mainHandWeapon.type === WeaponType.Sword &&
         Math.random() < (this.talents.swordSpecialization * 0.01)) {
         this.addDamage('Extra Attack (Sword Spec)', damage, isCrit);
      }
   }

   protected executeRotation(): void {
      if (!this.canCastAbility()) {
         return;
      }

      if (this.state.comboPoints === 5) {
         if (this.shouldRefreshSliceAndDice()) {
            this.castSliceAndDice();
         } else {
            this.castEviscerate();
         }
      } else {
         if (this.talents.hemorrhage) {
            this.castHemorrhage();
         } else if (this.stats.mainHandWeapon.type === WeaponType.Dagger) {
            this.castBackstab();
         } else {
            this.castSinisterStrike();
         }
      }
   }

   private shouldRefreshSliceAndDice(): boolean {
      if (!this.state.sliceAndDiceActive) {
         return true;
      }
      const timeRemainingMs = this.state.sliceAndDiceExpiry - this.state.currentTime;
      const refreshThresholdMs = this.rotation.refreshSndSecondsAhead5Combo * 1000;
      return timeRemainingMs < refreshThresholdMs;
   }

   protected updateBuffs(): void {
      if (this.state.sliceAndDiceActive && this.state.currentTime >= this.state.sliceAndDiceExpiry) {
         this.state.sliceAndDiceActive = false;
      }
   }

   protected handleResourceGeneration(): void {
      if (this.state.currentTime >= this.state.nextEnergyTick) {
         this.addEnergy(20);
         this.state.nextEnergyTick += 2000;
      }
   }

   protected override printEvent(event: RogueDamageEvent): void {
      const critStr = event.isCrit ? ' (CRIT!)' : '';
      const cpStr = event.comboPointsGained > 0 ? ` [+${event.comboPointsGained} CP]` : '';
      const timestampSeconds = event.timestamp / 1000;
      console.log(`[${timestampSeconds.toFixed(1)}s] ${event.ability}: ${event.damage}${critStr}${cpStr}`);
   }

   protected getStateText(): string {
      const timestampSeconds = this.state.currentTime / 1000;
      const energyBar = this.generateResourceBar(this.state.energy, 100, 20);
      const cpDots = '●'.repeat(this.state.comboPoints) + '○'.repeat(5 - this.state.comboPoints);
      const sndStatus = this.state.sliceAndDiceActive
         ? ` | SnD: ${((this.state.sliceAndDiceExpiry - this.state.currentTime) / 1000).toFixed(1)}s`
         : '';
      return `[${timestampSeconds.toFixed(1)}s] [${energyBar}] ${cpDots}${sndStatus}`;
   }
}
