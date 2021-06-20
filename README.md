# Decorum

A Discord bot for community-driven moderation.

Click [here](https://discord.com/oauth2/authorize?client_id=853363957917024306&scope=bot&permissions=273408) to invite Decorum to your server.


## Installation

Use the node package manager [npm](https://www.npmjs.com/) to install the required modules.

```
git clone https://github.com/Qursch/decorum.git
cd decorum
npm install
```

## Usage

Create a `.env` file with the following filled out:

```
DISCORD_TOKEN={TOKEN HERE}
MONGO_URL={URL HERE}
```
To start the bot, run:
```
npm start
```
Or alternatively for development:
```
nodemon app.js
```

## Contributing

Pull requests are welcome. If you have an idea that is not already on the TODO list below, please open an issue for feedback before writing any code.

To get started, create a fork of this repository.
[How?](https://docs.github.com/en/github/getting-started-with-github/quickstart/fork-a-repo)

## TODO 

- Improve documentation
  - Add GitHub documentation
  - Breif explanation in README?
- Require certain permissions to use any command
- Restructure project files
  - Clean up app.js
- Test for bugs
  - Deletion issues
- Allow weights of report options to be set by servers
- Allow reports through DMs
- Notify users when their message was reported and approved

## License

[MIT](https://choosealicense.com/licenses/mit/)
