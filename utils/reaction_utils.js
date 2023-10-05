const {reactionToNumberMap} = require("./commons");

function getEpNumberFromReaction(reaction) {
    const emoji = reaction._emoji.name;
    if (!reactionToNumberMap.has(emoji)) {
        return -1;
    } else {
        return reactionToNumberMap.get(emoji);
    }
}

module.exports = {getEpNumberFromReaction};
