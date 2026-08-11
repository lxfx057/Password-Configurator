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
    ui.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3300);
  }

  function bytesToBase64(bytes) {
    let binary = "";

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

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

  function createId() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${bytesToBase64(randomBytes(12))
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 16)}`;
  }

  function shuffle(values) {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = randomIndex(index + 1);
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }

    return copy;
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

    if (groups.length === 0) {
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

    const finalCharacters = shuffle(characters);

    if (ui.startLetterToggle.checked) {
      const letters = `${lowercase}${uppercase}`;

      if (letters.length > 0) {
        finalCharacters[0] = letters[randomIndex(letters.length)];
      }
    }

    state.generatedPassword = finalCharacters.join("");
    state.revealed = true;
    updatePasswordOutput();
  }

  function estimateStrength(password) {
    let charsetSize = 0;

    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^A-Za-z0-9]/.test(password)) charsetSize += 30;

    const bits = Math.round(password.length * Math.log2(charsetSize || 1));

    if (bits < 40) {
      return {
        label: "Debole",
        width: 25,
        color: "#ff453a",
        description: "Aumenta la lunghezza o aggiungi più tipi di carattere."
      };
    }

    if (bits < 60) {
      return {
        label: "Buona",
        width: 52,
        color: "#ff9f0a",
        description: "Adatta alla maggior parte degli account."
      };
    }

    if (bits < 80) {
      return {
        label: "Forte",
        width: 76,
        color: "#ffd60a",
        description: "Ottima per gli account importanti."
      };
    }

    return {
      label: "Molto forte",
      width: 100,
      color: "#30d158",
      description: "Lunga, casuale e difficile da indovinare."
    };
  }

  function updatePasswordOutput() {
    const output = state.revealed
      ? state.generatedPassword
      : "•".repeat(Math.min(state.generatedPassword.length, 32));

    ui.generatedPassword.textContent = output;
    ui.generatedPassword.classList.toggle("masked", !state.revealed);
    ui.showGeneratedButton.textContent = state.revealed ? "Nascondi" : "Mostra";

    const strength = estimateStrength(state.generatedPassword);

    ui.strengthLabel.textContent = strength.label;
    ui.strengthBar.style.width = `${strength.width}%`;
    ui.strengthBar.style.background = strength.color;
    ui.strengthDescription.textContent = strength.description;
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
        document.body.appendChild(textarea);
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
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptArchive(entries, password) {
    const salt = bytesToBase64(randomBytes(16));
    const iv = randomBytes(12);
    const iterations = 310000;
    const key = await deriveKey(password, salt, iterations);

    const plainArchive = {
      app: "Password File",
      version: 1,
      createdAt: new Date().toISOString(),
      entries
    };

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(JSON.stringify(plainArchive))
    );

    return {
      format: "Password File",
      version: 1,
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations,
      salt,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encryptedData))
    };
  }

  async function decryptArchive(archive, password) {
    const isValid =
      archive &&
      archive.format === "Password File" &&
      archive.version === 1 &&
      archive.algorithm === "AES-256-GCM" &&
      archive.kdf === "PBKDF2-SHA-256" &&
      archive.salt &&
      archive.iv &&
      archive.data &&
      Number.isInteger(archive.iterations);

    if (!isValid) {
      throw new Error("Questo file non è un archivio Password File valido.");
    }

    const key = await deriveKey(password, archive.salt, archive.iterations);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(archive.iv)
      },
      key,
      base64ToBytes(archive.data)
    );

    const content = JSON.parse(decoder.decode(decryptedData));

    if (!Array.isArray(content.entries)) {
      throw new Error("Il contenuto dell'archivio non è valido.");
    }

    return content.entries;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderEntries() {
    if (state.entries.length === 0) {
      ui.passwordList.innerHTML = `
        <div class="empty-list">
          Nessuna password nell'archivio. Aggiungi una password generata oppure inseriscine una manualmente.
        </div>
      `;
      return;
    }

    const sortedEntries = [...state.entries].sort((first, second) =>
      first.service.localeCompare(second.service, "it")
    );

    ui.passwordList.innerHTML = sortedEntries
      .map(
        (entry) => `
          <article class="entry">
            <div>
              <div class="entry-name">${escapeHtml(entry.service)}</div>
              <div class="entry-user">${escapeHtml(
                entry.username || "Nessun username"
              )}</div>
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

  function openPasswordDialog(entry = null, addGeneratedPassword = false) {
    ui.passwordForm.reset();

    ui.passwordDialogTitle.textContent = entry
      ? "Modifica password"
      : "Aggiungi password";

    ui.entryIdInput.value = entry ? entry.id : "";
    ui.serviceInput.value = entry ? entry.service : "";
    ui.usernameInput.value = entry ? entry.username : "";
    ui.entryPasswordInput.value = entry
      ? entry.password
      : addGeneratedPassword
        ? state.generatedPassword
        : "";
    ui.notesInput.value = entry ? entry.notes : "";

    ui.entryPasswordInput.type = "password";
    ui.showEntryPasswordButton.textContent = "Mostra";

    ui.passwordDialog.showModal();

    window.setTimeout(() => {
      ui.serviceInput.focus();
    }, 50);
  }

  function saveEntry(event) {
    event.preventDefault();

    const id = ui.entryIdInput.value || createId();
    const service = ui.serviceInput.value.trim();
    const username = ui.usernameInput.value.trim();
    const password = ui.entryPasswordInput.value;
    const notes = ui.notesInput.value.trim();

    if (!service || !password) {
      showToast("Servizio e password sono obbligatori.", "error");
      return;
    }

    const entry = {
      id,
      service,
      username,
      password,
      notes,
      updatedAt: new Date().toISOString()
    };

    const existingIndex = state.entries.findIndex((item) => item.id === id);

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

    const confirmed = await askConfirmation(
      "Eliminare password?",
      `“${entry.service}” verrà eliminata dall'archivio corrente.`,
      "Elimina"
    );

    if (!confirmed) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    renderEntries();
    showToast("Password eliminata.", "success");
  }

  function downloadFile(text, filename) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateFileStatus(name = "") {
    if (name) {
      ui.fileState.textContent = "File aperto";
      ui.fileDescription.textContent =
        `Archivio “${name}” aperto. Dopo le modifiche, scarica nuovamente il file cifrato.`;
    } else {
      ui.fileState.textContent = "Nuovo archivio";
      ui.fileDescription.textContent =
        "Aggiungi le password che vuoi e scarica un file cifrato. Per leggerlo di nuovo basta caricarlo qui e inserire la stessa password.";
    }
  }

  function openEncryptDialog() {
    if (state.entries.length === 0) {
      showToast("Aggiungi almeno una password prima di creare il file.", "error");
      return;
    }

    ui.encryptForm.reset();
    ui.encryptError.textContent = "";
    ui.encryptError.classList.add("hidden");
    ui.encryptDialog.showModal();

    window.setTimeout(() => {
      ui.filePasswordInput.focus();
    }, 50);
  }

  async function createEncryptedFile(event) {
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

      const archive = await encryptArchive(state.entries, password);

      downloadFile(
        JSON.stringify(archive),
        `password-file-${new Date().toISOString().slice(0, 10)}.pconf`
      );

      ui.encryptDialog.close();
      updateFileStatus("Archivio password");
      showToast("File cifrato scaricato.", "success");
    } catch (error) {
      ui.encryptError.textContent =
        error.message || "Non è stato possibile creare il file.";
      ui.encryptError.classList.remove("hidden");
    }
  }

  async function selectFile(file) {
    if (!file) return;

    try {
      state.pendingEncryptedFile = JSON.parse(await file.text());

      ui.unlockForm.reset();
      ui.unlockError.textContent = "";
      ui.unlockError.classList.add("hidden");
      ui.selectedFileName.textContent =
        `Inserisci la password usata per creare “${file.name}”.`;

      ui.unlockDialog.showModal();

      window.setTimeout(() => {
        ui.unlockPasswordInput.focus();
      }, 50);
    } catch {
      showToast("Non riesco a leggere questo file.", "error");
    } finally {
      ui.openFileInput.value = "";
    }
  }

  async function unlockFile(event) {
    event.preventDefault();

    try {
      const password = ui.unlockPasswordInput.value;
      state.entries = await decryptArchive(state.pendingEncryptedFile, password);

      ui.unlockDialog.close();
      updateFileStatus("Archivio importato");
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
      button.addEventListener("click", () => {
        applyPreset(button.dataset.preset);
      });
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
      ui.showEntryPasswordButton.textContent = visible
        ? "Mostra"
        : "Nascondi";
    });

    ui.passwordForm.addEventListener("submit", saveEntry);

    ui.passwordList.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copy;
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (copyId) {
        const entry = state.entries.find((item) => item.id === copyId);

        if (entry) {
          copyToClipboard(entry.password, "Password copiata.");
        }
      }

      if (editId) {
        const entry = state.entries.find((item) => item.id === editId);

        if (entry) {
          openPasswordDialog(entry);
        }
      }

      if (deleteId) {
        await deleteEntry(deleteId);
      }
    });

    ui.downloadFileButton.addEventListener("click", openEncryptDialog);

    ui.closeEncryptDialog.addEventListener("click", () => {
      ui.encryptDialog.close();
    });

    ui.encryptForm.addEventListener("submit", createEncryptedFile);

    ui.openFileButton.addEventListener("click", () => {
      ui.openFileInput.click();
    });

    ui.openFileInput.addEventListener("change", (event) => {
      selectFile(event.target.files[0]);
    });

    ui.closeUnlockDialog.addEventListener("click", () => {
      ui.unlockDialog.close();
    });

    ui.unlockForm.addEventListener("submit", unlockFile);
  }

  function requiredElementsExist() {
    return Object.values(ui).every((element) => element !== null);
  }

  function initialize() {
    if (!requiredElementsExist()) {
      console.error(
        "Il file index.html e app.js non corrispondono. Sostituisci index.html con l'ultima versione completa."
      );
      return;
    }

    if (!window.crypto || !window.crypto.subtle) {
      showToast(
        "Apri il sito dal dominio Vercel HTTPS per attivare la cifratura.",
        "error"
      );
      return;
    }

    bindEvents();
    updateFileStatus();
    renderEntries();
    generatePassword();
  }

  initialize();
})();
