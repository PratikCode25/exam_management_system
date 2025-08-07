const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const { courseValidationSchema } = require('../validations/courseValidation');

class CourseController {

    async coursePage(req, res) {
        res.render('admin/course')
    }

    async addCourse(req, res) {
        try {

            const { error } = courseValidationSchema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { name, description } = req.body;
            const newCourse = new courseModel({
                name: name.trim(),
                description
            })
            await newCourse.save();
            return res.status(200).json({
                status: true,
                message: "Course has been saved successfully",
                data: newCourse
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getAllCourses(req, res) {
        try {
            const courses = await courseModel.find({});

            return res.status(200).json({
                status: true,
                message: "Courses has been fetched successfully",
                data: courses,
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getPaginatedCourses(req, res) {
        try {
            const { page = 1, limit = 5 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const limitVal = parseInt(limit);

            const courses = await courseModel.find({})
                .skip(skip)
                .limit(limitVal);

            const totalCourses = await courseModel.countDocuments();

            return res.status(200).json({
                status: true,
                message: "Courses has been fetched successfully",
                data: courses,
                page: parseInt(page),
                totalPages: Math.ceil(totalCourses / limitVal)
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getSingleCourse(req, res) {
        try {
            const course = await courseModel.findById(req.params.id);
            if (!course) {
                return res.status(400).json({
                    status: false,
                    message: 'Course is not found'
                })
            }
            return res.status(200).json({
                status: true,
                message: 'Course has been fetched successfully',
                data: course
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async updateCourse(req, res) {
        try {
            const { error } = courseValidationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { name, description } = req.body;
            const courseId = req.params.id;

            const updateCourse = await courseModel.findByIdAndUpdate(courseId,
                {
                    name: name.trim(),
                    description
                },
                { new: true, runValidators: true }
            )

            if (!updateCourse) {
                return res.status(400).json({
                    status: false,
                    message: 'Course is not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: "Course updated successfully",
                data: updateCourse
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async deleteCourse(req, res) {
        try {
            const id = req.params.id;
            const batchesUnderCourse = await batchModel.find({ courseId: id });
            if (batchesUnderCourse.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'This course has batches.So it can not be deleted.'
                })
            }

            const deletedCourse = await courseModel.findByIdAndDelete(id);
            if (!deletedCourse) {
                return res.status(400).json({
                    status: false,
                    message: 'Course is not found'
                })
            }


            return res.status(200).json({
                status: true,
                message: 'Course has been deleted successfully',
                data: deletedCourse
            })


        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }


    }


}

module.exports = new CourseController();