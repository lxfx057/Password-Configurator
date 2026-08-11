window.PasswordVault = (() => {
  const DATABASE_NAME = "password-configurator-vault";
  const DATABASE_VERSION = 1;
  const SETTINGS_STORE = "settings";
  const CREDENTIALS_STORE = "credentials";

  let database = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        database = request.result;

        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains(CREDENTIALS_STORE)) {
          database.createObjectStore(CREDENTIALS_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        database = request.result;
        resolve(database);
      };

      request.onerror = () => reject(request.error);
    });
  }

  function getStore(storeName, mode = "readonly") {
    const transaction = database.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function init() {
    if (!database) {
      await openDatabase();
    }
  }

  async function getSettings() {
    await init();
    const result = await requestToPromise(getStore(SETTINGS_STORE).get("vault-settings"));
    return result ? result.value : null;
  }

  async function saveSettings(value) {
    await init();
    return requestToPromise(
      getStore(SETTINGS_STORE, "readwrite").put({
        key: "vault-settings",
        value
      })
    );
  }

  async function getAllCredentialRecords() {
    await init();
    return requestToPromise(getStore(CREDENTIALS_STORE).getAll());
  }

  async function saveCredentialRecord(record) {
    await init();
    return requestToPromise(getStore(CREDENTIALS_STORE, "readwrite").put(record));
  }

  async function deleteCredentialRecord(id) {
    await init();
    return requestToPromise(getStore(CREDENTIALS_STORE, "readwrite").delete(id));
  }

  async function clearAll() {
    await init();

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [SETTINGS_STORE, CREDENTIALS_STORE],
        "readwrite"
      );

      transaction.objectStore(SETTINGS_STORE).clear();
      transaction.objectStore(CREDENTIALS_STORE).clear();

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    init,
    getSettings,
    saveSettings,
    getAllCredentialRecords,
    saveCredentialRecord,
    deleteCredentialRecord,
    clearAll
  };
})();
