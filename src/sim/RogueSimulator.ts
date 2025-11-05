import {
   AttackResult,
   AttackType,
   Buffs,
   c,
   ProcEvent,
   RogueBuffEvent,
   RogueDamageEvent,
   RogueSimulationState,
   RogueTalents,
   SimulationSetup,
   WeaponType,
} from '../types';
import {SimulationSpec} from '../SpecLoader';
import {RogueDamageCalculator} from '../mechanics/RogueDamageCalculator';
import {MeleeSimulator} from './MeleeSimulator';

export enum RogueAbility {
   Eviscerate = 'evis',
   SinisterStrike = 'ss',
   Backstab = 'bs',
   Hemorrhage = 'hemo',
   SliceAndDice = 'snd',
   AddCombo = 'cp',
   Set1Combo = 'cp1',
   Set2Combo = 'cp2',
   Set3Combo = 'cp3',
   Set4Combo = 'cp4',
   Set5Combo = 'cp5',
   Energy1 = 'energy1',
   Energy2 = 'energy2',
   Energy3 = 'energy3',
   Energy4 = 'energy4',
   Energy5 = 'energy5',
}

export const ROGUE = {
   maxEnergy: 100,
   maxEnergyVigor: 110,
   slnDiceIAS: 0.2,
}

export class RogueSimulator extends MeleeSimulator {
   override state: RogueSimulationState;
   override damageCalculator: RogueDamageCalculator;
   override events: (RogueDamageEvent | RogueBuffEvent | ProcEvent)[] = [];
   damageBreakdown: Map<string, number> = new Map();
   setup: SimulationSetup;
   talents: RogueTalents;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as RogueTalents;
      this.damageCalculator = new RogueDamageCalculator(spec, this);
      this.state = this.initializeState();
      this.setup = spec.setup as SimulationSetup ?? {
         refreshSndSecondsAhead5Combo: 3,
      };
   }

   initializeState(): RogueSimulationState {
      return {
         currentTime: 0,
         energy: this.maxEnergy,
         comboPoints: 0,
         targetHealth: 999999999,
         mainHandNextSwing: 0,
         offHandNextSwing: 0,
         globalCooldownExpiry: 0,
         nextEnergyTick: 2000,
         activeBuffs: [],
      };
   }

   get maxEnergy() {
      return this.talents.vigor ? ROGUE.maxEnergyVigor : ROGUE.maxEnergy;
   }

   override addDamage(ability: string, attackResult: AttackResult, comboPointsGained: number = 0, comboPointsSpent: number = 0): void {
      super.addDamage(ability, attackResult, {
         comboPointsGained,
         comboPointsSpent,
      });
   }

   addRogueBuff(buffName: string, duration: number, comboPointsUsed: number): void {
      super.addBuff(buffName, duration, { comboPointsUsed });
      this.activateBuff(buffName, duration);
   }

   addEnergy(amount: number): void {
      this.state.energy = Math.round(Math.min(this.maxEnergy, this.state.energy + amount));
   }

   getHasteMultiplier(): number {
      return this.isBuffActive(Buffs.SnD) ? 1 + ROGUE.slnDiceIAS : 1;
   }

   spendEnergy(amount: number): boolean {
      if (this.state.energy >= amount) {
         this.state.energy -= amount;
         return true;
      }
      return false;
   }

   refundIfNeeded(result: AttackResult, energyCost: number): void {
      if (result.type === AttackType.Miss || result.type === AttackType.Dodge) {
         this.addEnergy(energyCost * 0.8);
      }
   }

   addComboPoint(): void {
      if (this.state.comboPoints < 5) {
         this.state.comboPoints++;
      }
   }

   spendComboPoints(): number {
      const cp = this.state.comboPoints;
      this.state.comboPoints = 0;
      return cp;
   }

   onFinishingMove(): void {
      if (this.talents.ruthlessness > 0) {
         const chance = this.talents.ruthlessness * 0.2; // 20% per rank
         if (Math.random() < chance) {
            this.addProc(`Ruthlessness ${c.red}●${c.reset}`);
            this.addComboPoint();
         }
      }
      if (this.talents.relentlessStrikes) {
         if (Math.random() < (this.state.comboPoints * 0.2)) {
            this.addProc(`Relentless strike ${c.yellow}█████${c.reset}`)
            this.addEnergy(25);
         }
      }
   }

   castSliceAndDice(): boolean {
      let energyCost = 25;

      if (this.setup.veiledShadowsSet)
         energyCost -= 10;

      if (!this.spendEnergy(energyCost))
         return false;

      const cp = this.spendComboPoints();
      const baseDuration = 6 + (cp * 3);
      const improvedSndBonus = this.talents.improvedSliceAndDice * 0.15;
      const durationSeconds = baseDuration * (1 + improvedSndBonus);
      const durationMs = durationSeconds * 1000;

      this.addRogueBuff(Buffs.SnD, durationMs, cp);
      this.onFinishingMove();
      this.triggerGlobalCooldown();
      return true;
   }

   castEviscerate(): boolean {
      if (this.setup.avoidEviscerate || !this.state.comboPoints || !this.spendEnergy(35)) {
         return false;
      }
      const cp = this.spendComboPoints();
      const result = this.damageCalculator.calculateEviscerateDamage(cp);
      this.addDamage(RogueAbility.Eviscerate, result, 0, cp);
      this.onFinishingMove();
      this.triggerGlobalCooldown();
      return true;
   }

   castSinisterStrike(): boolean {
      let energyCost = 45;
      const improvedSSCostReduction = this.talents.improvedSinisterStrike * 2;
      energyCost -= improvedSSCostReduction;

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const result = this.damageCalculator.calculateSinisterStrikeDamage();
      this.refundIfNeeded(result, energyCost);

      const comboPointsGained = this.handleComboPointGeneration(result);
      this.addDamage(RogueAbility.SinisterStrike, result, comboPointsGained);
      this.triggerGlobalCooldown();
      return true;
   }

   castBackstab(): boolean {
      const energyCost = 60;

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const result = this.damageCalculator.calculateBackstabDamage();
      this.refundIfNeeded(result, energyCost);

      const comboPointsGained = this.handleComboPointGeneration(result);
      this.addDamage(RogueAbility.Backstab, result, comboPointsGained);
      this.triggerGlobalCooldown();
      return true;
   }

   castHemorrhage(): boolean {
      let energyCost = 35;

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const result = this.damageCalculator.calculateHemorrhageDamage();
      this.refundIfNeeded(result, energyCost);

      const comboPointsGained = this.handleComboPointGeneration(result);
      this.addDamage(RogueAbility.Hemorrhage, result, comboPointsGained);
      this.triggerGlobalCooldown();
      return true;
   }

   handleComboPointGeneration(result: AttackResult): number {
      if (result.amount <= 0) {
         return 0;
      }

      let comboPointsGained = 0;

      this.addComboPoint();
      comboPointsGained++;

      // Seal Fate: chance to gain extra combo point on crit
      if (result.type === AttackType.Crit && this.talents.sealFate > 0) {
         if (Math.random() < (this.talents.sealFate * 0.2)) {
            this.addComboPoint();
            comboPointsGained++;
         }
      }

      return comboPointsGained;
   }

   onMainHandHit(result: AttackResult): void {
      if (result.amount > 0 &&
         this.talents.swordSpecialization > 0 &&
         this.spec.gearStats.mainHandWeapon.type === WeaponType.Sword &&
         Math.random() < (this.talents.swordSpecialization * 0.01)) {
         this.addDamage('EXTRA', result);
      }
   }

   protected executeCommand(cmd: string): boolean {
      switch (cmd) {
         case RogueAbility.Eviscerate:
            return this.castEviscerate();
         case RogueAbility.SinisterStrike:
            return this.castSinisterStrike();
         case RogueAbility.Backstab:
            return this.castBackstab();
         case RogueAbility.Hemorrhage:
            return this.castHemorrhage();
         case RogueAbility.SliceAndDice:
            return this.castSliceAndDice();
         case RogueAbility.AddCombo:
            this.addComboPoint();
            return true;
         case RogueAbility.Set1Combo:
            this.state.comboPoints = 1;
            return true;
         case RogueAbility.Set2Combo:
            this.state.comboPoints = 2;
            return true;
         case RogueAbility.Set3Combo:
            this.state.comboPoints = 3;
            return true;
         case RogueAbility.Set4Combo:
            this.state.comboPoints = 4;
            return true;
         case RogueAbility.Set5Combo:
            this.state.comboPoints = 5;
            return true;
         case RogueAbility.Energy1:
            this.state.energy = 20;
            return true;
         case RogueAbility.Energy2:
            this.state.energy = 40;
            return true;
         case RogueAbility.Energy3:
            this.state.energy = 60;
            return true;
         case RogueAbility.Energy4:
            this.state.energy = 80;
            return true;
         case RogueAbility.Energy5:
            this.state.energy = 100;
            return true;
         default:
            return false;
      }
   }

   executeHardcodedRotation(): void {
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
         if (!this.isBuffActive(Buffs.SnD) && this.state.comboPoints > 0) {
            this.castSliceAndDice();
         } else if (this.talents.hemorrhage) {
            this.castHemorrhage();
         } else if (this.spec.gearStats.mainHandWeapon.type === WeaponType.Dagger) {
            this.castBackstab();
         } else {
            this.castSinisterStrike();
         }
      }
   }

   shouldRefreshSliceAndDice(): boolean {
      if (!this.isBuffActive(Buffs.SnD)) {
         return true;
      }
      const timeRemainingMs = this.getBuffTimeRemaining(Buffs.SnD);
      const refreshThresholdMs = (this.setup.refreshSndSecondsAhead5Combo ?? 1) * 1000;
      return timeRemainingMs < refreshThresholdMs;
   }

   updateBuffs(): void {
      this.removeExpiredBuffs();
   }

   handleResourceGeneration(): void {
      if (this.state.currentTime >= this.state.nextEnergyTick) {
         this.addEnergy(20);
         this.state.nextEnergyTick += 2000;
      }
   }

   override getPrintDamageEventExtra(event: RogueDamageEvent): string {
      let extra = '';
      if (event.comboPointsSpent > 0) {
         extra += ` ${'○'.repeat(event.comboPointsSpent)}`;
      }
      if (event.comboPointsGained > 0) {
         extra += ` ${c.red}${'●'.repeat(event.comboPointsGained)}${c.reset}`;
      }
      return extra;
   }

   override getPrintBuffEventExtra(event: RogueBuffEvent): string {
      if (event.comboPointsUsed > 0) {
         return ` ${'○'.repeat(event.comboPointsUsed)}`;
      }
      return '';
   }

   getStateText(): string {
      const timestampSeconds = this.state.currentTime / 1000;
      const energyBar = this.generateResourceBar(this.state.energy, this.maxEnergy, 20);
      const cpDots = c.red + '●'.repeat(this.state.comboPoints) + c.reset + '○'.repeat(5 - this.state.comboPoints);
      const buffsStatus = this.getBuffsStatusText();
      return `[${timestampSeconds.toFixed(1)}s] [${energyBar}] ${this.state.energy} ${cpDots}${buffsStatus}`;
   }
}
