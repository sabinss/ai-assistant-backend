const {
  PRIMARY_ASSISTANT_PROMPT,
  INVESTIGATION_PROMPT,
  RECOMMENDATION_PROMPT,
  UPSELL_PROMPT,
  SURVEY_PROMPT,
  LOG_PROMPT,
} = require('../constants/prompts');
const Organization = require('../models/Organization');

const seedPromptInAllOrganization = async () => {
  try {
    const organizations = await Organization.find({});
    for (let org of organizations) {
      const result = await Organization.findByIdAndUpdate(
        org._id,
        {
          primary_assistant_prompt: PRIMARY_ASSISTANT_PROMPT,
          investigation_prompt: INVESTIGATION_PROMPT,
          recommendation_prompt: RECOMMENDATION_PROMPT,
          upsell_prompt: UPSELL_PROMPT,
          survey_prompt: SURVEY_PROMPT,
          log_prompt: LOG_PROMPT,
        },
        {new: true}
      );
    }
    console.log('Seed prompt success');
  } catch (err) {
    console.log('err', err);
  }
};

module.exports = seedPromptInAllOrganization;
