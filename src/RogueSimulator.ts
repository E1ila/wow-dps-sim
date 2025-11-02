import {
  CharacterStats,
  RogueTalents,
  SimulationConfig,
  SimulationState,
  SimulationResult,
  DamageEvent,
  WeaponType,
} from './types.js';
import { DamageCalculator } from './DamageCalculator';
import { BaseSimulator } from './BaseSimulator';

export class RogueSimulator extends BaseSimulator {
  private state: SimulationState;
  private damageCalculator: DamageCalculator;
  private events: DamageEvent[] = [];
  private damageBreakdown: Map<string, number> = new Map();

  constructor(
    private stats: CharacterStats,
    private talents: RogueTalents,
    private config: SimulationConfig
  ) {
    super();
    this.damageCalculator = new DamageCalculator(stats, talents, config);
    this.state = this.initializeState();
  }

  private initializeState(): SimulationState {
    return {
      currentTime: 0,
      energy: 100,
      comboPoints: 0,
      targetHealth: 999999999,
      sliceAndDiceActive: false,
      sliceAndDiceExpiry: 0,
      mainHandNextSwing: 0,
      offHandNextSwing: 0,
      globalCooldownExpiry: 0,
      nextEnergyTick: 2.0,
    };
  }

  private addDamage(ability: string, damage: number, isCrit: boolean, comboPointsGained: number = 0): void {
    if (damage > 0) {
      this.events.push({
        timestamp: this.state.currentTime,
        ability,
        damage,
        isCrit,
        comboPointsGained,
      });

      const currentDamage = this.damageBreakdown.get(ability) || 0;
      this.damageBreakdown.set(ability, currentDamage + damage);
    }
  }

  private addEnergy(amount: number): void {
    this.state.energy = Math.min(100, this.state.energy + amount);
  }

  private spendEnergy(amount: number): boolean {
    if (this.state.energy >= amount) {
      this.state.energy -= amount;
      return true;
    }
    return false;
  }

  private addComboPoint(): void {
    if (this.state.comboPoints < 5) {
      this.state.comboPoints++;
    }
  }

  private spendComboPoints(): number {
    const cp = this.state.comboPoints;
    this.state.comboPoints = 0;
    return cp;
  }

  private triggerGlobalCooldown(): void {
    this.state.globalCooldownExpiry = this.state.currentTime + 1.0;
  }

  private canCastAbility(): boolean {
    return this.state.currentTime >= this.state.globalCooldownExpiry;
  }

  private processAutoAttacks(): void {
    if (this.state.currentTime >= this.state.mainHandNextSwing) {
      const damage = this.damageCalculator.calculateAutoAttackDamage(true);
      const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();

      if (damage > 0) {
        if (this.talents.swordSpecialization > 0 &&
            this.stats.mainHandWeapon.type === WeaponType.Sword &&
            Math.random() < (this.talents.swordSpecialization * 0.01)) {
          this.addDamage('Extra Attack (Sword Spec)', damage, isCrit);
        }

        this.addDamage('Main Hand', damage, isCrit);
      }

      this.state.mainHandNextSwing = this.state.currentTime + this.stats.mainHandWeapon.speed;
    }

    if (this.stats.offHandWeapon && this.state.currentTime >= this.state.offHandNextSwing) {
      const damage = this.damageCalculator.calculateAutoAttackDamage(false);
      const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();

      if (damage > 0) {
        this.addDamage('Off Hand', damage, isCrit);
      }

      this.state.offHandNextSwing = this.state.currentTime + this.stats.offHandWeapon.speed;
    }
  }

  private executeRotation(): void {
    if (!this.canCastAbility()) {
      return;
    }

    if (this.state.comboPoints === 5) {
      if (!this.state.sliceAndDiceActive ||
          this.state.sliceAndDiceExpiry - this.state.currentTime < 3) {
        if (this.spendEnergy(25)) {
          const cp = this.spendComboPoints();
          const baseDuration = 9 + (cp * 3);
          const improvedSndBonus = this.talents.improvedSliceAndDice * 0.15;
          const duration = baseDuration * (1 + improvedSndBonus);

          this.state.sliceAndDiceActive = true;
          this.state.sliceAndDiceExpiry = this.state.currentTime + duration;
          this.triggerGlobalCooldown();
          return;
        }
      } else {
        if (this.spendEnergy(35)) {
          const cp = this.spendComboPoints();
          const damage = this.damageCalculator.calculateEviscerateDamage(cp);
          const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();
          this.addDamage('Eviscerate', damage, isCrit);
          this.triggerGlobalCooldown();
          return;
        }
      }
    }

    if (this.state.comboPoints < 5) {
      let energyCost = 45;
      const improvedSSCostReduction = this.talents.improvedSinisterStrike * 2;
      energyCost -= improvedSSCostReduction;

      if (this.spendEnergy(energyCost)) {
        let abilityName = 'Sinister Strike';
        let damage = 0;

        if (this.talents.hemorrhage &&
            this.stats.mainHandWeapon.type === WeaponType.Dagger) {
          abilityName = 'Hemorrhage';
          damage = this.damageCalculator.calculateHemorrhageDamage();
        } else if (this.stats.mainHandWeapon.type === WeaponType.Dagger) {
          abilityName = 'Backstab';
          energyCost = 60;
          if (this.state.energy + energyCost >= 60) {
            damage = this.damageCalculator.calculateBackstabDamage();
          } else {
            damage = this.damageCalculator.calculateSinisterStrikeDamage();
            abilityName = 'Sinister Strike';
          }
        } else {
          damage = this.damageCalculator.calculateSinisterStrikeDamage();
        }

        const isCrit = damage > 0 && this.damageCalculator.getAttackTable().rollCrit();

        if (damage > 0) {
          this.addComboPoint();

          if (isCrit && this.talents.sealFate > 0) {
            if (Math.random() < (this.talents.sealFate * 0.2)) {
              this.addComboPoint();
            }
          }

          if (this.talents.relentlessStrikes > 0 && this.state.comboPoints >= 5) {
            if (Math.random() < (this.talents.relentlessStrikes * 0.2)) {
              this.addEnergy(25);
            }
          }
        }

        this.addDamage(abilityName, damage, isCrit, 1);
        this.triggerGlobalCooldown();
        return;
      }
    }
  }

  private updateBuffs(): void {
    if (this.state.sliceAndDiceActive && this.state.currentTime >= this.state.sliceAndDiceExpiry) {
      this.state.sliceAndDiceActive = false;
    }
  }

  simulate(): SimulationResult {
    this.state = this.initializeState();
    this.events = [];
    this.damageBreakdown = new Map();

    const timeStep = 0.1;

    while (this.state.currentTime < this.config.fightLength) {
      if (this.state.currentTime >= this.state.nextEnergyTick) {
        this.addEnergy(20);
        this.state.nextEnergyTick += 2.0;
      }

      this.processAutoAttacks();

      this.updateBuffs();

      this.executeRotation();

      this.state.currentTime += timeStep;
    }

    const totalDamage = Array.from(this.damageBreakdown.values()).reduce((a, b) => a + b, 0);
    const dps = totalDamage / this.config.fightLength;

    return {
      totalDamage,
      dps,
      events: this.events,
      damageBreakdown: this.damageBreakdown,
    };
  }

  runMultipleIterations(): SimulationResult[] {
    const results: SimulationResult[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      results.push(this.simulate());
    }

    return results;
  }
}
