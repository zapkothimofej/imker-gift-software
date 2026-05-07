export type Note = {
  id: string;
  hiveId: string;
  done: string;
  next: string;
  createdAt: string;
};

export type Hive = {
  id: string;
  name: string;
};

export type StoredState = {
  hives: Hive[];
  notes: Note[];
};

export const STORAGE_KEY = "imker-pwa-state-v1";

export const DEFAULT_HIVES: Hive[] = Array.from({ length: 8 }, (_, index) => ({
  id: `hive-${index + 1}`,
  name: `${index + 1}`
}));

export const initialState: StoredState = {
  hives: DEFAULT_HIVES,
  notes: []
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

