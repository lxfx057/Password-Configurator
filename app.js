(() => {
  "use strict";

  const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
  const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*+-_=?.";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const state = {
    entries: [],
    generatedPassword: "",
    revealed: true,
    openedFileName: "",
    pendingEncryptedFile: null
  };

  const $ = (selector) => document.querySelector(selector);

  const ui = {
    generatedPassword: $("#generatedPassword"),
    regenerateButton: $("#regenerateButton"),
    copyGeneratedButton: $("#copyGeneratedButton"),
    showGeneratedButton: $("#showGeneratedButton"),
    strengthLabel: $("#strengthLabel"),
    strengthBar: $("#strengthBar"),
    strengthDescription: $("#strengthDescription"),

    lengthRange: $("#lengthRange"),
    lengthValue: $("#lengthValue"),
    uppercaseToggle: $("#uppercaseToggle"),
    lowercaseToggle: $("#lowercaseToggle"),
    numbersToggle: $("#numbersToggle"),
    symbolsToggle: $("#symbolsToggle"),
    ambiguousToggle: $("#ambiguousToggle"),
    startLetterToggle: $("#startLetterToggle"),
    excludeInput: $("#excludeInput"),

    openFileButton: $("#openFileButton"),
    openFileInput: $("#openFileInput"),
    fileState: $("#fileState"),
    fileDescription: $("#fileDescription"),
    addPasswordButton: $("#addPasswordButton"),
    addManualButton: $("#addManualButton"),
    passwordList: $("#passwordList"),
    downloadFileButton: $("#downloadFileButton"),

    passwordDialog: $("#passwordDialog"),
    passwordForm: $("#passwordForm"),
    passwordDialogTitle: $("#passwordDialogTitle"),
    closePasswordDialog: $("#closePasswordDialog"),
    cancelPasswordButton: $("#cancelPasswordButton"),
    entryIdInput: $("#entryIdInput"),
    serviceInput: $("#serviceInput"),
    usernameInput: $("#usernameInput"),
    entryPasswordInput: $("#entryPasswordInput"),
    notesInput: $("#notesInput"),
    showEntryPasswordButton: $("#showEntryPasswordButton"),

    encryptDialog: $("#encryptDialog"),
    encryptForm: $("#encryptForm"),
    closeEncryptDialog: $("#closeEncryptDialog"),
    filePasswordInput: $("#filePasswordInput"),
    confirmFilePasswordInput: $("#confirmFilePasswordInput"),
    encryptError: $("#encryptError"),

    unlockDialog: $("#unlockDialog"),
    unlockForm: $("#unlockForm"),
    closeUnlockDialog: $("#closeUnlockDialog"),
    selectedFileName: $("#selectedFileName"),
    unlockPasswordInput: $("#unlockPasswordInput"),
    unlockError: $("#unlockError"),

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

  function secureShuffle(characters) {
    const output = [...characters];

    for (let index = output.length - 1; index > 0; index -= 1) {
      const target = randomIndex(index + 1);
      [output[index], output[target]] = [output[target], output[index]];
    }

    return output;
  }

  function removeExcluded(characters, excluded) {
    return [...characters]
      .filter((character) => !excluded.includes(character))
      .join("");
  }

  function generatePassword() {
    const excluded = ui.excludeInput.value || "";
    const removeSimilar = ui.ambiguousToggle.checked;

    let lowercase = LOWERCASE;
    let uppercase = UPPERCASE;
    let numbers = NUMBERS;
    let symbols = SYMBOLS;

    if (!removeSimilar) {
      lowercase += "lo";
      uppercase += "IO";
      numbers += "01";
    }

    lowercase = removeExcluded(lowercase, excluded);
    uppercase = removeExcluded(uppercase, excluded);
    numbers = removeExcluded(numbers, excluded);
    symbols = removeExcluded(symbols, excluded);

    const groups = [];

    if (ui.lowercaseToggle.checked && lowercase) groups.push(lowercase);
    if (ui.uppercaseToggle.checked && uppercase) groups.push(uppercase);
    if (ui.numbersToggle.checked && numbers) groups.push(numbers);
    if (ui.symbolsToggle.checked && symbols) groups.push(symbols);

    if (!groups.length) {
      showToast("Scegli almeno un tipo di carattere.", "error");
      return;
    }

    const length = Number(ui.lengthRange.value);

    if (length < groups.length) {
      showToast("Aumenta la lunghezza della password.", "error");
      return;
    }

    const pool = groups.join("");
    const characters = [];

    groups.forEach((group) => {
      characters.push(group[randomIndex(group.length)]);
    });

    while (characters.length < length) {
      characters.push(pool[randomIndex(pool.length)]);
    }

    const finalCharacters = secureShuffle(characters);

    if (ui.startLetterToggle.checked) {
      const letters = `${lowercase}${uppercase}`;

      if (letters) {
        finalCharacters[0] = letters[randomIndex(letters.length)];
      }
    }

    state.generatedPassword = finalCharacters.join("");
    state.revealed = true;
    updatePasswordOutput();
  }

  function estimateStrength(password) {
    let charset = 0;

    if (/[a-z]/.test(password)) charset += 26;
    if (/[A-Z]/.test(password)) charset += 26;
    if (/[0-9]/.test(password)) charset += 10;
    if (/[^A-Za-z0-9]/.test(password)) charset += 30;

    const bits = Math.round(password.length * Math.log2(charset || 1));

    if (bits < 40) {
      return ["Debole", 25, "#ff453a", "Aumenta la lunghezza o i tipi di carattere."];
    }

    if (bits < 60) {
      return ["Buona", 52, "#ff9f0a", "Adatta a molti account."];
    }

    if (bits < 80) {
      return ["Forte", 76, "#ffd60a", "Una buona scelta per account importanti."];
    }

    return ["Molto forte", 100, "#30d158", "Lunga, casuale e difficile da indovinare."];
  }

  function updatePasswordOutput() {
    const output = state.revealed
      ? state.generatedPassword
      : "•".repeat(Math.min(state.generatedPassword.length, 32));

    ui.generatedPassword.textContent = output;
    ui.generatedPassword.classList.toggle("masked", !state.revealed);
    ui.showGeneratedButton.textContent = state.revealed ? "Nascondi" : "Mostra";

    const [label, width, color, description] = estimateStrength(
      state.generatedPassword
    );

    ui.strengthLabel.textContent = label;
    ui.strengthBar.style.width = `${width}%`;
    ui.strengthBar.style.background = color;
    ui.strengthDescription.textContent = description;
  }

  function applyPreset(preset) {
    document.querySelectorAll(".preset").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === preset);
    });

    if (preset === "balanced") {
      ui.lengthRange.value = 20;
      ui.lowercaseToggle.checked = true;
      ui.uppercaseToggle.checked = true;
      ui.numbersToggle.checked = true;
      ui.symbolsToggle.checked = true;
      ui.ambiguousToggle.checked = true;
      ui.startLetterToggle.checked = false;
    }

    if (preset === "easy") {
      ui.lengthRange.value = 18;
      ui.lowercaseToggle.checked = true;
      ui.uppercaseToggle.checked = true;
      ui.numbersToggle.checked = true;
      ui.symbolsToggle.checked = false;
      ui.ambiguousToggle.checked = true;
      ui.startLetterToggle.checked = true;
    }

    if (preset === "strong") {
      ui.lengthRange.value = 32;
      ui.lowercaseToggle.checked = true;
      ui.uppercaseToggle.checked = true;
      ui.numbersToggle.checked = true;
      ui.symbolsToggle.checked = true;
      ui.ambiguousToggle.checked = false;
      ui.startLetterToggle.checked = false;
    }

    ui.lengthValue.textContent = ui.lengthRange.value;
    generatePassword();
  }

  async function copyToClipboard(text, message) {
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

      showToast(message, "success");
    } catch {
      showToast("Il browser non ha consentito la copia.", "error");
    }
  }

  async function deriveKey(password, salt, iterations) {
    const sourceKey = await crypto.subtle.importKey(
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
        iterations,
        hash: "SHA-256"
      },
      sourceKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptArchive(entries, password) {
    const salt = bytesToBase64(randomBytes(16));
    const iv = randomBytes(12);
    const iterations = 310000;
    const key = await deriveKey(password, salt, iterations);

    const content = {
      app: "Password File",
      version: 1,
      createdAt: new Date().toISOString(),
      entries
    };

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(content))
    );

    return {
      format: "Password File",
      version: 1,
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations,
      salt,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decryptArchive(archive, password) {
    const validArchive =
      archive?.format === "Password File" &&
      archive?.version === 1 &&
      archive?.algorithm === "AES-256-GCM" &&
      archive?.kdf === "PBKDF2-SHA-256" &&
      archive?.salt &&
      archive?.iv &&
      archive?.data &&
      Number.isInteger(archive?.iterations);

    if (!validArchive) {
      throw new Error("Questo file non è un archivio Password File valido.");
    }

    const key = await deriveKey(password, archive.salt, archive.iterations);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(archive.iv)
      },
      key,
      base64ToBytes(archive.data)
    );

    const content = JSON.parse(decoder.decode(decrypted));

    if (!Array.isArray(content.entries)) {
      throw new Error("Il contenuto dell'archivio non è valido.");
    }

    return content.entries;
  }

  function renderEntries() {
    if (!state.entries.length) {
      ui.passwordList.innerHTML = `
        <div class="empty-list">
          Nessuna password nell'archivio. Aggiungi una password generata oppure inseriscine una manualmente.
        </div>
      `;
      return;
    }

    ui.passwordList.innerHTML = state.entries
      .sort((first, second) => first.service.localeCompare(second.service, "it"))
      .map(
        (entry) => `
          <article class="entry">
            <div>
              <div class="entry-name">${escapeHtml(entry.service)}</div>
              <div class="entry-user">${escapeHtml(entry.username || "Nessun username")}</div>
            </div>

            <div class="entry-actions">
              <button class="small-button" type="button" data-copy="${entry.id}">Copia</button>
              <button class="small-button" type="button" data-edit="${entry.id}">Modifica</button>
              <button class="small-button" type="button" data-delete="${entry.id}">Elimina</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openPasswordDialog(entry = null, generated = false) {
    ui.passwordForm.reset();

    ui.passwordDialogTitle.textContent = entry
      ? "Modifica password"
      : "Aggiungi password";

    ui.entryIdInput.value = entry?.id || "";
    ui.serviceInput.value = entry?.service || "";
    ui.usernameInput.value = entry?.username || "";
    ui.entryPasswordInput.value = entry?.password || (generated ? state.generatedPassword : "");
    ui.notesInput.value = entry?.notes || "";
    ui.entryPasswordInput.type = "password";
    ui.showEntryPasswordButton.textContent = "Mostra";

    ui.passwordDialog.showModal();

    window.setTimeout(() => ui.serviceInput.focus(), 50);
  }

  function saveEntry(event) {
    event.preventDefault();

    const id = ui.entryIdInput.value || crypto.randomUUID();
    const service = ui.serviceInput.value.trim();
    const username = ui.usernameInput.value.trim();
    const password = ui.entryPasswordInput.value;
    const notes = ui.notesInput.value.trim();

    if (!service || !password) {
      showToast("Servizio e password sono obbligatori.", "error");
      return;
    }

    const existingIndex = state.entries.findIndex((entry) => entry.id === id);

    const entry = {
      id,
      service,
      username,
      password,
      notes,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex === -1) {
      state.entries.push(entry);
      showToast("Password aggiunta all'archivio.", "success");
    } else {
      state.entries[existingIndex] = entry;
      showToast("Password aggiornata.", "success");
    }

    ui.passwordDialog.close();
    renderEntries();
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

  async function deleteEntry(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    const accepted = await askConfirmation(
      "Eliminare password?",
      `“${entry.service}” verrà eliminata dall'archivio corrente.`,
      "Elimina"
    );

    if (!accepted) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    renderEntries();
    showToast("Password eliminata.", "success");
  }

  function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function updateFileInformation(name = "") {
    state.openedFileName = name;

    if (name) {
      ui.fileState.textContent = "File aperto";
      ui.fileDescription.textContent =
        `Stai modificando “${name}”. Quando scarichi di nuovo, usa la stessa password oppure scegline una nuova.`;
    } else {
      ui.fileState.textContent = "Nuovo archivio";
      ui.fileDescription.textContent =
        "Aggiungi le password che vuoi e scarica un file cifrato. Per leggerlo di nuovo basta caricarlo qui e inserire la stessa password.";
    }
  }

  function openEncryptDialog() {
    if (!state.entries.length) {
      showToast("Aggiungi almeno una password prima di creare il file.", "error");
      return;
    }

    ui.encryptForm.reset();
    ui.encryptError.textContent = "";
    ui.encryptError.classList.add("hidden");
    ui.encryptDialog.showModal();

    window.setTimeout(() => ui.filePasswordInput.focus(), 50);
  }

  async function downloadEncryptedArchive(event) {
    event.preventDefault();

    const password = ui.filePasswordInput.value;
    const confirmation = ui.confirmFilePasswordInput.value;

    try {
      if (password.length < 10) {
        throw new Error("Usa almeno 10 caratteri per proteggere il file.");
      }

      if (password !== confirmation) {
        throw new Error("Le due password non coincidono.");
      }

      const encryptedArchive = await encryptArchive(state.entries, password);

      downloadTextFile(
        JSON.stringify(encryptedArchive),
        `password-file-${new Date().toISOString().slice(0, 10)}.pconf`
      );

      ui.encryptDialog.close();
      updateFileInformation("Archivio password");
      showToast("File cifrato scaricato.", "success");
    } catch (error) {
      ui.encryptError.textContent =
        error.message || "Non è stato possibile creare il file.";
      ui.encryptError.classList.remove("hidden");
    }
  }

  async function selectArchiveFile(file) {
    if (!file) return;

    try {
      const content = await file.text();
      state.pendingEncryptedFile = JSON.parse(content);

      ui.unlockForm.reset();
      ui.unlockError.textContent = "";
      ui.unlockError.classList.add("hidden");
      ui.selectedFileName.textContent =
        `Inserisci la password usata per creare “${file.name}”.`;

      ui.unlockDialog.showModal();

      window.setTimeout(() => ui.unlockPasswordInput.focus(), 50);
    } catch {
      showToast("Non riesco a leggere questo file.", "error");
    } finally {
      ui.openFileInput.value = "";
    }
  }

  async function unlockArchive(event) {
    event.preventDefault();

    try {
      const password = ui.unlockPasswordInput.value;
      state.entries = await decryptArchive(state.pendingEncryptedFile, password);

      ui.unlockDialog.close();
      updateFileInformation("Archivio importato");
      renderEntries();

      showToast("File sbloccato e caricato.", "success");
    } catch {
      ui.unlockError.textContent =
        "Password non corretta oppure file danneggiato.";
      ui.unlockError.classList.remove("hidden");
    }
  }

  function bindEvents() {
    ui.regenerateButton.addEventListener("click", generatePassword);

    ui.copyGeneratedButton.addEventListener("click", () => {
      copyToClipboard(state.generatedPassword, "Password copiata.");
    });

    ui.showGeneratedButton.addEventListener("click", () => {
      state.revealed = !state.revealed;
      updatePasswordOutput();
    });

    [
      ui.lengthRange,
      ui.uppercaseToggle,
      ui.lowercaseToggle,
      ui.numbersToggle,
      ui.symbolsToggle,
      ui.ambiguousToggle,
      ui.startLetterToggle,
      ui.excludeInput
    ].forEach((input) => {
      input.addEventListener("input", generatePassword);
      input.addEventListener("change", generatePassword);
    });

    ui.lengthRange.addEventListener("input", () => {
      ui.lengthValue.textContent = ui.lengthRange.value;
    });

    document.querySelectorAll(".preset").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });

    ui.addPasswordButton.addEventListener("click", () => {
      openPasswordDialog(null, true);
    });

    ui.addManualButton.addEventListener("click", () => {
      openPasswordDialog();
    });

    ui.closePasswordDialog.addEventListener("click", () => {
      ui.passwordDialog.close();
    });

    ui.cancelPasswordButton.addEventListener("click", () => {
      ui.passwordDialog.close();
    });

    ui.showEntryPasswordButton.addEventListener("click", () => {
      const visible = ui.entryPasswordInput.type === "text";
      ui.entryPasswordInput.type = visible ? "password" : "text";
      ui.showEntryPasswordButton.textContent = visible ? "Mostra" : "Nascondi";
    });

    ui.passwordForm.addEventListener("submit", saveEntry);

    ui.passwordList.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copy;
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (copyId) {
        const entry = state.entries.find((item) => item.id === copyId);
        if (entry) copyToClipboard(entry.password, "Password copiata.");
      }

      if (editId) {
        const entry = state.entries.find((item) => item.id === editId);
        if (entry) openPasswordDialog(entry);
      }

      if (deleteId) {
        await deleteEntry(deleteId);
      }
    });

    ui.downloadFileButton.addEventListener("click", openEncryptDialog);
    ui.closeEncryptDialog.addEventListener("click", () => ui.encryptDialog.close());
    ui.encryptForm.addEventListener("submit", downloadEncryptedArchive);

    ui.openFileButton.addEventListener("click", () => ui.openFileInput.click());
    ui.openFileInput.addEventListener("change", (event) => {
      selectArchiveFile(event.target.files[0]);
    });

    ui.closeUnlockDialog.addEventListener("click", () => ui.unlockDialog.close());
    ui.unlockForm.addEventListener("submit", unlockArchive);
  }

  function initialize() {
    if (!window.crypto?.subtle) {
      showToast(
        "Apri il sito da Vercel tramite HTTPS per usare la cifratura.",
        "error"
      );
      return;
    }

    bindEvents();
    updateFileInformation();
    renderEntries();
    generatePassword();
  }

  initialize();
})();
