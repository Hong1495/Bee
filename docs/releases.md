# macOS arm64 releases

`npm run release:build` builds the app, DMG and signed updater archive, then writes
`latest.json` and SHA256SUMS under `release/<version>/` (ignored by Git).

The public updater key is in `src-tauri/tauri.conf.json`. Keep its corresponding
private key outside the repository, by default at
`~/.config/bee/release-keys/updater.key`, with mode 0600. Back this key up securely:
losing it prevents updates for installed clients. Never regenerate it for a
routine release. A custom path or key can be supplied through
`TAURI_SIGNING_PRIVATE_KEY`; encrypted keys also need
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Do not print or commit these values.

For each release:

1. Keep versions in package.json, Cargo.toml and tauri.conf.json aligned; refresh
   their lockfiles. Update `docs/release-notes.md`.
2. Run `npm run check` and `cargo test --manifest-path src-tauri/Cargo.toml`.
3. Build with `npm run release:build` on Apple Silicon. Verify the DMG, executable
   architecture, archive signature and generated manifest before uploading.
4. Commit changes, push main, and create a draft GitHub Release with tag
   `v<version>` targeting that commit. Upload every file from `release/<version>/`.
5. Publish the draft as the latest stable release after inspecting its assets.
   The app uses `releases/latest/download/latest.json`, compares versions, and
   verifies the archive signature before installation. Only darwin-aarch64 is
   advertised; never point an Intel target to this archive.

Automatic checks run three seconds after launch and every six hours when enabled.
Disabling the preference stops scheduled checks; manual checks remain available.
Checking never installs automatically. The user downloads/installs in the update
popover, then restarts explicitly. Queue and playback position are saved before
installation and restart. A failed check or download can be retried.

Updater signatures authenticate Bee update packages. They are distinct from
Apple Developer ID signing and notarization. This initial release has no Developer
ID certificate or Apple notarization; do not describe it as notarized. Install
Bee.app in a writable Applications folder before using in-app updates, rather
than running directly from the read-only DMG. Test a subsequent version using an
isolated copy of the installed app; do not replace a user's running app to test.
