const Joi = require('joi');
const mongoose = require('mongoose');

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('Invalid Course ID');
    }
    return value;
};

const batchSchema = Joi.object({
    name: Joi.string().required().label('Batch name').messages({
        'string.empty': 'Batch name is required',
        'any.required': 'Batch name is required',
    }),
    courseId: Joi.string().required().custom(isValidObjectId, 'ObjectId validation').label('Course ID')
        .messages({
            'string.base': 'Course ID must be a string',
            'any.required': 'Course ID is required'
        }),
    startDate: Joi.date().required().label('Start date')
        .messages({
            'date.base': 'Start date must be a valid date',
            'any.required': 'Start date is required'
        })
})

module.exports={batchSchema}