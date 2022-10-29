module.exports = {
    async beforeDelete(event) {
        // Get the survey question
        const surveyQuestion = await strapi.entityService.findOne(
            "api::survey-question.survey-question",
            event.params.where.id,
            {
                populate: '*'
            }
        );

        switch (surveyQuestion.type) {
            case 'freetext':
                if (!surveyQuestion.survey_question_freetext) {
                    break;
                }

                // Delete the survey freetext question
                const surveyQuestionFreetext = await strapi.entityService.delete(
                    "api::survey-question-freetext.survey-question-freetext",
                    surveyQuestion.survey_question_freetext?.id,
                    {
                        populate: '*'
                    }
                );

                // Delete the survey response freetext
                for await (const responseFreetext of surveyQuestionFreetext?.survey_response_freetexts) {
                    await strapi.entityService.delete(
                        "api::survey-response-freetext.survey-response-freetext",
                        responseFreetext?.id
                    );
                }

                break;

            case 'range':
                if (!surveyQuestion.survey_question_range) {
                    break;
                }

                // Delete the survey range question
                const surveyQuestionRange = await strapi.entityService.delete(
                    "api::survey-question-range.survey-question-range",
                    surveyQuestion.survey_question_range?.id,
                    {
                        populate: '*'
                    }
                );

                // Delete the survey response ranges
                for await (const responseRange of surveyQuestionRange?.survey_response_ranges) {
                    await strapi.entityService.delete(
                        "api::survey-response-range.survey-response-range",
                        responseRange?.id
                    );
                }

                break;

            case 'select':
                if (!surveyQuestion.survey_question_select) {
                    break;
                }

                // Delete the survey select question
                const surveyQuestionSelect = await strapi.entityService.delete(
                    "api::survey-question-select.survey-question-select",
                    surveyQuestion.survey_question_select?.id,
                    {
                        populate: '*'
                    }
                );

                // Delete the survey response select choices
                for await (const questionSelectChoice of surveyQuestionSelect?.survey_question_select_choices) {
                    await strapi.entityService.delete(
                        "api::survey-question-select-choice.survey-question-select-choice",
                        questionSelectChoice?.id
                    );
                }

                // Delete the survey response selects
                for await (const responseSelect of surveyQuestionSelect?.survey_response_selects) {
                    await strapi.entityService.delete(
                        "api::survey-response-select.survey-response-select",
                        responseSelect?.id
                    );
                }

                break;

            default:
                break;
        }
    },
};