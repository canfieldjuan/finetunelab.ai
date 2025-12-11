const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  // Simulate what Models page does
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

  console.log('\n=== Step 1: Fetch Models ===');
  const { data: models } = await supabase
    .from('llm_models')
    .select('*')
    .eq('user_id', userId)
    .eq('is_global', false);

  console.log(`Found ${models.length} user models`);
  const finetuneModel = models.find(m => m.name === 'Fine Tune Expert');

  if (!finetuneModel) {
    console.log('ERROR: Fine Tune Expert model not found!');
    return;
  }

  console.log('\nFine Tune Expert model:');
  console.log(`  ID: ${finetuneModel.id}`);
  console.log(`  Provider: ${finetuneModel.provider}`);
  console.log(`  Base URL: ${finetuneModel.base_url}`);
  console.log(`  User ID: ${finetuneModel.user_id}`);
  console.log(`  Is Global: ${finetuneModel.is_global}`);

  console.log('\n=== Step 2: Simulate /api/servers/status ===');

  // Get all servers for user
  const { data: servers } = await supabase
    .from('local_inference_servers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log(`Found ${servers.length} total servers`);

  // Simulate the status endpoint logic
  const serversWithStatus = [];
  for (const server of servers) {
    // Find matching model
    // Match by provider, base_url, AND model_name to handle multiple models on same port
    const { data: modelData } = await supabase
      .from('llm_models')
      .select('id, name')
      .eq('user_id', userId)
      .eq('provider', server.server_type)
      .eq('base_url', server.base_url)
      .eq('name', server.model_name)
      .single();

    const serverWithModel = {
      id: server.id,
      server_type: server.server_type,
      model_id: modelData?.id || null,
      model_name: server.model_name,
      status: server.status,
      port: server.port,
      base_url: server.base_url,
      process_id: server.process_id
    };

    serversWithStatus.push(serverWithModel);

    if (modelData?.name === 'Fine Tune Expert') {
      console.log('\nServer linked to Fine Tune Expert:');
      console.log(`  Server ID: ${server.id}`);
      console.log(`  Model ID: ${modelData.id}`);
      console.log(`  Status: ${server.status}`);
      console.log(`  Port: ${server.port}`);
      console.log(`  Process ID: ${server.process_id}`);
    }
  }

  console.log('\n=== Step 3: Build serverMap (like Models page) ===');

  const serverMap = {};
  serversWithStatus.forEach((server) => {
    if (server.model_id) {
      const existing = serverMap[server.model_id];

      if (!existing ||
          (server.status === 'running' && existing.status !== 'running') ||
          (server.status === 'starting' && (existing.status === 'stopped' || existing.status === 'error'))) {
        serverMap[server.model_id] = server;
      }
    }
  });

  console.log(`\nServerMap has ${Object.keys(serverMap).length} entries`);

  console.log('\n=== Step 4: Check Fine Tune Expert has serverInfo ===');

  const serverInfo = serverMap[finetuneModel.id];

  if (serverInfo) {
    console.log('✓ serverInfo found!');
    console.log(`  Status: ${serverInfo.status}`);
    console.log(`  Port: ${serverInfo.port}`);
  } else {
    console.log('✗ NO serverInfo found!');
    console.log(`  Looking for model_id: ${finetuneModel.id}`);
    console.log('  Available model_ids in serverMap:', Object.keys(serverMap));
  }

  console.log('\n=== Step 5: Check ModelCard conditions ===');

  const isUserModel = !finetuneModel.is_global && finetuneModel.user_id === userId;
  const canDeploy = isUserModel && (finetuneModel.provider === 'vllm' || finetuneModel.provider === 'ollama' || finetuneModel.provider === 'local');
  const hasServer = !!serverInfo;
  const sessionToken = 'mock-token'; // Simulate having session

  console.log(`  isUserModel: ${isUserModel}`);
  console.log(`  canDeploy: ${canDeploy}`);
  console.log(`  hasServer: ${hasServer}`);
  console.log(`  sessionToken: ${!!sessionToken}`);
  if (serverInfo) {
    console.log(`  serverInfo.status: ${serverInfo.status}`);
  }

  console.log('\n=== Step 6: Determine which button should show ===');

  if (canDeploy && sessionToken) {
    if (hasServer && serverInfo.status === 'running') {
      console.log('✓ Should show: STOP SERVER button');
    } else if (hasServer && (serverInfo.status === 'stopped' || serverInfo.status === 'error')) {
      console.log('✓ Should show: START SERVER button');
    } else if (hasServer && serverInfo.status === 'starting') {
      console.log('✓ Should show: STARTING... (disabled)');
    } else if (!hasServer) {
      console.log('✓ Should show: DEPLOY SERVER button');
    } else {
      console.log('? Unknown state!');
    }
  } else {
    console.log('✗ No button should show (canDeploy or sessionToken missing)');
  }
}

diagnose().catch(console.error);
