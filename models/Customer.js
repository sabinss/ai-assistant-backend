const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contact_name: {
      type: String,
      require: true,
    },
    email: { type: String, unique: true, default: null },
    arr: { type: Number },
    licenses_purchased: { type: Number },
    licenses_used: { type: Number },
    renewal_date: { type: Date },
    csm_agent: { type: String }, // Workflow engine flag
    account_executive: { type: String }, // Large text field (can store long text)
    health_score: { type: Number },
    login_count: { type: Number },
    main_feature_usage_count: { type: Number },
    total_ticket_count: { type: Number },
    open_ticket_count: { type: Number },
    escalated_ticket: { type: Number },
    closed_ticket_count: { type: Number },
    crm_cust_id: { type: Number },
    help_desk_cust_id: { type: Number },
    csm_cust_id: { type: Number },
    accounting_cust_id: { type: Number },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Customer', customerSchema);
