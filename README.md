# Imker Gift Software

Ein Geburtstagsprojekt fuer eine persoenliche Imker-Software.

Der aktuelle Stand ist bewusst ein Discovery- und Planungsgeruest. Der konkrete App-Stack wird erst festgelegt, nachdem die wichtigsten Produkt-, Nutzungs- und Geraetefragen beantwortet sind.

## Ziele

- Ein echtes, nuetzliches Geschenk fuer den Imker-Alltag bauen.
- Die Arbeitsweise deines Vaters verstehen, bevor Features festgelegt werden.
- Offline-, Wetter-, Standort-, Datenschutz- und Bedienbarkeitsfragen frueh klaeren.
- Danach einen kleinen, stabilen MVP schneiden.

## MVP-Stand

- Russische PWA fuer das iPhone.
- Startbestand: Stoecke `1` bis `8`.
- Neue Stoecke koennen angelegt werden.
- Pro Stock werden `Сделано` und `В следующий раз` gespeichert.
- Notizen bleiben im lokalen Speicher des Handys.
- Spracheingabe laeuft ueber eine Server-Route zu ElevenLabs Speech-to-Text.
- Der ElevenLabs-Key liegt nur in `ELEVENLABS_API_KEY`, nicht im Browser-Code.

## Projektstruktur

- `docs/QUESTIONS.md` - priorisierte Fragenliste fuer die Produktklaerung.
- `docs/ANSWER-TEMPLATE.md` - Vorlage zum Beantworten der Fragen.
- `docs/PRD-DRAFT.md` - erster PRD-Rahmen, noch ohne finale Scope-Entscheidung.
- `docs/DECISIONS.md` - technische und produktbezogene Entscheidungen.
- `tests/smoke.test.mjs` - Repo-Smoke-Test fuer das initiale Geruest.

## Lokale Checks

```bash
npm install
npm test
npm run lint
npm run build
```

## Environment

```bash
cp .env.local.example .env.local
```

Danach `ELEVENLABS_API_KEY` setzen.
