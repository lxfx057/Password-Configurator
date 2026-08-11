(() => {
  const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*+-_=?.";
  const AMBIGUOUS = "O0oIl1|`'\"";

  const state = {
    generatedPassword: "",
    vaultKey: null,
    vaultSettings: null,
    credentials: [],
    editingCredentialId: null,
    masterMode: "setup",
    inactivityTimer: null
  };

  const elements = {
    generatedPassword: document.querySelector("#generatedPassword"),
    generatedStrengthLabel: document.querySelector("#generatedStrengthLabel"),
    generatedEntropy: document.querySelector("#generatedEntropy"),
    generatedLength: document.querySelector("#generatedLength"),
    generatedStrengthBar: document.querySelector("#generatedStrengthBar"),
    lengthRange: document.querySelector("#lengthRange"),
    lengthValue: document.querySelector("#lengthValue"),
    uppercaseToggle: document.querySelector("#uppercaseToggle"),
    lowercaseToggle: document.querySelector("#lowercaseToggle"),
    numbersToggle: document.querySelector("#numbersToggle"),
    symbolsToggle: document.querySelector("#symbolsToggle"),
    ambiguousToggle: document.querySelector("#ambiguousToggle"),
    regenerateButton: document.querySelector("#regenerateButton"),
    copyGeneratedButton: document.querySelector("#copyGeneratedButton"),
    saveGeneratedButton: document.querySelector("#saveGeneratedButton"),
    analyzerInput: document.querySelector("#analyzerInput"),
    analyzerRevealButton: document.querySelector("#analyzerRevealButton"),
    analyzerScore: document.querySelector("#analyzerScore"),
    analyzerLevel: document.querySelector("#analyzerLevel"),
    analyzerDescription: document.querySelector("#analyzerDescription"),
    analyzerStrengthBar: document.querySelector("#analyzerStrengthBar"),
    scoreRing: document.querySelector("#scoreRing"),
    analyzerInsights: document.querySelector("#analyzerInsights"),
    testerInput: document.querySelector("#testerInput"),
    testerRevealButton: document.querySelector("#testerRevealButton"),
    minimumLengthInput: document.querySelector("#minimumLengthInput"),
    requireUppercase: document.querySelector("#requireUppercase"),
    requireLowercase: document.querySelector("#requireLowercase"),
    requireNumber: document.querySelector("#requireNumber"),
    requireSymbol: document.querySelector("#requireSymbol"),
    forbiddenCharacters: document.querySelector("#forbiddenCharacters"),
    testResult: document.querySelector("#testResult"),
    testList: document.querySelector("#testList"),
    vaultStatus: document.querySelector("#vaultStatus"),
    lockButton: document.querySelector("#lockButton"),
    addCredentialButton: document.querySelector("#addCredentialButton"),
    vaultLockedState: document.querySelector("#vaultLockedState"),
    vaultUnlockedState: document.querySelector("#vaultUnlockedState"),
    vaultLockTitle: document.querySelector("#vaultLockTitle"),
    vaultLockDescription: document.querySelector("#vaultLockDescription"),
    openVaultButton: document.querySelector("#openVaultButton"),
    vaultSearchInput: document.querySelector("#vaultSearchInput"),
    vaultList: document.querySelector("#vaultList"),
    exportButton: document.querySelector("#exportButton"),
    importInput: document.querySelector("#importInput"),
    masterPasswordDialog: document.querySelector("#masterPasswordDialog"),
    masterPasswordForm: document.querySelector("#masterPasswordForm"),
    masterDialogLabel: document.querySelector("#masterDialogLabel"),
    masterDialogTitle: document.querySelector("#masterDialogTitle"),
    masterDialogDescription: document.querySelector("#masterDialogDescription"),
    masterPasswordInput: document.querySelector("#masterPasswordInput"),
    masterPasswordConfirmInput: document.querySelector("#masterPasswordConfirmInput"),
    masterConfirmLabel: document.querySelector("#masterConfirmLabel"),
    masterDialogError: document.querySelector("#masterDialogError"),
    masterDialogSubmit: document.querySelector("#masterDialogSubmit"),
    closeMasterDialogButton: document.querySelector("#closeMasterDialogButton"),
    credentialDialog: document.querySelector("#credentialDialog"),
    credentialForm: document.querySelector("#credentialForm"),
    credentialDialogTitle: document.querySelector("#credentialDialogTitle"),
    credentialIdInput: document.querySelector("#credentialIdInput"),
    credentialNameInput: document.querySelector("#credentialNameInput"),
    credentialUsernameInput: document.querySelector("#credentialUsernameInput"),
    credentialPasswordInput: document.querySelector("#credentialPasswordInput"),
    credentialNotesInput: document.querySelector("#credentialNotesInput"),
    credentialRevealButton: document.querySelector("#credentialRevealButton"),
    closeCredentialDialogButton: document.querySelector("#closeCredentialDialogButton"),
    cancelCredentialButton: document.querySelector("#cancelCredentialButton"),
    confirmDialog: document.querySelector("#confirmDialog"),
    confirmDialogTitle: document.querySelector("#confirmDialogTitle"),
    confirmDialogDescription: document.querySelector("#confirmDialogDescription"),
    confirmDialogButton: document.querySelector("#confirmDialogButton"),
    toastContainer: document.querySelector("#toastContainer")
  };

  function randomIndex(max) {
    const limit = Math.floor(256 / max) * max;
    const bytes = new Uint8Array(1);

    do {
      crypto.getRandomValues(bytes);
    } while (bytes[0] >= limit);

    return bytes[0] % max;
  }

  function secureShuffle(values) {
    const copy = [...values];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  function getGeneratorOptions() {
    return {
      length: Number(elements.lengthRange.value),
      uppercase: elements.uppercaseToggle.checked,
      lowercase: elements.lowercaseToggle.checked,
      numbers: elements.numbersToggle.checked,
      symbols: elements.symbolsToggle.checked,
      excludeAmbiguous: elements.ambiguousToggle.checked
    };
  }

  function buildCharset(options) {
    const categories = [];

    if (options.uppercase) categories.push(UPPERCASE);
    if (options.lowercase) categories.push(LOWERCASE);
    if (options.numbers) categories.push(NUMBERS);
    if (options.symbols) categories.push(SYMBOLS);

    if (!categories.length) {
      categories.push(LOWERCASE);
    }

    if (!options.excludeAmbiguous) {
      if (options.uppercase) categories[0] += "OI";
      if (options.lowercase) {
        const lowerIndex = options.uppercase ? 1 : 0;
        categories[lowerIndex] += "oil";
      }
      if (options.numbers) {
        const numberIndex = categories.findIndex((value) => value.includes("2"));
        if (numberIndex !== -1) categories[numberIndex] += "01";
      }
    }

    return categories;
  }

  function generatePassword() {
    const options = getGeneratorOptions();
    const categories = buildCharset(options);
    const length = Math.max(options.length, categories.length);
    const allCharacters = categories.join("");
    const result = [];

    categories.forEach((category) => {
      result.push(category[randomIndex(category.length)]);
    });

    while (result.length < length) {
      result.push(allCharacters[randomIndex(allCharacters.length)]);
    }

    state.generatedPassword = secureShuffle(result).join("");
    renderGeneratedPassword();
    analyzePassword(elements.analyzerInput.value);
    testPassword();
  }

  function getCharacterPoolSize(password) {
    let pool = 0;

    if (/[A-Z]/.test(password)) pool += 26;
    if (/[a-z]/.test(password)) pool += 26;
    if (/[0-9]/.test(password)) pool += 10;
    if (/[^A-Za-z0-9]/.test(password)) pool += 32;

    return Math.max(pool, 1);
  }

  function estimateEntropy(password) {
    if (!password) return 0;
    return Math.round(password.length * Math.log2(getCharacterPoolSize(password)));
  }

  function passwordScore(password) {
    if (!password) {
      return {
        score: 0,
        entropy: 0,
        level: "Waiting for input",
        color: "var(--line-strong)",
        insights: ["Enter a password to receive a local assessment."],
        description: "Your password is only analyzed in this browser."
      };
    }

    const entropy = estimateEntropy(password);
    let score = 0;
    const insights = [];

    score += Math.min(password.length * 3, 36);
    if (/[a-z]/.test(password)) score += 12;
    if (/[A-Z]/.test(password)) score += 14;
    if (/[0-9]/.test(password)) score += 14;
    if (/[^A-Za-z0-9]/.test(password)) score += 16;
    if (password.length >= 15) score += 8;

    if (/(.)\1\1/.test(password)) {
      score -= 12;
      insights.push("Avoid repeating the same character several times.");
    }

    if (/123|abc|qwerty|password|admin|letmein/i.test(password)) {
      score -= 30;
      insights.push("Avoid common sequences and predictable words.");
    }

    if (password.length < 12) {
      insights.push("Use at least 12 characters; 15 or more is better.");
    } else {
      insights.push("Length is a strong foundation for password security.");
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      insights.push("Mix uppercase and lowercase letters.");
    }

    if (!/[0-9]/.test(password)) {
      insights.push("Adding numbers increases the character pool.");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      insights.push("Symbols can add variety when a site allows them.");
    }

    score = Math.max(0, Math.min(100, score));

    let level = "Weak";
    let color = "var(--red)";
    let description = "This password is easy to guess or too short.";

    if (score >= 85) {
      level = "Excellent";
      color = "var(--green)";
      description = "Strong length and variety make this difficult to guess.";
    } else if (score >= 65) {
      level = "Strong";
      color = "var(--blue)";
      description = "A solid password for most accounts.";
    } else if (score >= 40) {
      level = "Moderate";
      color = "var(--orange)";
      description = "Improve length and character variety for better protection.";
    }

    return {
      score,
      entropy,
      level,
      color,
      insights: [...new Set(insights)].slice(0, 4),
      description
    };
  }

  function renderGeneratedPassword() {
    const analysis = passwordScore(state.generatedPassword);

    elements.generatedPassword.textContent = state.generatedPassword;
    elements.generatedStrengthLabel.textContent = analysis.level;
    elements.generatedEntropy.textContent = `${analysis.entropy} bits`;
    elements.generatedLength.textContent = String(state.generatedPassword.length);
    elements.generatedStrengthBar.style.width = `${analysis.score}%`;
    elements.generatedStrengthBar.style.background = analysis.color;
    elements.lengthValue.textContent = elements.lengthRange.value;
  }

  function analyzePassword(password) {
    const analysis = passwordScore(password);

    elements.analyzerScore.textContent = analysis.score;
    elements.analyzerLevel.textContent = analysis.level;
    elements.analyzerDescription.textContent = analysis.description;
    elements.analyzerStrengthBar.style.width = `${analysis.score}%`;
    elements.analyzerStrengthBar.style.background = analysis.color;
    elements.scoreRing.style.borderColor = analysis.color;

    elements.analyzerInsights.innerHTML = analysis.insights
      .map((insight) => `<li>${escapeHtml(insight)}</li>`)
      .join("");
  }

  function testPassword() {
    const password = elements.testerInput.value;
    const minimumLength = Number(elements.minimumLengthInput.value) || 1;
    const forbidden = elements.forbiddenCharacters.value;
    const checks = [
      {
        label: `At least ${minimumLength} characters`,
        pass: password.length >= minimumLength
      },
      {
        label: "Contains uppercase letter",
        pass: !elements.requireUppercase.checked || /[A-Z]/.test(password)
      },
      {
        label: "Contains lowercase letter",
        pass: !elements.requireLowercase.checked || /[a-z]/.test(password)
      },
      {
        label: "Contains a number",
        pass: !elements.requireNumber.checked || /[0-9]/.test(password)
      },
      {
        label: "Contains a symbol",
        pass: !elements.requireSymbol.checked || /[^A-Za-z0-9]/.test(password)
      },
      {
        label: forbidden ? "Does not include forbidden characters" : "No forbidden characters configured",
        pass: !forbidden || ![...forbidden].some((character) => password.includes(character))
      }
    ];

    if (!password) {
      elements.testResult.className = "test-result";
      elements.testResult.textContent = "Add a password to run the test.";
      elements.testList.innerHTML = `<li class="neutral">No test result yet.</li>`;
      return;
    }

    const passed = checks.every((check) => check.pass);
    elements.testResult.className = `test-result ${passed ? "success" : "failure"}`;
    elements.testResult.textContent = passed
      ? "Password meets all configured requirements."
      : "Password does not meet every configured requirement.";

    elements.testList.innerHTML = checks
      .map(
        (check) => `
          <li class="${check.pass ? "success" : "failure"}">
            ${escapeHtml(check.label)}
          </li>
        `
      )
      .join("");
  }

  function setPreset(preset) {
    document.querySelectorAll(".preset-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === preset);
    });

    if (preset === "balanced") {
      elements.lengthRange.value = 20;
      elements.uppercaseToggle.checked = true;
      elements.lowercaseToggle.checked = true;
      elements.numbersToggle.checked = true;
      elements.symbolsToggle.checked = true;
      elements.ambiguousToggle.checked = true;
    }

    if (preset === "memorable") {
      elements.lengthRange.value = 18;
      elements.uppercaseToggle.checked = true;
      elements.lowercaseToggle.checked = true;
      elements.numbersToggle.checked = true;
      elements.symbolsToggle.checked = false;
      elements.ambiguousToggle.checked = true;
    }

    if (preset === "maximum") {
      elements.lengthRange.value = 32;
      elements.uppercaseToggle.checked = true;
      elements.lowercaseToggle.checked = true;
      elements.numbersToggle.checked = true;
      elements.symbolsToggle.checked = true;
      elements.ambiguousToggle.checked = false;
    }

    generatePassword();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function copyText(value, successMessage = "Copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage, "success");
    } catch {
      showToast("Clipboard access was blocked by the browser.", "error");
    }
  }

  function showToast(message, type = "") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.append(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function toggleInputVisibility(input, button) {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
  }

  function updateVaultUi() {
    const unlocked = Boolean(state.vaultKey);

    elements.vaultStatus.classList.toggle("unlocked", unlocked);
    elements.vaultStatus.querySelector("span:last-child").textContent = unlocked
      ? "Vault unlocked"
      : "Vault locked";

    elements.lockButton.disabled = !unlocked;
    elements.addCredentialButton.disabled = !unlocked;
    elements.vaultLockedState.classList.toggle("hidden", unlocked);
    elements.vaultUnlockedState.classList.toggle("hidden", !unlocked);

    if (!unlocked) {
      const exists = Boolean(state.vaultSettings);
      elements.vaultLockTitle.textContent = exists
        ? "Unlock your local vault"
        : "Set up your local vault";

      elements.vaultLockDescription.textContent = exists
        ? "Enter your master password to access encrypted credentials on this device."
        : "Create a master password. It encrypts the credentials saved on this device.";

      elements.openVaultButton.textContent = exists ? "Unlock vault" : "Set up vault";
    }
  }

  function openMasterDialog(mode) {
    state.masterMode = mode;
    elements.masterPasswordForm.reset();
    elements.masterDialogError.classList.add("hidden");
    elements.masterDialogError.textContent = "";

    const setup = mode === "setup";
    elements.masterDialogLabel.textContent = setup ? "LOCAL ENCRYPTION" : "VAULT UNLOCK";
    elements.masterDialogTitle.textContent = setup ? "Set up your vault" : "Unlock your vault";
    elements.masterDialogDescription.textContent = setup
      ? "Choose a strong master password. It is never stored and cannot be recovered."
      : "Your master password is used locally to unlock encrypted credentials.";

    elements.masterConfirmLabel.classList.toggle("hidden", !setup);
    elements.masterPasswordConfirmInput.classList.toggle("hidden", !setup);
    elements.masterPasswordConfirmInput.required = setup;
    elements.masterPasswordInput.autocomplete = setup ? "new-password" : "current-password";
    elements.masterDialogSubmit.textContent = setup ? "Create encrypted vault" : "Unlock vault";

    elements.masterPasswordDialog.showModal();
    window.setTimeout(() => elements.masterPasswordInput.focus(), 30);
  }

  async function createVault(masterPassword) {
    const material = await PasswordCrypto.createKeyMaterial(masterPassword);

    state.vaultSettings = {
      version: 1,
      salt: material.salt,
      verification: material.verification,
      createdAt: new Date().toISOString()
    };

    await PasswordVault.saveSettings(state.vaultSettings);
    state.vaultKey = await PasswordCrypto.deriveKey(masterPassword, material.salt);
    state.credentials = [];
    updateVaultUi();
    renderVault();
    resetInactivityTimer();
    showToast("Encrypted local vault created.", "success");
  }

  async function unlockVault(masterPassword) {
    const verification = await PasswordCrypto.verifyMasterPassword(
      masterPassword,
      state.vaultSettings.salt,
      state.vaultSettings.verification
    );

    if (!verification.valid) {
      throw new Error("The master password is incorrect.");
    }

    state.vaultKey = verification.key;
    await loadCredentials();
    updateVaultUi();
    renderVault();
    resetInactivityTimer();
    showToast("Vault unlocked.", "success");
  }

  function lockVault(showMessage = true) {
    state.vaultKey = null;
    state.credentials = [];
    clearTimeout(state.inactivityTimer);
    updateVaultUi();

    if (showMessage) {
      showToast("Vault locked.", "success");
    }
  }

  function resetInactivityTimer() {
    if (!state.vaultKey) return;

    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = window.setTimeout(() => {
      lockVault(false);
      showToast("Vault locked after inactivity.");
    }, 5 * 60 * 1000);
  }

  async function loadCredentials() {
    const records = await PasswordVault.getAllCredentialRecords();
    const decrypted = [];

    for (const record of records) {
      try {
        const json = await PasswordCrypto.decryptString(record.payload, state.vaultKey);
        decrypted.push(JSON.parse(json));
      } catch {
        showToast("A saved credential could not be decrypted.", "error");
      }
    }

    state.credentials = decrypted.sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: "base" })
    );
  }

  function renderVault() {
    if (!state.vaultKey) return;

    const query = elements.vaultSearchInput.value.trim().toLowerCase();
    const visibleCredentials = state.credentials.filter((credential) => {
      const searchable = [
        credential.name,
        credential.username,
        credential.notes
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    if (!visibleCredentials.length) {
      elements.vaultList.innerHTML = `
        <div class="vault-empty">
          ${query ? "No credentials match your search." : "No saved credentials yet."}
        </div>
      `;
      return;
    }

    elements.vaultList.innerHTML = visibleCredentials
      .map(
        (credential) => `
          <article class="credential-row">
            <div>
              <div class="credential-name">${escapeHtml(credential.name)}</div>
              <div class="credential-user">
                ${escapeHtml(credential.username || "No username saved")}
              </div>
            </div>

            <div class="credential-actions">
              <button class="small-button" data-copy-id="${credential.id}" type="button">Copy</button>
              <button class="small-button" data-edit-id="${credential.id}" type="button">Edit</button>
              <button class="small-button delete" data-delete-id="${credential.id}" type="button">Delete</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function openCredentialDialog(credential = null) {
    if (!state.vaultKey) {
      showToast("Unlock the vault before saving a credential.", "error");
      return;
    }

    state.editingCredentialId = credential?.id ?? null;
    elements.credentialForm.reset();
    elements.credentialIdInput.value = credential?.id ?? "";
    elements.credentialDialogTitle.textContent = credential ? "Edit credential" : "Save password";

    elements.credentialNameInput.value = credential?.name ?? "";
    elements.credentialUsernameInput.value = credential?.username ?? "";
    elements.credentialPasswordInput.value = credential?.password ?? state.generatedPassword;
    elements.credentialNotesInput.value = credential?.notes ?? "";
    elements.credentialPasswordInput.type = "password";
    elements.credentialRevealButton.textContent = "Show";

    elements.credentialDialog.showModal();
    window.setTimeout(() => elements.credentialNameInput.focus(), 30);
  }

  async function saveCredential(event) {
    event.preventDefault();

    const name = elements.credentialNameInput.value.trim();
    const username = elements.credentialUsernameInput.value.trim();
    const password = elements.credentialPasswordInput.value;
    const notes = elements.credentialNotesInput.value.trim();

    if (!name || !password) {
      showToast("Service name and password are required.", "error");
      return;
    }

    const existing = state.credentials.find(
      (credential) => credential.id === state.editingCredentialId
    );

    const credential = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      username,
      password,
      notes,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const payload = await PasswordCrypto.encryptString(
      JSON.stringify(credential),
      state.vaultKey
    );

    await PasswordVault.saveCredentialRecord({
      id: credential.id,
      payload,
      updatedAt: credential.updatedAt
    });

    const index = state.credentials.findIndex((item) => item.id === credential.id);

    if (index === -1) {
      state.credentials.push(credential);
    } else {
      state.credentials[index] = credential;
    }

    state.credentials.sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: "base" })
    );

    elements.credentialDialog.close();
    renderVault();
    resetInactivityTimer();
    showToast(existing ? "Credential updated." : "Credential saved and encrypted.", "success");
  }

  async function deleteCredential(id) {
    const credential = state.credentials.find((item) => item.id === id);
    if (!credential) return;

    elements.confirmDialogTitle.textContent = "Delete credential?";
    elements.confirmDialogDescription.textContent = `“${credential.name}” will be permanently deleted from this local vault.`;
    elements.confirmDialogButton.textContent = "Delete";
    elements.confirmDialog.showModal();

    const result = await new Promise((resolve) => {
      elements.confirmDialog.addEventListener(
        "close",
        () => resolve(elements.confirmDialog.returnValue),
        { once: true }
      );
    });

    if (result !== "confirm") return;

    await PasswordVault.deleteCredentialRecord(id);
    state.credentials = state.credentials.filter((item) => item.id !== id);
    renderVault();
    resetInactivityTimer();
    showToast("Credential deleted.", "success");
  }

  async function exportBackup() {
    if (!state.vaultKey) return;

    const records = await PasswordVault.getAllCredentialRecords();
    const backup = {
      app: "Password Configurator",
      version: 1,
      exportedAt: new Date().toISOString(),
      vaultSettings: state.vaultSettings,
      credentials: records
    };

    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `password-configurator-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    resetInactivityTimer();
    showToast("Encrypted backup exported.", "success");
  }

  async function importBackup(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const valid =
        backup?.app === "Password Configurator" &&
        backup?.version === 1 &&
        backup?.vaultSettings?.salt &&
        backup?.vaultSettings?.verification &&
        Array.isArray(backup?.credentials);

      if (!valid) {
        throw new Error("This is not a valid Password Configurator backup.");
      }

      elements.confirmDialogTitle.textContent = "Import encrypted backup?";
      elements.confirmDialogDescription.textContent =
        "This replaces the current local vault and all credentials on this device.";
      elements.confirmDialogButton.textContent = "Import";
      elements.confirmDialog.showModal();

      const result = await new Promise((resolve) => {
        elements.confirmDialog.addEventListener(
          "close",
          () => resolve(elements.confirmDialog.returnValue),
          { once: true }
        );
      });

      if (result !== "confirm") return;

      await PasswordVault.clearAll();
      await PasswordVault.saveSettings(backup.vaultSettings);

      for (const credential of backup.credentials) {
        await PasswordVault.saveCredentialRecord(credential);
      }

      state.vaultSettings = backup.vaultSettings;
      lockVault(false);
      updateVaultUi();
      showToast("Backup imported. Unlock it with its master password.", "success");
    } catch (error) {
      showToast(error.message || "The backup could not be imported.", "error");
    } finally {
      elements.importInput.value = "";
    }
  }

  function bindEvents() {
    elements.regenerateButton.addEventListener("click", generatePassword);
    elements.copyGeneratedButton.addEventListener("click", () => {
      copyText(state.generatedPassword, "Generated password copied.");
    });

    elements.saveGeneratedButton.addEventListener("click", () => openCredentialDialog());

    [
      elements.lengthRange,
      elements.uppercaseToggle,
      elements.lowercaseToggle,
      elements.numbersToggle,
      elements.symbolsToggle,
      elements.ambiguousToggle
    ].forEach((control) => {
      control.addEventListener("input", generatePassword);
      control.addEventListener("change", generatePassword);
    });

    document.querySelectorAll(".preset-button").forEach((button) => {
      button.addEventListener("click", () => setPreset(button.dataset.preset));
    });

    elements.analyzerInput.addEventListener("input", (event) => {
      analyzePassword(event.target.value);
    });

    elements.testerInput.addEventListener("input", testPassword);

    [
      elements.minimumLengthInput,
      elements.requireUppercase,
      elements.requireLowercase,
      elements.requireNumber,
      elements.requireSymbol,
      elements.forbiddenCharacters
    ].forEach((control) => {
      control.addEventListener("input", testPassword);
      control.addEventListener("change", testPassword);
    });

    elements.analyzerRevealButton.addEventListener("click", () => {
      toggleInputVisibility(elements.analyzerInput, elements.analyzerRevealButton);
    });

    elements.testerRevealButton.addEventListener("click", () => {
      toggleInputVisibility(elements.testerInput, elements.testerRevealButton);
    });

    elements.credentialRevealButton.addEventListener("click", () => {
      toggleInputVisibility(elements.credentialPasswordInput, elements.credentialRevealButton);
    });

    elements.openVaultButton.addEventListener("click", () => {
      openMasterDialog(state.vaultSettings ? "unlock" : "setup");
    });

    elements.closeMasterDialogButton.addEventListener("click", () => {
      elements.masterPasswordDialog.close();
    });

    elements.masterPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = elements.masterPasswordInput.value;
      const confirmation = elements.masterPasswordConfirmInput.value;

      try {
        if (password.length < 10) {
          throw new Error("Use at least 10 characters for the master password.");
        }

        if (state.masterMode === "setup" && password !== confirmation) {
          throw new Error("The master passwords do not match.");
        }

        if (state.masterMode === "setup") {
          await createVault(password);
        } else {
          await unlockVault(password);
        }

        elements.masterPasswordDialog.close();
      } catch (error) {
        elements.masterDialogError.textContent = error.message || "Unable to unlock vault.";
        elements.masterDialogError.classList.remove("hidden");
      }
    });

    elements.addCredentialButton.addEventListener("click", () => openCredentialDialog());
    elements.closeCredentialDialogButton.addEventListener("click", () => {
      elements.credentialDialog.close();
    });

    elements.cancelCredentialButton.addEventListener("click", () => {
      elements.credentialDialog.close();
    });

    elements.credentialForm.addEventListener("submit", saveCredential);
    elements.lockButton.addEventListener("click", () => lockVault());
    elements.vaultSearchInput.addEventListener("input", renderVault);
    elements.exportButton.addEventListener("click", exportBackup);

    elements.importInput.addEventListener("change", (event) => {
      importBackup(event.target.files[0]);
    });

    elements.vaultList.addEventListener("click", async (event) => {
      const copyId = event.target.dataset.copyId;
      const editId = event.target.dataset.editId;
      const deleteId = event.target.dataset.deleteId;

      if (copyId) {
        const credential = state.credentials.find((item) => item.id === copyId);
        if (credential) {
          await copyText(credential.password, "Password copied from vault.");
          resetInactivityTimer();
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

    ["click", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
  }

  async function init() {
    try {
      await PasswordVault.init();
      state.vaultSettings = await PasswordVault.getSettings();
      updateVaultUi();
      bindEvents();
      generatePassword();
      analyzePassword("");
      testPassword();

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      }
    } catch {
      showToast("Your browser could not initialize the encrypted vault.", "error");
    }
  }

  init();
})();
