process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const WebSocket = require('ws');
require('dotenv').config({ path: 'packages/backend/.env' });
const key = process.env.GEMINI_API_KEY;

const modelsToTest = [
    'models/gemini-2.0-flash-exp',
    'models/gemini-2.0-flash-live-preview-04-09',
    'models/gemini-2.5-flash-native-audio-latest',
    'models/gemini-2.0-flash',
    'models/gemini-2.5-flash'
];

async function testModel(modelName) {
    return new Promise((resolve) => {
        const url = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=' + key;
        const ws = new WebSocket(url);
        let opened = false;
        
        ws.on('open', () => {
            opened = true;
            // Envia o setup message
            ws.send(JSON.stringify({
                setup: {
                    model: modelName
                }
            }));
        });
        
        ws.on('message', (data) => {
            console.log(`[${modelName}] Message:`, data.toString().substring(0, 100));
            ws.close();
            resolve();
        });
        
        ws.on('close', (code, reason) => {
            if (!opened) {
                console.log(`[${modelName}] Connection closed before open`);
            } else {
                console.log(`[${modelName}] Closed:`, code, reason.toString());
            }
            resolve();
        });
        
        ws.on('error', (err) => {
            console.log(`[${modelName}] Error:`, err.message);
            resolve();
        });
    });
}

async function run() {
    for (const model of modelsToTest) {
        await testModel(model);
    }
}
run();
