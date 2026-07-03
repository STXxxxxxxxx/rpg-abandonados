const stepButtons = document.querySelectorAll("[data-wizard-step]");
const pages = document.querySelectorAll("[data-page]");
const prevStepButton = document.querySelector("#prevStepButton");
const nextStepButton = document.querySelector("#nextStepButton");
const submitWizardButton = document.querySelector("#submitWizardButton");
const attributeInputs = document.querySelectorAll(".attribute-input");
const attributePoints = document.querySelector("#attributePoints");
const attributeWarning = document.querySelector("#attributeWarning");
const skillInputs = document.querySelectorAll(".skill-input");
const skillPoints = document.querySelector("#skillPoints");
const skillWarning = document.querySelector("#skillWarning");
const stigmaSelect = document.querySelector("#stigmaSelect");
const stigmaPreview = document.querySelector("#stigmaPreview");
const ritualInputs = document.querySelectorAll(".ritual-choice-input");
const ritualChoiceCount = document.querySelector("#ritualChoiceCount");
const ritualWarning = document.querySelector("#ritualWarning");
const weaponInputs = document.querySelectorAll(".weapon-choice-input");
const weaponChoiceCount = document.querySelector("#weaponChoiceCount");
const weaponWarning = document.querySelector("#weaponWarning");
const wizardForm = document.querySelector("#wizardForm");

let currentStep = 1;
const maxStep = 5;

function sumInputs(inputs) {
  return [...inputs].reduce((sum, input) => sum + Number(input.value || 0), 0);
}

function updateAttributeState() {
  const total = sumInputs(attributeInputs);
  attributePoints.textContent = `${total}/15`;
  attributeWarning.textContent = total > 15 ? "O limite de atributos foi ultrapassado." : "";
  attributePoints.classList.toggle("warning", total > 15);
  return total <= 15;
}

function updateSkillState() {
  const total = sumInputs(skillInputs);
  skillPoints.textContent = `${total}/10`;
  skillWarning.textContent = total > 10 ? "O limite de pericias foi ultrapassado." : "";
  skillPoints.classList.toggle("warning", total > 10);
  return total <= 10;
}

function updateWeaponState() {
  const total = [...weaponInputs].filter((input) => input.checked).length;

  if (weaponChoiceCount) {
    weaponChoiceCount.textContent = `${total}/2`;
    weaponChoiceCount.classList.toggle("warning", total > 2);
  }

  if (weaponWarning) {
    weaponWarning.textContent = total > 2 ? "Escolha no maximo 2 armas iniciais." : "";
  }

  return total <= 2;
}

function updateRitualState(changedInput = null) {
  if (changedInput?.checked) {
    ritualInputs.forEach((input) => {
      if (input !== changedInput) {
        input.checked = false;
      }
    });
  }

  const total = [...ritualInputs].filter((input) => input.checked).length;

  if (ritualChoiceCount) {
    ritualChoiceCount.textContent = `${total}/1`;
    ritualChoiceCount.classList.toggle("warning", total > 1);
  }

  if (ritualWarning) {
    ritualWarning.textContent = total > 1 ? "Escolha no maximo 1 ritual inicial." : "";
  }

  return total <= 1;
}

function renderStigma() {
  const stigma = window.__STIGMAS__[stigmaSelect.value];
  stigmaPreview.innerHTML = `
    <p class="section-kicker">Estigma da ${stigmaSelect.value}</p>
    <h3>Marca</h3>
    <p>${stigma.marca}</p>
    <h3>Fardo</h3>
    <p>${stigma.fardo}</p>
    <h3>Sinal</h3>
    <p>${stigma.sinal}</p>
  `;
}

function setStep(step) {
  currentStep = Math.max(1, Math.min(maxStep, step));

  stepButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.wizardStep) === currentStep);
  });

  pages.forEach((page) => {
    page.classList.toggle("hidden", Number(page.dataset.page) !== currentStep);
  });

  prevStepButton.classList.toggle("hidden", currentStep === 1);
  nextStepButton.classList.toggle("hidden", currentStep === maxStep);
  submitWizardButton.classList.toggle("hidden", currentStep !== maxStep);
}

stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (currentStep === 1 && !updateAttributeState()) return;
    if (currentStep === 2 && !updateSkillState()) return;
    if (currentStep === 4 && !updateRitualState()) return;
    if (currentStep === 5 && !updateWeaponState()) return;
    setStep(Number(button.dataset.wizardStep));
  });
});

prevStepButton.addEventListener("click", () => setStep(currentStep - 1));
nextStepButton.addEventListener("click", () => {
  if (currentStep === 1 && !updateAttributeState()) return;
  if (currentStep === 2 && !updateSkillState()) return;
  if (currentStep === 4 && !updateRitualState()) return;
  if (currentStep === 5 && !updateWeaponState()) return;
  setStep(currentStep + 1);
});

attributeInputs.forEach((input) => input.addEventListener("input", updateAttributeState));
skillInputs.forEach((input) => input.addEventListener("input", updateSkillState));
ritualInputs.forEach((input) => input.addEventListener("change", () => updateRitualState(input)));
weaponInputs.forEach((input) => input.addEventListener("change", updateWeaponState));
stigmaSelect.addEventListener("change", renderStigma);

wizardForm.addEventListener("submit", (event) => {
  if (!updateAttributeState()) {
    event.preventDefault();
    setStep(1);
    return;
  }

  if (!updateSkillState()) {
    event.preventDefault();
    setStep(2);
    return;
  }

  if (!updateWeaponState()) {
    event.preventDefault();
    setStep(5);
    return;
  }

  if (!updateRitualState()) {
    event.preventDefault();
    setStep(4);
  }
});

updateAttributeState();
updateSkillState();
updateRitualState();
updateWeaponState();
renderStigma();
setStep(1);
