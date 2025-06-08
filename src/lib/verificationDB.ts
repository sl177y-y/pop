interface VerificationState {
  vaultId: number;
  twitterFollow: boolean;
  twitterFollowCluster: boolean;
  retweet: boolean;
  like: boolean;
  tweet: boolean;
  telegram: boolean;
  discord: boolean;
  linkedin: boolean;
  lastUpdated: number;
}

class VerificationDB {
  private dbName = 'CandyShopVerifications';
  private version = 2;
  private storeName = 'verifications';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'vaultId' });
          store.createIndex('vaultId', 'vaultId', { unique: true });
        }
      };
    });
  }

  async getVerificationState(vaultId: number): Promise<VerificationState | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(vaultId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch (error) {
      console.error('[VerificationDB] Error getting verification state:', error);
      return null;
    }
  }

  async setVerificationState(vaultId: number, updates: Partial<Omit<VerificationState, 'vaultId' | 'lastUpdated'>>): Promise<boolean> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Get existing state or create new one
      const existing = await this.getVerificationState(vaultId);
      const newState: VerificationState = {
        vaultId,
        twitterFollow: false,
        twitterFollowCluster: false,
        retweet: false,
        like: false,
        tweet: false,
        telegram: false,
        discord: false,
        linkedin: false,
        ...existing,
        ...updates,
        lastUpdated: Date.now()
      };

      return new Promise((resolve, reject) => {
        const request = store.put(newState);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          console.log('[VerificationDB] Updated verification state for vault:', vaultId, updates);
          resolve(true);
        };
      });
    } catch (error) {
      console.error('[VerificationDB] Error setting verification state:', error);
      return false;
    }
  }

  async initializeVaultState(vaultId: number): Promise<VerificationState> {
    const existing = await this.getVerificationState(vaultId);
    if (existing) {
      return existing;
    }

    const initialState: VerificationState = {
      vaultId,
      twitterFollow: false,
      twitterFollowCluster: false,
      retweet: false,
      like: false,
      tweet: false,
      telegram: false,
      discord: false,
      linkedin: false,
      lastUpdated: Date.now()
    };

    await this.setVerificationState(vaultId, initialState);
    console.log('[VerificationDB] Initialized verification state for vault:', vaultId);
    return initialState;
  }

  async resetVerificationState(vaultId: number): Promise<boolean> {
    try {
      const resetState = {
        twitterFollow: false,
        twitterFollowCluster: false,
        retweet: false,
        like: false,
        tweet: false,
        telegram: false,
        discord: false,
        linkedin: false
      };
      
      return await this.setVerificationState(vaultId, resetState);
    } catch (error) {
      console.error('[VerificationDB] Error resetting verification state:', error);
      return false;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          console.log('[VerificationDB] Cleared all verification data');
          resolve(true);
        };
      });
    } catch (error) {
      console.error('[VerificationDB] Error clearing data:', error);
      return false;
    }
  }
}

export const verificationDB = new VerificationDB();
export type { VerificationState }; 