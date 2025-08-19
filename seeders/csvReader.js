const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Import the Customer model
const Customer = require('../models/Customer');

// Function to read CSV and map to customer schema
async function seedCustomersFromCSV() {
  try {
    console.log('Starting CSV customer seeding...');

    // Connect to MongoDB (make sure your .env has DB_URL)
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully...');

    const csvFilePath = path.join(__dirname, 'csv', 'customer_stayntouch.csv');
    const customers = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          const customerData = {
            _id: new mongoose.Types.ObjectId(row._id),
            name: row.name || '',
            contact_name: row.name || '',
            email: row.email || null,
            arr: row.arr ? parseInt(row.arr) : undefined,
            licenses_purchased: row.licenses_purchased
              ? parseInt(row.licenses_purchased)
              : undefined,
            licenses_used: row.licenses_used
              ? parseInt(row.licenses_used)
              : undefined,
            renewal_date: row.renewal_date
              ? new Date(row.renewal_date)
              : undefined,
            csm_agent: row.csm_agent || undefined,
            account_executive: row.account_executive || undefined,
            health_score: row.health_score
              ? parseInt(row.health_score)
              : undefined,
            login_count: row.login_count
              ? parseInt(row.login_count)
              : undefined,
            main_feature_usage_count: row.main_feature_usage_count
              ? parseInt(row.main_feature_usage_count)
              : undefined,
            total_ticket_count: row.total_ticket_count
              ? parseInt(row.total_ticket_count)
              : undefined,
            open_ticket_count: row.open_ticket_count
              ? parseInt(row.open_ticket_count)
              : undefined,
            escalated_ticket: row.escalated_ticket
              ? parseInt(row.escalated_ticket)
              : undefined,
            closed_ticket_count: row.closed_ticket_count
              ? parseInt(row.closed_ticket_count)
              : undefined,
            crm_cust_id: row.crm_cust_id
              ? parseInt(row.crm_cust_id)
              : undefined,
            help_desk_cust_id: row.help_desk_cust_id
              ? parseInt(row.help_desk_cust_id)
              : undefined,
            stage: row.stage || undefined,
            organization: row.organization
              ? new mongoose.Types.ObjectId(row.organization)
              : undefined,
          };
          customers.push(customerData);
        })
        .on('end', async () => {
          try {
            console.log(`📦 Read ${customers.length} customers from CSV`);

            // Optional: clear existing before insert
            // await Customer.deleteMany({});
            // console.log('Cleared existing customers');

            const result = await Customer.insertMany(customers, {
              ordered: false,
            });

            console.log(`✅ Successfully inserted ${result.length} customers`);
            resolve(result);
          } catch (error) {
            console.error('❌ Error inserting customers:', error);
            reject(error);
          } finally {
            await mongoose.connection.close();
            console.log('🔒 MongoDB connection closed');
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Error in CSV customer seeding:', error);
    throw error;
  }
}
const addOrginCustomer = async () => {
  try {
    const orgId = '68a4a47efc4f54cacb902baa';

    // update all customers to have organization = orgId
    const result = await Customer.updateMany(
      {}, // match all docs
      { $set: { organization: orgId } }
    );

    console.log(`${result.modifiedCount} customers updated`);
  } catch (error) {
    console.error('Error updating customers:', error);
  }
};

const seedCsvData = async () => {
  //   const customers = await seedCustomersFromCSV();
  console.log(customers);
};

module.exports = addOrginCustomer;
