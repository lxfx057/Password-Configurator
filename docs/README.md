# 🔐 Password Configurator

A private, local-first password tool for generating, analyzing, testing and securely saving credentials.

## ✨ Features

- 🎲 Secure password generator powered by `crypto.getRandomValues()`
- 📊 Live password analysis with score, entropy estimate and practical suggestions
- ✅ Requirement tester for length, uppercase, lowercase, numbers, symbols and forbidden characters
- 🔒 Local encrypted vault using AES-GCM
- 🗝️ Master password key derivation with PBKDF2
- 💾 Encrypted credential storage in IndexedDB
- 📦 Encrypted JSON backup export and import
- 📴 No account, backend, tracker or cloud database
- 📱 Responsive macOS-inspired interface

## 🛡️ Privacy

Passwords are generated and analyzed entirely in the browser.

Saved credentials are encrypted with AES-GCM before being stored in IndexedDB. The master password is never stored and cannot be recovered.

## 🚀 Run locally

No installation is required.

1. Download or clone this repository
2. Keep all files in the same folder
3. Open `index.html` in a modern browser

For the best browser support, deploy it with GitHub Pages or Vercel.

## 🌐 Deploy on Vercel

1. Import the GitHub repository into Vercel
2. Leave the framework preset as `Other`
3. Do not add a build command
4. Deploy

The project is static, so Vercel will serve `index.html` directly.

## 📁 Project files

```text
index.html            Main interface
styles.css            macOS-inspired UI
app.js                Generator, analyzer, tester and interface logic
crypto.js             PBKDF2 and AES-GCM utilities
vault.js              IndexedDB storage layer
manifest.webmanifest  Progressive web app metadata
favicon.svg           App icon
```

## ⚠️ Important

- Use a unique and long master password.
- Do not forget the master password: it cannot be recovered.
- Keep encrypted backup files in a safe place.
- This tool does not protect a compromised device, malicious browser extensions or malware.
