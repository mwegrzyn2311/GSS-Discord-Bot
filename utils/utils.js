const SbvDate = require("./sbv_date.js");

const axios = require("axios");

async function validateSbvFile(url) {
    console.log("Validating sbv file");
    const res = await axios.get(url, {responseType: "text"});
    const raw_text = res.data;

    const lines = raw_text.split("\r\n");
    let prev_timestamp = "";
    let curr_timestamp = "";
    let i = 0;

    let analysis_report = "";
    let bar_count = 1;
    while(i < lines.length - 1) {
        prev_timestamp = curr_timestamp;
        curr_timestamp = lines[i++];

        const from_and_to = curr_timestamp.split(",");
        const bar_from = new SbvDate(from_and_to[0]);
        const bar_to = new SbvDate(from_and_to[1]);

        let bar_text = "";
        while(i < lines.length) {
            const line = lines[i++];
            if(lineIsBlank(line)) {
                break;
            }
            analysis_report += analyzeLine(line);
            bar_text += line;
        }
        analysis_report += analyzeSingleBar(bar_text);
        i++;
        bar_count++;
    }

    if(analysis_report === "") {
        return "Twój plik wygląda spoko! Możesz go słać na pliki-tłumaczeń.";
    } else {
        return analysis_report;
    }
}
const charsAllowedAfterDot = ['.', ' ', '\r\n', '\n'];
const delimsRequiringSpace = [',', ';', '.'];
function analyzeLine(line) {
    // TODO: Check if line is not too long (which might cause problems for mobile users)
    let res = "";
    for(let i = 0; i < line.length - 1; ++i) {
        if(delimsRequiringSpace.includes(line[i]) && !charsAllowedAfterDot.includes(line[i + 1])
            // For "..." at the start of the line we may not require the space
            && (line[i] === '.' && i > 0 && line[i - 1] === '.')) {
            res += "WARN | W Belce {}, linii {} brakuje spacji po interpunkcji, która jest na pozycji {i} w linii";
        }
    }
    return res;
}

function analyzeSingleBar(bar_text) {
    // TODO: Check if text is not too long
    let res = "";
    // TODO: Check if those are all potential word delimiters
    const words = bar_text.split(/[.,?!;()\[\]{}\s]+/g);
    words.forEach(word => {
        const wordPolishCharsLen = (word.match(/[aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźżAĄBCDEĘFGIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ]/g) || []).length;
        const wordPolishUpperCharsLen = (word.match(/[AĄBCDEĘFGIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ]/g) || []).length;
        if(wordPolishUpperCharsLen !== 1 && wordPolishUpperCharsLen !== wordPolishCharsLen) {
            res += "WARN | Belka {}, timetamp {}, słowo {} może posiadać nieprawidłową liczbę wielkich liter\n"
        }
    });

    const sentences = bar_text.split(/.\s+/g);
    sentences.forEach(sentence => {

    });
    return res;
}
function lineIsBlank(line) {
    return line.replaceAll(/\s/g, "").length >= 0;
}

module.exports = {validateSbvFile}