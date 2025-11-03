import Dexie, { Table } from 'dexie';

export interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    body?: any;
    headers: Record<string, string>;
    timestamp: number;
    retryCount: number;
}

class AppDatabase extends Dexie {
    offlineQueue!: Table<QueuedRequest>;

    constructor() {
        super('CareerStackDB');
        this.init();
    }

    private init() {
        this.version(1).stores({
            offlineQueue: 'id, timestamp, retryCount'
        });
    }
}

export const db = new AppDatabase();