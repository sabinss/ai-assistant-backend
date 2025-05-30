const mongoose = require('mongoose');

const orgSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        greeting: {
            type: String,
            require: true,
            default:
                "Hello, I'm an AI Assistant, your virtual Support Agent. My purpose is to assist you with any inquiries. Whether you need a concise summary, detailed information, or step-by-step instructions, just let me know in your queries."
        },
        assistant_name: { type: String, default: '' },
        temperature: { type: Number, default: '0.1' },
        model: { type: String, default: 'gpt-3.5-turbo' },
        api: { type: String, default: '' },
        prompt: { type: String, default: '' },
        workflow_engine_enabled: { type: Boolean, default: false }, // Workflow engine flag
        mock_data: { type: String, default: '' }, // Large text field (can store long text)
        primary_assistant_prompt: { type: String, default: '' }, // promary prompt
        investigation_prompt: { type: String, default: '' },
        recommendation_prompt: { type: String, default: '' }, //followup_prompt
        upsell_prompt: { type: String, default: '' },
        survey_prompt: { type: String, default: '' },
        solution_prompt: { type: String, default: '' },
        log_prompt: { type: String, default: '' },
        customer_outreach_prompt: { type: String, default: '' },
        email_reply_prompt: { type: String, default: '' },
        query_prompt: { type: String, default: '' },
        data_agent_prompt: { type: String, default: '' },
        schema_prompt: { type: String, default: '' },
        abstract_refinement_prompt: { type: String, default: '' },
        nltosql_prompt: { type: String, default: '' },
        outreach_email_generation_prompt: { type: String, default: '' },
        outreach_customer_list_generation_prompt: { type: String, default: '' },

        database_name: { type: String, default: '' },
        redshit_work_space: { type: String, default: '' },
        redshift_db: { type: String, default: '' },

        zendesk_token: { type: String, default: '' },
        zendesk_user: { type: String, default: '' },
        zendesk_subdomain: { type: String, default: '' },
        hubspot_bearer_token: { type: String, default: '' },
        orgGoogleCredential: {
            type: Object,
            default: {}
        },
        whatsappConfig: {
            type: Object,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Organization', orgSchema);
// Use support workflow

// Primary Agent Prompt

// Recommendataion  mathi
