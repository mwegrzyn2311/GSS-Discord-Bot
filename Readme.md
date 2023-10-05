# OX - GSS Discord Bot

A Discord bot for use of GSS (Gildia Skrybów Staszka) written in Discord.js framework

## How to contribute



## How to test

### Prerequisites

1. Create a file called `.env`

2. Go to [Discord Developer Portal](https://discord.com/developers/applications)

3. Create a bot by clicking `New Application`

4. In `General Information` tab copy `APPLICATION ID` and fill in `.env` with `CLIENT_ID=<APPLICATION ID>`

5. In `Bot` tab copy the `TOKEN` and fill in `.env` with `TOKEN=<TOKEN>`

6. In `OAuth2 -> URL Generator` check required accesses (probably just check all) and generate an url to invite the bot to your testing server

7. Create a testing server in Discord and setup it to simulate GSS server (proper channels, roles, etc.)

8. Invite the bot using the link generated in step 6 and grant it an admin role

9. Get the ID of the server and fill in `.env` with `GUILD_ID=<SERVER ID>`. To get ID of the server:

```
To get the server ID for the first parameter, open Discord, go to Settings → Advanced and enable developer mode.
Then, right-click on the server title and select "Copy ID" to get the guild ID
```

### Next steps

1. Run `node deploy-commands.js` if commands have changed
2. Run `npm start` to start the bot

## Deployment

Deployment of the bot is currently being done manually by the owner with no plans to automate in near future - reach out to him if you want to work on automating it

## Useful links

1. https://discordjs.guide/ - Very well written Discord.js documentation
