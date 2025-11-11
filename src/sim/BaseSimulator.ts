import {
   Ability,
   Attack,
   AttackResult,
   AttackType,
   Buff,
   BuffEvent,
   DamageEvent,
   PlayerStatsProvider,
   Race,
   SimulationEvent,
   SimulationResult,
   SimulationState,
   SimulationStatistics,
   WeaponEnchant
} from '../types';
import {c} from '../globals';
import {BuffsProvider, DamageCalculator} from "../mechanics/DamageCalculator";
import {SimulationSpec} from "../SimulationSpec";

const LATENCY_LAG = 200;

export interface Simulator {
   simulate(): SimulationResult;
   runMultipleIterations(): { results: SimulationResult[], executionTimeMs: number };
   simulateWithPlayback(speed: number): Promise<void>;
}

export abstract class BaseSimulator implements Simulator, BuffsProvider, PlayerStatsProvider {
   protected abstract state: SimulationState;
   protected abstract damageCalculator: DamageCalculator;
   protected events: SimulationEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();
   protected healingBreakdown: Map<string, number> = new Map();
   protected hitDamage: number = 0;
   protected lastAbilityTimestamp: Map<string, number> = new Map();
   protected nextRotationCommandIndex = 0;

   protected strengthToAttackPower = 1;
   protected strengthPerLevel = 1;
   protected strengthLevel1 = 20;

   protected agilityToAttackPower = 1;
   protected agilityPerLevel = 1;
   protected agilityLevel1 = 10;

   protected staminaPerLevel = 1;
   protected staminaLevel1 = 15;

   protected spiritPerLevel = 1;
   protected spiritLevel1 = 10;

   protected intellectPerLevel = 1;
   protected intellectLevel1 = 10;

   protected attackPowerPerLevel = 1;

   statistics: SimulationStatistics = {
      critCount: 0,
      hitCount: 0,
      glancingCount: 0,
      missCount: 0,
      dodgeCount: 0,
   };

   protected constructor(
      protected spec: SimulationSpec
   ) {
   }

   protected abstract initializeState(): SimulationState;
   protected abstract processTimeStep(): void;
   protected abstract updateBuffs(): void;
   protected abstract executeHardcodedRotation(): void;
   protected abstract executeCommand(cmd: string): boolean;
   protected abstract checkCondition(cond: string): boolean;

   protected advanceTime() {
      this.state.currentTime += 10;
   }

   protected executeInstructionWithCondition(instruction: string): boolean {
      if (!instruction.includes('?')) {
         return this.executeCommand(instruction);
      }

      const questionMarkIndex = instruction.indexOf('?');
      const condition = instruction.substring(0, questionMarkIndex);
      const rest = instruction.substring(questionMarkIndex + 1);

      const colonIndex = rest.indexOf(':');
      const trueBranch = rest.substring(0, colonIndex);
      const falseBranch = rest.substring(colonIndex + 1);

      if (this.checkCondition(condition)) {
         return this.executeCommand(trueBranch);
      } else {
         return this.executeInstructionWithCondition(falseBranch);
      }
   }

   executeRotation(): void {
      if (!this.canCastAbility())
         return;
      if (this.spec.rotation) {
         let originalIndex = this.nextRotationCommandIndex;
         let result = false;
         do {
            const instructions = this.spec.rotation[this.nextRotationCommandIndex];
            result = this.executeInstructionWithCondition(instructions);
            this.nextRotationCommandIndex++;
            if (this.nextRotationCommandIndex == this.spec.rotation.length) {
               this.nextRotationCommandIndex = 0;
            }
         } while (!result && originalIndex !== this.nextRotationCommandIndex);
      } else {
         this.executeHardcodedRotation();
      }
   }

   protected logDamage(ability: string, attackResult: AttackResult, extra?: any): void {
      this.events.push({
         ...attackResult,
         timestamp: this.state.currentTime,
         ability,
         eventType: 'damage' as const,
         whiteDamage: [Ability.MainHand, Ability.OffHand, Ability.Extra].includes(ability as Ability),
         ...extra,
      });

      if (attackResult.amount > 0) {
         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + attackResult.amount);
      }

      switch (attackResult.type) {
         case AttackType.Crit:
            this.statistics.critCount++;
            this.hitDamage += attackResult.amount;
            break;
         case AttackType.Hit:
            this.statistics.hitCount++;
            this.hitDamage += attackResult.amount;
            break;
         case AttackType.Glancing:
            this.statistics.glancingCount++;
            this.hitDamage += attackResult.amount;
            break;
         case AttackType.Miss:
            this.statistics.missCount++;
            break;
         case AttackType.Dodge:
            this.statistics.dodgeCount++;
            break;
      }
   }

   protected logHealing(ability: string, result: any): void {
      const event: SimulationEvent = {
         timestamp: this.state.currentTime,
         ability,
         eventType: 'healing',
         amount: result.effectiveHealing,
         overhealing: result.overhealing,
         crit: result.crit,
      };

      this.events.push(event);
   }

   protected trackHealing(ability: string, result: any, shouldLog: boolean = true): void {
      if (shouldLog) {
         this.logHealing(ability, result);
      }

      // Update healing breakdown
      const currentHealing = this.healingBreakdown.get(ability) || 0;
      this.healingBreakdown.set(ability, currentHealing + result.effectiveHealing);
   }

   protected logBuff(buffName: string, duration: number, extra?: any): void {
      this.events.push({
         timestamp: this.state.currentTime,
         buffName,
         duration,
         eventType: 'buff++' as const,
         ...extra,
      });
   }

   protected addProc(procName: string, hidden?: boolean): void {
      this.events.push({
         timestamp: this.state.currentTime,
         procName,
         eventType: 'proc' as const,
         hidden,
      });
   }

   protected logBuffDrop(buffName: string, extra?: any): void {
      this.events.push({
         timestamp: this.state.currentTime,
         buffName,
         eventType: 'buff--' as const,
         ...extra,
      });
   }

   protected triggerGlobalCooldown(): void {
      this.state.globalCooldownExpiry = this.state.currentTime + 1500;
   }

   protected triggerLatencyCooldown(): void {
      this.state.globalCooldownExpiry = this.state.currentTime + LATENCY_LAG;
   }

   protected canCastAbility(): boolean {
      return this.state.currentTime >= this.state.globalCooldownExpiry;
   }

   protected activateBuff(name: string, duration: number, extra?: any): void {
      const existingBuff = this.state.activeBuffs.find(buff => buff.name === name);
      const expiry = this.state.currentTime + duration;

      if (existingBuff) {
         existingBuff.expiry = expiry;
      } else {
         this.state.activeBuffs.push({name, expiry});
      }

      // Add buff event for logging
      this.logBuff(name, duration, extra);
   }

   protected isBuffActive(name: string): boolean {
      return this.state.activeBuffs.some(buff => buff.name === name && buff.expiry > this.state.currentTime);
   }

   protected getBuffTimeRemaining(name: string): number {
      const buff = this.state.activeBuffs.find(buff => buff.name === name);
      if (!buff || buff.expiry <= this.state.currentTime) {
         return 0;
      }
      return buff.expiry - this.state.currentTime;
   }

   protected removeBuff(buffName: string): void {
      if (this.isBuffActive(buffName)) {
         this.state.activeBuffs = this.state.activeBuffs.filter(buff => buff.name !== buffName);
         this.logBuffDrop(buffName);
      }
   }

   protected removeExpiredBuffs(): void {
      // Log all buffs that are expiring
      const expiredBuffs = this.state.activeBuffs.filter(buff => buff.expiry <= this.state.currentTime);
      for (const buff of expiredBuffs) {
         this.logBuffDrop(buff.name);
      }

      // Remove expired buffs
      this.state.activeBuffs = this.state.activeBuffs.filter(buff => buff.expiry > this.state.currentTime);
   }

   protected prepareSimulation(): void {
      this.state = this.initializeState();
      this.events = [];
      this.damageBreakdown = new Map();
      this.healingBreakdown = new Map();
      this.hitDamage = 0;
      this.lastAbilityTimestamp = new Map();
      this.statistics = {
         critCount: 0,
         hitCount: 0,
         glancingCount: 0,
         missCount: 0,
         dodgeCount: 0,
      };
   }

   protected getSimulationResult(): SimulationResult {
      // For healer specs, use healing data; otherwise use damage data
      const isHealerSpec = this.spec.isHealerSpec;
      const breakdown = isHealerSpec ? this.healingBreakdown : this.damageBreakdown;
      const total = Array.from(breakdown.values()).reduce((a, b) => a + b, 0);
      const throughput = total / this.spec.fightLength;

      return {
         totalDamage: total,
         totalHitDamage: this.hitDamage,
         dps: throughput,
         events: this.events,
         damageBreakdown: breakdown,
         statistics: this.statistics,
      };
   }

   simulate(): SimulationResult {
      this.prepareSimulation();
      const fightLengthMs = this.spec.fightLength * 1000;
      while (this.state.currentTime < fightLengthMs) {
         this.processTimeStep();
         this.advanceTime();
      }
      return this.getSimulationResult();
   }

   /** @param speed Playback speed multiplier (0 = instant, 1 = real-time, 0.5 = half speed, etc.) */
   async simulateWithPlayback(speed: number): Promise<void> {
      this.prepareSimulation();

      let lastUpdateTime = 0;
      const stateUpdateInterval = 100;

      console.log('=== Starting Playback ===\n');
      this.spec.rotation && console.log(`Rotation: ${this.spec.rotation}\n`);

      this.updateFloatingBar();
      await this.waitForGameTime(1000, speed);

      const fightLengthMs = this.spec.fightLength * 1000;
      while (this.state.currentTime < fightLengthMs) {
         const eventsBefore = this.events.length;
         const timeBefore = this.state.currentTime;

         this.processTimeStep();

         // do prints
         if (this.events.length > eventsBefore) {
            this.clearFloatingBar();

            const newEvents = this.events.slice(eventsBefore);
            for (const event of newEvents) {
               if (!event.hidden)
                  this.printEvent(event);
            }

            this.updateFloatingBar();
            lastUpdateTime = this.state.currentTime;
         } else if (this.state.currentTime - lastUpdateTime >= stateUpdateInterval) {
            this.updateFloatingBar();
            lastUpdateTime = this.state.currentTime;
         }
         this.advanceTime();
         const timeDiff = this.state.currentTime - timeBefore;
         await this.waitForGameTime(timeDiff, speed);
      }

      process.stdout.write('\x1b[999;0H');
      process.stdout.write('\x1b[2K');
      process.stdout.write('\n');

      const result = this.getSimulationResult();
      console.log('\n=== Playback Complete ===');
      const label = this.spec.isHealerSpec ? 'HPS' : 'DPS';
      console.log(` ${c.green}**  ${c.brightGreen}${label} ${result.dps.toFixed(2)} ${c.green}**${c.reset}`);
   }

   protected abstract getStateText(): string;

   private async waitForGameTime(timeDiffMs: number, speed: number): Promise<void> {
      if (speed > 0 && timeDiffMs > 0) {
         const delayMs = timeDiffMs / speed;
         await new Promise(resolve => setTimeout(resolve, delayMs));
      }
   }

   private clearFloatingBar(): void {
      process.stdout.write('\x1b[s'); // Save cursor position
      process.stdout.write('\x1b[999;0H'); // Move to bottom of screen (row 999 will go to last available row)
      process.stdout.write('\x1b[2K'); // Clear the line
      process.stdout.write('\x1b[u'); // Restore cursor position
   }

   private updateFloatingBar(): void {
      process.stdout.write('\x1b[s'); // Save cursor position
      process.stdout.write('\x1b[999;0H'); // Move to bottom of screen
      process.stdout.write('\x1b[2K'); // Clear the line
      process.stdout.write(this.getStateText());
      process.stdout.write('\x1b[u'); // Restore cursor position
   }

   protected generateResourceBar(current: number, max: number, barLength: number = 20, color: string = '\x1b[33m'): string {
      const filled = Math.floor((current / max) * barLength);
      const empty = barLength - filled;
      const reset = '\x1b[0m';
      return color + '█'.repeat(filled) + reset + '░'.repeat(empty);
   }

   protected getBuffsStatusText(): string {
      return this.state.activeBuffs
         .filter(buff => buff.expiry > this.state.currentTime)
         .map(buff => ` | ${buff.name}: ${((buff.expiry - this.state.currentTime) / 1000).toFixed(1)}s`)
         .join('');
   }

   protected getPrintDamageEventExtra(event: DamageEvent): string {
      return '';
   }

   protected getPrintBuffEventExtra(event: BuffEvent): string {
      return '';
   }

   protected printEvent(event: SimulationEvent): void {
      const timestampSeconds = event.timestamp / 1000;
      const timestamp = `${c.gray}[${timestampSeconds.toFixed(1)}s]${c.reset}`;

      if (event.eventType === 'buff++') {
         const extra = this.getPrintBuffEventExtra(event);
         const durationStr = ` duration ${(event.duration / 1000).toFixed(1)}s`;
         console.log(`${timestamp}${c.green} ++ ${event.buffName}${c.reset}${extra}${durationStr}`);
      } else if (event.eventType === 'proc') {
         console.log(`${timestamp} ${c.cyan}${event.procName}${c.reset}`);
      } else if (event.eventType === 'buff--') {
         console.log(`${timestamp}${c.red} -- ${event.buffName}${c.reset}`);
      } else if (event.eventType === 'healing') {
         const critStr = event.crit ? ' (crit)' : '';
         const overhealStr = event.overhealing > 0 ? ` ${c.gray}(${event.overhealing} OH)${c.reset}` : '';
         console.log(`${timestamp} ${c.blue}${event.ability.toUpperCase()} ${c.green}${event.amount}${c.reset}${critStr}${overhealStr}`);
      } else {
         const extra = this.getPrintDamageEventExtra(event);
         const isWhiteDamage = event.ability === Ability.MainHand || event.ability === Ability.OffHand || event.ability === Ability.Extra;
         const abilityColor = isWhiteDamage ? c.white : c.brightYellow;

         let timeSinceLastStr = '';
         if (isWhiteDamage) {
            const lastTimestamp = this.lastAbilityTimestamp.get(event.ability);
            if (lastTimestamp !== undefined) {
               const timeSinceLast = (event.timestamp - lastTimestamp) / 1000;
               timeSinceLastStr = ` ${c.gray}${timeSinceLast.toFixed(2)}s${c.reset}`;
            }
            this.lastAbilityTimestamp.set(event.ability, event.timestamp);
         }

         if (event.amount === 0) {
            console.log(`${timestamp} ${c.blue}${event.ability.toUpperCase()} ${c.brightMagenta}${event.type.toUpperCase()}${c.reset}${extra}${timeSinceLastStr}`);
         } else {
            const critStr = event.type === AttackType.Crit ? ' (crit)' : (event.type === AttackType.Glancing ? ' (glancing)' : '');
            console.log(`${timestamp} ${c.blue}${event.ability.toUpperCase()} ${abilityColor}${event.amount}${c.reset}${critStr}${extra}${timeSinceLastStr}`);
         }
      }
   }

   runMultipleIterations(): { results: SimulationResult[], executionTimeMs: number } {
      const startTime = Date.now();
      const results: SimulationResult[] = [];

      for (let i = 0; i < this.spec.iterations; i++) {
         results.push(this.simulate());
      }

      const executionTimeMs = Date.now() - startTime;

      return {results, executionTimeMs};
   }

   static calculateAverageDPS(results: SimulationResult[]): number {
      const totalDPS = results.reduce((sum, result) => sum + result.dps, 0);
      return totalDPS / results.length;
   }

   static printStatistics(stats: SimulationStatistics, expectedCritChance: number, quiet?: boolean): any {
      const totalAttacks = stats.critCount + stats.hitCount + stats.glancingCount + stats.missCount + stats.dodgeCount;
      const critRate = totalAttacks > 0 ? (stats.critCount / totalAttacks * 100) : 0;

      if (quiet) {
         return {
            totalAttacks,
            wornCrit: expectedCritChance + '%',
            actualCrit: Math.round(critRate) + '%',
            actualHit: Math.round(stats.hitCount / totalAttacks * 100) + '%',
            actualGlancing: Math.round(stats.glancingCount / totalAttacks * 100) + '%',
            actualMiss: Math.round(stats.missCount / totalAttacks * 100) + '%',
            actualDodge: Math.round(stats.dodgeCount / totalAttacks * 100) + '%',
            ...stats,
         }
      }

      console.log('\n=== Statistics ===');
      console.log(`Total Attacks: ${totalAttacks}`);
      console.log(`  Crits: ${stats.critCount} (${critRate.toFixed(2)}%)`);
      console.log(`  Hits: ${stats.hitCount} (${(stats.hitCount / totalAttacks * 100).toFixed(2)}%)`);
      console.log(`  Glancing: ${stats.glancingCount} (${(stats.glancingCount / totalAttacks * 100).toFixed(2)}%)`);
      console.log(`  Miss: ${stats.missCount} (${(stats.missCount / totalAttacks * 100).toFixed(2)}%)`);
      console.log(`  Dodge: ${stats.dodgeCount} (${(stats.dodgeCount / totalAttacks * 100).toFixed(2)}%)`);
      console.log(`Crit Rate (of all attacks): ${critRate.toFixed(2)}%`);
      console.log(`Expected Crit Rate (from stats): ${expectedCritChance.toFixed(2)}%`);
   }

   static printResults(results: SimulationResult[], simulator: BaseSimulator, executionTimeMs?: number, talentOverrides?: Record<string, any>, quiet: boolean = false): any {
      const avgDPS = this.calculateAverageDPS(results);
      const jsonResults: any = {
         dps: avgDPS,
         talentOverrides,
         executionTimeMs,
         iterations: results.length,
      };

      if (!quiet) {
         console.log('\n=== Simulation Results ===');
         console.log(`Iterations: ${results.length}`);
         if (executionTimeMs !== undefined) {
            const executionTimeSec = executionTimeMs / 1000;
            console.log(`Execution Time: ${executionTimeSec.toFixed(2)}s`);
         }
      }

      if (results.length > 0) {
         // Aggregate damage breakdown across all iterations
         const aggregatedBreakdown = new Map<string, number>();
         const aggregatedHitCount = new Map<string, number>();
         const aggregatedMissCount = new Map<string, number>();
         let totalDamageSum = 0;
         let totalHitDamageSum = 0;

         for (const result of results) {
            totalDamageSum += result.totalDamage;
            totalHitDamageSum += result.totalHitDamage;
            for (const [ability, damage] of result.damageBreakdown.entries()) {
               const currentDamage = aggregatedBreakdown.get(ability) || 0;
               aggregatedBreakdown.set(ability, currentDamage + damage);
            }

            // Count hits and misses for each ability
            for (const event of result.events) {
               if (event.eventType === 'damage') {
                  if (event.amount > 0) {
                     const currentCount = aggregatedHitCount.get(event.ability) || 0;
                     aggregatedHitCount.set(event.ability, currentCount + 1);
                  }
                  if (event.type === AttackType.Miss) {
                     const currentCount = aggregatedMissCount.get(event.ability) || 0;
                     aggregatedMissCount.set(event.ability, currentCount + 1);
                  }
               }
            }
         }

         const avgTotalDamage = totalDamageSum / results.length;

         !quiet && console.log('\n=== Damage Breakdown (Average across all iterations) ===');
         jsonResults.abilityBreakdown = {};
         const sortedBreakdown = Array.from(aggregatedBreakdown.entries())
            .sort((a, b) => b[1] - a[1]);

         for (const [ability, totalDamage] of sortedBreakdown) {
            const avgDamage = totalDamage / results.length;
            const percentage = (avgDamage / avgTotalDamage) * 100;
            const hitCount = aggregatedHitCount.get(ability) || 0;
            const missCount = aggregatedMissCount.get(ability) || 0;
            const totalAttempts = hitCount + missCount;
            const missPercentage = totalAttempts > 0 ? (missCount / totalAttempts) * 100 : 0;
            const avgHitDamage = hitCount > 0 ? totalDamage / hitCount : 0;
            jsonResults.abilityBreakdown[ability] = {
               percentage: Math.round(percentage) + '%',
               avgHitDamage: Math.round(avgHitDamage),
               hitCount,
               missCount,
               missPercentage: missPercentage.toFixed(1) + '%',
               totalDamage,
            };
            !quiet && console.log(`${ability}: ${percentage.toFixed(1)}% - Total: ${totalDamage.toFixed(0)} - Avg Hit: ${avgHitDamage.toFixed(1)} - Hits: ${hitCount} - Miss: ${missPercentage.toFixed(1)}%`);
         }

         // Aggregate statistics across all iterations
         const aggregatedStats: SimulationStatistics = {
            critCount: 0,
            hitCount: 0,
            glancingCount: 0,
            missCount: 0,
            dodgeCount: 0,
         };

         for (const result of results) {
            aggregatedStats.critCount += result.statistics.critCount;
            aggregatedStats.hitCount += result.statistics.hitCount;
            aggregatedStats.glancingCount += result.statistics.glancingCount;
            aggregatedStats.missCount += result.statistics.missCount;
            aggregatedStats.dodgeCount += result.statistics.dodgeCount;
         }

         jsonResults.hitStats = this.printStatistics(aggregatedStats, simulator.critChance, quiet);

         const totalSuccessfulHits = aggregatedStats.critCount + aggregatedStats.hitCount + aggregatedStats.glancingCount;
         const avgDamagePerHit = totalSuccessfulHits > 0 ? totalHitDamageSum / totalSuccessfulHits : 0;

         !quiet && console.log(`Average Damage per Hit (all successful attacks): ${avgDamagePerHit.toFixed(1)}`);
      }
      if (!quiet) {
         if (talentOverrides && Object.keys(talentOverrides).length > 0) {
            console.log('Overrides:');
            for (const [name, value] of Object.entries(talentOverrides)) {
               console.log(` ${value} ${name}`);
            }
         }
         const label = simulator.spec.isHealerSpec ? 'HPS' : 'DPS';
         console.log(` ${c.green}**  ${c.brightGreen}${label} ${avgDPS.toFixed(2)} ${c.green}**${c.reset}`);
      }
      return jsonResults;
   }

   // -- buffs provider

   hasBuff(name: string): boolean {
      return this.state.activeBuffs.some(buff => buff.name === name && buff.expiry >= this.state.currentTime);
   }

   // -- player stats provider

   /*
    *   | Class   | Crit per Agi | Agi for 1% Crit |
    *   |---------|--------------|-----------------|
    *   | Hunter  | 0.0189       | ~53 Agi         |
    *   | Rogue   | 0.0345       | ~29 Agi         |
    *   | Warrior | 0.0500       | 20 Agi          |
    *   | Paladin | 0.0506       | ~20 Agi         |
    *   | Shaman  | 0.0508       | ~20 Agi         |
    *   | Priest  | 0.0500       | 20 Agi          |
    *   | Mage    | 0.0514       | ~19 Agi         |
    *   | Warlock | 0.0500       | 20 Agi          |
    *   | Druid   | 0.0500       | 20 Agi          |
    */
   get agilityToCrit(): number {
      return 0;
   }

   /*
    *   | Class   | Spell Crit per Int | Int for 1% Spell Crit |
    *   |---------|--------------------|-----------------------|
    *   | Hunter  | 0.0165             | ~61 Int               |
    *   | Paladin | 0.0167             | ~60 Int               |
    *   | Mage    | 0.0168             | ~60 Int               |
    *   | Priest  | 0.0168             | ~60 Int               |
    *   | Shaman  | 0.0169             | ~59 Int               |
    *   | Warlock | 0.0165             | ~61 Int               |
    *   | Druid   | 0.0167             | ~60 Int               |
    *   | Warrior | 0.0                | N/A                   |
    *   | Rogue   | 0.0                | N/A                   |
    *
    */
   get intellectToSpellCrit(): number {
      return 0;
   }

   get critFromTalents(): number {
      return 0;
   }

   get critChance(): number {
      return this.spec.gearStats.critChance + this.agilityToCrit + this.critFromTalents;
   }

   attackCritChance(attack?: Attack): number {
      const targetDefense = this.spec.targetLevel * 5;
      const baseWeaponSkill = this.spec.playerLevel * 5;

      let critChance =  this.critChance;

      // Crit suppression uses base weapon skill (not including +skill from gear/racials)
      const skillDiff = baseWeaponSkill - targetDefense;

      if (skillDiff < 0) {
         // Target defense > base skill: suppression = 0.2% per point
         critChance += skillDiff * 0.2;
      } else {
         // Base skill >= target defense: bonus = 0.04% per point
         critChance += skillDiff * 0.04;
      }

      // Additional 1.8% suppression for +3 level targets
      if (this.spec.targetLevel - this.spec.playerLevel >= 3) {
         critChance -= 1.8;
      }

      return critChance;
   }

   get strength(): number {
      let str =
         this.playerLevel * this.strengthPerLevel + this.strengthLevel1 +
         this.spec.gearStats.strength +
         this.racialStrengthDelta;
      if (this.hasBuff(Buff.Crusader))
         str += 100;
      return str;
   }

   get agility(): number {
      let agi =
         this.playerLevel * this.agilityPerLevel + this.agilityLevel1 +
         this.spec.gearStats.agility +
         this.racialAgilityDelta;
      if (this.spec.gearStats.mainHandWeapon.enchant == WeaponEnchant.Agility15)
         agi += 15;
      if (this.spec.gearStats.mainHandWeapon.enchant == WeaponEnchant.Agility25)
         agi += 25;
      if (this.spec.gearStats.offHandWeapon?.enchant == WeaponEnchant.Agility15)
         agi += 15;
      return agi;
   }

   get stamina(): number {
      return this.racialStaminaDelta + this.staminaLevel1 + this.staminaPerLevel * this.playerLevel;
   }

   get intellect(): number {
      return this.racialIntellectDelta +
         this.intellectLevel1 + this.intellectPerLevel * this.playerLevel +
         (this.spec.gearStats.intellect || 0);
   }

   get spirit(): number {
      return this.racialSpiritDelta +
         this.spiritLevel1 + this.spiritPerLevel * this.playerLevel +
         (this.spec.gearStats.spirit || 0);
   }

   get haste(): number {
      return 1;
   }

   get attackPower(): number {
      return Math.max(1, this.playerLevel * this.attackPowerPerLevel - 20)
         + this.strength * this.strengthToAttackPower
         + this.agility * this.agilityToAttackPower
         + (this.spec.gearStats.attackPower || 0);
   }

   get weaponSkill(): number {
      let skill = this.playerLevel * 5;
      if (this.spec.gearStats?.mainHandWeapon?.type)
         skill += this.spec.gearStats.weaponSkills.get(this.spec.gearStats.mainHandWeapon.type) || 0
      return skill;
   }

   get hitChance(): number {
      return this.spec.gearStats.hitChance;
   }

   get playerLevel(): number {
      return this.spec.playerLevel;
   }

   get isDualWielding(): boolean {
      return this.spec.gearStats.offHandWeapon !== undefined;
   }

   get targetLevel(): number {
      return this.spec.targetLevel;
   }

   // -- racial differences

   get racialStrengthDelta(): number {
      if (!this.spec.race)
         return 0;

      switch (this.spec.race) {
         case Race.Orc:
            return 3;
         case Race.Dwarf:
            return 2;
         case Race.NightElf:
            return -3;
         case Race.Undead:
            return -1;
         case Race.Tauren:
            return 5;
         case Race.Gnome:
            return -5;
         case Race.Troll:
            return 1;
         default:
            return 0;
      }
   }

   get racialAgilityDelta(): number {
      if (!this.spec.race)
         return 0;

      switch (this.spec.race) {
         case Race.Orc:
            return -3;
         case Race.Dwarf:
            return -4;
         case Race.NightElf:
            return 5;
         case Race.Undead:
            return -2;
         case Race.Tauren:
            return -5;
         case Race.Gnome:
            return 3;
         case Race.Troll:
            return 2;
         default:
            return 0;
      }
   }

   get racialStaminaDelta(): number {
      if (!this.spec.race)
         return 0;

      switch (this.spec.race) {
         case Race.Orc:
            return 2;
         case Race.Dwarf:
            return 3;
         case Race.NightElf:
            return -1;
         case Race.Undead:
            return 1;
         case Race.Tauren:
            return 2;
         case Race.Gnome:
            return -1;
         case Race.Troll:
            return 1;
         default:
            return 0;
      }
   }

   get racialIntellectDelta(): number {
      if (!this.spec.race)
         return 0;

      switch (this.spec.race) {
         case Race.Orc:
            return -3;
         case Race.Dwarf:
            return -1;
         case Race.Undead:
            return -2;
         case Race.Tauren:
            return -5;
         case Race.Gnome:
            return 3;
         case Race.Troll:
            return -4;
         default:
            return 0;
      }
   }

   get racialSpiritDelta(): number {
      if (!this.spec.race)
         return 0;

      switch (this.spec.race) {
         case Race.Orc:
            return 3;
         case Race.Dwarf:
            return -1;
         case Race.Undead:
            return 5;
         case Race.Tauren:
            return 2;
         case Race.Troll:
            return 1;
         default:
            return 0;
      }
   }

}
