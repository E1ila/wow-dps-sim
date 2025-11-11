import {Database} from './Database';
import {EquippedItem, GearStats} from './SimulationSpec';
import {WeaponEnchant, WeaponType} from './types';

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
                weaponSkill: 300,
                mainHandWeapon: existingGearStats?.mainHandWeapon || {
                    minDamage: 1,
                    maxDamage: 2,
                    speed: 2.0,
                    type: WeaponType.Sword,
                    enchant: WeaponEnchant.None,
                },
            };
        }

        // Stat index mapping based on WoW Classic database format
        const STAT_IDS = {
            STRENGTH: 0,
            AGILITY: 1,
            STAMINA: 2,
            INTELLECT: 3,
            SPIRIT: 4,
            MANA: 5,
            ARMOR: 26,
            HIT_RATING: 28,
            CRIT_RATING: 29,
            ATTACK_POWER: 31,
            BLOCK_VALUE: 30,
            SPELL_POWER: 37,
            FIRE_SPELL_POWER: 38,
            FROST_SPELL_POWER: 39,
            SHADOW_SPELL_POWER: 40,
            HEALING_POWER: 41,
            MP5: 43,
        };

        // Conversion constants
        const HIT_RATING_PER_PERCENT = 15.77; // Level 60
        const CRIT_RATING_PER_PERCENT = 14.0; // Level 60

        // Initialize stats
        const stats: any = {
            strength: 0,
            agility: 0,
            stamina: 0,
            intellect: 0,
            spirit: 0,
            mana: 0,
            attackPower: 0,
            critChance: 0,
            hitChance: 0,
            weaponSkill: 300, // Base weapon skill
            spellPower: 0,
            spellCrit: 0,
            spellHit: 0,
            healingPower: 0,
            mp5: 0,
        };

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
            this.addItemStats(item.stats, STAT_IDS, stats, HIT_RATING_PER_PERCENT, CRIT_RATING_PER_PERCENT);

            // Handle weapon skills
            if (item.weaponSkills) {
                for (let i = 0; i < item.weaponSkills.length; i++) {
                    const skillBonus = item.weaponSkills[i];
                    if (skillBonus > 0) {
                        stats.weaponSkill = Math.max(stats.weaponSkill, 300 + skillBonus);
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
                    this.addItemStats(enchant.stats, STAT_IDS, stats, HIT_RATING_PER_PERCENT, CRIT_RATING_PER_PERCENT);
                }
            }

            // Add random suffix stats
            if (equippedItem.randomSuffixId) {
                const suffix = this.db.getRandomSuffix(equippedItem.randomSuffixId);
                if (suffix && suffix.stats) {
                    this.addItemStats(suffix.stats, STAT_IDS, stats, HIT_RATING_PER_PERCENT, CRIT_RATING_PER_PERCENT);
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
            weaponSkill: stats.weaponSkill,
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
        STAT_IDS: any,
        stats: any,
        HIT_RATING_PER_PERCENT: number,
        CRIT_RATING_PER_PERCENT: number
    ): void {
        if (!itemStats) return;

        for (let i = 0; i < itemStats.length; i++) {
            const value = itemStats[i];
            if (value === 0) continue;

            switch (i) {
                case STAT_IDS.STRENGTH:
                    stats.strength += value;
                    break;
                case STAT_IDS.AGILITY:
                    stats.agility += value;
                    break;
                case STAT_IDS.STAMINA:
                    stats.stamina += value;
                    break;
                case STAT_IDS.INTELLECT:
                    stats.intellect += value;
                    break;
                case STAT_IDS.SPIRIT:
                    stats.spirit += value;
                    break;
                case STAT_IDS.MANA:
                    stats.mana += value;
                    break;
                case STAT_IDS.HIT_RATING:
                    stats.hitChance += value / HIT_RATING_PER_PERCENT;
                    break;
                case STAT_IDS.CRIT_RATING:
                    stats.critChance += value / CRIT_RATING_PER_PERCENT;
                    break;
                case STAT_IDS.ATTACK_POWER:
                    stats.attackPower += value;
                    break;
                case STAT_IDS.SPELL_POWER:
                case STAT_IDS.FIRE_SPELL_POWER:
                case STAT_IDS.FROST_SPELL_POWER:
                case STAT_IDS.SHADOW_SPELL_POWER:
                    stats.spellPower += value;
                    break;
                case STAT_IDS.HEALING_POWER:
                    stats.healingPower += value;
                    break;
                case STAT_IDS.MP5:
                    stats.mp5 += value;
                    break;
            }
        }
    }

    private parseWeapon(item: any, enchantId: number): any {
        const weaponTypeMap: { [key: number]: WeaponType } = {
            1: WeaponType.Sword,
            2: WeaponType.Dagger,
            4: WeaponType.Mace,
            6: WeaponType.Fist,
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
            type: weaponTypeMap[item.weaponType || 1] || WeaponType.Sword,
            enchant: enchantType,
        };
    }
}

