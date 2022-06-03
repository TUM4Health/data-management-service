const {
    mainScrape,
} = require('../src/scrapers/zhsofferings.js')

module.exports = {
    /**
     * Web scraper for ZHS
     */

    '* * * * *': ({ strapi }) => {
        mainScrape();
    },
};