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

  function reorderHive(hiveId: string, targetHiveId: string) {
    const currentIndex = hives.findIndex((hive) => hive.id === hiveId);
    const targetIndex = hives.findIndex((hive) => hive.id === targetHiveId);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return;

    setHives((current) => {
      const reordered = [...current];
      const [movedHive] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, movedHive);
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
    newHiveName,
    reorderHive,
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
