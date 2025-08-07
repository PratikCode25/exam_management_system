const questionModel = require('../model/question');
const submissionModel = require('../model/submission');
const examModel = require('../model/exam');
const courseModel = require('../model/course');
const { questionValidationSchema } = require('../validations/questionValidation');
const mongoose=require('mongoose');

class QuestionController{
async addQuestionPage(req, res) {
        const now = new Date(new Date().toISOString());
        const exams = await examModel.find({ startTime: { $gt: now } });
        res.render('admin/add-question', { exams });
    }

    async addQuestion(req, res) {
        const { error } = questionValidationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                status: false,
                message: error.details[0].message
            });
        }

        const { exam, questionText, options, correctOption } = req.body;

        const examExists = await examModel.findById(exam);
        if (!examExists) {
            return res.status(400).json({
                status: false,
                message: 'Exam is not found'
            });
        }

        const questionCount = await questionModel.countDocuments({ exam });
        if (questionCount === examExists.totalQuestions) {
            return res.status(400).json({
                status: false,
                message: `Already question limit (${examExists.totalQuestions}) is reached`
            })
        }

        const newQuestion = new questionModel({
            exam,
            questionText,
            options,
            correctOption
        })

        await newQuestion.save();

        await examModel.findByIdAndUpdate(exam,
            {
                $push: { questions: newQuestion._id }
            }
        )

        return res.status(201).json({
            status: true,
            message: 'Question has been saved successfully'
        })

    }

    async questionPage(req, res) {
        try {
            const courses = await courseModel.find({}).select('name')
            const exams = await examModel.find({}).select('title');
            res.render('admin/question-list', { courses, exams });
        } catch (error) {
            console.log(error);
        }
    }

    async getAllQuestions(req, res) {
        try {
            const questions = await questionModel.aggregate([
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'exam',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                {
                    $unwind: '$exam'
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'exam.course',
                        foreignField: '_id',
                        as: 'exam.course'
                    }
                },
                {
                    $unwind: '$exam.course'
                },
                {
                    $project: {
                        questionText: 1,
                        options: 1,
                        correctOption: 1,
                        'exam._id': 1,
                        'exam.title': 1,
                        'exam.course._id': 1,
                        'exam.course.name': 1
                    }
                }

            ])

            return res.status(200).json({
                status: true,
                message: "Questions has been fetched successfully",
                data: questions
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getFilteredPaginatedQuestions(req, res) {
        try {

            const { examId, courseId, page = 1, limit = 5 } = req.query;

            const matchConditions = {};

            if (examId) {
                matchConditions['exam._id'] = new mongoose.Types.ObjectId(examId);
            }

            if (courseId) {
                matchConditions['exam.course._id'] = new mongoose.Types.ObjectId(courseId);
            }


            const skip = (parseInt(page) - 1) * parseInt(limit);
            const limitVal = parseInt(limit);

            const basePipeline = [
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'exam',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                {
                    $unwind: '$exam'
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'exam.course',
                        foreignField: '_id',
                        as: 'exam.course'
                    }
                },
                {
                    $unwind: '$exam.course'
                },

                {
                    $project: {
                        questionText: 1,
                        options: 1,
                        correctOption: 1,
                        'exam._id': 1,
                        'exam.title': 1,
                        'exam.course._id': 1,
                        'exam.course.name': 1
                    }
                }
            ]

            if (Object.keys(matchConditions).length > 0) {
                basePipeline.push({ $match: matchConditions });
            }

            const countPipeline = [...basePipeline, { $count: 'total' }];
            const countQuestions = await questionModel.aggregate(countPipeline);
            const total = countQuestions.length > 0 ? countQuestions[0].total : 0;
            // console.log(countQuestions);

            const questions = await questionModel.aggregate([
                ...basePipeline,
                { $skip: skip },
                { $limit: limitVal }
            ]);

            // console.log(questions);
            return res.status(200).json({
                status: true,
                message: "Questions has been fetched successfully",
                data: questions,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limitVal)
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getSingleQuestion(req, res) {
        try {
            const question = await questionModel.findById(req.params.id);
            if (!question) {
                return res.status(400).json({
                    status: false,
                    message: 'Question is not found'
                });
            }

            return res.status(200).json({
                status: true,
                message: 'Question has been fetched successfully',
                data: question
            })
        }

        catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async updateQuestion(req, res) {
        try {
            const { error } = questionValidationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { exam, questionText, options, correctOption } = req.body;
            const questionId = req.params.id;

            const question = await questionModel.findById(questionId);
            if (!question) {
                return res.status(400).json({
                    status: false,
                    message: 'Question is not found'
                })
            }

            const examExists = await examModel.findById(exam);
            if (!examExists) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                });
            }

            const now = new Date(new Date().toISOString());

            const exams = await examModel.aggregate([
                {
                    $match: {
                        questions: question._id,
                        startTime: { $lt: now }
                    }
                },
                {
                    $project: {
                        title: 1,
                        startTime: 1
                    }
                }
            ])

            // console.log(exams);
            if (exams.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is already completed or going on, can not edit this question'
                })
            }

            const updatedQuestion = await questionModel.findByIdAndUpdate(questionId,
                {
                    exam,
                    questionText,
                    options,
                    correctOption
                },
                { new: true,runValidators:true }
            )

            if (!updatedQuestion) {
                return res.status(400).json({
                    status: false,
                    message: 'Question is not found'
                })
            }

            if (exam && exam.toString() !== question.exam.toString()) {
                await examModel.findByIdAndUpdate(question.exam,
                    {
                        $pull: { questions: question._id }
                    })

                await examModel.findByIdAndUpdate(exam,
                    {
                        $push: { questions: question._id }
                    }
                )
            }

            return res.status(200).json({
                status: true,
                message: "Student has been updated successfully",
                data: updatedQuestion
            })


        } catch (error) {
            console.log(error);
            res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async deleteQuestion(req, res) {
        try {
            const id = req.params.id
            const question = await questionModel.findById(id);
            if (!question) {
                return res.status(400).json({
                    status: false,
                    message: 'Question data not found'
                })
            }

            const now = new Date();

            const exams = await examModel.aggregate([
                {
                    $match: {
                        questions: question._id
                    }
                },
                {
                    $match: {
                        startTime: { $lte: now }
                    }
                },
                {
                    $project: {
                        title: 1,
                        startTime: 1
                    }
                }
            ])

            // console.log(exams);
            if (exams.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam of this question is already completed or going on, can not delete this question'
                })
            }

            const deletedQuestion = await questionModel.findByIdAndDelete(id);

            if (!deletedQuestion) {
                return res.status(400).json({
                    status: false,
                    message: 'Question data not found'
                })
            }

            await examModel.findByIdAndUpdate(question.exam,
                {
                    $pull: { questions: question._id }
                }
            )

            return res.status(200).json({
                status: true,
                message: 'Question deleted successfully'
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

module.exports=new QuestionController();