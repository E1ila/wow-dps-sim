import {GearStats, SimulationConfig} from '../types';
import {AttackTableStatsProvider} from "./AttackTable";

export abstract class DamageCalculator implements AttackTableStatsProvider {
   protected constructor(
      protected stats: GearStats,
      protected config: SimulationConfig
   ) {}

   get critChance(): number {
      return this.stats.critChance;
   }

   get weaponSkill(): number {
      return this.stats.weaponSkill;
   }

   get hitChance(): number {
      return this.stats.hitChance;
   }

   get playerLevel(): number {
      return this.stats.level;
   }

   get isDualWielding(): boolean {
      return this.stats.offHandWeapon !== undefined;
   }
}
