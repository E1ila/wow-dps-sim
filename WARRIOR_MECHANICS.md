# Comprehensive Warrior Mechanics Reference

This document provides a detailed breakdown of WoW Classic Warrior mechanics from the official wow-sims simulator implementation. Use this as a reference when implementing WarriorSimulator.

## File Locations (Source Analysis)

All source files are in: `/Users/tal/dev/node.js/wow-sims/classic/sim/warrior/`

Key files to reference:
- `warrior.go` - Core class structure
- `stances.go` - Stance mechanics
- `talents.go` - Talent application
- `bloodthirst.go`, `mortal_strike.go`, `execute.go` - Core abilities
- `heroic_strike_cleave.go` - Queue system

## Quick Reference Tables

### Rage Generation

| Source | Rage | Condition |
|--------|------|-----------|
| White hit damage | Varies | Default generation |
| Bloodrage instant | 10 + 2x ImprovedBR | Cooldown 60s |
| Bloodrage/sec | 1 per second | 10 seconds duration |
| Berserker Rage instant | 5x ImprovedBR | Only Berserker stance |
| Berserker Rage (melee hit taken) | 2.0 per hit | During aura, 10s duration |
| Anger Management | 1 | Every 3 seconds (talent) |
| Unbridled Wrath | 1 | 8% per rank on white hit (talent) |
| Shield Specialization | 1 | 20% per rank on block (talent) |

### Ability Costs & Cooldowns

| Ability | Cost | CD | Stance(s) |
|---------|------|----|----|
| Bloodthirst | 30 | 6s | Any |
| Mortal Strike | 30 | 6s | Any |
| Execute | 15+all | - | Battle/Berserker |
| Whirlwind | 25 | 10s | Berserker |
| Heroic Strike | 15 (-ImprovedHS) | - | Any |
| Cleave | 20 | - | Any |
| Revenge | 5 | 5s | Defensive |
| Overpower | 5 | 5s | Battle |
| Rend | 10 | - | Battle/Defensive |
| Slam | 15 | - (1.5-0.5s cast) | Any |
| Shield Slam | 20 | 6s | Any (needs shield) |
| Recklessness | 0 | 30m | Berserker |
| Bloodrage | 0 | 60s | Any |
| Berserker Rage | 0 | 30s | Berserker |

### Ability Damage Formulas

| Ability | Base Damage | Scaling | Notes |
|---------|-------------|---------|-------|
| Bloodthirst | 0 | 0.45 x AP | Fury primary |
| Mortal Strike | 160 | MH normalized + AP | Arms primary |
| Whirlwind | 0 | MH normalized | Multi-target |
| Execute | 600 | 15 per rage spent | Execute phase only |
| Heroic Strike | 138-157 | Weapon + AP | Swing replacement |
| Cleave | 50-220 | Weapon + AP | 2-target, scaled by talent |
| Overpower | 35 | MH normalized + AP | Cannot be dodged |
| Rend/tick | 9-21 | Fixed per level | 4-7 ticks |
| Slam | 87 | Weapon + AP | Cast time |
| Shield Slam | 342-358 | 2 x BlockValue + 0.15 x AP | Shield ability |
| Revenge | 64-99 | Fixed (with set bonuses) | Proc based |

### Talent Modifiers

**Arms Tree Key Talents:**
- Cruelty: +1% crit per rank
- Deflection: +1 parry per rank
- Improved Rend: 1.15x-1.35x multiplier
- Improved Mortal Strike: Better rotation flow
- Impale: +10% crit damage per rank
- Improved Overpower: +25% crit per rank
- Toughness: +2% armor per rank
- Two-Handed Specialization: +1% dmg per rank

**Fury Tree Key Talents:**
- Unbridled Wrath: 8% per rank for 1 rage on white hit
- Flurry: 1.1x-1.3x attack speed, 3 stacks (talent rank dependent)
- Improved Bloodthirst: Better BT scaling
- Improved Berserker Rage: 5 rage per rank instant + damage scaling
- Dual Wield Specialization: +5% OH damage per rank
- Enrage: +5% damage per rank, 12 stacks, refreshes on crit

**Protection Tree Key Talents:**
- Shield Specialization: +1 block per rank, 20% proc for 1 rage
- Defiance: +3% per rank defensive stance threat
- Improved Shield Block: Better blocking
- Improved Revenge: Reduces cooldown/cost
- Last Stand: Emergency heal cooldown

## Stance System Details

### Battle Stance (BattleStance)
```
Threat Multiplier: 0.8x (reduced threat)
Damage Taken: Normal
Damage Dealt: Normal
Default For: Arms tree
Can Use: Most abilities
```

**Exclusive effect category**: "Stance"
**Modifier**: -20% threat (0.8 multiplier)

### Defensive Stance (DefensiveStance)
```
Threat Multiplier: 1.3x * (1 + 0.03 * Defiance talent)
Damage Taken: 0.9x (10% mitigation)
Damage Dealt: 0.9x (10% reduction)
Default For: Protection tree
Can Use: Revenge, Sunder Armor, Shield abilities
```

**Exclusive effect category**: "Stance"
**Threat Calculation**: 1.3 * [1, 1.03, 1.06, 1.09, 1.12, 1.15][Defiance ranks]
**Damage Modifiers**: Both taken and dealt reduced by 0.9x

### Berserker Stance (BerserkerStance)
```
Threat Multiplier: 0.8x (reduced threat)
Damage Taken: 1.1x (+10% damage taken)
Damage Dealt: Normal
Crit Bonus: +3% crit rating
Default For: Fury tree
Can Use: Whirlwind, Recklessness, Berserker Rage, most others
```

**Exclusive effect category**: "Stance"
**Dynamic Stat Bonus**: +3% crit rating (added to stats dynamically on gain, removed on expire)

## Deep Dives Into Complex Systems

### Heroic Strike/Cleave Queue System

The queue system prevents "sim clipping" where abilities trigger too quickly:

```typescript
// Queue delay configured in simulation setup
queuedRealismICD = { duration: QueueDelay (default 500ms) }

// When queue ability is cast:
1. Mark as "queued" (prevents re-queuing)
2. Check CD is ready
3. Schedule activation after delay
4. Activate queue aura on next swing
5. Queue aura causes next auto-attack to become HS/Cleave

// Queue aura deactivates after ability fires
```

**Key Mechanics:**
- Can only queue if no current queue active
- Queue aura lasts until next swing happens
- Next swing is replaced with queued ability
- If not enough rage, queue fails
- Removes "miss penalty" for dual wield (no -19% accuracy for HS/Cleave)

### Deep Wounds (Crit-triggered Bleed)

```
Talent: Requires 1-3 points
Proc: On ANY critical strike
Duration: 4 ticks x 3 seconds = 12 seconds
Damage Per Tick: (0.2 * avgWeaponDamage * attackerDamageMultiplier) / 4 per rank

Damage Scaling:
- Rank 1: 60% of weapon damage (0.2 rank multiplier)
- Rank 2: 80% of weapon damage
- Rank 3: 100% of weapon damage

Snapshot System:
- Captures average weapon damage at cast time
- Includes all active multipliers (Enrage, buffs, etc.)
- Separate damage calculation for main hand vs off-hand
```

**Implementation Note**: Deep Wounds uses a custom damage formula:
```
newDamage = (avgWeaponDamage * 0.5 * adm) * 0.2 * rankMultiplier
dot.SnapshotBaseDamage = newDamage / 4.0  // Spread over 4 ticks
```

### Rend (DoT Ability)

```
Levels & Ticks:
- Level 25: 9 damage x 5 ticks (3s each) = 15s duration
- Level 40: 14 damage x 7 ticks = 21s duration
- Level 50: 18 damage x 7 ticks = 21s duration
- Level 60: 21 damage x 7 ticks = 21s duration

Talent Multiplier (Improved Rend):
- Rank 1: 1.15x
- Rank 2: 1.25x
- Rank 3: 1.35x

Snapshot Mechanics:
- Each tick uses base damage
- DoT applies with snapshottable damage
- Refreshing applies new damage calculation
```

### Sweeping Strikes (Multi-target)

```
Activation: 30 rage cost, 30s cooldown
Duration: 10 seconds, 5 stacks
Effect On Hit: 
- Check if Sweeping Strikes aura active
- If proc type is Whirlwind:
  - Use normalized damage formula
  - Damage = Unit.MHNormalizedWeaponDamage(sim, AP)
- If other proc type:
  - Use exact damage from source spell
  - Undo armor reduction to get raw value
  - Apply to secondary target
- Remove 1 stack per proc
- Cannot proc off itself (ProcMask: Empty)

Target Selection: Env.NextTargetUnit(result.Target)
Damage Type: Identical to source ability
Threat: Typically 1x (like source)
```

### Flurry (Attack Speed Buff)

```
Trigger: On critical strike (any weapon, detected in OnSpellHitDealt)
Activation: Triggers aura with 3 stacks
Duration: Doesn't expire (remains until stacks consumed)
Stack Consumption: 1 per white hit with 500ms ICD

Attack Speed Bonus:
- Rank 1: 1.1x (10% faster)
- Rank 2: 1.15x (15% faster)
- Rank 3: 1.2x (20% faster)
- Rank 4: 1.25x (25% faster)
- Rank 5: 1.3x (30% faster)

Stack Behavior:
1. Crit happens -> Flurry activates with 3 stacks
2. White hit consumes 1 stack (with 500ms ICD protection)
3. When stacks reach 0, Flurry deactivates
4. Next crit refreshes to 3 stacks again

Exclusive Effect: Yes (only one Flurry rank active)
Priority: attackSpeedBonus value
```

### Enrage (Fury Talent)

```
Talent: Requires 1-5 points
Activation: On critical strike by enemy (in execute phase)
Effect: +5% damage per rank to physical damage
Duration: 12 seconds (resets with each crit)
Max Stacks: 12 (full uptime)

Stacking Rules:
- Gains 12 stacks on activation
- Loses 1 stack per melee hit (auto-attack or ability)
- Refreshes to 12 on critical strike
- Expires when all stacks consumed

Damage Multiplier:
Rank 1: 1.05x
Rank 2: 1.10x
Rank 3: 1.15x
Rank 4: 1.20x
Rank 5: 1.25x

Exclusive Effect: Yes
Priority: 5 * rankValue (higher rank = higher priority)
```

## Ability Priority Concepts

### DPS Rotation (Fury, Berserker Stance)

**Priority Order:**
1. **Maintain Stance**: Keep in Berserker Stance
2. **Cooldowns**: Recklessness (on CD when rage available)
3. **Execute Phase**: If <20% HP, Execute with all rage
4. **Main Rotation**:
   - Bloodthirst (6s CD, 30 rage)
   - Whirlwind if 2+ targets (10s CD, 25 rage)
   - Heroic Strike if rage capping (queue next swing, 15 rage)
   - Cleave (multi-target, 20 rage)
5. **Resource Gen**: Bloodrage/Berserker Rage on CD
6. **Filler**: Auto-attacks, maintain Heroic Strike queue

**Rage Management**: Never cap at 100 rage, execute to cap

### DPS Rotation (Arms, Battle Stance)

**Priority Order:**
1. **Maintain Stance**: Keep in Battle Stance
2. **Proc Management**: Overpower on proc (8% dodge chance from target)
3. **Main Rotation**:
   - Mortal Strike (6s CD, 30 rage)
   - Deep Wounds (passive on crits)
   - Rend (maintain on target, 10 rage)
4. **Execute Phase**: Execute with rage
5. **Fillers**: Heroic Strike queue, auto-attacks
6. **Optional**: Bloodthirst, Slam for variety

### Tank Rotation (Protection, Defensive Stance)

**Priority Order:**
1. **Maintain Stance**: Keep in Defensive Stance
2. **Threat Management**: Sunder Armor (stack on target)
3. **Reactive Abilities**:
   - Revenge on proc (from dodge/parry/block)
   - Shield Block (next melee block)
4. **Threat Maintenance**:
   - Shield Slam (6s CD, 20 rage, requires shield)
   - Thunder Clap (AOE threat, 10 rage)
5. **Recovery**: Shield Wall/Last Stand on demand
6. **Resource Gen**: Generate from auto-attacks and blocks

## Stat Conversions & Formulas

### Attack Power Scaling
```
Strength -> Attack Power: +2 AP per point (warrior-specific, highest in game)
Attack Power -> Damage: Varies by ability (0.15-0.45 coefficient)
```

### Critical Strike
```
Agility -> Crit Chance: 
- Base: Agi * CritPerAgiAtLevel[playerLevel] * CritRatingPerCritChance
- At level 60: ~1 crit per 20 agility

Crit Rating -> Crit Chance:
- ~14 crit rating = 1% crit (varies by level)
- Full formula: (agility_bonus + crit_rating) / CritRatingPerCritChance

Talent Bonuses:
- Cruelty: +1% per rank
- Recklessness: +100% (effectively guaranteed)
```

### Hit Chance
```
Base Miss: 5% (against same level)
Hit Rating Reduction: -1% per ~15 hit rating (level dependent)
Weapon Skill: Soft cap at target level + 5

Glancing Blow (off-hand only):
- Can't be crit or parried
- Damage reduced by 25% + (attacker_skill - target_defense) * 0.05
- Range: 35-45% reduction at level

Dodges Remaining After Hit:
- Base: ~5% + (target_def - attacker_skill) * 0.04%
- Reduced by hit and precision talents
```

### Rage Generation Formula
```
Rage from Damage Dealt:
rageGained = damageDealt / (RageConversion * 10)
RageConversion = 0.00965 * playerLevel + 0.1007

At level 60: RageConversion ≈ 0.679
So 1 point of damage ≈ 0.0147 rage

Example: 100 damage hit generates ~1.47 rage

Special Cases:
- Melee/Ranged attacks: Direct formula
- Spell damage (Berserker Rage): Multiplied by 2.5
- Damage taken (Berserker Rage): 2.0 rage per melee hit (fixed)
```

### Damage Reductions
```
Defensive Stance: 0.9x (10% reduction to all damage)
Enrage: 1 + (0.05 * rankValue) damage (physical only)
Recklessness: +0.2x damage taken penalty
```

## Implementation Checklist

### Core Systems (Must Have)
- [ ] Rage resource (0-100)
- [ ] Rage generation from white hits
- [ ] Stance system (Battle/Defensive/Berserker) exclusive
- [ ] Stance-specific ability restrictions
- [ ] Bloodthirst ability
- [ ] Mortal Strike ability
- [ ] Execute ability
- [ ] Auto-attack damage generation
- [ ] Attack table (hit/crit/miss/dodge)
- [ ] Damage calculation with AP scaling

### Ability Systems (Important)
- [ ] Heroic Strike queue system
- [ ] Cleave multi-target system
- [ ] Revenge proc (dodge/parry/block)
- [ ] Overpower proc (dodge trigger)
- [ ] Deep Wounds bleed (crit trigger)
- [ ] Rend DoT ability
- [ ] Whirlwind AOE
- [ ] Slam cast-time ability
- [ ] Cooldown tracking

### Resource Generation (Important)
- [ ] Bloodrage cooldown (passive generation)
- [ ] Berserker Rage cooldown
- [ ] Anger Management talent
- [ ] Unbridled Wrath talent
- [ ] Shield Specialization talent

### Buff/Debuff (Nice to Have)
- [ ] Battle Shout (party buff)
- [ ] Flurry (crit-triggered attack speed)
- [ ] Enrage (crit-triggered damage)
- [ ] Sunder Armor (stacking debuff)
- [ ] Sweeping Strikes (multi-target)
- [ ] Recklessness (major cooldown)

### Talent Application (Nice to Have)
- [ ] Impale (crit damage bonus)
- [ ] Two-Handed/One-Handed Specialization
- [ ] Weapon specializations (crit bonuses)
- [ ] Cruelty (crit rating)
- [ ] Toughness (armor)

## Testing Considerations

**High Priority Test Cases:**
1. Rage caps at 100 maximum
2. Rage spent on ability reduces total
3. Abilities refund 80% on miss/dodge
4. Stance switching loses excess rage
5. Auto-attacks generate rage
6. Execute only works in execute phase
7. Overpower only works after enemy dodge
8. Revenge only works after dodge/parry/block

**Edge Cases:**
1. Multiple procs in same swing (weapon skill vs talent)
2. Snapshot damage with changing buffs
3. Rage generation during high-damage scenarios
4. Stack consumption order (Enrage vs Flurry)
5. Queue delays preventing clipping
6. Shield requirement checks for Shield Slam

**Damage Output Verification:**
- Compare single ability damage vs reference values
- Verify AP scaling coefficients
- Check crit damage multipliers
- Validate talent modifier application
- Confirm threat calculations

