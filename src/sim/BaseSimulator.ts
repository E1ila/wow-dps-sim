import {
   AttackResult,
   AttackType,
   BuffEvent,
   c,
   CharacterStats,
   DamageEvent,
   SimulationConfig,
   SimulationEvent,
   SimulationResult,
   SimulationState
} from '../types';
import {MeleeDamageCalculator} from "../mechanics/MeleeDamageCalculator";
import {DamageCalculator} from "../mechanics/DamageCalculator";

export interface Simulator {
   simulate(): SimulationResult;

   runMultipleIterations(): SimulationResult[];

   simulateWithPlayback(speed: number): Promise<void>;
}

export abstract class BaseSimulator implements Simulator {
   protected abstract state: SimulationState;
   protected abstract damageCalculator: DamageCalculator;
   protected events: SimulationEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();
   protected lastAbilityTimestamp: Map<string, number> = new Map();

   protected constructor(
      protected stats: CharacterStats,
      protected config: SimulationConfig
   ) { }

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

   protected triggerGlobalCooldown(): void {
      this.state.globalCooldownExpiry = this.state.currentTime + 1000;
   }

   protected canCastAbility(): boolean {
      return this.state.currentTime >= this.state.globalCooldownExpiry;
   }

   protected prepareSimulation(): void {
      this.state = this.initializeState();
      this.events = [];
      this.damageBreakdown = new Map();
      this.lastAbilityTimestamp = new Map();
   }

   protected getSimulationResult(): SimulationResult {
      const totalDamage = Array.from(this.damageBreakdown.values()).reduce((a, b) => a + b, 0);
      const dps = totalDamage / this.config.fightLength;

      return {
         totalDamage,
         dps,
         events: this.events,
         damageBreakdown: this.damageBreakdown,
      };
   }

   simulate(): SimulationResult {
      this.prepareSimulation();
      const fightLengthMs = this.config.fightLength * 1000;
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

      const fightLengthMs = this.config.fightLength * 1000;
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
      console.log(`Total Damage: ${result.totalDamage.toFixed(0)}`);
      console.log(`DPS: ${result.dps.toFixed(2)}`);

      console.log('\n=== Damage Breakdown ===');
      const sortedBreakdown = Array.from(result.damageBreakdown.entries())
         .sort((a, b) => b[1] - a[1]);

      for (const [ability, damage] of sortedBreakdown) {
         const percentage = (damage / result.totalDamage) * 100;
         console.log(`${ability}: ${damage.toFixed(0)} (${percentage.toFixed(1)}%)`);
      }
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
         console.log(`${timestamp} ${c.yellow}${event.buffName}${c.reset}${extra}${durationStr}`);
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
            console.log(`${timestamp} ${event.ability} ${c.red}${event.type.toUpperCase()}${c.reset}${extra}${timeSinceLastStr}`);
         } else {
            const critStr = event.type === AttackType.Crit ? ' (crit)' : '';
            console.log(`${timestamp} ${c.yellow}${event.ability} ${abilityColor}${event.amount}${c.reset}${critStr}${extra}${timeSinceLastStr}`);
         }
      }
   }

   runMultipleIterations(): SimulationResult[] {
      const results: SimulationResult[] = [];

      for (let i = 0; i < this.config.iterations; i++) {
         results.push(this.simulate());
      }

      return results;
   }

   static calculateAverageDPS(results: SimulationResult[]): number {
      const totalDPS = results.reduce((sum, result) => sum + result.dps, 0);
      return totalDPS / results.length;
   }

   static printResults(results: SimulationResult[]): void {
      const avgDPS = this.calculateAverageDPS(results);
      const minDPS = Math.min(...results.map(r => r.dps));
      const maxDPS = Math.max(...results.map(r => r.dps));

      console.log('\n=== Simulation Results ===');
      console.log(`Iterations: ${results.length}`);
      console.log(`Average DPS: ${avgDPS.toFixed(2)}`);
      console.log(`Min DPS: ${minDPS.toFixed(2)}`);
      console.log(`Max DPS: ${maxDPS.toFixed(2)}`);

      if (results.length > 0) {
         console.log('\n=== Damage Breakdown (First Iteration) ===');
         const breakdown = results[0].damageBreakdown;
         const totalDamage = results[0].totalDamage;

         const sortedBreakdown = Array.from(breakdown.entries())
            .sort((a, b) => b[1] - a[1]);

         for (const [ability, damage] of sortedBreakdown) {
            const percentage = (damage / totalDamage) * 100;
            console.log(`${ability}: ${damage.toFixed(0)} (${percentage.toFixed(1)}%)`);
         }
      }
   }
}
