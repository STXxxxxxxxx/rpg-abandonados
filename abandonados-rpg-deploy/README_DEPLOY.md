# Abandonados RPG - Deploy

Este projeto e uma aplicacao Node.js full-stack com Express, EJS, MongoDB Atlas, Socket.io e sessoes.
Ele precisa ser hospedado em um ambiente que rode Node.js, como Render, Railway, Fly.io, VPS ou similar.

## Arquivos principais

- `server.js`: servidor Express, rotas, Socket.io e regras da ficha.
- `models/`: schemas do MongoDB.
- `views/`: telas EJS.
- `public/`: CSS e JavaScript do front-end.
- `package.json`: comandos e dependencias.
- `.env.example`: modelo das variaveis de ambiente.

## Variaveis de ambiente

Configure estas variaveis no painel da hospedagem:

```env
PORT=3000
MONGO_URI=mongodb+srv://USUARIO:SENHA@SEU_CLUSTER.mongodb.net/rpg_overlay?retryWrites=true&w=majority
SESSION_SECRET=troque-por-um-segredo-grande
OBS_TOKEN=troque-por-um-token-do-obs
```

Nao envie o arquivo `.env` real para repositorio publico.

## Comandos

Instalar dependencias:

```bash
npm install
```

Rodar localmente:

```bash
npm start
```

Com pnpm:

```bash
pnpm install
pnpm start
```

## Render/Railway

Use:

- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node 18 ou superior

Depois de subir, abra a URL publica da hospedagem. Para o OBS, use a rota de overlay gerada no painel do Mestre.
