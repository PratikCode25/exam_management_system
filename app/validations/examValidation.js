const Joi=require('joi');
const mongoose=require('mongoose');

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('any.invalid');
    }
    return value;
};

const examValidationSchema = Joi.object({
    title: Joi.string()
        .required()
        .messages({
            'string.base': 'Title must be a string',
            'string.empty': 'Title is required',
            'any.required': 'Title is required'
        }),

    description: Joi.string()
        .allow('')
        .messages({
            'string.base': 'Description must be a string'
        }),

    course: Joi.string().required().custom(isValidObjectId,'ObjectId validation').messages({
        'any.required': 'Course  is required',
        'any.invalid': 'Invalid course ID',
        'string.empty': 'Course cannot be empty'
    }),

    batch: Joi.array()
        .items(Joi.string().required().custom(isValidObjectId,'ObjectId validation').messages({
            'any.required': 'Batch is required',
            'any.invalid': 'Invalid batch ID',
            'string.empty': 'Batch cannot be empty'
        }))
        .min(1)
        .required()
        .messages({
            'array.base': 'Batch must be an array of IDs',
            'array.min': 'At least one batch is required',
            'any.required': 'Batch is required'
        }),
    duration: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'Duration must be a number',
            'number.positive': 'Duration must be positive',
            'any.required': 'Duration is required'
        }),

    startTime: Joi.date()
        .iso()
        .required()
        .messages({
            'date.base': 'Start time must be a valid ISO date',
            'any.required': 'Start time is required'
        }),
    totalQuestions: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            'number.base': 'Total questions must be a number',
            'number.min': 'There must be at least 1 question',
            'any.required': 'Total questions are required'
        }),

    marksPerQuestion: Joi.number()
        .positive()
        .required()
        .messages({
            'number.base': 'Marks per question must be a number',
            'number.positive': 'Marks per question must be positive',
            'any.required': 'Marks per question is required'
        }),

    negativeMarkPerWrongAnswer: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.base': 'Negative mark must be a number',
            'number.min': 'Negative mark must be positive',
            'any.required': 'Negative mark is required'
        }),

    passingPercentage: Joi.number()
        .min(0)
        .max(100)
        .required()
        .messages({
            'number.base': 'Passing percentage must be a number',
            'number.min': 'Passing percentage cannot be below 0',
            'number.max': 'Passing percentage cannot exceed 100',
            'any.required': 'Passing percentage is required'
        })
});

module.exports={examValidationSchema};