(() => {
  "use strict";

  const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
  const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*+-_=?.";
  const encoder = new TextEncoder();

  const state = {
    entries: [],
    generatedPassword: "",
    revealed: true
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

    addPasswordButton: $("#addPasswordButton"),
    addManualButton: $("#addManualButton"),
    passwordList: $("#passwordList"),
    entryCount: $("#entryCount"),
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

    window.setTimeout(() => toast.remove(), 3200);
  }

  function bytesToBase64(bytes) {
    let binary = "";

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary);
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
    const avoidSimilar = ui.ambiguousToggle.checked;

    let lowercase = LOWERCASE;
    let uppercase = UPPERCASE;
    let numbers = NUMBERS;
    let symbols = SYMBOLS;

    if (!avoidSimilar) {
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
      showToast("Select at least one character type.", "error");
      return;
    }

    const length = Number(ui.lengthRange.value);

    if (length < groups.length) {
      showToast("Increase the password length.", "error");
      return;
    }

    const characters = [];
    const pool = groups.join("");

    groups.forEach((group) => {
      characters.push(group[randomIndex(group.length)]);
    });

    while (characters.length < length) {
      characters.push(pool[randomIndex(pool.length)]);
    }

    const result = shuffle(characters);

    if (ui.startLetterToggle.checked) {
      const letters = `${lowercase}${uppercase}`;

      if (letters) {
        result[0] = letters[randomIndex(letters.length)];
      }
    }

    state.generatedPassword = result.join("");
    state.revealed = true;
    updatePasswordOutput();
  }

  function estimateStrength(password) {
    let characterPool = 0;

    if (/[a-z]/.test(password)) characterPool += 26;
    if (/[A-Z]/.test(password)) characterPool += 26;
    if (/[0-9]/.test(password)) characterPool += 10;
    if (/[^A-Za-z0-9]/.test(password)) characterPool += 30;

    const bits = Math.round(password.length * Math.log2(characterPool || 1));

    if (bits < 40) {
      return ["Weak", 25, "#ff453a", "Use a longer password or more character types."];
    }

    if (bits < 60) {
      return ["Good", 52, "#ff9f0a", "Suitable for most accounts."];
    }

    if (bits < 80) {
      return ["Strong", 76, "#ffd60a", "A strong choice for important accounts."];
    }

    return ["Very strong", 100, "#30d158", "Long, random, and hard to guess."];
  }

  function updatePasswordOutput() {
    ui.generatedPassword.textContent = state.revealed
      ? state.generatedPassword
      : "•".repeat(Math.min(state.generatedPassword.length, 32));

    ui.generatedPassword.classList.toggle("masked", !state.revealed);
    ui.showGeneratedButton.textContent = state.revealed ? "Hide" : "Show";

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
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      showToast(message, "success");
    } catch {
      showToast("Your browser did not allow copying.", "error");
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateEntryCount() {
    const count = state.entries.length;
    ui.entryCount.textContent = `${count} ${count === 1 ? "saved" : "saved"}`;
  }

  function renderEntries() {
    updateEntryCount();

    if (!state.entries.length) {
      ui.passwordList.innerHTML = `
        <div class="empty-list">
          No passwords saved yet. Save the generated password or add one manually.
        </div>
      `;
      return;
    }

    const sortedEntries = [...state.entries].sort((first, second) =>
      first.service.localeCompare(second.service, "en")
    );

    ui.passwordList.innerHTML = sortedEntries
      .map(
        (entry) => `
          <article class="entry">
            <div>
              <div class="entry-name">${escapeHtml(entry.service)}</div>
              <div class="entry-user">${escapeHtml(
                entry.username || "No username added"
              )}</div>
            </div>

            <div class="entry-actions">
              <button class="small-button" type="button" data-copy="${entry.id}">Copy</button>
              <button class="small-button" type="button" data-edit="${entry.id}">Edit</button>
              <button class="small-button" type="button" data-delete="${entry.id}">Delete</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function openPasswordDialog(entry = null, addGenerated = false) {
    ui.passwordForm.reset();

    ui.passwordDialogTitle.textContent = entry
      ? "Edit password"
      : "Save password";

    ui.entryIdInput.value = entry?.id || "";
    ui.serviceInput.value = entry?.service || "";
    ui.usernameInput.value = entry?.username || "";
    ui.entryPasswordInput.value = entry?.password || (
      addGenerated ? state.generatedPassword : ""
    );
    ui.notesInput.value = entry?.notes || "";
    ui.entryPasswordInput.type = "password";
    ui.showEntryPasswordButton.textContent = "Show";

    ui.passwordDialog.showModal();

    window.setTimeout(() => ui.serviceInput.focus(), 50);
  }

  function saveEntry(event) {
    event.preventDefault();

    const id = ui.entryIdInput.value || createId();
    const service = ui.serviceInput.value.trim();
    const username = ui.usernameInput.value.trim();
    const password = ui.entryPasswordInput.value;
    const notes = ui.notesInput.value.trim();

    if (!service || !password) {
      showToast("Website/app and password are required.", "error");
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
      showToast("Password added to your list.", "success");
    } else {
      state.entries[existingIndex] = entry;
      showToast("Password updated.", "success");
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
      "Delete password?",
      `“${entry.service}” will be removed from the current list.`,
      "Delete"
    );

    if (!confirmed) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    renderEntries();
    showToast("Password deleted.", "success");
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
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
      ["encrypt"]
    );
  }

  async function createEncryptedArchive(password) {
    const salt = bytesToBase64(randomBytes(16));
    const iv = randomBytes(12);
    const iterations = 310000;
    const key = await deriveKey(password, salt, iterations);

    const payload = {
      app: "Password File",
      version: 1,
      createdAt: new Date().toISOString(),
      entries: state.entries
    };

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(JSON.stringify(payload))
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

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openEncryptDialog() {
    if (!state.entries.length) {
      showToast("Save at least one password before creating the file.", "error");
      return;
    }

    ui.encryptForm.reset();
    ui.encryptError.textContent = "";
    ui.encryptError.classList.add("hidden");
    ui.encryptDialog.showModal();

    window.setTimeout(() => ui.filePasswordInput.focus(), 50);
  }

  async function saveEncryptedFile(event) {
    event.preventDefault();

    const password = ui.filePasswordInput.value;
    const confirmation = ui.confirmFilePasswordInput.value;

    try {
      if (password.length < 10) {
        throw new Error("Use at least 10 characters for the file password.");
      }

      if (password !== confirmation) {
        throw new Error("The file passwords do not match.");
      }

      const archive = await createEncryptedArchive(password);
      const date = new Date().toISOString().slice(0, 10);

      downloadFile(
        JSON.stringify(archive),
        `password-file-${date}.pconf`
      );

      ui.encryptDialog.close();
      showToast("Encrypted file downloaded.", "success");
    } catch (error) {
      ui.encryptError.textContent =
        error.message || "The encrypted file could not be created.";
      ui.encryptError.classList.remove("hidden");
    }
  }

  function bindEvents() {
    ui.regenerateButton.addEventListener("click", generatePassword);

    ui.copyGeneratedButton.addEventListener("click", () => {
      copyToClipboard(state.generatedPassword, "Password copied.");
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
      const isVisible = ui.entryPasswordInput.type === "text";
      ui.entryPasswordInput.type = isVisible ? "password" : "text";
      ui.showEntryPasswordButton.textContent = isVisible ? "Show" : "Hide";
    });

    ui.passwordForm.addEventListener("submit", saveEntry);

    ui.passwordList.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copy;
      const editId = event.target.dataset.edit;
      const deleteId = event.target.dataset.delete;

      if (copyId) {
        const entry = state.entries.find((item) => item.id === copyId);
        if (entry) copyToClipboard(entry.password, "Password copied.");
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

    ui.closeEncryptDialog.addEventListener("click", () => {
      ui.encryptDialog.close();
    });

    ui.encryptForm.addEventListener("submit", saveEncryptedFile);
  }

  function initialize() {
    const allElementsExist = Object.values(ui).every((element) => element);

    if (!allElementsExist) {
      console.error("The current index.html and app.js files do not match.");
      return;
    }

    if (!window.crypto?.subtle) {
      showToast(
        "Open this website through Vercel HTTPS to enable encryption.",
        "error"
      );
      return;
    }

    bindEvents();
    renderEntries();
    generatePassword();
  }

  initialize();
})();
