import {
   Ability,
   AttackResult,
   AttackType,
   BuffEvent,
   c,
   DamageEvent,
   SimulationEvent,
   SimulationResult,
   SimulationState,
   SimulationStatistics
} from '../types';
import {BuffsProvider, DamageCalculator} from "../mechanics/DamageCalculator";
import {SimulationSpec} from '../SpecLoader';

export interface Simulator {
   simulate(): SimulationResult;
   runMultipleIterations(): { results: SimulationResult[], executionTimeMs: number };
   simulateWithPlayback(speed: number): Promise<void>;
}

export abstract class BaseSimulator implements Simulator, BuffsProvider {
   protected abstract state: SimulationState;
   protected abstract damageCalculator: DamageCalculator;
   protected events: SimulationEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();
   protected lastAbilityTimestamp: Map<string, number> = new Map();
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

   protected abstract executeRotation(): void;

   protected abstract updateBuffs(): void;

   protected advanceTime() {
      this.state.currentTime += 10;
   }

   protected addDamage(ability: string, attackResult: AttackResult, extra?: any): void {
      this.events.push({
         ...attackResult,
         timestamp: this.state.currentTime,
         ability,
         eventType: 'damage' as const,
         whiteDamage: ['MH', 'OH'].includes(ability),
         ...extra,
      });

      if (attackResult.amount > 0) {
         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + attackResult.amount);
      }

      switch (attackResult.type) {
         case AttackType.Crit:
            this.statistics.critCount++;
            break;
         case AttackType.Hit:
            this.statistics.hitCount++;
            break;
         case AttackType.Glancing:
            this.statistics.glancingCount++;
            break;
         case AttackType.Miss:
            this.statistics.missCount++;
            break;
         case AttackType.Dodge:
            this.statistics.dodgeCount++;
            break;
      }
   }

   protected addBuff(buffName: string, duration: number, extra?: any): void {
      this.events.push({
         timestamp: this.state.currentTime,
         buffName,
         duration,
         eventType: 'buff' as const,
         ...extra,
      });
   }

   protected addProc(procName: string): void {
      this.events.push({
         timestamp: this.state.currentTime,
         procName,
         eventType: 'proc' as const,
      });
   }

   protected triggerGlobalCooldown(): void {
      this.state.globalCooldownExpiry = this.state.currentTime + 1000;
   }

   protected canCastAbility(): boolean {
      return this.state.currentTime >= this.state.globalCooldownExpiry;
   }

   protected activateBuff(name: string, duration: number): void {
      const existingBuff = this.state.activeBuffs.find(buff => buff.name === name);
      const expiry = this.state.currentTime + duration;

      if (existingBuff) {
         existingBuff.expiry = expiry;
      } else {
         this.state.activeBuffs.push({name, expiry});
      }
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

   protected removeExpiredBuffs(): void {
      this.state.activeBuffs = this.state.activeBuffs.filter(buff => buff.expiry > this.state.currentTime);
   }

   protected prepareSimulation(): void {
      this.state = this.initializeState();
      this.events = [];
      this.damageBreakdown = new Map();
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
      const totalDamage = Array.from(this.damageBreakdown.values()).reduce((a, b) => a + b, 0);
      const dps = totalDamage / this.spec.fightLength;

      return {
         totalDamage,
         dps,
         events: this.events,
         damageBreakdown: this.damageBreakdown,
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
      console.log('\n'); // Reserve space for the floating bar

      await this.waitForGameTime(1000, speed);
      this.updateFloatingBar();

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
      console.log(`DPS: ${result.dps.toFixed(2)}`);
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

      if (event.eventType === 'buff') {
         const extra = this.getPrintBuffEventExtra(event);
         const durationStr = ` (${(event.duration / 1000).toFixed(1)}s)`;
         console.log(`${timestamp} ${c.green}${event.buffName}${c.reset}${extra}${durationStr}`);
      } else if (event.eventType === 'proc') {
         console.log(`${timestamp} ${c.cyan}${event.procName}${c.reset}`);
      } else {
         const extra = this.getPrintDamageEventExtra(event);
         const isWhiteDamage = event.ability === 'MH' || event.ability === 'OH' || event.ability === 'EXTRA';
         const abilityColor = isWhiteDamage ? c.white : c.brightYellow;

         let timeSinceLastStr = '';
         if (isWhiteDamage) {
            const lastTimestamp = this.lastAbilityTimestamp.get(event.ability);
            if (lastTimestamp !== undefined) {
               const timeSinceLast = (event.timestamp - lastTimestamp) / 1000;
               timeSinceLastStr = ` ${c.gray}(+${timeSinceLast.toFixed(2)}s)${c.reset}`;
            }
            this.lastAbilityTimestamp.set(event.ability, event.timestamp);
         }

         if (event.amount === 0) {
            console.log(`${timestamp} ${c.blue}${event.ability} ${c.red}${event.type.toUpperCase()}${c.reset}${extra}${timeSinceLastStr}`);
         } else {
            const critStr = event.type === AttackType.Crit ? ' (crit)' : '';
            console.log(`${timestamp} ${c.blue}${event.ability} ${abilityColor}${event.amount}${c.reset}${critStr}${extra}${timeSinceLastStr}`);
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
         let totalDamageSum = 0;

         for (const result of results) {
            totalDamageSum += result.totalDamage;
            for (const [ability, damage] of result.damageBreakdown.entries()) {
               const currentDamage = aggregatedBreakdown.get(ability) || 0;
               aggregatedBreakdown.set(ability, currentDamage + damage);
            }

            // Count hits for each ability
            for (const event of result.events) {
               if (event.eventType === 'damage' && event.amount > 0) {
                  const currentCount = aggregatedHitCount.get(event.ability) || 0;
                  aggregatedHitCount.set(event.ability, currentCount + 1);
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
            const avgHitDamage = hitCount > 0 ? totalDamage / hitCount : 0;
            jsonResults.abilityBreakdown[ability] = {
               percentage: Math.round(percentage) + '%',
               avgHitDamage: Math.round(avgHitDamage),
               hitCount,
               totalDamage,
            };
            !quiet && console.log(`${ability}: ${percentage.toFixed(1)}% - Avg Hit: ${avgHitDamage.toFixed(1)}`);
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

         const gearCrit = simulator.damageCalculator.critChance({
            ability: Ability.MainHand,
            isSpecialAttack: false,
            weapon: simulator.spec.gearStats.mainHandWeapon
         });
         jsonResults.hitStats = this.printStatistics(aggregatedStats, gearCrit, quiet);
      }
      if (!quiet) {
         if (talentOverrides && Object.keys(talentOverrides).length > 0) {
            console.log('Overrides:');
            for (const [name, value] of Object.entries(talentOverrides)) {
               console.log(` ${value} ${name}`);
            }
         }
         console.log(` ${c.green}**  ${c.brightGreen}DPS ${avgDPS.toFixed(2)} ${c.green}**${c.reset}`);
      }
      return jsonResults;
   }

   // -- buffs provider

   hasBuff(name: string): boolean {
      return this.state.activeBuffs.some(buff => buff.name === name && buff.expiry >= this.state.currentTime);
   }
}
