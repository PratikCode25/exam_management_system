const Joi=require('joi');

const courseValidationSchema=Joi.object({
    name:Joi.string().required().label('Course name').messages({
        'any.required':'Course name is required',
        'string.empty': 'Course Name can not be empty'
    }),
    description:Joi.string().allow('').optional().label('Description')
})

module.exports={courseValidationSchema};