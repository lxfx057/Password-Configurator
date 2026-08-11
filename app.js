(() => {
  "use strict";

  const DATABASE_NAME = "password-configurator";
  const DATABASE_VERSION = 1;
  const SETTINGS_STORE = "settings";
  const CREDENTIALS_STORE = "credentials";

  const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
  const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*+-_=?.";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const state = {
    database: null,
    settings: null,
    vaultKey: null,
    credentials: [],
    masterDialogMode: "setup",
    timeout: null
  };

  const $ = (selector) => document.querySelector(selector);

  const ui = {
    vaultStatusButton: $("#vaultStatusButton"),
    vaultStatusText: $("#vaultStatusText"),

    generatedPassword: $("#generatedPassword"),
    regenerateButton: $("#regenerateButton"),
    copyGeneratedButton: $("#copyGeneratedButton"),
    lengthRange: $("#lengthRange"),
    lengthValue: $("#lengthValue"),
    uppercaseToggle: $("#uppercaseToggle"),
    numbersToggle: $("#numbersToggle"),
    symbolsToggle: $("#symbolsToggle"),
    saveGeneratedButton: $("#saveGeneratedButton"),

    lockVaultButton: $("#lockVaultButton"),
    vaultLocked: $("#vaultLocked"),
    vaultUnlocked: $("#vaultUnlocked"),
    vaultLockedTitle: $("#vaultLockedTitle"),
    vaultLockedText: $("#vaultLockedText"),
    openVaultButton: $("#openVaultButton"),
    searchInput: $("#searchInput"),
    addCredentialButton: $("#addCredentialButton"),
    credentialList: $("#credentialList"),
    exportBackupButton: $("#exportBackupButton"),
    importBackupInput: $("#importBackupInput"),

    masterDialog: $("#masterDialog"),
    masterForm: $("#masterForm"),
    closeMasterDialog: $("#closeMasterDialog"),
    masterKicker: $("#masterKicker"),
    masterTitle: $("#masterTitle"),
    masterDescription: $("#masterDescription"),
    masterPasswordInput: $("#masterPasswordInput"),
    masterConfirmationGroup: $("#masterConfirmationGroup"),
    confirmMasterPasswordInput: $("#confirmMasterPasswordInput"),
    masterError: $("#masterError"),
    masterSubmitButton: $("#masterSubmitButton"),

    credentialDialog: $("#credentialDialog"),
    credentialForm: $("#credentialForm"),
    closeCredentialDialog: $("#closeCredentialDialog"),
    cancelCredentialButton: $("#cancelCredentialButton"),
    credentialDialogTitle: $("#credentialDialogTitle"),
    credentialIdInput: $("#credentialIdInput"),
    serviceInput: $("#serviceInput"),
    usernameInput: $("#usernameInput"),
    credentialPasswordInput: $("#credentialPasswordInput"),
    notesInput: $("#notesInput"),
    showCredentialPasswordButton: $("#showCredentialPasswordButton"),

    confirmDialog: $("#confirmDialog"),
    confirmDialogTitle: $("#confirmDialogTitle"),
    confirmDialogText: $("#confirmDialogText"),
    confirmDialogButton: $("#confirmDialogButton"),

    toastContainer: $("#toastContainer")
  };

  function showToast(message, type = "") {
    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = message;
    ui.toastContainer.append(toast);

    window.setTimeout(() => toast.remove(), 3300);
  }

  function bytesToBase64(bytes) {
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function randomIndex(maximum) {
    const allowed = Math.floor(256 / maximum) * maximum;
    const byte = new Uint8Array(1);

    do {
      crypto.getRandomValues(byte);
    } while (byte[0] >= allowed);

    return byte[0] % maximum;
  }

  function secureShuffle(values) {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = randomIndex(index + 1);
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }

    return copy;
  }

  function generatePassword() {
    const groups = [LOWERCASE];

    if (ui.uppercaseToggle.checked) groups.push(UPPERCASE);
    if (ui.numbersToggle.checked) groups.push(NUMBERS);
    if (ui.symbolsToggle.checked) groups.push(SYMBOLS);

    const desiredLength = Number(ui.lengthRange.value);
    const finalLength = Math.max(desiredLength, groups.length);
    const allCharacters = groups.join("");
    const password = [];

    groups.forEach((group) => {
      password.push(group[randomIndex(group.length)]);
    });

    while (password.length < finalLength) {
      password.push(allCharacters[randomIndex(allCharacters.length)]);
    }

    ui.generatedPassword.textContent = secureShuffle(password).join("");
    ui.lengthValue.textContent = String(finalLength);
  }

  async function copyToClipboard(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      showToast(successMessage, "success");
    } catch {
      showToast("Il browser non ha consentito la copia.", "error");
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

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

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getStore(name, mode = "readonly") {
    return state.database.transaction(name, mode).objectStore(name);
  }

  async function loadSettings() {
    const record = await requestToPromise(getStore(SETTINGS_STORE).get("vault"));
    return record ? record.value : null;
  }

  async function saveSettings(settings) {
    return requestToPromise(
      getStore(SETTINGS_STORE, "readwrite").put({
        key: "vault",
        value: settings
      })
    );
  }

  async function getAllCredentialRecords() {
    return requestToPromise(getStore(CREDENTIALS_STORE).getAll());
  }

  async function saveCredentialRecord(record) {
    return requestToPromise(
      getStore(CREDENTIALS_STORE, "readwrite").put(record)
    );
  }

  async function deleteCredentialRecord(id) {
    return requestToPromise(
      getStore(CREDENTIALS_STORE, "readwrite").delete(id)
    );
  }

  async function clearVaultData() {
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

  async function deriveVaultKey(masterPassword, salt) {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(masterPassword),
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

  async function encryptText(text, key) {
    const iv = randomBytes(12);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(text)
    );

    return {
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decryptText(payload, key) {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(payload.iv)
      },
      key,
      base64ToBytes(payload.data)
    );

    return decoder.decode(decrypted);
  }

  async function createVault(masterPassword) {
    const salt = bytesToBase64(randomBytes(16));
    const vaultKey = await deriveVaultKey(masterPassword, salt);

    const verification = await encryptText(
      "password-configurator-verification",
      vaultKey
    );

    state.settings = {
      version: 1,
      salt,
      verification,
      createdAt: new Date().toISOString()
    };

    await saveSettings(state.settings);

    state.vaultKey = vaultKey;
    state.credentials = [];

    updateVaultInterface();
    renderCredentials();
    resetLockTimer();
    showToast("Vault creato e cifrato.", "success");
  }

  async function unlockVault(masterPassword) {
    const vaultKey = await deriveVaultKey(masterPassword, state.settings.salt);

    const verification = await decryptText(
      state.settings.verification,
      vaultKey
    );

    if (verification !== "password-configurator-verification") {
      throw new Error("Master password non corretta.");
    }

    state.vaultKey = vaultKey;
    await loadCredentials();

    updateVaultInterface();
    renderCredentials();
    resetLockTimer();
    showToast("Vault sbloccato.", "success");
  }

  async function loadCredentials() {
    const records = await getAllCredentialRecords();
    const credentials = [];

    for (const record of records) {
      try {
        const plainText = await decryptText(record.payload, state.vaultKey);
        credentials.push(JSON.parse(plainText));
      } catch {
        showToast("Una credenziale non può essere letta.", "error");
      }
    }

    state.credentials = credentials.sort((first, second) =>
      first.service.localeCompare(second.service, "it")
    );
  }

  function lockVault(showMessage = true) {
    state.vaultKey = null;
    state.credentials = [];

    window.clearTimeout(state.timeout);
    updateVaultInterface();

    if (showMessage) {
      showToast("Vault bloccato.", "success");
    }
  }

  function resetLockTimer() {
    if (!state.vaultKey) return;

    window.clearTimeout(state.timeout);

    state.timeout = window.setTimeout(() => {
      lockVault(false);
      showToast("Vault bloccato dopo 5 minuti di inattività.");
    }, 5 * 60 * 1000);
  }

  function updateVaultInterface() {
    const unlocked = Boolean(state.vaultKey);
    const vaultExists = Boolean(state.settings);

    ui.vaultStatusButton.classList.toggle("unlocked", unlocked);
    ui.vaultStatusText.textContent = unlocked ? "Sbloccato" : "Vault";

    ui.lockVaultButton.classList.toggle("hidden", !unlocked);
    ui.vaultLocked.classList.toggle("hidden", unlocked);
    ui.vaultUnlocked.classList.toggle("hidden", !unlocked);

    if (!unlocked) {
      ui.vaultLockedTitle.textContent = vaultExists
        ? "Sblocca il tuo vault"
        : "Crea il tuo vault";

      ui.vaultLockedText.textContent = vaultExists
        ? "Inserisci la master password per leggere le credenziali cifrate."
        : "Imposta una master password: le credenziali resteranno cifrate localmente nel browser.";

      ui.openVaultButton.textContent = vaultExists ? "Sblocca vault" : "Inizia";
    }
  }

  function openMasterDialog(mode) {
    state.masterDialogMode = mode;

    const setup = mode === "setup";

    ui.masterForm.reset();
    ui.masterError.textContent = "";
    ui.masterError.classList.add("hidden");

    ui.masterKicker.textContent = setup
      ? "PROTEZIONE LOCALE"
      : "SBLOCCA VAULT";

    ui.masterTitle.textContent = setup
      ? "Crea il vault"
      : "Sblocca il vault";

    ui.masterDescription.textContent = setup
      ? "La master password non viene salvata e non può essere recuperata."
      : "La master password viene usata solo localmente per decifrare il vault.";

    ui.masterConfirmationGroup.classList.toggle("hidden", !setup);
    ui.confirmMasterPasswordInput.required = setup;
    ui.masterPasswordInput.autocomplete = setup
      ? "new-password"
      : "current-password";

    ui.masterSubmitButton.textContent = setup
      ? "Crea vault"
      : "Sblocca vault";

    ui.masterDialog.showModal();
    window.setTimeout(() => ui.masterPasswordInput.focus(), 50);
  }

  function openCredentialDialog(credential = null) {
    if (!state.vaultKey) {
      showToast("Sblocca il vault prima di salvare.", "error");
      return;
    }

    ui.credentialForm.reset();

    ui.credentialDialogTitle.textContent = credential
      ? "Modifica credenziale"
      : "Salva password";

    ui.credentialIdInput.value = credential?.id || "";
    ui.serviceInput.value = credential?.service || "";
    ui.usernameInput.value = credential?.username || "";
    ui.credentialPasswordInput.value =
      credential?.password || ui.generatedPassword.textContent;
    ui.notesInput.value = credential?.notes || "";
    ui.credentialPasswordInput.type = "password";
    ui.showCredentialPasswordButton.textContent = "Mostra";

    ui.credentialDialog.showModal();
    window.setTimeout(() => ui.serviceInput.focus(), 50);
  }

  async function saveCredential(event) {
    event.preventDefault();

    if (!state.vaultKey) {
      showToast("Vault bloccato.", "error");
      return;
    }

    const existingId = ui.credentialIdInput.value;
    const service = ui.serviceInput.value.trim();
    const username = ui.usernameInput.value.trim();
    const password = ui.credentialPasswordInput.value;
    const notes = ui.notesInput.value.trim();

    if (!service || !password) {
      showToast("Servizio e password sono obbligatori.", "error");
      return;
    }

    const existing = state.credentials.find(
      (credential) => credential.id === existingId
    );

    const credential = {
      id: existing?.id || crypto.randomUUID(),
      service,
      username,
      password,
      notes,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = await encryptText(
      JSON.stringify(credential),
      state.vaultKey
    );

    await saveCredentialRecord({
      id: credential.id,
      payload,
      updatedAt: credential.updatedAt
    });

    const index = state.credentials.findIndex(
      (item) => item.id === credential.id
    );

    if (index === -1) {
      state.credentials.push(credential);
    } else {
      state.credentials[index] = credential;
    }

    state.credentials.sort((first, second) =>
      first.service.localeCompare(second.service, "it")
    );

    ui.credentialDialog.close();
    renderCredentials();
    resetLockTimer();

    showToast(
      existing ? "Credenziale aggiornata." : "Credenziale salvata e cifrata.",
      "success"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderCredentials() {
    if (!state.vaultKey) return;

    const query = ui.searchInput.value.trim().toLowerCase();

    const visibleCredentials = state.credentials.filter((credential) => {
      const text = `${credential.service} ${credential.username} ${credential.notes}`;
      return text.toLowerCase().includes(query);
    });

    if (!visibleCredentials.length) {
      ui.credentialList.innerHTML = `
        <div class="empty-vault">
          ${
            query
              ? "Nessuna credenziale trovata."
              : "Il vault è vuoto. Salva una password generata o aggiungi una credenziale."
          }
        </div>
      `;
      return;
    }

    ui.credentialList.innerHTML = visibleCredentials
      .map(
        (credential) => `
          <article class="credential">
            <div>
              <div class="credential-name">${escapeHtml(credential.service)}</div>
              <div class="credential-user">
                ${escapeHtml(
                  credential.username || "Nessun username salvato"
                )}
              </div>
            </div>

            <div class="credential-actions">
              <button class="small-action" type="button" data-copy="${credential.id}">
                Copia
              </button>

              <button class="small-action" type="button" data-edit="${credential.id}">
                Modifica
              </button>

              <button class="small-action delete" type="button" data-delete="${credential.id}">
                Elimina
              </button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function askConfirmation(title, text, actionText) {
    ui.confirmDialogTitle.textContent = title;
    ui.confirmDialogText.textContent = text;
    ui.confirmDialogButton.textContent = actionText;

    ui.confirmDialog.showModal();

    return new Promise((resolve) => {
      ui.confirmDialog.addEventListener(
        "close",
        () => resolve(ui.confirmDialog.returnValue === "confirm"),
        { once: true }
      );
    });
  }

  async function deleteCredential(id) {
    const credential = state.credentials.find((item) => item.id === id);

    if (!credential) return;

    const confirmed = await askConfirmation(
      "Eliminare credenziale?",
      `“${credential.service}” verrà eliminata definitivamente dal vault locale.`,
      "Elimina"
    );

    if (!confirmed) return;

    await deleteCredentialRecord(id);

    state.credentials = state.credentials.filter((item) => item.id !== id);

    renderCredentials();
    resetLockTimer();
    showToast("Credenziale eliminata.", "success");
  }

  async function exportBackup() {
    const credentialRecords = await getAllCredentialRecords();

    const backup = {
      app: "Password Configurator",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      credentials: credentialRecords
    };

    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `password-vault-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    resetLockTimer();
    showToast("Backup cifrato esportato.", "success");
  }

  async function importBackup(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const validBackup =
        backup?.app === "Password Configurator" &&
        backup?.version === 1 &&
        backup?.settings?.salt &&
        backup?.settings?.verification &&
        Array.isArray(backup?.credentials);

      if (!validBackup) {
        throw new Error("Il file selezionato non è un backup valido.");
      }

      const confirmed = await askConfirmation(
        "Importare backup?",
        "Il vault presente su questo dispositivo verrà sostituito dal backup selezionato.",
        "Importa"
      );

      if (!confirmed) return;

      await clearVaultData();
      await saveSettings(backup.settings);

      for (const record of backup.credentials) {
        await saveCredentialRecord(record);
      }

      state.settings = backup.settings;
      lockVault(false);
      updateVaultInterface();

      showToast(
        "Backup importato. Sblocca il vault con la master password del backup.",
        "success"
      );
    } catch (error) {
      showToast(
        error.message || "Non è stato possibile importare il backup.",
        "error"
      );
    } finally {
      ui.importBackupInput.value = "";
    }
  }

  function bindEvents() {
    ui.regenerateButton.addEventListener("click", generatePassword);

    ui.copyGeneratedButton.addEventListener("click", () => {
      copyToClipboard(ui.generatedPassword.textContent, "Password copiata.");
    });

    [
      ui.lengthRange,
      ui.uppercaseToggle,
      ui.numbersToggle,
      ui.symbolsToggle
    ].forEach((input) => {
      input.addEventListener("input", generatePassword);
      input.addEventListener("change", generatePassword);
    });

    ui.saveGeneratedButton.addEventListener("click", () => {
      openCredentialDialog();
    });

    ui.vaultStatusButton.addEventListener("click", () => {
      document.querySelector("#vault").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    ui.openVaultButton.addEventListener("click", () => {
      openMasterDialog(state.settings ? "unlock" : "setup");
    });

    ui.closeMasterDialog.addEventListener("click", () => {
      ui.masterDialog.close();
    });

    ui.masterForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const masterPassword = ui.masterPasswordInput.value;
      const confirmation = ui.confirmMasterPasswordInput.value;

      try {
        if (masterPassword.length < 10) {
          throw new Error("Usa almeno 10 caratteri.");
        }

        if (
          state.masterDialogMode === "setup" &&
          masterPassword !== confirmation
        ) {
          throw new Error("Le due master password non coincidono.");
        }

        if (state.masterDialogMode === "setup") {
          await createVault(masterPassword);
        } else {
          await unlockVault(masterPassword);
        }

        ui.masterDialog.close();
      } catch (error) {
        ui.masterError.textContent =
          error.message || "Operazione non riuscita.";
        ui.masterError.classList.remove("hidden");
      }
    });

    ui.lockVaultButton.addEventListener("click", () => {
      lockVault();
    });

    ui.searchInput.addEventListener("input", renderCredentials);

    ui.addCredentialButton.addEventListener("click", () => {
      openCredentialDialog();
    });

    ui.closeCredentialDialog.addEventListener("click", () => {
      ui.credentialDialog.close();
    });

    ui.cancelCredentialButton.addEventListener("click", () => {
      ui.credentialDialog.close();
    });

    ui.showCredentialPasswordButton.addEventListener("click", () => {
      const visible = ui.credentialPasswordInput.type === "text";

      ui.credentialPasswordInput.type = visible ? "password" : "text";
      ui.showCredentialPasswordButton.textContent = visible
        ? "Mostra"
        : "Nascondi";
    });

    ui.credentialForm.addEventListener("submit", saveCredential);

    ui.credentialList.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copy;
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (copyId) {
        const credential = state.credentials.find((item) => item.id === copyId);

        if (credential) {
          await copyToClipboard(
            credential.password,
            "Password copiata dal vault."
          );
          resetLockTimer();
        }
      }

      if (editId) {
        const credential = state.credentials.find((item) => item.id === editId);

        if (credential) openCredentialDialog(credential);
      }

      if (deleteId) {
        await deleteCredential(deleteId);
      }
    });

    ui.exportBackupButton.addEventListener("click", exportBackup);

    ui.importBackupInput.addEventListener("change", (event) => {
      importBackup(event.target.files[0]);
    });

    ["click", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, resetLockTimer, { passive: true });
    });
  }

  async function initialize() {
    try {
      if (!window.indexedDB) {
        throw new Error("Il browser non supporta IndexedDB.");
      }

      if (!window.crypto?.subtle) {
        throw new Error(
          "Apri il sito da Vercel tramite HTTPS per usare la cifratura."
        );
      }

      await openDatabase();
      state.settings = await loadSettings();

      generatePassword();
      updateVaultInterface();
      bindEvents();

      fetch("/api/health").catch(() => {});
    } catch (error) {
      showToast(error.message || "Impossibile avviare l'app.", "error");
    }
  }

  initialize();
})();
