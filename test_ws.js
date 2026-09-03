const WebSocket = require('ws');
require('dotenv').config({ path: 'packages/backend/.env' });
const key = process.env.GEMINI_API_KEY;
if (!key) { console.log('No GEMINI_API_KEY in local .env'); process.exit(0); }
const url = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=' + key;
console.log('Connecting with v1alpha...');
const ws = new WebSocket(url);
ws.on('open', () => {
    console.log('OPENED v1alpha');
    ws.close();
});
ws.on('error', (err) => console.log('ERROR v1alpha:', err.message));
ws.on('close', (code, reason) => console.log('CLOSED v1alpha:', code, reason.toString()));
ws.on('unexpected-response', (req, res) => console.log('UNEXPECTED v1alpha:', res.statusCode, res.statusMessage));

const url2 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + key;
console.log('Connecting with v1beta...');
const ws2 = new WebSocket(url2);
ws2.on('open', () => {
    console.log('OPENED v1beta');
    ws2.close();
});
ws2.on('error', (err) => console.log('ERROR v1beta:', err.message));
ws2.on('close', (code, reason) => console.log('CLOSED v1beta:', code, reason.toString()));
ws2.on('unexpected-response', (req, res) => console.log('UNEXPECTED v1beta:', res.statusCode, res.statusMessage));
