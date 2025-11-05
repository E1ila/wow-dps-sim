import {Ability, AttackResult, PlayerStatsProvider, RogueTalents, TargetType} from '../types';
import {MeleeDamageCalculator} from './MeleeDamageCalculator';
import {SimulationSpec} from '../SpecLoader';
import {BuffsProvider} from "./DamageCalculator";

const EVISCERATE_9 = [[224,332],[394,502],[564,672],[734,842],[904,1012]];
const SINISTER_STRIKE_7 = 68;
const BACKSTAB_9 = 225;

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

   get lethalityMultiplier() {
      if (this.talents.lethality === 0) {
         return 1;
      }
      return 1 + (this.talents.lethality * 0.06);
   }

   get aggressionMultiplier() {
      if (this.talents.aggression === 0) {
         return 1;
      }
      return 1 + (this.talents.aggression * 0.02);
   }

   get opportunityMultiplier() {
      if (this.talents.opportunity === 0) {
         return 1;
      }
      return 1 + (this.talents.opportunity * 0.04);
   }

   get improvedEviscerateMultiplier() {
      if (this.talents.improvedEviscerate === 0) {
         return 1;
      }
      return 1 + (this.talents.improvedEviscerate * 0.05);
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

      const multipliers = [
         this.aggressionMultiplier,
         this.lethalityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.SinisterStrike,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateBackstabDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      const apBonus = this.calcAttackPowerDamage(weapon);
      const baseDamage = (weaponDamage + BACKSTAB_9 + apBonus) * 1.5;

      const multipliers = [
         this.opportunityMultiplier,
         this.lethalityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Backstab,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateHemorrhageDamage(): AttackResult {
      const weapon = this.spec.gearStats.mainHandWeapon;
      const weaponDamage = this.getWeaponDamage(weapon);
      // todo: that's not what happens - it should actually appply a debuff
      const baseDamage = weaponDamage + this.calcAttackPowerDamage(weapon);

      const multipliers = [
         this.lethalityMultiplier,
         this.murderMultiplier,
      ];

      return this.calculateMeleeDamage({
         baseDamage,
         damageMultipliers: multipliers,
         ability: Ability.Hemorrhage,
         isSpecialAttack: true,
         weapon,
      });
   }

   calculateEviscerateDamage(comboPoints: number): AttackResult {
      if (!comboPoints)
         throw new Error(`Can't cast Eviscerate with 0 combo points`);
      const weapon = this.spec.gearStats.mainHandWeapon;
      const range = EVISCERATE_9[comboPoints - 1];
      const cpDamage = Math.random() * (range[1] - range[0]) + range[0];
      const apBonus = this.calcAttackPowerDamage(weapon) * comboPoints * 0.03;
      const baseDamage = Math.round(cpDamage + apBonus);

      const multipliers = [
         this.improvedEviscerateMultiplier,
         this.aggressionMultiplier,
         this.lethalityMultiplier,
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
