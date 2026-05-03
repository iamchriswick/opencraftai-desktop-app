# OpenCraft AI Desktop

A cross-platform desktop companion app for [OpenCraft AI](https://opencraftai.com), built with [Tauri v2](https://v2.tauri.app/), React, and TypeScript.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| pnpm | latest | `npm i -g pnpm` |
| Rust | stable | https://rustup.rs |
| Tauri system deps | — | [Linux](https://v2.tauri.app/start/prerequisites/#linux) / [macOS](https://v2.tauri.app/start/prerequisites/#macos) / [Windows](https://v2.tauri.app/start/prerequisites/#windows) |

## Setup

```bash
# Install frontend dependencies
pnpm install
```

### Updater signing (required for production builds)

Generate a signing key pair (stored in the project-local `.tauri/` directory, which is gitignored):

```bash
pnpm tauri signer generate -w .tauri/opencraft-ai.key
```

Create a `.env` file in the project root (already gitignored):

```env
TAURI_SIGNING_PRIVATE_KEY_PATH=.tauri/opencraft-ai.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_key_password
```

The public key output goes into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

## Development

```bash
pnpm tauri dev
```

This starts the Vite dev server and opens the Tauri window. The frontend hot-reloads; Rust changes trigger a recompile.

## Building

```bash
pnpm tauri build
```

Produces platform-native installers in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| Windows | `.msi` and `.exe` (NSIS) |
| macOS | `.dmg` and `.app` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

Updater artifacts (`.sig` signature files) are also generated alongside each installer.

## Type-checking & Linting

```bash
# TypeScript
pnpm build          # runs tsc + vite build

# Rust
cd src-tauri
cargo clippy        # lint
cargo fmt           # format
```

## Project Structure

```
├── src/                    # React + TypeScript frontend
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   ├── lib.rs          # Commands, tray, hotkeys, autostart
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml
│   ├── tauri.conf.json     # App config, bundle settings, updater pubkey
│   └── capabilities/
│       └── default.json    # Permission scopes
├── src-icons/
│   └── icon.png            # Source icon (1024×1024) — do not overwrite
├── .env                    # Signing credentials (gitignored)
└── package.json
```

## Recommended IDE

[VS Code](https://code.visualstudio.com/) with:
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
