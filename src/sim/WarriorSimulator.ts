import {
   Ability,
   Attack,
   AttackResult,
   AttackType,
   Buff,
   WarriorSimulationState,
   WarriorStance,
   WarriorTalents,
} from '../types';
import {MeleeSimulator} from './MeleeSimulator';
import {WarriorDamageCalculator} from '../mechanics/WarriorDamageCalculator';
import {SimulationSpec} from '../SpecLoader';
import {c, isHit} from '../globals';

export const WARRIOR = {
   maxRage: 100,
   rageConversionFactor: 0.679, // At level 60: 0.00965 * 60 + 0.1007
   normalizedWeaponSpeed2H: 3.3,
   normalizedWeaponSpeed1H: 2.4,

   // Ability costs
   bloodthirstCost: 30,
   mortalStrikeCost: 30,
   executeCostBase: 15,
   whirlwindCost: 25,
   heroicStrikeCost: 15,
   cleaveCost: 20,
   revengeCost: 5,
   overpowerCost: 5,
   rendCost: 10,
   slamCost: 15,

   // Cooldowns (milliseconds)
   bloodthirstCD: 6000,
   mortalStrikeCD: 6000,
   whirlwindCD: 10000,
   revengeCD: 5000,
   overpowerCD: 5000,
   bloodrageCD: 60000,
   berserkerRageCD: 30000,
   stanceCD: 1000,

   // Proc durations (milliseconds)
   overpowerDuration: 5000,
   revengeDuration: 5000,
   flurryStackICD: 500,

   // Bloodrage generation
   bloodrageInstant: 10,
   bloodragePerTick: 1,
   bloodrageTicks: 10,
   bloodrageTickInterval: 1000,

   // Queue delay
   queueDelay: 500,
}

export class WarriorSimulator extends MeleeSimulator {
   override state!: WarriorSimulationState;
   override damageCalculator!: WarriorDamageCalculator;
   protected talents: WarriorTalents;
   private lastFlurryConsumeTime: number = 0;
   private bloodrageTicksRemaining: number = 0;
   private nextBloodrageTickTime: number = 0;

   constructor(spec: SimulationSpec) {
      super(spec);
      this.talents = spec.talents as WarriorTalents;
      this.damageCalculator = new WarriorDamageCalculator(spec, this, this);
      this.state = this.initializeState();
   }

   protected initializeState(): WarriorSimulationState {
      return {
         currentTime: 0,
         rage: 0,
         currentStance: WarriorStance.Battle,
         targetHealth: 999999999,
         mainHandNextSwing: 0,
         offHandNextSwing: 0,
         globalCooldownExpiry: 0,
         activeBuffs: [],
         nextAngerManagementTick: 3000,

         // Proc states
         overpowerAvailable: false,
         overpowerExpiry: 0,
         revengeAvailable: false,
         revengeExpiry: 0,

         // Buff stacks
         flurryStacks: 0,
         enrageStacks: 0,
         sweepingStrikesStacks: 0,

         // Cooldowns
         bloodthirstCooldown: 0,
         mortalStrikeCooldown: 0,
         whirlwindCooldown: 0,
         revengeCooldown: 0,
         overpowerCooldown: 0,
         bloodrageCooldown: 0,
         berserkerRageCooldown: 0,
         stanceCooldown: 0,

         // Queue system
         queuedAbility: null,
         queueActivationTime: 0,
      };
   }

   protected handleResourceGeneration(): void {
      // Anger Management: 1 rage every 3 seconds
      if (this.talents.angerManagement && this.state.currentTime >= this.state.nextAngerManagementTick) {
         this.addRage(1, 'Anger Management');
         this.state.nextAngerManagementTick += 3000;
      }

      // Bloodrage ticks
      if (this.bloodrageTicksRemaining > 0 && this.state.currentTime >= this.nextBloodrageTickTime) {
         this.addRage(WARRIOR.bloodragePerTick, 'Bloodrage tick');
         this.bloodrageTicksRemaining--;
         this.nextBloodrageTickTime += WARRIOR.bloodrageTickInterval;
      }
   }

   addRage(amount: number, source?: string): void {
      const oldRage = this.state.rage;
      this.state.rage = Math.min(WARRIOR.maxRage, this.state.rage + amount);
      if (source && this.state.rage > oldRage) {
         // console.log(`[${this.state.currentTime}ms] +${amount} rage from ${source} (${oldRage} -> ${this.state.rage})`);
      }
   }

   spendRage(amount: number): boolean {
      if (this.state.rage >= amount) {
         this.state.rage -= amount;
         return true;
      }
      return false;
   }

   refundRageIfNeeded(result: AttackResult, rageCost: number): void {
      if (result.type === AttackType.Miss || result.type === AttackType.Dodge) {
         const refund = rageCost * 0.8;
         this.addRage(refund, '80% refund');
      }
   }

   generateRageFromDamage(damage: number): void {
      // Rage from damage dealt: damage / (RageConversion * 10)
      // At level 60: RageConversion ≈ 0.679
      const rage = damage / (WARRIOR.rageConversionFactor * 10);
      this.addRage(rage, 'damage dealt');
   }

   override onMainHandHit(result: AttackResult): void {
      super.onMainHandHit(result);

      if (isHit(result)) {
         // Generate rage from damage
         this.generateRageFromDamage(result.amount);

         // Unbridled Wrath: chance to gain 1 rage on white hit
         if (this.talents.unbridledWrath > 0) {
            const chance = this.talents.unbridledWrath * 0.08;
            if (Math.random() < chance) {
               this.addRage(1, 'Unbridled Wrath');
               this.addProc('Unbridled Wrath', true);
            }
         }

         // Consume Flurry stack
         this.consumeFlurryStack();

         // Consume Enrage stack
         this.consumeEnrageStack();

         // Trigger Flurry on crit
         if (result.type === AttackType.Crit && this.talents.flurry > 0) {
            this.activateFlurry();
         }

         // Trigger Enrage on crit
         if (result.type === AttackType.Crit && this.talents.enrage > 0) {
            this.activateEnrage();
         }
      }
   }

   override onOffHandHit(result: AttackResult): void {
      super.onOffHandHit(result);

      if (isHit(result)) {
         this.generateRageFromDamage(result.amount);

         if (this.talents.unbridledWrath > 0) {
            const chance = this.talents.unbridledWrath * 0.08;
            if (Math.random() < chance) {
               this.addRage(1, 'Unbridled Wrath');
               this.addProc('Unbridled Wrath', true);
            }
         }

         this.consumeFlurryStack();

         this.consumeEnrageStack();

         if (result.type === AttackType.Crit && this.talents.flurry > 0) {
            this.activateFlurry();
         }

         if (result.type === AttackType.Crit && this.talents.enrage > 0) {
            this.activateEnrage();
         }
      }
   }

   activateFlurry(): void {
      this.state.flurryStacks = 3;
      if (!this.isBuffActive(Buff.Flurry)) {
         this.activateBuff(Buff.Flurry, 999999); // Doesn't expire, only consumed
         this.addProc(`Flurry ${c.cyan}↑↑↑${c.reset}`, true);
      }
   }

   consumeFlurryStack(): void {
      if (this.state.flurryStacks > 0) {
         // 500ms ICD on stack consumption
         if (this.state.currentTime - this.lastFlurryConsumeTime >= WARRIOR.flurryStackICD) {
            this.state.flurryStacks--;
            this.lastFlurryConsumeTime = this.state.currentTime;

            if (this.state.flurryStacks === 0) {
               this.removeBuffByName(Buff.Flurry);
            }
         }
      }
   }

   activateEnrage(): void {
      this.state.enrageStacks = 12;
      if (!this.isBuffActive(Buff.Enrage)) {
         this.activateBuff(Buff.Enrage, 12000);
         this.addProc(`Enrage ${c.red}!!!${c.reset}`, true);
      } else {
         // Refresh stacks
         const buff = this.state.activeBuffs.find(b => b.name === Buff.Enrage);
         if (buff) {
            buff.expiry = this.state.currentTime + 12000;
         }
      }
   }

   consumeEnrageStack(): void {
      if (this.state.enrageStacks > 0) {
         this.state.enrageStacks--;
         if (this.state.enrageStacks === 0) {
            this.removeBuffByName(Buff.Enrage);
         }
      }
   }

   removeBuffByName(buffName: string): void {
      this.state.activeBuffs = this.state.activeBuffs.filter(b => b.name !== buffName);
      this.logBuffDrop(buffName);
   }

   protected checkCondition(cond: string): boolean {
      switch (cond) {
         case 'execute':
            return this.isExecutePhase();
         case 'battle':
            return this.state.currentStance === WarriorStance.Battle;
         case 'berserker':
            return this.state.currentStance === WarriorStance.Berserker;
         case 'defensive':
            return this.state.currentStance === WarriorStance.Defensive;
         case 'op_available':
            return this.state.overpowerAvailable && this.state.currentTime < this.state.overpowerExpiry;
         case 'revenge_available':
            return this.state.revengeAvailable && this.state.currentTime < this.state.revengeExpiry;
         default:
            return false;
      }
   }

   protected executeHardcodedRotation(): void {
      // Simple fury rotation
      if (this.isExecutePhase()) {
         this.castExecute();
      } else if (this.state.currentTime >= this.state.bloodthirstCooldown && this.state.rage >= WARRIOR.bloodthirstCost) {
         this.castBloodthirst();
      } else if (this.state.currentStance === WarriorStance.Berserker &&
                 this.state.currentTime >= this.state.whirlwindCooldown &&
                 this.state.rage >= WARRIOR.whirlwindCost) {
         this.castWhirlwind();
      } else if (this.state.rage >= 80) {
         // Prevent rage capping
         this.queueHeroicStrike();
      }
   }

   protected executeCommand(cmd: string): boolean {
      switch (cmd) {
         case Ability.Bloodthirst:
            return this.castBloodthirst();
         case Ability.MortalStrike:
            return this.castMortalStrike();
         case Ability.Execute:
            return this.castExecute();
         case Ability.Whirlwind:
            return this.castWhirlwind();
         case Ability.HeroicStrike:
            return this.queueHeroicStrike();
         case Ability.Cleave:
            return this.queueCleave();
         case Ability.Revenge:
            return this.castRevenge();
         case Ability.Overpower:
            return this.castOverpower();
         case Ability.Rend:
            return this.castRend();
         case Ability.Bloodrage:
            return this.castBloodrage();
         case Ability.BattleStance:
            return this.switchStance(WarriorStance.Battle);
         case Ability.BerserkerStance:
            return this.switchStance(WarriorStance.Berserker);
         case Ability.DefensiveStance:
            return this.switchStance(WarriorStance.Defensive);
         case Ability.Skip:
            return true;
         default:
            return false;
      }
   }

   protected updateBuffs(): void {
      this.removeExpiredBuffs();

      // Update proc availability
      if (this.state.overpowerAvailable && this.state.currentTime >= this.state.overpowerExpiry) {
         this.state.overpowerAvailable = false;
      }

      if (this.state.revengeAvailable && this.state.currentTime >= this.state.revengeExpiry) {
         this.state.revengeAvailable = false;
      }
   }

   switchStance(stance: WarriorStance): boolean {
      if (this.state.currentStance === stance) {
         return false;
      }

      if (this.state.currentTime < this.state.stanceCooldown) {
         return false;
      }

      // Lose rage except what Tactical Mastery retains
      const retainedRage = (this.talents.tacticalMastery || 0) * 5;
      this.state.rage = Math.min(this.state.rage, retainedRage);

      this.state.currentStance = stance;
      this.state.stanceCooldown = this.state.currentTime + WARRIOR.stanceCD;

      // Update stance buffs
      this.removeBuffByName(Buff.BattleStance);
      this.removeBuffByName(Buff.DefensiveStance);
      this.removeBuffByName(Buff.BerserkerStance);

      const stanceBuff = stance === WarriorStance.Battle ? Buff.BattleStance :
                        stance === WarriorStance.Defensive ? Buff.DefensiveStance :
                        Buff.BerserkerStance;

      this.activateBuff(stanceBuff, 999999);
      this.triggerGlobalCooldown();
      return true;
   }

   castBloodthirst(): boolean {
      if (this.state.currentTime < this.state.bloodthirstCooldown) {
         return false;
      }

      const cost = WARRIOR.bloodthirstCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Bloodthirst: 0.45 * AP damage
      const damage = 0.45 * this.attackPower;
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      this.refundRageIfNeeded(result, cost);
      this.logDamage(Ability.Bloodthirst, result);
      this.onAbilityHit(result);

      this.state.bloodthirstCooldown = this.state.currentTime + WARRIOR.bloodthirstCD;
      this.triggerGlobalCooldown();
      return true;
   }

   castMortalStrike(): boolean {
      if (this.state.currentTime < this.state.mortalStrikeCooldown) {
         return false;
      }

      const cost = WARRIOR.mortalStrikeCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Mortal Strike: 160 + normalized weapon damage + AP
      const normalizedDamage = this.getNormalizedWeaponDamage();
      const damage = 160 + normalizedDamage;
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      this.refundRageIfNeeded(result, cost);
      this.logDamage(Ability.MortalStrike, result);
      this.onAbilityHit(result);

      this.state.mortalStrikeCooldown = this.state.currentTime + WARRIOR.mortalStrikeCD;
      this.triggerGlobalCooldown();
      return true;
   }

   castExecute(): boolean {
      if (!this.isExecutePhase()) {
         return false;
      }

      // Execute only works in Battle or Berserker stance
      if (this.state.currentStance === WarriorStance.Defensive) {
         return false;
      }

      const baseCost = WARRIOR.executeCostBase;
      if (this.state.rage < baseCost) {
         return false;
      }

      // Execute consumes all rage
      const rageSpent = this.state.rage;
      this.state.rage = 0;

      // Execute: 600 + 15 per rage spent
      const damage = 600 + (15 * rageSpent);
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      // Execute refunds 80% of base cost (15 rage) on miss/dodge, not all rage
      this.refundRageIfNeeded(result, baseCost);

      this.logDamage(Ability.Execute, result);
      this.onAbilityHit(result);

      this.triggerGlobalCooldown();
      return true;
   }

   castWhirlwind(): boolean {
      if (this.state.currentStance !== WarriorStance.Berserker) {
         return false;
      }

      if (this.state.currentTime < this.state.whirlwindCooldown) {
         return false;
      }

      const cost = WARRIOR.whirlwindCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Whirlwind: normalized weapon damage
      const damage = this.getNormalizedWeaponDamage();
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      this.refundRageIfNeeded(result, cost);
      this.logDamage(Ability.Whirlwind, result);
      this.onAbilityHit(result);

      this.state.whirlwindCooldown = this.state.currentTime + WARRIOR.whirlwindCD;
      this.triggerGlobalCooldown();
      return true;
   }

   queueHeroicStrike(): boolean {
      if (this.state.queuedAbility !== null) {
         return false;
      }

      let cost = WARRIOR.heroicStrikeCost;
      if (this.talents.improvedHeroicStrike > 0) {
         cost -= this.talents.improvedHeroicStrike;
      }

      if (this.state.rage < cost) {
         return false;
      }

      // Queue the ability
      this.state.queuedAbility = Ability.HeroicStrike;
      this.state.queueActivationTime = this.state.currentTime + WARRIOR.queueDelay;
      return true;
   }

   queueCleave(): boolean {
      if (this.state.queuedAbility !== null) {
         return false;
      }

      const cost = WARRIOR.cleaveCost;
      if (this.state.rage < cost) {
         return false;
      }

      this.state.queuedAbility = Ability.Cleave;
      this.state.queueActivationTime = this.state.currentTime + WARRIOR.queueDelay;
      return true;
   }

   processQueuedAbility(): void {
      if (this.state.queuedAbility === null) {
         return;
      }

      if (this.state.currentTime < this.state.queueActivationTime) {
         return;
      }

      if (this.state.queuedAbility === Ability.HeroicStrike) {
         let cost = WARRIOR.heroicStrikeCost;
         if (this.talents.improvedHeroicStrike > 0) {
            cost -= this.talents.improvedHeroicStrike;
         }

         if (!this.spendRage(cost)) {
            this.state.queuedAbility = null;
            return;
         }

         // Heroic Strike: weapon damage + 138-157 + AP
         const weaponDamage = this.getWeaponDamage(false);
         const bonusDamage = 138 + Math.random() * (157 - 138);
         const damage = weaponDamage + bonusDamage;
         const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

         this.refundRageIfNeeded(result, cost);
         this.logDamage(Ability.HeroicStrike, result);
         this.onAbilityHit(result);

         this.state.queuedAbility = null;
      } else if (this.state.queuedAbility === Ability.Cleave) {
         const cost = WARRIOR.cleaveCost;

         if (!this.spendRage(cost)) {
            this.state.queuedAbility = null;
            return;
         }

         // Cleave: weapon damage + 50-220 (varies by talent)
         const weaponDamage = this.getWeaponDamage(false);
         let bonusDamage = 50 + Math.random() * (220 - 50);

         if (this.talents.improvedCleave > 0) {
            bonusDamage *= (1 + this.talents.improvedCleave * 0.1);
         }

         const damage = weaponDamage + bonusDamage;
         const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

         this.refundRageIfNeeded(result, cost);
         this.logDamage(Ability.Cleave, result);
         this.onAbilityHit(result);

         this.state.queuedAbility = null;
      }
   }

   castRevenge(): boolean {
      if (this.state.currentStance !== WarriorStance.Defensive) {
         return false;
      }

      if (!this.state.revengeAvailable || this.state.currentTime >= this.state.revengeExpiry) {
         return false;
      }

      if (this.state.currentTime < this.state.revengeCooldown) {
         return false;
      }

      const cost = WARRIOR.revengeCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Revenge: 64-99 fixed damage
      const damage = 64 + Math.random() * (99 - 64);
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      this.refundRageIfNeeded(result, cost);
      this.logDamage(Ability.Revenge, result);
      this.onAbilityHit(result);

      this.state.revengeAvailable = false;
      this.state.revengeCooldown = this.state.currentTime + WARRIOR.revengeCD;
      this.triggerGlobalCooldown();
      return true;
   }

   castOverpower(): boolean {
      if (this.state.currentStance !== WarriorStance.Battle) {
         return false;
      }

      if (!this.state.overpowerAvailable || this.state.currentTime >= this.state.overpowerExpiry) {
         return false;
      }

      if (this.state.currentTime < this.state.overpowerCooldown) {
         return false;
      }

      const cost = WARRIOR.overpowerCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Overpower: 35 + normalized weapon damage + AP (cannot be dodged)
      const normalizedDamage = this.getNormalizedWeaponDamage();
      const damage = 35 + normalizedDamage;
      const result = this.damageCalculator.calculateSpecialAttackDamage(damage, false);

      // Overpower cannot be dodged, so force hit if it was dodged
      if (result.type === AttackType.Dodge) {
         result.type = AttackType.Hit;
      }

      this.refundRageIfNeeded(result, cost);
      this.logDamage(Ability.Overpower, result);
      this.onAbilityHit(result);

      this.state.overpowerAvailable = false;
      this.state.overpowerCooldown = this.state.currentTime + WARRIOR.overpowerCD;
      this.triggerGlobalCooldown();
      return true;
   }

   castRend(): boolean {
      // Rend only works in Battle or Defensive stance
      if (this.state.currentStance === WarriorStance.Berserker) {
         return false;
      }

      const cost = WARRIOR.rendCost;
      if (!this.spendRage(cost)) {
         return false;
      }

      // Rend: Apply DoT (simplified - just mark as active for now)
      // At level 60: 21 damage x 7 ticks = 147 total over 21 seconds
      // Real implementation would need DoT tick system
      this.activateBuff(Buff.Rend, 21000);

      // TODO: Implement actual DoT ticking system
      this.triggerGlobalCooldown();
      return true;
   }

   castBloodrage(): boolean {
      if (this.state.currentTime < this.state.bloodrageCooldown) {
         return false;
      }

      // Bloodrage: instant 10 rage (+2 per improved rank) + 1 rage per second for 10 seconds
      let instantRage = WARRIOR.bloodrageInstant;
      if (this.talents.improvedBerserkerRage > 0) {
         instantRage += this.talents.improvedBerserkerRage * 2;
      }

      this.addRage(instantRage, 'Bloodrage instant');

      // Set up ticking
      this.bloodrageTicksRemaining = WARRIOR.bloodrageTicks;
      this.nextBloodrageTickTime = this.state.currentTime + WARRIOR.bloodrageTickInterval;

      this.state.bloodrageCooldown = this.state.currentTime + WARRIOR.bloodrageCD;
      this.triggerGlobalCooldown();
      return true;
   }

   onAbilityHit(result: AttackResult): void {
      if (isHit(result)) {
         // Generate rage from damage
         this.generateRageFromDamage(result.amount);

         // Consume Enrage stack on any ability hit
         this.consumeEnrageStack();

         // Trigger Flurry on crit
         if (result.type === AttackType.Crit && this.talents.flurry > 0) {
            this.activateFlurry();
         }

         // Trigger Enrage on crit
         if (result.type === AttackType.Crit && this.talents.enrage > 0) {
            this.activateEnrage();
         }
      }

      // Simulate enemy dodging to trigger Overpower
      if (this.state.currentStance === WarriorStance.Battle) {
         const dodgeChance = 0.05; // 5% base dodge chance
         if (Math.random() < dodgeChance && result.type !== AttackType.Dodge) {
            this.state.overpowerAvailable = true;
            this.state.overpowerExpiry = this.state.currentTime + WARRIOR.overpowerDuration;
         }
      }
   }

   protected override handleAutoAttacks(): void {
      // Process queued ability if ready
      if (this.state.queuedAbility && this.state.currentTime >= this.state.queueActivationTime) {
         // Check if it's time for main hand swing
         if (this.state.currentTime >= this.state.mainHandNextSwing) {
            this.processQueuedAbility();
            // Reset swing timer after queued ability
            this.state.mainHandNextSwing = this.state.currentTime + (this.spec.gearStats.mainHandWeapon.speed * 1000 / this.getHasteMultiplier());
            return; // Skip normal auto-attack processing this cycle
         }
      }

      // Normal auto-attack processing
      super.handleAutoAttacks();
   }

   override getHasteMultiplier(): number {
      let haste = super.getHasteMultiplier();

      // Flurry buff
      if (this.state.flurryStacks > 0 && this.talents.flurry > 0) {
         const flurryBonus = [0, 0.1, 0.15, 0.2, 0.25, 0.3][this.talents.flurry];
         haste *= (1 + flurryBonus);
      }

      return haste;
   }

   getNormalizedWeaponDamage(): number {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const avgDamage = (weapon.minDamage + weapon.maxDamage) / 2;
      const is2H = !this.spec.gearStats.offHandWeapon;
      const normalizedSpeed = is2H ? WARRIOR.normalizedWeaponSpeed2H : WARRIOR.normalizedWeaponSpeed1H;

      // Normalized damage = avg weapon damage + (normalized speed * AP / 14)
      return avgDamage + (normalizedSpeed * this.attackPower / 14);
   }

   getWeaponDamage(isOffHand: boolean): number {
      const weapon = isOffHand ? this.spec.gearStats.offHandWeapon : this.spec.gearStats.mainHandWeapon;
      if (!weapon) return 0;

      return weapon.minDamage + Math.random() * (weapon.maxDamage - weapon.minDamage);
   }

   isExecutePhase(): boolean {
      // Execute phase when target is below 20% health
      // For DPS sim, we'll consider this always false unless specified
      return this.state.targetHealth < (999999999 * 0.2);
   }

   protected override calculateMainHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(false);
   }

   protected override calculateOffHandDamage(): AttackResult {
      return this.damageCalculator.calculateAutoAttackDamage(true);
   }

   protected getStateText(): string {
      const timestampSeconds = this.state.currentTime / 1000;
      const rageBar = this.generateResourceBar(this.state.rage, WARRIOR.maxRage, 20, c.red);
      const stanceColor = this.state.currentStance === WarriorStance.Battle ? c.yellow :
                         this.state.currentStance === WarriorStance.Defensive ? c.blue :
                         c.red;
      const stanceText = `${stanceColor}${this.state.currentStance}${c.reset}`;
      const flurryText = this.state.flurryStacks > 0 ? ` ${c.cyan}Flurry(${this.state.flurryStacks})${c.reset}` : '';
      const enrageText = this.state.enrageStacks > 0 ? ` ${c.red}Enrage(${this.state.enrageStacks})${c.reset}` : '';
      const buffsStatus = this.getBuffsStatusText();

      return `[${timestampSeconds.toFixed(1)}s] [${rageBar}] ${this.state.rage.toFixed(0)} ${stanceText}${flurryText}${enrageText}${buffsStatus}`;
   }

   override get attackPower(): number {
      let ap = this.spec.gearStats.attackPower;

      // Warriors get 2 AP per point of Strength (vs 1 for rogues)
      ap += this.spec.gearStats.strength * 2;

      // Crusader buff
      if (this.hasBuff(Buff.Crusader)) {
         ap += 200; // 100 Strength * 2 AP per Strength for warriors
      }

      return ap;
   }

   override critChance(attack: Attack): number {
      let critChance = super.critChance(attack);

      // Cruelty talent
      if (this.talents.cruelty > 0) {
         critChance += this.talents.cruelty;
      }

      // Berserker Stance: +3% crit
      if (this.state.currentStance === WarriorStance.Berserker) {
         critChance += 3;
      }

      // Improved Overpower
      if (attack.ability === Ability.Overpower && this.talents.improvedOverpower > 0) {
         critChance += this.talents.improvedOverpower * 25;
      }

      return critChance;
   }
}
