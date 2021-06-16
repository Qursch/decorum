const mongoose = require("mongoose");

module.exports = mongoose.model("GuildSettings", new mongoose.Schema({
    _id: String,
    reportChannel: {
        type: String,
        default: ""
    },
    logChannel: {
        type: String,
        default: ""
    },
    reportThreshold: {
        type: mongoose.Decimal128,
        default: -1
    }
}));