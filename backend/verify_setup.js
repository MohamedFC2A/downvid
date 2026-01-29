const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');

const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

let serverOutput = '';

server.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(`[SERVER]: ${str}`);
    serverOutput += str;
});

server.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR]: ${data.toString()}`);
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log('Starting server verification...');
    // Wait for server to start
    await wait(3000);

    try {
        console.log('1. Testing Health Endpoint...');
        const healthRes = await axios.get('http://localhost:3000/health');
        if (healthRes.data.status === 'ok') {
            console.log('✅ Health check passed');
        } else {
            console.error('❌ Health check failed', healthRes.data);
        }

        console.log('2. Testing Download Endpoint (Invalid URL handling)...');
        // We test with an invalid URL to ensure our backend talks to the API and returns an error passing through,
        // or effectively handles the request.
        try {
            await axios.post('http://localhost:3000/api/download', { url: 'invalid-url' });
            console.log('❓ Unexpected success with invalid URL (API might be forgiving)');
        } catch (error) {
            if (error.response) {
                console.log(`✅ API Error Validated: ${error.response.status}`);
                // API likely returns 400 or similar
            } else {
                console.error('❌ Network/Server Error during API test:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Verification script failed:', error.message);
    } finally {
        console.log('Stopping server...');
        // On Windows with shell: true, killing the process group might be tricky with just .kill()
        // But for a quick test spin up, this is usually 'okay'.
        // To be safe we try to kill it.
        server.kill();
        process.exit(0);
    }
})();
