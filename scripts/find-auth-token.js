/**
 * Helper script to find your Supabase auth token
 * Paste this in browser console while logged in
 */

(function findAuthToken() {
  console.log('========================================');
  console.log('Finding Supabase Auth Token');
  console.log('========================================\n');
  
  console.log('Scanning localStorage...\n');
  
  let found = false;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('supabase')) {
      console.log('📦 Key:', key);
      try {
        const value = JSON.parse(localStorage.getItem(key));
        
        // Check all possible token locations
        const token = value.access_token || 
                     value.session?.access_token || 
                     value.currentSession?.access_token ||
                     value.data?.session?.access_token;
        
        if (token) {
          console.log('✅ FOUND TOKEN!');
          console.log('Full token:', token);
          console.log('First 20 chars:', token.substring(0, 20) + '...');
          console.log('\nCopy this token to use in curl commands:');
          console.log(token);
          found = true;
          
          // Also copy to clipboard if possible
          if (navigator.clipboard) {
            navigator.clipboard.writeText(token).then(() => {
              console.log('\n✅ Token copied to clipboard!');
            });
          }
          break;
        } else {
          console.log('   No token in this key\n');
        }
      } catch (e) {
        console.log('   (Not JSON)\n');
      }
    }
  }
  
  if (!found) {
    console.error('❌ No auth token found!');
    console.error('\nMake sure you are:');
    console.error('1. Logged into the application');
    console.error('2. On the correct domain (localhost:3000)');
    console.error('3. Have not cleared localStorage');
  }
})();
