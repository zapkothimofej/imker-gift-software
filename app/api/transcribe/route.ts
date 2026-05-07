import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY не настроен на сервере." },
      { status: 500 }
    );
  }

  const inbound = await request.formData().catch(() => null);

  if (!inbound) {
    return NextResponse.json({ error: "Неверный формат аудиозапроса." }, { status: 400 });
  }

  const audio = inbound.get("audio");

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Аудиофайл не найден." }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append("model_id", "scribe_v2");
  outbound.append("language_code", "ru");
  outbound.append("tag_audio_events", "false");
  outbound.append("no_verbatim", "true");
  outbound.append("file", audio, audio.name || "recording.webm");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: outbound
  });

  const payload = (await response.json().catch(() => null)) as { text?: string; detail?: unknown } | null;

  if (!response.ok) {
    return NextResponse.json(
      { error: "ElevenLabs не смог распознать аудио.", detail: payload?.detail },
      { status: response.status }
    );
  }

  return NextResponse.json({ text: payload?.text?.trim() ?? "" });
}
