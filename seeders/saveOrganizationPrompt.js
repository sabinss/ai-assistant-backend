const OrganizationPrompt = require('../models/OrganizationPrompt'); // Adjust path if needed

const organizationPromptDefaultData = [
  {
    category: 'Insights & Recommendations',
    prompts: [
      {
        text: 'Based on the CRM, CSM, Support information show me top 3 customers that has high chance of upsell',
      },
      {
        text: "Provide a summary of [CUSTOMER]'s CRM notes, product usage, support interactions...",
      },
      {
        text: 'Analyze the CRM notes, support ticket, ticket comments, conversation, feedback...',
      },
    ],
  },
  {
    category: 'Content Generation',
    prompts: [
      {
        text: 'Provide a status report and achievement plus challenges for quarterly business review (QBR)...',
      },
      { text: 'Provide a customer success plan for [CUSTOMER]...' },
      {
        text: 'Based on CRM notes information for [CUSTOMER], identify anything I need to be caution about...',
      },
    ],
  },
  {
    category: 'Data Entry',
    prompts: [
      {
        text: 'Add note for [CUSTOMER] in CRM and identify task from the notes and add in CRM...',
      },
      {
        text: "Create Support Ticket for [CUSTOMER]. Here is the description 'Can not update closed invoice'...",
      },
      {
        text: 'Show me the trend of feature usage for [CUSTOMER] and create a task in Hubspot...',
      },
    ],
  },
];
const seedOrganizationPrompt = async () => {
  try {
    let organization = '66158fe71bfe10b58cb23eea';
    // Insert new data
    const insertedData = await OrganizationPrompt.insertMany(
      organizationPromptDefaultData.map((category) => ({
        ...category,
        organization: organization,
      }))
    );
    console.log('✅ Seeding completed:', insertedData);
  } catch (err) {
    console.log(err);
  }
};

module.exports = { seedOrganizationPrompt, organizationPromptDefaultData };
