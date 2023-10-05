const {MONTH_TO_NUM} = require("../utils/constants");
const {SlashCommandBuilder, SlashCommandRoleOption, SlashCommandUserOption, SlashCommandNumberOption, SlashCommandStringOption, SlashCommandBooleanOption} = require("@discordjs/builders");
const {MessageAttachment} = require("discord.js");

// TODO: Add from-year command

// TODO: optimize to fetch only month/year not older
const sort_predicate_map = new Map([
    ["fragments", (a, b) => b.fragments - a.fragments],
    ["date", (a, b) => b.newestTimestamp - a.newestTimestamp]
])

/**
 * @param sortby - string - which property to sort by
 * @param asc - boolean - defaults to false. if asc (true) sorts in ascending order, if desc (false) sorts in descending order
 * @returns predicate (a, b) => number to define sorting
 */
function get_sort_predicate(sortby, asc) {
    if (asc) {
        return (a, b) => sort_predicate_map.get(sortby)(b, a)
    } else {
        return sort_predicate_map.get(sortby)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Statystyki tłumaczeń')
        .addRoleOption(
            new SlashCommandRoleOption()
                .setName("ranga")
                .setDescription("statsy dla rangi")
                .setRequired(false)
        )
        .addUserOption(
            new SlashCommandUserOption()
                .setName("użyszkodnik")
                .setDescription("statsy dla użytkownika")
                .setRequired(false)
        )
        .addNumberOption(
            new SlashCommandNumberOption()
                .setName("rok")
                .setDescription("statsy z roku")
                .setRequired(false)
                .addChoices([
                    ["2019", 2019],
                    ["2020", 2020],
                    ["2021", 2021],
                    ["2022", 2022],
                    ["2023", 2023]
                ])
                .setMinValue(2018)
                .setMaxValue(2030)
        )
        .addNumberOption(
            new SlashCommandNumberOption()
                .setName("miesiąc")
                .setDescription("statsy z miesiąca (potencjalnie z kilku lat)")
                .setRequired(false)
                .addChoices(MONTH_TO_NUM)
                .setMinValue(0)
                .setMaxValue(11)
        )
        .addStringOption(
            new SlashCommandStringOption()
                .setName("sortby")
                .setDescription("Pole po których będą posortowane statystyki")
                .setRequired(false)
                .addChoices([
                    ["data ostatniego", "date"],
                    ["fragmenty", "fragments"]
                ])
        )
        .addBooleanOption(
            new SlashCommandBooleanOption()
                .setName("sort_asc")
                .setDescription("Gdy brak lub false, sortuje malejąco, w przeciwnym razie rosnąco")
                .setRequired(false)
        )
        .setDefaultPermission(false),
    async execute(interaction, client, guild) {
        await interaction.deferReply({ephemeral: false})
            .then(console.log)
            .catch(console.error);

        let all_users = await guild.members.fetch();

        const filter_role = interaction.options.getRole("ranga");
        const filter_user = interaction.options.getUser("użyszkodnik");

        const filter_year = interaction.options.getNumber("rok");
        const filter_month = interaction.options.getNumber("miesiąc");

        let sortby = interaction.options.getString("sortby");
        if (!sortby) {
            sortby = "fragments";
        }

        // If sort_asc if missing it should still default to false which is desired behavior
        let sort_asc = interaction.options.getBoolean("sort_asc")

        let filter_users;
        const should_filter = filter_role || filter_user;

        if (should_filter) {
            filter_users = all_users;
        }
        if (filter_role) {
            filter_users = filter_users.filter(member => member.roles.cache.some(role => role === filter_role));
        }
        if (filter_user) {
            filter_users = filter_users.filter(member => member.user.id === filter_user.id);
        }

        const channel = client.channels.cache
            .find((v, k) => v.name === "pliki-tłumaczeń");

        // Create map[username -> displayNames] to be able to change username to displayName quickly (needed for presentation purposes)
        const username_to_displayName = all_users
            .filter(member => !member.user.bot)
            .reduce((map, member) => {
                map[member.user.username] = {
                    displayName: member.displayName,
                    displayRole: getDisplayRoleString(member.roles.cache)
                };
                return map;
            }, {});

        const translate_file_objects = (await getAllMsgsFromChannel(channel, filter_year, filter_month))
            .filter(v => v.attachments.size > 0)
            .filter(v => (!should_filter || filter_users.has(v.author.id)))
            .filter(v => should_not_be_filtered_out_by_time(v.createdTimestamp, filter_month, filter_year))
            .map((v, k) => new Object({
                content: v.content,
                sender: v.author,
                fragments: v.attachments
                    .map((v, k) => getNumberOfFragmentsFromFilename(v.name))
                    .reduce((sum, ele) => sum + ele),
                tot_size: v.attachments
                    .map((v, k) => v.size)
                    .reduce((sum_size, single_size) => sum_size + single_size),
                reactions: v.reactions,
                timestamp: v.createdTimestamp
            }))
            .reduce((map, obj) => {
                const user_id = obj.sender.id;
                const username = obj.sender.username;
                map[user_id] = {
                    // If user is in the server, put his displayName. Otherwise it doesn't exist, so put his username
                    username: (username_to_displayName[username] ?
                        username_to_displayName[username].displayRole + username_to_displayName[username].displayName :
                        "[*] " + username),
                    fragments: (user_id in map ? map[user_id].fragments : 0) + obj.fragments,
                    tot_size: (user_id in map ? map[user_id].tot_size : 0) + obj.tot_size,
                    newestTimestamp: user_id in map ? map[user_id].newestTimestamp : obj.timestamp
                };
                return map;
            }, {});

        filter_users
            .forEach(user => {
            const user_id = user.user.id
            if (!translate_file_objects[user_id]) {
                translate_file_objects[user_id] = {
                    username: (username_to_displayName[user.user.username] ?
                        username_to_displayName[user.user.username].displayRole + username_to_displayName[user.user.username].displayName :
                        "[*] " + user.user.username),
                    fragments: 0,
                    tot_size: 0,
                    newestTimestamp: 0
                }
            }
        });

        let response = "Fragments | Last translation | Total filesize [KB] | Avg fragment filesize [KB] | User\n";
        response += Object.entries(translate_file_objects)
            .map(arr => arr[1])
            .sort(get_sort_predicate(sortby, sort_asc))
            .map(obj => statStringFromObj(obj))
            .join('\n');
        response += "\n----------------------------------------------------------------\n"
        // TODO: handle those string as those above
        response += Object.entries(translate_file_objects)
            .map(arr => arr[1])
            .reduce((sum, obj) => sum + obj.fragments, 0) + "   |  ---Total--  |  ";
        response += Math.floor(Object.entries(translate_file_objects)
            .map(arr => arr[1])
            .reduce((sum, obj) => sum + obj.tot_size/1024, 0)) + " |\n";

        // TODO: Consider extracting for cleaner code
        let reply_msg = "Statystyki";
        let filename = "gss_stats";
        if(filter_month === 0 || filter_month) {
            const msc = getKeyByValue(MONTH_TO_NUM, filter_month)
            reply_msg += " z miesiąca: " + msc + " |";
            filename += "_" + msc;
        }
        if(filter_year) {
            reply_msg += " z roku: " + filter_year + " |";
            filename += "_" + filter_year;
        }
        if(filter_role) {
            reply_msg += " dla rangi: " + filter_role.name + " |";
            filename += "_" + filter_role.name;
        }
        if(filter_user) {
            reply_msg += " dla użytkownika: " + filter_user.username + " |";
            filename += "_" + filter_user.username;
        }
        if(reply_msg === "Statystyki") {
            reply_msg = "Statystyki bez filtrów"
        }

        if(sortby) {
            reply_msg += " sortowane po: " + sortby + " " + (sort_asc ? "malejąco" : "rosnąco");
        }

        filename += ".txt";

        await interaction.editReply({
            content: reply_msg,
            files: [new MessageAttachment(Buffer.from(response), filename)],
            ephemeral: false
        });
    },
}

// TODO: Check why one too many request is being sent (2 for like 50 msgs)
async function getAllMsgsFromChannel(channel, filter_year, filter_month) {
    const sum_messages = [];
    let last_id;

    let oldest_timestamp = undefined;
    if(filter_year) {
        let oldest_month = filter_month ? filter_month : 0;
        let date = new Date(filter_year, oldest_month, 0, 0, 0, 0, 0);
        oldest_timestamp = date.getTime();
    }

    // TODO: check if oldest_timestamp can be put in options (or maybe whole range to optimize greatly)
    while (true) {
        console.log("Getting small portion of msgs");
        const options = {limit: 100};
        if (last_id) {
            options.before = last_id;
        }

        // Gets messages as map[msg_id -> msg]
        const messages = await channel.messages.fetch(options);

        sum_messages.push(...messages.values());

        // If less than limit (0,1,...,limit-1) messages are returned, it means we've reached the end of the channel messages
        if (messages.size !== 100) {
            break;
        }

        const last_timestamp = sum_messages.at(-1).createdTimestamp;
        if(oldest_timestamp && oldest_timestamp > last_timestamp) {
            break;
        }

        last_id = sum_messages.at(-1).id;
    }

    return sum_messages;
}

/**
 * Can be used for nice formatted msg. But longer in length
 *
 * @param obj
 * @returns {string}
 */
function statStringFromObj(obj) {
    let dateString = new Date(obj.newestTimestamp).toLocaleDateString();
    if (dateString.length < 10)
        dateString = " ".repeat(10 - dateString.length) + dateString;

    const kb_tot_size = obj.tot_size / 1024;

    let filesizeString = Math.floor(kb_tot_size).toString();
    if (filesizeString.length < 5)
        filesizeString += " ".repeat(5 - filesizeString.length);

    let avgFilesizeString = obj.fragments === 0 ? 0 : (kb_tot_size / parseFloat(obj.fragments)).toFixed(2);
    if (avgFilesizeString.length < 5)
        avgFilesizeString = " ".repeat(5 - avgFilesizeString.length) + avgFilesizeString;

    return obj.fragments
        + " ".repeat(obj.fragments.toString().length >= 3 ? 0 : 3 - obj.fragments.toString().length) + "  |  "
        + dateString + "  |  "
        + filesizeString + "| "
        + avgFilesizeString + "  |  "
        + obj.username;
}

function getNumberOfFragmentsFromFilename(filename) {
    return Math.max(1, (filename.match(/_cz/g) || []).length);
}

const roleToDisplayName = new Map([
    ["Nieaktywni", " N/A "],
    ["Koordynatorzy", "Koord"],
    ["Senior Tłumacze", " SR. "],
    ["Tłumacze", " REG "],
    ["Junior Tłumacze", " JR. "],
    ["Okresowcy Próbni", "TRIAL"]
]);

function getDisplayRoleString(roles) {
    let res = "[";
    for (let [role, name] of roleToDisplayName) {
        if (hasRole(roles, role)) {
            res += name;
            break;
        }
    }
    res += "] ";
    return res;
}

// TODO: Find a better name
function should_not_be_filtered_out_by_time(timestamp, filter_month, filter_year) {
    const date = new Date(timestamp);
    if((filter_month === 0 || filter_month) && date.getMonth() !== filter_month) {
        return false;
    }
    return !(filter_year && date.getFullYear() !== filter_year);

}

// TODO: Extract to utils and refactor usages (fetch_inactive also uses it)
function hasRole(roles, rolename) {
    return roles.some(role => role.name === rolename);
}
function getKeyByValue(entries, searchValue) {
    for (let [key, value] of entries) {
        if (value === searchValue)
            return key;
    }
}
