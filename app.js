// Require Modules
require('dotenv').config();
const Discord = require("discord.js");
const DiscordButtons = require('discord-buttons');
const mongoose = require("mongoose");

// Configuration
const config = require("./util/config");

// Setup Discord
const client = new Discord.Client({});
DiscordButtons(client);
client.commands = new Discord.Collection();

// Setup Database
mongoose.connect(config.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Error connecting to database:'));
db.once("open", () => {
    console.log("Successfully connected to database.");
});

const GuildSettings = require("./models/GuildSettings");
const ReportScore = require("./models/ReportScore");

const getOrCreateGuild = async (id) => {
    let guild = await GuildSettings.findById(id);
    if (guild === null) {
        guild = new GuildSettings({
            _id: id
        });
        await guild.save();
    }
    return guild;
}

const getOrCreateReportScore = async (uID, gID) => {
    let score = await ReportScore.findOne({ userID: uID, guildID: gID });
    if (score === null) {
        score = new ReportScore({
            userID: uID,
            guildID: gID
        });
        await score.save();
    }
    return score;
}

const calculateReportScore = (approved, ignored, rejected) => {
    let totalReports = approved + ignored + rejected;
    const aW = 3;
    const iW = -1.5;
    const rW = -5;

    let formula = Math.E ** (0.1 * (aW * approved + iW * ignored + rW * rejected));

    let score = formula / (formula + 1);

    let roundedScore = Math.round((score + Number.EPSILON) * 100) / 100;

    return roundedScore;
};

client.on("message", async (message) => {
    if (message.guild === null) return;

    let args = message.content.toLowerCase().split(" ");
    let command = args.shift();

    if (command.startsWith("~")) {
        let currentGuild = await getOrCreateGuild(message.guild.id);
        if (command == "~set") {
            if (!message.member.hasPermission("ADMINISTRATOR")) {
                return message.channel.send("Error: Insufficient permissions.")
            }
            if (args[0] == "channel") {
                if (args[1] == "logs") {
                    let channel = (message.mentions.channels.size !== 0) ? message.mentions.channels.first() : message.guild.channels.cache.find(c => c.id == args[2]);
                    if (channel === null) {
                        return message.channel.send("Error: Invalid channel.");
                    } else {
                        currentGuild.logChannel = channel.id;
                        await currentGuild.save();
                        message.channel.send("Updated log channel to <#" + currentGuild.logChannel + ">.");
                    }
                } else if (args[1] == "reports") {
                    let channel = (message.mentions.channels.size !== 0) ? message.mentions.channels.first() : message.guild.channels.cache.find(c => c.id == args[2]);
                    if (channel === null) {
                        return message.channel.send("Error: Invalid channel.");
                    } else {
                        currentGuild.reportChannel = channel.id;
                        currentGuild.save();
                        message.channel.send("Updated report channel to <#" + currentGuild.reportChannel + ">.");

                    }
                }
            } else if (args[0] == "threshold") {
                let threshold = parseFloat(args[1]);
                if (!isNaN(threshold) && (threshold >= 0 || threshold === -1)) {
                    currentGuild.reportThreshold = threshold;
                    currentGuild.save();
                    message.channel.send("Updated report threshold to `" + currentGuild.reportThreshold + "`.");
                } else {
                    message.channel.send("Error: Invalid threshold.")
                }
            }
        } else if (command === "~report") {
            if (currentGuild.reportChannel === "") {
                return message.channel.send("Error: No report channel is set.");
            }
            let reportedID =
                (message.reference !== null) ? message.reference.messageID :
                    (!isNaN(args[0])) ? args[0] :
                        null;

            if (reportedID == null) {
                return message.channel.send("Error: Invalid message ID.");
            }

            message.channel.messages.fetch(reportedID).then(async reportedMessage => {

                if (reportedMessage.author.id === message.author.id) {
                    return message.channel.send("Error: You cannot report your own message.");
                }
                let reportChannel = message.guild.channels.cache.find(c => c.id == currentGuild.reportChannel);
                if (reportChannel === undefined) {
                    return message.channel.send("Error: Could not report channel.");
                }

                reportChannel.messages.fetch().then(async messages => {
                    let reports = messages.filter((m) => {
                        return m.author.id === client.user.id && m.embeds[0] !== undefined
                    });
                    let report;
                    if (reports.size !== 0) {
                        report = reports.find(r => r.embeds[0].url.split("/")[6] == reportedID);
                    }

                    let rsOBJ = await getOrCreateReportScore(message.author.id, message.guild.id);
                    let authorReportScore = calculateReportScore(rsOBJ.approved, rsOBJ.ignored, rsOBJ.rejected);
                    let newScore = authorReportScore;

                    if (report === undefined) {
                        let embed = new Discord.MessageEmbed()
                            .setTitle("Active Report - 1 User")
                            .setURL("https://discord.com/channels/" + message.guild.id + "/" + reportedMessage.channel.id + "/" + reportedMessage.id)
                            .setColor("#ff9d00")
                            .addFields(
                                { name: "Reported User", value: "<@" + reportedMessage.author.id + ">", inline: true },
                                { name: "Report Score", value: authorReportScore + "/" + currentGuild.reportThreshold, inline: true },
                                { name: "Message", value: reportedMessage.content },
                                { name: "Reporter (Score)", value: "<@" + message.author.id + "> (" + authorReportScore + ")" }
                            )
                            .setTimestamp();

                        let approve = new DiscordButtons.MessageButton()
                            .setLabel("Approve")
                            .setStyle("green")
                            .setID("approve-" + reportedMessage.id);

                        let reject = new DiscordButtons.MessageButton()
                            .setLabel("Reject")
                            .setStyle("red")
                            .setID("reject-" + reportedMessage.id);

                        let ignore = new DiscordButtons.MessageButton()
                            .setLabel("Ignore")
                            .setStyle("grey")
                            .setID("ignore-" + reportedMessage.id);

                        let actions = new DiscordButtons.MessageActionRow()
                            .addComponent(approve)
                            .addComponent(reject)
                            .addComponent(ignore);

                        if (currentGuild.reportThreshold !== 0 && newScore >= currentGuild.reportThreshold) {
                            embed.description = ":warning: Notice :warning: Message was automatically deleted after meeting the report threshold.";
                            await reportedMessage.delete().catch(e => "Message was already deleted?");
                        }

                        await reportChannel.send("", { embed: embed, component: actions });
                    } else {
                        if (!report.embeds[0].fields[3].value.includes(message.author.id)) {
                            let newEmbed = report.embeds[0];
                            newScore += parseFloat(newEmbed.fields[1].value.split("/")[0]);
                            newEmbed.fields[1].value = newScore + "/" + currentGuild.reportThreshold;
                            let title = newEmbed.title.split(" ");
                            title[3]++;
                            title[4] = "Users"
                            newEmbed.title = title.join(" ");
                            newEmbed.fields[3] = { name: "Reporters (Scores)", value: newEmbed.fields[3].value + ", <@" + message.author.id + "> (" + authorReportScore + ")" };
                            if (currentGuild.reportThreshold !== 0 && newScore >= currentGuild.reportThreshold) {
                                newEmbed.description = ":warning: Notice :warning: Message was automatically deleted after meeting the report threshold.";
                                await reportedMessage.delete().catch(e => "Message was already deleted?");
                            }
                            report.edit("", { embed: newEmbed });

                        }
                    }
                    message.delete().catch(e => "Message was already deleted?");
                });
            }).catch(error => {
                console.error(error);
                message.channel.send("Error: Could not find message.");
            });
        }
    }
});

client.on("clickButton", async (button) => {
    let currentGuild = await getOrCreateGuild(button.guild.id);
    if (button.id.startsWith("approve")) {
        let splitLink = button.message.embeds[0].url.split("/");
        let guildID = splitLink[4];
        let channelID = splitLink[5];
        let messageID = splitLink[6];
        let reporters = button.message.embeds[0].fields[3].value.match(/<@\d+>/g);
        reporters.forEach(async reporter => {
            let reporterID = reporter.replace(/[^0-9]/g, "");
            await ReportScore.findOneAndUpdate({ userID: reporterID, guildID: button.guild.id }, { $inc: { approved: 1 } });
        });
        let newEmbed = button.message.embeds[0];
        let handlerMessage = (button.clicker.user === null) ? "Approved. Error recording report handler." : "Approved by <@" + button.clicker.user.id + ">";
        if (newEmbed.description === null || !newEmbed.description.startsWith(":warning:")) {
            let channel = button.guild.channels.cache.find(c => c.id == channelID);
            if (channel !== undefined) {
                channel.messages.fetch().then(async messages => {
                    let message = messages.find(m => m.id == messageID);
                    if (message !== undefined) {
                        await message.delete();
                    }
                });
            }
        }
        newEmbed.color = "#57F287";
        newEmbed.title = "Resolved Report";
        newEmbed.fields.unshift({ name: "Result", value: handlerMessage });

        button.message.delete();
        if (currentGuild.logChannel === "") return;
        let logChannel = button.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
        if (logChannel === null) {
            return button.channel.send("Error: Could not find log channel.");
        }
        await logChannel.send(newEmbed);

    } else if (button.id.startsWith("reject")) {
        let reporters = button.message.embeds[0].fields[3].value.match(/<@\d+>/g);
        reporters.forEach(async reporter => {
            let reporterID = reporter.replace(/[^0-9]/g, "");
            await ReportScore.findOneAndUpdate({ userID: reporterID, guildID: button.guild.id }, { $inc: { rejected: 1 } });
        });
        let newEmbed = button.message.embeds[0];
        if (newEmbed.description !== null && newEmbed.description.endsWith("may have been deleted.")) {
            newEmbed.description = "";
        }
        newEmbed.color = "#ED4245";
        newEmbed.title = "Resolved Report";
        let handlerMessage = (button.clicker.user === null) ? "Rejected. Error recording report handler." : "Rejected by <@" + button.clicker.user.id + ">";
        newEmbed.fields.unshift({ name: "Result", value: handlerMessage });
        button.message.delete();
        if (currentGuild.logChannel === "") return;
        let logChannel = button.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
        if (logChannel === null) {
            return button.channel.send("Error: Could not find log channel.");
        }
        await logChannel.send(newEmbed);
    } else if (button.id.startsWith("ignore")) {
        let reporters = button.message.embeds[0].fields[3].value.match(/<@\d+>/g);
        reporters.forEach(async reporter => {
            let reporterID = reporter.replace(/[^0-9]/g, "");
            await ReportScore.findOneAndUpdate({ userID: reporterID, guildID: button.guild.id }, { $inc: { ignored: 1 } });
        });
        let newEmbed = button.message.embeds[0];
        if (newEmbed.description !== null && newEmbed.description.endsWith("may have been deleted.")) {
            newEmbed.description = "";
        }
        newEmbed.color = "#666666";
        newEmbed.title = "Resolved Report";
        let handlerMessage = (button.clicker.user === null) ? "Ignored. Error recording report handler." : "Ignored by <@" + button.clicker.user.id + ">";
        newEmbed.fields.unshift({ name: "Result", value: handlerMessage });
        button.message.delete();
        if (currentGuild.logChannel === "") return;

        let logChannel = button.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
        if (logChannel === null) {
            return button.channel.send("Error: Could not find log channel.");
        }
        await logChannel.send(newEmbed);
    }
});

client.on("messageDelete", async (message) => {
    let currentGuild = await getOrCreateGuild(message.guild.id);
    let reportChannel = message.guild.channels.cache.find(c => c.id == currentGuild.reportChannel);
    if (reportChannel === undefined) {
        return
    }
    reportChannel.messages.fetch().then(messages => {
        let reports = messages.filter((m) => {
            return m.author.id === client.user.id && m.embeds[0] !== undefined
        });
        let report;
        if (reports.size === 0) return;

        report = reports.find(r => r.embeds[0].url.split("/")[6] == message.id);

        if (report !== undefined && !report.embeds[0].description.endsWith("threshold.")) {
            let newEmbed = report.embeds[0];
            newEmbed.description = ":warning: Notice :warning: This message has been deleted.";
            report.edit("", { embed: newEmbed });
        }
    });
});

client.on("channelDelete", (channel) => {
    if (!channel.isText() || channel.guild === null) return;
    let currentGuild = getOrCreateGuild(channel.guild.id);
    let reportChannel = channel.guild.channels.cache.find(c => c.id == currentGuild.reportChannel);

    if (reportChannel === undefined) return;

    reportChannel.messages.fetch().then(messages => {
        let reports = messages.filter((m) => {
            return m.author.id === client.user.id && m.embeds[0] !== undefined
        });
        let report;
        if (reports.size === 0) return;

        report = reports.find(r => r.embeds[0].url.split("/")[5] == channel.id);

        if (report !== undefined && report.embeds[0].description !== null && !report.embeds[0].description.endsWith("threshold.")) {
            let newEmbed = report.embeds[0];
            newEmbed.description = ":warning: Notice :warning: The channel of this message may have been deleted.";
            report.edit("", { embed: newEmbed });
        }
    });
});

client.login(config.TOKEN);