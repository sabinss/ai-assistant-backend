const mongoose = require('mongoose');

const gptModelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("GptModel", gptModelSchema);
