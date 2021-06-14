# Decorum

 A Discord bot for community-driven moderation. 

## Installation

Use the node package manager [pip](https://pip.pypa.io/en/stable/) to install foobar.

```
git clone https://github.com/Qursch/decorum.git
cd decorum
npm install
```

## Usage

Create a `.env` file with the following filled out:

```
DISCORD_TOKEN={TOKEN HERE}
```
To start the bot, run:
```
npm start
```
Or alternatively for development:
```
nodemon start
```

## Contributing
Pull requests are welcome. If you have an idea that is not already on the TODO list below, please open an issue for feedback before writing any code.

To get started, create a fork of this repository.
[How?](https://docs.github.com/en/github/getting-started-with-github/quickstart/fork-a-repo)

## TODO 
- Restructure project files
  - Clean up app.js
- Add report score for each user
  - Average of the following:
    - Approved report = +
    - Rejected report = -
    - Ignored report = No change
  - List score of reporter(s) in report
- Option to delete reported message
  - Base deletion of combined reporter(s) score

## License
[MIT](https://choosealicense.com/licenses/mit/)