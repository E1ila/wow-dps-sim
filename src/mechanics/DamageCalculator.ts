import {GearStats, SimulationConfig} from '../types';

export abstract class DamageCalculator {
   constructor(
      protected stats: GearStats,
      protected config: SimulationConfig
   ) {}
}
