const mongoose = require("mongoose");

module.exports = mongoose.model("ReportScore", new mongoose.Schema({
    userID: {
        type: String,
        required: true
    },
    guildID: {
        type: String,
        required: true
    },
    approved: {
        type: Number,
        default: 0
    },
    ignored: {
        type: Number,
        default: 0
    },
    rejected: {
        type: Number,
        default: 0
    }
}));