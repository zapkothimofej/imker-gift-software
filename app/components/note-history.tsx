import { formatDate, type Note } from "../lib/hive-state";
import styles from "./note-history.module.css";

type NoteHistoryProps = {
  notes: Note[];
};

export function NoteHistory({ notes }: NoteHistoryProps) {
  if (notes.length === 0) {
    return <p className="empty">Для этого улья пока нет записей.</p>;
  }

  return (
    <div className={styles.notes}>
      {notes.map((note, index) => (
        <article className={styles.note} key={note.id}>
          <header className={styles.header}>
            <span>Запись {notes.length - index}</span>
            <time>{formatDate(note.createdAt)}</time>
          </header>
          <div className={styles.body}>
            <div className={styles.sections}>
              {note.next ? (
                <section className={`${styles.block} ${styles.next}`}>
                  <h3>Следующий осмотр</h3>
                  <p>{note.next}</p>
                </section>
              ) : null}
              {note.done ? (
                <section className={styles.block}>
                  <h3>Сделано</h3>
                  <p>{note.done}</p>
                </section>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
