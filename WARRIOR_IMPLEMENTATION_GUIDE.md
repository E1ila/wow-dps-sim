# Warrior Simulator Implementation Guide

## Overview

This guide consolidates all information about WoW Classic Warrior mechanics from the official `wow-sims` simulator codebase. Use this as your primary reference for implementing `WarriorSimulator` in TypeScript.

## Source Analysis

**Original Implementation**: `/Users/tal/dev/node.js/wow-sims/classic/sim/warrior/` (Go)
**Target Implementation**: `/Users/tal/dev/node.js/wow-dps-sim/src/sim/WarriorSimulator.ts` (TypeScript)
**Reference Pattern**: `/Users/tal/dev/node.js/wow-dps-sim/src/sim/RogueSimulator.ts`

## Key Documents

### 1. WARRIOR_MECHANICS.md (459 lines)
**Location**: `/Users/tal/dev/node.js/wow-dps-sim/WARRIOR_MECHANICS.md`

Comprehensive reference including:
- Quick reference tables (Rage generation, ability costs, damage formulas)
- Stance system details (Battle, Defensive, Berserker)
- Deep dives into complex systems (queue system, Deep Wounds, Flurry, Enrage)
- Ability priority concepts and rotations
- Stat conversions and formulas
- Implementation checklist
- Testing considerations

**Use this for**: Exact values, formulas, talent interactions, detailed mechanics

### 2. Extracted Go Source Files
All analyzed directly from:

**Core Files**:
- `warrior.go` - Class definition, spell registration
- `stances.go` - Stance system implementation
- `talents.go` - Talent tree definitions and bonuses
- `dps_warrior/dps_warrior.go` - DPS agent setup

**Ability Files** (reference formulas):
- `bloodthirst.go` - Fury main ability (0.45 * AP)
- `mortal_strike.go` - Arms main ability (160 + normalized + AP)
- `execute.go` - Execute phase finisher (600 + 15 * rage)
- `heroic_strike_cleave.go` - Queue system implementation
- `whirlwind.go` - Multi-target ability
- `revenge.go` - Defensive proc ability
- `overpower.go` - Dodge proc ability
- `rend.go` - DoT ability
- `slam.go` - Cast-time ability
- `deep_wounds.go` - Crit-triggered bleed
- `sweeping_strikes.go` - Multi-target cooldown
- `bloodrage.go` - Rage generation cooldown
- `berserker_rage.go` - Fury rage generation

## Quick Start

### 1. Update Type Definitions
File: `/Users/tal/dev/node.js/wow-dps-sim/src/types.ts`

Expand the `WarriorTalents` interface from:
```typescript
export interface WarriorTalents {
  armsTree: Record<string, number>;
  furyTree: Record<string, number>;
  protectionTree: Record<string, number>;
}
```

To include all specific talents (see WARRIOR_MECHANICS.md for complete list).

### 2. Create WarriorSimulationState Interface
Add to types.ts:
```typescript
export interface WarriorSimulationState extends MeleeSimulationState {
  rage: number;
  currentStance: 'battle' | 'defensive' | 'berserker';
  activeBuffs: Map<string, BuffInfo>;
  activeDebuffs: Map<string, DebuffInfo>;
  procAuras: {
    overpower: boolean;
    revenge: boolean;
    flurry: { stacks: number; active: boolean };
    deepWounds: Map<string, BleedInfo>;
  };
  cooldowns: Map<string, CooldownInfo>;
  lastRageGeneration: {
    source: string;
    timestamp: number;
    amount: number;
  }[];
}
```

### 3. Core Implementation Structure

Follow the RogueSimulator pattern:

```typescript
export class WarriorSimulator extends MeleeSimulator {
  protected state!: WarriorSimulationState;
  protected damageCalculator!: WarriorDamageCalculator;
  protected talents: WarriorTalents;
  
  constructor(spec: SimulationSpec) {
    super(spec);
    this.talents = spec.talents as WarriorTalents;
    this.damageCalculator = new WarriorDamageCalculator(spec, this, this);
    this.state = this.initializeState();
  }

  protected initializeState(): WarriorSimulationState {
    // Initialize rage, stance, cooldowns, buffs
  }

  protected handleResourceGeneration(): void {
    // Rage ticks and talent generation (Anger Management)
    // Bloodrage cooldown handling
    // Berserker Rage damage-taken handling
  }

  protected handleAutoAttacks(): void {
    // Main and off-hand swing timing
    // Rage generation from white hits
    // Heroic Strike/Cleave queue processing
  }

  protected calculateAbilityDamage(ability: string): AttackResult {
    // AP scaling: 0.15-0.45 per ability
    // Weapon damage application
    // Crit multipliers with Impale
    // Talent modifiers
  }

  protected executeAbility(ability: string): boolean {
    // Spend rage
    // Check stance restrictions
    // Apply cooldowns
    // Trigger proc checks
  }
}
```

## Implementation Phases

### Phase 1: Core Systems (Required for basic functionality)
1. Rage resource management (0-100)
2. Stance system (exclusive, 1-second cooldown)
3. Bloodthirst ability (30 rage, 6s CD, 0.45*AP damage)
4. Mortal Strike ability (30 rage, 6s CD)
5. Execute ability (15+all rage, execute phase only)
6. Auto-attack damage and rage generation
7. Basic hit/crit/miss table
8. Damage calculation with AP scaling

**Estimated effort**: 20-30 hours

### Phase 2: Essential for DPS
1. Heroic Strike queue system (complex!)
2. Cleave ability (2-target)
3. Rend DoT ability
4. Overpower proc (dodge trigger)
5. Cooldown tracking system
6. Attack table refinement

**Estimated effort**: 15-20 hours

### Phase 3: Important mechanics
1. Whirlwind ability (4-target)
2. Revenge proc (dodge/parry/block)
3. Deep Wounds bleed (crit trigger)
4. Slam cast-time ability
5. Bloodrage cooldown
6. Berserker Rage cooldown

**Estimated effort**: 15-20 hours

### Phase 4: Enhancements (Optional but important for accuracy)
1. Flurry buff (crit trigger, 3 stacks)
2. Enrage buff (crit trigger, 12 stacks)
3. Sweeping Strikes (5 stacks, multi-target)
4. Talent application system
5. Weapon specializations
6. Improved talent bonuses

**Estimated effort**: 10-15 hours

**Total: 60-85 hours for full implementation**

## Key Mechanics Summary

### Rage Generation
```
From damage dealt:     damage / 10 * 0.15 (approximately)
From white hits:       Automatic on every swing
From cooldowns:        Bloodrage (10+2*rank instant, 1/sec for 10s)
                       Berserker Rage (5*rank instant)
                       Berserker Rage Aura (2.0 per hit taken)
From talents:          Anger Management (1 every 3s)
                       Unbridled Wrath (8% per rank on white hit)
                       Shield Spec (20% per rank on block)
```

### Three Stances
| Stance | Threat | Damage Dealt | Damage Taken | Enables |
|--------|--------|--------------|--------------|---------|
| Battle | 0.8x | Normal | Normal | Overpower, Mortal Strike, etc |
| Defensive | 1.3x*(1+0.03*Defiance) | 0.9x | 0.9x | Revenge, Shield Slam, etc |
| Berserker | 0.8x | Normal | 1.1x | Whirlwind, Recklessness |

### Primary Damage Abilities
| Ability | Cost | CD | Damage | Main Tree |
|---------|------|----|----|----------|
| Bloodthirst | 30 | 6s | 0.45 * AP | Fury |
| Mortal Strike | 30 | 6s | 160 + normalized + AP | Arms |
| Execute | 15+all | - | 600 + 15 * rage | Both |

### Critical Proc Systems
1. **Overpower** - Triggered by enemy dodge, 5s duration, 5 rage cost
2. **Revenge** - Triggered by dodge/parry/block, 5s duration, 5 rage cost
3. **Deep Wounds** - Triggered by crit, 12s duration, snapshot damage
4. **Flurry** - Triggered by crit, 3 stacks, 1 per white hit, attack speed buff
5. **Enrage** - Triggered by crit, 12 stacks, 1 per melee hit, damage buff

## Critical Implementation Notes

### Rage Must-Knows
- **Caps at 100** - Excess rage is wasted
- **Refunds 80% on miss/dodge** - Not a full refund
- **Not like Energy** - Warriors don't regenerate rage passively
- **Spent on every ability** - Managing rage cap is crucial
- **Stance switch loses excess** - Only retain 5 * Tactical Mastery

### Ability Queue System (Complex!)
- Replaces next auto-attack swing
- 500ms delay prevents "ability clipping"
- Only one queue active at a time
- Fails if insufficient rage when swing occurs
- Heroic Strike and Cleave use same queue

### Snapshot Mechanics
- Deep Wounds captures weapon damage at cast time
- Rend DoT captures base damage at cast time
- Multipliers (Enrage, buffs) apply to snapshot
- Each tick uses snapshot value

### Attack Power Scaling
- **Warrior bonus**: +2 AP per Strength point (highest in game)
- **Ability coefficients**: 0.15-0.45 AP per ability
- **Weapon damage**: Normalized or non-normalized per ability
- **Check Go source files for exact coefficients**

## Testing Checklist

### Must Pass
- Rage never exceeds 100
- Abilities spend correct rage amounts
- Abilities refund 80% on miss/dodge
- Auto-attacks generate rage
- Execute only works in execute phase (<20% HP)
- Overpower only works after enemy dodge
- Revenge only works after dodge/parry/block
- Stance switching works and restricts abilities
- Deep Wounds triggers on crits
- Flurry triggers on crits
- Can't cast ability without enough rage

### Nice to Have
- Damage values match reference implementation
- Cooldowns enforce 6-second lockout
- Threat calculations apply stance modifiers
- Talent modifiers apply correctly

## Critical Files to Reference

### Go Implementation Files
All in `/Users/tal/dev/node.js/wow-sims/classic/sim/warrior/`:

**Armor must-read**:
- `warrior.go` - Lines 36-120 for state structure
- `stances.go` - Lines 83-150 for stance implementation
- `heroic_strike_cleave.go` - Lines 95-162 for queue system
- `bloodthirst.go` - Lines 9-51 for damage formula
- `execute.go` - Lines 7-60 for conditional logic

### TypeScript Reference Files
In `/Users/tal/dev/node.js/wow-dps-sim/`:

- `src/sim/RogueSimulator.ts` - Use this as pattern
- `src/sim/BaseSimulator.ts` - Core simulator logic
- `src/sim/MeleeSimulator.ts` - Melee-specific logic
- `src/types.ts` - Type definitions to extend

## Common Pitfalls to Avoid

1. **Rage Overflow** - Don't forget to check if rage would exceed 100
2. **Wrong Queue System** - Heroic Strike/Cleave must replace swing, not queue twice
3. **Missing Refunds** - Forget 80% refund on miss/dodge and abilities fail
4. **Snap Shot Breaks** - Deep Wounds/Rend must snapshot at cast, not on tick
5. **Talent Application** - Remember Impale affects crit damage (multiplicative)
6. **Stance Restriction** - Some abilities only work in specific stances
7. **Proc Priority** - Multiple procs on same swing (handle correctly)
8. **Execute Phase Logic** - Only <20% HP, not <=20%
9. **Cooldown Tracking** - 6s CD means can't cast for 6s from activation
10. **Threat Calculations** - Apply stance multipliers to threat

## Questions to Ask When Stuck

1. Does the Go source file show exactly what I'm implementing?
2. Have I checked the exact formula and constants?
3. Am I handling edge cases (rage capping, cooldowns, refunds)?
4. Is the proc only supposed to trigger in certain conditions?
5. Does this ability have stance restrictions?
6. Are there talent modifiers I'm missing?
7. Should this ability generate rage (active) or be dependent on rage generation (passive)?

## Resources Summary

**Detailed Reference**: WARRIOR_MECHANICS.md (459 lines)
**Quick Reference**: This file (implementation guide)
**Go Source**: 30+ files in wow-sims/classic/sim/warrior/
**TypeScript Pattern**: src/sim/RogueSimulator.ts
**Type Definitions**: src/types.ts (WarriorTalents interface)

Good luck! Warriors are significantly more complex than Rogues due to stances and active rage generation.
