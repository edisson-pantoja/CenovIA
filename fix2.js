const fs = require('fs');
let c = fs.readFileSync('apps/mobile/lib/gemini-live-client.ts', 'utf8');

c = c.replace("case 'audio_chunk':", "case 'audio_chunk':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");
c = c.replace("case 'teacher_state':", "case 'teacher_state':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");
c = c.replace("case 'board_event':", "case 'board_event':\n        if (this.thinkTimeout) clearTimeout(this.thinkTimeout);");

fs.writeFileSync('apps/mobile/lib/gemini-live-client.ts', c, 'utf8');
