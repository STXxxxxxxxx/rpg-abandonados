const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");

const User = require("./models/User");
const Character = require("./models/Character");

function protectConsoleStream(stream) {
  if (stream && typeof stream.on === "function") {
    stream.on("error", () => {});
  }
}

function protectConsoleMethod(method) {
  const original = console[method].bind(console);
  console[method] = (...args) => {
    try {
      original(...args);
    } catch (_error) {}
  };
}

protectConsoleStream(process.stdout);
protectConsoleStream(process.stderr);
["log", "warn", "error"].forEach(protectConsoleMethod);

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DEFAULT_MONGO_URI =
  "mongodb+srv://st25051900_db_user:<db_password>@rpg.wh40bdn.mongodb.net/rpg_overlay?appName=RPG";
const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;
const hasMongoPlaceholder = MONGO_URI.includes("<db_password>");
const SESSION_SECRET = process.env.SESSION_SECRET || "troque-este-segredo-em-producao";
const OBS_TOKEN = process.env.OBS_TOKEN || "obs-local-token";
const MASTER_SECRET_KEY = "MestreRPG2026";
const SURVIVAL_TICK_MS = 20 * 60 * 1000;

const STIGMA_LIBRARY = {
  Fome: {
    marca:
      "O Abandonado nao precisa comer ou beber tanto quanto outros. Seu corpo aprendeu a existir com menos.",
    fardo:
      "Ele sente o vazio dos outros. Em situacoes de escassez, sofre junto mesmo quando nao deveria.",
    sinal: "Pessoas percebem que ele nao come. Animais o evitam como se sentissem o cheiro da privacao.",
  },
  Guerra: {
    marca:
      "O Abandonado percebe conflito latente antes que ele exploda. Ele sente tensao, traicao e odio reprimido.",
    fardo:
      "Sua presenca frequentemente acende o que estava quieto. Discussoes comecam e velhas feridas abrem.",
    sinal: "Quem olha por tempo demais para seu rosto se lembra de inimigos antigos.",
  },
  Peste: {
    marca:
      "O Abandonado e resistente a doencas e venenos. Pode identificar enfermidades pelo cheiro ou toque.",
    fardo:
      "Sua presenca prolongada em locais fechados deixa pessoas desconfortaveis, como se o ar pesasse.",
    sinal:
      "Feridas nele fecham de forma estranha: rapido demais, ou com cicatrizes que parecem velhas demais.",
  },
  Morte: {
    marca: "O Abandonado sente quando alguem esta perto de morrer. Ele percebe o que esta para acabar.",
    fardo: "Animais morrem perto dele com mais frequencia. Plantas murcham. Chamas tremem em sua presenca.",
    sinal: "Seu pulso e irregular. Medicos que o examinam ficam perturbados sem saber explicar.",
  },
};

const ATTRIBUTE_KEYS = ["vigor", "agilidade", "forca", "intelecto", "presenca", "instinto"];

const SKILL_GROUPS = {
  vigor: ["resistencia", "constituicao"],
  agilidade: ["furtividade", "acrobacia", "fuga", "reflexos", "pontaria"],
  forca: ["luta", "atletismo", "intimidacao_fisica"],
  intelecto: ["medicina", "historia", "investigacao", "oficios"],
  presenca: ["labia", "lideranca", "negociacao", "intimidacao_psicologica"],
  instinto: ["percepcao", "rastreamento", "sobrevivencia", "pressentimento"],
};

const WEAPON_CATALOG = [
  {
    id: "faca",
    categoria: "Forca / Corpo a corpo",
    nome: "Faca",
    dano: "1d4 + 1/2 FOR",
    propriedades: "Leve. Pode ser sacada como acao livre.",
    requerMunicao: false,
  },
  {
    id: "adaga-osso",
    categoria: "Forca / Corpo a corpo",
    nome: "Adaga de osso",
    dano: "1d4 + 1/2 FOR",
    propriedades: "Leve. Nao enferruja. Quebra com resultado 1-2 no dado de dano.",
    requerMunicao: false,
  },
  {
    id: "machado-lenhador",
    categoria: "Forca / Corpo a corpo",
    nome: "Machado de lenhador",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Versatil. Pode ser arremessado em alcance curto, sem bonus de FOR.",
    requerMunicao: false,
  },
  {
    id: "espada-curta",
    categoria: "Forca / Corpo a corpo",
    nome: "Espada curta",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Equilibrada. Sem propriedades negativas.",
    requerMunicao: false,
  },
  {
    id: "espada-longa",
    categoria: "Forca / Corpo a corpo",
    nome: "Espada longa",
    dano: "1d8 + 1/2 FOR",
    propriedades: "Requer duas maos ou FOR 3+.",
    requerMunicao: false,
  },
  {
    id: "lanca",
    categoria: "Forca / Corpo a corpo",
    nome: "Lanca",
    dano: "1d8 + 1/2 FOR",
    propriedades: "Alcance. Ataca inimigos a um metro sem penalidade.",
    requerMunicao: false,
  },
  {
    id: "clava-ferro-fundido",
    categoria: "Forca / Corpo a corpo",
    nome: "Clava de ferro fundido",
    dano: "1d8 + 1/2 FOR",
    propriedades: "Pesada. Acertos podem causar Atordoado (VIG GD 12 para resistir).",
    requerMunicao: false,
  },
  {
    id: "foice-colheita",
    categoria: "Forca / Corpo a corpo",
    nome: "Foice de colheita",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Em vegetacao, vantagem no primeiro ataque da cena.",
    requerMunicao: false,
  },
  {
    id: "faca-acougueiro",
    categoria: "Forca / Corpo a corpo",
    nome: "Faca de acougueiro",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Vantagem em Medicina para tratar ferimentos. Lamina precisa.",
    requerMunicao: false,
  },
  {
    id: "lamina-vidro",
    categoria: "Forca / Corpo a corpo",
    nome: "Lamina de vidro",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Acerto critico causa Sangrando automaticamente. Quebra com resultado 1 permanente.",
    requerMunicao: false,
  },
  {
    id: "clava-pregos",
    categoria: "Forca / Corpo a corpo",
    nome: "Clava de pregos",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Ataques causam Sangrando com resultado 5+ no dado de dano.",
    requerMunicao: false,
  },
  {
    id: "gancho-carniceiro",
    categoria: "Forca / Corpo a corpo",
    nome: "Gancho de carniceiro",
    dano: "1d4 + 1/2 FOR",
    propriedades: "Em acerto, pode prender o alvo (FOR GD 13 para soltar como acao).",
    requerMunicao: false,
  },
  {
    id: "lanca-osso",
    categoria: "Forca / Corpo a corpo",
    nome: "Lanca de osso",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Leve. Pode ser arremessada. Quebra com resultado 1-2 no dado.",
    requerMunicao: false,
  },
  {
    id: "corrente-peso",
    categoria: "Forca / Corpo a corpo",
    nome: "Corrente com peso",
    dano: "1d6 + 1/2 FOR",
    propriedades: "Alcance medio. Pode derrubar em vez de causar dano. Escolha antes.",
    requerMunicao: false,
  },
  {
    id: "funda-pedras",
    categoria: "Distancia / Agilidade",
    nome: "Funda e pedras",
    dano: "1d4",
    propriedades: "A distancia. Municao ilimitada onde houver pedras. Desvantagem acima de 30m.",
    requerMunicao: true,
    tipoMunicao: "Pedras",
  },
  {
    id: "arco-curto",
    categoria: "Distancia / Agilidade",
    nome: "Arco curto",
    dano: "1d6 + 1/2 AGI",
    propriedades: "Alcance medio. Flechas contadas.",
    requerMunicao: true,
    tipoMunicao: "Flechas",
  },
  {
    id: "arco-longo",
    categoria: "Distancia / Agilidade",
    nome: "Arco longo",
    dano: "1d8 + 1/2 AGI",
    propriedades: "Alcance longo. Flechas contadas.",
    requerMunicao: true,
    tipoMunicao: "Flechas",
  },
  {
    id: "besta",
    categoria: "Distancia / Agilidade",
    nome: "Besta",
    dano: "1d10",
    propriedades: "Alcance longo. Virotes. Recarregar = acao secundaria.",
    requerMunicao: true,
    tipoMunicao: "Virotes",
  },
  {
    id: "zarabatana",
    categoria: "Distancia / Agilidade",
    nome: "Zarabatana",
    dano: "1d4",
    propriedades: "Alcance curto. Dardos. Aplica veneno sem custo adicional de acao.",
    requerMunicao: true,
    tipoMunicao: "Dardos",
  },
  {
    id: "faca-arremessada",
    categoria: "Distancia / Agilidade",
    nome: "Faca arremessada",
    dano: "1d4",
    propriedades: "Alcance curto. A faca e a municao.",
    requerMunicao: true,
    tipoMunicao: "Facas",
  },
];

const ARMOR_CATALOG = [
  { nome: "Nenhuma", bonus: 0, penalidades: [] },
  { nome: "Roupas reforcadas", bonus: 1, penalidades: [] },
  { nome: "Couro cru", bonus: 2, penalidades: ["furtividade"] },
  { nome: "Couro endurecido", bonus: 3, penalidades: ["furtividade"] },
  {
    nome: "Osso costurado",
    bonus: 2,
    penalidades: ["furtividade"],
    observacao: "Desvantagem em Furtividade apenas em silencio total.",
  },
  { nome: "Cota de malha remendada", bonus: 4, penalidades: ["furtividade", "acrobacia"] },
  {
    nome: "Placas improvisadas",
    bonus: 3,
    penalidades: ["furtividade", "acrobacia", "reflexos"],
  },
  { nome: "Robes de monge reforcados", bonus: 1, penalidades: [] },
  { nome: "Couro de criatura", bonus: 3, penalidades: [] },
];

const EQUIPMENT_CONDITIONS = ["Boa", "Desgastada", "Quebrada"];
const TWO_HANDED_WEAPONS = new Set(["Espada longa", "Arco longo", "Besta"]);
const PHYSICAL_DISADVANTAGES = [
  "resistencia",
  "constituicao",
  "furtividade",
  "acrobacia",
  "fuga",
  "reflexos",
  "pontaria",
  "luta",
  "atletismo",
  "intimidacao_fisica",
];
const PESO_DISADVANTAGES = ["acrobacia", "fuga"];

const SHOP_CATALOG = {
  ferreiro: {
    nome: "O Ferreiro Manco",
    subtitulo: "Armas, escudos e reparos de metal bruto.",
    itens: [
      { nome: "Faca", preco: 10, condicao: "Boa", obs: "Sempre em estoque" },
      { nome: "Adaga de osso", preco: 10, condicao: "Boa", obs: "Feita com ossos de criatura" },
      { nome: "Machado de lenhador", preco: 10, condicao: "Boa", obs: "Funcional. Sem refinamento" },
      { nome: "Espada curta", preco: 50, condicao: "Boa", obs: "Duas disponiveis" },
      { nome: "Espada longa", preco: 150, condicao: "Desgastada", obs: "Uma unidade. Remendada" },
      { nome: "Lanca", preco: 50, condicao: "Boa", obs: "Cabo novo, ponta velha" },
      { nome: "Clava de pregos", preco: 10, condicao: "Boa", obs: "Feita na hora se trouxer madeira" },
      { nome: "Lamina de vidro", preco: 50, condicao: "Boa", obs: "Sem devolucao" },
      { nome: "Corrente com peso", preco: 50, condicao: "Boa", obs: "Peca unica. Veio de um navio" },
      { nome: "Arco curto", preco: 50, condicao: "Desgastada", obs: "Corda trocada recentemente" },
      { nome: "Arco longo", preco: 150, condicao: "Desgastada", obs: "Dificil de encontrar" },
      { nome: "Besta", preco: 150, condicao: "Desgastada", obs: "Mecanismo rangendo" },
      { nome: "Flechas x10", preco: 10, obs: "Ponta de ferro bruto" },
      { nome: "Virotes x5", preco: 10, obs: "Mais curtos, funcionam" },
      { nome: "Escudo de madeira reforcada", preco: 50, condicao: "Boa", obs: "Pesado" },
      { nome: "Reparo Desgastada", preco: 10, obs: "Requer 1 dia e materiais" },
      { nome: "Reparo Quebrada", preco: 50, obs: "Requer 2 dias" },
    ],
  },
  boticaria: {
    nome: "A Boticaria",
    subtitulo: "Nao atende apos o anoitecer.",
    itens: [
      { nome: "Erva de fechamento", preco: 10, usos: "1", obs: "Sempre disponivel. Max 3 por visita" },
      { nome: "Cataplasma de raiz amarga", preco: 50, usos: "1", obs: "Remove Envenenado" },
      { nome: "Po de cascas secas", preco: 50, usos: "1", obs: "Reduz GD de Medicina para infeccoes" },
      { nome: "Tonico de vigilia", preco: 50, usos: "1 por cena", obs: "Risco de dependencia" },
      { nome: "Torcao das ervas do esquecimento", preco: 500, usos: "1", obs: "Vende com relutancia" },
      { nome: "Kit de Medicina completo", preco: 50, usos: "5", obs: "Reabastecivel" },
      { nome: "Diagnostico [Servico]", preco: 10, obs: "Diz o que esta errado. Inclui doencas ocultas" },
      { nome: "Tratamento simples [Servico]", preco: 50, obs: "Sangrando, Atordoado, Envenenado" },
      { nome: "Tratamento grave [Servico]", preco: 150, obs: "Recupera +2d6 PV adicionais" },
      { nome: "Tratamento de Cicatriz [Servico]", preco: 500, obs: "Reduz penalidade por 1 sessao" },
      { nome: "Conversa sobre Trauma [Servico]", preco: 50, obs: "Reduz Trauma Agudo em 1 sessao" },
      { nome: "Po de osso moido", preco: 50, usos: "3", obs: "Estoque variavel" },
    ],
  },
  cendrath: {
    nome: "O Armazem de Cendrath",
    subtitulo: "Suprimentos, mapas e pequenas reliquias.",
    itens: [
      { nome: "Racao seca 1 dia", preco: 10, obs: "Pacote simples para viagem" },
      { nome: "Racao seca 7 dias", preco: 40, obs: "Pacote com desconto para viagem" },
      { nome: "Carne defumada", preco: 50, obs: "Cheiro forte" },
      { nome: "Agua", preco: 0, obs: "0 moedas na compra de outro item" },
      { nome: "Corda 15m", preco: 10 },
      { nome: "Lamparina", preco: 10 },
      { nome: "Oleo 4h", preco: 10 },
      { nome: "Tocha x3", preco: 10 },
      { nome: "Giz de marcacao", preco: 10, usos: "20", obs: "Para marcas discretas" },
      { nome: "Mochila de couro", preco: 50 },
      { nome: "Cantil reforcado", preco: 10 },
      { nome: "Cobertor de viagem", preco: 10, obs: "Sem ele no frio, recupera metade dos PV no Descanso" },
      { nome: "Kit de fechaduras", preco: 150 },
      { nome: "Luneta remendada", preco: 150 },
      { nome: "Livro + carvao", preco: 10 },
      { nome: "Mapa local", preco: 150 },
    ],
  },
  brecha: {
    nome: "Brecha e Costura",
    subtitulo: "Armaduras, escudos e reformas.",
    itens: [
      { nome: "Roupas reforcadas", preco: 10, condicao: "Boa", obs: "Sob medida em 1 dia" },
      { nome: "Couro cru", preco: 50, condicao: "Boa", obs: "Estoque de 2 unidades" },
      { nome: "Couro endurecido", preco: 50, condicao: "Boa", obs: "Encomenda 3 dias" },
      { nome: "Osso costurado", preco: 50, condicao: "Boa", obs: "Cheira mal. Especialidade" },
      { nome: "Cota de malha remendada", preco: 150, condicao: "Desgastada" },
      { nome: "Placas improvisadas", preco: 150, condicao: "Desgastada", obs: "Encomenda 5 dias + materiais" },
      { nome: "Couro de criatura", preco: 150, condicao: "Boa", obs: "So se o cliente trouxer o couro" },
      { nome: "Escudo de madeira", preco: 50, obs: "3 dias" },
      { nome: "Escudo de metal", preco: 150, condicao: "Desgastada" },
      { nome: "Ferramentas de Oficio", preco: 50 },
      { nome: "Reforma Desgastada", preco: 50 },
      { nome: "Reforma Quebrada", preco: 150 },
      { nome: "Adaptacao de tamanho", preco: 10 },
      { nome: "Encomenda especial", preco: 500 },
    ],
  },
};

const RITUAL_CATALOG = [
  {
    id: "a-marca",
    nome: "A Marca",
    ato:
      "Corta a si mesmo no mesmo lugar, sempre. A cicatriz nunca some; e reaberta antes que feche de vez.",
    preco:
      "Causa 1d4 de dano em si mesmo, nao pode ser reduzido. Apos cinco usos, vira Cicatriz Fisica: Algo que nao fecha.",
    ancora: "Recupera 1d6 de PS imediatamente. Pode ser usado uma vez por cena.",
  },
  {
    id: "a-contagem",
    nome: "A Contagem",
    ato: "Conta algo repetidamente: pedras, respiracoes, batidas do coracao. Precisa terminar ou nao age.",
    preco:
      "Passa um turno inteiro sem agir. Se interrompido, nao recebe beneficio e sofre Desvantagem no proximo teste.",
    ancora: "Ao terminar, remove uma Condicao ativa, exceto Sangrando, e age com Vantagem no turno seguinte.",
  },
  {
    id: "o-jejum",
    nome: "O Jejum",
    ato: "Para de comer por periodo determinado. Nao por falta. Por escolha. A fome parece mais honesta.",
    preco: "Perde acesso ao beneficio de Descanso Longo, nao recuperando PV durante o periodo.",
    ancora: "Durante o jejum, todos os testes de INS ganham Vantagem.",
  },
  {
    id: "o-fogo",
    nome: "O Fogo",
    ato: "Passa a mao por cima de uma chama. Devagar. O suficiente para sentir.",
    preco:
      "Causa 1 de dano, ou 1d4 se mantiver mais tempo. Com uso repetido do 1d4, vira Cicatriz Fisica apos quatro usos.",
    ancora: "Remove o estado Apavorado imediatamente. Pode ser usado como Reacao, fora do seu turno.",
  },
  {
    id: "a-vigilia",
    nome: "A Vigilia",
    ato: "Nao dorme. Fica acordado ate o corpo desligar sozinho.",
    preco: "Nega Descanso Longo voluntariamente. Desvantagem em todos os testes fisicos no dia seguinte.",
    ancora: "Durante a vigilia, testes de INT + Investigacao ou INS + Pressentimento ganham Vantagem.",
  },
  {
    id: "o-peso",
    nome: "O Peso",
    ato: "Carrega algo pesado o tempo todo: pedra, ferro, correntes. O desconforto e o ponto.",
    preco: "Desvantagem permanente em Acrobacia e fuga. PRE GD 14 para largar voluntariamente em emergencia.",
    ancora:
      "Vantagem em todos os testes de FOR. O primeiro Trauma Agudo de cada sessao tem duracao reduzida em uma sessao.",
  },
  {
    id: "a-confissao",
    nome: "A Confissao",
    ato: "Diz em voz alta o que fez de errado. Para o ar, para as paredes, para um morto.",
    preco:
      "O conteudo e real: erros, mortes, decisoes. E ouvido por quem estiver presente. O Mestre pode usar narrativamente.",
    ancora: "Recupera 1d8 de PS. So pode ser usado uma vez por sessao.",
  },
];

mongoose.set("bufferCommands", false);

if (hasMongoPlaceholder) {
  console.error(
    "MongoDB Atlas sem senha: substitua <db_password> no MONGO_URI do .env pela senha do usuario do banco.",
  );
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB conectado."))
    .catch((error) => console.error("MongoDB indisponivel:", error.message));
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24,
  },
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

const onlineCharacters = new Map();
let activeShops = { ferreiro: false, boticaria: false, cendrath: false, brecha: false };
let isSessionActive = false;
let ritualLog = [];
let rollLog = [];

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

function renderDatabaseOffline(res) {
  return res.status(503).render("login", {
    error:
      "MongoDB Atlas offline ou MONGO_URI invalido. Confira o .env e substitua <db_password> pela senha do usuario do banco.",
    success: "",
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return 0;
}

function arrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function getWeaponById(weaponId) {
  return WEAPON_CATALOG.find((weapon) => weapon.id === weaponId);
}

function normalizeKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPriceValue(preco = 0) {
  const cost = Number(preco);

  if (!Number.isInteger(cost) || cost < 0) {
    return null;
  }

  return cost;
}

function parseUses(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function getShopItem(shopKey, itemIndex) {
  const shop = SHOP_CATALOG[shopKey];
  const index = Number(itemIndex);

  if (!shop || !Number.isInteger(index) || index < 0 || index >= shop.itens.length) {
    return null;
  }

  return shop.itens[index];
}

function buildPurchasedInventoryItem(shopKey, shopItem) {
  const weapon = WEAPON_CATALOG.find((entry) => entry.nome === shopItem.nome);
  const quantityMatch = String(shopItem.nome).match(/\bx(\d+)\b/i);
  const usos = parseUses(shopItem.usos);

  if (weapon) {
    return buildStartingWeaponItem(weapon);
  }

  return {
    nome: shopItem.nome,
    quantidade: quantityMatch ? Number(quantityMatch[1]) : 1,
    peso: 1,
    ehArma: false,
    categoria: SHOP_CATALOG[shopKey]?.nome || "Loja",
    dano: "",
    propriedades: shopItem.obs || shopItem.condicao || shopItem.usos || "",
    requerMunicao: false,
    tipoMunicao: "",
    equipado: false,
    usos,
    consumivel: Boolean(usos || getConsumableConfig(shopItem.nome)),
  };
}

function getRitualById(ritualId) {
  return RITUAL_CATALOG.find((ritual) => ritual.id === ritualId);
}

function normalizeRitual(ritual) {
  if (!ritual) {
    return null;
  }

  if (typeof ritual === "string") {
    return {
      nome: ritual,
      ato: "Ritual antigo sem ato registrado.",
      preco: "Preco nao registrado.",
      ancora: "Ancora nao registrada.",
    };
  }

  const raw = typeof ritual.toObject === "function" ? ritual.toObject() : ritual;
  const nome = String(raw.nome || "").trim();

  if (!nome) {
    return null;
  }

  return {
    nome,
    ato: String(raw.ato || "").trim(),
    preco: String(raw.preco || "").trim(),
    ancora: String(raw.ancora || "").trim(),
  };
}

function getRituals(character) {
  return (character.rituais || []).map(normalizeRitual).filter(Boolean);
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function getConsumableConfig(itemOrName = "") {
  const itemName = typeof itemOrName === "string" ? itemOrName : itemOrName?.nome || "";
  const name = normalizeKey(itemName);

  if (!name || name.includes("vazio")) {
    return null;
  }

  if (name.includes("erva de fechamento")) {
    return { id: "erva-fechamento", type: "heal-pv", die: 6, consumeUnit: true };
  }

  if (name.includes("tonico de vigilia")) {
    return { id: "tonico-vigilia", type: "heal-ps", die: 6, consumeUnit: true };
  }

  if (name.includes("cataplasma de raiz amarga")) {
    return { id: "cataplasma-raiz-amarga", type: "remove-condition", condition: "Envenenado", consumeUnit: true };
  }

  if (name.includes("po de osso moido")) {
    return { id: "po-osso-moido", type: "heal-ps", die: 4, uses: 3, removeAtZero: true };
  }

  if (name.includes("kit de medicina completo")) {
    return {
      id: "kit-medicina-completo",
      type: "heal-pv",
      die: 8,
      uses: 5,
      emptyName: "Kit de Medicina (Vazio)",
    };
  }

  if (name.includes("racao seca") || name.includes("carne defumada")) {
    return { id: "provisao", type: "narrative-consume", consumeUnit: true };
  }

  return null;
}

function isUsableInventoryItem(item = {}) {
  const uses = Number(item.usos);
  return Boolean(getConsumableConfig(item) || (Number.isFinite(uses) && uses > 0));
}

function setLegacyVitals(character) {
  if (character.vida_atual !== undefined) {
    character.vida_atual = character.pv_atual;
  }

  if (character.sanidade_atual !== undefined) {
    character.sanidade_atual = character.ps_atual;
  }
}

function addActiveDisadvantages(character, disadvantages = []) {
  character.desvantagens_ativas = uniqueStrings([
    ...(character.desvantagens_ativas || []),
    ...disadvantages,
  ]);
}

function getRitualDisadvantages(character) {
  return uniqueStrings(character.desvantagens_ativas || []);
}

function applyRitualEffect(character, ritual) {
  const ritualKey = normalizeKey(ritual.nome);
  const pvMax = numberValue(character.pv_max, character.vida_max, 10);
  const psMax = numberValue(character.ps_max, character.sanidade_max, 10);
  const currentPv = clamp(numberValue(character.pv_atual, character.vida_atual, pvMax), 0, pvMax);
  const currentPs = clamp(numberValue(character.ps_atual, character.sanidade_atual, psMax), 0, psMax);

  if (ritualKey === "a marca") {
    const damage = rollDie(4);
    character.pv_atual = clamp(currentPv - damage, 0, pvMax);
    setLegacyVitals(character);

    return {
      tipo: "dano",
      rolagem: `1d4 = ${damage}`,
      pvDelta: -damage,
      mensagem: `A Marca abriu a carne: ${damage} PV perdido(s).`,
    };
  }

  if (ritualKey === "a contagem") {
    character.bloqueado = true;

    return {
      tipo: "bloqueio_turno",
      mensagem: "A Contagem foi iniciada: o jogador sacrificou o turno atual.",
    };
  }

  if (ritualKey === "o jejum") {
    character.em_jejum = true;

    return {
      tipo: "jejum",
      mensagem: "O Jejum esta ativo: a proxima cura por Descanso Longo deve ser bloqueada.",
    };
  }

  if (ritualKey === "o fogo") {
    character.pv_atual = clamp(currentPv - 1, 0, pvMax);
    setLegacyVitals(character);

    return {
      tipo: "dano",
      pvDelta: -1,
      mensagem: "O Fogo queimou a mao: 1 PV perdido.",
    };
  }

  if (ritualKey === "a vigilia") {
    character.em_vigilia = true;
    addActiveDisadvantages(character, PHYSICAL_DISADVANTAGES);

    return {
      tipo: "vigilia",
      desvantagens: PHYSICAL_DISADVANTAGES,
      mensagem: "A Vigilia esta ativa: testes fisicos ficam em Desvantagem.",
    };
  }

  if (ritualKey === "o peso") {
    character.peso_ativo = true;
    addActiveDisadvantages(character, PESO_DISADVANTAGES);

    return {
      tipo: "peso",
      desvantagens: PESO_DISADVANTAGES,
      mensagem: "O Peso esta ativo: Acrobacia e Fuga ficam em Desvantagem.",
    };
  }

  if (ritualKey === "a confissao") {
    const healing = rollDie(8);
    character.ps_atual = clamp(currentPs + healing, 0, psMax);
    setLegacyVitals(character);

    return {
      tipo: "cura_sanidade",
      rolagem: `1d8 = ${healing}`,
      psDelta: character.ps_atual - currentPs,
      mensagem: `A Confissao aliviou a mente: ${character.ps_atual - currentPs} PS recuperado(s).`,
    };
  }

  return {
    tipo: "narrativo",
    mensagem: "Ritual registrado sem efeito mecanico automatico.",
  };
}

function buildStartingWeaponItem(weapon) {
  return {
    nome: weapon.nome,
    quantidade: 1,
    peso: 1,
    ehArma: true,
    categoria: weapon.categoria,
    dano: weapon.dano,
    propriedades: weapon.propriedades,
    requerMunicao: Boolean(weapon.requerMunicao),
    tipoMunicao: weapon.tipoMunicao || "",
    equipado: false,
  };
}

function getShopsOpen() {
  return Object.values(activeShops).some(Boolean);
}

function getArmorByName(armorName) {
  return ARMOR_CATALOG.find((armor) => armor.nome === armorName) || ARMOR_CATALOG[0];
}

function getArmorPenalties(armorName) {
  return getArmorByName(armorName).penalidades || [];
}

function normalizeEquipmentCondition(condition) {
  return EQUIPMENT_CONDITIONS.includes(condition) ? condition : "Boa";
}

function adjustedEquipmentBonus(bonus, condition) {
  const normalizedBonus = Math.max(0, Number(bonus || 0));

  if (normalizeEquipmentCondition(condition) === "Quebrada") {
    return Math.floor(normalizedBonus / 2);
  }

  return normalizedBonus;
}

function calculateDefense(characterLike) {
  const attributes = getAttributes(characterLike);
  const armor = getArmorByName(characterLike.armadura_equipada || "Nenhuma");
  const armorBonus = adjustedEquipmentBonus(armor.bonus, characterLike.armadura_condicao);
  const shieldBaseBonus = characterLike.escudo_equipado ? 1 : 0;
  const shieldBonus = adjustedEquipmentBonus(shieldBaseBonus, characterLike.escudo_condicao);

  return numberValue(attributes.agilidade, 1) + armorBonus + shieldBonus;
}

function isTwoHandedWeapon(item) {
  return TWO_HANDED_WEAPONS.has(item?.nome || "");
}

function normalizeActiveShopsPayload(payload = {}) {
  return Object.fromEntries(
    Object.keys(activeShops).map((shopKey) => [shopKey, Boolean(payload[shopKey])]),
  );
}

function getCharacterName(character) {
  return character.name || character.nome || "Abandonado sem nome";
}

function getAttributes(character) {
  const attrs = character.atributos || {};

  return {
    vigor: numberValue(attrs.vigor, 1),
    agilidade: numberValue(attrs.agilidade, 1),
    forca: numberValue(attrs.forca, 1),
    intelecto: numberValue(attrs.intelecto, 1),
    presenca: numberValue(attrs.presenca, 1),
    instinto: numberValue(attrs.instinto, 1),
  };
}

function getSkills(character) {
  const skills = character.pericias || {};
  const normalized = {};

  for (const [group, keys] of Object.entries(SKILL_GROUPS)) {
    normalized[group] = {};
    for (const key of keys) {
      normalized[group][key] = numberValue(skills[group]?.[key], 0);
    }
  }

  return normalized;
}

function getStigma(character) {
  const type = character.estigma?.tipo || "Fome";
  const fallback = STIGMA_LIBRARY[type] || STIGMA_LIBRARY.Fome;

  return {
    tipo: type,
    marca: character.estigma?.marca || fallback.marca,
    fardo: character.estigma?.fardo || fallback.fardo,
    sinal: character.estigma?.sinal || fallback.sinal,
  };
}

function normalizeInventoryItem(item) {
  const raw = typeof item.toObject === "function" ? item.toObject() : item;
  const id = raw._id ? raw._id.toString() : raw.id;

  return {
    id,
    nome: raw.nome,
    quantidade: Number(raw.quantidade || 1),
    peso: Number(raw.peso ?? raw.slots ?? 1),
    ehArma: Boolean(raw.ehArma),
    categoria: raw.categoria || "",
    dano: raw.dano || "",
    propriedades: raw.propriedades || "",
    requerMunicao: Boolean(raw.requerMunicao),
    tipoMunicao: raw.tipoMunicao || "",
    equipado: Boolean(raw.equipado),
    usos: raw.usos === undefined || raw.usos === null ? undefined : Number(raw.usos),
    consumivel: Boolean(raw.consumivel),
    utilizavel: isUsableInventoryItem(raw),
    duasMaos: isTwoHandedWeapon(raw),
  };
}

function getInventory(character) {
  const modernInventory = character.inventario || [];

  if (modernInventory.length) {
    return modernInventory.map(normalizeInventoryItem);
  }

  return (character.itens || []).map(normalizeInventoryItem);
}

function itemSlotsTotal(items = []) {
  return items.reduce((sum, item) => {
    const normalized = normalizeInventoryItem(item);
    return sum + normalized.peso * normalized.quantidade;
  }, 0);
}

function getEquippedWeapon(character) {
  const inventory = getInventory(character);
  const equippedWeapon = inventory.find((item) => item.ehArma && item.equipado);

  if (equippedWeapon) {
    return equippedWeapon;
  }

  if ((character.inventario || []).length) {
    return null;
  }

  if (character.arma_equipada) {
    return {
      id: "",
      nome: character.arma_equipada,
      quantidade: 1,
      peso: 0,
      ehArma: true,
      dano: "",
      equipado: true,
    };
  }

  return null;
}

function serializeCharacter(character) {
  const user = character.user && typeof character.user === "object" ? character.user : null;
  const id = character._id.toString();
  const inventory = getInventory(character);
  const equippedWeapon = getEquippedWeapon(character);
  const name = getCharacterName(character);
  const pvMax = numberValue(character.vida_max, character.pv_max, 10);
  const pvAtual = numberValue(character.vida_atual, character.pv_atual, pvMax);
  const psMax = numberValue(character.sanidade_max, character.ps_max, 10);
  const psAtual = numberValue(character.sanidade_atual, character.ps_atual, psMax);
  const hunger = clamp(numberValue(character.fome, 100), 0, 100);
  const thirst = clamp(numberValue(character.sede, 100), 0, 100);
  const armor = getArmorByName(character.armadura_equipada || "Nenhuma");
  const armorCondition = normalizeEquipmentCondition(character.armadura_condicao);
  const shieldBaseBonus = character.escudo_equipado ? 1 : 0;
  const shieldCondition = shieldBaseBonus
    ? normalizeEquipmentCondition(character.escudo_condicao)
    : "Boa";
  const adjustedArmorBonus = adjustedEquipmentBonus(armor.bonus, armorCondition);
  const adjustedShieldBonus = adjustedEquipmentBonus(shieldBaseBonus, shieldCondition);
  const defense = calculateDefense(character);
  const armorPenalties = getArmorPenalties(armor.nome);
  const ritualPenalties = getRitualDisadvantages(character);
  const activeDisadvantages = uniqueStrings([...armorPenalties, ...ritualPenalties]);

  return {
    id,
    userId: user?._id ? user._id.toString() : character.user?.toString(),
    username: user?.username || "jogador",
    name,
    nome: name,
    pv_max: pvMax,
    pv_atual: pvAtual,
    ps_max: psMax,
    ps_atual: psAtual,
    vida_max: pvMax,
    vida_atual: pvAtual,
    sanidade_max: psMax,
    sanidade_atual: psAtual,
    fome: hunger,
    sede: thirst,
    fone_sede_ativo: character.fone_sede_ativo !== false,
    municao_max: character.municao_max,
    municao_atual: character.municao_atual,
    arma_equipada: equippedWeapon?.nome || "",
    arma_equipada_dano: equippedWeapon?.dano || "",
    arma_equipada_item_id: equippedWeapon?.id || "",
    armadura_equipada: armor.nome,
    armadura_condicao: armorCondition,
    escudo_equipado: Boolean(character.escudo_equipado),
    escudo_condicao: shieldCondition,
    defesa: defense,
    armadura_bonus: armor.bonus,
    armadura_bonus_ajustado: adjustedArmorBonus,
    escudo_bonus: shieldBaseBonus,
    escudo_bonus_ajustado: adjustedShieldBonus,
    armadura_penalidades_base: armorPenalties,
    armadura_penalidades: activeDisadvantages,
    desvantagens_ativas: ritualPenalties,
    armadura_observacao: armor.observacao || "",
    bloqueado: Boolean(character.bloqueado),
    em_jejum: Boolean(character.em_jejum),
    em_vigilia: Boolean(character.em_vigilia),
    peso_ativo: Boolean(character.peso_ativo),
    condicoes: character.condicoes || [],
    dinheiro: character.dinheiro || 0,
    rituais: getRituals(character),
    atributos: getAttributes(character),
    pericias: getSkills(character),
    estigma: getStigma(character),
    limite_inventario: character.limite_inventario,
    inventario: inventory,
    itens: inventory,
    inventario_usado: itemSlotsTotal(inventory),
    lojas_ativas: { ...activeShops },
    loja_liberada: getShopsOpen(),
    sessao_ativa: isSessionActive,
    online: onlineCharacters.has(id),
  };
}

async function loadCurrentUser(req, res, next) {
  res.locals.currentUser = null;

  if (!req.session.userId) {
    return next();
  }

  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      return res.redirect("/?error=session_expired");
    }

    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/?error=login_required");
  }

  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect("/?error=login_required");
    }

    if (req.session.role !== role) {
      return res.status(403).render("forbidden", {
        title: "Acesso negado",
        message: "Esta ala do grimorio nao responde ao seu selo de acesso.",
      });
    }

    return next();
  };
}

async function renderLogin(req, res) {
  if (req.session.userId) {
    if (req.session.role === "master") {
      return res.redirect("/mestre");
    }

    const character = await Character.findOne({ user: req.session.userId });
    return res.redirect(character ? "/ficha" : "/criar-ficha");
  }

  const errorMessages = {
    register_failed:
      "Cadastro falhou. Se a senha/chave estiver correta, verifique a conexao com o MongoDB Atlas.",
    login_failed:
      "Login falhou. Se as credenciais estiverem corretas, verifique a conexao com o MongoDB Atlas.",
    mongodb_offline: "MongoDB Atlas offline ou MONGO_URI invalido.",
    missing_register_fields: "Preencha usuario e senha para criar a conta.",
    missing_login_fields: "Preencha usuario e senha para entrar.",
    username_taken: "Este nome de usuario ja esta em uso.",
    invalid_credentials: "Usuario ou senha invalidos.",
    login_required: "Faca login para acessar esta area.",
    session_expired: "Sua sessao expirou. Entre novamente.",
    missing_character_name: "Informe o nome do Abandonado antes de selar a ficha.",
    attribute_points_exceeded: "A soma dos atributos nao pode ultrapassar 15 pontos.",
    skill_points_exceeded: "A soma das pericias nao pode ultrapassar 10 pontos.",
    initial_rituals_exceeded: "Escolha no maximo 1 ritual inicial.",
    invalid_initial_ritual: "O ritual selecionado nao existe no catalogo.",
  };

  return res.render("login", {
    error: errorMessages[req.query.error] || req.query.error || "",
    success: req.query.success || "",
  });
}

async function getMasterTable() {
  if (!isDatabaseReady()) {
    return [];
  }

  const characters = await Character.find()
    .populate("user", "username role")
    .sort({ updatedAt: -1 });

  return characters.map(serializeCharacter);
}

async function emitMasterTable() {
  if (!isDatabaseReady()) {
    return;
  }

  const table = await getMasterTable();
  io.to("masters").emit("master:characters", table);
}

async function emitCharacterUpdate(characterId) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(characterId).populate("user", "username role");

  if (!character) {
    return;
  }

  const payload = serializeCharacter(character);
  io.to(`character:${characterId}`).emit("character:updated", payload);
  io.to("masters").emit("character:updated", payload);
  await emitMasterTable();
}

function emitSessionStatus() {
  io.emit("sessao:status", { ativa: isSessionActive });
}

async function applySurvivalTick() {
  if (!isSessionActive || !isDatabaseReady()) {
    return;
  }

  const characters = await Character.find({ fone_sede_ativo: { $ne: false } });

  for (const character of characters) {
    character.fome = clamp(numberValue(character.fome, 100) - 5, 0, 100);
    character.sede = clamp(numberValue(character.sede, 100) - 5, 0, 100);
    await character.save();
    await emitCharacterUpdate(character._id.toString());
  }
}

setInterval(() => {
  applySurvivalTick().catch(console.error);
}, SURVIVAL_TICK_MS);

app.use(loadCurrentUser);

app.get("/", renderLogin);

app.post("/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = req.body.role === "master" ? "master" : "player";
    const masterKey = String(req.body.masterKey || "").trim();

    if (!username || !password) {
      return res.redirect("/?error=missing_register_fields");
    }

    if (role === "master" && masterKey !== MASTER_SECRET_KEY) {
      return res.status(403).render("forbidden", {
        title: "Chave de Administrador Invalida",
        message: "A criacao de contas de Mestre exige a chave secreta da mesa.",
      });
    }

    if (!isDatabaseReady()) {
      return renderDatabaseOffline(res);
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.redirect("/?error=username_taken");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ username, password: hashedPassword, role });

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    return res.redirect(user.role === "master" ? "/mestre" : "/criar-ficha");
  } catch (error) {
    console.error(error);
    return res.redirect("/?error=register_failed");
  }
});

app.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.redirect("/?error=missing_login_fields");
    }

    if (!isDatabaseReady()) {
      return renderDatabaseOffline(res);
    }

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      return res.redirect("/?error=invalid_credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.redirect("/?error=invalid_credentials");
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    if (user.role === "master") {
      return res.redirect("/mestre");
    }

    const character = await Character.findOne({ user: user._id });
    return res.redirect(character ? "/ficha" : "/criar-ficha");
  } catch (error) {
    console.error(error);
    return res.redirect("/?error=login_failed");
  }
});

app.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.get("/criar-ficha", requireRole("player"), async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return renderDatabaseOffline(res);
    }

    const existingCharacter = await Character.findOne({ user: req.session.userId });

    if (existingCharacter) {
      return res.redirect("/ficha");
    }

    return res.render("wizard", {
      error: req.query.error || "",
      stigmaLibrary: STIGMA_LIBRARY,
      stigmaLibraryJson: jsonForHtml(STIGMA_LIBRARY),
      skillGroups: SKILL_GROUPS,
      skillGroupsJson: jsonForHtml(SKILL_GROUPS),
      weaponCatalog: WEAPON_CATALOG,
      ritualCatalog: RITUAL_CATALOG,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/criar-ficha", requireRole("player"), async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      return renderDatabaseOffline(res);
    }

    const name = String(req.body.name || req.body.nome || "").trim();

    if (!name) {
      return res.redirect("/criar-ficha?error=missing_character_name");
    }

    const atributos = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, clamp(Number(req.body[key] || 1), 1, 4)]),
    );
    const totalAtributos = Object.values(atributos).reduce((sum, value) => sum + value, 0);

    if (totalAtributos > 15) {
      return res.redirect("/criar-ficha?error=attribute_points_exceeded");
    }

    const pericias = {};
    let totalPericias = 0;

    for (const [group, keys] of Object.entries(SKILL_GROUPS)) {
      pericias[group] = {};

      for (const key of keys) {
        const fieldName = `pericia_${group}_${key}`;
        const value = clamp(Number(req.body[fieldName] || 0), 0, 3);
        pericias[group][key] = value;
        totalPericias += value;
      }
    }

    if (totalPericias > 10) {
      return res.redirect("/criar-ficha?error=skill_points_exceeded");
    }

    const selectedWeaponIds = [...new Set(arrayValue(req.body.armas_iniciais).map(String))];

    if (selectedWeaponIds.length > 2) {
      return res.redirect("/criar-ficha?error=initial_weapons_exceeded");
    }

    const selectedWeapons = selectedWeaponIds.map(getWeaponById);

    if (selectedWeapons.some((weapon) => !weapon)) {
      return res.redirect("/criar-ficha?error=invalid_initial_weapon");
    }

    const selectedRitualIds = [...new Set(arrayValue(req.body.ritual_inicial).map(String))];

    if (selectedRitualIds.length > 1) {
      return res.redirect("/criar-ficha?error=initial_rituals_exceeded");
    }

    const selectedRituals = selectedRitualIds.map(getRitualById);

    if (selectedRituals.some((ritual) => !ritual)) {
      return res.redirect("/criar-ficha?error=invalid_initial_ritual");
    }

    const stigmaType = STIGMA_LIBRARY[req.body.estigma_tipo] ? req.body.estigma_tipo : "Fome";
    const stigmaData = STIGMA_LIBRARY[stigmaType];
    const pvMax = atributos.vigor * 5 + atributos.forca;
    const psMax = atributos.presenca * 4 + atributos.instinto;
    const initialWeapons = selectedWeapons.map(buildStartingWeaponItem);
    const initialDefense = calculateDefense({
      atributos,
      armadura_equipada: "Nenhuma",
      escudo_equipado: false,
    });
    const rituais = selectedRituals.map(({ nome, ato, preco, ancora }) => ({
      nome,
      ato,
      preco,
      ancora,
    }));

    await Character.create({
      user: req.session.userId,
      name,
      nome: name,
      atributos,
      pericias,
      estigma: {
        tipo: stigmaType,
        ...stigmaData,
      },
      pv_max: pvMax,
      pv_atual: pvMax,
      ps_max: psMax,
      ps_atual: psMax,
      vida_max: pvMax,
      vida_atual: pvMax,
      sanidade_max: psMax,
      sanidade_atual: psMax,
      fome: 100,
      sede: 100,
      fone_sede_ativo: true,
      municao_max: 0,
      municao_atual: 0,
      armadura_equipada: "Nenhuma",
      armadura_condicao: "Boa",
      escudo_equipado: false,
      escudo_condicao: "Boa",
      defesa: initialDefense,
      dinheiro: Math.max(0, Number(req.body.dinheiro || 0)),
      rituais,
      limite_inventario: Math.max(1, Number(req.body.limite_inventario || 6)),
      inventario: initialWeapons,
    });

    return res.redirect("/ficha");
  } catch (error) {
    console.error(error);
    return res.redirect("/criar-ficha?error=create_character_failed");
  }
});

app.get("/ficha", requireRole("player"), async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return renderDatabaseOffline(res);
    }

    const character = await Character.findOne({ user: req.session.userId }).populate(
      "user",
      "username role",
    );

    if (!character) {
      return res.redirect("/criar-ficha");
    }

    const payload = serializeCharacter(character);

    return res.render("ficha", {
      character: payload,
      characterJson: jsonForHtml(payload),
      shopCatalog: SHOP_CATALOG,
      shopCatalogJson: jsonForHtml(SHOP_CATALOG),
      armorCatalog: ARMOR_CATALOG,
      armorCatalogJson: jsonForHtml(ARMOR_CATALOG),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/mestre", requireRole("master"), async (_req, res, next) => {
  try {
    const characters = await getMasterTable();

    return res.render("mestre", {
      characters,
      charactersJson: jsonForHtml(characters),
      obsToken: OBS_TOKEN,
      activeShops,
      activeShopsJson: jsonForHtml(activeShops),
      ritualLogJson: jsonForHtml(ritualLog),
      shopCatalog: SHOP_CATALOG,
      isSessionActive,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/overlay/:id", async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).render("forbidden", {
        title: "Banco conectando",
        message: "O overlay aguarda a conexao com o MongoDB.",
      });
    }

    const isMaster = req.session.role === "master";
    const hasObsToken = req.query.token && req.query.token === OBS_TOKEN;

    if (!isMaster && !hasObsToken) {
      return res.status(403).render("forbidden", {
        title: "Overlay protegido",
        message: "Este vitral do OBS exige acesso do Mestre ou token dedicado.",
      });
    }

    const character = await Character.findById(req.params.id).populate("user", "username role");

    if (!character) {
      return res.status(404).render("forbidden", {
        title: "Ficha nao encontrada",
        message: "Nenhum Abandonado responde por este selo.",
      });
    }

    const payload = serializeCharacter(character);

    return res.render("overlay", {
      character: payload,
      characterJson: jsonForHtml(payload),
      overlayToken: hasObsToken ? req.query.token : "",
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).render("forbidden", {
    title: "Falha no servidor",
    message: "O grimorio rangeu por dentro. Verifique MongoDB, sessoes e logs do Node.",
  });
});

function rememberOnlineCharacter(characterId, socketId) {
  const key = characterId.toString();
  const sockets = onlineCharacters.get(key) || new Set();
  sockets.add(socketId);
  onlineCharacters.set(key, sockets);
}

function forgetOnlineCharacter(characterId, socketId) {
  const key = characterId.toString();
  const sockets = onlineCharacters.get(key);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (!sockets.size) {
    onlineCharacters.delete(key);
  }
}

async function canEditCharacter(socket, character) {
  const sessionData = socket.request.session || {};

  if (!sessionData.userId) {
    return false;
  }

  if (sessionData.role === "master") {
    return true;
  }

  return (
    sessionData.role === "player" &&
    character.user &&
    character.user.toString() === sessionData.userId.toString()
  );
}

async function updateResource(socket, payload) {
  if (!isDatabaseReady()) {
    return;
  }

  const allowedFields = {
    pv_atual: "pv_max",
    ps_atual: "ps_max",
    fome: 100,
    sede: 100,
    municao_atual: "municao_max",
    vida_atual: "vida_max",
    sanidade_atual: "sanidade_max",
  };

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const maxRule = allowedFields[payload.field];

  if (!maxRule) {
    return;
  }

  const value = Number(payload.value);

  if (!Number.isFinite(value)) {
    return;
  }

  const maxValue = typeof maxRule === "number" ? maxRule : numberValue(character[maxRule], 1);
  character[payload.field] = clamp(Math.round(value), 0, maxValue);

  if (payload.field === "pv_atual") character.vida_atual = character[payload.field];
  if (payload.field === "ps_atual") character.sanidade_atual = character[payload.field];
  if (payload.field === "vida_atual") character.pv_atual = character[payload.field];
  if (payload.field === "sanidade_atual") character.ps_atual = character[payload.field];

  await character.save();
  await emitCharacterUpdate(character._id.toString());
}

async function equipWeaponForCharacter(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const itemId = String(payload.itemId || "").trim();

  if (itemId && !mongoose.Types.ObjectId.isValid(itemId)) {
    return;
  }

  const selectedWeapon = itemId ? character.inventario.id(itemId) : null;

  if (itemId && (!selectedWeapon || !selectedWeapon.ehArma)) {
    return;
  }

  if (selectedWeapon && character.escudo_equipado && isTwoHandedWeapon(selectedWeapon)) {
    socket.emit("inventory:error", {
      message: "Escudo equipado impede armas de duas maos.",
    });
    return;
  }

  await Character.updateOne(
    { _id: character._id },
    {
      $set: {
        "inventario.$[weapon].equipado": false,
        arma_equipada: "",
      },
    },
    {
      arrayFilters: [{ "weapon.ehArma": true }],
    },
  );

  if (selectedWeapon) {
    await Character.updateOne(
      { _id: character._id, "inventario._id": selectedWeapon._id },
      {
        $set: {
          "inventario.$.equipado": true,
          arma_equipada: selectedWeapon.nome,
        },
      },
    );
  }

  await emitCharacterUpdate(character._id.toString());
}

async function updateDefenseEquipment(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const armor = getArmorByName(payload.armadura_equipada || "Nenhuma");
  character.armadura_equipada = armor.nome;
  character.armadura_condicao = normalizeEquipmentCondition(payload.armadura_condicao);
  character.escudo_equipado = Boolean(payload.escudo_equipado);
  character.escudo_condicao = character.escudo_equipado
    ? normalizeEquipmentCondition(payload.escudo_condicao)
    : "Boa";

  if (character.escudo_equipado) {
    let removedTwoHandedWeapon = false;

    character.inventario.forEach((item) => {
      if (item.equipado && isTwoHandedWeapon(item)) {
        item.equipado = false;
        removedTwoHandedWeapon = true;
      }
    });

    if (removedTwoHandedWeapon) {
      character.arma_equipada = "";
    }
  }

  character.defesa = calculateDefense(character);
  await character.save();
  await emitCharacterUpdate(character._id.toString());
}

async function buyShopItem(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const shopKey = String(payload.loja || "");
  const shopItem = getShopItem(shopKey, Number(payload.itemIndex));

  if (!shopItem || !activeShops[shopKey]) {
    socket.emit("shop:error", { message: "Esta loja nao esta disponivel para compra agora." });
    return;
  }

  const cost = getPriceValue(shopItem.preco);

  if (cost === null) {
    socket.emit("shop:error", {
      message: "Este item nao possui preco em moedas cadastrado.",
    });
    return;
  }

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const currentMoney = numberValue(character.dinheiro, 0);

  if (currentMoney < cost) {
    socket.emit("shop:error", {
      message: "Voce nao possui recursos de escambo suficientes para esta troca.",
    });
    return;
  }

  const inventoryItem = buildPurchasedInventoryItem(shopKey, shopItem);
  const proposedTotal = itemSlotsTotal(getInventory(character)) + inventoryItem.peso * inventoryItem.quantidade;

  if (proposedTotal > character.limite_inventario) {
    socket.emit("shop:error", {
      message: "Seu inventario nao suporta o peso desta compra.",
    });
    return;
  }

  character.dinheiro = currentMoney - cost;
  character.inventario.push(inventoryItem);
  await character.save();
  await emitCharacterUpdate(character._id.toString());

  socket.emit("shop:success", {
    message: `${shopItem.nome} adquirido por ${cost} moeda(s).`,
    item: shopItem.nome,
    custo: cost,
  });
}

function consumeOneInventoryUnit(character, item) {
  if (Number(item.quantidade || 1) > 1) {
    item.quantidade = Number(item.quantidade || 1) - 1;
    return;
  }

  character.inventario = character.inventario.filter(
    (entry) => entry._id.toString() !== item._id.toString(),
  );
}

function spendItemUse(character, item, config = {}) {
  const fallbackUses = config.uses || parseUses(item.usos) || 1;
  const currentUses = Number.isFinite(Number(item.usos)) ? Number(item.usos) : fallbackUses;
  const nextUses = Math.max(0, currentUses - 1);

  item.usos = nextUses;

  if (nextUses > 0) {
    return;
  }

  if (config.emptyName) {
    item.nome = config.emptyName;
    item.propriedades = "Vazio. Reabastecimento necessario.";
    item.consumivel = false;
    return;
  }

  if (config.removeAtZero !== false) {
    character.inventario = character.inventario.filter(
      (entry) => entry._id.toString() !== item._id.toString(),
    );
  }
}

function removeCondition(character, conditionName) {
  const conditionKey = normalizeKey(conditionName);
  const before = character.condicoes || [];
  character.condicoes = before.filter((condition) => normalizeKey(condition) !== conditionKey);
  return before.length - character.condicoes.length;
}

function applyConsumableEffect(character, item) {
  const config = getConsumableConfig(item) || {};
  const itemName = item.nome;
  const pvMax = numberValue(character.pv_max, character.vida_max, 10);
  const psMax = numberValue(character.ps_max, character.sanidade_max, 10);
  const pvBefore = clamp(numberValue(character.pv_atual, character.vida_atual, pvMax), 0, pvMax);
  const psBefore = clamp(numberValue(character.ps_atual, character.sanidade_atual, psMax), 0, psMax);
  const result = {
    item: itemName,
    tipo: config.type || "uso",
    mensagem: `${itemName} usado.`,
  };

  if (config.type === "heal-pv") {
    const rolled = rollDie(config.die);
    character.pv_atual = clamp(pvBefore + rolled, 0, pvMax);
    setLegacyVitals(character);
    result.rolagem = `1d${config.die} = ${rolled}`;
    result.pvDelta = character.pv_atual - pvBefore;
    result.mensagem = `${itemName}: ${result.pvDelta} PV recuperado(s).`;
  } else if (config.type === "heal-ps") {
    const rolled = rollDie(config.die);
    character.ps_atual = clamp(psBefore + rolled, 0, psMax);
    setLegacyVitals(character);
    result.rolagem = `1d${config.die} = ${rolled}`;
    result.psDelta = character.ps_atual - psBefore;
    result.mensagem = `${itemName}: ${result.psDelta} PS recuperado(s).`;
  } else if (config.type === "remove-condition") {
    const removed = removeCondition(character, config.condition);
    result.condicaoRemovida = removed > 0 ? config.condition : "";
    result.mensagem = removed
      ? `${itemName}: condicao ${config.condition} removida.`
      : `${itemName}: nenhuma condicao ${config.condition} ativa.`;
  } else if (config.type === "narrative-consume") {
    result.mensagem = `${itemName} consumido para controle de sobrevivencia.`;
  }

  if (config.consumeUnit) {
    consumeOneInventoryUnit(character, item);
  } else {
    spendItemUse(character, item, config);
  }

  return result;
}

async function useInventoryItem(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const itemId = String(payload.itemId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return;
  }

  const item = character.inventario.id(itemId);

  if (!item || !isUsableInventoryItem(item)) {
    socket.emit("item:error", { message: "Este item nao possui uso mecanico cadastrado." });
    return;
  }

  const effect = applyConsumableEffect(character, item);

  await character.save();
  await emitCharacterUpdate(character._id.toString());

  socket.emit("item:used", effect);
  io.to("masters").emit("item:used", {
    ...effect,
    characterId: character._id.toString(),
    characterName: getCharacterName(character),
  });
}

async function useRitual(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId).populate("user", "username role");

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const ritualName = String(payload.ritualNome || "").trim();
  const ritual = getRituals(character).find((entry) => entry.nome === ritualName);

  if (!ritual) {
    socket.emit("ritual:error", { message: "Ritual nao encontrado na ficha." });
    return;
  }

  const effect = applyRitualEffect(character, ritual);
  character.defesa = calculateDefense(character);
  await character.save();

  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    characterId: character._id.toString(),
    characterName: getCharacterName(character),
    username: character.user?.username || "jogador",
    ritual,
    efeito: effect,
  };

  ritualLog.unshift(event);
  ritualLog = ritualLog.slice(0, 30);

  await emitCharacterUpdate(character._id.toString());
  io.to("masters").emit("ritual:used", event);
  socket.emit("ritual:confirmed", event);
}

function humanizeKey(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function requestCharacterRoll(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId).populate("user", "username role");

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const kind = payload.kind === "pericia" ? "pericia" : "atributo";
  const key = String(payload.key || "").trim();
  const group = String(payload.group || "").trim();
  const attributes = getAttributes(character);
  const skills = getSkills(character);
  let bonus = 0;
  let label = String(payload.label || "").trim();

  if (kind === "atributo") {
    if (!Object.prototype.hasOwnProperty.call(attributes, key)) {
      return;
    }

    bonus = numberValue(attributes[key], 0);
    label = label || humanizeKey(key);
  } else {
    if (!skills[group] || !Object.prototype.hasOwnProperty.call(skills[group], key)) {
      return;
    }

    bonus = numberValue(skills[group][key], 0);
    label = label || humanizeKey(key);
  }

  const d20 = rollDie(20);
  const total = d20 + bonus;
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    tipo: "rolagem",
    characterId: character._id.toString(),
    characterName: getCharacterName(character),
    username: character.user?.username || "jogador",
    kind,
    label,
    die: d20,
    bonus,
    total,
    formula: `1d20 (${d20}) + ${bonus} = ${total}`,
  };

  rollLog.unshift(event);
  rollLog = rollLog.slice(0, 30);

  io.to("players").to("masters").emit("roll:result", event);
}

async function restCharacter(socket, payload = {}) {
  if (!isDatabaseReady()) {
    return;
  }

  const character = await Character.findById(payload.characterId);

  if (!character || !(await canEditCharacter(socket, character))) {
    return;
  }

  const type = payload.type === "long" ? "long" : "short";
  let message = "Descanso Curto registrado: o turno bloqueado foi limpo.";
  character.bloqueado = false;

  if (type === "long") {
    const pvMax = numberValue(character.pv_max, character.vida_max, 10);
    const psMax = numberValue(character.ps_max, character.sanidade_max, 10);
    const jejumBloqueouCura = Boolean(character.em_jejum);

    if (!jejumBloqueouCura) {
      character.pv_atual = pvMax;
      character.ps_atual = psMax;
      setLegacyVitals(character);
      message = "Descanso Longo registrado: PV e PS restaurados.";
    } else {
      character.em_jejum = false;
      message = "Descanso Longo registrado: O Jejum bloqueou a recuperacao desta noite.";
    }

    character.em_vigilia = false;
    character.desvantagens_ativas = (character.desvantagens_ativas || []).filter(
      (disadvantage) => !PHYSICAL_DISADVANTAGES.includes(disadvantage),
    );
  }

  character.defesa = calculateDefense(character);
  await character.save();
  await emitCharacterUpdate(character._id.toString());
  socket.emit("rest:done", { type, message });
  io.to("masters").emit("rest:done", {
    type,
    message,
    characterId: character._id.toString(),
    characterName: getCharacterName(character),
  });
}

io.on("connection", (socket) => {
  const sessionData = socket.request.session || {};

  socket.on("master:join", async () => {
    if (sessionData.role !== "master") {
      return;
    }

    socket.join("masters");
    socket.emit("master:characters", await getMasterTable());
    socket.emit("shops:status", { lojas: { ...activeShops } });
    socket.emit("loja:status", { aberta: getShopsOpen(), lojas: { ...activeShops } });
    socket.emit("sessao:status", { ativa: isSessionActive });
    socket.emit("ritual:log", ritualLog);
    socket.emit("roll:log", rollLog);
  });

  socket.on("master:request-table", async () => {
    if (sessionData.role !== "master") {
      return;
    }

    socket.emit("master:characters", await getMasterTable());
  });

  socket.on("player:join", async ({ characterId }) => {
    if (!isDatabaseReady()) {
      return;
    }

    const character = await Character.findById(characterId);

    if (!character || !(await canEditCharacter(socket, character))) {
      return;
    }

    socket.data.characterId = character._id.toString();
    socket.join(`character:${character._id}`);
    socket.join("players");
    rememberOnlineCharacter(character._id, socket.id);
    socket.emit("shops:status", { lojas: { ...activeShops } });
    socket.emit("loja:status", { aberta: getShopsOpen(), lojas: { ...activeShops } });
    socket.emit("sessao:status", { ativa: isSessionActive });
    socket.emit("roll:log", rollLog.slice(0, 5));
    await emitCharacterUpdate(character._id.toString());
  });

  socket.on("overlay:join", async ({ characterId, token }) => {
    if (!isDatabaseReady()) {
      return;
    }

    const isMaster = sessionData.role === "master";
    const hasToken = token && token === OBS_TOKEN;

    if (!isMaster && !hasToken) {
      return;
    }

    const character = await Character.findById(characterId);

    if (!character) {
      return;
    }

    socket.join(`character:${character._id}`);
    socket.emit("character:updated", serializeCharacter(character));
  });

  socket.on("toggle-shop", (payload) => {
    if (sessionData.role !== "master") {
      return;
    }

    const shopKey = String(payload?.loja || "");

    if (!Object.prototype.hasOwnProperty.call(activeShops, shopKey)) {
      return;
    }

    activeShops[shopKey] = Boolean(payload.status);
    io.emit("shops:status", { lojas: { ...activeShops } });
    io.emit("loja:status", { aberta: getShopsOpen(), lojas: { ...activeShops } });
  });

  socket.on("mestre-liberou-loja", (payload) => {
    if (sessionData.role !== "master") {
      return;
    }

    activeShops = normalizeActiveShopsPayload(
      Object.fromEntries(Object.keys(activeShops).map((shopKey) => [shopKey, Boolean(payload?.aberta)])),
    );
    io.emit("shops:status", { lojas: { ...activeShops } });
    io.emit("loja:status", { aberta: getShopsOpen(), lojas: { ...activeShops } });
  });

  socket.on("mestre:iniciar-sessao", () => {
    if (sessionData.role !== "master") {
      return;
    }

    isSessionActive = true;
    emitSessionStatus();
  });

  socket.on("mestre:finalizar-sessao", () => {
    if (sessionData.role !== "master") {
      return;
    }

    isSessionActive = false;
    emitSessionStatus();
  });

  socket.on("character:update-resource", (payload) => {
    updateResource(socket, payload).catch(console.error);
  });

  socket.on("roll:request", (payload) => {
    requestCharacterRoll(socket, payload).catch(console.error);
  });

  socket.on("character:rest", (payload) => {
    restCharacter(socket, payload).catch(console.error);
  });

  socket.on("character:update-weapon", async (payload) => {
    try {
      if (!isDatabaseReady()) {
        return;
      }

      const character = await Character.findById(payload.characterId);

      if (!character || !(await canEditCharacter(socket, character))) {
        return;
      }

      character.arma_equipada = String(payload.value || "").trim().slice(0, 80);
      await character.save();
      await emitCharacterUpdate(character._id.toString());
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("character:add-item", async (payload) => {
    try {
      if (!isDatabaseReady()) {
        return;
      }

      const character = await Character.findById(payload.characterId);

      if (!character || !(await canEditCharacter(socket, character))) {
        return;
      }

      const nome = String(payload.nome || "").trim().slice(0, 80);
      const peso = Number(payload.peso ?? payload.slots ?? 1);
      const quantidade = Math.max(1, Math.round(Number(payload.quantidade || 1)));
      const ehArma = Boolean(payload.ehArma);
      const categoria = String(payload.categoria || "").trim().slice(0, 60);
      const dano = ehArma ? String(payload.dano || "").trim().slice(0, 40) : "";
      const propriedades = String(payload.propriedades || "").trim().slice(0, 240);
      const requerMunicao = ehArma && Boolean(payload.requerMunicao);
      const tipoMunicao = requerMunicao ? String(payload.tipoMunicao || "").trim().slice(0, 40) : "";
      const equipado = ehArma && Boolean(payload.equipado);
      const usos = parseUses(payload.usos);
      const consumivel = Boolean(payload.consumivel || usos || getConsumableConfig(nome));

      if (!nome || !Number.isFinite(peso)) {
        return;
      }

      const currentInventory = getInventory(character);
      const proposedTotal = itemSlotsTotal(currentInventory) + peso * quantidade;

      if (proposedTotal > character.limite_inventario) {
        socket.emit("inventory:error", {
          message: "Limite do inventario excedido.",
          used: itemSlotsTotal(currentInventory),
          limit: character.limite_inventario,
        });
        return;
      }

      if (equipado) {
        character.inventario.forEach((item) => {
          item.equipado = false;
        });
        character.arma_equipada = nome;
      }

      character.inventario.push({
        nome,
        quantidade,
        peso,
        ehArma,
        categoria,
        dano,
        propriedades,
        requerMunicao,
        tipoMunicao,
        equipado,
        usos,
        consumivel,
      });
      await character.save();
      await emitCharacterUpdate(character._id.toString());
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("character:remove-item", async (payload) => {
    try {
      if (!isDatabaseReady()) {
        return;
      }

      const character = await Character.findById(payload.characterId);

      if (!character || !(await canEditCharacter(socket, character))) {
        return;
      }

      const removedItem = character.inventario.id(payload.itemId);

      if (removedItem?.equipado) {
        character.arma_equipada = "";
      }

      character.inventario = character.inventario.filter(
        (item) => item._id.toString() !== payload.itemId,
      );
      if (character.itens) {
        character.itens = character.itens.filter((item) => item._id.toString() !== payload.itemId);
      }
      await character.save();
      await emitCharacterUpdate(character._id.toString());
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("equipar-arma", (payload) => {
    equipWeaponForCharacter(socket, payload).catch(console.error);
  });

  socket.on("character:equip-item", (payload) => {
    equipWeaponForCharacter(socket, payload).catch(console.error);
  });

  socket.on("character:update-defense-equipment", (payload) => {
    updateDefenseEquipment(socket, payload).catch(console.error);
  });

  socket.on("shop:buy-item", (payload) => {
    buyShopItem(socket, payload).catch(console.error);
  });

  socket.on("character:use-item", (payload) => {
    useInventoryItem(socket, payload).catch(console.error);
  });

  socket.on("ritual:use", (payload) => {
    useRitual(socket, payload).catch(console.error);
  });

  socket.on("master:adjust-resource", async (payload) => {
    try {
      if (!isDatabaseReady()) {
        return;
      }

      if (sessionData.role !== "master") {
        return;
      }

      const character = await Character.findById(payload.characterId);

      if (!character) {
        return;
      }

      const allowedFields = {
        pv_atual: "pv_max",
        ps_atual: "ps_max",
        fome: 100,
        sede: 100,
        municao_atual: "municao_max",
        vida_atual: "vida_max",
        sanidade_atual: "sanidade_max",
      };
      const maxRule = allowedFields[payload.field];

      if (!maxRule) {
        return;
      }

      const delta = Number(payload.delta || 0);

      if (!Number.isFinite(delta)) {
        return;
      }

      const currentValue = numberValue(character[payload.field], 0);
      const maxValue = typeof maxRule === "number" ? maxRule : numberValue(character[maxRule], 1);
      character[payload.field] = clamp(currentValue + delta, 0, maxValue);
      if (payload.field === "pv_atual") character.vida_atual = character[payload.field];
      if (payload.field === "ps_atual") character.sanidade_atual = character[payload.field];
      if (payload.field === "vida_atual") character.pv_atual = character[payload.field];
      if (payload.field === "sanidade_atual") character.ps_atual = character[payload.field];
      await character.save();
      await emitCharacterUpdate(character._id.toString());
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("master:delete-character", async (payload) => {
    try {
      if (!isDatabaseReady() || sessionData.role !== "master") {
        return;
      }

      const character = await Character.findById(payload.characterId);

      if (!character) {
        socket.emit("master:delete-error", { message: "Personagem nao encontrado." });
        return;
      }

      const expectedConfirmation = getCharacterName(character).toUpperCase();
      const receivedConfirmation = String(payload.confirmation || "").trim();

      if (receivedConfirmation !== expectedConfirmation) {
        socket.emit("master:delete-error", {
          message: "Confirmacao incorreta. Digite o nome do personagem em letras maiusculas.",
        });
        return;
      }

      const characterId = character._id.toString();
      await Character.deleteOne({ _id: character._id });

      io.to(`character:${characterId}`).emit("character:deleted", { characterId });
      io.to("masters").emit("character:deleted", { characterId });
      await emitMasterTable();
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("disconnect", async () => {
    if (socket.data.characterId) {
      forgetOnlineCharacter(socket.data.characterId, socket.id);
      await emitMasterTable().catch(console.error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor integrado em http://localhost:${PORT}`);
  console.log(`Token OBS local: ${OBS_TOKEN}`);
});
