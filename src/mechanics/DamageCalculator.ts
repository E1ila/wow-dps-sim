import {Attack} from '../types';
import {AttackTableStatsProvider} from "./AttackTable";
import {SimulationSpec} from '../SpecLoader';

export interface BuffsProvider {
   hasBuff(name: string): boolean;
}

export abstract class DamageCalculator implements AttackTableStatsProvider {
   protected constructor(
      protected spec: SimulationSpec,
      protected buffsProvider: BuffsProvider,
   ) {}

   critChance(attack: Attack): number {
      return this.spec.gearStats.critChance;
   }

   abstract get attackPower(): number;

   get weaponSkill(): number {
      return this.spec.gearStats.weaponSkill;
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
}
