const {MONTH_TO_NUM} = require("../utils/constants");
const {SlashCommandNumberOption, SlashCommandBooleanOption, SlashCommandStringOption} = require("@discordjs/builders");
const {SlashCommandBuilder} = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fetch_inactive')
        .setDescription('Listuje wszystkich, którzy nie wysłali wiadomości od wybranej daty')
        .addNumberOption(
            new SlashCommandNumberOption()
                .setName("rok")
                .setDescription("rok")
                .setRequired(true)
                .setMinValue(2018)
                .setMaxValue(2100)
        )
        .addNumberOption(
            new SlashCommandNumberOption()
                .setName("miesiąc")
                .setDescription("miesiąc")
                .setRequired(true)
                .addChoices(MONTH_TO_NUM)
                .setMinValue(0)
                .setMaxValue(11)
        )
        .addNumberOption(
            new SlashCommandNumberOption()
                .setName("dzień")
                .setDescription("dzień")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(31)
        )
        .addBooleanOption(
            new SlashCommandBooleanOption()
                .setName("powiadomienia")
                .setDescription("Jeśli ustawione, jako prawda, wysyła wiadomość do wszystkich nieaktywnych")
                .setRequired(false)
        )
        .addStringOption(
            new SlashCommandStringOption()
                .setName("wiadomość")
                .setDescription("Wiadomość, która zostanie wysłana do nieaktywnych (o ile powiadomienia=true)")
                .setRequired(false)
        )
        .setDefaultPermission(false),
    async execute(interaction, client, guild) {
        await interaction.deferReply();

        console.log("fetching inactive...");

        const channel = client.channels.cache
            .find((v, k) => v.name === "status-aktywnosci");

        const year = interaction.options.getNumber("rok")
        const month = interaction.options.getNumber("miesiąc")
        const day = interaction.options.getNumber("dzień")

        // TODO: Consider using all msgs workaround here if there will be more than 100 people in the server
        // TODO: Add date and should_send_reminders as slash command
        const unique_active_users = (await channel.messages
            .fetch({limit: 100}))
            .filter(msg => msgWasSentAfterSpecifiedDate(msg, year, month, day))
            .map(msg => new Object({
                    id: msg.author.id,
                    username: msg.author.username,
                })
            );

        const all_users = (await guild.members.fetch())
            .filter(member => (!member.roles.cache.some(role => role.name === 'Nieaktywni') && !member.roles.cache.some(role => role.name === 'Koordynatorzy')))
            .filter(member => !member.user.bot)
            .map(member => new Object({
                    id: member.user.id,
                    username: member.user.username,
                    displayName: member.displayName,
                    user: member.user
                })
            );

        const all_inactive = all_users
            .filter(user => unique_active_users
                .filter(active_user => active_user.id === user.id).length === 0
            );

        const all_inactive_nicknames = all_inactive.map(user => user.displayName);

        /**
         * DO NOT UNCOMMENT JUST LIKE THAT. IT WOULD SEND A LOT OF DMs EVERY TIME
         */
        if (interaction.options.getBoolean("powiadomienia")) {
            const message = interaction.options.getString("wiadomość") ??
                "Cześć! Tu OX, bot z Gildii Skrybów. Piszę do Ciebie, bo nie reagujesz na pingi i bardzo dawno nie widziałem Twojej aktywności." +
                " Wejdź proszę na serwer, zajrzyj w wątek #status-aktywnosci i napisz, czy nadal chcesz wspierać aktywnie tłumaczy, czy odejść z Gildii." +
                " Możesz też wysłać prywatną wiadomość Staszkowi." +
                " W przypadku braku reakcji, zostaniesz automatycznie wyrzucony z serwera/przerzucony do nieaktywnych. Dzięki!"
            all_inactive.forEach(inactiveUser => inactiveUser.user
                .send(message)
                .then(res => console.log("Succesfully notified " + inactiveUser.displayName))
                .catch(err => console.log("ERROR while notifying: " + inactiveUser.displayName + " | err: " + err))
            );
        }

        let response = all_inactive_nicknames.join(", ");

        await interaction.editReply({
            content: response === '' ? 'Brak nieaktywnych' : response
        });
    },
}

function msgWasSentAfterSpecifiedDate(msg, year, month, day) {
    const date = new Date(msg.createdTimestamp);
    const msg_year = date.getFullYear();
    const msg_month = date.getMonth();
    const msg_day = date.getDate();

    return msg_year >= year && (msg_month > month || (msg_month === month && msg_day >= day));
}
