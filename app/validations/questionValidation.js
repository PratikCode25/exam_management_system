const Joi=require('joi');
const mongoose=require('mongoose');


const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('any.invalid');
    }
    return value;
};

const questionSchema = Joi.object({
    exam: Joi.string().custom(isValidObjectId,'ObjectId validation').required().messages({
        'any.required': 'Exam ID is required',
        'any.invalid': 'Invalid Exam ID',
        'string.empty': 'Exam ID cannot be empty'
    }),
    questionText: Joi.string().required().messages({
        'any.required': 'Question text is required',
        'string.empty': 'Question text cannot be empty'
    }),
    correctOption: Joi.string().valid('A', 'B', 'C', 'D').required().messages({
        'any.only': 'Correct option must be one of A, B, C, or D',
        'any.required': 'Correct option is required'
    }),
    options: Joi.array().length(4).items(
        Joi.object({
            optionId: Joi.string().valid('A', 'B', 'C', 'D').required().messages({
                'any.only': 'Option ID must be A, B, C, or D',

                
                'any.required': 'Option ID is required'
            }),
            text: Joi.string().required().messages({
                'string.empty': 'Option text cannot be empty',
                'any.required': 'Option text is required'
            })
        })
    ).required().messages({
        'array.length': 'Exactly 4 options are required',
        'any.required': 'Options are required'
    })
});

module.exports={questionSchema};