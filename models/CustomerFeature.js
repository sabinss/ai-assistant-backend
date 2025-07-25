const mongoose = require('mongoose');

const customerFeatureSchema = new mongoose.Schema(
    {
        product: { type: String, required: true },
        email: { type: String, required: true },
        date: { type: Date },
        feature: { type: String, required: true },
        category: { type: String, required: false },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer'
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization'
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('CustomerFeature', customerFeatureSchema);
