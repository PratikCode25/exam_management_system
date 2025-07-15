const Joi = require('joi');
const mongoose = require('mongoose');

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

const submissionSchema = Joi.object({
    studentId: Joi.string().custom(isValidObjectId, 'ObjectId validation').required().messages({
        'any.required': 'Student ID is required',
        'any.invalid': 'Invalid Student ID'
    }),
    examId: Joi.string().custom(isValidObjectId, 'ObjectId validation').required().messages({
        'any.required': 'Exam ID is required',
        'any.invalid': 'Invalid Exam ID'
    }),
    questionId: Joi.string().custom(isValidObjectId, 'ObjectId validation').required().messages({
        'any.required': 'Question ID is required',
        'any.invalid': 'Invalid Question ID'
    }),
    answer: Joi.string().valid('A', 'B', 'C', 'D').required().messages({
        'any.only': 'Answer must be one of A, B, C, or D',
        'any.required': 'Answer is required'
    }),
    isCorrect: Joi.boolean().required().messages({
        'any.required': 'isCorrect is required',
        'boolean.base': 'isCorrect must be true or false'
    })
});

module.exports={submissionSchema}