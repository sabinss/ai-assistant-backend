// const {
//   PRIMARY_ASSISTANT_PROMPT,
//   INVESTIGATION_PROMPT,
//   RECOMMENDATION_PROMPT,
//   UPSELL_PROMPT,
//   SURVEY_PROMPT,
//   LOG_PROMPT,
// } = require('../constants/prompts');
const {
  CUSTOMER_OUTREACH_PROMPT,
  PRIMARY_AGENT_PROMPT,
  SOLUTION_AGENT_PROMPT,
  FOLLOWUP_AGENT_PROMPT,
  LOG_AGENT_PROMPT,
  DATA_AGENT_PROMPT,
} = require('../constants/additional_prompts');
const Organization = require('../models/Organization');

const seedPromptInAllOrganization = async () => {
  try {
    const organizations = await Organization.find({});
    for (let org of ['66158fe71bfe10b58cb23eea']) {
      const result = await Organization.findOne({_id: org});
      // const result = await Organization.findByIdAndUpdate(
      //   org._id,
      //   {
      //     primary_assistant_prompt: PRIMARY_AGENT_PROMPT,
      //     solution_prompt: SOLUTION_AGENT_PROMPT,
      //     recommendation_prompt: FOLLOWUP_AGENT_PROMPT,
      //     log_prompt: LOG_AGENT_PROMPT,
      //     data_agent_prompt: DATA_AGENT_PROMPT,
      //     log_prompt: LOG_AGENT_PROMPT,
      //     customer_outreach_prompt: CUSTOMER_OUTREACH_PROMPT,
      //   },
      //   {new: true}
      // );
      console.log('result', result);
    }
    console.log('Seed prompt success');
  } catch (err) {
    console.log('err', err);
  }
};

module.exports = seedPromptInAllOrganization;
