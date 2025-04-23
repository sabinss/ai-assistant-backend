const OrganizationPrompt = require('../models/OrganizationPrompt'); // Adjust path if needed

const organizationPromptDefaultData = [
  {
    category: 'Insights & Recommendations',
    prompts: [
      {
        text: 'Based on the CRM, CSM, Support information show me top 3 customers that has high chance of upsell',
      },
      {
        text: "Provide a summary of [CUSTOMER]'s CRM notes, product usage, support interactions, and sentiment and assess renewal likelihood from 1 to 5 , 5 being highest and provide your recommendations.",
      },
      {
        text: 'Analyze the CRM notes, support ticket, ticket comments, conversation, feedback for [CUSTOMER] for last 4 months and rate the customer sentiments for last 4 months. The rating should be 1-10, 10 being highest. Provide rating for each month separately so that I can compare sentiment trend.',
      },
    ],
  },
  {
    category: 'Content Generation',
    prompts: [
      {
        text: 'Provide a status report and achievement plus challenges for quarterly business review (QBR) meeting for [CUSTOMER] with the information from CRM notes, product usage, support interactions, and sentiment. 1',
      },
      {
        text: 'Provide a customer success plan for [CUSTOMER] with the information from CRM notes, product usage, support interactions, and sentiment . The format of the customer success plan should have objectives, milestones, activities and metrics. ',
      },
      {
        text: 'Based on CRM notes information for [CUSTOMER], identify anything I need to be caution about and draft me meeting agenda for an hour as I am meeting with them soon.',
      },
    ],
  },
  {
    category: 'Data Entry',
    prompts: [
      {
        text: 'Add note for [CUSTOMER] in CRM and identify task from the notes and add in CRM. Plus draft a follow up email with customers based on this information. Here is the note "Meeting notes: Test Change.',
      },
      {
        text: `Create Support Ticket for [CUSTOMER]. Here is the description " Can not update closed invoice". The user is sarah@customer.com and subject is same as description.`,
      },
      {
        text: 'Show me the trend of feature usage for [CUSTOMER] and create a task in Hubspot to follow up with customer.',
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
