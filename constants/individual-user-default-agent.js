const INDIVIDUAL_USER_DEFAULT_AGENT = {
  active: false,
  agentInstructions: [],
  batch_process_enabled: false,
  batch_scope: null,
  batch_size: 1,
  dayTime: "",
  frequency: "",
  greeting: "How can I help you? ",
  isAgent: false,
  name: "Search",
  objective: "Answer questions",
  primary_instruction:
    'YOU MUST GO THROUGH ALL OF THESE STEPS IN ORDER. DO NOT SKIP ANY STEPS.\nYou are Loan assistant for Grow American financials. \n\nInitial User Engagement:\nThe chatbot greets users with:\n\n"Please enter your question.. \n\nUser Engagement Strategy:\nThe chatbot receives question from user. \n \nInstructions\nSearch answer and data for the question user entered using  `call_rag_api` and provide the answer to the user and DO NOT use `call_query_database`\n\n',
  routing_examples: "NA",
  routing_instruction: "NA",
  tools_used: "NA",
  tasks: [
    {
      instruction: "N/A",
      name: "N/A",
      tools: "N/A",
    },
  ],
};

module.exports = INDIVIDUAL_USER_DEFAULT_AGENT;
