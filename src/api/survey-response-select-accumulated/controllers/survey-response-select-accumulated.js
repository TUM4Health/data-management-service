'use strict';

/**
 * A set of functions called "actions" for `survey-response-select-accumulated`
 */

module.exports = {
  // Function to fetch the accumulated result of the survey response select
  fetchAccumulatedSurveySelects: async (ctx, next) => {
    try {
      const { surveyId } = ctx.request.query;

      // Get Select question as well as the associated select response
      const surveyQuestionSelect = await strapi.entityService.findOne(
        "api::survey-question-select.survey-question-select",
        surveyId,
        {
          populate: '*'
        }
      );

      const surveyResponseId = surveyQuestionSelect?.survey_response_selects[0]?.id

      // Exit if no question or response is found
      if (!surveyResponseId) {
        ctx.body = { error: "No question or response object found!" };
        next();
        return;
      }

      // Get all possible select options
      const surveyResponseSelect = await strapi.entityService.findMany(
        "api::survey-response-select.survey-response-select",
        {
          id: surveyResponseId,
          populate: '*'
        }
      );

      if (!surveyResponseSelect || surveyResponseSelect.length === 0) {
        ctx.body = { error: "No response select objects found!" };
        next();
        return;
      }

      // Construct all choices with count 0
      const surveyResponseAllChoices = surveyQuestionSelect?.survey_question_select_choices.reduce((acc, curr) => {
        acc[curr.id] = 0;
        return acc;
      }, {});

      if (surveyResponseAllChoices === {}) {
        ctx.body = { error: "No response choice objects found!" };
        next();
        return;
      }

      // Count the number of times each choice is selected
      const surveyResponseSelectAccumulatedData = surveyResponseSelect.reduce((acc, curr) => {
        const { survey_question_select_choices } = curr;

        if (survey_question_select_choices[0]?.id) {
          acc[survey_question_select_choices[0].id] += 1;
        }
        return acc;
      }, surveyResponseAllChoices);

      // Set the final data to the response JSON body
      ctx.body = surveyResponseSelectAccumulatedData;
    } catch (err) {
      ctx.body = err;
    }
  },
};
