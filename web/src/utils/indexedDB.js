import { openDB } from 'idb';

const DB_NAME = 'CopilotoTatico_DB';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks', { autoIncrement: true });
      }
    },
  });
};

export const saveChunk = async (chunk) => {
  const db = await initDB();
  await db.add('chunks', chunk);
};

export const getAndClearChunks = async () => {
  const db = await initDB();
  const chunks = await db.getAll('chunks');
  await db.clear('chunks');
  return chunks;
};
