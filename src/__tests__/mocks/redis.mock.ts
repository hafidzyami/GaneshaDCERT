/**
 * Redis Mock for Testing
 * Provides an in-memory implementation of Redis client
 */

// In-memory storage for mock Redis
const mockStorage: Map<string, { value: string; expiry?: number }> = new Map();

// In-memory Set storage for mock Redis
const mockSetStorage: Map<string, Set<string>> = new Map();

// Track mock calls
const mockCalls = {
  get: [] as string[],
  set: [] as any[],
  setex: [] as string[],
  del: [] as string[],
  scan: [] as any[],
  exists: [] as string[],
  ttl: [] as string[],
  ping: [] as any[],
  flushdb: [] as any[],
  info: [] as string[],
  dbsize: [] as any[],
  eval: [] as any[],
  expire: [] as any[],
  sadd: [] as any[],
  srem: [] as any[],
  smembers: [] as string[],
  sismember: [] as any[],
};

/**
 * Clear mock storage and calls
 */
export function clearMockRedis(): void {
  mockStorage.clear();
  mockSetStorage.clear();
  Object.keys(mockCalls).forEach((key) => {
    (mockCalls as any)[key] = [];
  });
}

/**
 * Get all mock calls
 */
export function getMockCalls(): typeof mockCalls {
  return mockCalls;
}

/**
 * Get mock storage entries
 */
export function getMockStorage(): Map<string, { value: string; expiry?: number }> {
  return mockStorage;
}

/**
 * Mock Redis Client
 */
export const mockRedisClient = {
  get: jest.fn(async (key: string): Promise<string | null> => {
    mockCalls.get.push(key);
    const item = mockStorage.get(key);
    if (!item) return null;

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      mockStorage.delete(key);
      return null;
    }

    return item.value;
  }),

  set: jest.fn(async (key: string, value: string, ...args: any[]): Promise<'OK' | null> => {
    mockCalls.set.push({ key, value, args });

    // Handle NX option (only set if not exists)
    if (args.includes('NX')) {
      if (mockStorage.has(key)) {
        return null;
      }
    }

    // Handle EX option (expiry in seconds)
    const exIndex = args.indexOf('EX');
    let expiry: number | undefined;
    if (exIndex !== -1 && args[exIndex + 1]) {
      expiry = Date.now() + (args[exIndex + 1] * 1000);
    }

    mockStorage.set(key, { value, expiry });
    return 'OK';
  }),

  setex: jest.fn(async (key: string, ttl: number, value: string): Promise<'OK'> => {
    mockCalls.setex.push(key);
    mockStorage.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
    return 'OK';
  }),

  del: jest.fn(async (...keys: string[]): Promise<number> => {
    mockCalls.del.push(...keys);
    let deleted = 0;
    keys.forEach((key) => {
      if (mockStorage.has(key)) {
        mockStorage.delete(key);
        deleted++;
      }
    });
    return deleted;
  }),

  scan: jest.fn(async (cursor: string, match: string, pattern: string, count: string, limit: number): Promise<[string, string[]]> => {
    mockCalls.scan.push({ cursor, pattern });

    // Find matching keys
    const matchingKeys: string[] = [];
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    mockStorage.forEach((_, key) => {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    });

    // Return all matches in one go (simplified for testing)
    return ['0', matchingKeys];
  }),

  exists: jest.fn(async (key: string): Promise<number> => {
    mockCalls.exists.push(key);
    const item = mockStorage.get(key);
    if (!item) return 0;

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      mockStorage.delete(key);
      return 0;
    }

    return 1;
  }),

  ttl: jest.fn(async (key: string): Promise<number> => {
    mockCalls.ttl.push(key);
    const item = mockStorage.get(key);
    if (!item) return -2;
    if (!item.expiry) return -1;

    const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }),

  ping: jest.fn(async (): Promise<string> => {
    mockCalls.ping.push({});
    return 'PONG';
  }),

  flushdb: jest.fn(async (): Promise<'OK'> => {
    mockCalls.flushdb.push({});
    mockStorage.clear();
    return 'OK';
  }),

  info: jest.fn(async (section: string): Promise<string> => {
    mockCalls.info.push(section);
    if (section === 'memory') {
      return 'used_memory_human:1.5M\r\nused_memory:1500000';
    }
    if (section === 'server') {
      return 'uptime_in_seconds:3600\r\nredis_version:7.0.0';
    }
    return '';
  }),

  dbsize: jest.fn(async (): Promise<number> => {
    mockCalls.dbsize.push({});
    return mockStorage.size;
  }),

  eval: jest.fn(async (script: string, numKeys: number, ...args: any[]): Promise<number> => {
    mockCalls.eval.push({ script, numKeys, args });
    // Default return 1 for success (can be overridden with mockResolvedValueOnce)
    return 1;
  }),

  expire: jest.fn(async (key: string, seconds: number): Promise<number> => {
    mockCalls.expire.push({ key, seconds });
    const item = mockStorage.get(key);
    if (!item) return 0;

    item.expiry = Date.now() + (seconds * 1000);
    return 1;
  }),

  // Redis Set operations
  sadd: jest.fn(async (key: string, ...members: string[]): Promise<number> => {
    mockCalls.sadd.push({ key, members });
    if (!mockSetStorage.has(key)) {
      mockSetStorage.set(key, new Set());
    }
    const set = mockSetStorage.get(key)!;
    let added = 0;
    members.forEach((member) => {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    });
    return added;
  }),

  srem: jest.fn(async (key: string, ...members: string[]): Promise<number> => {
    mockCalls.srem.push({ key, members });
    const set = mockSetStorage.get(key);
    if (!set) return 0;
    let removed = 0;
    members.forEach((member) => {
      if (set.has(member)) {
        set.delete(member);
        removed++;
      }
    });
    return removed;
  }),

  smembers: jest.fn(async (key: string): Promise<string[]> => {
    mockCalls.smembers.push(key);
    const set = mockSetStorage.get(key);
    if (!set) return [];
    return Array.from(set);
  }),

  sismember: jest.fn(async (key: string, member: string): Promise<number> => {
    mockCalls.sismember.push({ key, member });
    const set = mockSetStorage.get(key);
    if (!set) return 0;
    return set.has(member) ? 1 : 0;
  }),
};

export default mockRedisClient;
