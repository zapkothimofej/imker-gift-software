"use client";

import { useEffect, useRef, useState } from "react";
import { HiveSelector } from "./components/hive-selector";
import { NoteHistory } from "./components/note-history";
import { VoiceWave } from "./components/voice-wave";
import { useHiveManager } from "./hooks/use-hive-manager";
import { createId, STORAGE_KEY, type Note, type StoredState } from "./lib/hive-state";

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [done, setDone] = useState("");
  const [next, setNext] = useState("");
  const [targetField, setTargetField] = useState<"done" | "next">("done");
  const [activeView, setActiveView] = useState<"hives" | "record" | "notes">("record");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState("Готово к записи");
  const [recordError, setRecordError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hiveManager = useHiveManager({ notes, setNotes, setStatus });
  const pageTitle =
    activeView === "hives" ? "Пасека" : activeView === "record" ? "Новая запись" : "Журнал";
  const hasDraft = Boolean(done.trim() || next.trim());

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as StoredState;
      if (Array.isArray(parsed.hives) && parsed.hives.length > 0) {
        hiveManager.setHives(parsed.hives);
        setNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
        hiveManager.setSelectedHiveId(parsed.hives[0].id);
      }
    } catch {
      hiveManager.setHiveError("Не удалось прочитать сохраненные данные.");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hives: hiveManager.hives, notes }));
  }, [hiveManager.hives, notes]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  function saveNote() {
    const cleanDone = done.trim();
    const cleanNext = next.trim();

    if (!hiveManager.selectedHive || (!cleanDone && !cleanNext)) {
      setRecordError("Выберите улей и добавьте запись.");
      return;
    }

    setNotes((current) => [
      {
        id: createId("note"),
        hiveId: hiveManager.selectedHive.id,
        done: cleanDone,
        next: cleanNext,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    setDone("");
    setNext("");
    setRecordError("");
    setStatus("Запись сохранена");
    setActiveView("notes");
  }

  function appendTranscript(text: string) {
    const setter = targetField === "done" ? setDone : setNext;
    setter((current) => [current, text].filter(Boolean).join(current ? " " : ""));
  }

  async function transcribeAudio(audio: Blob) {
    setTranscribing(true);
    setStatus("Распознаю речь...");

    const formData = new FormData();
    formData.append("audio", audio, `recording.${audio.type.includes("mp4") ? "mp4" : "webm"}`);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData
    });

    const result = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || !result.text) {
      throw new Error(result.error ?? "Распознавание не удалось.");
    }

    appendTranscript(result.text);
    setStatus("Текст добавлен");
  }

  async function startRecording() {
    setRecordError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordError("Запись голоса не поддерживается в этом браузере. Используйте текстовое поле.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        transcribeAudio(audio)
          .catch((caught: unknown) => {
            setRecordError(caught instanceof Error ? caught.message : "Ошибка распознавания.");
            setStatus("Ошибка");
          })
          .finally(() => setTranscribing(false));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setStatus("Идет запись...");
    } catch {
      setRecordError("Не удалось получить доступ к микрофону.");
      setStatus("Нет доступа к микрофону");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  return (
    <main className="shell">
      <header className="app-header" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Пасека</p>
          <h1 id="app-title">{pageTitle}</h1>
        </div>
        {activeView !== "hives" ? (
          <label className="hive-switcher">
            <span>Выбранный улей</span>
            <select
              aria-label="Выбранный улей"
              onChange={(event) => hiveManager.setSelectedHiveId(event.target.value)}
              value={hiveManager.selectedHiveId}
            >
              {hiveManager.hives.map((hive) => (
                <option key={hive.id} value={hive.id}>
                  Улей {hive.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {activeView === "hives" ? (
        <HiveSelector
          error={hiveManager.hiveError}
          hives={hiveManager.hives}
          notes={notes}
          newHiveName={hiveManager.newHiveName}
          onAddHive={hiveManager.addHive}
          onNewHiveNameChange={hiveManager.setNewHiveName}
          onReorderHive={hiveManager.reorderHive}
          onRemoveHive={hiveManager.removeHive}
          onRenameHive={hiveManager.renameHive}
          onSelectHive={hiveManager.setSelectedHiveId}
          selectedHive={hiveManager.selectedHive}
          selectedHiveId={hiveManager.selectedHiveId}
        />
      ) : null}

      {activeView === "record" ? (
        <section className="panel recorder" aria-labelledby="record-title">
          <div className="section-head">
            <h2 id="record-title">Улей {hiveManager.selectedHive?.name}</h2>
            <span>{status}</span>
          </div>

          <div className="segmented" role="group" aria-label="Раздел записи">
            <button
              className={targetField === "done" ? "active" : ""}
              onClick={() => setTargetField("done")}
              type="button"
            >
              Сделано
            </button>
            <button
              className={targetField === "next" ? "active" : ""}
              onClick={() => setTargetField("next")}
              type="button"
            >
              Следующий осмотр
            </button>
          </div>

          <button
            className={recording ? "record-button recording" : "record-button"}
            disabled={transcribing}
            onClick={recording ? stopRecording : startRecording}
            type="button"
          >
            <VoiceWave active={recording || transcribing} />
            <span>{recording ? "Остановить" : transcribing ? "Распознаю..." : "Диктовать"}</span>
          </button>

          <div className="field-grid">
            <label className={targetField === "done" ? "entry-field active" : "entry-field"}>
              <span>Сделано</span>
              <textarea
                onChange={(event) => setDone(event.target.value)}
                placeholder="Например: проверил рамки, добавил вощину..."
                value={done}
              />
            </label>
            <label className={targetField === "next" ? "entry-field active" : "entry-field"}>
              <span>Следующий осмотр</span>
              <textarea
                onChange={(event) => setNext(event.target.value)}
                placeholder="Например: проверить корм, посмотреть матку..."
                value={next}
              />
            </label>
          </div>

          <button
            className={hasDraft ? "save-button ready" : "save-button"}
            disabled={!hasDraft}
            onClick={saveNote}
            type="button"
          >
            Сохранить запись
          </button>

          {recordError ? <p className="error">{recordError}</p> : null}
        </section>
      ) : null}

      {activeView === "notes" ? (
        <section className="panel" aria-labelledby="history-title">
          <div className="section-head">
            <h2 id="history-title">Журнал</h2>
            <span>{hiveManager.hiveNotes.length}</span>
          </div>
          <NoteHistory notes={hiveManager.hiveNotes} />
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Основные разделы">
        <button
          aria-current={activeView === "notes" ? "page" : undefined}
          onClick={() => setActiveView("notes")}
          type="button"
        >
          Журнал
        </button>
        <button
          aria-current={activeView === "record" ? "page" : undefined}
          onClick={() => setActiveView("record")}
          type="button"
        >
          Диктовка
        </button>
        <button
          aria-current={activeView === "hives" ? "page" : undefined}
          onClick={() => setActiveView("hives")}
          type="button"
        >
          Пасека
        </button>
      </nav>
    </main>
  );
}
