'use strict'

const parser = require('cron-parser')
const chalk = require('chalk')
var Mutex = require('async-mutex').Mutex
const mutex = new Mutex()

const scraperCanRun = async (scraper) => {
    const frequency = parser.parseExpression(scraper.frequency);
    const current_date = parseInt((new Date().getTime() / 1000));
    let next_execution_at = ""

    if (scraper.next_execution_at) {
        next_execution_at = scraper.next_execution_at
    }
    else {
        next_execution_at = (frequency.next().getTime() / 1000);
        await strapi.query('api::scraper.scraper').update({
            where: { id: scraper.id },
            data: {
                next_execution_at: next_execution_at
            }
        });
    }

    if (next_execution_at <= current_date) {
        await strapi.query('api::scraper.scraper').update({
            where: { id: scraper.id },
            data: {
                next_execution_at: (frequency.next().getTime() / 1000)
            }
        });
        return true
    }
    return false
}

// Update the scraper object
const updateScraper = async (scraper, report, errors) => {
    await strapi.query('scraper').update({
        id: scraper.id
    }, {
        report: report,
        error: errors,
    });

    console.log(`Job done for: ${chalk.green(scraper.name)}`);
}

// Set all scrapers to currently running
const setAllScrapersCurrentlyRunning = async (currentlyRunning) => {
    const scrapers = await strapi.query('api::scraper.scraper').findMany();
    return Promise.all(scrapers.map(async (scraper) => {
        await setScraperCurrentlyRunning(scraper, currentlyRunning);
    }))
}

// Set a single scraper to currently running
const setScraperCurrentlyRunning = async (scraper, currentlyRunning) => {
    await strapi.query('api::scraper.scraper').update({
        where: { id: scraper.id },
        data: {
            currentlyRunning: currentlyRunning
        }
    });
}

const getDate = async () => {
    const today = new Date();
    const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + ' ' + time;
}

const mergeJSONs = (json1, json2) => {
    if (json1 == null) {
        return json2
    }
    if (json2 == null) {
        return json1
    }
    for (var key in json2) {
        json1[key] = json2[key];
    }
    return json1;
}

const createOrUpdateEntriesLocalized = async (relation, filterCriteria, populateRelations, germanData, englishData) => {
    return await mutex.runExclusive(async () => {
        return await createOrUpdateEntriesLocalizedMutex(relation, filterCriteria, populateRelations, germanData, englishData)
    });
}

const createOrUpdateEntriesLocalizedMutex = async (relation, filterCriteria, populateRelations, germanData, englishData) => {
    try {
        // Check if entry already exists
        const existingEntry = await strapi.query(relation).findOne({
            where: filterCriteria,
            populate: populateRelations
        })

        // If entry exists -> Update entry
        if (existingEntry != null &&
            existingEntry.id != null &&
            existingEntry.localizations.length > 0 &&
            existingEntry.localizations[0].id != null) {

            console.log(`Entry already exists in ${relation} with ID ${existingEntry.id}`);

            const updatedLocalizationEntry = await strapi.db.query(relation).update({
                where: { id: existingEntry.localizations[0].id },
                data: mergeJSONs(
                    {
                        locale: "en"
                    },
                    englishData
                )
            });

            const updatedFullEntry = await strapi.db.query(relation).update({
                where: { id: existingEntry.id },
                data: mergeJSONs(
                    {
                        locale: "de",
                        localizations: [
                            updatedLocalizationEntry.id,
                        ]
                    },
                    germanData
                )
            });

            return updatedFullEntry.id
        } else { // If it doesn't exists -> Create new entry
            const newLocalizationEntry = await strapi.query(relation).create({
                data: mergeJSONs(
                    {
                        locale: "en"
                    },
                    englishData
                )
            })

            console.log(`Create new entry in ${relation} with ID ${newLocalizationEntry.id}`);

            const newFullEntry = await strapi.query(relation).create({
                data: mergeJSONs(
                    {
                        locale: "de",
                        localizations: [
                            newLocalizationEntry.id,
                        ]
                    },
                    germanData
                )
            })

            return newFullEntry.id
        }
    } catch (e) {
        console.log(e);
    }
}

const createOrUpdateEntries = async (relation, filterCriteria, data) => {
    return await mutex.runExclusive(async () => {
        return await createOrUpdateEntriesMutex(relation, filterCriteria, data)
    });
}

const createOrUpdateEntriesMutex = async (relation, filterCriteria, data) => {
    try {
        // Check if entry already exists
        const existingEntry = await strapi.query(relation).findOne({
            where: filterCriteria
        })

        // If entry exists -> Update entry
        if (existingEntry != null && existingEntry.id != null) {
            console.log(`Entry already exists in ${relation} with ID ${existingEntry.id}`);

            const updatedEntry = await strapi.db.query(relation).update({
                where: { id: existingEntry.id },
                data: mergeJSONs(
                    {
                        locale: "de"
                    },
                    data
                )
            });

            return updatedEntry.id
        } else { // If it doesn't exists -> Create new entry
            const newFullEntry = await strapi.query(relation).create({
                data: mergeJSONs(
                    {
                        locale: "de"
                    },
                    data
                )
            })

            console.log(`Create new entry in ${relation} with ID ${newFullEntry.id}`);

            return newFullEntry.id
        }
    } catch (e) {
        console.log(e);
    }
}

const getEntry = async (relation, selector, selectedAttributes, populateRelations = []) => {
    return await mutex.runExclusive(async () => {
        return await getEntryMutex(relation, selector, selectedAttributes, populateRelations)
    });
}

const getEntryMutex = async (relation, selector, selectedAttributes, populateRelations) => {
    try {
        const location = await strapi.db.query(relation).findOne({
            select: selectedAttributes,
            where: selector
        });

        return location?.id
    } catch (e) {
        console.log(e);
    }
}

const addRelationsToEntry = async (relation, filterCriteria, newDataRelations) => {
    return await mutex.runExclusive(async () => {
        return await addRelationsToEntryMutex(relation, filterCriteria, newDataRelations)
    });
}

const addRelationsToEntryMutex = async (relation, filterCriteria, newDataRelations) => {
    try {
        // Entries that need to be populated in query response (ID fields for each incoming relation)
        let fieldsToPopulateArray = Object.keys(newDataRelations).flatMap(key => {
            return {
                [key]: {
                    select: ['id']
                }
            }
        })

        var fieldsToPopulate = {};
        fieldsToPopulateArray.forEach(fields => {
            const key = Object.keys(fields)[0]
            fieldsToPopulate[key] = fields[key]
        });

        // Check if entry already exists
        const existingEntry = await strapi.query(relation).findOne({
            where: filterCriteria,
            populate: fieldsToPopulate
        })

        // If entry exists -> Update entry with relation
        if (existingEntry != null && existingEntry.id != null) {
            const updatedEntry = await strapi.db.query(relation).update({
                where: { id: existingEntry.id },
                data: mergeRelationalData(
                    existingEntry,
                    newDataRelations
                )
            });

            console.log(`Added ${newDataRelations} to ${relation} entry with ID ${existingEntry.id}`);

            return updatedEntry.id
        } else { // If it doesn't exists -> Error
            console.log(`Error while adding relations in ${relation} with filter criteria ${filterCriteria} and data ${newDataRelations}`);
        }
    } catch (e) {
        console.log(e);
    }
}

const mergeRelationalData = (oldDataRelations, newDataRelations) => {
    if (oldDataRelations == null) {
        return newDataRelations
    }
    if (newDataRelations == null) {
        return oldDataRelations
    }

    for (var key in newDataRelations) {
        // If array, then multiple relations exists
        if (Array.isArray(oldDataRelations[key])) {
            oldDataRelations[key] = [
                ...new Set(
                    oldDataRelations[key]
                        .map(relation => relation.id)
                        .concat(newDataRelations[key])
                )
            ]
            // Otherwise, it's just a single relation
        } else {
            oldDataRelations[key] = newDataRelations[key]
        }
    }

    return oldDataRelations;
}

const deleteEntries = async (relation, condition, scraper) => {
    return await mutex.runExclusive(async () => {
        return await deleteEntriesMutex(relation, condition, scraper)
    });
}

const deleteEntriesMutex = async (relation, condition, scraper) => {
    try {
        return (await strapi.db.query(relation).deleteMany({
            where: condition
        })).count
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    getDate,
    scraperCanRun,
    mergeJSONs,
    createOrUpdateEntriesLocalized,
    createOrUpdateEntries,
    getEntry,
    addRelationsToEntry,
    deleteEntries,
    updateScraper,
    setScraperCurrentlyRunning,
    setAllScrapersCurrentlyRunning
}