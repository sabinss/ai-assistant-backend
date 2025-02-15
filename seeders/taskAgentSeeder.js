const TaskAgentModel = require('../models/TaskAgentModel');

const seedTaskAgentForOrganization = async () => {
  try {
    const organizationId = '66158fe71bfe10b58cb23eea';
    const tasks = [
      {
        organization: organizationId,
        name: 'Negative Sentiment',
        action: 'Draft Email',
        objective: 'Outreach to customers when they have negative sentiment',
        who: 'Sent to Customer main contact, from: CS owner, cc: Support lead, Account Manager, bcc: CRM or CSP tool',
        trigger:
          'Review <customer> ticket, ticket comments, CRM notes, survey feedback, chat conversation for last <frequency> and rate sentiment from 1 to 5. Take action if sentiment is 3 or less.',
        output:
          'Generate apology email, acknowledge sentiment, reassure follow-up, and create a task for CS owner to tag the customer.',
        tools: 'CRM, Email, Chat System',
        active: true,
        frequency: 'Monthly',
      },
      {
        organization: organizationId,
        name: 'Feature Adoption',
        action: 'Draft Email',
        objective: 'Outreach to customers with low feature adoption',
        who: 'Sent to Customer main contact, from: CS owner, cc: Account Manager, bcc: CRM or CSP tool',
        trigger:
          'Review customer feature usage. If critical feature is not being used but others are, take action.',
        output:
          'Generate email explaining the feature benefits, share documentation/videos, and offer AI product support.',
        tools: 'CRM, Feature Analytics, Email',
        active: true,
        frequency: 'Weekly',
      },
      {
        organization: organizationId,
        name: 'Decline in Usage',
        action: 'Draft Email',
        objective: 'Outreach to customers when usage declines',
        who: 'Sent to Customer main contact, from: CS owner, cc: Account Manager, bcc: CRM or CSP tool',
        trigger:
          'Analyze feature or login usage patterns. If a decline is observed, take action.',
        output:
          'Generate email empathizing with the decline, asking for feedback on reasons for reduced usage.',
        tools: 'CRM, Product Analytics',
        active: true,
        frequency: 'Monthly',
      },
      {
        organization: organizationId,
        name: 'Collaborate',
        action: 'Send Chat Msg',
        objective: 'Remind collaboration with multiple parties',
        who: 'Task overdue from multiple collaborators',
        trigger: 'Detect overdue tasks from multiple team members.',
        output:
          'Send a chat message to remind collaboration and update tasks accordingly.',
        tools: 'Chat System, Task Management Tool',
        active: true,
        frequency: 'Daily',
      },
    ];
    await TaskAgentModel.insertMany(tasks);
    console.log('Task Agents inserted successfully!');
  } catch (err) {
    console.log('err', err);
  }
};

module.exports = seedTaskAgentForOrganization;
