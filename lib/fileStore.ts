// 독서록·결과물·성적표 같은 파일을 브라우저 IndexedDB에 둔다 (localStorage는 작아서).
// 운영 단계에서는 같은 함수 이름으로 Supabase Storage로 바꾼다.
const DB = 'hils-hub-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
};

export async function putFile(file: Blob, id = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  await tx('readwrite', s => s.put(file, id));
  return id;
}
export const getFile = (id: string) => tx<Blob | undefined>('readonly', s => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteFile = (id: string) => tx('readwrite', s => s.delete(id));

export async function openFile(id: string, name: string) {
  const b = await getFile(id);
  if (!b) { alert('파일을 찾을 수 없습니다 (다른 브라우저에서 올린 파일일 수 있습니다)'); return; }
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
