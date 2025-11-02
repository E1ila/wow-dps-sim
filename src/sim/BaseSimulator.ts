import {CharacterStats, RogueSimulationState, SimulationConfig, SimulationResult, SimulationState} from '../types';

export interface Simulator {
   simulate(): SimulationResult;

   runMultipleIterations(): SimulationResult[];
}

export abstract class BaseSimulator implements Simulator {
   protected abstract state: SimulationState;

   protected constructor(
      protected stats: CharacterStats,
      protected config: SimulationConfig
   ) { }

   abstract simulate(): SimulationResult;

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
