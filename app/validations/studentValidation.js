const Joi = require('joi');
const mongoose = require('mongoose');

const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

const studentSchema = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'any.required': 'Name is required'
    }),
    email: Joi.string().email().pattern(/@yopmail\.com$/).required().messages({
        'string.email': 'Invalid email format',
        'string.pattern.base': 'Email must be a "@yopmail.com" address for test purpose',
        'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
    }),
    phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).allow('').optional().messages({
        'string.pattern.base': 'Phone number must be 10 digits'
    }),
    courseId: Joi.string().custom(isValidObjectId,'ObjectId validation').required().messages({
        'any.invalid': 'Invalid course ID',
        'any.required': 'Course ID is required'
    }),
    batchId: Joi.string().custom(isValidObjectId,'ObjectId validation').required().messages({
        'any.invalid': 'Invalid batch ID',
        'any.required': 'Batch ID is required'
    })
});

module.exports = { studentSchema };
