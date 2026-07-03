const socket = window.io ? window.io() : null;
let character = window.__CHARACTER__;

const overlayShell = document.querySelector(".overlay-shell");
const overlayName = document.querySelector("#overlayName");
const overlayPv = document.querySelector("#overlayPv");
const overlayPs = document.querySelector("#overlayPs");
const overlayDef = document.querySelector("#overlayDef");
const overlayAmmo = document.querySelector("#overlayAmmo");

function formatResource(current, max) {
  return `${Number(current || 0)} / ${Number(max || 0)}`;
}

function isCriticalResource(current, max, threshold) {
  const safeMax = Number(max || 0);

  if (safeMax <= 0) {
    return false;
  }

  return Number(current || 0) / safeMax <= threshold;
}

function updateCorruptionState() {
  if (!overlayShell) {
    return;
  }

  overlayShell.classList.toggle(
    "estado-agonia",
    isCriticalResource(character.pv_atual, character.pv_max, 0.25),
  );
  overlayShell.classList.toggle(
    "estado-loucura",
    isCriticalResource(character.ps_atual, character.ps_max, 0.3),
  );
}

function renderOverlay() {
  const hasEquippedWeapon = Boolean(character.arma_equipada);

  overlayName.innerText = character.name || character.nome || "Abandonado";
  overlayPv.innerText = formatResource(character.pv_atual, character.pv_max);
  overlayPs.innerText = formatResource(character.ps_atual, character.ps_max);
  overlayDef.innerText = `\u{1F6E1}\uFE0F DEF ${Number(character.defesa || 0)}`;
  overlayAmmo.innerText = `\u26A1 ${formatResource(character.municao_atual, character.municao_max)}`;
  overlayAmmo.classList.toggle("hidden", !hasEquippedWeapon);
  updateCorruptionState();
}

if (socket) {
  socket.on("connect", () => {
    socket.emit("overlay:join", {
      characterId: character.id,
      token: window.__OVERLAY_TOKEN__,
    });
  });

  socket.on("character:updated", (payload) => {
    if (payload.id !== character.id) {
      return;
    }

    character = payload;
    renderOverlay();
  });
}

renderOverlay();
