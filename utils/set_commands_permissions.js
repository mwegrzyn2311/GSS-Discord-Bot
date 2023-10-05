function setCommandsPermissions() {
    console.log("Setting slash commands permissions");
    const coordinatorsRole = guild.roles.cache.find(r => r.name === "Koordynatorzy");

    guild.commands.fetch()
        .then(commands => {
                const stats_command_id = commands
                    .filter(command => command.name === "stats")
                    .map(cmd => cmd.id)[0];
                const fetchInactive_command_id = commands
                    .filter(command => command.name === "fetch_inactive")
                    .map(cmd => cmd.id)[0];
                const permissions = [{
                    id: coordinatorsRole.id,
                    type: 'ROLE',
                    permission: true,
                }];
                const fullPermissions = [
                    {
                        id: stats_command_id,
                        permissions: permissions,
                    },
                    {
                        id: fetchInactive_command_id,
                        permissions: permissions,
                    },
                ];

                guild.commands.permissions
                    .set({fullPermissions})
                    .catch(err => console.log("ERROR while setting permissions: " + err));
            }
        );
}

module.exports = {setCommandsPermissions}
