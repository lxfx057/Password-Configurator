(() => {
  const DB_NAME = "password-configurator";
  const DB_VERSION = 1;
  const SETTINGS_STORE = "settings";
  const CREDENTIALS_STORE = "credentials";

  const CHARSETS = {
    uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
    lowercase: "abcdefghijkmnopqrstuvwxyz",
    numbers: "23456789",
    symbols: "!@#$%^&*+-_=?."
  };

  const state = {
    database: null,
    settings: null,
    key: null,
    credentials: [],
    masterMode: "setup",
    inactivityTimer: null
  };

  const $ = (selector) => document.querySelector(selector);

  const elements = {
    generatedPassword: $("#generatedPassword"),
    regenerateButton: $("#regenerateButton"),
    copyGeneratedButton: $("#copyGeneratedButton"),
    saveGeneratedButton: $("#saveGeneratedButton"),
    lengthInput: $("#lengthInput"),
    lengthOutput: $("#lengthOutput"),
    uppercaseInput: $("#uppercaseInput"),
    lowercaseInput: $("#lowercaseInput"),
    numbersInput: $("#numbersInput"),
    symbolsInput: $("#symbolsInput"),
    ambiguousInput: $("#ambiguousInput"),

    vaultStatus: $("#vaultStatus"),
    vaultStatusText: $("#vaultStatusText"),
    lockButton: $("#lockButton"),
    addCredentialButton: $("#addCredentialButton"),
    vaultLocked: $("#vaultLocked"),
    vaultUnlocked: $("#vaultUnlocked"),
    vaultTitle: $("#vaultTitle"),
    vaultDescription: $("#vaultDescription"),
    openVaultButton: $("#openVaultButton"),
    searchInput: $("#searchInput"),
    credentialsList: $("#credentialsList"),
    exportButton: $("#exportButton"),
    importInput: $("#importInput"),

    masterDialog: $("#masterDialog"),
    masterForm: $("#masterForm"),
    masterDialogLabel: $("#masterDialogLabel"),
    masterDialogTitle: $("#masterDialogTitle"),
    masterDialogText: $("#masterDialogText"),
    masterPasswordInput: $("#masterPasswordInput"),
    masterConfirmGroup: $("#masterConfirmGroup"),
    masterConfirmInput: $("#masterConfirmInput"),
    masterError: $("#masterError"),
    masterSubmitButton: $("#masterSubmitButton"),
    masterCloseButton: $("#masterCloseButton"),

    credentialDialog: $("#credentialDialog"),
    credentialForm: $("#credentialForm"),
    credentialDialogTitle: $("#credentialDialogTitle"),
    credentialIdInput: $("#credentialIdInput"),
    credentialNameInput: $("#credentialNameInput"),
    credentialUsernameInput: $("#credentialUsernameInput"),
    credentialPasswordInput: $("#credentialPasswordInput"),
    credentialNotesInput: $("#credentialNotesInput"),
    credentialShowButton: $("#credentialShowButton"),
    credentialCloseButton: $("#credentialCloseButton"),
    credentialCancelButton: $("#credentialCancelButton"),

    confirmDialog: $("#confirmDialog"),
    confirmTitle: $("#confirmTitle"),
    confirmText: $("#confirmText"),
    confirmButton: $("#confirmButton"),

    toastArea: $("#toastArea")
  };

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function showToast(message, type = "") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastArea.append(toast);

    window.setTimeout(() => toast.remove(), 3200);
  }

  function bytesToBase64(bytes) {
    let result = "";

    bytes.forEach((byte) => {
      result += String.fromCharCode(byte);
    });

    return btoa(result);
  }

  function base64ToBytes(base64) {
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);

    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index);
    }

    return bytes;
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function randomIndex(max) {
    const maxAllowed = Math.floor(256 / max) * max;
    const byte = new Uint8Array(1);

    do {
      crypto.getRandomValues(byte);
    } while (byte[0] >= maxAllowed);

    return byte[0] % max;
  }

  function secureShuffle(items) {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const newIndex = randomIndex(index + 1);
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    }

    return copy;
  }

  function generatePassword() {
    const groups = [];

    if (elements.uppercaseInput.checked) groups.push(CHARSETS.uppercase);
    if (elements.lowercaseInput.checked) groups.push(CHARSETS.lowercase);
    if (elements.numbersInput.checked) groups.push(CHARSETS.numbers);
    if (elements.symbolsInput.checked) groups.push(CHARSETS.symbols);

    if (!groups.length) {
      groups.push(CHARSETS.lowercase);
      elements.lowercaseInput.checked = true;
    }

    const requestedLength = Number(elements.lengthInput.value);
    const length = Math.max(requestedLength, groups.length);
    const pool = groups.join("");
    const password = [];

    groups.forEach((group) => {
      password.push(group[randomIndex(group.length)]);
    });

    while (password.length < length) {
      password.push(pool[randomIndex(pool.length)]);
    }

    elements.generatedPassword.textContent = secureShuffle(password).join("");
    elements.lengthOutput.textContent = String(length);
  }

  function applyPreset(name) {
    document.querySelectorAll(".preset").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === name);
    });

    if (name === "balanced") {
      elements.lengthInput.value = 20;
      elements.uppercaseInput.checked = true;
      elements.lowercaseInput.checked = true;
      elements.numbersInput.checked = true;
      elements.symbolsInput.checked = true;
      elements.ambiguousInput.checked = true;
    }

    if (name === "easy") {
      elements.lengthInput.value = 18;
      elements.uppercaseInput.checked = true;
      elements.lowercaseInput.checked = true;
      elements.numbersInput.checked = true;
      elements.symbolsInput.checked = false;
      elements.ambiguousInput.checked = true;
    }

    if (name === "maximum") {
      elements.lengthInput.value = 32;
      elements.uppercaseInput.checked = true;
      elements.lowercaseInput.checked = true;
      elements.numbersInput.checked = true;
      elements.symbolsInput.checked = true;
      elements.ambiguousInput.checked = false;
    }

    generatePassword();
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, "success");
    } catch {
      showToast("Il browser ha bloccato la copia.", "error");
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains(CREDENTIALS_STORE)) {
          database.createObjectStore(CREDENTIALS_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        state.database = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function store(name, mode = "readonly") {
    return state.database.transaction(name, mode).objectStore(name);
  }

  async function getSettings() {
    const record = await requestPromise(store(SETTINGS_STORE).get("vault"));
    return record ? record.value : null;
  }

  async function saveSettings(value) {
    await requestPromise(
      store(SETTINGS_STORE, "readwrite").put({
        key: "vault",
        value
      })
    );
  }

  async function getRecords() {
    return requestPromise(store(CREDENTIALS_STORE).getAll());
  }

  async function saveRecord(record) {
    return requestPromise(store(CREDENTIALS_STORE, "readwrite").put(record));
  }

  async function removeRecord(id) {
    return requestPromise(store(CREDENTIALS_STORE, "readwrite").delete(id));
  }

  async function clearDatabase() {
    return new Promise((resolve, reject) => {
      const transaction = state.database.transaction(
        [SETTINGS_STORE, CREDENTIALS_STORE],
        "readwrite"
      );

      transaction.objectStore(SETTINGS_STORE).clear();
      transaction.objectStore(CREDENTIALS_STORE).clear();

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: base64ToBytes(salt),
        iterations: 310000,
        hash: "SHA-256"
      },
      baseKey,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(text, key) {
    const iv = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(text)
    );

    return {
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decrypt(payload, key) {
    const value = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(payload.iv)
      },
      key,
      base64ToBytes(payload.data)
    );

    return decoder.decode(value);
  }

  async function createVault(password) {
    const salt = bytesToBase64(randomBytes(16));
    const key = await deriveKey(password, salt);
    const verification = await encrypt("password-configurator-verification", key);

    state.settings = {
      version: 1,
      salt,
      verification,
      createdAt: new Date().toISOString()
    };

    await saveSettings(state.settings);
    state.key = key;
    state.credentials = [];

    updateVaultInterface();
    renderCredentials();
    resetInactivityTimer();
    showToast("Vault cifrato creato.", "success");
  }

  async function unlockVault(password) {
    const key = await deriveKey(password, state.settings.salt);
    const verification = await decrypt(state.settings.verification, key);

    if (verification !== "password-configurator-verification") {
      throw new Error("Master password non corretta.");
    }

    state.key = key;
    await loadCredentials();
    updateVaultInterface();
    renderCredentials();
    resetInactivityTimer();
    showToast("Vault sbloccato.", "success");
  }

  function lockVault(showMessage = true) {
    state.key = null;
    state.credentials = [];
    clearTimeout(state.inactivityTimer);
    updateVaultInterface();

    if (showMessage) {
      showToast("Vault bloccato.", "success");
    }
  }

  function resetInactivityTimer() {
    if (!state.key) return;

    clearTimeout(state.inactivityTimer);

    state.inactivityTimer = window.setTimeout(() => {
      lockVault(false);
      showToast("Vault bloccato dopo 5 minuti di inattività.");
    }, 5 * 60 * 1000);
  }

  async function loadCredentials() {
    const records = await getRecords();
    const credentials = [];

    for (const record of records) {
      try {
        const content = await decrypt(record.payload, state.key);
        credentials.push(JSON.parse(content));
      } catch {
        showToast("Una credenziale non può essere letta.", "error");
      }
    }

    state.credentials = credentials.sort((first, second) =>
      first.name.localeCompare(second.name, "it")
    );
  }

  function updateVaultInterface() {
    const unlocked = Boolean(state.key);

    elements.vaultStatus.classList.toggle("unlocked", unlocked);
    elements.vaultStatusText.textContent = unlocked ? "Vault sbloccato" : "Vault bloccato";
    elements.lockButton.disabled = !unlocked;
    elements.addCredentialButton.disabled = !unlocked;

    elements.vaultLocked.classList.toggle("hidden", unlocked);
    elements.vaultUnlocked.classList.toggle("hidden", !unlocked);

    if (!unlocked) {
      const exists = Boolean(state.settings);

      elements.vaultTitle.textContent = exists
        ? "Sblocca il vault locale"
        : "Configura il vault locale";

      elements.vaultDescription.textContent = exists
        ? "Inserisci la master password per leggere le credenziali cifrate su questo dispositivo."
        : "Crea una master password per cifrare le credenziali salvate su questo dispositivo.";

      elements.openVaultButton.textContent = exists ? "Sblocca vault" : "Configura vault";
    }
  }

  function showMasterDialog(mode) {
    state.masterMode = mode;
    elements.masterForm.reset();
    elements.masterError.textContent = "";
    elements.masterError.classList.add("hidden");

    const setup = mode === "setup";

    elements.masterDialogLabel.textContent = setup
      ? "CRITTOGRAFIA LOCALE"
      : "SBLOCCA VAULT";

    elements.masterDialogTitle.textContent = setup
      ? "Configura il vault"
      : "Sblocca il vault";

    elements.masterDialogText.textContent = setup
      ? "La master password non viene salvata e non può essere recuperata."
      : "La master password viene usata solo localmente per sbloccare le credenziali cifrate.";

    elements.masterConfirmGroup.classList.toggle("hidden", !setup);
    elements.masterConfirmInput.required = setup;
    elements.masterPasswordInput.autocomplete = setup ? "new-password" : "current-password";
    elements.masterSubmitButton.textContent = setup ? "Crea vault cifrato" : "Sblocca vault";

    elements.masterDialog.showModal();
    window.setTimeout(() => elements.masterPasswordInput.focus(), 50);
  }

  function showCredentialDialog(credential = null) {
    if (!state.key) {
      showToast("Sblocca il vault prima di salvare.", "error");
      return;
    }

    elements.credentialForm.reset();
    elements.credentialDialogTitle.textContent = credential ? "Modifica credenziale" : "Salva password";
    elements.credentialIdInput.value = credential?.id ?? "";
    elements.credentialNameInput.value = credential?.name ?? "";
    elements.credentialUsernameInput.value = credential?.username ?? "";
    elements.credentialPasswordInput.value = credential?.password ?? elements.generatedPassword.textContent;
    elements.credentialNotesInput.value = credential?.notes ?? "";
    elements.credentialPasswordInput.type = "password";
    elements.credentialShowButton.textContent = "Mostra";

    elements.credentialDialog.showModal();
    window.setTimeout(() => elements.credentialNameInput.focus(), 50);
  }

  async function saveCredential(event) {
    event.preventDefault();

    const existingId = elements.credentialIdInput.value;
    const name = elements.credentialNameInput.value.trim();
    const username = elements.credentialUsernameInput.value.trim();
    const password = elements.credentialPasswordInput.value;
    const notes = elements.credentialNotesInput.value.trim();

    if (!name || !password) {
      showToast("Servizio e password sono obbligatori.", "error");
      return;
    }

    const existing = state.credentials.find((credential) => credential.id === existingId);

    const credential = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      username,
      password,
      notes,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = await encrypt(JSON.stringify(credential), state.key);

    await saveRecord({
      id: credential.id,
      payload,
      updatedAt: credential.updatedAt
    });

    c
