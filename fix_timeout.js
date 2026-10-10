const fs = require('fs');
let c = fs.readFileSync('apps/mobile/lib/gemini-live-client.ts', 'utf8');

c = c.replace("case 'audio_chunk':", "case 'audio_chunk':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");
c = c.replace("case 'teacher_state':", "case 'teacher_state':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");
c = c.replace("case 'board_event':", "case 'board_event':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");

const oldStr = `  sendTurnComplete(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'turn_complete' }));
  }`;

const newStr = `  sendTurnComplete(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'turn_complete' }));
    
    if (this.thinkTimeout) clearTimeout(this.thinkTimeout);
    this.thinkTimeout = setTimeout(() => {
      console.warn('[GEMINI-CLIENT] Timeout 5s na resposta da IA. Voltando para idle.');
      this.onTeacherStateChange('idle');
    }, 5000);
  }`;

c = c.replace(oldStr, newStr);
c = c.replace(oldStr, '');

fs.writeFileSync('apps/mobile/lib/gemini-live-client.ts', c, 'utf8');
