const path = require('path');
const {validateSbvFile} = require("./utils/utils.js");
const {setCommandsPermissions} = require("./utils/set_commands_permissions");
const {MAX_EPS_AT_TIME, MAX_FRAG_PER_EP} = require("./utils/constants.js");

const {Client, Collection, Intents, GuildApplicationCommandPermissionData} = require('discord.js');
const {Routes} = require('discord-api-types/v9');
const fs = require('fs');
const {onEpisodeCompleted} = require("./utils/on_msg_callbacks");
const {onNewReaction} = require("./utils/on_msg_callbacks");
const {debugLogRecentEps} = require("./utils/debug_utils");
const {onTranslationMessage} = require("./utils/on_msg_callbacks");
const {onTodoMessage} = require("./utils/on_msg_callbacks");

// TODO:
//  1. 4 godziny przed są niewzięte numerki - @here na #Dyskusje
//  2. 2 godziny przed nie ma wszystkich fragmentów - Powiadomienie priv dla tego, kto nie dostarczył numerku?
//  3. Basic checki podczas wrzucania filmu / wysłania go botowi na priv:
//    a. Czy po kropkach i przecinkach są spacje
//    b. Czy każde słowo ma albo wszystkie litery wielkie, albo maksymalnie jedną (Unikanie literówek typu LItrówka)
//    c. Sprawdzanie odległości między belkami
//    d. Sprawdzanie czy belki nie są zbyt długie
//    d. (???) Ostrzeganie przed złą nazwą pliku
//    e. (??? Prawdpodobonie zbyt trudne) Sprawdzanie liczby przecinków na podstawie liczby czasowników
//       (Tutaj pytanie brzmi też, czy istnieje regex na czasowniki)
//    f. Sprawdzanie, czy w tekście nie występują popularne rzeczy, które powinny być tłumaczone, a nie są (typu huh -> hę, etc.)
//    g. Sprawdzanie, czy belka nie jest za długa (hardlock na długość + zależnie od ilości tekstu)
//  4. Poprawić zliczanie fragmentów
//  DONE | 5. Dodanie dodatkowych statystyk
//  6. Wszystkie numerki zostały dostarczone - powiadomienie i przycisk do pobrania (aby po zmianie pliku przez kogoś można było pobrać zaktualizowaną wersję)
//      paczki z połączonymi fragmentami oraz plik .md z bazą na poprawki
//  DONE | 7. Automatyczne usuwanie z pliki-tłumaczeń plików bez załączników / może ostrzeżenie o złym rozszerzeniu?
//  SORT OF DONE | 8. Wylistowanie ludzi, którzy nigdy nie zrobili tłumaczenia
//  9. Znieść constrainty na format pliku w #TO-DO

require('dotenv').config();

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]});
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, './commands')).filter(file => file.endsWith('.js'));

// Place your client and guild ids here
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

const TODO_CHANNEL_COMPLETED = "to-do"
const TODO_CHANNEL_AWAITING = "🔴to-do"

// TODO: Because onready is async, create lock for othen "on" methods until its finished

let guild;
let recentEpisodes = new Map();
let takenNumbers = [];

let todoChannel;
let translationFilesChannel;
let botChannel;

let todoChannelPlannedName;

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

/**
 * Bot init - once bot successfully logs in, all needed variables are set
 */
client.once('ready', async () => {
    console.log("Initing bot");
    guild = client.guilds.cache.get(guildId);

    const allChannels = await guild.channels.fetch();


    todoChannel = allChannels.find((v, k) => v.name === TODO_CHANNEL_AWAITING || v.name === TODO_CHANNEL_COMPLETED);
    translationFilesChannel = allChannels.find((v, k) => v.name === "pliki-tłumaczeń");
    botChannel = allChannels.find((v, k) => v.name === "bot-ox");
    todoChannelPlannedName = todoChannel.name;

    // TODO: Uncomment if needed
    //setCommandsPermissions();

    const todoMessages = await fetchTodoMessages();
    // This has to be called to put users into cache
    const reactions = await fetchReactionsUsernames(todoMessages);
    initRecentEpisodesStructure(todoMessages);
    const translationMessages = await fetchTranslationMessages();
    markEpisodesAsCompleted(recentEpisodes, translationMessages);
    console.log("======");
    debugLogRecentEps(recentEpisodes);
    handleTakenChange();
    /**
     * At this point we've got our recent episodes structure initialized. Now we need to check which fragments have already been taken
     */
    console.log('GSS Bot is Ready to GO!');
});

async function fetchTodoMessages() {
    return todoChannel.messages
        .fetch({limit: MAX_EPS_AT_TIME})
        .catch(err => console.log("Err in todo msg:" + err));
}

async function fetchReactionsUsernames(todoMessages) {
    return Promise.all(
        todoMessages
            .map(message => message.reactions.cache
                .map(reaction => reaction.users.fetch().then(user_map => user_map.map((user, user_id) => user.username))))
            .flatMap(perMsg => perMsg)
    );
}

async function fetchTranslationMessages() {
    // IMPORTANT: IF MAX_EPS * MAX_FRAG exceeds 50, fetching has to be adjusted
    return translationFilesChannel.messages
        .fetch({limit: MAX_EPS_AT_TIME * MAX_FRAG_PER_EP});
}

function initRecentEpisodesStructure(todoMessages) {
    return todoMessages
        .forEach(todoMsg => onTodoMessage(recentEpisodes, todoMsg));
}

function markEpisodesAsCompleted(recentEpisodes, translationMessages) {
    //Array.from(recentEpisodes.keys()).map(ep => ep.replaceAll(/[aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźż ]+/g, "")).forEach(ep => console.log(ep));
    translationMessages.forEach(translationMsg => onTranslationMessage(recentEpisodes, translationMsg));
}

client.on('messageCreate', msg => {
    if (msg.author.id === client.user.id) {
        // Don't handle your own messages
        return;
    }

    const channel = msg.channel;
    //console.log(msg);
    if (channel.type === "DM") {
        console.log("received dm message");
        const sbv_files = msg.attachments.filter(msg_attachment => msg_attachment.attachment.endsWith(".sbv"));
        console.log(sbv_files.size);
        if (sbv_files.size > 0) {
            console.log("At least one sbv file");
            // Validate sbv files
            sbv_files.forEach(sbv_att => {
                console.log("attempt to validate");
                validateSbvFile(sbv_att.url)
            });
        } else {
            // Handle unknown command
            msg.author.send("Nie wiem co mam z tym zrobić... Zapytaj mnie o coś innego lub wyślij mi plik .sbv do przeanalizowania")
        }
    } else {
        if (channel === translationFilesChannel) {
            console.log("New msg in #pliki-tłumaczeń");
            const finishedEpisodeName = onTranslationMessage(recentEpisodes, msg);
            if (finishedEpisodeName !== "") {
                fetchTranslationMessages()
                    .then(msgs => onEpisodeCompleted(recentEpisodes, finishedEpisodeName, msgs, botChannel));
            }
            // TODO: Handle wrong extension
            // if (msg.attachments.size === 0) {
            //     msg.delete()
            //         .then(delRes => console.log("Succesfully deleted wrong extension msg from pliki-tłumaczeń"))
            //         .catch(err => console.log("ERROR while deleting wrong extension message to pliki-tłumaczeń: " + err));
            // } else if (msg.attachments.filter(attachment => !attachment.attachment.endsWith(".sbv")).size > 0) {
            //     msg.author.send("WARN: Niepoprawne rozszerzenie pliku z tłumaczeniem");
            // }
        } else if (channel === todoChannel) {
            console.log("New msg in #to-do");
            onTodoMessage(recentEpisodes, msg);
            handleTakenChange();
        }
    }
});

// TODO: Handle message delete

function handleTakenChange() {
    if (areAllEpsTaken(recentEpisodes)) {
        setTodoChannelName(TODO_CHANNEL_COMPLETED);
    } else {
        setTodoChannelName(TODO_CHANNEL_AWAITING);
    }
}

function areAllEpsTaken(recentEpisodes) {
    return [...recentEpisodes]
        .filter(([epName, ep]) => [...ep.allFragments]
            .filter(([fragNumber, fragment]) => !fragment.taken)
            .length > 0
        ).length === 0;
}

function setTodoChannelName(name) {
    if (todoChannelPlannedName !== name) {
        // We keep planned name in var because api call takes a long while
        todoChannelPlannedName = name;
        console.log(`Changing todo channel name to ${name}...`)
        todoChannel
            .setName(name)
            .then(res => console.log(`Successfully changed todoChannel name to ${name}`))
            .catch(err => console.log(`ERR: Failed to change todoChannel name to ${name}: ${err}`));
    }
}

client.on('messageReactionAdd', (messageReaction, user) => {
    onNewReaction(recentEpisodes, messageReaction, [user]);
    handleTakenChange();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand())
        return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        /**
         * My concept here is that all execute() methods take interaction, client, guild as parameters
         */
        await command.execute(interaction, client, guild);
    } catch (error) {
        console.error(error);
        await interaction.editReply({content: 'There was an error while executing this command!', ephemeral: true});
    }
});

client.login(process.env.TOKEN)
    .then(console.log("Client login successful"))
    .catch(err => console.log("ERROR while logging in: " + err));
