import {
   Ability,
   Attack,
   AttackResult,
   AttackType,
   Buff,
   ProcEvent,
   RogueBuffEvent,
   RogueDamageEvent,
   RogueSimulationState,
   Weapon,
   WeaponType,
} from '../types';
import {c, isHit} from '../globals';
import {RogueDamageCalculator} from '../mechanics/RogueDamageCalculator';
import {MeleeSimulator} from './MeleeSimulator';
import {PlayerSetup, SimulationSpec} from "../SimulationSpec";
import {RogueTalents} from "../talents";

export const ROGUE = {
   maxEnergy: 100,
   maxEnergyVigor: 110,
   slnDiceIAS: 0.2,
   swordSpecICD: 200, // 200ms ICD between Sword Spec procs
   sealFateICD: 500,  // 500ms ICD between Seal Fate procs
}

export class RogueSimulator extends MeleeSimulator {
   override state: RogueSimulationState;
   override damageCalculator: RogueDamageCalculator;
   override events: (RogueDamageEvent | RogueBuffEvent | ProcEvent)[] = [];
   damageBreakdown: Map<string, number> = new Map();
   setup: PlayerSetup;
   talents: RogueTalents;

   protected strengthPerLevel = 1;
   protected strengthLevel1 = 20;

   protected agilityPerLevel = 2;
   protected attackPowerPerLevel = 2;
   protected agilityLevel1 = 10;

   protected staminaPerLevel = 1;
   protected staminaLevel1 = 15;

   protected spiritPerLevel = 0;
   protected spiritLevel1 = 50;

   protected intellectPerLevel = 0;
   protected intellectLevel1 = 35;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as RogueTalents;
      this.damageCalculator = new RogueDamageCalculator(spec, this, this);
      this.state = this.initializeState();
      this.setup = spec.setup as PlayerSetup ?? {};
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
         swordSpecICD: 0,
         sealFateICD: 0,
         coldBloodCooldown: 0,
      };
   }

   get maxEnergy() {
      return this.talents.vigor ? ROGUE.maxEnergyVigor : ROGUE.maxEnergy;
   }

   override logDamage(ability: string, attackResult: AttackResult, comboPointsGained: number = 0, comboPointsSpent: number = 0): void {
      super.logDamage(ability, attackResult, {
         comboPointsGained,
         comboPointsSpent,
      });
   }

   override activateBuff(buffName: string, duration: number, comboPointsUsed: number): void {
      super.activateBuff(buffName, duration, { comboPointsUsed });
   }

   addEnergy(amount: number): void {
      this.state.energy = Math.round(Math.min(this.maxEnergy, this.state.energy + amount));
      // we don't want special abilities to be cast in the next 200ms to mimic realistic latency
      this.triggerLatencyCooldown();
   }

   getHasteMultiplier(): number {
      return this.isBuffActive(Buff.SnD) ? 1 + ROGUE.slnDiceIAS : 1;
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

   consumeColdBlood(): void {
      if (this.isBuffActive(Buff.ColdBlood)) {
         this.removeBuff(Buff.ColdBlood);
         this.state.coldBloodCooldown = this.state.currentTime + 180000; // 3 min CD
      }
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

      this.activateBuff(Buff.SnD, durationMs, cp);
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
      this.logDamage(Ability.Eviscerate, result, 0, cp);
      this.onFinishingMove();
      this.onMainHandHit(result); // MH triggers
      this.consumeColdBlood();
      this.triggerGlobalCooldown();
      return true;
   }

   castSinisterStrike(): boolean {
      let energyCost = 45;
      if (this.talents.improvedSinisterStrike > 0) {
         const improvedSSCostReduction = this.talents.improvedSinisterStrike == 1 ? 3 : 5;
         energyCost -= improvedSSCostReduction;
      }

      if (!this.spendEnergy(energyCost)) {
         return false;
      }

      const result = this.damageCalculator.calculateSinisterStrikeDamage();
      this.refundIfNeeded(result, energyCost);

      const comboPointsGained = this.handleComboPointGeneration(result);
      this.logDamage(Ability.SinisterStrike, result, comboPointsGained);
      this.onMainHandHit(result); // MH triggers
      this.consumeColdBlood();
      this.triggerGlobalCooldown();
      return true;
   }

   castColdBlood(): boolean {
      if (!this.talents.coldBlood || this.isBuffActive(Buff.ColdBlood)  ) {
         return false;
      }

      if (this.state.currentTime < this.state.coldBloodCooldown) {
         return false;
      }

      // Cold Blood doesn't cost energy and doesn't trigger GCD
      this.activateBuff(Buff.ColdBlood, -1, 0); // -1 for infinite duration (consumed on next attack)
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
      this.logDamage(Ability.Backstab, result, comboPointsGained);
      this.onMainHandHit(result); // MH triggers
      this.consumeColdBlood();
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
      this.logDamage(Ability.Hemorrhage, result, comboPointsGained);
      this.onMainHandHit(result); // MH triggers
      this.consumeColdBlood();
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

      // Seal Fate: chance to gain extra combo point on crit (with 500ms ICD)
      if (result.type === AttackType.Crit && this.talents.sealFate > 0) {
         if (this.state.currentTime >= this.state.sealFateICD) {
            if (Math.random() < (this.talents.sealFate * 0.2)) {
               this.addComboPoint();
               comboPointsGained++;
               this.state.sealFateICD = this.state.currentTime + ROGUE.sealFateICD;
               this.addProc(`Seal Fate ${c.red}●${c.reset}`, true);
            }
         }
      }

      return comboPointsGained;
   }

   private trySwordSpecProc(result: AttackResult, weaponType: WeaponType | undefined, procLabel: string): void {
      if (
         isHit(result) &&
         this.talents.swordSpecialization > 0 &&
         weaponType === WeaponType.Sword &&
         this.state.currentTime >= this.state.swordSpecICD &&
         Math.random() < (this.talents.swordSpecialization * 0.01)
      ) {
         const extraAttack = this.damageCalculator.calculateAutoAttackDamage(false);
         this.logDamage(Ability.Extra, extraAttack);
         this.state.swordSpecICD = this.state.currentTime + ROGUE.swordSpecICD;
         this.addProc(procLabel, true);
      }
   }

   override onMainHandHit(result: AttackResult): void {
      super.onMainHandHit(result);
      this.trySwordSpecProc(result, this.spec.extraStats.mh.type, `EXTRA(main) ${c.yellow}⚔${c.reset}`);
   }

   override onOffHandHit(result: AttackResult): void {
      super.onOffHandHit(result);
      this.trySwordSpecProc(result, this.spec.extraStats.oh?.type, `EXTRA(off) ${c.yellow}⚔${c.reset}`);
   }

   private checkDarkmantle4Proc(result: AttackResult, weapon: Weapon): void {
      if (!this.setup.darkmantle4 || !isHit(result)) {
         return;
      }

      // 1 PPM (Procs Per Minute): proc_chance = weapon_speed / 60
      const procChance = weapon.speed / 60;
      if (Math.random() < procChance) {
         this.addProc(`Darkmantle ${c.yellow}█████${c.reset}`, true);
         this.addEnergy(35);
      }
   }

   override handleAutoAttacks(): void {
      if (this.spec.setup?.disableAutoAttacks)
         return;
      this.processAutoAttacks(
         (result) => {
            this.onMainHandHit(result);
            this.checkDarkmantle4Proc(result, this.spec.extraStats.mh);
            this.logDamage('MH', result);
         },
         (result) => {
            this.onOffHandHit(result);
            if (this.spec.extraStats.oh) {
               this.checkDarkmantle4Proc(result, this.spec.extraStats.oh);
            }
            this.logDamage('OH', result);
         }
      );
   }

   protected checkCondition(cond: string): boolean {
      switch (cond) {
         case 'sndw':
            return this.shouldRefreshSliceAndDice(true);
         case 'snd':
            return this.shouldRefreshSliceAndDice();
         case 'cp0':
            return this.state.comboPoints === 0;
         case 'cp1':
            return this.state.comboPoints === 1;
         case 'cp2':
            return this.state.comboPoints === 2;
         case 'cp3':
            return this.state.comboPoints === 3;
         case 'cp4':
            return this.state.comboPoints === 4;
         case 'cp5':
            return this.state.comboPoints === 5;
         case 'cp1+':
            return this.state.comboPoints >= 1;
         case 'cp2+':
            return this.state.comboPoints >= 2;
         case 'cp3+':
            return this.state.comboPoints >= 3;
         case 'cp4+':
            return this.state.comboPoints >= 4;
         default:
            return false;
      }
   }

   protected executeCommand(cmd: string): boolean {
      switch (cmd) {
         case Ability.Eviscerate:
            return this.castEviscerate();
         case Ability.SinisterStrike:
            return this.castSinisterStrike();
         case Ability.Backstab:
            return this.castBackstab();
         case Ability.Hemorrhage:
            return this.castHemorrhage();
         case Ability.SliceAndDice:
            return this.castSliceAndDice();
         case Ability.ColdBlood:
            return this.castColdBlood();
         case Ability.AddCombo:
            this.addComboPoint();
            return true;
         case Ability.Set1Combo:
            this.state.comboPoints = 1;
            return true;
         case Ability.Set2Combo:
            this.state.comboPoints = 2;
            return true;
         case Ability.Set3Combo:
            this.state.comboPoints = 3;
            return true;
         case Ability.Set4Combo:
            this.state.comboPoints = 4;
            return true;
         case Ability.Set5Combo:
            this.state.comboPoints = 5;
            return true;
         case Ability.Energy1:
            this.state.energy = 20;
            return true;
         case Ability.Energy2:
            this.state.energy = 40;
            return true;
         case Ability.Energy3:
            this.state.energy = 60;
            return true;
         case Ability.Energy4:
            this.state.energy = 80;
            return true;
         case Ability.Energy5:
            this.state.energy = 100;
            return true;
         case Ability.Skip:
            return true;
         default:
            return false;
      }
   }

   executeHardcodedRotation(): void {
      if (this.state.comboPoints === 5) {
         if (!this.setup.prefer5EvisOverSnd && this.shouldRefreshSliceAndDice()) {
            this.castSliceAndDice();
         } else {
            this.castEviscerate();
         }
      } else {
         if (this.shouldRefreshSliceAndDice(true)) {
            if (this.shouldRefreshSliceAndDice())
               this.castSliceAndDice();
         } else if (this.talents.hemorrhage) {
            this.castHemorrhage();
         } else if (this.spec.extraStats.mh.type === WeaponType.Dagger) {
            this.castBackstab();
         } else {
            this.castSinisterStrike();
         }
      }
   }

   shouldRefreshSliceAndDice(waitCheck?: boolean): boolean {
      if (this.state.comboPoints == 0)
         return false;
      if (!this.isBuffActive(Buff.SnD))
         return true;
      const timeRemainingMs = this.getBuffTimeRemaining(Buff.SnD);
      let timeBefore = this.setup.refreshSndSecondsBeforeExpiry ?? 0.2;
      if (waitCheck && this.setup.waitForSndExpiry)
         timeBefore = this.setup.waitForSndExpiry;
      const refreshThresholdMs = (timeBefore) * 1000;
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

   // -- player stats provider

   get hitChance(): number {
      return super.hitChance + (this.talents?.precision || 0);
   }

   get weaponSkill(): number {
      let baseSkill = super.weaponSkill;

      if ((this.talents?.weaponExpertise || 0) > 0) {
         const mainHandType = this.spec.extraStats.mh.type;
         if (mainHandType === WeaponType.Sword ||
            mainHandType === WeaponType.Fist ||
            mainHandType === WeaponType.Dagger) {
            baseSkill += this.talents.weaponExpertise === 1 ? 3 : 5;
         }
      }

      return baseSkill;
   }

   get agilityToCrit() {
      return this.agility * 0.03598726;
   }

   get critFromTalents(): number {
      return this.talents.malice;
   }

   attackCritChance(attack?: Attack): number {
      let critChance = super.attackCritChance(attack);
      if (attack && this.talents.daggerSpecialization > 0 && attack.weapon.type === WeaponType.Dagger) {
         critChance += this.talents.daggerSpecialization;
      }

      // Add ability-specific crit bonuses
      if (attack?.ability === Ability.Backstab && this.talents.improvedBackstab > 0) {
         critChance += this.talents.improvedBackstab * 10;
      }

      // Cold Blood: 100% crit on next Sinister Strike, Backstab, Ambush, Hemorrhage, or Eviscerate
      if (attack && this.isBuffActive(Buff.ColdBlood)) {
         if (attack.ability === Ability.SinisterStrike ||
             attack.ability === Ability.Backstab ||
             attack.ability === Ability.Hemorrhage ||
             attack.ability === Ability.Eviscerate) {
            critChance = 100;
         }
      }

      return critChance;
   }
}
