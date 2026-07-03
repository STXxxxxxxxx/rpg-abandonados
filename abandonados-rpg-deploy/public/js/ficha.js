const socket = window.io ? window.io() : null;
let character = window.__CHARACTER__;

const socketStatus = document.querySelector("#socketStatus");
const playerPage = document.querySelector(".page");
const characterName = document.querySelector("#characterName");
const shortRestButton = document.querySelector("#shortRestButton");
const longRestButton = document.querySelector("#longRestButton");
const resourcesPanel = document.querySelector("#resourcesPanel");
const inventoryForm = document.querySelector("#inventoryForm");
const itemName = document.querySelector("#itemName");
const itemPeso = document.querySelector("#itemPeso");
const itemQuantity = document.querySelector("#itemQuantity");
const itemDamage = document.querySelector("#itemDamage");
const itemIsWeapon = document.querySelector("#itemIsWeapon");
const itemEquipped = document.querySelector("#itemEquipped");
const inventoryList = document.querySelector("#inventoryList");
const inventoryUsed = document.querySelector("#inventoryUsed");
const inventoryWarning = document.querySelector("#inventoryWarning");
const inventoryFilters = document.querySelector("#inventoryFilters");
const moneyValue = document.querySelector("#moneyValue");
const defenseValue = document.querySelector("#defenseValue");
const equippedWeaponName = document.querySelector("#equippedWeaponName");
const equippedWeaponDamage = document.querySelector("#equippedWeaponDamage");
const armorSelect = document.querySelector("#armorSelect");
const armorConditionSelect = document.querySelector("#armorConditionSelect");
const shieldToggle = document.querySelector("#shieldToggle");
const shieldConditionSelect = document.querySelector("#shieldConditionSelect");
const armorPenaltyNote = document.querySelector("#armorPenaltyNote");
const ritualList = document.querySelector("#ritualList");
const ritualCards = document.querySelector("#ritualCards");
const ritualFlash = document.querySelector("#ritualFlash");
const ritualCastText = document.querySelector("#ritualCastText");
const ritualConfirmModal = document.querySelector("#ritualConfirmModal");
const ritualConfirmName = document.querySelector("#ritualConfirmName");
const ritualCancelButton = document.querySelector("#ritualCancelButton");
const ritualConfirmButton = document.querySelector("#ritualConfirmButton");
const attributesGrid = document.querySelector("#attributesGrid");
const skillsGrid = document.querySelector("#skillsGrid");
const stigmaTitle = document.querySelector("#stigmaTitle");
const stigmaBox = document.querySelector("#stigmaBox");
const shopsHubTab = document.querySelector("#shopsHubTab");
const shopPanels = document.querySelectorAll("[data-shop-panel]");
const tabButtons = document.querySelectorAll("[data-player-tab]");
const rollLogToggle = document.querySelector("#rollLogToggle");
const rollLogDrawer = document.querySelector("#rollLogDrawer");
const rollLogList = document.querySelector("#rollLogList");
const tabPanels = {
  ficha: document.querySelector("#fichaPanel"),
  inventario: document.querySelector("#inventarioPanel"),
  lojas: document.querySelector("#lojasPanel"),
};

let currentTab = "ficha";
let pendingRitual = null;
let inventoryFilter = "tudo";
let rollLogEntries = [];
let audioContext = null;

const resourceMeta = {
  pv_atual: { label: "PV", short: "PV", maxField: "pv_max", fillClass: "" },
  ps_atual: { label: "PS", short: "PS", maxField: "ps_max", fillClass: "sanity" },
  fome: { label: "Fome", short: "%", maxField: null, fillClass: "hunger" },
  sede: { label: "Sede", short: "%", maxField: null, fillClass: "thirst" },
  municao_atual: { label: "Municao", short: "MUN", maxField: "municao_max", fillClass: "ammo" },
};

function emit(eventName, payload) {
  if (socket && socket.connected) {
    socket.emit(eventName, payload);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (characterToEscape) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[characterToEscape];
  });
}

function normalizeKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tooltipAttr(value = "") {
  const clean = String(value || "").trim();
  return clean ? ` data-tooltip="${escapeHtml(clean)}" tabindex="0"` : "";
}

function inventoryTotal(items = character.inventario || []) {
  return items.reduce((sum, item) => sum + Number(item.peso || 0) * Number(item.quantidade || 1), 0);
}

function percent(value, max) {
  return max ? clamp((value / max) * 100, 0, 100) : 0;
}

function isCriticalResource(current, max, threshold) {
  const safeMax = Number(max || 0);

  if (safeMax <= 0) {
    return false;
  }

  return Number(current || 0) / safeMax <= threshold;
}

function updateCorruptionState() {
  if (!playerPage) {
    return;
  }

  playerPage.classList.toggle(
    "estado-agonia",
    isCriticalResource(character.pv_atual, character.pv_max, 0.25),
  );
  playerPage.classList.toggle(
    "estado-loucura",
    isCriticalResource(character.ps_atual, character.ps_max, 0.3),
  );
}

function updateConditionState() {
  const conditions = (character.condicoes || []).map(normalizeKey);
  const isBleeding = conditions.includes("sangrando");
  const isPoisoned = conditions.includes("envenenado");

  characterName.classList.toggle("condition-sangrando", isBleeding);
  playerPage.classList.toggle("condition-envenenado", isPoisoned);
}

function isTwoHandedWeapon(item) {
  return Boolean(item.duasMaos) || ["Espada longa", "Arco longo", "Besta"].includes(item.nome);
}

function canUseItem(item) {
  return Boolean(item.utilizavel || item.consumivel || Number(item.usos || 0) > 0);
}

function classifyInventoryItem(item = {}) {
  const searchable = normalizeKey(
    `${item.nome || ""} ${item.categoria || ""} ${item.propriedades || ""}`,
  );

  if (item.ehArma) return "armas";
  if (canUseItem(item)) return "consumiveis";
  if (
    searchable.includes("armadura") ||
    searchable.includes("escudo") ||
    searchable.includes("couro") ||
    searchable.includes("cota") ||
    searchable.includes("placas") ||
    searchable.includes("robe") ||
    searchable.includes("roupas reforcadas")
  ) {
    return "protecoes";
  }

  return "outros";
}

function getRitualSacrificeTarget(ritual = {}) {
  const haystack = normalizeKey(`${ritual.nome || ""} ${ritual.preco || ""} ${ritual.ato || ""}`);

  if (haystack.includes("pv") || haystack.includes("vida") || haystack.includes("carne")) {
    return "pv_atual";
  }

  if (haystack.includes("ps") || haystack.includes("sanidade") || haystack.includes("mente")) {
    return "ps_atual";
  }

  return "";
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioContext = AudioCtor ? new AudioCtor() : null;
  }

  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone({ frequency = 220, duration = 0.12, type = "sine", gain = 0.06, delay = 0 }) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.018);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playGothicSound(type) {
  if (type === "coins") {
    playTone({ frequency: 720, duration: 0.09, type: "triangle", gain: 0.05 });
    playTone({ frequency: 510, duration: 0.11, type: "triangle", gain: 0.04, delay: 0.06 });
    playTone({ frequency: 940, duration: 0.07, type: "triangle", gain: 0.03, delay: 0.12 });
    return;
  }

  if (type === "potion") {
    playTone({ frequency: 330, duration: 0.15, type: "sine", gain: 0.045 });
    playTone({ frequency: 190, duration: 0.22, type: "sine", gain: 0.035, delay: 0.1 });
    return;
  }

  if (type === "armor") {
    playTone({ frequency: 120, duration: 0.16, type: "sawtooth", gain: 0.045 });
    playTone({ frequency: 86, duration: 0.2, type: "square", gain: 0.025, delay: 0.08 });
  }
}

function getArmorData(armorName) {
  return (window.__ARMOR_CATALOG__ || []).find((armor) => armor.nome === armorName) || {
    nome: "Nenhuma",
    bonus: 0,
    penalidades: [],
  };
}

function setWarning(message = "") {
  inventoryWarning.textContent = message;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRitualName(ritual) {
  return typeof ritual === "string" ? ritual : ritual?.nome || "Ritual sem nome";
}

function getRitualDetail(ritual, field, fallback = "-") {
  if (typeof ritual === "string") {
    return fallback;
  }

  return ritual?.[field] || fallback;
}

function setTab(tabName) {
  currentTab = tabName;

  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.playerTab === tabName);
  });

  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle("hidden", name !== tabName);
  });
}

function setActiveShops(shops = {}) {
  const hasOpenShop = Object.values(shops).some(Boolean);

  shopsHubTab.classList.toggle("hidden", !hasOpenShop);

  shopPanels.forEach((panel) => {
    const isOpen = Boolean(shops[panel.dataset.shopPanel]);
    panel.classList.toggle("hidden", !isOpen);
    panel.classList.toggle("shop-open", isOpen);
  });

  if (!hasOpenShop && currentTab === "lojas") {
    setTab("ficha");
  }
}

function renderResources() {
  resourcesPanel.innerHTML = Object.entries(resourceMeta)
    .map(([field, meta]) => {
      const max = meta.maxField ? character[meta.maxField] : 100;
      const current = character[field];

      return `
        <article class="resource" data-resource="${field}">
          <div class="resource-top">
            <span class="resource-name">${meta.label}</span>
            <span class="counter">${current}/${max} ${meta.short}</span>
          </div>
          <div class="bar" aria-hidden="true">
            <div class="fill ${meta.fillClass}" style="width: ${percent(current, max)}%"></div>
          </div>
          <div class="resource-actions">
            <button class="btn danger" id="${field}-minus" type="button" data-field="${field}" data-delta="-1">-</button>
            <input class="resource-input" id="${field}-input" type="number" min="0" max="${max}" value="${current}" data-field="${field}" />
            <button class="btn" id="${field}-plus" type="button" data-field="${field}" data-delta="1">+</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderInventory() {
  const inventory = character.inventario || character.itens || [];
  const used = inventoryTotal(inventory);
  const limit = Number(character.limite_inventario || 1);
  const loadRatio = limit ? used / limit : 0;
  inventoryUsed.textContent = `${used}/${limit} slots usados`;
  inventoryUsed.classList.remove("load-light", "load-medium", "load-heavy", "load-over");
  inventoryUsed.classList.add(
    used > limit ? "load-over" : loadRatio >= 0.8 ? "load-heavy" : loadRatio >= 0.5 ? "load-medium" : "load-light",
  );
  inventoryUsed.classList.toggle("warning", used > limit);

  inventoryList.innerHTML = inventory
    .map(
      (item) => {
        const blockedByShield = Boolean(character.escudo_equipado && isTwoHandedWeapon(item));
        const category = classifyInventoryItem(item);
        const isFiltered = inventoryFilter !== "tudo" && inventoryFilter !== category;
        const tooltip = [
          item.propriedades,
          item.categoria ? `Categoria: ${item.categoria}` : "",
          item.dano ? `Dano: ${item.dano}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        return `
        <li
          class="${blockedByShield ? "weapon-blocked" : ""} ${isFiltered ? "hidden" : ""}"
          data-inventory-category="${category}"
        >
          <div>
            <strong class="tooltip-anchor"${tooltipAttr(tooltip)}>
              ${escapeHtml(item.nome)}${item.equipado ? " [equipada]" : ""}
            </strong>
            <span class="small">
              ${item.quantidade}x / peso ${item.peso}
              ${item.usos !== undefined && item.usos !== null ? `/ usos ${item.usos}` : ""}
              ${item.ehArma ? `/ arma ${escapeHtml(item.dano || "sem dano")}` : ""}
              ${item.requerMunicao ? `/ municao: ${escapeHtml(item.tipoMunicao || "indefinida")}` : ""}
            </span>
            ${blockedByShield ? '<span class="disadvantage-badge">bloqueada pelo escudo</span>' : ""}
          </div>
          <div class="top-actions">
            ${
              item.ehArma
                ? `<label class="weapon-equip-toggle">
                    <input
                      type="checkbox"
                      data-equip-weapon="${item.id}"
                      ${item.equipado ? "checked" : ""}
                      ${blockedByShield ? "disabled" : ""}
                    />
                    <span>${item.equipado ? "Equipada" : "Equipar"}</span>
                  </label>`
                : ""
            }
            ${
              canUseItem(item)
                ? `<button class="btn ghost" id="use-${item.id}" type="button" data-use-item="${item.id}">Usar</button>`
                : ""
            }
            <button class="btn danger" id="remove-${item.id}" type="button" data-item-id="${item.id}">Remover</button>
          </div>
        </li>
      `;
      },
    )
    .join("");
}

function renderSummary() {
  const armor = getArmorData(character.armadura_equipada || "Nenhuma");

  moneyValue.textContent = character.dinheiro || 0;
  defenseValue.textContent = character.defesa || 0;
  equippedWeaponName.textContent = character.arma_equipada || "sem arma";
  equippedWeaponDamage.textContent = character.arma_equipada_dano || "-";
  armorSelect.value = armor.nome;
  armorConditionSelect.value = character.armadura_condicao || "Boa";
  armorSelect.classList.toggle("equipamento-quebrado", character.armadura_condicao === "Quebrada");
  armorConditionSelect.classList.toggle("equipamento-quebrado", character.armadura_condicao === "Quebrada");
  shieldToggle.checked = Boolean(character.escudo_equipado);
  shieldConditionSelect.value = character.escudo_condicao || "Boa";
  shieldConditionSelect.disabled = !character.escudo_equipado;
  shieldConditionSelect.classList.toggle("equipamento-quebrado", character.escudo_condicao === "Quebrada");

  const conditionNote =
    character.armadura_condicao === "Quebrada" || character.escudo_condicao === "Quebrada"
      ? `Equipamento quebrado: armadura ${character.armadura_bonus_ajustado || 0}/${character.armadura_bonus || 0}, escudo ${character.escudo_bonus_ajustado || 0}/${character.escudo_bonus || 0}.`
      : "";
  const penaltyNote = (character.armadura_penalidades || []).length
    ? `DESVANTAGEM ATIVA: ${character.armadura_penalidades.map(titleCase).join(", ")}`
    : "Nenhuma desvantagem ativa por armadura ou ritual.";
  armorPenaltyNote.textContent = conditionNote ? `${conditionNote} ${penaltyNote}` : penaltyNote;
  ritualList.innerHTML = (character.rituais || []).length
    ? character.rituais
        .map((ritual) => `<li><span>${escapeHtml(getRitualName(ritual))}</span><span>ritual</span></li>`)
        .join("")
    : "<li><span>Nenhum ritual registrado</span><span>-</span></li>";
}

function titleCase(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderAttributesAndSkills() {
  const attributes = character.atributos || {};
  const skills = character.pericias || {};
  const penalties = new Set(character.armadura_penalidades || []);

  attributesGrid.innerHTML = Object.entries(attributes)
    .map(
      ([key, value]) => `
        <article class="attribute-tile">
          <button
            class="roll-name"
            type="button"
            data-roll-kind="atributo"
            data-roll-key="${key}"
            data-roll-label="${titleCase(key)}"
          >
            ${key.slice(0, 3).toUpperCase()}
          </button>
          <strong>${value}</strong>
          <small>${titleCase(key)}</small>
        </article>
      `,
    )
    .join("");

  skillsGrid.innerHTML = Object.entries(skills)
    .map(
      ([group, entries]) => `
        <section class="skill-group compact-skill-group">
          <h3>${titleCase(group)}</h3>
          ${Object.entries(entries)
            .map(
              ([skill, value]) => `
                <p>
                  <button
                    class="roll-inline"
                    type="button"
                    data-roll-kind="pericia"
                    data-roll-group="${group}"
                    data-roll-key="${skill}"
                    data-roll-label="${titleCase(skill)}"
                  >
                    ${titleCase(skill)}
                    ${penalties.has(skill) ? '<em class="disadvantage-badge">DESVANTAGEM</em>' : ""}
                  </button>
                  <strong>${value}</strong>
                </p>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function renderStigma() {
  const stigma = character.estigma || {};
  stigmaTitle.textContent = `Estigma da ${stigma.tipo || "Fome"}`;
  stigmaBox.innerHTML = `
    <h3>Marca</h3>
    <p>${stigma.marca || "-"}</p>
    <h3>Fardo</h3>
    <p>${stigma.fardo || "-"}</p>
    <h3>Sinal</h3>
    <p>${stigma.sinal || "-"}</p>
  `;
}

function renderRitualCards() {
  const rituals = character.rituais || [];

  if (!ritualCards) {
    return;
  }

  if (!rituals.length) {
    ritualCards.innerHTML = '<p class="subtitle">Nenhum ritual foi marcado neste grimorio.</p>';
    return;
  }

  ritualCards.innerHTML = rituals
    .map(
      (ritual, index) => {
        const tooltip = [
          `Ato: ${getRitualDetail(ritual, "ato")}`,
          `Preco: ${getRitualDetail(ritual, "preco")}`,
          `Ancora: ${getRitualDetail(ritual, "ancora")}`,
        ].join(" | ");
        const target = getRitualSacrificeTarget(ritual);

        return `
        <article class="ritual-card ritual-card-compact">
          <div>
            <p class="section-kicker">Ritual registrado</p>
            <h3 class="tooltip-anchor"${tooltipAttr(tooltip)}>${escapeHtml(getRitualName(ritual))}</h3>
          </div>
          <button class="btn danger" type="button" data-use-ritual="${index}" data-sacrifice-target="${target}">
            Conjurar / Usar Ritual
          </button>
        </article>
      `;
      },
    )
    .join("");
}

function render() {
  renderResources();
  renderInventory();
  renderSummary();
  renderAttributesAndSkills();
  renderStigma();
  renderRitualCards();
  setActiveShops(character.lojas_ativas || {});
  updateCorruptionState();
  updateConditionState();
  renderRollLog();
}

function renderRollLog() {
  if (!rollLogList) {
    return;
  }

  const rolls = rollLogEntries.slice(0, 5);

  rollLogList.innerHTML = rolls.length
    ? rolls
        .map(
          (entry) => `
            <li class="roll-log-entry">
              <span>
                <strong>${escapeHtml(entry.characterName || "Mesa")}</strong>
                ${escapeHtml(entry.label || "Rolagem")}
              </span>
              <span>${escapeHtml(entry.total ?? "-")}</span>
              <small>${escapeHtml(entry.formula || "")}</small>
            </li>
          `,
        )
        .join("")
    : "<li><span>Nenhuma rolagem registrada.</span><span>-</span></li>";
}

function requestRoll(button) {
  emit("roll:request", {
    characterId: character.id,
    kind: button.dataset.rollKind,
    key: button.dataset.rollKey,
    group: button.dataset.rollGroup || "",
    label: button.dataset.rollLabel || button.textContent.trim(),
  });
}

function setSacrificePreview(resourceField, isActive) {
  if (!resourceField) {
    return;
  }

  const resource = resourcesPanel.querySelector(`[data-resource="${resourceField}"]`);
  resource?.classList.toggle("sacrifice-preview", isActive);
}

function runRest(type) {
  playerPage.classList.add("rest-fade");
  emit("character:rest", {
    characterId: character.id,
    type,
  });

  setTimeout(() => {
    playerPage.classList.remove("rest-fade");
  }, 900);
}

function sendResource(field, value) {
  const meta = resourceMeta[field];
  if (!meta) return;

  const max = meta.maxField ? character[meta.maxField] : 100;
  character[field] = clamp(Math.round(Number(value)), 0, max);
  renderResources();
  updateCorruptionState();

  emit("character:update-resource", {
    characterId: character.id,
    field,
    value: character[field],
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.playerTab));
});

rollLogToggle.addEventListener("click", () => {
  rollLogDrawer.classList.toggle("open");
});

inventoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-inventory-filter]");

  if (!button) {
    return;
  }

  inventoryFilter = button.dataset.inventoryFilter;
  inventoryFilters.querySelectorAll("[data-inventory-filter]").forEach((filterButton) => {
    filterButton.classList.toggle("active", filterButton === button);
  });
  renderInventory();
});

attributesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-roll-kind]");

  if (button) {
    requestRoll(button);
  }
});

skillsGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-roll-kind]");

  if (button) {
    requestRoll(button);
  }
});

shortRestButton.addEventListener("click", () => runRest("short"));
longRestButton.addEventListener("click", () => runRest("long"));

resourcesPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-field]");
  if (!button) return;
  sendResource(button.dataset.field, character[button.dataset.field] + Number(button.dataset.delta));
});

resourcesPanel.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-field]");
  if (!input) return;
  sendResource(input.dataset.field, Number(input.value));
});

itemIsWeapon.addEventListener("change", () => {
  itemDamage.disabled = !itemIsWeapon.checked;
  itemEquipped.disabled = !itemIsWeapon.checked;
  if (!itemIsWeapon.checked) {
    itemDamage.value = "";
    itemEquipped.checked = false;
  }
});

inventoryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const nome = itemName.value.trim();
  const peso = Number(itemPeso.value || 0);
  const quantidade = Math.max(1, Math.round(Number(itemQuantity.value || 1)));
  const ehArma = itemIsWeapon.checked;
  const dano = itemDamage.value.trim();
  const equipado = ehArma && itemEquipped.checked;
  const proposed = inventoryTotal() + peso * quantidade;

  if (!nome) return;

  if (proposed > character.limite_inventario) {
    setWarning(`Limite excedido: ${proposed}/${character.limite_inventario} de peso.`);
    return;
  }

  setWarning("");

  emit("character:add-item", {
    characterId: character.id,
    nome,
    peso,
    quantidade,
    ehArma,
    dano,
    equipado,
  });

  itemName.value = "";
  itemPeso.value = "1";
  itemQuantity.value = "1";
  itemDamage.value = "";
  itemIsWeapon.checked = false;
  itemEquipped.checked = false;
  itemDamage.disabled = true;
  itemEquipped.disabled = true;
});

function sendDefenseEquipmentUpdate() {
  emit("character:update-defense-equipment", {
    characterId: character.id,
    armadura_equipada: armorSelect.value,
    armadura_condicao: armorConditionSelect.value,
    escudo_equipado: shieldToggle.checked,
    escudo_condicao: shieldConditionSelect.value,
  });
}

armorSelect.addEventListener("change", () => {
  playGothicSound("armor");
  sendDefenseEquipmentUpdate();
});
armorConditionSelect.addEventListener("change", sendDefenseEquipmentUpdate);
shieldToggle.addEventListener("change", () => {
  playGothicSound("armor");
  shieldConditionSelect.disabled = !shieldToggle.checked;

  if (!shieldToggle.checked) {
    shieldConditionSelect.value = "Boa";
  }

  if (shieldToggle.checked) {
    inventoryList.querySelectorAll("input[data-equip-weapon]").forEach((checkbox) => {
      const item = (character.inventario || []).find((entry) => entry.id === checkbox.dataset.equipWeapon);

      if (item && isTwoHandedWeapon(item)) {
        checkbox.checked = false;
        checkbox.disabled = true;
      }
    });
  }

  sendDefenseEquipmentUpdate();
});
shieldConditionSelect.addEventListener("change", sendDefenseEquipmentUpdate);

inventoryList.addEventListener("change", (event) => {
  const equipCheckbox = event.target.closest("input[data-equip-weapon]");

  if (!equipCheckbox) {
    return;
  }

  if (equipCheckbox.disabled) {
    equipCheckbox.checked = false;
    return;
  }

  if (equipCheckbox.checked) {
    inventoryList.querySelectorAll("input[data-equip-weapon]").forEach((checkbox) => {
      if (checkbox !== equipCheckbox) {
        checkbox.checked = false;
      }
    });
  }

  emit("equipar-arma", {
    characterId: character.id,
    itemId: equipCheckbox.checked ? equipCheckbox.dataset.equipWeapon : "",
  });
});

inventoryList.addEventListener("click", (event) => {
  const useButton = event.target.closest("[data-use-item]");

  if (useButton) {
    const item = (character.inventario || []).find((entry) => entry.id === useButton.dataset.useItem);

    if (item && canUseItem(item)) {
      playGothicSound("potion");
    }

    emit("character:use-item", {
      characterId: character.id,
      itemId: useButton.dataset.useItem,
    });
    return;
  }

  const removeButton = event.target.closest("[data-item-id]");
  if (!removeButton) return;

  emit("character:remove-item", {
    characterId: character.id,
    itemId: removeButton.dataset.itemId,
  });
});

shopPanels.forEach((panel) => {
  panel.addEventListener("click", (event) => {
    const buyButton = event.target.closest("[data-buy-shop][data-buy-index]");

    if (!buyButton) {
      return;
    }

    emit("shop:buy-item", {
      characterId: character.id,
      loja: buyButton.dataset.buyShop,
      itemIndex: Number(buyButton.dataset.buyIndex),
    });
    playGothicSound("coins");
  });
});

function openRitualModal(ritual) {
  pendingRitual = ritual;
  ritualConfirmName.textContent = getRitualName(ritual);
  ritualConfirmModal.classList.remove("hidden");
  ritualConfirmButton.focus();
}

function closeRitualModal() {
  pendingRitual = null;
  ritualConfirmModal.classList.add("hidden");
}

async function playRitualAnimation(ritual) {
  closeRitualModal();

  const ritualName = getRitualName(ritual);
  const ritualAct = getRitualDetail(ritual, "ato", ritualName);

  ritualCastText.textContent = ritualAct;
  ritualFlash.classList.add("active");
  ritualCastText.classList.remove("hidden");
  ritualCastText.classList.add("active");
  document.body.classList.add("ritual-shake");

  await sleep(1700);

  ritualFlash.classList.remove("active");
  ritualCastText.classList.remove("active");
  ritualCastText.classList.add("hidden");
  document.body.classList.remove("ritual-shake");

  emit("ritual:use", {
    characterId: character.id,
    ritualNome: ritualName,
  });
}

if (ritualCards) {
  ritualCards.addEventListener("click", (event) => {
    const useButton = event.target.closest("[data-use-ritual]");

    if (!useButton) {
      return;
    }

    const ritual = (character.rituais || [])[Number(useButton.dataset.useRitual)];

    if (ritual) {
      openRitualModal(ritual);
    }
  });

  ritualCards.addEventListener("mouseover", (event) => {
    const button = event.target.closest("[data-sacrifice-target]");
    setSacrificePreview(button?.dataset.sacrificeTarget || "", Boolean(button));
  });

  ritualCards.addEventListener("mouseout", (event) => {
    const button = event.target.closest("[data-sacrifice-target]");
    setSacrificePreview(button?.dataset.sacrificeTarget || "", false);
  });

  ritualCards.addEventListener("focusin", (event) => {
    const button = event.target.closest("[data-sacrifice-target]");
    setSacrificePreview(button?.dataset.sacrificeTarget || "", Boolean(button));
  });

  ritualCards.addEventListener("focusout", (event) => {
    const button = event.target.closest("[data-sacrifice-target]");
    setSacrificePreview(button?.dataset.sacrificeTarget || "", false);
  });
}

ritualCancelButton.addEventListener("click", closeRitualModal);
ritualConfirmButton.addEventListener("click", () => {
  if (pendingRitual) {
    playRitualAnimation(pendingRitual);
  }
});
ritualConfirmModal.addEventListener("click", (event) => {
  if (event.target === ritualConfirmModal) {
    closeRitualModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ritualConfirmModal.classList.contains("hidden")) {
    closeRitualModal();
  }
});

if (socket) {
  socket.on("connect", () => {
    socketStatus.textContent = "Online";
    socketStatus.classList.add("online");
    socket.emit("player:join", { characterId: character.id });
  });

  socket.on("disconnect", () => {
    socketStatus.textContent = "Offline";
    socketStatus.classList.remove("online");
  });

  socket.on("character:updated", (payload) => {
    if (payload.id !== character.id) return;
    character = payload;
    setWarning("");
    render();
  });

  socket.on("inventory:error", (payload) => {
    setWarning(payload.message || "Inventario excedido.");
  });

  socket.on("item:error", (payload) => {
    const message = payload.message || "Nao foi possivel usar este item.";
    setWarning(message);
    window.alert(message);
  });

  socket.on("item:used", (payload) => {
    setWarning(payload.message || payload.mensagem || "Item usado.");
  });

  socket.on("shop:error", (payload) => {
    const message = payload.message || "Nao foi possivel concluir a troca.";
    setWarning(message);
    window.alert(message);
  });

  socket.on("shop:success", (payload) => {
    setWarning(payload.message || "Troca concluida.");
  });

  socket.on("roll:log", (payload) => {
    rollLogEntries = Array.isArray(payload) ? payload : [];
    renderRollLog();
  });

  socket.on("roll:result", (payload) => {
    rollLogEntries = [payload, ...rollLogEntries.filter((entry) => entry.id !== payload.id)].slice(0, 5);
    renderRollLog();
    rollLogDrawer.classList.add("has-new");
    setTimeout(() => rollLogDrawer.classList.remove("has-new"), 900);
  });

  socket.on("rest:done", (payload) => {
    setWarning(payload.message || "Descanso registrado.");
    playerPage.classList.add("rest-fade");
    setTimeout(() => playerPage.classList.remove("rest-fade"), 900);
  });

  socket.on("ritual:error", (payload) => {
    window.alert(payload.message || "Nao foi possivel registrar o ritual.");
  });

  socket.on("ritual:confirmed", (payload) => {
    setWarning(payload.efeito?.mensagem || "Ritual registrado na sessao.");
  });

  socket.on("shops:status", ({ lojas }) => {
    character.lojas_ativas = lojas || {};
    setActiveShops(character.lojas_ativas);
  });

  socket.on("loja:status", ({ aberta, lojas }) => {
    character.lojas_ativas =
      lojas ||
      Object.fromEntries([...shopPanels].map((panel) => [panel.dataset.shopPanel, Boolean(aberta)]));
    setActiveShops(character.lojas_ativas);
  });

  socket.on("character:deleted", ({ characterId }) => {
    if (characterId !== character.id) return;
    window.location.href = "/criar-ficha";
  });
}

itemDamage.disabled = true;
itemEquipped.disabled = true;
render();
