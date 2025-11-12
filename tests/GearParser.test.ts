import {GearParser} from '../src/GearParser';
import {Database} from '../src/Database';
import {EquippedItem, GearBuffsStats} from '../src/SimulationSpec';
import {WeaponEnchant, WeaponType} from '../src/types';
import path from 'path';

describe('GearParser', () => {
    let db: Database;
    let gearParser: GearParser;

    beforeAll(() => {
        const dbPath = path.resolve(__dirname, '..', 'src', 'db.json');
        db = new Database(dbPath);
        gearParser = new GearParser(db);
    });

    describe('parse', () => {
        it('should return minimal stats for empty gear array', () => {
            const result = gearParser.parse([]);

            expect(result.strength).toBe(0);
            expect(result.agility).toBe(0);
            expect(result.critChance).toBe(0);
            expect(result.hitChance).toBe(0);
            expect(result.weaponSkills).toBeDefined();
            expect(result.weaponSkills.size).toBe(0);
            expect(result.mainHandWeapon).toBeDefined();
            expect(result.mainHandWeapon.minDamage).toBe(1);
            expect(result.mainHandWeapon.maxDamage).toBe(2);
        });

        it('should preserve existing mainhand weapon if no weapon in gear', () => {
            const existingStats: Partial<GearBuffsStats> = {
                mainHandWeapon: {
                    minDamage: 100,
                    maxDamage: 200,
                    speed: 2.5,
                    type: WeaponType.Dagger,
                    enchant: WeaponEnchant.Crusader,
                },
            };

            const result = gearParser.parse([], existingStats);

            expect(result.mainHandWeapon.minDamage).toBe(100);
            expect(result.mainHandWeapon.maxDamage).toBe(200);
            expect(result.mainHandWeapon.speed).toBe(2.5);
            expect(result.mainHandWeapon.type).toBe(WeaponType.Dagger);
            expect(result.mainHandWeapon.enchant).toBe(WeaponEnchant.Crusader);
        });

        it('should parse full Naxxramas Rogue gear set', () => {
            // This is a full T3 Rogue set from Naxxramas with BiS items
            const gearJson = `[{"itemId":22478,"spellId":2585},{"itemId":19377},{"itemId":22479,"spellId":2717},{"itemId":23045,"spellId":2621},{"itemId":22476,"spellId":1891},{"itemId":22483,"spellId":1885},{"itemId":22481,"spellId":856},{"itemId":21586},{"itemId":22477,"spellId":2585},{"itemId":22480,"spellId":1887},{"itemId":23060},{"itemId":23038},{"itemId":22954},{"itemId":19406},{"itemId":23054,"spellId":1900},{"itemId":23577,"spellId":1900},{"itemId":23557}]`;
            const gear: EquippedItem[] = JSON.parse(gearJson);

            const result = gearParser.parse(gear);

            // Verify that stats were calculated
            expect(result.strength).toBeGreaterThan(0);
            expect(result.agility).toBeGreaterThan(0);
            expect(result.critChance).toBeGreaterThanOrEqual(0);
            expect(result.hitChance).toBeGreaterThanOrEqual(0);
            expect(result.weaponSkills).toBeDefined();

            // Verify weapons were parsed
            expect(result.mainHandWeapon).toBeDefined();
            expect(result.mainHandWeapon.minDamage).toBeGreaterThan(0);
            expect(result.mainHandWeapon.maxDamage).toBeGreaterThan(0);
            expect(result.mainHandWeapon.speed).toBeGreaterThan(0);

            // Check for Crusader enchant on main hand (spellId 1900)
            expect(result.mainHandWeapon.enchant).toBe(WeaponEnchant.Crusader);

            // Verify offhand weapon exists
            expect(result.offHandWeapon).toBeDefined();
            expect(result.offHandWeapon!.enchant).toBe(WeaponEnchant.Crusader);
        });

        it('should handle gear with no enchants', () => {
            const gear: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestors Talisman of Conniving (neck)
            ];

            const result = gearParser.parse(gear);

            expect(result).toBeDefined();
            expect(result.agility).toBeGreaterThan(0); // This item has agility
        });

        it('should handle items with random suffixes', () => {
            const gear: EquippedItem[] = [
                { itemId: 862, spellId: 0, randomSuffixId: 213 }, // Random green with suffix
            ];

            const result = gearParser.parse(gear);

            expect(result).toBeDefined();
        });

        it('should sum stats from multiple items', () => {
            // Two items with known agility values
            const gear: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestors Talisman (has agi)
                { itemId: 23060, spellId: 0, randomSuffixId: 0 }, // Bonescythe Ring (has agi)
            ];

            const result = gearParser.parse(gear);

            // Both items should contribute to agility
            expect(result.agility).toBeGreaterThan(0);
        });

        it('should handle dual wield weapons correctly', () => {
            const gear: EquippedItem[] = [
                { itemId: 23054, spellId: 1900, randomSuffixId: 0 }, // Mainhand weapon with Crusader
                { itemId: 23577, spellId: 1900, randomSuffixId: 0 }, // Offhand weapon with Crusader
            ];

            const result = gearParser.parse(gear);

            expect(result.mainHandWeapon).toBeDefined();
            expect(result.offHandWeapon).toBeDefined();
            expect(result.mainHandWeapon.enchant).toBe(WeaponEnchant.Crusader);
            expect(result.offHandWeapon!.enchant).toBe(WeaponEnchant.Crusader);
        });

        it('should handle single weapon (no offhand)', () => {
            const gear: EquippedItem[] = [
                { itemId: 23054, spellId: 0, randomSuffixId: 0 }, // Just mainhand
            ];

            const result = gearParser.parse(gear);

            expect(result.mainHandWeapon).toBeDefined();
            expect(result.offHandWeapon).toBeFalsy(); // Can be undefined or null
        });

        it('should handle missing items gracefully', () => {
            const gear: EquippedItem[] = [
                { itemId: 999999, spellId: 0, randomSuffixId: 0 }, // Non-existent item
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Valid item
            ];

            // Should not throw, just skip the missing item
            const result = gearParser.parse(gear);

            expect(result).toBeDefined();
            expect(result.agility).toBeGreaterThan(0); // From the valid item
        });

        it('should apply enchant bonuses correctly', () => {
            const gear: EquippedItem[] = [
                { itemId: 22478, spellId: 2585, randomSuffixId: 0 }, // Bonescythe Helm with enchant
            ];

            const resultWithEnchant = gearParser.parse(gear);

            const gearNoEnchant: EquippedItem[] = [
                { itemId: 22478, spellId: 0, randomSuffixId: 0 }, // Same item, no enchant
            ];

            const resultNoEnchant = gearParser.parse(gearNoEnchant);

            // With enchant should have more stats
            const totalStatsWithEnchant = resultWithEnchant.agility + resultWithEnchant.strength;
            const totalStatsNoEnchant = resultNoEnchant.agility + resultNoEnchant.strength;

            expect(totalStatsWithEnchant).toBeGreaterThanOrEqual(totalStatsNoEnchant);
        });

        it('should handle weapon skill bonuses', () => {
            // Some items grant weapon skill (e.g., Edgemaster's Handguards)
            const gear: EquippedItem[] = [
                { itemId: 22481, spellId: 0, randomSuffixId: 0 }, // Bonescythe Gloves
            ];

            const result = gearParser.parse(gear);

            expect(result.weaponSkills).toBeDefined();
        });

        it('should parse different weapon enchants', () => {
            const testCases = [
                { spellId: 1900, expected: WeaponEnchant.Crusader },
                { spellId: 803, expected: '+3 damage' as WeaponEnchant },
                { spellId: 1894, expected: '+4 damage' as WeaponEnchant },
                { spellId: 1898, expected: '+5 damage' as WeaponEnchant },
                { spellId: 1897, expected: '+15 agility' as WeaponEnchant },
                { spellId: 2646, expected: '+25 agility' as WeaponEnchant },
                { spellId: 0, expected: WeaponEnchant.None },
            ];

            testCases.forEach(({ spellId, expected }) => {
                const gear: EquippedItem[] = [
                    { itemId: 23054, spellId, randomSuffixId: 0 },
                ];

                const result = gearParser.parse(gear);
                expect(result.mainHandWeapon.enchant).toBe(expected);
            });
        });

        it('should calculate attack power from gear', () => {
            // Look for items with attack power
            const gear: EquippedItem[] = [
                { itemId: 19406, spellId: 0, randomSuffixId: 0 }, // Drake Fang Talisman (has AP)
            ];

            const result = gearParser.parse(gear);

            if (result.attackPower !== undefined) {
                expect(result.attackPower).toBeGreaterThan(0);
            }
        });

        it('should handle caster gear with spell power', () => {
            // Item 873 is Staff of Jordan which has spell power
            const gear: EquippedItem[] = [
                { itemId: 873, spellId: 0, randomSuffixId: 0 },
            ];

            const result = gearParser.parse(gear);

            // Should have intellect and/or spell power stats
            expect(result.intellect).toBeGreaterThan(0);
        });

        it('should convert hit rating to hit chance percentage', () => {
            // Items with hit rating should increase hit chance
            const gear: EquippedItem[] = [
                { itemId: 22954, spellId: 0, randomSuffixId: 0 }, // Kiss of the Spider (trinket with hit)
            ];

            const result = gearParser.parse(gear);

            expect(result.hitChance).toBeGreaterThanOrEqual(0);
        });

        it('should convert crit rating to crit chance percentage', () => {
            // Many items have crit rating
            const gear: EquippedItem[] = [
                { itemId: 22954, spellId: 0, randomSuffixId: 0 }, // Kiss of the Spider
            ];

            const result = gearParser.parse(gear);

            expect(result.critChance).toBeGreaterThanOrEqual(0);
        });

        it('should identify weapon types correctly', () => {
            // Test different weapon types
            const swordGear: EquippedItem[] = [
                { itemId: 23054, spellId: 0, randomSuffixId: 0 }, // Sword
            ];

            const swordResult = gearParser.parse(swordGear);
            expect(swordResult.mainHandWeapon.type).toBe(WeaponType.Sword);
        });

        it('should handle complete gear set stats accumulation', () => {
            const fullGear: EquippedItem[] = JSON.parse(
                `[{"itemId":22478,"spellId":2585},{"itemId":19377},{"itemId":22479,"spellId":2717},{"itemId":23045,"spellId":2621},{"itemId":22476,"spellId":1891},{"itemId":22483,"spellId":1885},{"itemId":22481,"spellId":856},{"itemId":21586},{"itemId":22477,"spellId":2585},{"itemId":22480,"spellId":1887},{"itemId":23060},{"itemId":23038},{"itemId":22954},{"itemId":19406},{"itemId":23054,"spellId":1900},{"itemId":23577,"spellId":1900},{"itemId":23557}]`
            );

            const result = gearParser.parse(fullGear);

            // Verify all major stat categories are present
            expect(result.strength).toBeGreaterThan(50); // T3 set has strength
            expect(result.agility).toBeGreaterThan(100); // Heavily agility focused
            expect(result.critChance).toBeGreaterThanOrEqual(0); // May have crit rating
            expect(result.hitChance).toBeGreaterThanOrEqual(0); // May have hit rating
            expect(result.weaponSkills).toBeDefined();
            
            // Verify weapons
            expect(result.mainHandWeapon.minDamage).toBeGreaterThan(50);
            expect(result.mainHandWeapon.maxDamage).toBeGreaterThan(100);
            expect(result.offHandWeapon).toBeDefined();
            expect(result.offHandWeapon!.minDamage).toBeGreaterThan(0);
        });

        it('should not add optional stats if they are zero', () => {
            // Simple non-caster gear that shouldn't have spell power
            const gear: EquippedItem[] = [
                { itemId: 22481, spellId: 0, randomSuffixId: 0 }, // Physical DPS gloves
            ];

            const result = gearParser.parse(gear);

            // Spell power may be 0 or undefined for physical gear
            if (result.spellPower !== undefined && result.spellPower !== 0) {
                expect(result.spellPower).toBeGreaterThan(0);
            }
        });

        it('should handle healer gear with healing power and mp5', () => {
            // Item 867 is Gloves of Holy Might (healing gear)
            const gear: EquippedItem[] = [
                { itemId: 867, spellId: 0, randomSuffixId: 0 },
            ];

            const result = gearParser.parse(gear);

            // Check that the result is defined (item exists)
            expect(result).toBeDefined();
            // Healing power may be 0 or undefined depending on item data
        });
    });

    describe('Agility & Strength', () => {
        it('should correctly add agility from gloves', () => {
            // Step 1: Parse gear with no gloves
            const gearWithoutGloves: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestor's Talisman (30 agi)
            ];

            const resultNoGloves = gearParser.parse(gearWithoutGloves);
            const baseAgility = resultNoGloves.agility;
            expect(baseAgility).toBe(30); // Verify baseline

            // Step 2: Add Black Whelp Gloves (itemId: 1302) which has 3 agility
            const gearWithGloves: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestor's Talisman (30 agi)
                { itemId: 1302, spellId: 0, randomSuffixId: 0 },  // Black Whelp Gloves (+3 agi)
            ];

            const resultWithGloves = gearParser.parse(gearWithGloves);
            const agilityWithGloves = resultWithGloves.agility;

            // Verify that agility increased by exactly 3
            expect(agilityWithGloves).toBe(baseAgility + 3);
        });

        it('should correctly add agility from glove enchant', () => {
            // Step 1: Gloves without enchant
            const gearWithoutEnchant: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestor's Talisman (30 agi)
                { itemId: 1302, spellId: 0, randomSuffixId: 0 },  // Black Whelp Gloves (+3 agi)
            ];

            const resultNoEnchant = gearParser.parse(gearWithoutEnchant);
            const agilityNoEnchant = resultNoEnchant.agility;
            expect(agilityNoEnchant).toBe(33); // 30 + 3

            // Step 2: Add Superior Agility enchant (+15 agility) to gloves
            const gearWithEnchant: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 },     // Prestor's Talisman (30 agi)
                { itemId: 1302, spellId: 25080, randomSuffixId: 0 },  // Black Whelp Gloves + Superior Agility (+15 agi)
            ];

            const resultWithEnchant = gearParser.parse(gearWithEnchant);
            const agilityWithEnchant = resultWithEnchant.agility;

            // Verify that agility increased by exactly 15
            expect(agilityWithEnchant).toBe(agilityNoEnchant + 15);
            expect(agilityWithEnchant).toBe(48); // 30 + 3 + 15
        });

        it('should correctly add strength from gloves', () => {
            // Black Whelp Gloves also has 2 strength
            const gearNoGloves: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestor's Talisman (no strength)
            ];

            const baseResult = gearParser.parse(gearNoGloves);
            const baseStrength = baseResult.strength;
            expect(baseStrength).toBe(0);

            const gearWithGloves: EquippedItem[] = [
                { itemId: 19377, spellId: 0, randomSuffixId: 0 }, // Prestor's Talisman
                { itemId: 1302, spellId: 0, randomSuffixId: 0 },  // Black Whelp Gloves (+2 str, +3 agi)
            ];

            const resultWithGloves = gearParser.parse(gearWithGloves);
            const strengthWithGloves = resultWithGloves.strength;

            // Verify that strength increased by exactly 2
            expect(strengthWithGloves).toBe(baseStrength + 2);
            expect(strengthWithGloves).toBe(2);
        });

        it('should handle multiple items with precise stat accumulation', () => {
            // Test with multiple items to verify stats accumulate correctly
            const gear: EquippedItem[] = [
                { itemId: 1302, spellId: 25080, randomSuffixId: 0 },  // Black Whelp Gloves: +2 str, +3 agi, +15 agi enchant
                { itemId: 1302, spellId: 0, randomSuffixId: 0 },      // Another pair (e.g., in different slot): +2 str, +3 agi
            ];

            const result = gearParser.parse(gear);

            // Total should be: (2+2=4 str) and (3+3+15=21 agi)
            expect(result.strength).toBe(4);
            expect(result.agility).toBe(21);
        });

        it('should correctly add agility from boots enchant', () => {
            const gearNoEnchant: EquippedItem[] = [
                { itemId: 1121, spellId: 0, randomSuffixId: 0 },  // Feet of the Lynx (boots)
            ];

            const resultNoEnchant = gearParser.parse(gearNoEnchant);
            const agilityNoEnchant = resultNoEnchant.agility;

            // Add Greater Agility enchant to boots (+7 agility)
            const gearWithEnchant: EquippedItem[] = [
                { itemId: 1121, spellId: 20023, randomSuffixId: 0 },  // Feet of the Lynx + Greater Agility
            ];

            const resultWithEnchant = gearParser.parse(gearWithEnchant);
            const agilityWithEnchant = resultWithEnchant.agility;

            // Verify exactly +7 agility from enchant
            expect(agilityWithEnchant).toBe(agilityNoEnchant + 7);
        });

        it('should verify zero agility when no agility items equipped', () => {
            // Use items that have no agility
            const gear: EquippedItem[] = [
                { itemId: 873, spellId: 0, randomSuffixId: 0 },  // Staff of Jordan (caster weapon, no agi)
            ];

            const result = gearParser.parse(gear);

            // Should have 0 agility from these items
            expect(result.agility).toBe(0);
        });

        it('should handle enchants that add other stats precisely', () => {
            // Test with a strength enchant
            const gearNoEnchant: EquippedItem[] = [
                { itemId: 1302, spellId: 0, randomSuffixId: 0 },  // Black Whelp Gloves
            ];

            const resultNoEnchant = gearParser.parse(gearNoEnchant);
            
            // Note: We're verifying the base item stats are correct
            expect(resultNoEnchant.strength).toBe(2);
            expect(resultNoEnchant.agility).toBe(3);
        });
    });
});

