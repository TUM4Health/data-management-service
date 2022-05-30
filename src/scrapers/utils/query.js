'use strict'

const chalk = require('chalk')

const {
    createOrUpdateEntriesLocalized,
    createOrUpdateEntries,
    addRelationsToEntry,
    mergeJSONs
} = require('./utils.js')

// Create the entire sports + links table + create relation to individual sport course
const createZHSSport = async (dataGerman, dataEnglish, scraper) => {
    try {
        return await createOrUpdateEntriesLocalized(
            'api::zhs-sport.zhs-sport',
            {
                $and: [
                    {
                        name: dataGerman["name"],
                    },
                    {
                        locale: "de",
                    },
                ],
            },
            ['localizations'],
            dataGerman,
            dataEnglish
        )
    } catch (e) {
        console.log(e);
    }
}

// Create individual sports course together with event schedule, sets the relation to the individual sports location
const createZHSSportCourse = async (dataGerman, dataEnglish, relationData, scraper) => {
    try {
        const entryID = await createOrUpdateEntriesLocalized(
            'api::zhs-sport-course.zhs-sport-course',
            {
                $and: [
                    {
                        heading: dataGerman["heading"],
                    },
                    {
                        description: dataGerman["description"],
                    },
                    {
                        locale: "de",
                    },
                ],
            },
            ['localizations'],
            dataGerman,
            dataEnglish
        )

        return await addRelationsToEntry(
            'api::zhs-sport-course.zhs-sport-course',
            {
                id: entryID
            },
            relationData
        )
    } catch (e) {
        console.log(e);
    }
}

const addRelationZHSSportCourse = async (sportCourseID, relationData) => {
    try {
        return await addRelationsToEntry(
            'api::zhs-sport-course.zhs-sport-course',
            {
                id: sportCourseID
            },
            relationData
        )
    } catch (e) {
        console.log(e);
    }
}

// Creates the sports offerings table and links it to the individual sports course
const createZHSSportCourseOffering = async (data, scraper) => {
    try {
        return await createOrUpdateEntries(
            'api::zhs-sport-course-offering.zhs-sport-course-offering',
            { courseNumber: data["courseNumber"] },
            data,
        )
    } catch (e) {
        console.log(e);
    }
}

const addRelationZHSSportCourseOffering = async (sportCourseOfferingID, relationData) => {
    try {
        return await addRelationsToEntry(
            'api::zhs-sport-course-offering.zhs-sport-course-offering',
            {
                id: sportCourseOfferingID
            },
            relationData
        )
    } catch (e) {
        console.log(e);
    }
}

const createZHSSportCourseCost = async (data, relationData, scraper) => {
    try {
        const entryID = await createOrUpdateEntries(
            'api::zhs-sport-course-cost.zhs-sport-course-cost',
            {
                costShort: data["costShort"]
            },
            data,
        )

        return await addRelationsToEntry(
            'api::zhs-sport-course-cost.zhs-sport-course-cost',
            {
                id: entryID
            },
            relationData
        )
    } catch (e) {
        console.log(e);
    }
}

// Maybe create the event schedule in a different function as it creates another table entry (must be run after creation of course)
const createZHSSportsCourseEvent = async (data, scraper) => {
    try {
        return await createOrUpdateEntries(
            'api::zhs-sport-course-event.zhs-sport-course-event',
            {
                $and: [
                    {
                        day: data["day"],
                    },
                    {
                        date: data["date"],
                    },
                    {
                        time: data["time"],
                    },
                    {
                        location: data["location"],
                    }
                ],
            },
            data,
        )
    } catch (e) {
        console.log(e);
    }
}

// Create all locations of sports (probably extra scraping call BEFORE the sports course creation?)
// Checks count of locations from scraping to the count of locations in DB, checks all names and coordinates, updates them accordingly
const createZHSSportLocation = async (data, scraper) => {
    try {
        return await createOrUpdateEntries(
            'api::zhs-sport-location.zhs-sport-location',
            {
                name: data["name"]
            },
            data,
        )
    } catch (e) {
        console.log(e);
    }
}

const updateScraper = async (scraper, report, errors) => {
    await strapi.query('scraper').update({
        id: scraper.id
    }, {
        report: report,
        error: errors,
    });

    console.log(`Job done for: ${chalk.green(scraper.name)}`);
}

module.exports = {
    createZHSSport,
    createZHSSportCourse,
    addRelationZHSSportCourse,
    createZHSSportCourseOffering,
    addRelationZHSSportCourseOffering,
    createZHSSportCourseCost,
    createZHSSportsCourseEvent,
    createZHSSportLocation,
    updateScraper
}