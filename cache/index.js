// cache/index.js
const level = require("level");
const { rocksdb, createOptions } = require("rocksdb-config");

const dbPath = "./vcschema-cache";
const options = { db: rocksdb, valueEncoding: "json", ...createOptions() };

// --- KEY HELPERS ---
const keyPrimary = (id, version) => `schema!${id}!${version}`;
const keyLatest = (id) => `latest!${id}`;
const keyActive = (id, version) => `active!${id}!${version}`;
const keyIssuer = (issuer, id, version) =>
  `issuer!${issuer}!${id}!${version}`;

// --- OPEN DB ---
const db = level(dbPath, options);

// --- CACHE WRITE (create/update) ---
async function putSchema(schema) {
  const batch = db.batch();

  const primary = keyPrimary(schema.id, schema.version);
  batch.put(primary, schema);

  // update latest version pointer
  const latestKey = keyLatest(schema.id);
  try {
    const val = await db.get(latestKey).catch(() => null);
    if (!val) {
      batch.put(latestKey, `${schema.id}:${schema.version}`);
    } else {
      const parts = val.split(":");
      const curVersion = Number(parts[1]);
      if (schema.version >= curVersion) {
        batch.put(latestKey, `${schema.id}:${schema.version}`);
      }
    }
  } catch (_) {}

  // isActive index
  const active = keyActive(schema.id, schema.version);
  if (schema.isActive) batch.put(active, 1);
  else batch.del(active);

  // issuer index optional
  if (schema.issuer_did) {
    batch.put(keyIssuer(schema.issuer_did, schema.id, schema.version), 1);
  }

  await batch.write();
}

// --- CACHE REMOVE ---
async function removeSchema(id, version) {
  const batch = db.batch();
  batch.del(keyPrimary(id, version));
  batch.del(keyActive(id, version));
  await batch.write();
}

// --- CACHE READS ---
async function getSchema(id, version) {
  return db.get(keyPrimary(id, version)).catch(() => null);
}

async function getLatestSchema(id) {
  try {
    const val = await db.get(keyLatest(id));
    const [schemaId, ver] = val.split(":");
    return getSchema(schemaId, Number(ver));
  } catch {
    return null;
  }
}

module.exports = {
  db,
  putSchema,
  removeSchema,
  getSchema,
  getLatestSchema,
};
