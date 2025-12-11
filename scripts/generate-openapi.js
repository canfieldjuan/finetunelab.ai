#!/usr/bin/env node

/**
 * Generate OpenAPI specification from Next.js API routes
 *
 * This script uses next-swagger-doc to parse JSDoc comments in API routes
 * and generate a comprehensive OpenAPI 3.0 spec.
 *
 * Usage:
 *   node scripts/generate-openapi.js
 *   npm run generate:openapi
 */

const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load OpenAPI config
const config = require('../openapi.config.js');

console.log('🔍 Generating OpenAPI specification...\n');

try {
  // Generate OpenAPI spec using swagger-jsdoc
  const spec = swaggerJsdoc(config);

  // Output paths
  const outputDir = path.join(__dirname, '../public');
  const outputPath = path.join(outputDir, 'openapi.json');
  const yamlPath = path.join(outputDir, 'openapi.yaml');

  // Ensure public directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON spec
  fs.writeFileSync(
    outputPath,
    JSON.stringify(spec, null, 2),
    'utf-8'
  );

  console.log('✅ OpenAPI JSON spec generated:');
  console.log(`   ${outputPath}`);
  console.log('');

  // Also write YAML version (using js-yaml)
  const yamlContent = yaml.dump(spec, { indent: 2, lineWidth: 120 });
  fs.writeFileSync(yamlPath, yamlContent, 'utf-8');

  console.log('✅ OpenAPI YAML spec generated:');
  console.log(`   ${yamlPath}`);
  console.log('');

  // Print summary
  const pathCount = Object.keys(spec.paths || {}).length;
  const tagCount = (spec.tags || []).length;

  console.log('📊 Summary:');
  console.log(`   - API Endpoints: ${pathCount}`);
  console.log(`   - Tags: ${tagCount}`);
  console.log(`   - Version: ${spec.info.version}`);
  console.log('');

  console.log('🎯 Next steps:');
  console.log('   1. View spec at http://localhost:3000/docs/api-spec');
  console.log('   2. Generate SDK: npm run generate:sdk');
  console.log('   3. Add JSDoc comments to more API routes');
  console.log('');

  // If no paths were generated, show helpful message
  if (pathCount === 0) {
    console.log('⚠️  No API routes found with JSDoc comments.');
    console.log('');
    console.log('To add an endpoint to the spec, add JSDoc like this:');
    console.log('');
    console.log('/**');
    console.log(' * @swagger');
    console.log(' * /api/widget-apps:');
    console.log(' *   get:');
    console.log(' *     summary: List widget apps');
    console.log(' *     tags: [Widget Apps]');
    console.log(' *     responses:');
    console.log(' *       200:');
    console.log(' *         description: Success');
    console.log(' */');
    console.log('export async function GET(request) { ... }');
    console.log('');
  }

} catch (error) {
  console.error('❌ Error generating OpenAPI spec:', error);
  process.exit(1);
}
