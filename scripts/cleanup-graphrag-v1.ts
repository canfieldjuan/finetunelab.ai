
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password123';

const GROUP_ID = process.argv[2] || 'documentation-v2'; // Allow passing group_id as arg
const INSPECT_MODE = process.argv[3] === '--inspect'; // Just inspect, don't delete

async function cleanup() {
  console.log(`🔌 Connecting to Neo4j at ${NEO4J_URI}...`);
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    // Check what's in the DB
    console.log(`\n📊 Database Statistics:`);
    const countResult = await session.run(`MATCH (n) RETURN count(n) as count`);
    console.log(`   - Total Nodes: ${countResult.records[0].get('count').toNumber()}`);

    const groupsResult = await session.run(`MATCH (n) WHERE n.group_id IS NOT NULL RETURN DISTINCT n.group_id as group_id, labels(n) as labels, count(n) as count`);
    console.log(`   - Groups found:`);
    groupsResult.records.forEach(r => {
      console.log(`     * ${r.get('group_id')} [${r.get('labels').join(', ')}]: ${r.get('count').toNumber()} nodes`);
    });

    // Sample some episodes
    console.log(`\n📝 Sample Episodes from group '${GROUP_ID}':`);
    const episodeSample = await session.run(
      `MATCH (e:Episode) WHERE e.group_id = $groupId RETURN e.name as name, e.created_at as created_at LIMIT 5`,
      { groupId: GROUP_ID }
    );
    episodeSample.records.forEach(r => {
      console.log(`     - ${r.get('name')} (${r.get('created_at')})`);
    });

    // Sample entities
    console.log(`\n🏷️  Sample Entities from group '${GROUP_ID}':`);
    const entitySample = await session.run(
      `MATCH (e:Entity) WHERE e.group_id = $groupId RETURN e.name as name, e.entity_type as type LIMIT 10`,
      { groupId: GROUP_ID }
    );
    if (entitySample.records.length === 0) {
      console.log(`     (No entities found - they may still be processing)`);
    } else {
      entitySample.records.forEach(r => {
        console.log(`     - ${r.get('name')} (${r.get('type')})`);
      });
    }

    if (INSPECT_MODE) {
      console.log(`\n👀 Inspect mode - no deletion performed.`);
      await session.close();
      await driver.close();
      return;
    }

    console.log(`\n🗑️  Deleting nodes for group: ${GROUP_ID}`);
    
    // Delete Entities
    const resultEntities = await session.run(
      `MATCH (n:Entity) WHERE n.group_id = $groupId DETACH DELETE n RETURN count(n) as count`,
      { groupId: GROUP_ID }
    );
    const entityCount = resultEntities.records[0].get('count').toNumber();
    console.log(`   - Deleted ${entityCount} Entities`);

    // Delete Episodes
    const resultEpisodes = await session.run(
      `MATCH (n:Episode) WHERE n.group_id = $groupId DETACH DELETE n RETURN count(n) as count`,
      { groupId: GROUP_ID }
    );
    const episodeCount = resultEpisodes.records[0].get('count').toNumber();
    console.log(`   - Deleted ${episodeCount} Episodes`);

    // Delete any other nodes with this group_id (just in case)
    const resultOthers = await session.run(
      `MATCH (n) WHERE n.group_id = $groupId DETACH DELETE n RETURN count(n) as count`,
      { groupId: GROUP_ID }
    );
    const otherCount = resultOthers.records[0].get('count').toNumber();
    console.log(`   - Deleted ${otherCount} other nodes`);

    // Drop Vector Indexes to allow recreation with new dimensions
    console.log(`\n🔍 Checking for vector indexes...`);
    const indexes = await session.run(`SHOW INDEXES WHERE type = 'VECTOR'`);
    
    for (const record of indexes.records) {
      const name = record.get('name');
      const labelsOrTypes = record.get('labelsOrTypes');
      const properties = record.get('properties');
      
      console.log(`   - Found vector index: ${name} on ${labelsOrTypes} (${properties})`);
      
      // We'll drop all vector indexes to be safe, as Graphiti will recreate them with correct dimensions
      // Or we could be more specific, but "nuke it" is safer for this transition
      try {
        await session.run(`DROP INDEX ${name}`);
        console.log(`     -> Dropped index: ${name}`);
      } catch (e) {
        console.error(`     -> Failed to drop index ${name}:`, e);
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

cleanup();
