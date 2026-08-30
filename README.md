# CenovIA — Professora de Reforço com IA

Aplicativo multiplataforma (Web, iOS, Android) de aulas de reforço com professora virtual em tempo real, quadro verde interativo com efeito de giz animado e voz bidirecional.

## 🏗️ Estrutura do Projeto

```
cenovia/
├── apps/
│   └── mobile/          # App Expo (Web + iOS + Android)
├── packages/
│   ├── backend/         # Servidor Node.js (relay Gemini + API REST)
│   └── shared/          # Tipos TypeScript compartilhados
├── supabase/
│   └── migrations/      # Migrations SQL do banco de dados
└── package.json         # Monorepo root
```

## 🚀 Setup Inicial

### 1. Pré-requisitos
- Node.js >= 22
- npm >= 10
- Conta no [Google AI Studio](https://aistudio.google.com) com a **Gemini Live API** habilitada
- Projeto no [Supabase](https://supabase.com)
- [Expo Go](https://expo.dev/go) instalado no celular (para desenvolvimento)

### 2. Clonar e instalar
```bash
git clone <repo-url>
cd cenovia
npm install
```

### 3. Configurar o Backend
```bash
cd packages/backend
cp .env.example .env
# Edite o .env com suas chaves:
# GEMINI_API_KEY=sua_chave_gemini
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_KEY=sua_service_key
```

### 4. Configurar o App Mobile
```bash
cd apps/mobile
cp .env.example .env
# Edite o .env:
# EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
# EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 5. Configurar o Supabase
1. Acesse seu projeto no Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o conteúdo de `supabase/migrations/001_initial.sql`
4. Em **Authentication > Settings**, habilite **Email Auth**

### 6. Rodar em desenvolvimento
```bash
# Terminal 1 — Backend
npm run backend
# Servidor rodando em http://localhost:3001

# Terminal 2 — App Mobile
npm run mobile
# Escaneie o QR code com Expo Go
```

## 📱 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| App multiplataforma | Expo 52 + React Native 0.76 |
| Motor gráfico | React Native Skia |
| Animações | React Native Reanimated v3 |
| Avatar | Lottie React Native |
| Voz & IA | Gemini Live API |
| Backend | Node.js 22 + TypeScript |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth |

## 🔑 Variáveis de Ambiente

### Backend (`packages/backend/.env`)
| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Chave da Google AI Studio (**secreta, nunca no client**) |
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key do Supabase (**secreta**) |
| `PORT` | Porta do servidor (padrão: 3001) |
| `FREE_TIER_MINUTES_PER_MONTH` | Limite de minutos gratuitos (padrão: 30) |

### Mobile (`apps/mobile/.env`)
| Variável | Descrição |
|----------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública do Supabase |
| `EXPO_PUBLIC_BACKEND_URL` | URL do backend (ex: http://localhost:3001) |

## 🗄️ Banco de Dados

Execute as migrations na ordem:
1. `supabase/migrations/001_initial.sql` — Estrutura inicial

## 📦 Deploy

### Backend (Railway)
```bash
# Instale o Railway CLI
npm install -g @railway/cli
railway login
cd packages/backend
railway init
railway up
```

### App Web (Vercel)
```bash
cd apps/mobile
npx expo export -p web
# Deploy a pasta dist/ no Vercel
```

### App Nativo (EAS)
```bash
npm install -g eas-cli
cd apps/mobile
eas login
eas build --platform all
```

## 📄 Licença
Proprietário — CenovIA © 2026
