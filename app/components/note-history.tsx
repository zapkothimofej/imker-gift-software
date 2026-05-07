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
          <div className={styles.marker} aria-hidden="true">
            <span>{notes.length - index}</span>
          </div>
          <div className={styles.body}>
            <time>{formatDate(note.createdAt)}</time>
            <div className={styles.columns}>
              {note.done ? (
                <section>
                  <h3>Сделано</h3>
                  <p>{note.done}</p>
                </section>
              ) : null}
              {note.next ? (
                <section>
                  <h3>Следующий осмотр</h3>
                  <p>{note.next}</p>
                </section>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
