const fs = require('fs');
let c = fs.readFileSync('apps/mobile/lib/gemini-live-client.ts', 'utf8');

const regex = /sendTurnComplete\(\): void \{[\s\S]*?this\.ws\.send\(JSON\.stringify\(\{ type: 'turn_complete' \}\)\);\n  \}/g;

c = c.replace(regex, `sendTurnComplete(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'turn_complete' }));
    if (this.thinkTimeout) clearTimeout(this.thinkTimeout);
    this.thinkTimeout = setTimeout(() => {
      this.onTeacherStateChange('idle');
    }, 5000);
  }`);

fs.writeFileSync('apps/mobile/lib/gemini-live-client.ts', c, 'utf8');
