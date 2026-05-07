import type { Hive } from "../lib/hive-state";
import styles from "./hive-selector.module.css";

type HiveSelectorProps = {
  error: string;
  hives: Hive[];
  newHiveName: string;
  selectedHiveId: string;
  onAddHive: () => void;
  onNewHiveNameChange: (name: string) => void;
  onRemoveHive: (hiveId: string) => void;
  onSelectHive: (hiveId: string) => void;
};

export function HiveSelector({
  error,
  hives,
  newHiveName,
  selectedHiveId,
  onAddHive,
  onNewHiveNameChange,
  onRemoveHive,
  onSelectHive
}: HiveSelectorProps) {
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
      {error ? <p className="error compact">{error}</p> : null}
    </section>
  );
}

