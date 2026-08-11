window.PasswordCrypto = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

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

  async function deriveKey(masterPassword, saltBase64) {
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
        salt: base64ToBytes(saltBase64),
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

  async function createKeyMaterial(masterPassword) {
    const salt = randomBytes(16);
    const saltBase64 = bytesToBase64(salt);
    const key = await deriveKey(masterPassword, saltBase64);

    return {
      salt: saltBase64,
      verification: await encryptString("Password Configurator vault verification", key)
    };
  }

  async function encryptString(value, key) {
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

  async function decryptString(payload, key) {
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

  async function verifyMasterPassword(masterPassword, salt, verification) {
    try {
      const key = await deriveKey(masterPassword, salt);
      const result = await decryptString(verification, key);

      return {
        valid: result === "Password Configurator vault verification",
        key
      };
    } catch {
      return {
        valid: false,
        key: null
      };
    }
  }

  return {
    bytesToBase64,
    base64ToBytes,
    randomBytes,
    deriveKey,
    createKeyMaterial,
    encryptString,
    decryptString,
    verifyMasterPassword
  };
})();
