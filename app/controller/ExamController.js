const examModel = require('../model/exam');
const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const questionModel = require('../model/question');
const userModel = require('../model/user');
const { examValidationSchema } = require('../validations/examValidation');
const mongoose=require('mongoose');

class ExamController{
async addExamPage(req, res) {
        try {
            const courses = await courseModel.find({}).select('name');
            const batches = await batchModel.find({}).select('name');
            res.render('admin/create-exam', { courses, batches });
        } catch (error) {
            console.log(error);
        }
    }

    async addExam(req, res) {
        try {

            const { error } = examValidationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { title, description, course, batch, duration, startTime, totalQuestions, marksPerQuestion, negativeMarkPerWrongAnswer, passingPercentage } = req.body;

            // console.log(req.body);

            const courseExists = await courseModel.findById(course);
            if (!courseExists) {
                return res.status(400).json({
                    status: false,
                    message: 'Course is not found'
                });
            }

            const batchExists = await batchModel.find({ _id: { $in: batch } });
            if (batchExists.length !== batch.length) {
                return res.status(400).json({
                    status: false,
                    message: 'One or more batch is not found'
                });
            }

            const exam = new examModel({
                title,
                description,
                course,
                batch,
                duration,
                startTime: new Date(startTime),
                totalQuestions,
                marksPerQuestion,
                negativeMarkPerWrongAnswer,
                passingPercentage
            })

            await exam.save();

            return res.status(201).json({
                status: true,
                message: 'Exam setup has been saved successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async examListPage(req, res) {
        try {
            const courses = await courseModel.find({}).select('name');
            const batches = await batchModel.find({}).select('name');
            res.render('admin/exam-list', { courses, batches });
        } catch (error) {
            console.log(error);
        }
    }

    async getFilteredPaginatedExams(req, res) {
        try {
            const { examStatus, page = 1, limit = 10 } = req.query;
            const filterObj = {};
            // console.log(examStatus);
            const now = new Date(new Date().toISOString());
            if (examStatus === 'pending') {
                filterObj.startTime = { $gt: now }
            }
            if (examStatus === 'completed') {
                filterObj.startTime = { $lt: now }
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const limitVal = parseInt(limit);

            const exams = await examModel.aggregate([
                {
                    $match: filterObj
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'course',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                {
                    $unwind: '$course'
                },
                {
                    $lookup: {
                        from: 'batches',
                        localField: 'batch',
                        foreignField: '_id',
                        as: 'batch'
                    }
                },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limitVal },
                {
                    $project: {
                        title: 1,
                        description: 1,
                        startTime: 1,
                        questions:1,
                        duration: 1,
                        totalQuestions: 1,
                        marksPerQuestion: 1,
                        passingPercentage: 1,
                        negativeMarkPerWrongAnswer: 1,
                        course: { _id: '$course._id', name: '$course.name' },
                        batch: {
                            $map: {
                                input: '$batch',
                                as: 'b',
                                in: { _id: '$$b._id', name: '$$b.name' }
                            }
                        }
                    }
                }
            ]);

            const totalExams = await examModel.countDocuments(filterObj);
            return res.status(200).json({
                status: true,
                message: 'Exams has been fetched successfully',
                data: exams,
                examStatus: examStatus,
                page: parseInt(page),
                totalPages: Math.ceil(totalExams / limitVal)
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getAllExams(req, res) {
        try {
            const exams = await examModel.aggregate([
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'course',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                { $unwind: '$course' },
                {
                    $lookup: {
                        from: 'batches',
                        localField: 'batch',
                        foreignField: '_id',
                        as: 'batch'
                    }
                },
                {
                    $project: {
                        title: 1,
                        description: 1,
                        startTime: 1,
                        duration: 1,
                        totalQuestions: 1,
                        marksPerQuestion: 1,
                        passingPercentage: 1,
                        negativeMarkPerWrongAnswer: 1,
                        createdAt: 1,
                        course: {
                            _id: '$course._id',
                            name: '$course.name'
                        },
                        batch: {
                            $map: {
                                input: '$batch',
                                as: 'b',
                                in: { _id: '$$b._id', name: '$$b.name' }
                            }
                        }
                    }
                }
            ]);

            // console.log(exams);
            return res.status(200).json({
                status: true,
                message: 'Exams data has been fetched successfully',
                data: exams
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getExamsByFilter(req, res) {
        try {
            const { batchId } = req.query;
            const filterObj = {};
            if (batchId) {
                filterObj.batch = { $in: [new mongoose.Types.ObjectId(batchId)] };
            }

            const exams = await examModel.aggregate([
                {
                    $match: filterObj
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'course',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                { $unwind: '$course' },
                {
                    $lookup: {
                        from: 'batches',
                        localField: 'batch',
                        foreignField: '_id',
                        as: 'batch'
                    }
                },
                {
                    $project: {
                        title: 1,
                        description: 1,
                        startTime: 1,
                        duration: 1,
                        totalQuestions: 1,
                        marksPerQuestion: 1,
                        passingPercentage: 1,
                        negativeMarkPerWrongAnswer: 1,
                        createdAt: 1,
                        course: {
                            _id: '$course._id',
                            name: '$course.name'
                        },
                        batch: {
                            $map: {
                                input: '$batch',
                                as: 'b',
                                in: { _id: '$$b._id', name: '$$b.name' }
                            }
                        }
                    }
                }
            ]);

            return res.status(200).json({
                status: true,
                message: 'Exams data has been fetched successfully',
                data: exams
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }


    async getSingleExam(req, res) {
        try {
            const id = req.params.id;
            const examData = await examModel.aggregate([
                {
                    $match: {
                        _id: new mongoose.Types.ObjectId(id)
                    }
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'course',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                {
                    $unwind: '$course'
                },
                {
                    $lookup: {
                        from: 'batches',
                        localField: 'batch',
                        foreignField: '_id',
                        as: 'batch'
                    }
                },
                {
                    $project: {
                        title: 1,
                        description: 1,
                        duration: 1,
                        startTime: 1,
                        totalQuestions: 1,
                        marksPerQuestion: 1,
                        negativeMarkPerWrongAnswer: 1,
                        passingPercentage: 1,
                        course: { _id: '$course._id', name: '$course.name' },
                        batch: {
                            $map: {
                                input: '$batch',
                                as: 'b',
                                in: { _id: '$$b._id', name: '$$b.name' }
                            }
                        }

                    }
                }
            ])

            if (!examData || examData.length === 0) {
                return res.status(404).json({
                    status: false,
                    message: 'Exam data not found'
                });
            }

            const exam = examData[0];

            return res.status(200).json({
                status: true,
                message: 'Exam data has been fetched successfully',
                data: exam
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async updateExam(req, res) {
        try {
            const { error } = examValidationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { title, description, duration, course, batch, startTime, totalQuestions, marksPerQuestion, negativeMarkPerWrongAnswer, passingPercentage } = req.body;

            const examId = req.params.id;
            const exam = await examModel.findById(examId);
            if (!exam) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                })
            }

            const now=new Date();
            
            if (exam.startTime <= now) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is ongoing or completed, can not be updated'
                });
            }

            const updateExam = await examModel.findByIdAndUpdate(examId,
                {
                    title,
                    description,
                    course,
                    batch,
                    duration,
                    startTime: new Date(startTime),
                    totalQuestions,
                    marksPerQuestion,
                    negativeMarkPerWrongAnswer,
                    passingPercentage
                },
                { new: true,runValidators:true }
            )

            if (!updateExam) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: "Exam has been updated successfully",
                data: updateExam
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async deleteExam(req, res) {
        try {
            const id = req.params.id
            const exam = await examModel.findById(id);
            if (!exam) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                })
            }

            const now=new Date();

            if (exam.startTime <= now) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is ongoing or completed, can not be deleted'
                });
            }

            const deletedExam = await examModel.findByIdAndDelete(id);
            if (!deletedExam) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                })
            }

            await questionModel.deleteMany({ exam: id });

            return res.status(200).json({
                status: true,
                message: 'Exam and its questions has been deleted successfully',
                data: deletedExam
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

module.exports=new ExamController();