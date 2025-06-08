const DB_NAME = 'VerificationDB';
const STORE_NAME = 'verificationStatus';
const DB_VERSION = 2;

export interface VerificationStatus {
  vaultId: string;
  twitterFollowVerified?: boolean;
  twitterFollowVerifiedTimestamp?: Date;
  twitterFollowClusterVerified?: boolean;
  twitterFollowClusterVerifiedTimestamp?: Date;
  retweetVerified?: boolean;
  retweetVerifiedTimestamp?: Date;
  twitterLikeVerified?: boolean;
  twitterLikeVerifiedTimestamp?: Date;
  secondRetweetVerified?: boolean;
  secondRetweetVerifiedTimestamp?: Date;
  secondTwitterLikeVerified?: boolean;
  secondTwitterLikeVerifiedTimestamp?: Date;
  tweetPostedVerified?: boolean;
  tweetPostedVerifiedTimestamp?: Date;
  telegramVerified?: boolean;
  telegramVerifiedTimestamp?: Date;
  discordVerified?: boolean;
  discordVerifiedTimestamp?: Date;
  linkedinVerified?: boolean;
  linkedinVerifiedTimestamp?: Date;
  extraLinkVerified?: boolean;
  extraLinkVerifiedTimestamp?: Date;
  allStepsVerified?: boolean; // To replace verified_${selectedVaultId}
  allStepsVerifiedTimestamp?: Date;
  creditsAwarded?: boolean; // Track if credits have been awarded for this vault
  creditsAwardedTimestamp?: Date;
  // We can remove retweetClicked as it's more of a UI flow state than a persistent verification
}

let db: IDBDatabase | null = null;
let dbInitializationPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (db) {
    return Promise.resolve(db);
  }

  if (dbInitializationPromise) {
    return dbInitializationPromise;
  }

  dbInitializationPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error during open:', request.error);
      dbInitializationPromise = null; // Allow retry on next call
      reject(`Error opening IndexedDB: ${request.error?.message}`);
    };

    request.onsuccess = () => {
      console.log('IndexedDB opened successfully.');
      db = request.result;
      // The promise (dbInitializationPromise) will be resolved with this db instance.
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('IndexedDB upgrade needed.');
      const tempDb = (event.target as IDBOpenDBRequest).result;
      if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
        try {
          tempDb.createObjectStore(STORE_NAME, { keyPath: 'vaultId' });
          console.log(`Object store '${STORE_NAME}' created successfully.`);
        } catch (e) {
          console.error(`Error creating object store '${STORE_NAME}':`, e);
          // If store creation fails, we should probably reject the main promise
          // dbInitializationPromise = null; // Allow retry
          // reject(`Error creating object store: ${(e as Error).message}`);
          // Note: Rejecting here might be tricky if onsuccess still fires.
          // For now, log error. The transaction will fail later if store isn't there.
        }
      } else {
        console.log(`Object store '${STORE_NAME}' already exists.`);
      }
      // The onupgradeneeded event completes, and then onsuccess will be called.
    };
  });

  return dbInitializationPromise;
};

export const getVerificationStatus = async (vaultId: string): Promise<VerificationStatus | null> => {
  if (!vaultId) return null;
  try {
    const currentDb = await openDB();
    return new Promise((resolve, reject) => {
      if (!currentDb.objectStoreNames.contains(STORE_NAME)) {
        console.error(`[getVerificationStatus] Object store ${STORE_NAME} not found.`);
        return reject(`Object store ${STORE_NAME} not found.`);
      }
      const transaction = currentDb.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(vaultId);

      request.onerror = () => {
        console.error('Error fetching status from IndexedDB:', request.error);
        reject(`Error fetching status from IndexedDB: ${request.error?.message}`);
      };

      request.onsuccess = () => {
        resolve(request.result as VerificationStatus || null);
      };
    });
  } catch (error) {
    console.error("[getVerificationStatus] Error opening DB:", error);
    throw error; // Re-throw error to be caught by caller
  }
};

export const updateVerificationStatus = async (
  vaultId: string,
  updates: Partial<Omit<VerificationStatus, 'vaultId'>>
): Promise<void> => {
  if (!vaultId) return;
  try {
    const currentDb = await openDB();
    return new Promise(async (resolve, reject) => {
      if (!currentDb.objectStoreNames.contains(STORE_NAME)) {
        console.error(`[updateVerificationStatus] Object store ${STORE_NAME} not found.`);
        return reject(`Object store ${STORE_NAME} not found.`);
      }
      const transaction = currentDb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Get current status first to merge, ensuring vaultId is primary key
      const getRequest = store.get(vaultId);
      getRequest.onerror = () => {
        console.error('Error fetching current status for update:', getRequest.error);
        reject(`Error fetching current status for update: ${getRequest.error?.message}`);
      };
      getRequest.onsuccess = () => {
        const currentStatus = getRequest.result || { vaultId }; // Initialize if not exists
        const newStatus: VerificationStatus = { ...currentStatus, vaultId };

        for (const key in updates) {
          if (Object.prototype.hasOwnProperty.call(updates, key)) {
            (newStatus as any)[key] = (updates as any)[key];
            (newStatus as any)[`${key}Timestamp`] = new Date();
          }
        }

        const putRequest = store.put(newStatus);
        putRequest.onerror = () => {
          console.error('Error updating status in IndexedDB:', putRequest.error);
          reject(`Error updating status in IndexedDB: ${putRequest.error?.message}`);
        };
        putRequest.onsuccess = () => {
          resolve();
        };
      };
    });
  } catch (error) {
    console.error("[updateVerificationStatus] Error opening DB:", error);
    throw error; // Re-throw error to be caught by caller
  }
};

export const deleteVerificationStatus = async (vaultId: string): Promise<void> => {
  if (!vaultId) return;
  try {
    const currentDb = await openDB();
    return new Promise((resolve, reject) => {
      if (!currentDb.objectStoreNames.contains(STORE_NAME)) {
        console.error(`[deleteVerificationStatus] Object store ${STORE_NAME} not found.`);
        return reject(`Object store ${STORE_NAME} not found.`);
      }
      const transaction = currentDb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(vaultId);

      request.onerror = () => {
        console.error('Error deleting status from IndexedDB:', request.error);
        reject(`Error deleting status from IndexedDB: ${request.error?.message}`);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error("[deleteVerificationStatus] Error opening DB:", error);
    throw error; // Re-throw error to be caught by caller
  }
};

export const initDB = async () => {
  try {
    await openDB();
    console.log('IndexedDB initialized successfully via initDB call.');
  } catch (error) {
    console.error('Failed to initialize IndexedDB via initDB call:', error);
    // Propagate the error if needed, or handle it here (e.g. disable features)
  }
};

if (typeof window !== 'undefined') {
  initDB().catch(error => {
    console.error("Error during automatic IndexedDB initialization:", error);
  });
} 