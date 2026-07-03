const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    quantidade: {
      type: Number,
      min: 1,
      default: 1,
    },
    peso: {
      type: Number,
      min: 0,
      default: 1,
    },
    ehArma: {
      type: Boolean,
      default: false,
    },
    categoria: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    dano: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    propriedades: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    requerMunicao: {
      type: Boolean,
      default: false,
    },
    tipoMunicao: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    equipado: {
      type: Boolean,
      default: false,
    },
    usos: {
      type: Number,
      min: 0,
      default: undefined,
    },
    consumivel: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  },
);

const legacyItemSchema = new mongoose.Schema(
  {
    nome: String,
    slots: Number,
    quantidade: Number,
  },
  {
    _id: true,
  },
);

const attributesSchema = new mongoose.Schema(
  {
    vigor: { type: Number, min: 1, max: 5, default: 1 },
    agilidade: { type: Number, min: 1, max: 5, default: 1 },
    forca: { type: Number, min: 1, max: 5, default: 1 },
    intelecto: { type: Number, min: 1, max: 5, default: 1 },
    presenca: { type: Number, min: 1, max: 5, default: 1 },
    instinto: { type: Number, min: 1, max: 5, default: 1 },
  },
  { _id: false },
);

const skillsSchema = new mongoose.Schema(
  {
    vigor: {
      resistencia: { type: Number, min: 0, max: 5, default: 0 },
      constituicao: { type: Number, min: 0, max: 5, default: 0 },
    },
    agilidade: {
      furtividade: { type: Number, min: 0, max: 5, default: 0 },
      acrobacia: { type: Number, min: 0, max: 5, default: 0 },
      fuga: { type: Number, min: 0, max: 5, default: 0 },
      reflexos: { type: Number, min: 0, max: 5, default: 0 },
      pontaria: { type: Number, min: 0, max: 5, default: 0 },
    },
    forca: {
      luta: { type: Number, min: 0, max: 5, default: 0 },
      atletismo: { type: Number, min: 0, max: 5, default: 0 },
      intimidacao_fisica: { type: Number, min: 0, max: 5, default: 0 },
    },
    intelecto: {
      medicina: { type: Number, min: 0, max: 5, default: 0 },
      historia: { type: Number, min: 0, max: 5, default: 0 },
      investigacao: { type: Number, min: 0, max: 5, default: 0 },
      oficios: { type: Number, min: 0, max: 5, default: 0 },
    },
    presenca: {
      labia: { type: Number, min: 0, max: 5, default: 0 },
      lideranca: { type: Number, min: 0, max: 5, default: 0 },
      negociacao: { type: Number, min: 0, max: 5, default: 0 },
      intimidacao_psicologica: { type: Number, min: 0, max: 5, default: 0 },
    },
    instinto: {
      percepcao: { type: Number, min: 0, max: 5, default: 0 },
      rastreamento: { type: Number, min: 0, max: 5, default: 0 },
      sobrevivencia: { type: Number, min: 0, max: 5, default: 0 },
      pressentimento: { type: Number, min: 0, max: 5, default: 0 },
    },
  },
  { _id: false },
);

const stigmaSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ["Fome", "Guerra", "Peste", "Morte"],
      default: "Fome",
    },
    marca: {
      type: String,
      trim: true,
      default: "",
    },
    fardo: {
      type: String,
      trim: true,
      default: "",
    },
    sinal: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const ritualSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
    },
    ato: {
      type: String,
      trim: true,
      default: "",
    },
    preco: {
      type: String,
      trim: true,
      default: "",
    },
    ancora: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const characterSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    dinheiro: {
      type: Number,
      min: 0,
      set: (value) => Math.max(0, Math.trunc(Number(value) || 0)),
      validate: {
        validator: Number.isInteger,
        message: "Dinheiro deve ser um numero inteiro de moedas.",
      },
      default: 0,
    },
    rituais: {
      type: [ritualSchema],
      default: [],
    },
    fone_sede_ativo: {
      type: Boolean,
      default: true,
    },
    bloqueado: {
      type: Boolean,
      default: false,
    },
    em_jejum: {
      type: Boolean,
      default: false,
    },
    em_vigilia: {
      type: Boolean,
      default: false,
    },
    peso_ativo: {
      type: Boolean,
      default: false,
    },
    desvantagens_ativas: {
      type: [String],
      default: [],
    },
    condicoes: {
      type: [String],
      default: [],
    },
    fome: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    sede: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    pv_max: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    pv_atual: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    ps_max: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    ps_atual: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    municao_max: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    municao_atual: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    armadura_equipada: {
      type: String,
      trim: true,
      default: "Nenhuma",
    },
    armadura_condicao: {
      type: String,
      enum: ["Boa", "Desgastada", "Quebrada"],
      default: "Boa",
    },
    escudo_equipado: {
      type: Boolean,
      default: false,
    },
    escudo_condicao: {
      type: String,
      enum: ["Boa", "Desgastada", "Quebrada"],
      default: "Boa",
    },
    defesa: {
      type: Number,
      min: 0,
      default: 0,
    },
    atributos: {
      type: attributesSchema,
      default: () => ({}),
    },
    pericias: {
      type: skillsSchema,
      default: () => ({}),
    },
    estigma: {
      type: stigmaSchema,
      default: () => ({}),
    },
    limite_inventario: {
      type: Number,
      required: true,
      min: 1,
      default: 6,
    },
    inventario: {
      type: [itemSchema],
      default: [],
    },

    // Campos legados mantidos para abrir fichas criadas nas etapas anteriores.
    nome: { type: String, trim: true, maxlength: 80 },
    vida_max: { type: Number, min: 1 },
    vida_atual: { type: Number, min: 0 },
    sanidade_max: { type: Number, min: 1 },
    sanidade_atual: { type: Number, min: 0 },
    arma_equipada: { type: String, trim: true, maxlength: 80 },
    itens: {
      type: [legacyItemSchema],
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

characterSchema.pre("validate", function ensureSingleEquippedWeapon(next) {
  let equippedWeaponAlreadyFound = false;

  this.inventario.forEach((item) => {
    if (!item.ehArma) {
      item.equipado = false;
      return;
    }

    if (item.equipado && !equippedWeaponAlreadyFound) {
      equippedWeaponAlreadyFound = true;
      return;
    }

    if (item.equipado) {
      item.equipado = false;
    }
  });

  next();
});

module.exports = mongoose.model("Character", characterSchema);
