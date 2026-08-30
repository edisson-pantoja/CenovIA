# CenovIA Backend

Servidor Node.js para o app CenovIA, responsável por:
1. Relay WebSocket para Gemini Live API
2. API de Currículo BNCC
3. Controle de Uso (Minutos) e Sessões

## Setup Local

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Preencha as variáveis de ambiente no `.env` (Chave da API Gemini e Supabase)
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

O servidor iniciará na porta `3001`.
