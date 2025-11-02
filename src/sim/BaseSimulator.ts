import {
   CharacterStats,
   DamageEvent,
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

   /**
    * Initialize the simulation state. Must be implemented by subclasses.
    */
   protected abstract initializeState(): SimulationState;

   /**
    * Process a single time step in the simulation. Must be implemented by subclasses.
    */
   protected abstract processTimeStep(): void;

   /**
    * Add a damage event to the simulation.
    */
   protected addDamage(ability: string, damage: number, isCrit: boolean): void {
      if (damage > 0) {
         this.events.push({
            timestamp: this.state.currentTime,
            ability,
            damage,
            isCrit,
         });

         const currentDamage = this.damageBreakdown.get(ability) || 0;
         this.damageBreakdown.set(ability, currentDamage + damage);
      }
   }

   /**
    * Trigger the global cooldown.
    */
   protected triggerGlobalCooldown(): void {
      this.state.globalCooldownExpiry = this.state.currentTime + 1.0;
   }

   /**
    * Check if an ability can be cast (GCD is not active).
    */
   protected canCastAbility(): boolean {
      return this.state.currentTime >= this.state.globalCooldownExpiry;
   }

   /**
    * Reset simulation state and prepare for a new simulation run.
    */
   protected prepareSimulation(): void {
      this.state = this.initializeState();
      this.events = [];
      this.damageBreakdown = new Map();
   }

   /**
    * Get the simulation result from the current state.
    */
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

   /**
    * Run a single simulation without playback.
    */
   simulate(): SimulationResult {
      this.prepareSimulation();

      while (this.state.currentTime < this.config.fightLength) {
         this.processTimeStep();
      }

      return this.getSimulationResult();
   }

   /**
    * Run a single simulation with playback (printing events in real-time).
    * @param speed Playback speed multiplier (0 = instant, 1 = real-time, 0.5 = half speed, etc.)
    */
   async simulateWithPlayback(speed: number): Promise<void> {
      this.prepareSimulation();

      let lastEventTime = 0;
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      console.log('=== Starting Playback ===\n');

      while (this.state.currentTime < this.config.fightLength) {
         const eventsBefore = this.events.length;

         this.processTimeStep();

         // Check if new events were added
         if (this.events.length > eventsBefore) {
            for (let i = eventsBefore; i < this.events.length; i++) {
               const event = this.events[i];

               // Add delay based on time difference and speed
               if (speed > 0) {
                  const timeDiff = event.timestamp - lastEventTime;
                  const delayMs = (timeDiff * 1000) / speed;
                  if (delayMs > 0) {
                     await sleep(delayMs);
                  }
               }

               this.printEvent(event);
               lastEventTime = event.timestamp;
            }
            this.printState();
         }
      }

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

   /**
    * Print a damage event during playback. Can be overridden by subclasses for custom formatting.
    */
   protected printEvent(event: DamageEvent): void {
      const critStr = event.isCrit ? ' (CRIT!)' : '';
      console.log(`[${event.timestamp.toFixed(1)}s] ${event.ability}: ${event.damage}${critStr}`);
   }

   /**
    * Print the current simulation state during playback. Must be implemented by subclasses.
    */
   protected abstract printState(): void;

   /**
    * Run multiple simulation iterations.
    */
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
