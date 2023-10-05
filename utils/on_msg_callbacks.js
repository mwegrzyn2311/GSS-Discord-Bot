const {getEpNameFromFilenameAndCurrEpisodes} = require("./filename_utils");
const {getFragmentNumsFromFilename} = require("./filename_utils");
const {getEpNumberFromReaction} = require("./reaction_utils");
const {numberReactionsRegexp} = require("./commons");
const {reactionToNumberMap} = require("./commons");
const {MessageAttachment} = require("discord.js");
const fetch = require("node-fetch-commonjs");

function onTodoMessage(recentEpisodes, todoMsg) {
    const epNameWrapperArr = (todoMsg.content.match(/@everyone \*\*.+\*\*/g) || []);
    if (epNameWrapperArr.length <= 0) {
        console.log("Wrong todo message format: " + todoMsg.content);
    } else {
        const epNameAndNumStr = epNameWrapperArr[0].split("@everyone ")[1];

        const nameAndNumArr = epNameAndNumStr.substring(2, epNameAndNumStr.length - 2).split(" #");
        const epName = nameAndNumArr[0];
        const epNum = nameAndNumArr[1];

        // TODO: Check if numbers are all from 1 to x and in order

        const fragmentsMap = new Map();

        const reactionNumbers = todoMsg.content.match(numberReactionsRegexp);
        if (!reactionNumbers) {
            // TODO: Might implement this for other emojis than number emojis one day
        }
        reactionNumbers.forEach(reactionName => {
            const reactionNumber = reactionToNumberMap.get(reactionName)
            fragmentsMap.set(reactionNumber, {
                number: reactionNumber,
                taken: false,
                takenBy: [],
                hurryUpTimeoutPerUser: undefined,
                finished: false
            });
        });

        const numOfFragments = fragmentsMap.size;
        if (numOfFragments < 1) {
            console.log(`No fragments found in todoMessage: ${todoMsg}`)
            // FIXME: consider if it should even be there
            // msg.author.send("WARN: Bot OX nie rozpoznał formatu wstawki w #TO-DO (Brak rozpoznanych numerków)")
            //     .catch(err => console.log("ERROR while sending warning about wrong todo name format"));
            return;
        }

        todoMsg.reactions.cache.forEach(reaction => {
            const reactionNumber = getEpNumberFromReaction(reaction);
            if (reactionNumber >= 0) {
                if (fragmentsMap.has(reactionNumber)) {
                    const usersForReaction = reaction.users.cache.map((user, user_id) => new Object({
                        username: user.username,
                        id: user.id
                    }));
                    const fragment = fragmentsMap.get(reactionNumber);
                    fragment.taken = true;
                    fragment.takenBy = usersForReaction;
                }
            }
        })

        recentEpisodes.set(epName + "_" + epNum, {
            name: epName,
            epNumber: epNum,
            allFragments: fragmentsMap,
            completed: false,
            hurryUpTimeout: undefined,
        });
    }
}

function onNewReaction(recentEpisodes, messageReaction, users) {
    const epNameWrapperArr = (messageReaction.message.content.match(/@everyone \*\*.+\*\*/g) || []);
    if (epNameWrapperArr.length <= 0) {
        console.log("Wrong todo message format: " + messageReaction.message.content);
    } else {
        const epNameAndNumStr = epNameWrapperArr[0].split("@everyone ")[1];

        const nameAndNumArr = epNameAndNumStr.substring(2, epNameAndNumStr.length - 2).split(" #");
        const epName = nameAndNumArr[0];
        const epNum = nameAndNumArr[1];
        const fragmentsMap = recentEpisodes.get(`${epName}_${epNum}`).allFragments;

        const reactionNumber = getEpNumberFromReaction(messageReaction);
        if (reactionNumber >= 0) {
            if (fragmentsMap.has(reactionNumber)) {
                const usersForReaction = users.map((user, user_id) => new Object({
                    username: user.username,
                    id: user.id
                }));
                const fragment = fragmentsMap.get(reactionNumber);
                fragment.taken = true;
                fragment.takenBy = fragment.takenBy.concat(usersForReaction);
            }
        }
    }
}

function onTranslationMessage(recentEpisodes, translationMsg) {
    let episodeCompletedName = "";

    translationMsg.attachments
        .forEach((att, att_id) => {
            const epName = getEpNameFromFilenameAndCurrEpisodes(att.name, Array.from(recentEpisodes.keys()));
            if (epName !== "") {
                // TODO: handle recentEpisodes undefined and add console.log
                const episode = recentEpisodes.get(epName)
                const fragmentNums = getFragmentNumsFromFilename(att.name);
                if (episode) {
                    if (episode.allFragments) {
                        for (let fragNum of fragmentNums) {
                            const fragment = episode.allFragments.get(fragNum);
                            // TODO: Currently when one person finished, it is marked as finished. It should check if all assignees finished, maybe?
                            fragment.finished = true;
                            // TODO: Implement
                            //clearTimeout(fragment.hurryUpTimeoutPerUser);
                            // FIXME: Could be implemented better if we force up to one attachment per msg
                            if (markEpisodeAsFinishedIfApplicable(episode)) {
                                episodeCompletedName = epName;
                            }
                        }
                    }
                } else {
                    // console.log(att.name)
                    // console.log(epName)
                }
            }
        });

    return episodeCompletedName;
}

function markEpisodeAsFinishedIfApplicable(episode) {
    if ([...episode.allFragments].filter(([fragNum, fragment]) => !fragment.finished).length === 0) {
        episode.completed = true;
        return true;
    }
}

function onEpisodeCompleted(recentEpisodes, epName, translationMsgs, botChannel) {
    mergeAttachmentsToBotChannel(recentEpisodes, epName, translationMsgs, botChannel);
}
function mergeAttachmentsToBotChannel(recentEpisodes, epName, translationMsgs, botChannel) {
    const attachmentFetchPromises = translationMsgs
        .map(msg => msg.attachments)
        .filter(attMap => attMap.size > 0)
        .map(attMap => Array.from(attMap.values()))
        .flat()
        .filter(att => getEpNameFromFilenameAndCurrEpisodes(att.name, Array.from(recentEpisodes.keys())) === epName)
        .sort((att1, att2) => getFragmentNumsFromFilename(att1.name)[0] - getFragmentNumsFromFilename(att2.name)[0])
        .map(att => fetch(att.attachment)
            .then(res => res.text())
        );
    Promise.all(attachmentFetchPromises)
        .then(translationContents => {
            const mergedContent = translationContents.join('\n');
            botChannel.send(
                {
                    content: `Merged translations for ${epName}`,
                    files: [new MessageAttachment(Buffer.from(mergedContent), `${epName}_merged.sbv`)]
                }
            )
        });
}

// TODO: Remove if not needed after all or utilize
function filterOutFinishedEpisodes(recentEpisodes) {
    recentEpisodes = new Map([...recentEpisodes]
        .filter(([episodeName, episode]) => [...episode.allFragments]
            .filter(([fragNum, fragment]) => !fragment.finished)
            .length > 0
        )
    );
}

module.exports = {onTodoMessage, onNewReaction, onTranslationMessage, onEpisodeCompleted}
