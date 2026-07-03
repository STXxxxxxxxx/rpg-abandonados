const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const loginPanel = document.querySelector("#loginPanel");
const registerPanel = document.querySelector("#registerPanel");
const registerRole = document.querySelector("#registerRole");
const masterKeyField = document.querySelector("#masterKeyField");
const masterKeyInput = document.querySelector("#masterKeyInput");

function setAuthTab(tabName) {
  const isRegister = tabName === "register";

  loginTab.classList.toggle("active", !isRegister);
  registerTab.classList.toggle("active", isRegister);
  loginPanel.classList.toggle("hidden", isRegister);
  registerPanel.classList.toggle("hidden", !isRegister);
}

loginTab.addEventListener("click", () => setAuthTab("login"));
registerTab.addEventListener("click", () => setAuthTab("register"));

function toggleMasterKey() {
  const isMaster = registerRole.value === "master";

  masterKeyField.classList.toggle("hidden", !isMaster);
  masterKeyInput.disabled = !isMaster;
  masterKeyInput.required = isMaster;

  if (!isMaster) {
    masterKeyInput.value = "";
  }
}

registerRole.addEventListener("change", toggleMasterKey);
toggleMasterKey();
