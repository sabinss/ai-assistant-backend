// Script to verify data in CosmosDB after migration
require("dotenv").config();
const mongoose = require("mongoose");

async function verifyData() {
  try {
    console.log("\n=== CosmosDB Data Verification ===\n");

    const dbUrl = process.env.DB_URL;
    const sanitizedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
    console.log(`Connecting to: ${sanitizedUrl}\n`);

    // Connect without specifying a database to get access to admin commands
    await mongoose.connect(dbUrl, {
      tls: true,
      retryWrites: false,
      authMechanism: "SCRAM-SHA-256",
    });
    console.log("✅ Connected to CosmosDB\n");

    // Get the native MongoDB client
    const client = mongoose.connection.getClient();

    // List ALL databases
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    console.log("📂 ALL DATABASES FOUND:");
    console.log("========================");

    for (const dbInfo of databases) {
      console.log(`\n🗃️  Database: ${dbInfo.name} (${(dbInfo.sizeOnDisk / 1024).toFixed(2)} KB)`);

      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();

      if (collections.length === 0) {
        console.log("   (no collections)");
        continue;
      }

      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   - ${col.name}: ${count} documents`);
      }
    }

    // Now specifically check cowrkrprod database
    console.log("\n\n=== Checking 'cowrkrprod' database specifically ===\n");
    const cowrkrDb = client.db("cowrkrprod");

    // Check users
    console.log("👤 Users:");
    try {
      const userCount = await cowrkrDb.collection("users").countDocuments();
      console.log(`   Total: ${userCount}`);

      if (userCount > 0) {
        const users = await cowrkrDb
          .collection("users")
          .find({}, { projection: { email: 1, first_name: 1, isVerified: 1 } })
          .limit(5)
          .toArray();
        console.log("   Sample users:");
        users.forEach((u) => {
          console.log(`   - ${u.email} (${u.first_name || "No name"}) [verified: ${u.isVerified}]`);
        });
      }
    } catch (e) {
      console.log("   Error or no users collection:", e.message);
    }

    // Check organizations
    console.log("\n🏢 Organizations:");
    try {
      const orgCount = await cowrkrDb.collection("organizations").countDocuments();
      console.log(`   Total: ${orgCount}`);
    } catch (e) {
      console.log("   Error:", e.message);
    }

    // Check roles
    console.log("\n🔑 Roles:");
    try {
      const roleCount = await cowrkrDb.collection("roles").countDocuments();
      console.log(`   Total: ${roleCount}`);

      if (roleCount > 0) {
        const roles = await cowrkrDb.collection("roles").find({}).toArray();
        console.log("   Names:", roles.map((r) => r.name).join(", "));
      }
    } catch (e) {
      console.log("   Error:", e.message);
    }

    console.log("\n=== Verification Complete ===\n");

    // Provide fix suggestion
    console.log("⚠️  FIX: If data is in 'cowrkrprod' but your app connects to 'admin',");
    console.log("   update your DB_URL to use '/cowrkrprod' instead of '/admin'");
    console.log("\n");

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

verifyData();
