"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NoteHistory } from "./components/note-history";
import { VoiceWave } from "./components/voice-wave";
import {
  createId,
  DEFAULT_HIVES,
  initialState,
  STORAGE_KEY,
  type Hive,
  type Note,
  type StoredState
} from "./lib/hive-state";

export default function Home() {
  const [hives, setHives] = useState<Hive[]>(initialState.hives);
  const [notes, setNotes] = useState<Note[]>(initialState.notes);
  const [selectedHiveId, setSelectedHiveId] = useState(DEFAULT_HIVES[0].id);
  const [newHiveName, setNewHiveName] = useState("");
  const [done, setDone] = useState("");
  const [next, setNext] = useState("");
  const [targetField, setTargetField] = useState<"done" | "next">("done");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState("Готово к записи");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as StoredState;
      if (Array.isArray(parsed.hives) && parsed.hives.length > 0) {
        setHives(parsed.hives);
        setNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
        setSelectedHiveId(parsed.hives[0].id);
      }
    } catch {
      setError("Не удалось прочитать сохраненные данные.");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hives, notes }));
  }, [hives, notes]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const selectedHive = hives.find((hive) => hive.id === selectedHiveId) ?? hives[0];
  const hiveNotes = useMemo(
    () => notes.filter((note) => note.hiveId === selectedHiveId),
    [notes, selectedHiveId]
  );

  function addHive() {
    const name = newHiveName.trim();
    if (!name) return;

    const hive = { id: createId("hive"), name };
    setHives((current) => [...current, hive]);
    setSelectedHiveId(hive.id);
    setNewHiveName("");
  }

  function saveNote() {
    const cleanDone = done.trim();
    const cleanNext = next.trim();

    if (!selectedHive || (!cleanDone && !cleanNext)) {
      setError("Выберите улей и добавьте запись.");
      return;
    }

    setNotes((current) => [
      {
        id: createId("note"),
        hiveId: selectedHive.id,
        done: cleanDone,
        next: cleanNext,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    setDone("");
    setNext("");
    setError("");
    setStatus("Запись сохранена");
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
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Запись голоса не поддерживается в этом браузере. Используйте текстовое поле.");
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
            setError(caught instanceof Error ? caught.message : "Ошибка распознавания.");
            setStatus("Ошибка");
          })
          .finally(() => setTranscribing(false));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setStatus("Идет запись...");
    } catch {
      setError("Не удалось получить доступ к микрофону.");
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
      <section className="hero" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Пасека</p>
          <h1 id="app-title">Записи по ульям</h1>
        </div>
        <p className="hero-text">Выберите улей, продиктуйте заметку и сохраните, что сделано и что нужно проверить в следующий раз.</p>
      </section>

      <section className="panel" aria-labelledby="hive-title">
        <div className="section-head">
          <h2 id="hive-title">Ульи</h2>
          <span>{hives.length}</span>
        </div>
        <div className="hive-grid" role="list" aria-label="Список ульев">
          {hives.map((hive) => (
            <button
              className={hive.id === selectedHiveId ? "hive-button active" : "hive-button"}
              key={hive.id}
              onClick={() => setSelectedHiveId(hive.id)}
              type="button"
            >
              {hive.name}
            </button>
          ))}
        </div>
        <div className="add-row">
          <input
            aria-label="Название нового улья"
            inputMode="text"
            onChange={(event) => setNewHiveName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addHive();
            }}
            placeholder="Новый улей"
            value={newHiveName}
          />
          <button onClick={addHive} type="button">
            Добавить
          </button>
        </div>
      </section>

      <section className="panel recorder" aria-labelledby="record-title">
        <div className="section-head">
          <h2 id="record-title">Улей {selectedHive?.name}</h2>
          <span>{status}</span>
        </div>

        <div className="segmented" role="group" aria-label="Куда добавить диктовку">
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
            В следующий раз
          </button>
        </div>

        <button
          className={recording ? "record-button recording" : "record-button"}
          disabled={transcribing}
          onClick={recording ? stopRecording : startRecording}
          type="button"
        >
          <VoiceWave active={recording || transcribing} />
          <span>{recording ? "Остановить" : transcribing ? "Распознаю..." : "Говорить"}</span>
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
            <span>В следующий раз</span>
            <textarea
              onChange={(event) => setNext(event.target.value)}
              placeholder="Например: проверить корм, посмотреть матку..."
              value={next}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <button className="save-button" onClick={saveNote} type="button">
          Сохранить запись
        </button>
      </section>

      <section className="panel" aria-labelledby="history-title">
        <div className="section-head">
          <h2 id="history-title">История</h2>
          <span>{hiveNotes.length}</span>
        </div>
        <NoteHistory notes={hiveNotes} />
      </section>
    </main>
  );
}
