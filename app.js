require('dotenv').config();


// Require Modules
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
mongoose.connect(config.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Error connecting to database:'));
db.once("open", () => {
    console.log("Successfully connected to database.");
});
const Server = require("./models/Server");

const rchannelID = "853616304451616808";
const lchannelID = "853670808992088114";

client.on("message", async (message) => {
    let args = message.content.toLowerCase().split(" ");
    let command = args.shift();

    if (command === "~report") {

        let currentGuild = await Server.findById(message.guild.id);

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

            let reportsChannel = message.guild.channels.cache.find(c => c.id === rchannelID);
            if (reportsChannel === null) {
                return message.channel.send("Error: Could not find channel.");
            }

            reportsChannel.messages.fetch().then(async messages => {
                let reports = messages.filter(m => m.author.id === client.user.id);
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
                            { name: "Message ID", value: reportedMessage.id, inline: true },
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

                    await reportsChannel.send("", { embed: embed, component: actions });
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
            });
        }).catch(error => {
            console.error(error);
            message.channel.send("Error: Could not find message.");
        });
    }
});

client.on("clickButton", async (button) => {
    if (button.id.startsWith("approve")) {
        let splitLink = button.message.embeds[0].url.split("/");
        let guildID = splitLink[4];
        let channelID = splitLink[5];
        let messageID = splitLink[6];
        client.guilds.fetch(guildID).then(async guild => {
            let channel = guild.channels.cache.find(c => c.id == channelID);
            if (channel === null) {
                return button.message.channel.send("Error: Could not find channel.");
            }
            channel.messages.fetch().then(async messages => {
                let message = messages.find(m => m.id == messageID);
                if (message === null) {
                    return button.message.channel.send("Error: Could not find message.");
                }
                await message.delete();
                let newEmbed = button.message.embeds[0];
                newEmbed.color = "#57F287";
                newEmbed.title = "Resolved Report"
                newEmbed.fields.unshift({ name: "Result", value: "Approved by <@" + button.clicker.user.id + ">" });
                let logsChannel = button.message.guild.channels.cache.find(c => c.id === lchannelID);
                if (logsChannel === null) {
                    return button.message.channel.send("Error: Could not find channel.");
                }
                await logsChannel.send(newEmbed);
                button.message.delete();
            });
        });
    } else if (button.id.startsWith("reject")) {
        let newEmbed = button.message.embeds[0];
                newEmbed.color = "#ED4245";
                newEmbed.title = "Resolved Report"
                newEmbed.fields.unshift({ name: "Result", value: "Rejected by <@" + button.clicker.user.id + ">" });
        let logsChannel = button.message.guild.channels.cache.find(c => c.id === lchannelID);
        if (logsChannel === null) {
            return button.message.channel.send("Error: Could not find channel.");
        }
        await logsChannel.send(newEmbed);
        button.message.delete();
    } else if (button.id.startsWith("ignore")) {
        let newEmbed = button.message.embeds[0];
                newEmbed.color = "#666666";
                newEmbed.title = "Resolved Report"
                newEmbed.fields.unshift({ name: "Result", value: "Ignored by <@" + button.clicker.user.id + ">" });
        let logsChannel = button.message.guild.channels.cache.find(c => c.id === lchannelID);
        if (logsChannel === null) {
            return button.message.channel.send("Error: Could not find channel.");
        }
        await logsChannel.send(newEmbed);
        button.message.delete();
    }
});

client.login(config.TOKEN);