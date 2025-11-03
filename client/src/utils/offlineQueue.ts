// client/src/lib/db.ts
// Minimal IndexedDB wrapper for an "offlineQueue" object store.
// Provides: add, toArray, delete, update

const DB_NAME = 'careerstack-db';
const DB_VERSION = 1;
const STORE_NAME = 'offlineQueue';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
            // If needed, handle blocked state
            console.warn('IndexedDB open blocked');
        };
    });
}

function transactionPromise(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
        tx.onerror = () => reject(tx.error ?? new Error('Transaction error'));
    });
}

async function add(item: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(item);
    await transactionPromise(tx);
    db.close();
}

async function toArray(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
            resolve(req.result ?? []);
            db.close();
        };
        req.onerror = () => {
            reject(req.error);
            db.close();
        };
    });
}

async function remove(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await transactionPromise(tx);
    db.close();
}

async function update(id: string, changes: Partial<any>): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get(id);
    await new Promise<void>((resolve, reject) => {
        getReq.onsuccess = () => {
            const existing = getReq.result ?? {};
            const updated = { ...existing, ...changes };
            const putReq = store.put(updated);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });

    await transactionPromise(tx);
    db.close();
}

export const db = {
    offlineQueue: {
        add,
        toArray,
        delete: remove,
        update,
    },
};

export interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    body?: any;
    headers: Record<string, string>;
    timestamp: number;
    retryCount: number;
}

class OfflineQueue {
    private static instance: OfflineQueue;
    private isProcessing: boolean = false;

    static getInstance(): OfflineQueue {
        if (!OfflineQueue.instance) {
            OfflineQueue.instance = new OfflineQueue();
        }
        return OfflineQueue.instance;
    }

    async addToQueue(request: Request): Promise<void> {
        const queuedRequest: QueuedRequest = {
            id: crypto.randomUUID(),
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            timestamp: Date.now(),
            retryCount: 0
        };

        if (request.method !== 'GET') {
            queuedRequest.body = await request.clone().text();
        }

        await db.offlineQueue.add(queuedRequest);
    }

    async processQueue(): Promise<void> {
        if (this.isProcessing || !navigator.onLine) return;

        this.isProcessing = true;
        try {
            const queue = await db.offlineQueue.toArray();
            
            for (const item of queue) {
                try {
                    const response = await fetch(new Request(item.url, {
                        method: item.method,
                        headers: item.headers,
                        body: item.body,
                        credentials: 'include'
                    }));

                    if (response.ok) {
                        await db.offlineQueue.delete(item.id);
                    } else {
                        await this.handleFailedRequest(item);
                    }
                } catch (error) {
                    await this.handleFailedRequest(item);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private async handleFailedRequest(item: QueuedRequest): Promise<void> {
        if (item.retryCount >= 3) {
            await db.offlineQueue.delete(item.id);
            // Log failed request for manual recovery if needed
            console.error('Request failed after 3 retries:', item);
            return;
        }

        await db.offlineQueue.update(item.id, {
            retryCount: item.retryCount + 1,
            timestamp: Date.now()
        });
    }
}

export const offlineQueue = OfflineQueue.getInstance();