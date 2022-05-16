const axios = require('axios')
const cheerio = require('cheerio')

module.exports = {
    /**
     * Web scraper for ZHS pages
     * Every hour
     */

    '0 * * * *': ({ strapi }) => {
        const baseUrl = 'https://www.buchung.zhs-muenchen.de/angebote/aktueller_zeitraum_0/index.html'

        axios(url)
            .then(response => {
                const html = response.data
                const $ = cheerio.load(html)
                $('bs_menu', html).each(function () {
                    return $(this)
                })
            })
    },
};