import {BaseSimulator} from './BaseSimulator';
import {Ability, AttackType, Buff, MageSimulationState, MageTalents, SimulationResult,} from '../types';
import {SimulationSpec} from '../SpecLoader';
import {MageDamageCalculator} from '../mechanics/MageDamageCalculator';
import {c} from '../globals';

const MANA_TICK_INTERVAL = 2000; // 2 seconds
const GLOBAL_COOLDOWN = 1500; // 1.5 seconds

export class MageSimulator extends BaseSimulator {
   protected state: MageSimulationState;
   protected damageCalculator: MageDamageCalculator;
   protected talents: MageTalents;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as MageTalents;
      this.damageCalculator = new MageDamageCalculator(spec, this);
      this.state = this.initializeState();
   }

   protected initializeState(): MageSimulationState {
      const maxMana = this.getMaxMana();

      return {
         currentTime: 0,
         targetHealth: 10000000,
         globalCooldownExpiry: 0,
         activeBuffs: [],
         mana: maxMana,
         currentCastEnd: 0,
         castingSpell: null,
         nextManaTick: MANA_TICK_INTERVAL,
         combustionStacks: 0,
         improvedScorchStacks: 0,
         igniteStacks: 0,
         fireBlastCooldown: 0,
         arcanePowerCooldown: 0,
         combustionCooldown: 0,
         presenceOfMindCooldown: 0,
         evocationCooldown: 0,
         iceBarrierCooldown: 0,
      };
   }

   private getMaxMana(): number {
      const baseMana = this.spec.gearStats.mana || 3500;
      const intellectBonus = (this.spec.gearStats.intellect || 0) * 15;
      let maxMana = baseMana + intellectBonus;

      // Arcane Mind talent
      if (this.talents.arcaneMind > 0) {
         maxMana *= 1 + (this.talents.arcaneMind * 0.02);
      }

      return Math.round(maxMana);
   }

   private getManaRegen(): number {
      const spirit = this.spec.gearStats.spirit || 0;
      const baseRegen = (spirit / 5) * (MANA_TICK_INTERVAL / 1000);

      let regen = baseRegen;

      // Arcane Meditation allows regen while casting
      if (this.isCasting() && this.talents.arcaneMeditation > 0) {
         regen *= this.talents.arcaneMeditation * 0.05;
      }

      // Mage Armor provides +30% spirit regen while casting
      if (this.isCasting() && this.hasBuff('MageArmor')) {
         regen *= 1.3;
      }

      return Math.round(regen);
   }

   protected processTimeStep(): void {
      this.handleManaRegeneration();
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
         case Ability.Fireball:
            result = this.damageCalculator.calculateFireballDamage();
            this.logDamage(Ability.Fireball, result);
            this.handleFireSpellEffects(result);
            break;

         case Ability.Frostbolt:
            result = this.damageCalculator.calculateFrostboltDamage();
            this.logDamage(Ability.Frostbolt, result);
            break;

         case Ability.Scorch:
            result = this.damageCalculator.calculateScorchDamage();
            this.logDamage(Ability.Scorch, result);
            this.handleScorchEffects(result);
            this.handleFireSpellEffects(result);
            break;

         default:
            break;
      }

      // Consume Presence of Mind
      if (this.hasBuff('PresenceOfMind')) {
         this.deactivateBuff(Buff.PresenceOfMind);
      }

      // Consume Clearcasting
      if (this.hasBuff('Clearcast')) {
         this.deactivateBuff(Buff.Clearcast);
      }
   }

   private handleFireSpellEffects(result: any): void {
      if (result.type !== AttackType.Crit) {
         return;
      }

      // Handle Ignite
      if (this.talents.ignite) {
         this.applyIgnite(result.amount * 0.4);
      }

      // Handle Combustion
      if (this.hasBuff('Combustion')) {
         this.state.combustionStacks = Math.max(0, this.state.combustionStacks - 1);
         if (this.state.combustionStacks === 0) {
            this.deactivateBuff(Buff.Combustion);
         }
      }

      // Handle Master of Elements (mana refund on crit)
      if (this.talents.masterOfElements > 0 && this.state.castingSpell) {
         const baseCost = this.damageCalculator.getManaCost(this.state.castingSpell);
         const refund = baseCost * (this.talents.masterOfElements * 0.1);
         this.state.mana = Math.min(this.state.mana + refund, this.getMaxMana());
      }
   }

   private handleScorchEffects(result: any): void {
      if (result.type === AttackType.Miss) {
         return;
      }

      // Improved Scorch application
      if (this.talents.improvedScorch > 0) {
         const procChance = this.talents.improvedScorch * 0.33;
         if (Math.random() < procChance && this.state.improvedScorchStacks < 5) {
            this.state.improvedScorchStacks++;
            this.activateBuff(Buff.ImprovedScorch, 30000);
            this.addProc(`Improved Scorch (${this.state.improvedScorchStacks})`, true);
         }
      }
   }

   private applyIgnite(damage: number): void {
      if (this.state.igniteStacks < 5) {
         this.state.igniteStacks++;
      }

      this.activateBuff(Buff.Ignite, 4000);
      // TODO: Implement Ignite ticking damage
   }

   private startCast(spell: Ability, castTime: number): boolean {
      const cost = this.damageCalculator.getManaCost(spell);

      if (this.state.mana < cost) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.state.mana -= cost;
      this.state.castingSpell = spell;
      this.state.currentCastEnd = this.state.currentTime + castTime;
      // GCD starts after the cast finishes
      this.state.globalCooldownExpiry = this.state.currentTime + castTime + GLOBAL_COOLDOWN;

      return true;
   }

   private castFireball(): boolean {
      const castTime = this.damageCalculator.getFireballCastTime();
      return this.startCast(Ability.Fireball, castTime);
   }

   private castFrostbolt(): boolean {
      const castTime = this.damageCalculator.getFrostboltCastTime();
      return this.startCast(Ability.Frostbolt, castTime);
   }

   private castScorch(): boolean {
      const castTime = this.damageCalculator.getScorchCastTime();
      return this.startCast(Ability.Scorch, castTime);
   }

   private castFireBlast(): boolean {
      if (this.state.currentTime < this.state.fireBlastCooldown) {
         return false;
      }

      const cost = this.damageCalculator.getManaCost(Ability.FireBlast);
      if (this.state.mana < cost) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.state.mana -= cost;
      const result = this.damageCalculator.calculateFireBlastDamage();
      this.logDamage(Ability.FireBlast, result);
      this.handleFireSpellEffects(result);

      this.state.fireBlastCooldown = this.state.currentTime + 8000;
      this.state.globalCooldownExpiry = this.state.currentTime + GLOBAL_COOLDOWN;

      return true;
   }

   private useArcanePower(): boolean {
      if (this.state.currentTime < this.state.arcanePowerCooldown || !this.talents.arcanePower) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.activateBuff(Buff.ArcanePower, 15000);
      this.addProc(`Arcane Power ${c.cyan}↑${c.reset}`, false);
      this.state.arcanePowerCooldown = this.state.currentTime + 180000;
      this.state.globalCooldownExpiry = this.state.currentTime + GLOBAL_COOLDOWN;

      return true;
   }

   private useCombustion(): boolean {
      if (this.state.currentTime < this.state.combustionCooldown || !this.talents.combustion) {
         return false;
      }

      if (!this.canCastAbility()) {
         return false;
      }

      this.state.combustionStacks = 3;
      this.activateBuff(Buff.Combustion, 999999); // Lasts until consumed
      this.addProc(`Combustion ${c.cyan}↑↑↑${c.reset}`, false);
      this.state.combustionCooldown = this.state.currentTime + 180000;
      this.state.globalCooldownExpiry = this.state.currentTime + GLOBAL_COOLDOWN;

      return true;
   }

   protected executeHardcodedRotation(): void {
      // Simple fireball spam rotation
      this.castFireball();
   }

   protected executeCommand(cmd: string): boolean {
      switch (cmd) {
         case Ability.Fireball:
            return this.castFireball();
         case Ability.Frostbolt:
            return this.castFrostbolt();
         case Ability.Scorch:
            return this.castScorch();
         case Ability.FireBlast:
            return this.castFireBlast();
         case Ability.ArcanePower:
            return this.useArcanePower();
         case Ability.Combustion:
            return this.useCombustion();
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

      // Check cooldown conditions
      if (cond.startsWith('cd:')) {
         const cdName = cond.substring(3);
         switch (cdName) {
            case 'fb':
            case 'fireblast':
               return this.state.currentTime >= this.state.fireBlastCooldown;
            case 'ap':
               return this.state.currentTime >= this.state.arcanePowerCooldown;
            case 'combustion':
               return this.state.currentTime >= this.state.combustionCooldown;
            default:
               return false;
         }
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

      // Check Improved Scorch stacks
      if (cond.startsWith('scorch<')) {
         const threshold = parseInt(cond.substring(7));
         return this.state.improvedScorchStacks < threshold;
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

            // Handle buff-specific cleanup
            if (buff.name === Buff.ImprovedScorch) {
               this.state.improvedScorchStacks = 0;
            }
         }
      }
   }

   protected override canCastAbility(): boolean {
      // Can't cast if already casting
      if (this.isCasting()) {
         return false;
      }

      // Defer to base class for GCD check
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
      this.state = this.initializeState();
      this.events = [];
      this.damageBreakdown = new Map();
      this.nextRotationCommandIndex = 0;

      const fightLength = this.spec.fightLength * 1000;

      while (this.state.currentTime < fightLength) {
         this.processTimeStep();
         this.advanceTime();
      }

      const totalDamage = Array.from(this.damageBreakdown.values()).reduce((sum, dmg) => sum + dmg, 0);
      const dps = totalDamage / this.spec.fightLength;

      return {
         totalDamage,
         dps,
         events: this.events,
         damageBreakdown: this.damageBreakdown,
         statistics: this.statistics,
      };
   }

   async simulateWithPlayback(speed: number): Promise<void> {
      throw new Error('Not implemented');
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
      return 0; // Not used for mages
   }

   get hitChance(): number {
      return 0; // Not used for mages
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

      const castingText = this.isCasting() ? ` ${c.yellow}[CASTING ${this.state.castingSpell}]${c.reset}` : '';

      return `${c.gray}${timestampSeconds.toFixed(1)}s${c.reset} ${manaBar} ${castingText}`;
   }
}
