import {Ability, AttackResult, PlayerStatsProvider, TargetType} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';
import {BuffsProvider} from "./DamageCalculator";
import {SimulationSpec} from "../SimulationSpec";
import {RogueTalents} from "../talents";

const EVISCERATE_9 = [[224,332],[394,502],[564,672],[734,842],[904,1012]];
const SINISTER_STRIKE_7 = 68;
const BACKSTAB_9 = 225; // extra damage (not percent increase)

export class RogueDamageCalculator extends MeleeDamageCalculator {
   protected talents: RogueTalents;

   constructor(spec: SimulationSpec, buffsProvider: BuffsProvider, statsProvider: PlayerStatsProvider) {
      super(spec, buffsProvider, statsProvider);
      this.talents = spec.talents as RogueTalents;
   }

   get dualWieldSpecBonus(): number {
      return this.talents.dualWieldSpecialization * 0.05;
   }

   override get autoAttackMultiplier(): number {
      return this.murderMultiplier;
   }

   /**
    * Lethality increases CRIT damage bonus by 6% per point (not all damage).
    * Normal crit: 2.0x (100% base + 100% crit bonus)
    * With 5/5 Lethality: 2.3x (100% base + 130% crit bonus)
    * Additional multiplier on crits: 2.3 / 2.0 = 1.15
    */
   get lethalityCritMultiplier() {
      if (this.talents.lethality === 0) {
         return undefined;
      }
      // Each point adds 6% to crit bonus, which is 3% when applied after base 2.0x crit
      return 1 + (this.talents.lethality * 0.03);
   }

   get aggressionBonus() {
      return (this.talents.aggression ?? 0) * 0.02;
   }

   get opportunityBonus() {
      return (this.talents.opportunity ?? 0) * 0.04;
   }

   get improvedEviscerateBonus() {
      return (this.talents.improvedEviscerate ?? 0) * 0.05;
   }

   get murderMultiplier(): number {
      if (this.talents.murder && this.spec.targetType && [TargetType.Humanoid, TargetType.Beast, TargetType.Giant, TargetType.Dragonkin].includes(this.spec.targetType)) {
         return 1 + this.talents.murder * 0.01;
      }
      return 1;
   }

   calculateSinisterStrikeDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const baseDamage = weaponDamage + SINISTER_STRIKE_7 + this.calcAttackPowerDamage(weapon);

      // Ability-specific talents are additive with each other
      const abilityMultiplier = 1 + this.aggressionBonus;
      // Murder is applied separately (at attack table level in reference)
      const multipliers = [
         abilityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.SinisterStrike,
         isSpecialAttack: true,
         weapon,
         critMultiplier: this.lethalityCritMultiplier,
      });
   }

   calculateBackstabDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = this.calcAttackPowerDamage(weapon);
      const baseDamage = weaponDamage + BACKSTAB_9 + apBonus;

      // Base multiplier (1.5x) is multiplicative with Opportunity talent in reference implementation
      const abilityMultiplier = 1.5 * (1 + this.opportunityBonus);
      // Murder is applied separately (at attack table level in reference)
      const multipliers = [
         abilityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Backstab,
         isSpecialAttack: true,
         weapon,
         critMultiplier: this.lethalityCritMultiplier,
      });
   }

   calculateHemorrhageDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      // Hemorrhage uses actual weapon speed, NOT normalized speed
      const baseDamage = weaponDamage + this.calcAttackPowerDamage(weapon, false);

      const multipliers = [
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Hemorrhage,
         isSpecialAttack: true,
         weapon,
         critMultiplier: this.lethalityCritMultiplier,
      });
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      if (!comboPoints)
         throw new Error(`Can't cast Eviscerate with 0 combo points`);
      const weapon = this.spec.gearStats.mainHandWeapon;
      const range = EVISCERATE_9[comboPoints - 1];
      const cpDamage = Math.random() * (range[1] - range[0]) + range[0];
      // Eviscerate uses 3% of AP per combo point, NOT weapon damage
      const apBonus = this.statsProvider.attackPower * comboPoints * 0.03;
      const baseDamage = Math.round(cpDamage + apBonus);

      // Ability-specific talents are additive with each other
      const abilityMultiplier = 1 + this.improvedEviscerateBonus + this.aggressionBonus;
      // Murder is applied separately (at attack table level in reference)
      const multipliers = [
         abilityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Eviscerate,
         isSpecialAttack: true,
         weapon,
      });
   }
}
