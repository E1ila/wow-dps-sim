const {GearParser} = require('./dist/GearParser');
const {Database} = require('./dist/Database');
const path = require('path');

// Setup
const dbPath = path.resolve(__dirname, 'src', 'db.json');
const db = new Database(dbPath);
const gearParser = new GearParser(db);

console.log('=== Verifying Agility Calculation Tests ===\n');

// Test 1: No gloves baseline
const gearNoGloves = [
    { itemId: 19377, enchantId: 0, randomSuffixId: 0 }, // Prestor's Talisman (neck)
];

const resultNoGloves = gearParser.parse(gearNoGloves);
console.log('Test 1 - No gloves:');
console.log(`  Agility: ${resultNoGloves.agility}`);
console.log(`  ✓ Expected: 30 (from Prestor's Talisman)`);
console.log();

// Test 2: Add gloves with 3 agility
const gearWithGloves = [
    { itemId: 19377, enchantId: 0, randomSuffixId: 0 },  // Prestor's Talisman
    { itemId: 1302, enchantId: 0, randomSuffixId: 0 },   // Black Whelp Gloves (+3 agi)
];

const resultWithGloves = gearParser.parse(gearWithGloves);
console.log('Test 2 - With gloves (no enchant):');
console.log(`  Agility: ${resultWithGloves.agility}`);
console.log(`  ✓ Expected: 33 (30 + 3)`);
console.log(`  Difference from Test 1: ${resultWithGloves.agility - resultNoGloves.agility}`);
console.log();

// Test 3: Add +15 agility enchant to gloves
const gearWithEnchant = [
    { itemId: 19377, enchantId: 0, randomSuffixId: 0 },     // Prestor's Talisman
    { itemId: 1302, enchantId: 25080, randomSuffixId: 0 },  // Black Whelp Gloves + Superior Agility (+15)
];

const resultWithEnchant = gearParser.parse(gearWithEnchant);
console.log('Test 3 - With gloves + enchant:');
console.log(`  Agility: ${resultWithEnchant.agility}`);
console.log(`  ✓ Expected: 48 (30 + 3 + 15)`);
console.log(`  Difference from Test 2: ${resultWithEnchant.agility - resultWithGloves.agility}`);
console.log(`  ✓ Enchant added exactly: ${resultWithEnchant.agility - resultWithGloves.agility === 15 ? 'PASS' : 'FAIL'}`);
console.log();

// Verify enchant details
const enchant = db.getEnchant(25080);
console.log('Enchant 25080 (Superior Agility):');
console.log(`  Name: ${enchant?.name}`);
console.log(`  Agility stat: ${enchant?.stats[1]}`);
console.log();

// Test 4: Verify strength from gloves
console.log('Test 4 - Strength from gloves:');
console.log(`  Strength with gloves: ${resultWithGloves.strength}`);
console.log(`  Strength without gloves: ${resultNoGloves.strength}`);
console.log(`  Difference: ${resultWithGloves.strength - resultNoGloves.strength}`);
console.log(`  ✓ Expected difference: 2 (Black Whelp Gloves has +2 str)`);
console.log();

// Summary
console.log('=== Summary ===');
const test1Pass = resultNoGloves.agility === 30;
const test2Pass = resultWithGloves.agility === 33;
const test3Pass = resultWithEnchant.agility === 48;
const enchantTest = (resultWithEnchant.agility - resultWithGloves.agility) === 15;
const strTest = (resultWithGloves.strength - resultNoGloves.strength) === 2;

console.log(`Test 1 (No gloves, 30 agi): ${test1Pass ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Test 2 (With gloves, 33 agi): ${test2Pass ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Test 3 (With enchant, 48 agi): ${test3Pass ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Enchant adds exactly +15: ${enchantTest ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Gloves add exactly +2 str: ${strTest ? '✓ PASS' : '✗ FAIL'}`);
console.log();

const allPass = test1Pass && test2Pass && test3Pass && enchantTest && strTest;
console.log(allPass ? '✓ ALL TESTS PASS!' : '✗ SOME TESTS FAILED');

process.exit(allPass ? 0 : 1);

