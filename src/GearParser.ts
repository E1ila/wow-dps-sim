import {Database} from './Database';
import {EquippedItem, GearStats} from './SimulationSpec';
import {WeaponEnchant, WeaponType} from './types';
import {Enchant, Item} from "./Database.types";

type AccumulatedStats = {
    strength: number;
    agility: number;
    stamina: number;
    intellect: number;
    spirit: number;
    mana: number;
    attackPower: number;
    critChance: number;
    hitChance: number;
    weaponSkill: number;
    spellPower: number;
    spellCrit: number;
    spellHit: number;
    healingPower: number;
    mp5: number;
};

// Stat index mapping based on WoW Classic database format
const STAT_IDS = {
    STRENGTH: 0,
    AGILITY: 1,
    STAMINA: 2,
    INTELLECT: 3,
    SPIRIT: 4,
    SPELL_POWER: 5,
    ARCANE_POWER: 6,
    FIRE_POWER: 7,
    FROST_POWER: 8,
    HOLY_POWER: 9,
    NATURE_POWER: 10,
    SHADOW_POWER: 11,
    MP5: 12,
    SPELL_HIT: 13,
    SPELL_CRIT: 14,
    SPELL_HASTE: 15,
    SPELL_PENETRATION: 16,
    ATTACK_POWER: 17,
    MELEE_HIT: 18,
    MELEE_CRIT: 19,
    MELEE_HASTE: 20,
    ARMOR_PENETRATION: 21,
    EXPERTISE: 22,
    MANA: 23,
    ENERGY: 24,
    RAGE: 25,
    ARMOR: 26,
    RANGED_ATTACK_POWER: 27,
    DEFENSE: 28,
    BLOCK: 29,
    BLOCK_VALUE: 30,
    DODGE: 31,
    PARRY: 32,
    RESILIENCE: 33,
    HEALTH: 34,
    ARCANE_RESISTANCE: 35,
    FIRE_RESISTANCE: 36,
    FROST_RESISTANCE: 37,
    NATURE_RESISTANCE: 38,
    SHADOW_RESISTANCE: 39,
    BONUS_ARMOR: 40,
    HEALING_POWER: 41,
    SPELL_DAMAGE: 42,
    FERAL_ATTACK_POWER: 43,
};

export class GearParser {
    private readonly db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Parse gear items from JSON and calculate aggregate stats
     * @param gear Array of equipped items
     * @param existingGearStats Optional existing gear stats to preserve
     * @returns Calculated GearStats object
     */
    parse(gear: EquippedItem[], existingGearStats?: Partial<GearStats>): GearStats {
        if (!gear || gear.length === 0) {
            // Return minimal stats if no gear provided
            return {
                strength: 0,
                agility: 0,
                critChance: 0,
                hitChance: 0,
                weaponSkills: new Map<WeaponType, number>(),
                mainHandWeapon: existingGearStats?.mainHandWeapon || {
                    minDamage: 1,
                    maxDamage: 2,
                    speed: 2.0,
                    type: WeaponType.Sword,
                    enchant: WeaponEnchant.None,
                },
            };
        }

        // Initialize stats
        const stats: AccumulatedStats = {
            strength: 0,
            agility: 0,
            stamina: 0,
            intellect: 0,
            spirit: 0,
            mana: 0,
            attackPower: 0,
            critChance: 0,
            hitChance: 0,
            weaponSkill: 0,
            spellPower: 0,
            spellCrit: 0,
            spellHit: 0,
            healingPower: 0,
            mp5: 0,
        };

        const weaponSkills = new Map<WeaponType, number>();
        let mainHandWeapon: any = null;
        let offHandWeapon: any = null;
        let weaponSlotIndex = 0;

        // Process each gear item
        for (const equippedItem of gear) {
            const item = this.db.getItem(equippedItem.itemId);
            if (!item) {
                console.warn(`Warning: Item ${equippedItem.itemId} not found in database`);
                continue;
            }

            // Sum base item stats
            this.addItemStats(item.stats, STAT_IDS, stats, item);

            // Handle weapon skills
            if (item.weaponSkills) {
                for (let i = 0; i < item.weaponSkills.length; i++) {
                    const skillBonus = item.weaponSkills[i];
                    if (skillBonus > 0) {
                        const weaponType = i as WeaponType;
                        weaponSkills.set(weaponType, (weaponSkills.get(weaponType) || 0) + skillBonus);
                    }
                }
            }

            // Handle weapons (mainhand and offhand)
            if (item.type === 13 && item.weaponDamageMin !== undefined && item.weaponDamageMax !== undefined && item.weaponSpeed !== undefined) {
                const weapon = this.parseWeapon(item, equippedItem.enchantId);

                if (weaponSlotIndex === 0) {
                    mainHandWeapon = weapon;
                    weaponSlotIndex++;
                } else if (weaponSlotIndex === 1) {
                    offHandWeapon = weapon;
                    weaponSlotIndex++;
                }
            }

            // Add enchant stats
            if (equippedItem.enchantId) {
                const enchant = this.db.getEnchant(equippedItem.enchantId);
                if (enchant && enchant.stats) {
                    this.addItemStats(enchant.stats, STAT_IDS, stats, undefined, enchant);
                }
            }

            // Add random suffix stats
            if (equippedItem.randomSuffixId) {
                const suffix = this.db.getRandomSuffix(equippedItem.randomSuffixId);
                if (suffix && suffix.stats) {
                    this.addItemStats(suffix.stats, STAT_IDS, stats);
                }
            }
        }

        // Update with weapons
        if (!mainHandWeapon) {
            // If no weapon was found in gear, keep existing or use defaults
            mainHandWeapon = existingGearStats?.mainHandWeapon || {
                minDamage: 1,
                maxDamage: 2,
                speed: 2.0,
                type: WeaponType.Sword,
                enchant: WeaponEnchant.None,
            };
        }

        // Build final gearStats
        const gearStats: GearStats = {
            strength: stats.strength,
            agility: stats.agility,
            critChance: stats.critChance,
            hitChance: stats.hitChance,
            weaponSkills: weaponSkills,
            mainHandWeapon: mainHandWeapon,
        };

        if (offHandWeapon) {
            gearStats.offHandWeapon = offHandWeapon;
        }

        // Add optional stats if they exist
        if (stats.attackPower > 0) {
            gearStats.attackPower = stats.attackPower;
        }
        if (stats.spellPower > 0) {
            gearStats.spellPower = stats.spellPower;
        }
        if (stats.spellCrit > 0) {
            gearStats.spellCrit = stats.spellCrit;
        }
        if (stats.spellHit > 0) {
            gearStats.spellHit = stats.spellHit;
        }
        if (stats.intellect > 0) {
            gearStats.intellect = stats.intellect;
        }
        if (stats.spirit > 0) {
            gearStats.spirit = stats.spirit;
        }
        if (stats.mana > 0) {
            gearStats.mana = stats.mana;
        }
        if (stats.healingPower > 0) {
            gearStats.healingPower = stats.healingPower;
        }
        if (stats.mp5 > 0) {
            gearStats.mp5 = stats.mp5;
        }

        return gearStats;
    }

    private addItemStats(
        itemStats: number[] | undefined,
        statIds: Record<string, number>,
        stats: AccumulatedStats,
        item?: Item,
        enchant?: Enchant,
    ): void {
        if (!itemStats) return;

        for (let i = 0; i < itemStats.length; i++) {
            const value = itemStats[i];
            if (value === 0) continue;

            switch (i) {
                case statIds.STRENGTH:
                    stats.strength += value;
                    item && console.log(`Added ${value} strength from ${item.name}`);
                    enchant && console.log(`Added ${value} strength from ${enchant.name}`);
                    break;
                case statIds.AGILITY:
                    stats.agility += value;
                    break;
                case statIds.STAMINA:
                    stats.stamina += value;
                    break;
                case statIds.INTELLECT:
                    stats.intellect += value;
                    break;
                case statIds.SPIRIT:
                    stats.spirit += value;
                    break;
                case statIds.MANA:
                    stats.mana += value;
                    break;
                case statIds.ATTACK_POWER:
                case statIds.RANGED_ATTACK_POWER:
                case statIds.FERAL_ATTACK_POWER:
                    stats.attackPower += value;
                    break;
                case statIds.SPELL_POWER:
                case statIds.SPELL_DAMAGE:
                case statIds.ARCANE_POWER:
                case statIds.FIRE_POWER:
                case statIds.FROST_POWER:
                case statIds.HOLY_POWER:
                case statIds.NATURE_POWER:
                case statIds.SHADOW_POWER:
                    stats.spellPower += value;
                    break;
                case statIds.HEALING_POWER:
                    stats.healingPower += value;
                    break;
                case statIds.MP5:
                    stats.mp5 += value;
                    break;
                case statIds.SPELL_HIT:
                    stats.spellHit += value;
                    break;
                case statIds.SPELL_CRIT:
                    stats.spellCrit += value;
                    break;
                case statIds.MELEE_HIT:
                    stats.hitChance += value;
                    break;
                case statIds.MELEE_CRIT:
                    stats.critChance += value;
                    break;
            }
        }
    }

    private parseWeapon(item: any, enchantId: number): any {
        const weaponTypeMap: { [key: number]: WeaponType } = {
            0: WeaponType.Axe,
            1: WeaponType.Axe,
            2: WeaponType.Bow,
            3: WeaponType.Gun,
            4: WeaponType.Mace,
            5: WeaponType.Polearm,
            6: WeaponType.Sword,
            7: WeaponType.Staff,
            10: WeaponType.Fist,
            13: WeaponType.Dagger,
            15: WeaponType.Dagger,
        };

        const weaponEnchantMap: { [key: number]: string } = {
            1900: 'Crusader',
            803: '+3 damage',
            1894: '+4 damage',
            1898: '+5 damage',
            1897: '+15 agility',
            2646: '+25 agility',
        };

        let enchantType = WeaponEnchant.None;
        if (enchantId && weaponEnchantMap[enchantId]) {
            enchantType = weaponEnchantMap[enchantId] as WeaponEnchant;
        }

        return {
            minDamage: item.weaponDamageMin,
            maxDamage: item.weaponDamageMax,
            speed: item.weaponSpeed,
            type: weaponTypeMap[item.weaponType || 6] || WeaponType.Sword,
            enchant: enchantType,
        };
    }
}

