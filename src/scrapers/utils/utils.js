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
            id: scraper.id
        }, {
            next_execution_at: next_execution_at
        });
    }

    if (next_execution_at <= current_date) {
        await strapi.query('api::scraper.scraper').update({
            id: scraper.id
        }, {
            next_execution_at: (frequency.next().getTime() / 1000)
        });
        return true
    }
    return false
}

const getAllZHSSports = async (scraper) => {
    const existingZHSSports = await strapi.query('api::zhs-sports-test.zhs-sports-test').findMany({
        _limit: 1000,
        scraper: scraper.id
    }, ["name"]);
    const allZHSSports = existingZHSSports.map(x => x.name);
    console.log(`ZHS Sports in database: \t${chalk.blue(allZHSSports.length)}`);

    return allZHSSports;
}

const getDate = async () => {
    const today = new Date();
    const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + ' ' + time;
}

const getReport = async (newSG) => {
    return { newSG: newSG, date: await getDate() }
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

            console.log("Entry already exists");

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

            console.log("Create new entry");

            const newLocalizationEntry = await strapi.query(relation).create({
                data: mergeJSONs(
                    {
                        locale: "en"
                    },
                    englishData
                )
            })

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
            console.log("Entry already exists");

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
            console.log("Create new entry");

            const newFullEntry = await strapi.query(relation).create({
                data: mergeJSONs(
                    {
                        locale: "de"
                    },
                    data
                )
            })

            return newFullEntry.id
        }
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

        // If entry exists -> Update entry
        if (existingEntry != null && existingEntry.id != null) {
            console.log("Found relation entry");

            const updatedEntry = await strapi.db.query(relation).update({
                where: { id: existingEntry.id },
                data: mergeRelationalData(
                    existingEntry,
                    newDataRelations
                )
            });

            return updatedEntry.id
        } else { // If it doesn't exists -> Create new entry
            console.log("Error while adding relations");
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

module.exports = { getReport, getDate, getAllZHSSports, scraperCanRun, mergeJSONs, createOrUpdateEntriesLocalized, createOrUpdateEntries, addRelationsToEntry }