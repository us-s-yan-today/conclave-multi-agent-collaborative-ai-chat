import type { ChatState, SessionInfo } from '../../worker/types';

export const DB_NAME = 'conclave-db';
export const DB_VERSION = 3; // Bump version to rebuild required object stores
export const IDB_ISSUE_EVENT = 'conclave:idb-issue';
const STORE_SESSIONS = 'sessions';
const STORE_STATES = 'states';
const STORE_AGENT_STATES = 'agent-states'; // New store for session-based agent states
export const MAX_MESSAGES = 200;

const memorySessions: SessionInfo[] = [];
const memoryStates = new Map<string, ChatState>();
const memoryAgentStates = new Map<string, SessionAgentState>(); // In-memory fallback

export interface AgentSessionState {
  status?: 'Ready' | 'Thinking' | 'Paused' | 'Has Feedback' | 'Hand Raised';
  pendingMessages?: Array<{
    id: string;
    content: string;
    timestamp: number;
  }>;
  handRaiseCount?: number;
}

export interface SessionAgentState {
  sessionId: string;
  agentStates: Record<string, AgentSessionState>; // agentId -> state
}

type IndexedDbIssueDetail = { message?: string };

const notifyIndexedDbIssue = (error: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem('conclave:idb-alerted') === 'true') return;
    sessionStorage.setItem('conclave:idb-alerted', 'true');
  } catch {
    // If storage access fails, continue to surface the issue once
  }
  const message = error instanceof Error ? error.message : 'IndexedDB is unavailable or incompatible.';
  window.dispatchEvent(new CustomEvent<IndexedDbIssueDetail>(IDB_ISSUE_EVENT, { detail: { message } }));
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (_event) => {
      const db = request.result;
      // Ensure required stores exist during upgrade or initial creation
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_STATES)) {
        db.createObjectStore(STORE_STATES, { keyPath: 'sessionId' });
      }
      // Always ensure agent-state store exists on upgrade
      if (!db.objectStoreNames.contains(STORE_AGENT_STATES)) {
        db.createObjectStore(STORE_AGENT_STATES, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      notifyIndexedDbIssue(request.error || new Error('Failed to open IndexedDB'));
      reject(request.error);
    };
  });
};

const withStore = async <T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => Promise<T>
): Promise<T> => {
  try {
    const db = await openDB();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const objectStore = tx.objectStore(store);
      run(objectStore).then(resolve).catch(reject);
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // Fallback to in-memory store on error
    console.warn('IndexedDB unavailable, falling back to memory storage:', error);
    notifyIndexedDbIssue(error);
    throw error;
  }
};

export const listSessions = async (): Promise<SessionInfo[]> => {
  try {
    return await withStore(STORE_SESSIONS, 'readonly', (store) => {
      return new Promise<SessionInfo[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const sessions = (req.result as SessionInfo[]).sort((a, b) => b.lastActive - a.lastActive);
          resolve(sessions);
        };
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    return memorySessions.sort((a, b) => b.lastActive - a.lastActive);
  }
};

export const saveSessionMeta = async (session: SessionInfo): Promise<void> => {
  try {
    await withStore(STORE_SESSIONS, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(session);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    const idx = memorySessions.findIndex(s => s.id === session.id);
    if (idx >= 0) memorySessions[idx] = session;
    else memorySessions.push(session);
  }
};

export const deleteSession = async (sessionId: string): Promise<boolean> => {
  try {
    await withStore(STORE_SESSIONS, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    await withStore(STORE_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    // Also delete agent states for this session
    await withStore(STORE_AGENT_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    return true;
  } catch {
    const before = memorySessions.length;
    const next = memorySessions.filter(s => s.id !== sessionId);
    memorySessions.length = 0;
    memorySessions.push(...next);
    memoryStates.delete(sessionId);
    memoryAgentStates.delete(sessionId);
    return next.length !== before;
  }
};

export const clearAllSessions = async (): Promise<number> => {
  try {
    const sessions = await listSessions();
    await withStore(STORE_SESSIONS, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    await withStore(STORE_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    // Also clear all agent states
    await withStore(STORE_AGENT_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    return sessions.length;
  } catch {
    const count = memorySessions.length;
    memorySessions.length = 0;
    memoryStates.clear();
    memoryAgentStates.clear();
    return count;
  }
};

export const updateSessionTitle = async (sessionId: string, title: string): Promise<boolean> => {
  try {
    const sessions = await listSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return false;
    session.title = title;
    session.lastActive = Date.now();
    await saveSessionMeta(session);
    return true;
  } catch {
    const session = memorySessions.find(s => s.id === sessionId);
    if (!session) return false;
    session.title = title;
    session.lastActive = Date.now();
    return true;
  }
};

export const touchSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await listSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.lastActive = Date.now();
      await saveSessionMeta(session);
    }
  } catch {
    const session = memorySessions.find(s => s.id === sessionId);
    if (session) session.lastActive = Date.now();
  }
};

export const saveSessionState = async (sessionId: string, state: ChatState): Promise<ChatState> => {
  // Persist only messages that are visible to the user, then prune to MAX_MESSAGES
  const filteredMessages = state.messages.filter(m => m.visibleInChat !== false);
  const prunedMessages = filteredMessages.slice(-MAX_MESSAGES);
  const nextState: ChatState = {
    ...state,
    messages: prunedMessages,
    streamingMessage: undefined
  };
  try {
    await withStore(STORE_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put({ ...nextState, sessionId });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    return nextState;
  } catch {
    memoryStates.set(sessionId, nextState);
    return nextState;
  }
};

export const getSessionState = async (sessionId: string, fallbackModel: string): Promise<ChatState> => {
  try {
    return await withStore(STORE_STATES, 'readonly', (store) => {
      return new Promise<ChatState>((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => {
          const data = req.result as ChatState | undefined;
          if (data) {
            resolve({ ...data, streamingMessage: '' });
          } else {
            resolve({
              messages: [],
              sessionId,
              isProcessing: false,
              model: fallbackModel,
              streamingMessage: ''
            });
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    const state = memoryStates.get(sessionId);
    if (state) return { ...state, streamingMessage: '' };
    return {
      messages: [],
      sessionId,
      isProcessing: false,
      model: fallbackModel,
      streamingMessage: ''
    };
  }
};

export const createSessionMeta = (title?: string, sessionId?: string, firstMessage?: string): SessionInfo => {
  const id = sessionId || crypto.randomUUID();
  const now = Date.now();
  let finalTitle = title;
  if (!finalTitle) {
    const clean = (firstMessage || '').trim().replace(/\s+/g, ' ');
    const snippet = clean ? (clean.length > 40 ? `${clean.slice(0, 37)}...` : clean) : 'New Chat';
    const timestamp = new Date(now).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    finalTitle = clean ? `${snippet} • ${timestamp}` : `Chat ${timestamp}`;
  }
  return { id, title: finalTitle, createdAt: now, lastActive: now };
};

// Session-based agent state management
export const saveSessionAgentStates = async (sessionId: string, agentStates: Record<string, AgentSessionState>): Promise<void> => {
  const stateData: SessionAgentState = { sessionId, agentStates };
  try {
    await withStore(STORE_AGENT_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(stateData);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  } catch (error) {
    console.warn('Failed to save agent states to IndexedDB, using memory:', error);
    memoryAgentStates.set(sessionId, stateData);
  }
};

export const getSessionAgentStates = async (sessionId: string): Promise<Record<string, AgentSessionState>> => {
  try {
    return await withStore(STORE_AGENT_STATES, 'readonly', (store) => {
      return new Promise<Record<string, AgentSessionState>>((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => {
          const data = req.result as SessionAgentState | undefined;
          resolve(data?.agentStates || {});
        };
        req.onerror = () => reject(req.error);
      });
    });
  } catch (error) {
    console.warn('Failed to get agent states from IndexedDB, using memory:', error);
    const state = memoryAgentStates.get(sessionId);
    return state?.agentStates || {};
  }
};

export const clearSessionAgentStates = async (sessionId: string): Promise<void> => {
  try {
    await withStore(STORE_AGENT_STATES, 'readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  } catch (error) {
    console.warn('Failed to clear agent states from IndexedDB, using memory:', error);
    memoryAgentStates.delete(sessionId);
  }
};

export const resetLocalDatabase = async (): Promise<void> => {
  try {
    sessionStorage.removeItem('conclave:idb-alerted');
  } catch {
    // Ignore storage access errors; proceed with deletion attempt
  }
  return await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('Database deletion blocked; close other tabs and retry.');
  });
};
