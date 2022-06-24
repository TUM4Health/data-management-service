'use strict';

const { EOL } = require('os');
const cheerio = require('cheerio');
const htmlentities = require('html-entities');
const TurndownService = require('turndown');

// Properly configured Axios instance (eg. limited parallel connections, keep alive agent, etc.)
const axiosInstance = require('./utils/axios.js');
// Scraper utils
const {
    scraperCanRun,
    updateScraper,
    setScraperCurrentlyRunning,
} = require('./utils/utils.js');
// Querying utils
const {
    createZHSSport,
    createZHSSportCourse,
    addRelationZHSSportCourse,
    createZHSSportCourseOffering,
    addRelationZHSSportCourseOffering,
    createZHSSportCourseCost,
    createZHSSportsCourseEvent,
    createZHSSportLocation,
    getZHSSportLocation,
    deleteOutdatedEntries,
} = require('./utils/query.js');

const SKIP_SPORT_TYPES = ["RESTPLÄTZE - alle freien Kursplätze dieses Zeitraums"];

// Main scrape function for ZHS website
const scrape = async (scraper) => {
    // Base URL
    const baseUrl = 'https://www.buchung.zhs-muenchen.de/';
    // Base Sports URL
    const baseSportsUrl = `${baseUrl}angebote/aktueller_zeitraum_0/`;
    // Library in order to convert HTML to Markdown
    const turndownService = new TurndownService();
    // Timestamp of beginning of scrape
    const beginScrapeTimestamp = new Date().toISOString();

    try {
        const res = await axiosInstance.get(baseSportsUrl);

        const $ = cheerio.load(res.data);
        // All sport types name
        const sportTypeNames = $('#bs_content > dl > dd').toArray().map(element => $(element).text());
        const sportTypeLinks = $('#bs_content > dl > dd').toArray().map(element => baseSportsUrl + $(element).children().attr('href'));

        // Iterate over every sport type and fetch details
        await Promise.all(sportTypeLinks.map(async (sportLink, i) => {
            // Skip the "Restplätze" (so remaining tickets) sport type (as it isn't really a sport type)
            if (SKIP_SPORT_TYPES.includes(sportTypeNames[i])) {
                return false;
            }

            let res = await axiosInstance.get(sportLink);

            const $ = cheerio.load(res.data);

            const sportHeadingGerman = $('.bs_head').text();
            let sportHeadingEnglish = $('.bs_kursbeschreibung .bslang_en span strong').map((i, element) => {
                if ($(element).parent().css('font-size') == '14px') {
                    return $(element).text();
                }
            })?.[0];
            sportHeadingEnglish = (sportHeadingEnglish == undefined) ? sportHeadingGerman : sportHeadingEnglish;

            // Create localized sport type
            const sportID = await createZHSSport(
                {
                    name: sportHeadingGerman,
                    link: sportLink,
                },
                {
                    name: sportHeadingEnglish,
                },
                scraper,
            );

            // Iterate over all courses for one sport (eg. lecture period, lecture-free period, other events etc.)
            await Promise.all($('.bs_angblock').map(async (i, element) => {
                let $ = cheerio.load(res.data);

                const sportDescriptionGerman = turndownService.turndown(
                    $(element)
                        .find('.bs_kursbeschreibung .bslang_de')
                        .map((i, element) => $(element).html())
                        .get()
                        .join(EOL),
                ).trim();

                const sportDescriptionEnglish = turndownService.turndown(
                    $(element)
                        .find('.bs_kursbeschreibung .bslang_en')
                        .map((i, element) => $(element).html())
                        .get()
                        .join(EOL),
                ).trim();

                // Create a localized sport course and link the sport type to it
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
                        zhs_sport: [sportID],
                    },
                    scraper,
                );

                // Iterate all offerings of a sport course
                await Promise.all($(element).find('div.bs_kursangebot > table > tbody > tr').map(async (i, element) => { // Each in order to properly go through each element
                    const courseNumber = $(element).find('td.bs_sknr').text();
                    const details = $(element).find('td.bs_sdet').text();
                    const day = $(element).find('td.bs_stag').text();
                    const time = $(element).find('td.bs_szeit').text();
                    const locationLinkRoute = ($(element).find('td.bs_sort > a').attr('target') == '_blank') ? undefined : $(element).find('td.bs_sort > a').attr('href')?.replace('&campus=0', '');
                    const locationLink = baseUrl.slice(0, -1) + locationLinkRoute;
                    const duration = $(element).find('td.bs_szr').text();
                    const detailsViewLinkRoute = $(element).find('td.bs_szr a').attr('href')?.replace('&campus=0', '');
                    const detailsViewLink = baseUrl.slice(0, -1) + detailsViewLinkRoute;
                    const guidance = $(element).find('td.bs_skl').text();
                    const bookingRawValue = $(element).find('td.bs_sbuch > input').val();
                    const bookable = (bookingRawValue == 'buchen');
                    let bookingLinkDetails;
                    // If a course offering is bookable, build the booking link
                    if (bookable) {
                        const courseID = $(element).find('td.bs_sbuch > input').attr('name');
                        bookingLinkDetails = {
                            method: 'POST',
                            link: `${baseUrl}cgi/anmeldung.fcgi`,
                            headers: {
                                authority: 'www.buchung.zhs-muenchen.de',
                                'cache-control': 'max-age=0',
                                'content-type': 'application/x-www-form-urlencoded',
                                origin: baseUrl,
                                referer: sportLink,
                            },
                            payload: `${courseID}=buchen`,
                        };
                    }

                    // Create sport course offering
                    const sportCourseOfferingID = await createZHSSportCourseOffering(
                        {
                            courseNumber,
                            details,
                            day,
                            time,
                            duration,
                            guidance,
                            detailsViewLink,
                            bookable,
                            bookingLinkDetails,
                        },
                    );

                    // Link sport course offering to the respective sport course
                    await addRelationZHSSportCourse(
                        sportCourseID,
                        {
                            zhs_sport_course_offerings: [sportCourseOfferingID],
                        },
                    );

                    // Fetch and format cost details of a sport course offering
                    const costDetailedRaw = $(element).find('td.bs_spreis > div > div');
                    let costDetailed; let costStudents; let costEmployee; let costAssociationMember; let
                        costShort;
                    if (costDetailedRaw.text().length > 0) {
                        costDetailed = $(costDetailedRaw).find('div').toArray().map((element, i) => $(element).text() + (i % 2 == 0 ? '' : ','))
                            .join(' ')
                            .slice(0, -1);
                        costStudents = $(costDetailedRaw).find('div:nth-child(1)').text();
                        costEmployee = $(costDetailedRaw).find('div:nth-child(4)').text();
                        costAssociationMember = $(costDetailedRaw).find('div:nth-child(7)').text();
                        costShort = $(element).find('td.bs_spreis > div').children().remove()
                            .end()
                            .text()
                            ?.replace(/\s/g, '');
                    } else {
                        const costOnlyCardRaw = $(element).find('td.bs_spreis > span');
                        costDetailed = `${costOnlyCardRaw.contents().first().text()} ${costOnlyCardRaw.contents().last().text()}`;
                        costShort = costDetailed;
                    }
                    const costOnlyCard = (costDetailed == 'nur mit Basic-Ticket');

                    // Create cost associated to a sport course offering
                    await createZHSSportCourseCost(
                        {
                            costShort,
                            costDetailed,
                            costStudents,
                            costEmployee,
                            costAssociationMember,
                            costOnlyCard,
                        },
                        {
                            zhs_sport_course_offerings: [sportCourseOfferingID],
                        },
                    );

                    // If location link is available, fetch details of location
                    if (locationLinkRoute != undefined) {
                        const res = await axiosInstance.get(locationLink);
                        $ = cheerio.load(res.data);

                        // Adress line of location page
                        const bs_head = $('.bs_head'); // First line of text
                        const name = $(bs_head).text();
                        const street = $(bs_head)[0].next.data.trim();
                        const city = $(bs_head)[0].next.next.next.data.trim();
                        let relevantLocationData = null;

                        // Fetch coordinates embedded into the JS of the location details page
                        if ($('head > script:contains("//<![CDATA[")').html() != null
                            && $('head > script:contains("//<![CDATA[")').html() != '') {
                            const scriptTag = $('head > script:contains("//<![CDATA[")')
                                .html()
                                .trim()
                                .split(/(?=\[\[)/g)[1] // doesnt remove the delimiter
                                .split(']]')[0] // here no other option than removing the delimiter
                                .concat(']]'); // add closing delimiter again

                            const locationData = JSON.parse(htmlentities.decode(scriptTag));
                            relevantLocationData = locationData[0]; // Currently active one is always displayed at the top
                        }

                        // Create the sport location
                        const locationID = await createZHSSportLocation(
                            {
                                name,
                                street,
                                city,
                                longitude: (relevantLocationData != null) ? relevantLocationData[0] : null,
                                latitude: (relevantLocationData != null) ? relevantLocationData[1] : null,
                                link: locationLink,
                            },
                        );

                        // Link location to a sport course offering
                        await addRelationZHSSportCourseOffering(
                            sportCourseOfferingID,
                            {
                                zhs_sport_location: [locationID],
                            },
                        );
                    }

                    // If details link is available, fetch details of sport course offering
                    if (detailsViewLinkRoute != undefined) {
                        res = await axiosInstance.get(detailsViewLink);
                        $ = cheerio.load(res.data);

                        // Iterate over all sport course events
                        const sportCourseEventIDs = await Promise.all($('#bs_content > table > tbody > tr').toArray().map(async (element, i) => {
                            const day = $(element).find('td:nth-child(1)').text();
                            const date = $(element).find('td:nth-child(2)').text();
                            const time = $(element).find('td:nth-child(3)').text();
                            const locationVisibleText = $(element).find('td:nth-child(4)').text();
                            const locationLink = $(element).find('td:nth-child(4) > a').attr('href')?.replace('&campus=0&z=46&f=0', ''); // Remove campus and zoom level parameters

                            let locationID = null;
                            // If location link is available, fetch details of location
                            if (locationLink != null && locationLink != undefined && locationVisibleText != '') {
                                // Check if the location already exists
                                const location = await getZHSSportLocation({
                                    locationLink,
                                });
                                locationID = location?.id;

                                // If location doesn't exist yet, create it
                                if (location == null || locationID == null || locationID == undefined) {
                                    const res = await axiosInstance.get(locationLink);
                                    $ = cheerio.load(res.data);

                                    const bs_head = $('.bs_head');
                                    const name = $(bs_head).text();
                                    const street = $(bs_head)[0].next.data.trim();
                                    const city = $(bs_head)[0].next.next.next.data.trim();
                                    let relevantLocationData = null;

                                    // Fetch coordinates embedded into the JS of the location details page
                                    if ($('head > script:contains("//<![CDATA[")').html() != null
                                        && $('head > script:contains("//<![CDATA[")').html() != '') {
                                        const scriptTag = $('head > script:contains("//<![CDATA[")')
                                            .html()
                                            .trim()
                                            .split(/(?=\[\[)/g)[1] // doesnt remove the delimiter
                                            .split(']]')[0] // here no other option than removing the delimiter
                                            .concat(']]'); // add closing delimiter again

                                        const locationData = JSON.parse(htmlentities.decode(scriptTag));
                                        relevantLocationData = locationData[0]; // Currently active one is always displayed at the top
                                    }

                                    // Create the sport location
                                    locationID = await createZHSSportLocation(
                                        {
                                            name,
                                            street,
                                            city,
                                            longitude: (relevantLocationData != null) ? relevantLocationData[0] : null,
                                            latitude: (relevantLocationData != null) ? relevantLocationData[1] : null,
                                            link: locationLink,
                                        },
                                    );
                                }
                            }

                            // Create sport course event and link location to it
                            return await createZHSSportsCourseEvent(
                                {
                                    day,
                                    date,
                                    time,
                                },
                                {
                                    zhs_sport_location: [locationID], // It may be that the locationID is null as no location exists
                                },
                            );
                        }));

                        // Link all sport course events to the respective sport course offering
                        await addRelationZHSSportCourseOffering(
                            sportCourseOfferingID,
                            {
                                zhs_sport_course_events: sportCourseEventIDs,
                            },
                        );
                    }
                }));
            }));
        }));
    } catch (err) {
        console.error(err);
        return [
            {
                message: 'Error. No possibly outdated data was deleted as an error happend during fetching the data (most probably a repeated network error).',
                timestamp: new Date().toISOString(),
            },
            err,
        ];
    }

    // Only cleanup if everything went well as there will be data deleted that wasn't updated
    const deletedEntries = await deleteOutdatedEntries(beginScrapeTimestamp, scraper);

    console.log(`Success. Deleted ${deletedEntries} outdated data entries.`);
    return [
        {
            message: `Success. Deleted ${deletedEntries} outdated data entries.`,
            timestamp: new Date().toISOString(),
        },
        {},
    ];
};

// Main scrape function that is executed via cron job
const mainScrape = async () => {
    // Fetch the correct scraper via slug
    const slug = 'zhs';
    const scraper = await strapi.query('api::scraper.scraper').findOne({
        slug,
    });

    // If the scraper doesn't exists, is disabled or doesn't have a frequency then we do nothing
    if (scraper == null) {
        console.log(`Scraper '${slug}' does not exist`);
        return;
    }

    if (!scraper.enabled || !scraper.frequency) {
        console.log(`Your scraper ${slug} may not be activated or does not have a frequency field filled in`);
        return;
    }

    const canRun = await scraperCanRun(scraper);
    if (canRun && scraper.enabled && !scraper.currentlyRunning) {
        console.log("Starting the scraping process")

        // Set the scraper to currently running
        setScraperCurrentlyRunning(scraper, true);

        // Execute scraper
        const [message, err] = await scrape(scraper);
        // Update scraper information
        updateScraper(scraper, message, err);

        // Set the scraper to currently not running
        setScraperCurrentlyRunning(scraper, false);

        console.log("Finished the scraping process")
    } else {
        if (scraper.currentlyRunning) {
            console.log("Scraping process currently running")
        }
    }
};

module.exports = {
    mainScrape,
};
