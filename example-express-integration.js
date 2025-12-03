// example-express-integration.js
// Example showing how to integrate the RocksDB cache with Express.js

const express = require('express');
const { putSchema, removeSchema, getSchema, getLatestSchema } = require('./cache');

const app = express();
app.use(express.json());

// ============================================
// EXAMPLE 1: Express API Routes using the cache
// ============================================

/**
 * GET /api/schema/:id
 * Get the latest version of a schema by ID
 */
app.get('/api/schema/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schema = await getLatestSchema(id);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    res.json({ success: true, data: schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/schema/:id/:version
 * Get a specific version of a schema
 */
app.get('/api/schema/:id/:version', async (req, res) => {
  try {
    const { id, version } = req.params;
    const schema = await getSchema(id, parseInt(version));
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema version not found' });
    }
    
    res.json({ success: true, data: schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// EXAMPLE 2: Blockchain Event Listener Integration
// ============================================

/**
 * This would typically be in your blockchain listener service
 */
async function handleSchemaCreatedEvent(eventData) {
  try {
    // 1. Save to PostgreSQL via Prisma (your existing code)
    // await prisma.schema.create({ data: eventData });
    
    // 2. Update the RocksDB cache
    await putSchema({
      id: eventData.id,
      version: eventData.version,
      name: eventData.name,
      schema: eventData.schema,
      issuer_did: eventData.issuer_did,
      issuer_name: eventData.issuer_name,
      image_link: eventData.image_link,
      expired_in: eventData.expired_in,
      isActive: true,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt
    });
    
    console.log(`✅ Schema ${eventData.id} v${eventData.version} cached`);
  } catch (error) {
    console.error('Error handling SchemaCreated event:', error);
    throw error;
  }
}

async function handleSchemaDeactivatedEvent(eventData) {
  try {
    // 1. Update PostgreSQL
    // await prisma.schema.update({
    //   where: { id_version: { id: eventData.id, version: eventData.version } },
    //   data: { isActive: false }
    // });
    
    // 2. Update the cache
    await putSchema({
      id: eventData.id,
      version: eventData.version,
      isActive: false
    });
    
    console.log(`✅ Schema ${eventData.id} v${eventData.version} deactivated in cache`);
  } catch (error) {
    console.error('Error handling SchemaDeactivated event:', error);
    throw error;
  }
}

async function handleSchemaDeletedEvent(eventData) {
  try {
    // 1. Delete from PostgreSQL
    // await prisma.schema.delete({
    //   where: { id_version: { id: eventData.id, version: eventData.version } }
    // });
    
    // 2. Remove from cache
    await removeSchema(eventData.id, eventData.version);
    
    console.log(`✅ Schema ${eventData.id} v${eventData.version} removed from cache`);
  } catch (error) {
    console.error('Error handling SchemaDeleted event:', error);
    throw error;
  }
}

// ============================================
// EXAMPLE 3: Cache-aside pattern with fallback
// ============================================

/**
 * Advanced: Try cache first, fallback to database if miss
 */
app.get('/api/schema-with-fallback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try cache first
    let schema = await getLatestSchema(id);
    
    // Cache miss - fallback to database
    if (!schema) {
      console.log(`Cache miss for schema ${id}, querying database...`);
      
      // Query from your database (example with Prisma)
      // schema = await prisma.schema.findFirst({
      //   where: { id },
      //   orderBy: { version: 'desc' }
      // });
      
      // Repopulate cache
      if (schema) {
        await putSchema(schema);
        console.log(`✅ Schema ${id} repopulated in cache`);
      }
    }
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    res.json({ success: true, data: schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export for use in other modules
module.exports = {
  handleSchemaCreatedEvent,
  handleSchemaDeactivatedEvent,
  handleSchemaDeletedEvent
};
