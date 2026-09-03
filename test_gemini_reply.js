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
        console.log('Setup complete, sending text...');
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text: 'Ola professora!' }] }],
                turnComplete: true
            }
        }));
    } else if (json.serverContent) {
        console.log('Server content received!');
        if (json.serverContent.modelTurn) {
            const parts = json.serverContent.modelTurn.parts;
            for (const p of parts) {
                if (p.text) console.log('GOT TEXT:', p.text);
                if (p.inlineData) console.log('GOT AUDIO:', p.inlineData.mimeType);
            }
        }
        if (json.serverContent.turnComplete) {
            console.log('Turn complete!');
            ws.close();
        }
    }
});
