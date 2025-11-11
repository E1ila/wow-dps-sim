const {SimulationRunner} = require('./dist/SimulationRunner');

// Test with the galz spec
const options = {
    specFile: 'rogue/galz.json',
    quiet: true,
    iterations: 1
};

const runner = new SimulationRunner(options);

// Run the simulation to trigger gear stats calculation
const results = runner.runAndGetResults();

console.log('Test completed successfully!');
console.log('Gear stats were calculated and simulation ran without errors.');

