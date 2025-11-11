import {BaseSimulator} from './BaseSimulator';
import {Ability, ShamanSimulationState, ShamanTalents, SimulationResult} from '../types';
import {SimulationSpec} from '../SpecLoader';
import {ShamanHealingCalculator} from '../mechanics/ShamanHealingCalculator';
import {c} from '../globals';

const MANA_TICK_INTERVAL = 2000; // 2 seconds
const GLOBAL_COOLDOWN = 1500; // 1.5 seconds
const TANK_DAMAGE_PER_SECOND = 500; // Simulated incoming DPS

export class ShamanSimulator extends BaseSimulator {
   protected state: ShamanSimulationState;
   protected healingCalculator: ShamanHealingCalculator;
   protected damageCalculator: ShamanHealingCalculator;
   protected talents: ShamanTalents;

   protected strengthToAttackPower = 2;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as ShamanTalents;
      this.healingCalculator = new ShamanHealingCalculator(spec, this);
      this.damageCalculator = this.healingCalculator;
      this.state = this.initializeState();
   }

   protected initializeState(): ShamanSimulationState {
      const maxMana = this.getMaxMana();
      const targetMaxHealth = 10000; // Tank has 10k HP

      return {
         currentTime: 0,
         targetHealth: 10000000, // Not used for healing sim
         globalCooldownExpiry: 0,
         activeBuffs: [],
         mana: maxMana,
         currentCastEnd: 0,
         castingSpell: null,
         nextManaTick: MANA_TICK_INTERVAL,
         totalHealing: 0,
         overhealing: 0,
         targetCurrentHealth: targetMaxHealth,
         targetMaxHealth: targetMaxHealth,
         naturesSwiftnessCooldown: 0,
         manaTideCooldown: 0,
      };
   }

   private getMaxMana(): number {
      const baseMana = this.spec.gearStats.mana || 4300;
      const intellectBonus = (this.spec.gearStats.intellect || 0) * 15;
      let maxMana = baseMana + intellectBonus;

      // Ancestral Knowledge talent (+1% max mana per rank)
      if (this.talents.ancestralKnowledge > 0) {
         maxMana *= 1 + (this.talents.ancestralKnowledge * 0.01);
      }

      return Math.round(maxMana);
   }

   private getManaRegen(): number {
      const spirit = this.spec.gearStats.spirit || 0;
      const mp5 = this.spec.gearStats.mp5 || 0;

      // Spirit regen
      const baseRegen = (spirit / 5) * (MANA_TICK_INTERVAL / 1000);

      // MP5 contribution
      const mp5Regen = mp5 * (MANA_TICK_INTERVAL / 5000);

      return Math.round(baseRegen + mp5Regen);
   }

   protected processTimeStep(): void {
      this.handleManaRegeneration();
      this.handleTankDamage();
      this.handleCasting();
      this.updateBuffs();
      this.executeRotation();
   }

   private handleManaRegeneration(): void {
      if (this.state.currentTime >= this.state.nextManaTick) {
         const regen = this.getManaRegen();
         this.state.mana = Math.min(this.state.mana + regen, this.getMaxMana());
         this.state.nextManaTick = this.state.currentTime + MANA_TICK_INTERVAL;
      }
   }

   private handleTankDamage(): void {
      // Simulate tank taking damage over time
      const damagePerTick = (TANK_DAMAGE_PER_SECOND * 10) / 1000; // 10ms tick
      this.state.targetCurrentHealth = Math.max(0, this.state.targetCurrentHealth - damagePerTick);

      // If tank dies, reset for continued simulation
      if (this.state.targetCurrentHealth <= 0) {
         this.state.targetCurrentHealth = this.state.targetMaxHealth * 0.5; // Reset to 50%
      }
   }

   private handleCasting(): void {
      if (this.state.castingSpell && this.state.currentTime >= this.state.currentCastEnd) {
         this.finishCast();
      }
   }

   private isCasting(): boolean {
      return this.state.castingSpell !== null && this.state.currentTime < this.state.currentCastEnd;
   }

   private finishCast(): void {
      if (!this.state.castingSpell) {
         return;
      }

      const spell = this.state.castingSpell;
      this.state.castingSpell = null;

      let result;
      switch (spell) {
         case Ability.HealingWave:
            result = this.healingCalculator.calculateHealingWave(
               this.state.targetCurrentHealth,
               this.state.targetMaxHealth
            );
            this.applyHealing(Ability.HealingWave, result);
            break;

         case Ability.LesserHealingWave:
            result = this.healingCalculator.calculateLesserHealingWave(
               this.state.targetCurrentHealth,
               this.state.targetMaxHealth
            );
            this.applyHealing(Ability.LesserHealingWave, result);
            break;

         case Ability.ChainHeal:
            // Chain heal hits 3 targets, but we'll simulate as 3 separate heals on the same target
            // with diminishing returns
            for (let i = 0; i < 3; i++) {
               result = this.healingCalculator.calculateChainHeal(
                  this.state.targetCurrentHealth,
                  this.state.targetMaxHealth,
                  i
               );
               this.applyHealing(Ability.ChainHeal, result, i === 0); // Only log first jump
            }
            break;

         default:
            break;
      }

      // Consume Nature's Swiftness
      if (this.hasBuff('NaturesSwiftness')) {
         this.deactivateBuff('NaturesSwiftness');
      }
   }

   private applyHealing(ability: Ability, result: any, shouldLog: boolean = true): void {
      this.state.targetCurrentHealth = Math.min(
         this.state.targetMaxHealth,
         this.state.targetCurrentHealth + result.effectiveHealing
      );

      this.state.totalHealing += result.effectiveHealing;
      this.state.overhealing += result.overhealing;

      // Track healing using base class method
      this.trackHealing(ability, result, shouldLog);
   }

   private startCast(spell: Ability, castTime: number): boolean {
      const cost = this.healingCalculator.getManaCost(spell);

      if (this.state.mana < cost) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.state.mana -= cost;
      this.state.castingSpell = spell;
      this.state.currentCastEnd = this.state.currentTime + castTime;
      this.state.globalCooldownExpiry = this.state.currentTime + castTime + GLOBAL_COOLDOWN;

      return true;
   }

   private castHealingWave(): boolean {
      const castTime = this.healingCalculator.getHealingWaveCastTime();
      return this.startCast(Ability.HealingWave, castTime);
   }

   private castLesserHealingWave(): boolean {
      const castTime = this.healingCalculator.getLesserHealingWaveCastTime();
      return this.startCast(Ability.LesserHealingWave, castTime);
   }

   private castChainHeal(): boolean {
      const castTime = this.healingCalculator.getChainHealCastTime();
      return this.startCast(Ability.ChainHeal, castTime);
   }

   private useNaturesSwiftness(): boolean {
      if (this.state.currentTime < this.state.naturesSwiftnessCooldown || !this.talents.naturesSwiftness) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.activateBuff('NaturesSwiftness', 999999); // Lasts until consumed
      this.addProc(`Nature's Swiftness ${c.green}↑${c.reset}`, false);
      this.state.naturesSwiftnessCooldown = this.state.currentTime + 180000; // 3min CD
      this.state.globalCooldownExpiry = this.state.currentTime + GLOBAL_COOLDOWN;

      return true;
   }

   protected executeHardcodedRotation(): void {
      // Default healing rotation: prioritize based on tank health
      const healthPercent = (this.state.targetCurrentHealth / this.state.targetMaxHealth) * 100;

      if (healthPercent < 40) {
         // Emergency: use Nature's Swiftness + Healing Wave
         if (!this.hasBuff('NaturesSwiftness') && this.state.currentTime >= this.state.naturesSwiftnessCooldown) {
            this.useNaturesSwiftness();
         } else {
            this.castHealingWave();
         }
      } else if (healthPercent < 70) {
         // Use Chain Heal or Lesser Healing Wave
         if (Math.random() > 0.5) {
            this.castChainHeal();
         } else {
            this.castLesserHealingWave();
         }
      } else {
         // Top off with Lesser Healing Wave
         this.castLesserHealingWave();
      }
   }

   protected executeCommand(cmd: string): boolean {
      switch (cmd) {
         case Ability.HealingWave:
            return this.castHealingWave();
         case Ability.LesserHealingWave:
            return this.castLesserHealingWave();
         case Ability.ChainHeal:
            return this.castChainHeal();
         case Ability.NaturesSwiftness:
            return this.useNaturesSwiftness();
         default:
            return false;
      }
   }

   protected checkCondition(cond: string): boolean {
      // Check buff conditions
      if (cond.startsWith('buff:')) {
         const buffName = cond.substring(5);
         return this.hasBuff(buffName);
      }

      // Check health percentage
      if (cond.startsWith('hp<')) {
         const threshold = parseInt(cond.substring(3));
         const healthPercent = (this.state.targetCurrentHealth / this.state.targetMaxHealth) * 100;
         return healthPercent < threshold;
      }

      if (cond.startsWith('hp>')) {
         const threshold = parseInt(cond.substring(3));
         const healthPercent = (this.state.targetCurrentHealth / this.state.targetMaxHealth) * 100;
         return healthPercent > threshold;
      }

      // Check mana percentage
      if (cond.startsWith('mana>')) {
         const threshold = parseInt(cond.substring(5));
         const manaPercent = (this.state.mana / this.getMaxMana()) * 100;
         return manaPercent > threshold;
      }

      if (cond.startsWith('mana<')) {
         const threshold = parseInt(cond.substring(5));
         const manaPercent = (this.state.mana / this.getMaxMana()) * 100;
         return manaPercent < threshold;
      }

      return false;
   }

   protected updateBuffs(): void {
      const currentTime = this.state.currentTime;

      for (let i = this.state.activeBuffs.length - 1; i >= 0; i--) {
         const buff = this.state.activeBuffs[i];

         if (currentTime >= buff.expiry) {
            this.state.activeBuffs.splice(i, 1);
            this.logBuffDrop(buff.name);
         }
      }
   }

   protected override canCastAbility(): boolean {
      if (this.isCasting()) {
         return false;
      }

      return super.canCastAbility();
   }

   hasBuff(name: string): boolean {
      return this.state.activeBuffs.some(buff => buff.name === name);
   }

   protected activateBuff(name: string, duration: number): void {
      const existingBuff = this.state.activeBuffs.find(b => b.name === name);
      const expiry = this.state.currentTime + duration;

      if (existingBuff) {
         existingBuff.expiry = expiry;
      } else {
         this.state.activeBuffs.push({name, expiry});
         this.logBuff(name, duration);
      }
   }

   protected deactivateBuff(name: string): void {
      const index = this.state.activeBuffs.findIndex(b => b.name === name);
      if (index !== -1) {
         this.state.activeBuffs.splice(index, 1);
         this.logBuffDrop(name);
      }
   }


   simulate(): SimulationResult {
      this.prepareSimulation();

      const fightLength = this.spec.fightLength * 1000;

      while (this.state.currentTime < fightLength) {
         this.processTimeStep();
         this.advanceTime();
      }

      return this.getSimulationResult();
   }

   runMultipleIterations(): { results: SimulationResult[]; executionTimeMs: number } {
      const results: SimulationResult[] = [];
      const startTime = Date.now();

      for (let i = 0; i < this.spec.iterations; i++) {
         results.push(this.simulate());
      }

      const executionTimeMs = Date.now() - startTime;

      return {results, executionTimeMs};
   }

   get playerLevel(): number {
      return this.spec.playerLevel;
   }

   get targetLevel(): number {
      return this.spec.targetLevel;
   }

   get weaponSkill(): number {
      return 0;
   }

   get attackPower(): number {
      return 0;
   }

   get hitChance(): number {
      return 0;
   }

   get isDualWielding(): boolean {
      return false;
   }

   get haste(): number {
      return 1.0;
   }

   critChance(): number {
      return 0;
   }

   protected getStateText(): string {
      const timestampSeconds = this.state.currentTime / 1000;
      const manaBar = this.generateResourceBar(this.state.mana, this.getMaxMana(), 20, c.blue);
      const healthBar = this.generateResourceBar(this.state.targetCurrentHealth, this.state.targetMaxHealth, 15, c.green);

      const castingText = this.isCasting() ? ` ${c.yellow}[CASTING ${this.state.castingSpell}]${c.reset}` : '';

      return `${c.gray}${timestampSeconds.toFixed(1)}s${c.reset} Mana: ${manaBar} | Tank HP: ${healthBar}${castingText}`;
   }
}
