// IMPORTANT: IF MAX_EPS * MAX_FRAG exceeds 50, fetching has to be adjusted
const MAX_EPS_AT_TIME = 3
const MAX_FRAG_PER_EP = 10
const MONTH_TO_NUM = [
    ["styczeń", 0],
    ["luty", 1],
    ["marzec", 2],
    ["kwiecień", 3],
    ["maj", 4],
    ["czerwiec", 5],
    ["lipiec", 6],
    ["sierpień", 7],
    ["wrzesień", 8],
    ["październik", 9],
    ["listopad", 10],
    ["grudzień", 11]
]

module.exports = {MAX_EPS_AT_TIME, MAX_FRAG_PER_EP, MONTH_TO_NUM}