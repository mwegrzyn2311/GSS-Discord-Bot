function epNameToPossibleFilenames(epName) {
    let res = [];
    res.push(epName);

    const wordsFromEpName = epName.split(/\s+/);
    const firstLetters = wordsFromEpName
        .map(word => word[0])
        .join('')
    res.push(firstLetters);
    const firstLettersIgnoreLowercase = wordsFromEpName
        .map(word => word[0])
        .filter(wordLetter => wordLetter.toLowerCase() !== wordLetter)
        .join('')
    res.push(firstLettersIgnoreLowercase);
    const wordSubsets = wordsFromEpName
        .reduce(
            (subsets, value) => subsets.concat(
                subsets.map(set => [...set, value])
            ),
            [[]])
        .filter(subset => subset.length > 0);
    const IGNORED_FILENAMES = ["the", "a", "an", "of", "ofthe"];
    const wordSubsetsConcatted = wordSubsets
        .map(wordSubset => wordSubset.join(''))
        .filter(name => !IGNORED_FILENAMES.includes(name.toLowerCase()));
    res = res.concat(wordSubsetsConcatted);
    return res;
}

// TODO: Review if it works correctly
/**
 * Supported formats are: cz1_cz2, cz1_2, cz1-2, cz1_cz2_3-4, etc.
 */
function getFragmentNumsFromFilename(filename) {
    let res = [];
    for (let czAndNum of (filename.match(/cz\d([-_]\d)*/g) || [])) {
        for (let num of (czAndNum.match(/\d/g)) || []) {
            res.push(parseInt(num))
        }
    }
    // If there is only one fragment, it should return [1]
    return res.length === 0 ? [1] : res;
}


function getEpNameFromFilenameAndCurrEpisodes(filename, episodes) {
    // FIXME: Because of potential problems with filenames, we ignore digits and dashes - but that should not be a problem as long
    //  as there are no games at the same time like: OsomGejm1 and OsomGejm2 (which is insanely unlikely)
    // TODO: Add doc about how it is, so to speak, calculated
    const numFromFilename = getEpNumFromFilename(filename);
    const nameFromFilename = filename
        .split("_")[0]
        .replaceAll(/[-\d]+/g, "")
        .split(".sbv")[0];
    for (let epNameWithNum of episodes) {
        const epName = epNameWithNum.substring(0, epNameWithNum.lastIndexOf('_'));
        const epNum = parseInt(epNameWithNum.substring(epNameWithNum.lastIndexOf('_') + 1, epNameWithNum.length));
        if (numFromFilename === epNum && epNameToPossibleFilenames(epName).includes(nameFromFilename)) {
            return epName + "_" + epNum;
        }
    }
    return "";
}


function getEpNumFromFilename(filename) {
    const filenameWithoutExtension = filename.split(".sbv")[0];
    if (isNaN(filenameWithoutExtension.split("_")[1])) {
        return parseInt(filenameWithoutExtension.split("_")[0].replaceAll(/\D/g, ""));
    } else {
        return parseInt(filenameWithoutExtension.split("_")[1]);
    }
}

module.exports = {epNameToPossibleFilenames, getFragmentNumsFromFilename, getEpNameFromFilenameAndCurrEpisodes}
