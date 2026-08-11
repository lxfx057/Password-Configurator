(() => {
  const DB_NAME = "password-configurator-vault";
  const DB_VERSION = 1;
  const SETTINGS = "settings";
  const CREDENTIALS = "credentials";

  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghijkmnopqrstuvwxyz";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*+-_=?.";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const state = {
    db: null,
    settings: null,
    key: null,
    items: [],
    dialogMode: "setup",
    inactivityTimer: null
  };

  const $ = (selector) => document.querySelector(selector);

  const ui = {
    password: $("#generatedPassword"),
    length: $("#lengthInput"),
    lengthValue: $("#lengthValue"),
    uppercase: $("#uppercaseInput"),
    numbers: $("#numbersInput"),
    symbols: $("#symbolsInput"),
    regenerate: $("#regenerateButton"),
    copy: $("#copyButton"),
    save: $("#saveButton"),

    vaultButton: $("#vaultButton"),
    vaultButtonText: $("#vaultButtonText"),
    lock: $("#lockButton"),
    vaultLocked: $("#vaultLockedView"),
    vaultOpen: $("#vaultOpenView"),
    vaultTitle: $("#vaultStateTitle"),
    vaultText: $("#vaultStateText"),
    openVault: $("#openVaultButton"),
    search: $("#searchInput"),
    list: $("#credentialList"),
    add: $("#addButton"),
    export: $("#exportButton"),
    import: $("#importInput"),

    masterDialog: $("#masterDialog"),
    masterForm: $("#masterForm"),
    masterLabel: $("#masterLabel"),
    masterTitle: $("#masterTitle"),
    masterDescription: $("#masterDescription"),
    masterInput: $("#masterInput"),
    masterConfirmWrap: $("#masterConfirmWrap"),
    masterConfirm: $("#masterConfirmInput"),
    masterSubmit: $("#masterSubmit"),
    masterError: $("#masterError"),
    closeMaster: $("#closeMasterDialog"),

    credentialDialog: $("#credentialDialog"),
    credentialForm: $("#credentialForm"),
    credentialTitle: $("#credentialTitle"),
    credentialId: $("#credentialId"),
    service: $("#serviceInput"),
    username: $("#usernameInput"),
    credentialPassword: $("#passwordInput"),
    notes: $("#notesInput"),
    showPassword: $("#showPasswordButton"),
    closeCredential: $("#closeCredentialDialog"),
    cancelCredential: $("#cancelCredentialButton"),

    confirmDialog: $("#confirmDialog"),
    confirmTitle: $("#confirmTitle"),
    confirmMessage: $("#confirmMessage"),
    confirmAction: $("#confirmAction"),

    toasts: $("#toastContainer")
  };

  function toast(message, type = "") {
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    ui.toasts.append(item);
    setTimeout(() => item.remove(), 3200);
  }

  function bytesToBase64(bytes) {
    let value = "";
    bytes.forEach((byte) => {
      value += String.fromCharCode(byte);
    });
    return btoa(value);
  }

  function base64ToBytes(value) {
    const text = atob(value);
    const bytes = new Uint8Array(text.length);

    for (let i = 0; i < text.length; i += 1) {
      bytes[i] = text.charCodeAt(i);
    }

    return bytes;
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function randomIndex(max) {
    const limit = Math.floor(256 / max) * max;
    const bytes = new Uint8Array(1);

    do {
      crypto.getRandomValues(bytes);
    } while (bytes[0] >= limit);

    return bytes[0] % max;
  }

  function shuffle(values) {
    const result = [...values];

    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  function generatePassword() {
    const groups = [LOWER];

    if (ui.uppercase.checked) groups.push(UPPER);
    if (ui.numbers.checked) groups.push(NUMBERS);
    if (ui.symbols.checked) groups.push(SYMBOLS);

    const length = Math.max(Number(ui.length.value), groups.length);
    const all = groups.join("");
    const password = [];

    groups.forEach((group) => {
      password.push(group[randomIndex(group.length)]);
    });

    while (password.length < length) {
      password.push(all[randomIndex(all.length)]);
    }

    ui.password.textContent = shuffle(password).join("");
    ui.lengthValue.textContent = String(length);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(CREDENTIALS)) {
          db.createObjectStore(CREDENTIALS, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        state.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  function requestAsPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function objectStore(name, mode = "readonly") {
    return state.db.transaction(name, mode).objectStore(name);
  }

  async function getSettings() {
    const record = await requestAsPromise(objectStore(SETTINGS).get("vault"));
    return record ? record.value : null;
  }

  async function putSettings(value) {
    return requestAsPromise(
      objectStore(SETTINGS, "readwrite").put({ key: "vault", value })
    );
  }

  async function getAllRecords() {
    return requestAsPromise(objectStore(CREDENTIALS).getAll());
  }

  async function putRecord(record) {
    return requestAsPromise(objectStore(CREDENTIALS, "readwrite").put(record));
  }

  async function deleteRecord(id) {
    return requestAsPromise(objectStore(CREDENTIALS, "readwrite").delete(id));
  }

  async function clearVaultDatabase() {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction([SETTINGS, CREDENTIALS], "readwrite");
      tx.objectStore(SETTINGS).clear();
      tx.objectStore(CREDENTIALS).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deriveKey(masterPassword, saltBase64) {
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(masterPassword),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: base64ToBytes(saltBase64),
        iterations: 310000,
        hash: "SHA-256"
      },
      passwordKey,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(value, key) {
    const iv = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(value)
    );

    return {
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decrypt(payload, key) {
    const result = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.data)
    );

    return decoder.decode(result);
  }

  async function createVault(masterPassword) {
    const salt = bytesToBase64(randomBytes(16));
    const key = await deriveKey(masterPassword, salt);
    const verification = await encrypt("password-vault-ok", key);

    state.settings = {
      version: 1,
      salt,
      verification,
      createdAt: new Date().toISOString()
    };

    await putSettings(state.settings);
    state.key = key;
    state.items = [];
    updateVaultUi();
    renderList();
    resetTimer();
    toast("Vault creato e cifrato.", "success");
  }

  async function unlockVault(masterPassword) {
    const key = await deriveKey(masterPassword, state.settings.salt);
    const result = await decrypt(state.settings.verification, key);

    if (result !== "password-vault-ok") {
      throw new Error("Master password non corretta.");
    }

    state.key = key;
    await loadItems();
    updateVaultUi();
    renderList();
    resetTimer();
    toast("Vault sbloccato.", "success");
  }

  async function loadItems() {
    const records = await getAllRecords();
    const items = [];

    for (const record of records) {
      try {
        items.push(JSON.parse(await decrypt(record.payload, state.key)));
      } catch {
        toast("Non è stato possibile leggere una credenziale.", "error");
      }
    }

    state.items = items.sort((a, b) => a.service.localeCompare(b.service, "it"));
  }

  function lockVault(message = true) {
    state.key = null;
    state.items = [];
    clearTimeout(state.inactivityTimer);
    updateVaultUi();

    if (message) toast("Vault bloccato.", "success");
  }

  function resetTimer() {
    if (!state.key) return;

    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = setTimeout(() => {
      lockVault(false);
      toast("Vault bloccato per inattività.");
    }, 5 * 60 * 1000);
  }

  function updateVaultUi() {
    const unlocked = Boolean(state.key);

    ui.vaultButton.classList.toggle("unlocked", unlocked);
    ui.vaultButtonText.textContent = unlocked ? "Sbloccato" : "Vault";
    ui.lock.classList.toggle("hidden", !unlocked);
    ui.vaultLocked.classList.toggle("hidden", unlocked);
    ui.vaultOpen.classList.toggle("hidden", !unlocked);

    if (!unlocked) {
      const hasVault = Boolean(state.settings);

      ui.vaultTitle.textContent = hasVault
        ? "Sblocca il tuo vault"
        : "Configura il tuo vault";

      ui.vaultText.textContent = hasVault
        ? "Inserisci la master password per accedere alle credenziali cifrate."
        : "Imposta una master password per salvare credenziali cifrate in locale.";

      ui.openVaultButton.textContent = hasVault ? "Sblocca" : "Inizia";
    }
  }

  function openMasterDialog(mode) {
    state.dialogMode = mode;
    const setup = mode === "setup";

    ui.masterForm.reset();
    ui.masterError.textContent = "";
    ui.masterError.classList.add("hidden");

    ui.masterLabel.textContent = setup ? "PROTEZIONE LOCALE" : "SBLOCCA VAULT";
    ui.masterTitle.textContent = setup ? "Crea il vault" : "Sblocca il vault";
    ui.masterDescription.textContent = setup
      ? "La master password protegge le credenziali. Non viene salvata e non può essere recuperata."
      : "La master password viene usata solo in questo browser per decifrare il vault.";

    ui.masterConfirmWrap.classList.toggle("hidden", !setup);
    ui.masterConfirm.required = setup;
    ui.masterInput.autocomplete = setup ? "new-password" : "current-password";
    ui.masterSubmit.textContent = setup ? "Crea vault" : "Sblocca vault";

    ui.masterDialog.showModal();
    setTimeout(() => ui.masterInput.focus(), 50);
  }

  function openCredentialDialog(item = null) {
    if (!state.key) {
      toast("Prima sblocca il vault.", "error");
      return;
    }

    ui.credentialForm.reset();
    ui.credentialTitle.textContent = item ? "Modifica credenziale" : "Salva password";
    ui.credentialId.value = item?.id ?? "";
    ui.service.value = item?.service ?? "";
    ui.username.value = item?.username ?? "";
    ui.credentialPassword.value = item?.password ?? ui.password.textContent;
    ui.notes.value = item?.notes ?? "";
    ui.credentialPassword.type = "password";
    ui.showPassword.textContent = "Mostra";

    ui.credentialDialog.showModal();
    setTimeout(() => ui.service.focus(), 50);
  }

  async function saveCredential(event) {
    event.preventDefault();

    const service = ui.service.value.trim();
    const username = ui.username.value.trim();
    const password = ui.credentialPassword.value;
    const notes = ui.notes.value.trim();
    const currentId = ui.credentialId.value;

    if (!service || !password) {
      toast("Inserisci servizio e password.", "error");
      return;
    }

    const previous = state.items.find((item) => item.id === currentId);

    const item = {
      id: previous?.id ?? crypto.randomUUID(),
      service,
      username,
      password,
      notes,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = await encrypt(JSON.stringify(item), state.key);

    await putRecord({
      id: item.id,
      payload,
      updatedAt: item.updatedAt
    });

    const index = state.items.findIndex((saved) => saved.id === item.id);

    if (index === -1) state.items.push(item);
    else state.items[index] = item;

    state.items.sort((a, b) => a.service.localeCompare(b.service, "it"));

    ui.credentialDialog.close();
    renderList();
    resetTimer();
    toast(previous ? "Credenziale aggiornata." : "Credenziale salvata.", "success");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderList() {
    if (!state.key) return;

    const query = ui.search.value.trim().toLowerCase();

    const filtered = state.items.filter((item) =>
      `${item.service} ${item.username} ${item.notes}`.toLowerCase().includes(query)
    );

    if (!filtered.length) {
      ui.list.innerHTML = `
        <div class="empty-state">
          ${query ? "Nessuna credenziale trovata." : "Ancora nessuna credenziale salvata."}
        </div>
      `;
      return;
    }

    ui.list.innerHTML = filtered
      .map(
        (item) => `
          <article class="credential">
            <div>
              <div class="credential-name">${escapeHtml(item.service)}</div>
              <div class="credential-user">
                ${escapeHtml(item.username || "Nessun username salvato")}
              </div>
            </div>

            <div class="credential-actions">
              <button class="small-action" type="button" data-copy="${item.id}">Copia</button>
              <button class="small-action" type="button" data-edit="${item.id}">Modifica</button>
              <button class="small-action delete" type="button" data-delete="${item.id}">Elimina</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  async function askConfirmation(title, message, actionText) {
    ui.confirmTitle.textContent = title;
    ui.confirmMessage.textContent = message;
    ui.confirmAction.textContent = actionText;
    ui.confirmDialog.showModal();

    return new Promise((resolve) => {
      ui.confirmDialog.addEventListener(
        "close",
        () => resolve(ui.confirmDialog.returnValue === "confirm"),
        { once: true }
      );
    });
  }

  async function deleteItem(id) {
    const item = state.items.find((saved) => saved.id === id);
    if (!item) return;

    const confirmed = await askConfirmation(
      "Eliminare credenziale?",
      `“${item.service}” verrà eliminata definitivamente dal vault locale.`,
      "Elimina"
    );

    if (!confirmed) return;

    await deleteRecord(id);
    state.items = state.items.filter((saved) => saved.id !== id);
    renderList();
    resetTimer();
    toast("Credenziale eliminata.", "success");
  }

  async function exportBackup() {
    const records = await getAllRecords();

    const backup = {
      app: "Password Configurator",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      credentials: records
    };

    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `password-vault-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    resetTimer();
    toast("Backup cifrato esportato.", "success");
  }

  async function importBackup(file) {
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());

      const valid =
        backup?.app === "Password Configurator" &&
        backup?.version === 1 &&
        backup?.settings?.salt &&
        backup?.settings?.verification &&
        Array.isArray(backup?.credentials);

      if (!valid) throw new Error("Backup non valido.");

      const confirmed = await askConfirmation(
        "Importare backup?",
        "Il vault attuale su questo dispositivo verrà sostituito.",
        "Importa"
      );

      if (!confirmed) return;

      await clearVaultDatabase();
      await putSettings(backup.settings);

      for (const record of backup.credentials) {
        await putRecord(record);
      }

      state.settings = backup.settings;
      lockVault(false);
      updateVaultUi();
      toast("Backup importato. Ora sbloccalo con la sua master password.", "success");
    } catch (error) {
      toast(error.message || "Importazione non riuscita.", "error");
    } finally {
      ui.import.value = "";
    }
  }

  function bindEvents() {
    ui.regenerate.addEventListener("click", generatePassword);
    ui.copy.addEventListener("click", () => copyPassword());

    [ui.length, ui.uppercase, ui.numbers, ui.symbols].forEach((input) => {
      input.addEventListener("input", generatePassword);
      input.addEventListener("change", generatePassword);
    });

    ui.save.addEventListener("click", () => openCredentialDialog());
    ui.add.addEventListener("click", () => openCredentialDialog());

    ui.vaultButton.addEventListener("click", () => {
      document.querySelector("#vaultSection").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    ui.openVault.addEventListener("click", () => {
      openMasterDialog(state.settings ? "unlock" : "setup");
    });

    ui.closeMaster.addEventListener("click", () => ui.masterDialog.close());

    ui.masterForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = ui.masterInput.value;
      const confirmation = ui.masterConfirm.value;

      try {
        if (password.length < 10) {
          throw new Error("Usa almeno 10 caratteri.");
        }

        if (state.dialogMode === "setup" && password !== confirmation) {
          throw new Error("Le master password non coincidono.");
        }

        if (state.dialogMode === "setup") {
          await createVault(password);
        } else {
          await unlockVault(password);
        }

        ui.masterDialog.close();
      } catch (error) {
        ui.masterError.textContent = error.message || "Operazione non riuscita.";
        ui.masterError.classList.remove("hidden");
      }
    });

    ui.lock.addEventListener("click", () => lockVault());
    ui.search.addEventListener("input", renderList);
    ui.export.addEventListener("click", exportBackup);
    ui.import.addEventListener("change", (event) => importBackup(event.target.files[0]));

    ui.closeCredential.addEventListener("click", () => ui.credentialDialog.close());
    ui.cancelCredential.addEventListener("click", () => ui.credentialDialog.close());

    ui.showPassword.addEventListener("click", () => {
      const visible = ui.credentialPassword.type === "text";
      ui.credentialPassword.type = visible ? "password" : "text";
      ui.showPassword.textContent = visible ? "Mostra" : "Nascondi";
    });

    ui.credentialForm.addEventListener("submit", saveCredential);

    ui.list.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copy;
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (copyId) {
        const item = state.items.find((saved) => saved.id === copyId);
        if (item) {
          await navigator.clipboard.writeText(item.password);
          toast("Password copiata.", "success");
          resetTimer();
        }
      }

      if (editId) {
        const item = state.items.find((saved) => saved.id === editId);
        if (item) openCredentialDialog(item);
      }

      if (deleteId) {
        await deleteItem(deleteId);
      }
    });

    ["click", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, resetTimer, { passive: true });
    });
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(ui.password.textContent);
      toast("Password copiata.", "success");
    } catch {
      toast("Copia non consentita dal browser.", "error");
    }
  }

  async function initialize() {
    try {
      if (!window.crypto?.subtle || !window.indexedDB) {
        throw new Error("Il browser non supporta le funzioni locali richieste.");
      }

      await openDb();
      state.settings = await getSettings();

      updateVaultUi();
      bindEvents();
      generatePassword();
    } catch (error) {
      toast(error.message || "Impossibile avviare il vault.", "error");
    }
  }

  initialize();
})();
