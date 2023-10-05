function debugLogRecentEps(recentEpisodes) {
    recentEpisodes.forEach((ep, epName) => {
        console.log(`Episode: ${epName}`);
        console.log(ep);
        console.log("Fragments from this ep:")
        ep.allFragments.forEach((fragment, fragmentNo) => console.log(fragment));
        console.log("----------")
    });
}

module.exports = {debugLogRecentEps}
