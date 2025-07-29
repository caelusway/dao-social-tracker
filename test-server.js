// Simple test to check if the server starts properly
const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 Testing server startup...');

// Start the server
const server = spawn('node', ['dist/server.js'], {
  env: {
    ...process.env,
    PORT: '3001',  // Use different port for testing
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-key-for-health-check'
  }
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

// Wait a bit then test health check
setTimeout(() => {
  console.log('🔍 Testing health check...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Health check response: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
      server.kill();
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  });

  req.on('error', (err) => {
    console.error('❌ Health check failed:', err.message);
    server.kill();
    process.exit(1);
  });

  req.end();
}, 3000);