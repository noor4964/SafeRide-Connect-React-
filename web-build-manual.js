// Manual web build script to bypass expo export issues
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting manual web build process...');

// Start expo web dev server
const expoWeb = spawn('npm', ['run', 'web'], {
  shell: true,
  stdio: 'inherit'
});

console.log('\n✅ Expo web server started');
console.log('📝 Please follow these steps:');
console.log('1. Wait for the web server to fully load (usually at http://localhost:8081 or similar)');
console.log('2. Open the browser and verify the app loads correctly');
console.log('3. Once verified, press Ctrl+C to stop this script');
console.log('4. Copy the contents from your browser\'s developer tools');
console.log('\nAlternatively, we can deploy the dev server directly to Vercel/Netlify');
console.log('which will handle the build process automatically.\n');

process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping web server...');
  expoWeb.kill();
  process.exit(0);
});
