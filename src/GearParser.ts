import {Database} from './Database';
import {EquippedItem, Stats} from './SimulationSpec';
import {WEAPON_ENCHANT_SPELL_IDS, WeaponEnchant, WeaponType} from './types';
import {Enchant, Item} from "./Database.types";

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
     * @returns Calculated GearStats object
     */
    aggregateStats(gear: EquippedItem[]): Stats {
        if (!gear || gear.length === 0) {
            // Return minimal stats if no gear provided
            return {
                strength: 0,
                agility: 0,
                critChance: 0,
                hitChance: 0,
                weaponSkills: new Map<WeaponType, number>(),
                mh: {
                    min: 1,
                    max: 2,
                    speed: 2.0,
                    type: WeaponType.Sword,
                    enchant: WeaponEnchant.None,
                },
            };
        }

        // Initialize stats
        const stats: Partial<Stats> = {
            strength: 0,
            agility: 0,
            stamina: 0,
            intellect: 0,
            spirit: 0,
            mana: 0,
            attackPower: 0,
            critChance: 0,
            hitChance: 0,
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
                // console.warn(`Warning: Item ${equippedItem.itemId} not found in database`);
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
                const weapon = this.parseWeapon(item, equippedItem.spellId);

                if (weaponSlotIndex === 0) {
                    mainHandWeapon = weapon;
                    weaponSlotIndex++;
                } else if (weaponSlotIndex === 1) {
                    offHandWeapon = weapon;
                    weaponSlotIndex++;
                }
            }

            // Add enchant stats
            if (equippedItem.spellId) {
                const enchant = this.db.getEnchant(equippedItem.spellId);
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
            mainHandWeapon = {
                minDamage: 1,
                maxDamage: 2,
                speed: 2.0,
                type: WeaponType.Sword,
                enchant: WeaponEnchant.None,
            };
        }

        return {
            ...stats,
            weaponSkills,
            mh: mainHandWeapon,
            oh: offHandWeapon,
        } as Stats;
    }

    private addItemStats(
        itemStats: number[] | undefined,
        statIds: Record<string, number>,
        stats: Partial<Stats>,
        item?: Item,
        enchant?: Enchant,
    ): void {
        if (!itemStats) return;

        for (let i = 0; i < itemStats.length; i++) {
            const value = itemStats[i];
            if (value === 0) continue;

            switch (i) {
                case statIds.STRENGTH:
                    stats.strength = (stats.strength || 0) + value;
                    // item && console.log(`Added ${value} strength from ${item.name}`);
                    // enchant && console.log(`Added ${value} strength from ${enchant.name}`);
                    break;
                case statIds.AGILITY:
                    stats.agility = (stats.agility || 0) + value;
                    // item && console.log(`Added ${value} agility from ${item.name}`);
                    // enchant && console.log(`Added ${value} agility from ${enchant.name}`);
                    break;
                case statIds.STAMINA:
                    stats.stamina = (stats.stamina || 0) + value;
                    break;
                case statIds.INTELLECT:
                    stats.intellect = (stats.intellect || 0) + value;
                    break;
                case statIds.SPIRIT:
                    stats.spirit = (stats.spirit || 0) + value;
                    break;
                case statIds.MANA:
                    stats.mana = (stats.mana || 0) + value;
                    break;
                case statIds.ATTACK_POWER:
                    stats.attackPower = (stats.attackPower || 0) + value;
                    // item && console.log(`Added ${value} attack power from ${item.name}`);
                    // enchant && console.log(`Added ${value} attack power from ${enchant.name}`);
                    break;
                case statIds.RANGED_ATTACK_POWER:
                case statIds.FERAL_ATTACK_POWER:
                    break;
                case statIds.SPELL_POWER:
                case statIds.SPELL_DAMAGE:
                case statIds.ARCANE_POWER:
                case statIds.FIRE_POWER:
                case statIds.FROST_POWER:
                case statIds.HOLY_POWER:
                case statIds.NATURE_POWER:
                case statIds.SHADOW_POWER:
                    stats.spellPower = (stats.spellPower || 0) + value;
                    break;
                case statIds.HEALING_POWER:
                    stats.healingPower = (stats.healingPower || 0) + value;
                    break;
                case statIds.MP5:
                    stats.mp5 = (stats.mp5 || 0) + value;
                    break;
                case statIds.SPELL_HIT:
                    stats.spellHit = (stats.spellHit || 0) + value;
                    break;
                case statIds.SPELL_CRIT:
                    stats.spellCrit = (stats.spellCrit || 0) + value;
                    break;
                case statIds.MELEE_HIT:
                    stats.hitChance = (stats.hitChance || 0) + value;
                    break;
                case statIds.MELEE_CRIT:
                    stats.critChance = (stats.critChance || 0) + value;
                    // item && console.log(`Added ${value} crit from ${item.name}`);
                    // enchant && console.log(`Added ${value} crit from ${enchant.name}`);
                    break;
            }
        }
    }

    private parseWeapon(item: any, spellId?: number): any {
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

        let enchantType = WeaponEnchant.None;
        if (spellId && WEAPON_ENCHANT_SPELL_IDS[spellId]) {
            enchantType = WEAPON_ENCHANT_SPELL_IDS[spellId];
        }

        return {
            min: item.weaponDamageMin,
            max: item.weaponDamageMax,
            speed: item.weaponSpeed,
            type: weaponTypeMap[item.weaponType || 6] || WeaponType.Sword,
            enchant: enchantType,
        };
    }
}

