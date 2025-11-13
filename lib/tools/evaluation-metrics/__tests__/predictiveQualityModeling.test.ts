// Predictive Quality Modeling - Unit Tests
// Run with: npx tsx lib/tools/evaluation-metrics/__tests__/predictiveQualityModeling.test.ts

import { getPredictiveQualityModeling } from '../operations/predictiveQualityModeling';

console.log('========================================');
console.log('Predictive Quality Modeling - Unit Tests');
console.log('========================================\n');

// Test 1: Function exists
console.log('Test 1: Function exists');
console.log('----------------------------------------');
if (typeof getPredictiveQualityModeling !== 'function') {
  throw new Error('getPredictiveQualityModeling is not a function!');
}
console.log('✓ getPredictiveQualityModeling function exists\n');

// Test 2: Call with valid parameters
console.log('Test 2: Call with valid parameters');
console.log('----------------------------------------');
const testUserId = 'test-user-123';
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');

console.log('Parameters:');
console.log('  userId:', testUserId);
console.log('  startDate:', startDate.toISOString());
console.log('  endDate:', endDate.toISOString());

getPredictiveQualityModeling(testUserId, startDate, endDate)
  .then((result) => {
    console.log('\nResult structure:');
    console.log('  period:', result.period);
    console.log('  dataPointsAnalyzed:', result.dataPointsAnalyzed);
    console.log('  currentQuality:', result.currentQuality);
    console.log('  modelAccuracy:', result.modelAccuracy);
    console.log('  insights count:', result.insights.length);
    
    // Validate structure
    if (!result.period) throw new Error('Missing period field');
    if (typeof result.dataPointsAnalyzed !== 'number') throw new Error('Invalid dataPointsAnalyzed');
    if (typeof result.currentQuality !== 'number') throw new Error('Invalid currentQuality');
    if (typeof result.modelAccuracy !== 'number') throw new Error('Invalid modelAccuracy');
    if (!result.predictions) throw new Error('Missing predictions');
    if (!result.riskScore) throw new Error('Missing riskScore');
    if (!Array.isArray(result.insights)) throw new Error('insights not an array');
    
    console.log('✓ Test 2 passed - Valid response structure\n');
    
    // Test 3: Validate predictions structure
    console.log('Test 3: Predictions structure');
    console.log('----------------------------------------');
    if (!result.predictions.sevenDay) throw new Error('Missing sevenDay prediction');
    if (!result.predictions.thirtyDay) throw new Error('Missing thirtyDay prediction');
    
    const sevenDay = result.predictions.sevenDay;
    if (typeof sevenDay.predictedRating !== 'number') throw new Error('Invalid predictedRating');
    if (typeof sevenDay.confidence !== 'number') throw new Error('Invalid confidence');
    if (!sevenDay.confidenceInterval) throw new Error('Missing confidenceInterval');
    if (sevenDay.daysAhead !== 7) throw new Error('Invalid daysAhead for 7-day');
    
    const thirtyDay = result.predictions.thirtyDay;
    if (thirtyDay.daysAhead !== 30) throw new Error('Invalid daysAhead for 30-day');
    
    console.log('✓ Test 3 passed - Valid predictions structure\n');
    
    // Test 4: Validate risk score
    console.log('Test 4: Risk score structure');
    console.log('----------------------------------------');
    const risk = result.riskScore;
    if (typeof risk.score !== 'number') throw new Error('Invalid risk score');
    if (risk.score < 0 || risk.score > 100) throw new Error('Risk score out of range');
    
    const validLevels = ['low', 'medium', 'high', 'critical'];
    if (!validLevels.includes(risk.level)) {
      throw new Error(`Invalid risk level: ${risk.level}`);
    }
    
    if (typeof risk.probability !== 'number') throw new Error('Invalid probability');
    if (risk.probability < 0 || risk.probability > 1) throw new Error('Probability out of range');
    
    if (!Array.isArray(risk.recommendations)) throw new Error('recommendations not an array');
    
    console.log('✓ Test 4 passed - Valid risk score structure\n');
    
    // Test 5: Validate rating ranges
    console.log('Test 5: Rating value ranges');
    console.log('----------------------------------------');
    if (result.currentQuality < 0 || result.currentQuality > 5) {
      throw new Error(`currentQuality out of range: ${result.currentQuality}`);
    }
    
    const validateRating = (rating: number, name: string) => {
      if (rating < 0 || rating > 5) {
        throw new Error(`${name} rating out of range: ${rating}`);
      }
    };
    
    if (result.dataPointsAnalyzed > 0) {
      validateRating(sevenDay.predictedRating, '7-day');
      validateRating(thirtyDay.predictedRating, '30-day');
    }
    
    console.log('✓ Test 5 passed - Ratings in valid range [0, 5]\n');
    
    // Test 6: Validate confidence ranges
    console.log('Test 6: Confidence value ranges');
    console.log('----------------------------------------');
    if (result.modelAccuracy < 0 || result.modelAccuracy > 1) {
      throw new Error(`Model accuracy out of range: ${result.modelAccuracy}`);
    }
    
    if (sevenDay.confidence < 0 || sevenDay.confidence > 1) {
      throw new Error(`7-day confidence out of range: ${sevenDay.confidence}`);
    }
    
    if (thirtyDay.confidence < 0 || thirtyDay.confidence > 1) {
      throw new Error(`30-day confidence out of range: ${thirtyDay.confidence}`);
    }
    
    console.log('✓ Test 6 passed - Confidence values in valid range [0, 1]\n');
    
    console.log('========================================');
    console.log('All Predictive Modeling Tests Passed! ✓');
    console.log('========================================\n');
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });
