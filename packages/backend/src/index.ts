import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import config from './config';
import { handleRelayConnection } from './websocket/relay-handler';
import curriculumRouter from './routes/curriculum';
import sessionsRouter from './routes/sessions';
import usageRouter from './routes/usage';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// REST Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/curriculum', curriculumRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/usage', usageRouter);

// WebSocket Upgrade
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/relay') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  handleRelayConnection(ws, request);
});

server.listen(config.port, () => {
  console.log(`[SERVER] Backend is running on http://localhost:${config.port}`);
  console.log(`[SERVER] WebSocket relay available at ws://localhost:${config.port}/ws/relay`);
});
