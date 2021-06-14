const mongoose = require("mongoose");

module.exports = mongoose.model("Server", new mongoose.Schema({
    reportChannel: String,
    logChannel: String
}));