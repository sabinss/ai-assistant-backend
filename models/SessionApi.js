//please seed a random document before using it
const mongoose = require('mongoose');

const sessionApi = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    key: {
        type: String,
        required: true,
        unique: true
    }
});

module.exports = mongoose.model('Sessionapis', sessionApi);

