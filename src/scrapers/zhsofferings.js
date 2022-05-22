'use strict'

const { EOL } = require('os');
const chalk = require('chalk');
const axios = require('axios');
const cheerio = require('cheerio');
const htmlentities = require('html-entities');
const TurndownService = require('turndown');

const {
    getReport,
    getDate,
    getAllZHSSports,
    scraperCanRun
} = require('./utils/utils.js')
const {
    createZHSSports,
    createZHSSportsCourse,
    createZHSSportsCourseEvent,
    createZHSLocation,
    updateScraper
} = require('./utils/query.js')

let report = {}
let errors = []
let newZHSSports = 0

// Stopped here -> continue here with the adaptions -> important to differentiate between old and new data
const scrape = async (allSG, scraper) => {
    // Base URL 
    const baseUrl = "https://www.buchung.zhs-muenchen.de/angebote/aktueller_zeitraum_0/"
    // Library in order to convert HTML to Markdown
    var turndownService = new TurndownService()

    try {
        const res = await axios.get(baseUrl);

        let $ = cheerio.load(res.data);
        // All sport types name
        const sportTypeNames = $('#bs_content > dl > dd').toArray().map(element => $(element).text())
        // All links to the sport pages
        let links = $('#bs_content > dl > dd').toArray().map(element => $(element).children().attr("href"))

        // TODO: Only for dev purposes -> change above variable to const then
        links = links.splice(0, 1)

        // Go through every sport type and fetch more details
        links.forEach(async (link) => {
            try {
                const sportsUrl = baseUrl + link
                const res = await axios.get(sportsUrl);

                let $ = cheerio.load(res.data);

                // Course headings
                let courseHeadingGerman = $('.bs_head').text()
                console.log(courseHeadingGerman)
                let courseHeadingEnglishElement = $('.bs_kursbeschreibung .bslang_en strong')[0]    // Not always the case, eg. when German and English name is the same the English name isn't displayed at all -> How to filter?
                let courseHeadingEnglish = $(courseHeadingEnglishElement).text()
                console.log(courseHeadingEnglish)

                // Differentiate between different offerings for one sport (eg. lecture free period, other events etc)
                $('.bs_angblock').map(async (i, element) => {
                    let courseDescriptionGermanMarkdown =
                        turndownService.turndown(
                            $(element)
                                .find('.bs_kursbeschreibung .bslang_de')
                                .map((i, element) => $(element).html())
                                .get()
                                .join(EOL)
                        )

                    console.log(courseDescriptionGermanMarkdown)

                    let courseDescriptionEnglishMarkdown =
                        turndownService.turndown(
                            $(element)
                                .find('.bs_kursbeschreibung .bslang_en')
                                .map((i, element) => $(element).html())
                                .get()
                                .join(EOL)
                        )

                    console.log(courseDescriptionEnglishMarkdown)

                    $(element)
                        .find('div.bs_kursangebot > table > tbody > tr').map(async (i, element) => {     // Each in order to properly go through each element
                            const courseNumber = $(element).find('td.bs_sknr').text();
                            const detail = $(element).find('td.bs_sdet').text();
                            const day = $(element).find('td.bs_stag').text();
                            const time = $(element).find('td.bs_szeit').text();
                            const location = $(element).find('td.bs_sort').text();
                            const locationLink = 'https://www.buchung.zhs-muenchen.de' + $(element).find('td.bs_sort > a').attr('href');
                            const duration = $(element).find('td.bs_szr').text();
                            const guideance = $(element).find('td.bs_skl').text();

                            try {
                                const res = await axios.get(locationLink);

                                let $ = cheerio.load(res.data);
                                const scriptTag = $('head > script:contains("//<![CDATA[")')
                                    .html()
                                    .trim()
                                    .split(/(?=\[\[)/g)[1]  // doesnt remove the delimiter
                                    .split("]]")[0]    // here no other option than removing the delimiter
                                    .concat("]]")   // add closing delimiter again

                                const locationData = JSON.parse(htmlentities.decode(scriptTag))
                                const respectiveLocationData = locationData[0]
                                console.log(respectiveLocationData[2])
                            } catch (err) {
                                // Handle Error Here
                                console.error(err);
                            }

                            const costDetailedRaw = $(element).find('td.bs_spreis > div > div')
                            let costDetailed, costStudents, costEmployee, costAssociationMember, costShort, costOnlyCard
                            if (costDetailedRaw.text().length > 0) {
                                costDetailed = $(costDetailedRaw).text()
                                costStudents = $(costDetailedRaw).find('div:nth-child(1)').text()
                                costEmployee = $(costDetailedRaw).find('div:nth-child(4)').text()
                                costAssociationMember = $(costDetailedRaw).find('div:nth-child(7)').text()
                                costShort = $(element).find('td.bs_spreis > div').children().remove().end().text();
                            } else {
                                const costOnlyCardRaw = $(element).find('td.bs_spreis > span')
                                costOnlyCard = costOnlyCardRaw.contents().first().text() + " " + costOnlyCardRaw.contents().last().text()
                            }

                            const booking = $(element).find('td.bs_sbuch > input').val();

                            // Details only avaiable in German
                            const detailsViewLink = "https://www.buchung.zhs-muenchen.de" + $(element).find('td.bs_szr a').attr('href')

                            try {
                                const res = await axios.get(detailsViewLink);

                                let $ = cheerio.load(res.data);


                                $('#bs_content > table > tbody > tr').each((i, element) => {
                                    const day = $(element).find('td:nth-child(1)').text();
                                    const date = $(element).find('td:nth-child(2)').text();
                                    const time = $(element).find('td:nth-child(3)').text();
                                    const place = $(element).find('td:nth-child(4)').text();
                                    const placeLink = $(element).find('td:nth-child(4) > a').attr('href');

                                    // Properly bundle and return data here
                                })

                                const lead = $('#bs_content > div:nth-child(20)').text();
                                const place = $('#bs_content > div:nth-child(25)').text();
                                const placeLink = $('#bs_content > div:nth-child(25) > a').attr('href');
                                console.log(lead)
                                console.log(place)
                                console.log(placeLink)
                            } catch (err) {
                                // Handle Error Here
                                console.error(err);
                            }

                            const tableRow = {
                                courseNumber,
                                detail,
                                day,
                                time,
                                location,
                                duration,
                                guideance,
                                costDetailed,
                                costStudents,
                                costEmployee,
                                costAssociationMember,
                                costShort,
                                costOnlyCard,
                                booking,
                                sportsUrl
                            };
                            console.log(tableRow)
                        });
                });
            } catch (err) {
                // Handle Error Here
                console.error(err);
            }
        });

    } catch (err) {
        // Handle Error Here
        console.error(err);
    }

    /*

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    try {
        await page.goto(url)
    } catch (e) {
        console.log(`${chalk.red("Error")}: (${url})`);
        errors.push({
            context: "Page navigation",
            url: url,
            date: await getDate()
        })
        return
    }

    const expression = "//div[@class='generator-card flex flex-col h-full']"
    const elements = await page.$x(expression);
    await page.waitForXPath(expression, { timeout: 3000 })

    const promise = new Promise((resolve, reject) => {
        elements.forEach(async (element) => {
            let card = await page.evaluate(el => el.innerHTML, element);
            let $ = cheerio.load(card)
            const name = $('.text-xl').text().trim() || null;
            // Skip this iteration if the sg is already in db
            if (allSG.includes(name))
                return;
            const stars = $('span:contains("stars")').parent().text().replace("stars", "").trim() || null;
            const forks = $('span:contains("forks")').parent().text().replace("forks", "").trim() || null;
            const issues = $('span:contains("issues")').parent().text().replace("issues", "").trim() || null;
            const description = $('.text-sm.mb-4').text().trim() || null;
            const language = $('dt:contains("Language:")').next().text().trim() || null;
            const template = $('dt:contains("Templates:")').next().text().trim() || null;
            const license = $('dt:contains("License:")').next().text().trim() || null;
            const deployLink = $('a:contains("Deploy")').attr('href') || null;

            await createSiteGenerators(
                name,
                stars,
                forks,
                issues,
                description,
                language,
                template,
                license,
                deployLink,
                scraper
            )
            newSG += 1;
        });
    });

    promise.then(async () => {
        await page.close()
        await browser.close();
    });

    */
}

const main = async () => {
    // Fetch the correct scraper thanks to the slug
    const slug = "zhs"
    const scraper = await strapi.query('api::scraper.scraper').findOne({
        slug: slug
    });

    // If the scraper doesn't exists, is disabled or doesn't have a frequency then we do nothing
    // if (scraper == null || !scraper.enabled || !scraper.frequency) {
    //     console.log(`${chalk.red("Exit")}: (Your scraper may does not exist, is not activated or does not have a frequency field filled in)`);
    //     return
    // }

    // const canRun = await scraperCanRun(scraper);
    // if (canRun && scraper.enabled) {
    const allZHSSports = await getAllZHSSports(scraper)
    await scrape(allZHSSports, scraper)
    report = await getReport(newZHSSports);
    // }
}

exports.main = main;