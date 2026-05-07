import { useEffect, useState } from "react";
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
  onRemoveHive,
  onRenameHive,
  onSelectHive
}: HiveSelectorProps) {
  const [renameName, setRenameName] = useState(selectedHive?.name ?? "");

  useEffect(() => {
    setRenameName(selectedHive?.name ?? "");
  }, [selectedHive?.id, selectedHive?.name]);

  function submitRename() {
    if (!selectedHive) return;
    onRenameHive(selectedHive.id, renameName);
  }

  return (
    <section className="panel" aria-labelledby="hive-title">
      <div className="section-head">
        <h2 id="hive-title">Ульи</h2>
        <span>{hives.length}</span>
      </div>
      <div className={styles.grid} role="list" aria-label="Список ульев">
        {hives.map((hive) => (
          <div className={hive.id === selectedHiveId ? `${styles.tile} ${styles.active}` : styles.tile} key={hive.id} role="listitem">
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
