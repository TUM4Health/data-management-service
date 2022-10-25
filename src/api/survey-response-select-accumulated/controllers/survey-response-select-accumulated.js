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
      }

      // Construct all choices with count 0
      const surveyResponseAllChoices = surveyQuestionSelect?.survey_question_select_choices.reduce((acc, curr) => {
        acc[curr.id] = 0;
        return acc;
      }, {});

      if (surveyResponseAllChoices === {}) {
        ctx.body = { error: "No response choice objects found!" };
        next();
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

  // Function to delete all survey select questions, responses as well as relationships
  deleteAllSurveySelects: async (ctx, next) => {
    try {
      const { surveyId } = ctx.request.query;

      // Delete the survey select question
      const surveyQuestionSelect = await strapi.entityService.delete(
        "api::survey-question-select.survey-question-select",
        surveyId,
        {
          populate: '*'
        }
      );

      // Delete the survey question
      await strapi.entityService.delete(
        "api::survey-question.survey-question",
        surveyQuestionSelect?.survey_question?.id
      );

      let deleteCount = 0;

      // Delete the survey response selects
      for await (const responseSelect of surveyQuestionSelect?.survey_response_selects) {
        await strapi.entityService.delete(
          "api::survey-response-select.survey-response-select",
          responseSelect.id
        );

        deleteCount++;
      }

      // Delete the survey response select choices
      for await (const qestionSelectChoice of surveyQuestionSelect?.survey_question_select_choices) {
        await strapi.entityService.delete(
          "api::survey-question-select-choice.survey-question-select-choice",
          qestionSelectChoice.id
        );

        deleteCount++;
      }

      ctx.body = { "sucess": true, "message": `Deleted ${deleteCount + 2} entries` };
    } catch (err) {
      ctx.body = err;
    }
  }
};
