import {PlayerStatsProvider} from '../types';
import {SimulationSpec} from "../SimulationSpec";

export interface BuffsProvider {
   hasBuff(name: string): boolean;
}

export abstract class DamageCalculator {
   protected constructor(
      protected spec: SimulationSpec,
      protected buffsProvider: BuffsProvider,
      protected statsProvider: PlayerStatsProvider,
   ) {}
}
