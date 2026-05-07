# Decisions

## 2026-05-07 - Docs-first initialization

- Entscheidung: Das Projekt startet als lokales Git-Repo mit Discovery- und PRD-Geruest.
- Grund: Ohne Antworten zu Plattform, Offline-Nutzung, Datenbesitz und MVP waere ein App-Framework eine vorschnelle Festlegung.
- Konsequenz: Nach der Frageklaerung wird der Stack konkret gewaehlt und das App-Geruest aufgebaut.

## 2026-05-07 - MVP narrowed to Russian mobile PWA

- Decision: The first implementation target is a Russian-language PWA for phone use.
- Reason: The birthday deadline is tomorrow and the core pain is slow handwritten stock-card notes.
- Consequence: The MVP excludes honey sales and focuses on hive selection, adding hives, Russian voice/text note entry, done/next-task capture, local persistence, and per-hive history.

## 2026-05-07 - ElevenLabs STT via server proxy

- Decision: Voice transcription uses ElevenLabs Speech-to-Text through a Next.js API route.
- Reason: The API key must not be shipped to the browser, but the user wants to use an existing ElevenLabs key.
- Consequence: Notes and hive data stay in iPhone local storage, while recorded audio is sent to the server and then to ElevenLabs for transcription.
