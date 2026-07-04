const STORAGE_KEY = 'knittingpro_projects';

function isWeb() {
  return typeof document !== 'undefined';
}

function getStorage() {
  if (isWeb()) {
    return {
      async getItem(key) {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      },
      async setItem(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
      },
      async removeItem(key) {
        localStorage.removeItem(key);
      },
    };
  }
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
}

export async function listProjects() {
  const store = getStorage();
  const data = await store.getItem(STORAGE_KEY);
  return data || [];
}

export async function saveProject(name, projectData) {
  const store = getStorage();
  const list = await listProjects();
  const now = new Date().toISOString();
  const existing = list.findIndex(p => p.name === name);
  const entry = { name, date: now, key: `${STORAGE_KEY}_${name}` };
  if (existing >= 0) {
    list[existing] = { ...list[existing], date: now };
  } else {
    list.push(entry);
  }
  await store.setItem(STORAGE_KEY, list);
  await store.setItem(entry.key, projectData);
  return entry;
}

export async function loadProject(name) {
  const store = getStorage();
  const list = await listProjects();
  const found = list.find(p => p.name === name);
  if (!found) return null;
  return await store.getItem(found.key);
}

export async function deleteProject(name) {
  const store = getStorage();
  const list = await listProjects();
  const idx = list.findIndex(p => p.name === name);
  if (idx < 0) return;
  const entry = list[idx];
  await store.removeItem(entry.key);
  list.splice(idx, 1);
  await store.setItem(STORAGE_KEY, list);
}

export async function renameProject(oldName, newName) {
  const store = getStorage();
  const list = await listProjects();
  const idx = list.findIndex(p => p.name === oldName);
  if (idx < 0) return;
  const entry = list[idx];
  const data = await store.getItem(entry.key);
  await store.removeItem(entry.key);
  entry.name = newName;
  entry.key = `${STORAGE_KEY}_${newName}`;
  entry.date = new Date().toISOString();
  list[idx] = entry;
  await store.setItem(STORAGE_KEY, list);
  if (data) await store.setItem(entry.key, data);
}
