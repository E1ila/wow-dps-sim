import {CharacterStats, SimulationConfig} from '../types';

export abstract class DamageCalculator {
   constructor(
      protected stats: CharacterStats,
      protected config: SimulationConfig
   ) {}
}
