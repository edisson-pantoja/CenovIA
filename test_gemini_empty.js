process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const WebSocket = require('ws');
require('dotenv').config({ path: 'packages/backend/.env' });
const key = process.env.GEMINI_API_KEY;

const url = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + key;
const ws = new WebSocket(url);

ws.on('open', () => {
    ws.send(JSON.stringify({ setup: { model: 'models/gemini-2.5-flash-native-audio-latest' } }));
});

ws.on('message', (data) => {
    const json = JSON.parse(data.toString());
    if (json.setupComplete) {
        console.log('Setup complete, sending EMPTY turn...');
        ws.send(JSON.stringify({
            clientContent: {
                turnComplete: true
            }
        }));
    } else if (json.serverContent) {
        if (json.serverContent.turnComplete) {
            console.log('Turn complete received!');
            ws.close();
        } else {
            console.log('Received some server content');
        }
    } else {
        console.log('Other msg:', JSON.stringify(json).substring(0, 50));
    }
});
