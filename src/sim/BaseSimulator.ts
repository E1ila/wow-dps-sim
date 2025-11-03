import {
   AttackResult,
   AttackType,
   c,
   CharacterStats,
   DamageEvent, RogueDamageEvent,
   RogueSimulationState,
   SimulationConfig,
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
   protected events: DamageEvent[] = [];
   protected damageBreakdown: Map<string, number> = new Map();

   protected constructor(
      protected stats: CharacterStats,
      protected config: SimulationConfig
   ) { }

   protected abstract initializeState(): SimulationState;

   protected abstract processTimeStep(): void;

   protected abstract executeRotation(): void;

   protected abstract updateBuffs(): void;

   protected advanceTime() {
      this.state.currentTime += 100;
   }

   protected addDamage(ability: string, attackResult: AttackResult, extra?: any): void {
      this.events.push({
         ...attackResult,
         timestamp: this.state.currentTime,
         ability,
         whiteDamage: ['MH', 'OH'].includes(ability),
         ...extra,
      });

      if (attackResult.amount > 0) {
         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + attackResult.amount);
      }
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

   protected getPrintEventExtra(event: DamageEvent): string {
      return '';
   }

   protected printBuff(buffName: string, duration: number, extra?: string): void {
      const timestampSeconds = this.state.currentTime / 1000;
      const timestamp = `${c.gray}[${timestampSeconds.toFixed(1)}s]${c.reset}`;
      const durationStr = duration ? ` (${(duration / 1000).toFixed(1)}s)` : '';
      const extraStr = extra ? ` ${extra}` : '';
      console.log(`${timestamp} ${c.yellow}${buffName}${c.reset}${extraStr}${durationStr}`);
   }

   protected printEvent(event: DamageEvent): void {
      const timestampSeconds = event.timestamp / 1000;
      const extra = this.getPrintEventExtra(event);

      const isWhiteDamage = event.ability === 'MH' || event.ability === 'OH' || event.ability === 'EXTRA';
      const abilityColor = isWhiteDamage ? c.white : c.yellow;

      const timestamp = `${c.gray}[${timestampSeconds.toFixed(1)}s]${c.reset}`;

      if (event.amount === 0) {
         console.log(`${timestamp} ${event.ability} ${c.red}${event.type.toUpperCase()}${c.reset}${extra}`);
      } else {
         const critStr = event.type === AttackType.Crit ? ' (crit)' : '';
         console.log(`${timestamp} ${event.ability} ${abilityColor}${event.amount}${c.reset}${critStr}${extra}`);
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
