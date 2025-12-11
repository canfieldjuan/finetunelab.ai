import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require'
});

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fixes using direct connection...\n');

  try {
    console.log('📝 Fixing model_baselines policies...');
    
    // Drop old policies
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to read baselines" ON model_baselines`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to create baselines" ON model_baselines`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to update baselines" ON model_baselines`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to delete baselines" ON model_baselines`;
    
    // Create new permissive policies
    await sql`
      CREATE POLICY "Enable read access for all authenticated users" 
      ON model_baselines FOR SELECT 
      TO authenticated 
      USING (true)
    `;
    
    await sql`
      CREATE POLICY "Enable insert access for all authenticated users" 
      ON model_baselines FOR INSERT 
      TO authenticated 
      WITH CHECK (true)
    `;
    
    await sql`
      CREATE POLICY "Enable update access for all authenticated users" 
      ON model_baselines FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true)
    `;
    
    await sql`
      CREATE POLICY "Enable delete access for all authenticated users" 
      ON model_baselines FOR DELETE 
      TO authenticated 
      USING (true)
    `;
    
    await sql`
      CREATE POLICY "Enable full access for service role" 
      ON model_baselines FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true)
    `;
    
    console.log('✅ model_baselines policies updated\n');

    console.log('📝 Fixing validation_results policies...');
    
    // Drop old policies
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to read validation results" ON validation_results`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to create validation results" ON validation_results`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to update validation results" ON validation_results`;
    
    // Create new permissive policies
    await sql`
      CREATE POLICY "Enable read access for all authenticated users" 
      ON validation_results FOR SELECT 
      TO authenticated 
      USING (true)
    `;
    
    await sql`
      CREATE POLICY "Enable insert access for all authenticated users" 
      ON validation_results FOR INSERT 
      TO authenticated 
      WITH CHECK (true)
    `;
    
    await sql`
      CREATE POLICY "Enable update access for all authenticated users" 
      ON validation_results FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true)
    `;
    
    await sql`
      CREATE POLICY "Enable full access for service role" 
      ON validation_results FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true)
    `;
    
    console.log('✅ validation_results policies updated\n');
    
    console.log('🎉 RLS policies have been fixed!');
    console.log('   Try your API request again - it should work now.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\nIf you see "permission denied", you need to run these in Supabase Studio:');
    console.log('- supabase/migrations/20251129_fix_model_baselines_rls.sql');
    console.log('- supabase/migrations/20251129_fix_validation_results_rls.sql');
  } finally {
    await sql.end();
  }
}

applyRLSFix();
