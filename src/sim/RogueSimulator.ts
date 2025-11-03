import {
   AttackResult,
   AttackType,
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

   private addRogueDamage(ability: string, attackResult: AttackResult, comboPointsGained: number = 0): void {
      if (attackResult.amount > 0) {
         this.events.push({
            ...attackResult,
            timestamp: this.state.currentTime,
            ability,
            comboPointsGained,
         });

         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + attackResult.amount);
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
      const result = this.damageCalculator.calculateEviscerateDamage(cp);
      this.addDamage('Eviscerate', result);
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

      const result = this.damageCalculator.calculateSinisterStrikeDamage();

      this.handleComboPointGeneration(result);
      this.addRogueDamage('Sinister Strike', result, 1);
      this.triggerGlobalCooldown();
      return true;
   }

   private castBackstab(): boolean {
      if (!this.spendEnergy(60)) {
         return false;
      }

      const result = this.damageCalculator.calculateBackstabDamage();

      this.handleComboPointGeneration(result);
      this.addRogueDamage('Backstab', result, 1);
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

      const result = this.damageCalculator.calculateHemorrhageDamage();

      this.handleComboPointGeneration(result);
      this.addRogueDamage('Hemorrhage', result, 1);
      this.triggerGlobalCooldown();
      return true;
   }

   private handleComboPointGeneration(result: AttackResult): void {
      if (result.amount <= 0) {
         return;
      }

      this.addComboPoint();

      // Seal Fate: chance to gain extra combo point on crit
      if (result.type === AttackType.Crit && this.talents.sealFate > 0) {
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

   protected onMainHandHit(result: AttackResult): void {
      if (this.talents.swordSpecialization > 0 &&
         this.stats.mainHandWeapon.type === WeaponType.Sword &&
         Math.random() < (this.talents.swordSpecialization * 0.01)) {
         this.addDamage('Extra Attack (Sword Spec)', result);
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

   protected override getPrintEventExtra(event: RogueDamageEvent): string {
      return event.comboPointsGained > 0 ? ` [+${event.comboPointsGained} CP]` : '';
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
