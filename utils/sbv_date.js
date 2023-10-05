class SbvDate {
    h
    min
    s
    ms

    constructor(string) {
        const arr = string.split(/:\./g);
        if(arr.length < 4) {
            // TODO: Throw an error
        }
        this.h = parseInt(arr[0]);
        this.min = parseInt(arr[1]);
        this.s = parseInt(arr[2]);
        this.ms = parseInt(arr[3]);
    }
}

module.exports = {SbvDate}