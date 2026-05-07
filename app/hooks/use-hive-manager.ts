import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createId, DEFAULT_HIVES, initialState, type Hive, type Note } from "../lib/hive-state";

type UseHiveManagerProps = {
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

function normalizeHiveName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function useHiveManager({ notes, setNotes, setStatus }: UseHiveManagerProps) {
  const [hives, setHives] = useState<Hive[]>(initialState.hives);
  const [selectedHiveId, setSelectedHiveId] = useState(DEFAULT_HIVES[0].id);
  const [newHiveName, setNewHiveName] = useState("");
  const [hiveError, setHiveError] = useState("");

  const selectedHive = hives.find((hive) => hive.id === selectedHiveId) ?? hives[0];
  const hiveNotes = useMemo(
    () => notes.filter((note) => note.hiveId === selectedHiveId),
    [notes, selectedHiveId]
  );

  function addHive() {
    const name = newHiveName.trim();
    if (!name) {
      setHiveError("Введите номер улья.");
      return;
    }

    const normalizedName = normalizeHiveName(name);
    const alreadyExists = hives.some((hive) => normalizeHiveName(hive.name) === normalizedName);

    if (alreadyExists) {
      setHiveError("Улей с таким номером уже есть.");
      return;
    }

    const hive = { id: createId("hive"), name };
    setHives((current) => [...current, hive]);
    setSelectedHiveId(hive.id);
    setNewHiveName("");
    setHiveError("");
    setStatus("Улей добавлен");
  }

  function renameHive(hiveId: string, nextName: string) {
    const name = nextName.trim();
    if (!name) {
      setHiveError("Введите номер улья.");
      return;
    }

    const normalizedName = normalizeHiveName(name);
    const alreadyExists = hives.some(
      (hive) => hive.id !== hiveId && normalizeHiveName(hive.name) === normalizedName
    );

    if (alreadyExists) {
      setHiveError("Улей с таким номером уже есть.");
      return;
    }

    setHives((current) =>
      current.map((hive) => (hive.id === hiveId ? { ...hive, name } : hive))
    );
    setHiveError("");
    setStatus("Улей переименован");
  }

  function removeHive(hiveId: string) {
    const hive = hives.find((current) => current.id === hiveId);
    if (!hive) return;

    if (hives.length <= 1) {
      setHiveError("Нельзя удалить последний улей.");
      return;
    }

    const hasNotes = notes.some((note) => note.hiveId === hiveId);
    const message = hasNotes
      ? `Удалить улей ${hive.name} и все его записи?`
      : `Удалить улей ${hive.name}?`;

    if (!window.confirm(message)) {
      return;
    }

    const remainingHives = hives.filter((current) => current.id !== hiveId);
    setHives(remainingHives);
    setNotes((current) => current.filter((note) => note.hiveId !== hiveId));

    if (selectedHiveId === hiveId) {
      setSelectedHiveId(remainingHives[0].id);
    }

    setHiveError("");
    setStatus("Улей удален");
  }

  function moveHive(hiveId: string, direction: -1 | 1) {
    const currentIndex = hives.findIndex((hive) => hive.id === hiveId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0) return;

    if (nextIndex < 0 || nextIndex >= hives.length) {
      setHiveError(direction < 0 ? "Этот улей уже первый." : "Этот улей уже последний.");
      return;
    }

    setHives((current) => {
      const reordered = [...current];
      [reordered[currentIndex], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[currentIndex]
      ];
      return reordered;
    });
    setHiveError("");
    setStatus("Порядок изменен");
  }

  return {
    addHive,
    hiveError,
    hiveNotes,
    hives,
    moveHive,
    newHiveName,
    removeHive,
    renameHive,
    selectedHive,
    selectedHiveId,
    setHiveError,
    setHives,
    setNewHiveName,
    setSelectedHiveId
  };
}
