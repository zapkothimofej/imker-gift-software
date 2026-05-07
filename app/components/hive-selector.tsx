import { useEffect, useRef, useState, type PointerEvent } from "react";
import { formatDate, type Hive, type Note } from "../lib/hive-state";
import styles from "./hive-selector.module.css";

type HiveSelectorProps = {
  error: string;
  hives: Hive[];
  notes: Note[];
  newHiveName: string;
  selectedHive: Hive | undefined;
  selectedHiveId: string;
  onAddHive: () => void;
  onNewHiveNameChange: (name: string) => void;
  onReorderHive: (hiveId: string, targetHiveId: string) => void;
  onRemoveHive: (hiveId: string) => void;
  onRenameHive: (hiveId: string, name: string) => void;
  onSelectHive: (hiveId: string) => void;
};

function formatNoteCount(count: number) {
  if (count === 0) return "нет записей";
  if (count % 10 === 1 && count % 100 !== 11) return `${count} запись`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} записи`;
  return `${count} записей`;
}

export function HiveSelector({
  error,
  hives,
  notes,
  newHiveName,
  selectedHive,
  selectedHiveId,
  onAddHive,
  onNewHiveNameChange,
  onReorderHive,
  onRemoveHive,
  onRenameHive,
  onSelectHive
}: HiveSelectorProps) {
  const [renameName, setRenameName] = useState(selectedHive?.name ?? "");
  const [draggingHiveId, setDraggingHiveId] = useState("");
  const [dropHiveId, setDropHiveId] = useState("");
  const dragStartRef = useRef<{ hiveId: string; x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    setRenameName(selectedHive?.name ?? "");
  }, [selectedHive?.id, selectedHive?.name]);

  function submitRename() {
    if (!selectedHive) return;
    onRenameHive(selectedHive.id, renameName);
  }

  function getHiveSummary(hiveId: string) {
    const hiveNotes = notes.filter((note) => note.hiveId === hiveId);
    const latestNote = hiveNotes.reduce<Note | undefined>(
      (latest, note) =>
        !latest || new Date(note.createdAt).getTime() > new Date(latest.createdAt).getTime() ? note : latest,
      undefined
    );

    return {
      count: hiveNotes.length,
      latest: latestNote ? formatDate(latestNote.createdAt) : ""
    };
  }

  const selectedHiveSummary = selectedHive ? getHiveSummary(selectedHive.id) : { count: 0, latest: "" };

  function findHiveIdAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY);
    return target instanceof HTMLElement ? target.closest<HTMLElement>("[data-hive-id]")?.dataset.hiveId : undefined;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, hiveId: string) {
    dragStartRef.current = { hiveId, x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    const distance = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
    if (distance < 8 && !didDragRef.current) return;

    didDragRef.current = true;
    setDraggingHiveId(dragStart.hiveId);

    const targetHiveId = findHiveIdAtPoint(event.clientX, event.clientY);
    setDropHiveId(targetHiveId && targetHiveId !== dragStart.hiveId ? targetHiveId : "");
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    const targetHiveId = findHiveIdAtPoint(event.clientX, event.clientY) ?? dropHiveId;
    if (didDragRef.current && targetHiveId && targetHiveId !== dragStart.hiveId) {
      onReorderHive(dragStart.hiveId, targetHiveId);
    } else if (!didDragRef.current) {
      onSelectHive(dragStart.hiveId);
    }

    dragStartRef.current = null;
    didDragRef.current = false;
    setDraggingHiveId("");
    setDropHiveId("");
  }

  return (
    <section className="panel" aria-labelledby="hive-title">
      <div className="section-head">
        <h2 id="hive-title">Пасека</h2>
        <span>{hives.length}</span>
      </div>
      <div className={styles.grid} role="list" aria-label="Ульи на пасеке">
        {hives.map((hive) => {
          const summary = getHiveSummary(hive.id);

          return (
            <div
              className={[
                styles.tile,
                hive.id === selectedHiveId ? styles.active : "",
                hive.id === draggingHiveId ? styles.dragging : "",
                hive.id === dropHiveId ? styles.dropTarget : ""
              ].filter(Boolean).join(" ")}
              data-hive-id={hive.id}
              key={hive.id}
              onPointerCancel={handlePointerUp}
              onPointerDown={(event) => handlePointerDown(event, hive.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              role="listitem"
            >
              <button
                aria-current={hive.id === selectedHiveId ? "true" : undefined}
                aria-label={hive.name}
                className={styles.select}
                onClick={() => onSelectHive(hive.id)}
                type="button"
              >
                <span className={styles.hiveName}>{hive.name}</span>
                <span aria-hidden="true" className={styles.hiveMeta}>
                  {formatNoteCount(summary.count)}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.addRow}>
        <input
          aria-label="Название нового улья"
          inputMode="text"
          onChange={(event) => onNewHiveNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAddHive();
          }}
          placeholder="Новый улей"
          value={newHiveName}
        />
        <button className={styles.addButton} onClick={onAddHive} type="button">
          Добавить
        </button>
      </div>
      {selectedHive ? (
        <div className={styles.detailCard}>
          <div className={styles.detailHead}>
            <div>
              <span className={styles.renameLabel}>Выбранный улей</span>
              <h3>Улей {selectedHive.name}</h3>
            </div>
            <span className={styles.detailCount}>
              {formatNoteCount(selectedHiveSummary.count)}
            </span>
          </div>
          {selectedHiveSummary.latest ? (
            <p className={styles.latestNote}>Последняя запись: {selectedHiveSummary.latest}</p>
          ) : null}
          <div className={styles.renameRow}>
            <input
              aria-label="Переименовать выбранный улей"
              inputMode="text"
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRename();
              }}
              value={renameName}
            />
            <button className={styles.renameButton} onClick={submitRename} type="button">
              Переименовать
            </button>
            <button
              aria-label={`Удалить улей ${selectedHive.name}`}
              className={styles.deleteButton}
              onClick={() => onRemoveHive(selectedHive.id)}
              type="button"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="error compact">{error}</p> : null}
    </section>
  );
}
