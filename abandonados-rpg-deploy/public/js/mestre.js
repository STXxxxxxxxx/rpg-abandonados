const socket = window.io ? window.io() : null;
let characters = window.__CHARACTERS__ || [];
let activeShops = window.__ACTIVE_SHOPS__ || {};
let ritualLog = window.__RITUAL_LOG__ || [];
let rollLog = [];

const playersGrid = document.querySelector("#playersGrid");
const playerCount = document.querySelector("#playerCount");
const socketStatus = document.querySelector("#socketStatus");
const refreshTableButton = document.querySelector("#refreshTableButton");
const shopToggles = document.querySelectorAll("[data-shop-toggle]");
const sessionStatus = document.querySelector("#sessionStatus");
const startSessionButton = document.querySelector("#startSessionButton");
const endSessionButton = document.querySelector("#endSessionButton");
const mesaPanel = document.querySelector("#mesaPanel");
const bestiarioPanel = document.querySelector("#bestiarioPanel");
const tabButtons = document.querySelectorAll("[data-master-tab]");
const deathModal = document.querySelector("#deathModal");
const deathCharacterName = document.querySelector("#deathCharacterName");
const deathExpectedName = document.querySelector("#deathExpectedName");
const deathConfirmInput = document.querySelector("#deathConfirmInput");
const deathCancelButton = document.querySelector("#deathCancelButton");
const deathConfirmButton = document.querySelector("#deathConfirmButton");
const ritualLogList = document.querySelector("#ritualLogList");

const minimizedCards = new Set();
let pendingDeletion = null;
const equipmentConditions = ["Boa", "Desgastada", "Quebrada"];

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

function titleCase(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inventoryTotal(character) {
  return (character.inventario || character.itens || []).reduce(
    (sum, item) => sum + Number(item.peso || item.slots || 0) * Number(item.quantidade || 1),
    0,
  );
}

function percent(value, max) {
  if (!max) {
    return 0;
  }

  return clamp((value / max) * 100, 0, 100);
}

function overlayUrl(characterId) {
  return `${window.location.origin}/overlay/${characterId}?token=${encodeURIComponent(window.__OBS_TOKEN__)}`;
}

function renderAttributeBadges(character) {
  const attributes = character.atributos || {};
  const entries = Object.entries(attributes);

  if (!entries.length) {
    return '<p class="small">Atributos ainda nao registrados.</p>';
  }

  return `
    <div class="master-attribute-grid">
      ${entries
        .map(
          ([key, value]) => `
            <span>
              <strong>${escapeHtml(String(value))}</strong>
              ${escapeHtml(titleCase(key))}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderRitualLog() {
  if (!ritualLogList) {
    return;
  }

  const entries = [...rollLog, ...ritualLog].sort(
    (left, right) => new Date(right.at || 0) - new Date(left.at || 0),
  );

  if (!entries.length) {
    ritualLogList.innerHTML = "<li><span>Nenhum ritual registrado nesta sessao.</span></li>";
    return;
  }

  ritualLogList.innerHTML = entries
    .slice(0, 10)
    .map((entry) => {
      const time = entry.at
        ? new Date(entry.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "--:--";

      if (entry.tipo === "rolagem") {
        return `
          <li class="ritual-log-entry">
            <span>
              <strong>${escapeHtml(entry.characterName || "Abandonado")}</strong>
              rolou <strong>${escapeHtml(entry.label || "teste")}</strong>
              <em>${escapeHtml(time)}</em>
            </span>
            <small>${escapeHtml(entry.formula || `Total: ${entry.total || "-"}`)}</small>
          </li>
        `;
      }

      const ritual = entry.ritual || {};
      const effect = entry.efeito || {};

      return `
        <li class="ritual-log-entry">
          <span>
            <strong>${escapeHtml(entry.characterName || "Abandonado")}</strong>
            conjurou <strong>${escapeHtml(ritual.nome || "ritual desconhecido")}</strong>
            <em>${escapeHtml(time)}</em>
          </span>
          <small>${escapeHtml(effect.mensagem || ritual.ato || "Ato nao registrado.")}</small>
        </li>
      `;
    })
    .join("");
}

function renderCharacterStates(character) {
  const states = [];

  if (character.bloqueado) states.push("Turno bloqueado");
  if (character.em_jejum) states.push("Em jejum");
  if (character.em_vigilia) states.push("Em vigilia");
  if (character.peso_ativo) states.push("O Peso ativo");

  if (character.desvantagens_ativas?.length) {
    states.push(`Desvantagens: ${character.desvantagens_ativas.map(titleCase).join(", ")}`);
  }

  if (!states.length) {
    return "";
  }

  return `
    <div class="state-badge-row">
      ${states.map((state) => `<span class="state-badge">${escapeHtml(state)}</span>`).join("")}
    </div>
  `;
}

function renderConditionOptions(currentCondition) {
  const current = equipmentConditions.includes(currentCondition) ? currentCondition : "Boa";

  return equipmentConditions
    .map(
      (condition) =>
        `<option value="${condition}" ${condition === current ? "selected" : ""}>${condition}</option>`,
    )
    .join("");
}

function renderEquipmentConditionControls(character) {
  return `
    <div class="equipment-condition-controls">
      <label class="field compact-field">
        Condicao armadura
        <select
          class="${character.armadura_condicao === "Quebrada" ? "equipamento-quebrado" : ""}"
          data-equipment-condition="armadura"
          data-character-id="${character.id}"
        >
          ${renderConditionOptions(character.armadura_condicao)}
        </select>
      </label>
      <label class="field compact-field">
        Condicao escudo
        <select
          class="${character.escudo_condicao === "Quebrada" ? "equipamento-quebrado" : ""}"
          data-equipment-condition="escudo"
          data-character-id="${character.id}"
          ${character.escudo_equipado ? "" : "disabled"}
        >
          ${renderConditionOptions(character.escudo_condicao)}
        </select>
      </label>
    </div>
  `;
}

function renderCharacters() {
  playerCount.textContent = String(characters.length);

  if (!characters.length) {
    playersGrid.innerHTML = `
      <article class="panel" style="padding: 28px">
        <p class="section-kicker">Mesa vazia</p>
        <h2>Nenhum jogador com ficha cadastrada.</h2>
        <p class="subtitle">Quando um jogador criar ficha, o card aparece aqui automaticamente.</p>
      </article>
    `;
    return;
  }

  playersGrid.innerHTML = characters
    .map((character) => {
      const link = overlayUrl(character.id);
      const items = (character.inventario || character.itens || []).slice(0, 5);
      const isMinimized = minimizedCards.has(character.id);
      const safeName = escapeHtml(character.nome);
      const safeUsername = escapeHtml(character.username || "jogador");

      return `
        <article class="card player-card ${isMinimized ? "is-minimized" : ""}" data-character-id="${character.id}">
          <header class="card-head">
            <div>
              <p class="section-kicker">${character.online ? "Online" : "Offline"}</p>
              <h2>${safeName}</h2>
              <p class="small">@${safeUsername}</p>
            </div>
            <div class="card-head-tools">
              <span class="status-pill ${character.online ? "online" : ""}">${character.online ? "ativo" : "ausente"}</span>
              <button class="icon-btn" type="button" data-minimize-card="${character.id}" aria-label="Minimizar card">
                ${isMinimized ? "+" : "-"}
              </button>
            </div>
          </header>

          <section class="metric">
            <div class="metric-top">
              <strong>PV</strong>
              <span>${character.pv_atual}/${character.pv_max}</span>
            </div>
            <div class="bar"><div class="fill" style="width: ${percent(character.pv_atual, character.pv_max)}%"></div></div>
          </section>

          <section class="metric compact master-essential">
            <div class="metric-top"><strong>PS</strong><span>${character.ps_atual}/${character.ps_max}</span></div>
          </section>

          ${renderCharacterStates(character)}

          <div class="card-collapsible">
            <section class="metric compact">
              <div class="metric-top"><strong>Fome</strong><span>${character.fome}/100</span></div>
              <div class="metric-top"><strong>Sede</strong><span>${character.sede}/100</span></div>
              <div class="metric-top"><strong>Municao</strong><span>${character.municao_atual}/${character.municao_max}</span></div>
              <div class="metric-top"><strong>Defesa</strong><span>${character.defesa}</span></div>
              <div class="metric-top">
                <strong>Armadura</strong>
                <span class="${character.armadura_condicao === "Quebrada" ? "equipment-state quebrado" : "equipment-state"}">
                  ${escapeHtml(character.armadura_equipada || "Nenhuma")} (${escapeHtml(character.armadura_condicao || "Boa")})
                </span>
              </div>
              <div class="metric-top">
                <strong>Escudo</strong>
                <span class="${character.escudo_condicao === "Quebrada" ? "equipment-state quebrado" : "equipment-state"}">
                  ${character.escudo_equipado ? `sim (${escapeHtml(character.escudo_condicao || "Boa")})` : "nao"}
                </span>
              </div>
              <div class="metric-top"><strong>Arma</strong><span>${escapeHtml(character.arma_equipada || "sem arma")}</span></div>
              <div class="metric-top"><strong>Dano</strong><span>${escapeHtml(character.arma_equipada_dano || "-")}</span></div>
              <div class="metric-top"><strong>Carga</strong><span>${inventoryTotal(character)}/${character.limite_inventario}</span></div>
            </section>

            ${renderEquipmentConditionControls(character)}

            <div>
              <p class="section-kicker">Atributos</p>
              ${renderAttributeBadges(character)}
            </div>

            <div>
              <p class="section-kicker">Itens principais</p>
              <ul class="plain-list compact-list">
                ${
                  items.length
                    ? items
                        .map(
                          (item) =>
                            `<li><span>${escapeHtml(item.nome)}${item.equipado ? " [eq]" : ""}</span><span>${item.quantidade}x</span></li>`,
                        )
                        .join("")
                    : "<li><span>Inventario vazio</span><span>0</span></li>"
                }
              </ul>
            </div>

            <label class="field overlay-link">
              Link OBS individual
              <input id="overlay-${character.id}" type="text" value="${escapeHtml(link)}" readonly />
            </label>

            <div class="card-actions">
              <button class="btn danger" type="button" data-field="pv_atual" data-delta="-1" data-character-id="${character.id}">Dano -1</button>
              <button class="btn" type="button" data-field="pv_atual" data-delta="1" data-character-id="${character.id}">Curar +1</button>
              <button class="btn ghost" type="button" data-copy="${character.id}">Copiar OBS</button>
              <button class="btn danger" type="button" data-delete-character="${character.id}">Eliminar Personagem</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function upsertCharacter(payload) {
  const index = characters.findIndex((character) => character.id === payload.id);

  if (index >= 0) {
    characters[index] = payload;
  } else {
    characters.push(payload);
  }

  renderCharacters();
}

function openDeathModal(character) {
  pendingDeletion = character;
  const expectedName = String(character.nome || "").toUpperCase();

  deathCharacterName.textContent = character.nome;
  deathExpectedName.textContent = expectedName;
  deathConfirmInput.value = "";
  deathConfirmButton.disabled = true;
  deathModal.classList.remove("hidden");
  deathConfirmInput.focus();
}

function closeDeathModal() {
  pendingDeletion = null;
  deathModal.classList.add("hidden");
  deathConfirmInput.value = "";
  deathConfirmButton.disabled = true;
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.masterTab;

    tabButtons.forEach((entry) => entry.classList.toggle("active", entry === button));
    mesaPanel.classList.toggle("hidden", target !== "mesa");
    bestiarioPanel.classList.toggle("hidden", target !== "bestiario");
  });
});

playersGrid.addEventListener("click", async (event) => {
  const minimizeButton = event.target.closest("[data-minimize-card]");

  if (minimizeButton) {
    const card = minimizeButton.closest(".player-card");
    const isMinimized = card.classList.toggle("is-minimized");

    if (isMinimized) {
      minimizedCards.add(minimizeButton.dataset.minimizeCard);
      minimizeButton.textContent = "+";
    } else {
      minimizedCards.delete(minimizeButton.dataset.minimizeCard);
      minimizeButton.textContent = "-";
    }

    return;
  }

  const deleteButton = event.target.closest("[data-delete-character]");

  if (deleteButton) {
    const character = characters.find((entry) => entry.id === deleteButton.dataset.deleteCharacter);

    if (character) {
      openDeathModal(character);
    }

    return;
  }

  const copyButton = event.target.closest("[data-copy]");

  if (copyButton) {
    const input = document.querySelector(`#overlay-${copyButton.dataset.copy}`);
    input.select();

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(input.value);
    }

    copyButton.textContent = "Copiado";
    setTimeout(() => {
      copyButton.textContent = "Copiar OBS";
    }, 1200);
    return;
  }

  const button = event.target.closest("button[data-character-id][data-field]");

  if (!button) {
    return;
  }

  const character = characters.find((entry) => entry.id === button.dataset.characterId);

  if (!character) {
    return;
  }

  const field = button.dataset.field;
  const maxField = field.replace("_atual", "_max");
  const delta = Number(button.dataset.delta);

  character[field] = clamp(Number(character[field] || 0) + delta, 0, Number(character[maxField] || 0));
  renderCharacters();

  emit("master:adjust-resource", {
    characterId: character.id,
    field,
    delta,
  });
});

playersGrid.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-equipment-condition]");

  if (!select) {
    return;
  }

  const character = characters.find((entry) => entry.id === select.dataset.characterId);

  if (!character) {
    return;
  }

  const condition = equipmentConditions.includes(select.value) ? select.value : "Boa";

  if (select.dataset.equipmentCondition === "armadura") {
    character.armadura_condicao = condition;
  } else {
    character.escudo_condicao = condition;
  }

  select.classList.toggle("equipamento-quebrado", condition === "Quebrada");

  emit("character:update-defense-equipment", {
    characterId: character.id,
    armadura_equipada: character.armadura_equipada || "Nenhuma",
    armadura_condicao: character.armadura_condicao || "Boa",
    escudo_equipado: Boolean(character.escudo_equipado),
    escudo_condicao: character.escudo_condicao || "Boa",
  });
});

refreshTableButton.addEventListener("click", () => {
  emit("master:request-table", {});
});

deathCancelButton.addEventListener("click", closeDeathModal);
deathConfirmInput.addEventListener("input", () => {
  if (!pendingDeletion) {
    deathConfirmButton.disabled = true;
    return;
  }

  deathConfirmButton.disabled =
    deathConfirmInput.value !== String(pendingDeletion.nome || "").toUpperCase();
});
deathConfirmButton.addEventListener("click", () => {
  if (!pendingDeletion || deathConfirmButton.disabled) {
    return;
  }

  emit("master:delete-character", {
    characterId: pendingDeletion.id,
    confirmation: deathConfirmInput.value,
  });
  closeDeathModal();
});
deathModal.addEventListener("click", (event) => {
  if (event.target === deathModal) {
    closeDeathModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deathModal.classList.contains("hidden")) {
    closeDeathModal();
  }
});

function setSessionActive(isActive) {
  sessionStatus.textContent = isActive ? "Sessao ativa" : "Sessao pausada";
  sessionStatus.classList.toggle("online", isActive);
}

function setShopToggles(shops) {
  activeShops = shops || {};
  shopToggles.forEach((toggle) => {
    toggle.checked = Boolean(activeShops[toggle.dataset.shopToggle]);
  });
}

setShopToggles(activeShops);
shopToggles.forEach((toggle) => {
  toggle.addEventListener("change", () => {
    activeShops[toggle.dataset.shopToggle] = toggle.checked;
    emit("toggle-shop", {
      loja: toggle.dataset.shopToggle,
      status: toggle.checked,
    });
  });
});

setSessionActive(Boolean(window.__SESSION_ACTIVE__));
startSessionButton.addEventListener("click", () => emit("mestre:iniciar-sessao", {}));
endSessionButton.addEventListener("click", () => emit("mestre:finalizar-sessao", {}));

if (socket) {
  socket.on("connect", () => {
    socketStatus.textContent = "Online";
    socketStatus.classList.add("online");
    socket.emit("master:join", {});
  });

  socket.on("disconnect", () => {
    socketStatus.textContent = "Offline";
    socketStatus.classList.remove("online");
  });

  socket.on("master:characters", (payload) => {
    characters = Array.isArray(payload) ? payload : [];
    renderCharacters();
  });

  socket.on("character:updated", upsertCharacter);

  socket.on("character:deleted", ({ characterId }) => {
    minimizedCards.delete(characterId);
    characters = characters.filter((character) => character.id !== characterId);
    renderCharacters();
  });

  socket.on("master:delete-error", ({ message }) => {
    window.alert(message || "Nao foi possivel eliminar o personagem.");
  });

  socket.on("shops:status", ({ lojas }) => {
    setShopToggles(lojas);
  });

  socket.on("loja:status", ({ lojas }) => {
    if (lojas) {
      setShopToggles(lojas);
    }
  });

  socket.on("sessao:status", ({ ativa }) => {
    setSessionActive(Boolean(ativa));
  });

  socket.on("ritual:log", (payload) => {
    ritualLog = Array.isArray(payload) ? payload : [];
    renderRitualLog();
  });

  socket.on("roll:log", (payload) => {
    rollLog = Array.isArray(payload) ? payload : [];
    renderRitualLog();
  });

  socket.on("roll:result", (payload) => {
    rollLog = [payload, ...rollLog.filter((entry) => entry.id !== payload.id)].slice(0, 30);
    renderRitualLog();
  });

  socket.on("ritual:used", (payload) => {
    ritualLog = [payload, ...ritualLog].slice(0, 30);
    renderRitualLog();
  });
}

renderCharacters();
renderRitualLog();
