import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Hive } from "../lib/hive-state";
import styles from "./hive-selector.module.css";

type HiveSelectorProps = {
  error: string;
  hives: Hive[];
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

export function HiveSelector({
  error,
  hives,
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

  function findHiveIdAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY);
    return target instanceof HTMLElement ? target.closest<HTMLElement>("[data-hive-id]")?.dataset.hiveId : undefined;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, hiveId: string) {
    if (event.target instanceof HTMLElement && event.target.closest("button[aria-label^='Удалить']")) {
      return;
    }

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
        <h2 id="hive-title">Ульи</h2>
        <span>{hives.length}</span>
      </div>
      <div className={styles.grid} role="list" aria-label="Список ульев">
        {hives.map((hive) => (
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
            <button className={styles.select} onClick={() => onSelectHive(hive.id)} type="button">
              {hive.name}
            </button>
            <button
              aria-label={`Удалить улей ${hive.name}`}
              className={styles.delete}
              onClick={() => onRemoveHive(hive.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
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
        <button onClick={onAddHive} type="button">
          Добавить
        </button>
      </div>
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
        <button onClick={submitRename} type="button">
          Переименовать
        </button>
      </div>
      {error ? <p className="error compact">{error}</p> : null}
    </section>
  );
}
