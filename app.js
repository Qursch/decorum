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
mongoose.connect(config.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Error connecting to database:'));
db.once("open", () => {
    console.log("Successfully connected to database.");
});

const GuildSettings = require("./models/GuildSettings");

const getOrCreateGuild = async (id) => {
    let guild = await GuildSettings.findById(id);
    if(guild === null) {
        guild = new GuildSettings({ 
            _id: message.guild.id
        });
        await guild.save();
    }
    return guild;
}

client.on("message", async (message) => {
    if(message.guild === null) return;

    let args = message.content.toLowerCase().split(" ");
    let command = args.shift();

    if (command.startsWith("~")) {
        let currentGuild = await getOrCreateGuild(message.guild.id);
        if (command == "~set") {
            // CHECK PERMISSIONS HERE
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
            }
        } else if (command === "~report") {
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
                    return message.channel.send("Error: Could not find channel.");
                }

                reportChannel.messages.fetch().then(async messages => {
                    let reports = messages.filter((m) => {
                        return m.author.id === client.user.id && m.embeds[0] !== undefined
                    });
                    let report;
                    if (reports.size !== 0) {
                        report = reports.find(r => r.embeds[0].fields[1].value == reportedID);
                    }
                    if (report === undefined) {
                        let embed = new Discord.MessageEmbed()
                            .setTitle("Active Report")
                            .setDescription("Reported by 1 User")
                            .setURL("https://discord.com/channels/" + message.guild.id + "/" + reportedMessage.channel.id + "/" + reportedMessage.id)
                            .setColor("#ff9d00")
                            .addFields(
                                { name: "Reported User", value: "<@" + reportedMessage.author.id + ">", inline: true },
                                { name: "Message", value: reportedMessage.content },
                                { name: "Reporter", value: "<@" + message.author.id + ">" }
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

                        await reportChannel.send("", { embed: embed, component: actions });
                    } else {
                        if (!report.embeds[0].fields[3].value.includes(message.author.id)) {
                            let newEmbed = report.embeds[0];
                            let description = newEmbed.description.split(" ");
                            description[2]++;
                            description[3] = "Users"
                            newEmbed.description = description.join(" ");
                            newEmbed.fields[3] = { name: "Reporters", value: newEmbed.fields[3].value + ", <@" + message.author.id + ">" };
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
        client.guilds.fetch(guildID).then(async guild => {
            let channel = guild.channels.cache.find(c => c.id == channelID);
            if (channel !== undefined) {
                channel.messages.fetch().then(async messages => {
                    let message = messages.find(m => m.id == messageID);
                    if (message !== undefined) {
                        await message.delete();
                    }
                });
            }

            let newEmbed = button.message.embeds[0];
            let handlerMessage = (button.clicker.user === null) ? "Approved. Error recording report handler." : "Approved by <@" + button.clicker.user.id + ">";
            if (newEmbed.fields[0].value.endsWith("may have been deleted.")) {
                newEmbed.fields.splice(0, 1);
            }
            newEmbed.color = "#57F287";
            newEmbed.title = "Resolved Report";
            newEmbed.url = "";
            newEmbed.fields.unshift({ name: "Result", value: handlerMessage });
            let logChannel = button.message.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
            if (logChannel === null) {
                return button.message.channel.send("Error: Could not find channel.");
            }
            await logChannel.send(newEmbed);
            button.message.delete();
        });
    } else if (button.id.startsWith("reject")) {
        let newEmbed = button.message.embeds[0];
        if (newEmbed.fields[0].value.endsWith("may have been deleted.")) {
            newEmbed.fields.splice(0, 1);
        }
        newEmbed.color = "#ED4245";
        newEmbed.title = "Resolved Report"
        newEmbed.fields.unshift({ name: "Result", value: "Rejected by <@" + button.clicker.user.id + ">" });
        let logChannel = button.message.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
        if (logChannel === null) {
            return button.message.channel.send("Error: Could not find channel.");
        }
        await logChannel.send(newEmbed);
        button.message.delete();
    } else if (button.id.startsWith("ignore")) {
        let newEmbed = button.message.embeds[0];
        if (newEmbed.fields[0].value.endsWith("may have been deleted.")) {
            newEmbed.fields.splice(0, 1);
        }
        newEmbed.color = "#666666";
        newEmbed.title = "Resolved Report"
        newEmbed.fields.unshift({ name: "Result", value: "Ignored by <@" + button.clicker.user.id + ">" });
        let logChannel = button.message.guild.channels.cache.find(c => c.id == currentGuild.logChannel);
        if (logChannel === null) {
            return button.message.channel.send("Error: Could not find channel.");
        }
        await logChannel.send(newEmbed);
        button.message.delete();
    }
});

client.on("messageDelete", async (message) => {
    let currentGuild = await getOrCreateGuild(message.guild.id);
    let reportChannel = message.guild.channels.cache.find(c => c.id == currentGuild.reportChannel);
    if (reportChannel === undefined) {
        return message.channel.send("Error: Could not find channel.");
    }
    reportChannel.messages.fetch().then(messages => {
        let reports = messages.filter((m) => {
            return m.author.id === client.user.id && m.embeds[0] !== undefined
        });
        let report;
        if (reports.size === 0) return;

        report = reports.find(r => r.embeds[0].url.split("/")[6] == message.id);

        if (report !== undefined) {
            let newEmbed = report.embeds[0];
            newEmbed.fields.unshift({ name: ":warning: Notice :warning:", value: "This message may have been deleted." });
            report.edit("", { embed: newEmbed });
        }
    });
});

client.on("channelDelete", (channel) => {
    if (!channel.isText() || channel.guild === null) return;
    let currentGuild = getOrCreateGuild(channel.guild.id);
    let reportChannel = channel.guild.channels.cache.find(c => c.id == currentGuild.reportChannel);

    reportChannel.messages.fetch().then(messages => {
        let reports = messages.filter((m) => {
            return m.author.id === client.user.id && m.embeds[0] !== undefined
        });
        let report;
        if (reports.size === 0) return;

        report = reports.find(r => r.embeds[0].url.split("/")[5] == channel.id);

        if (report !== undefined) {
            let newEmbed = report.embeds[0];
            newEmbed.fields.unshift({ name: ":warning: Notice :warning:", value: "The channel of this message may have been deleted." });
            report.edit("", { embed: newEmbed });
        }
    });
});

client.login(config.TOKEN);