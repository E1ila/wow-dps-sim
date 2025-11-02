import {
  CharacterStats,
  Talents,
  SimulationConfig,
  SimulationState,
  SimulationResult,
  DamageEvent,
  WeaponType,
} from './types.js';
import { DamageCalculator } from './damageCalculator.js';

export class RogueSimulator {
  private state: SimulationState;
  private damageCalculator: DamageCalculator;
  private events: DamageEvent[] = [];
  private damageBreakdown: Map<string, number> = new Map();

  constructor(
    private stats: CharacterStats,
    private talents: Talents,
    private config: SimulationConfig
  ) {
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
    const energyRegenPerSecond = 20;
    const energyPerTick = energyRegenPerSecond * timeStep;

    while (this.state.currentTime < this.config.fightLength) {
      this.addEnergy(energyPerTick);

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
