'use strict'

const { EOL } = require('os');
const chalk = require('chalk');
const axios = require('axios');
const cheerio = require('cheerio');
const htmlentities = require('html-entities');
const TurndownService = require('turndown');
const http = require('http');

const {
    getReport,
    getDate,
    getAllZHSSports,
    scraperCanRun
} = require('./utils/utils.js')
const {
    createZHSSport,
    createZHSSportCourse,
    addRelationZHSSportCourse,
    createZHSSportCourseOffering,
    addRelationZHSSportCourseOffering,
    createZHSSportCourseCost,
    createZHSSportsCourseEvent,
    createZHSSportLocation,
    updateScraper
} = require('./utils/query.js')

let report = {}
let errors = []
let newZHSSports = 0

// Stopped here -> continue here with the adaptions -> important to differentiate between old and new data
const scrape = async (allSG, scraper) => {
    // Base URL 
    const baseUrl = "https://www.buchung.zhs-muenchen.de/"
    // Base Sports URL
    const baseSportsUrl = baseUrl + "angebote/aktueller_zeitraum_0/"
    // Library in order to convert HTML to Markdown
    var turndownService = new TurndownService()

    const instance = axios.create({
        baseURL: '/',
        timeout: 30000,
        httpAgent: new http.Agent({ keepAlive: true }),
    });

    const MAX_REQUESTS_COUNT = 5
    const INTERVAL_MS = 100
    let PENDING_REQUESTS = 0

    /**
     * Axios Request Interceptor
     */
    instance.interceptors.request.use(function (config) {
        console.log("test")
        return new Promise((resolve, reject) => {
            let interval = setInterval(() => {
                if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
                    PENDING_REQUESTS++
                    clearInterval(interval)
                    resolve(config)
                }
            }, INTERVAL_MS)
        })
    })
    /**
     * Axios Response Interceptor
     */
    instance.interceptors.response.use(function (response) {
        PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
        return Promise.resolve(response)
    }, function (error) {
        PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1)
        return Promise.reject(error)
    })

    try {
        let res = await instance.get(baseSportsUrl);

        let $ = cheerio.load(res.data);
        // All sport types name
        const sportTypeNames = $('#bs_content > dl > dd').toArray().map(element => $(element).text())
        // All links to the sport pages
        let sportLinks = $('#bs_content > dl > dd').toArray().map(element => baseSportsUrl + $(element).children().attr("href"))

        // TODO: Only for dev purposes -> change above variable to const then
        sportLinks = sportLinks.splice(0, 20)

        // Go through every sport type and fetch more details
        sportLinks.forEach(async (sportLink, i) => {
            let res = await instance.get(sportLink);

            let $ = cheerio.load(res.data);

            // Course headings
            let sportHeadingGerman = $('.bs_head').text()
            let sportHeadingEnglish = $('.bs_kursbeschreibung .bslang_en span strong').map((i, element) => {
                if ($(element).parent().css('font-size') == '14px') {
                    return $(element).text()
                }
            })?.[0]
            sportHeadingEnglish = (sportHeadingEnglish == undefined) ? sportHeadingGerman : sportHeadingEnglish

            const sportID = await createZHSSport(
                {
                    name: sportHeadingGerman,
                    link: sportLink
                },
                {
                    name: sportHeadingEnglish,
                },
                scraper
            )

            // Differentiate between different offerings for one sport (eg. lecture free period, other events etc)
            $('.bs_angblock').map(async (i, element) => {
                let $ = cheerio.load(res.data);

                let sportDescriptionGerman =
                    turndownService.turndown(
                        $(element)
                            .find('.bs_kursbeschreibung .bslang_de')
                            .map((i, element) => $(element).html())
                            .get()
                            .join(EOL)
                    ).trim()
                //console.log(sportDescriptionGerman)

                let sportDescriptionEnglish =
                    turndownService.turndown(
                        $(element)
                            .find('.bs_kursbeschreibung .bslang_en')
                            .map((i, element) => $(element).html())
                            .get()
                            .join(EOL)
                    ).trim()
                //console.log(sportDescriptionEnglish)

                const sportCourseID = await createZHSSportCourse(
                    {
                        heading: sportHeadingGerman,
                        description: sportDescriptionGerman,
                    },
                    {
                        heading: sportHeadingEnglish,
                        description: sportDescriptionEnglish,
                    },
                    {
                        zhs_sport: [sportID]
                    },
                    scraper
                )

                $(element).find('div.bs_kursangebot > table > tbody > tr').map(async (i, element) => {     // Each in order to properly go through each element
                    const courseNumber = $(element).find('td.bs_sknr').text();
                    const details = $(element).find('td.bs_sdet').text();
                    const day = $(element).find('td.bs_stag').text();
                    const time = $(element).find('td.bs_szeit').text();
                    const location = $(element).find('td.bs_sort').text();
                    const locationLinkRoute = $(element).find('td.bs_sort > a').attr('href');
                    const locationLink = baseUrl.slice(0, -1) + locationLinkRoute;
                    const duration = $(element).find('td.bs_szr').text();
                    // Details only avaiable in German
                    const detailsViewLinkRoute = $(element).find('td.bs_szr a').attr('href')
                    const detailsViewLink = baseUrl.slice(0, -1) + detailsViewLinkRoute
                    const guidance = $(element).find('td.bs_skl').text();
                    const bookingRawValue = $(element).find('td.bs_sbuch > input').val();
                    const bookable = (bookingRawValue == 'buchen') ? true : false;
                    let bookingLinkDetails;
                    if (bookable) {
                        const courseID = $(element).find('td.bs_sbuch > input').attr('name')
                        bookingLinkDetails = {
                            method: 'POST',
                            link: baseUrl + 'cgi/anmeldung.fcgi',
                            headers: {
                                authority: 'www.buchung.zhs-muenchen.de',
                                'cache-control': 'max-age=0',
                                'content-type': 'application/x-www-form-urlencoded',
                                origin: baseUrl,
                                referer: sportLink
                            },
                            payload: courseID + '=buchen'
                        }
                    }

                    const sportCourseOfferingID = await createZHSSportCourseOffering(
                        {
                            courseNumber: courseNumber,
                            details: details,
                            day: day,
                            time: time,
                            duration: duration,
                            guidance: guidance,
                            detailsViewLink: detailsViewLink,
                            bookable: bookable,
                            bookingLinkDetails: bookingLinkDetails
                        }
                    )

                    const sportCourseRelationOfferingsID = await addRelationZHSSportCourse(
                        sportCourseID,
                        {
                            zhs_sport_course_offerings: [sportCourseOfferingID]
                        }
                    )

                    const costDetailedRaw = $(element).find('td.bs_spreis > div > div')
                    let costDetailed, costStudents, costEmployee, costAssociationMember, costShort
                    if (costDetailedRaw.text().length > 0) {
                        costDetailed = $(costDetailedRaw).text()
                        costStudents = $(costDetailedRaw).find('div:nth-child(1)').text()
                        costEmployee = $(costDetailedRaw).find('div:nth-child(4)').text()
                        costAssociationMember = $(costDetailedRaw).find('div:nth-child(7)').text()
                        costShort = $(element).find('td.bs_spreis > div').children().remove().end().text().replace(/\s/g, '');
                    } else {
                        const costOnlyCardRaw = $(element).find('td.bs_spreis > span')
                        costDetailed = costOnlyCardRaw.contents().first().text() + " " + costOnlyCardRaw.contents().last().text()
                        costShort = costDetailed
                    }
                    const costOnlyCard = (costDetailed == 'nur mit Basic-Ticket') ? true : false

                    const sportCourseCostID = await createZHSSportCourseCost(
                        {
                            costShort: costShort,
                            costDetailed: costDetailed,
                            costStudents: costStudents,
                            costEmployee: costEmployee,
                            costAssociationMember: costAssociationMember,
                            costOnlyCard: costOnlyCard
                        },
                        {
                            zhs_sport_course_offerings: [sportCourseOfferingID]
                        }
                    )

                    if (locationLinkRoute != undefined) {
                        //console.log(locationLink)
                        let res = await instance.get(locationLink);
                        //console.log(res.data)
                        $ = cheerio.load(res.data);

                        // Adress line of location page
                        const bs_head = $('.bs_head') // First line of text
                        const name = $(bs_head).text()
                        const street = $(bs_head)[0].next.data.trim()
                        const city = $(bs_head)[0].next.next.next.data.trim()
                        let relevantLocationData = null

                        if ($('head > script:contains("//<![CDATA[")').html() != null
                            && $('head > script:contains("//<![CDATA[")').html() != '') {
                            const scriptTag = $('head > script:contains("//<![CDATA[")')
                                .html()
                                .trim()
                                .split(/(?=\[\[)/g)[1]  // doesnt remove the delimiter
                                .split("]]")[0]    // here no other option than removing the delimiter
                                .concat("]]")   // add closing delimiter again

                            const locationData = JSON.parse(htmlentities.decode(scriptTag))
                            //console.log(locationData)
                            relevantLocationData = locationData[0]  // Currently active one is always displayed at the top
                            //console.log(relevantLocationData)
                        }

                        const locationID = await createZHSSportLocation(
                            {
                                name: name,
                                street: street,
                                city: city,
                                longitude: (relevantLocationData != null) ? relevantLocationData[0] : null,
                                latitude: (relevantLocationData != null) ? relevantLocationData[1] : null,
                                link: locationLink
                            }
                        )

                        const sportCourseRelationLocationsID = await addRelationZHSSportCourseOffering(
                            sportCourseOfferingID,
                            {
                                zhs_sport_location: [locationID]
                            }
                        )
                    }

                    //console.log(detailsViewLinkRoute)
                    if (detailsViewLinkRoute != undefined) {
                        res = await instance.get(detailsViewLink);
                        $ = cheerio.load(res.data);

                        const sportCourseEventIDs = $('#bs_content > table > tbody > tr').toArray().map(async (element, i) => {
                            const day = $(element).find('td:nth-child(1)').text();
                            const date = $(element).find('td:nth-child(2)').text();
                            const time = $(element).find('td:nth-child(3)').text();
                            const location = $(element).find('td:nth-child(4)').text();
                            //const placeLink = $(element).find('td:nth-child(4) > a').attr('href');

                            const sportCourseEventID = await createZHSSportsCourseEvent(
                                {
                                    day: day,
                                    date: date,
                                    time: time,
                                    location: location
                                }
                            )

                            return sportCourseEventID
                        })

                        await addRelationZHSSportCourseOffering(
                            sportCourseOfferingID,
                            {
                                zhs_sport_course_events: await Promise.all(sportCourseEventIDs)
                            }
                        )
                    }

                    const lead = $('#bs_content > div:nth-child(20)').text();
                    const place = $('#bs_content > div:nth-child(25)').text();
                    const placeLink = $('#bs_content > div:nth-child(25) > a').attr('href');
                    //console.log(lead)
                    //console.log(place)
                    //console.log(placeLink)

                    const tableRow = {
                        courseNumber,
                        detail: details,
                        day,
                        time,
                        location,
                        duration,
                        guidance,
                        costDetailed,
                        costStudents,
                        costEmployee,
                        costAssociationMember,
                        costShort,
                        costOnlyCard,
                        booking: bookingRawValue,
                        sportsUrl: sportLink
                    };
                    //console.log(tableRow)
                });
            });
        });
    } catch (err) {
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