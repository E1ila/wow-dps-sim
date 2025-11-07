# WoW Classic DPS Simulator

A World of Warcraft Classic Era DPS simulator for Rogue and Warrior classes. Simulates combat mechanics including auto-attacks, abilities, talents, procs, and buffs to calculate theoretical DPS output.

## Features

- **Accurate Combat Mechanics**: Implements WoW Classic hit tables, crit calculations, glancing blows, and weapon skill
- **Talent Support**: Full talent tree support for Rogues (Warrior in development)
- **Rotation System**: Flexible rotation system with conditional logic
- **Spec Files**: JSON-based character configurations for easy sharing and testing
- **CLI Interface**: Command-line interface with override options
- **Playback Mode**: Real-time simulation playback with visual output
- **Statistical Analysis**: Multiple iterations with averaged results

## Installation

```bash
npm install
npm run build
```

## Quick Start

Run a simulation using a spec file:

```bash
npm start -- rogue/daggers
```

Run with playback mode (real-time visualization):

```bash
npm start -- rogue/swords -d 1
```

Run in quiet mode (DPS only):

```bash
npm start -- rogue/galz -q
```

## Spec File Structure

Spec files are JSON configurations that define your character, gear, talents, and rotation. Here's an example:

```json
{
  "name": "Dagger Rogue",
  "class": "Rogue",
  "playerLevel": 60,
  "rotation": "snd?snd:cp5?evis:bs",
  "setup": {
    "avoidEviscerate": false,
    "refreshSndSecondsBeforeExpiry": 0.2
  },
  "talents": {
    "malice": 5,
    "improvedBackstab": 3,
    "sealFate": 5,
    "lethality": 5
  },
  "gearStats": {
    "attackPower": 1200,
    "critChance": 35.5,
    "hitChance": 9,
    "weaponSkill": 308,
    "mainHandWeapon": {
      "minDamage": 80,
      "maxDamage": 149,
      "speed": 1.8,
      "type": "Dagger",
      "enchant": "Crusader"
    }
  },
  "simulationConfig": {
    "fightLength": 60,
    "targetLevel": 63,
    "targetArmor": 3731,
    "iterations": 1000
  }
}
```

### Spec File Fields

#### Required Fields
- **name**: Display name for the spec
- **class**: Character class (`"Rogue"` or `"Warrior"`)
- **playerLevel**: Character level (typically 60)
- **talents**: Object containing talent values
- **gearStats**: Character stats and weapon configuration

#### Optional Fields
- **rotation**: Comma-separated rotation instructions (see Rotation Syntax below)
- **setup**: Additional configuration options
- **simulationConfig**: Simulation parameters (defaults provided if omitted)

## Rotation Syntax

The rotation system supports conditional logic using ternary-like syntax:

### Basic Syntax

```
CONDITION?TRUE_ACTION:FALSE_ACTION
```

- **CONDITION**: A condition to check (see available conditions below)
- **TRUE_ACTION**: Command to execute if condition is true
- **FALSE_ACTION**: Command to execute if condition is false (can be another condition)

### Available Conditions

**Buff Conditions:**
- `snd` - Slice and Dice buff is active
- `sndw` - Should refresh Slice and Dice (considering wait time)

**Combo Point Conditions:**
- `cp0` through `cp5` - Exact combo points (e.g., `cp5` = exactly 5 combo points)
- `cp1+` through `cp5+` - Minimum combo points (e.g., `cp3+` = at least 3 combo points)

### Available Commands

**Abilities:**
- `ss` - Sinister Strike
- `bs` - Backstab
- `hemo` - Hemorrhage
- `evis` - Eviscerate
- `snd` - Slice and Dice
- `skip` - Skip this rotation step

**Debug Commands:**
- `cp`, `cp1-cp5` - Set combo points
- `energy1-energy5` - Set energy

### Rotation Examples

**Simple rotation:**
```
"rotation": "cp5?evis:ss"
```
If 5 combo points, cast Eviscerate; otherwise cast Sinister Strike.

**Nested conditions:**
```
"rotation": "snd?snd:cp5?evis:ss"
```
1. If SnD buff active → refresh SnD
2. Else if 5 combo points → cast Eviscerate
3. Else → cast Sinister Strike

**Multiple rotation steps:**
```
"rotation": "snd?snd:skip,cp5?evis:ss"
```
Two rotation instructions that cycle. First checks SnD, second handles combo builders/finishers.

**Complex rotation:**
```
"rotation": "snd?snd:sndw?skip:cp5?evis:ss"
```
1. If SnD active → refresh SnD
2. Else if should wait for SnD → skip
3. Else if 5 combo points → cast Eviscerate
4. Else → cast Sinister Strike

## CLI Options

### Basic Options

```bash
npm start <spec-file> [options]
```

### Stat Overrides

Override gear stats from the spec file:

- `--ap <number>` or `--attack-power <number>` - Attack power
- `--crit <number>` - Crit chance percentage
- `--hit <number>` - Hit chance percentage
- `--weapon-skill <number>` - Weapon skill

### Weapon Overrides

**Main Hand:**
- `--mh-min <number>` - Min damage
- `--mh-max <number>` - Max damage
- `--mh-speed <number>` - Attack speed
- `--mh-type <type>` - Weapon type (Dagger, Sword, Mace, Fist)

**Off Hand:**
- `--oh-min <number>` - Min damage
- `--oh-max <number>` - Max damage
- `--oh-speed <number>` - Attack speed
- `--oh-type <type>` - Weapon type
- `--no-offhand` - Disable off hand weapon

### Simulation Options

- `--target-level <number>` - Target level (default: 63)
- `--armor <number>` - Target armor (default: 3731)
- `--length <number>` - Fight length in seconds (default: 60)
- `--iterations <number>` - Number of iterations (default: 1000)

### Display Options

- `-d, --speed <number>` - Playback speed (0=instant, 1=real-time, 0.5=half speed)
- `-q, --quiet` - Quiet mode (only print final DPS)

### Advanced Spec Override

Use `-s` or `--spec` to override multiple values:

Format: `talents|setup|gear|rotation`

```bash
npm start -- rogue/daggers -s "sealFate:5|avoidEviscerate:1|attackPower:1500"
```

## Examples

### Basic Simulation

```bash
npm start -- rogue/swords
```

### Test Gear Changes

```bash
npm start -- rogue/daggers --ap 1500 --crit 40
```

### Test Different Rotation

```bash
npm start -- rogue/daggers -s "|||cp5?evis:bs"
```

### Quick DPS Check

```bash
npm start -- rogue/galz -q --iterations 5000
```

### Watch Combat in Slow Motion

```bash
npm start -- rogue/swords -d 2
```

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Run in Development Mode

```bash
npm run dev -- rogue/daggers
```

### Compare Specs

```bash
npm run compare
```

## Contributing

When adding new conditions or commands:

1. Add condition to `checkCondition()` in the simulator class
2. Add command to `executeCommand()` in the simulator class
3. Add to ability enum in `types.ts` if needed
4. Update this README with the new syntax

## License

ISC
