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

## Getting Started

The application is ready to run. To explore the code, a good starting point is `src/app/page.tsx`.

## Building the App

This project is configured with Capacitor to be deployed as a native Android application. The APK is built automatically via a GitHub Action workflow defined in `.github/workflows/main.yml`. A new build is triggered on every push to the `main` branch.
