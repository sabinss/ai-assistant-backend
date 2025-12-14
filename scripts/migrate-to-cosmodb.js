/**
 * MongoDB to Cosmos DB Migration Script
 *
 * Usage:
 *   1. Set environment variables in .env:
 *      - MONGODB_URL (source)
 *      - COSMOSDB_URL (target)
 *   2. Run: node scripts/migrate-to-cosmodb.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Source MongoDB connection
const sourceConnection = mongoose.createConnection(process.env.MONGODB_URL, {
  autoIndex: true,
});

// Target Cosmos DB connection
const targetConnection = mongoose.createConnection(process.env.COSMOSDB_URL, {
  autoIndex: true,
  retryWrites: false,
  tls: true,
});

// List all collections to migrate
const collectionsToMigrate = [
  "users",
  "organizations",
  "customers",
  "customerfeatures",
  "agents",
  "agenttasks",
  "agenttaskstatuses",
  "agentcronlogs",
  "activitylogs",
  "confirmtokens",
  "resettokens",
  "feedbacks",
  "feedbacksurveys",
  "googleusers",
  "gptmodels",
  "notifications",
  "organizationprompts",
  "organizationtokens",
  "prompts",
  "roles",
  "sessionapis",
  "sources",
  "statuses",
  "taskagents",
  "userconversations",
];

async function migrateCollection(collectionName) {
  try {
    console.log(`\n📦 Migrating collection: ${collectionName}`);

    const sourceDb = sourceConnection.db;
    const targetDb = targetConnection.db;

    // Get source collection
    const sourceCollection = sourceDb.collection(collectionName);
    const documentCount = await sourceCollection.countDocuments();

    if (documentCount === 0) {
      console.log(`   ⏭️  Skipping ${collectionName} - no documents`);
      return { collection: collectionName, migrated: 0, status: "skipped" };
    }

    console.log(`   📊 Found ${documentCount} documents`);

    // Get target collection
    const targetCollection = targetDb.collection(collectionName);

    // Batch size for migration (Cosmos DB has limits)
    const BATCH_SIZE = 100;
    let migratedCount = 0;

    // Use cursor for memory-efficient iteration
    const cursor = sourceCollection.find({});

    let batch = [];
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length >= BATCH_SIZE) {
        await targetCollection.insertMany(batch, { ordered: false });
        migratedCount += batch.length;
        console.log(`   ✅ Migrated ${migratedCount}/${documentCount}`);
        batch = [];
      }
    }

    // Insert remaining documents
    if (batch.length > 0) {
      await targetCollection.insertMany(batch, { ordered: false });
      migratedCount += batch.length;
    }

    console.log(`   ✅ Completed: ${migratedCount} documents migrated`);
    return { collection: collectionName, migrated: migratedCount, status: "success" };
  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionName}:`, error.message);
    return { collection: collectionName, migrated: 0, status: "error", error: error.message };
  }
}

async function createIndexes() {
  console.log("\n📑 Creating indexes on Cosmos DB...");

  const targetDb = targetConnection.db;

  // Add your indexes here based on your schema requirements
  const indexes = [
    { collection: "users", index: { email: 1 }, options: { unique: true } },
    { collection: "users", index: { organization: 1 } },
    { collection: "customers", index: { organization: 1 } },
    { collection: "customers", index: { email: 1 } },
    { collection: "activitylogs", index: { createdAt: -1 } },
    { collection: "userconversations", index: { user: 1, createdAt: -1 } },
  ];

  for (const idx of indexes) {
    try {
      await targetDb.collection(idx.collection).createIndex(idx.index, idx.options || {});
      console.log(`   ✅ Created index on ${idx.collection}: ${JSON.stringify(idx.index)}`);
    } catch (error) {
      console.log(`   ⚠️  Index on ${idx.collection} may already exist: ${error.message}`);
    }
  }
}

async function migrate() {
  console.log("🚀 Starting MongoDB to Cosmos DB Migration\n");
  console.log("=".repeat(50));

  try {
    // Wait for connections
    await Promise.all([
      new Promise((resolve) => sourceConnection.once("open", resolve)),
      new Promise((resolve) => targetConnection.once("open", resolve)),
    ]);

    console.log("✅ Connected to both databases");

    const results = [];

    // Migrate each collection
    for (const collection of collectionsToMigrate) {
      const result = await migrateCollection(collection);
      results.push(result);
    }

    // Create indexes
    await createIndexes();

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(50));

    let totalMigrated = 0;
    results.forEach((r) => {
      const icon = r.status === "success" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
      console.log(`${icon} ${r.collection}: ${r.migrated} documents`);
      totalMigrated += r.migrated;
    });

    console.log("=".repeat(50));
    console.log(`📦 Total documents migrated: ${totalMigrated}`);
    console.log("🎉 Migration completed!\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await sourceConnection.close();
    await targetConnection.close();
    process.exit(0);
  }
}

// Run migration
migrate();
