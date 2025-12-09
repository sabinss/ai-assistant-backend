require("dotenv").config();
const { MongoClient } = require("mongodb");

async function getMongoDBInfo() {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    console.log("DB_URL is not set");
    return null;
  }

  let client;

  try {
    // Parse URL for basic info
    const url = new URL(dbUrl);
    const databaseName = url.pathname.replace("/", "") || "admin";

    console.log("MongoDB Connection Info:");
    console.log("------------------------");
    console.log("Host:", url.host);
    console.log("Database:", databaseName);
    console.log("");

    // Connect to MongoDB
    client = new MongoClient(dbUrl);
    await client.connect();
    console.log("✓ Connected to MongoDB\n");

    const adminDb = client.db("admin");
    const targetDb = client.db(databaseName);

    // Get server status (version, memory, connections)
    const serverStatus = await adminDb.command({ serverStatus: 1 });

    // Get database stats (size)
    const dbStats = await targetDb.command({ dbStats: 1, scale: 1024 * 1024 }); // Scale to MB

    // MongoDB Version
    console.log("MongoDB Version:");
    console.log("----------------");
    console.log("Version:", serverStatus.version);
    console.log("");

    // Memory/RAM Usage
    console.log("Memory (RAM) Usage:");
    console.log("-------------------");
    if (serverStatus.mem) {
      console.log("Resident Memory:", serverStatus.mem.resident, "MB");
      console.log("Virtual Memory:", serverStatus.mem.virtual, "MB");
      console.log("Mapped Memory:", serverStatus.mem.mapped || "N/A", "MB");
    }
    if (serverStatus.tcmalloc?.generic) {
      console.log(
        "Current Allocated:",
        (serverStatus.tcmalloc.generic.current_allocated_bytes / 1024 / 1024).toFixed(2),
        "MB"
      );
    }
    console.log("");

    // CPU Usage (if available)
    console.log("CPU Usage:");
    console.log("----------");
    if (serverStatus.extra_info) {
      console.log(
        "User Time (ms):",
        serverStatus.extra_info.user_time_us ? serverStatus.extra_info.user_time_us / 1000 : "N/A"
      );
      console.log(
        "System Time (ms):",
        serverStatus.extra_info.system_time_us
          ? serverStatus.extra_info.system_time_us / 1000
          : "N/A"
      );
    }
    if (serverStatus.systemInfo) {
      console.log("CPU Cores:", serverStatus.systemInfo.numCores || "N/A");
    }
    console.log("");

    // Database Size
    console.log(`Database Size (${databaseName}):`);
    console.log("------------------------------");
    console.log("Data Size:", dbStats.dataSize?.toFixed(2) || 0, "MB");
    console.log("Storage Size:", dbStats.storageSize?.toFixed(2) || 0, "MB");
    console.log("Index Size:", dbStats.indexSize?.toFixed(2) || 0, "MB");
    console.log(
      "Total Size:",
      ((dbStats.storageSize || 0) + (dbStats.indexSize || 0)).toFixed(2),
      "MB"
    );
    console.log("Collections:", dbStats.collections);
    console.log("Objects:", dbStats.objects);
    console.log("");

    // Connection Stats
    console.log("Connection Stats:");
    console.log("-----------------");
    if (serverStatus.connections) {
      console.log("Current Connections:", serverStatus.connections.current);
      console.log("Available Connections:", serverStatus.connections.available);
      console.log("Total Created:", serverStatus.connections.totalCreated);
    }

    return {
      version: serverStatus.version,
      memory: serverStatus.mem,
      dbStats: dbStats,
      connections: serverStatus.connections,
    };
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  } finally {
    if (client) {
      await client.close();
      console.log("\n✓ Connection closed");
    }
  }
}

// Run it
getMongoDBInfo();
