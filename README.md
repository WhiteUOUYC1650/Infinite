# Infinite Messenger

Infinite is a modern, real-time chat application built with Next.js, Firebase, and Tailwind CSS. It's designed to be a fast, secure, and feature-rich communication platform.

## Features

- **Real-time Messaging:** Instant messaging in direct messages, groups, and channels.
- **User Authentication:** Secure sign-up and login with email and password.
- **User Profiles:** Customizable nicknames and status messages.
- **Online Status:** See when users are online, away, or offline.
- **Groups & Channels:** Create public or private groups and broadcast channels with unique links.
- **Bot Integration:** An official "Infinite" bot that welcomes new users and greets returning ones.
- **Global Search:** Find users, groups, and channels by name or unique link.
- **Markdown Support:** Format your messages with Markdown.
- **Theming:** Switch between light/dark mode and multiple color themes.
- **Multi-language Support:** Available in English and Russian.
- **Admin Panel:** A dedicated panel for administrators to manage users and chats.

## Editions (Infinite 3.0 "Redesign")

The Android build produces **three editions of the same app** (same code, same libraries —
only the design layer differs). The edition is baked in at build time, never at runtime:

| Edition | Artifact | Package | Design | minSdk |
| --- | --- | --- | --- | --- |
| Material 3 | `infinite-material3-apk` | `com.infinite.chat` | Material You: tonal surfaces, pill controls, bottom sheets | 23 |
| Material 2 | `infinite-material2-apk` | `com.infinite.chat.m2` | Material Design 2: colored app bar, 4dp cards, uppercase buttons | 21 (Android 5.0+) |
| Classic 1.5 | `infinite-classic-apk` | `com.infinite.chat.classic` | The classic Infinite 1.5 interface | 23 |

All three are built by `.github/workflows/main.yml`. The workflow runs on pushes and
pull requests to `main`, and can also be started **manually**: Actions →
"Build Infinite APKs …" → *Run workflow* (optionally choose a single edition).

Locally:

```bash
NEXT_PUBLIC_INFINITE_EDITION=material3 npm run build   # Material 3 edition
NEXT_PUBLIC_INFINITE_EDITION=material2 npm run build   # Material 2 edition
npm run build                                          # Classic 1.5 (default, also the web build)
```

All Material 3 styles live in `src/app/globals.css` behind `[data-material3="true"]`,
Material 2 styles behind `[data-material2="true"]`; those attributes are set only by the
corresponding editions, so the classic interface is untouched in the other two builds.

### CI workflow: `.github/workflows/main.yml`

The three-edition build is defined in `.github/workflows/main.yml`. A copy of that
workflow is kept in [`docs/ci/main.yml`](docs/ci/main.yml) so it can be restored
with a single copy if the GitHub App token used for automation has no `workflows`
permission:

```bash
cp docs/ci/main.yml .github/workflows/main.yml
git commit -am "ci: build Material 3 + Classic editions"
git push
```
