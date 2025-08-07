const examModel = require('../model/exam');
const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const userModel = require('../model/user');
const questionModel = require('../model/question');
const submissionModel = require('../model/submission');
const fs = require('fs').promises;

const { hassPassword, comparePassword } = require('../helper/password');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { studentValidationSchema,studentUpdateValidationSchema } = require('../validations/studentValidation');
const {submissionSchema}=require('../validations/submissionValidation');
const emailLoginDetail = require('../helper/emailLoginDetail');

class StudentController {
    async loginPage(req, res) {
       return res.render('login');
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    status: false,
                    message: 'Please provide email and password'
                })
            }
            const user = await userModel.findOne({ email,role:'student' });
            if (!user) {
                return res.status(400).json({
                    status: false,
                    message: 'Invalid email or password'
                })
            }

            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    status: false,
                    message: 'Invalid email or password'
                })
            }

            const payload = {
                _id: user._id,
                username: user.name,
                image:user.image,
                role:user.role
            }

            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });
            res.cookie('student_token', token, { httpOnly: true, maxAge: 3600000*3 }); // 3 hour maxAge

            return res.status(200).json({
                status: true,
                message: 'Student logged in successfully'
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async addStudentPage(req, res) {
            try {
                const courses = await courseModel.find({}).select('name');
                const batches = await batchModel.find({}).select('name');
    
                res.render('admin/add-student', { title:'Add Student', courses, batches });
            } catch (error) {
                console.log(error);
            }
        }
    
        async addStudent(req, res) {
            try {
    
                const { error } = studentValidationSchema.validate(req.body);
                if (error) {
                    console.log(error);
                    return res.status(400).json({
                        status: false,
                        message: error.details[0].message
                    });
                }
    
                const { name, email, password, phoneNumber, courseId, batchId } = req.body;
    
                const existStudent = await userModel.findOne({ email });
                if (existStudent) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student already exists'
                    })
                }
    
                const courseExists = await courseModel.findById(courseId);
                if (!courseExists) {
                    return res.status(400).json({
                        status: false,
                        message: 'Course is not found'
                    })
                }
    
                const batchExists = await batchModel.findById(batchId);
                if (!batchExists) {
                    return res.status(400).json({
                        status: false,
                        message: 'Batch is not found'
                    })
                }
    
                const hassedPassword = await hassPassword(password);
    
                const newStudent = new userModel({
                    name,
                    email,
                    phoneNumber,
                    password: hassedPassword,
                    role:'student',
                    courseId,
                    batchId
                })
    
                if (req.file) {
                    newStudent.image = req.file.path;
                }
    
                let savedStudent = await newStudent.save();
    
                let updateBatch = await batchModel.findByIdAndUpdate(batchId,
                    { $push: { students: newStudent._id } }
                )
    
                await emailLoginDetail(req, savedStudent,password);
    
                return res.status(200).json({
                    status: true,
                    message: 'Student has been added successfully'
                })
    
            } catch (error) {
                console.log(error);
                res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
    
        }
    
        async studentPage(req, res) {
            try {
                const courses = await courseModel.find({}).select('name');
                const batches = await batchModel.find({}).select('name');
                res.render('admin/student-list', {title:'Student List', courses, batches })
            } catch (error) {
                console.log(error);
            }
        }
    
        async getAllStudents(req, res) {
            try {
                const filterObj={
                    role:'student'
                };
                const students = await userModel.aggregate([
                    {
                        $match: filterObj
                    },
                    {
                        $lookup: {
                            from: 'courses',
                            localField: 'courseId',
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
                            localField: 'batchId',
                            foreignField: '_id',
                            as: 'batch'
                        }
                    },
                    {
                        $unwind: '$batch'
                    },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            image: 1,
                            course: { _id: '$course._id', name: '$course.name' },
                            batch: { _id: '$batch._id', name: '$batch.name' }
                        }
                    }
                ])
    
    
                return res.status(200).json({
                    status: true,
                    message: "Students has been fetched successfully",
                    data: students
                })
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
        }
    
        async getFilteredPaginatedStudents(req, res) {
            try {
                const { courseId, batchId, name, page = 1, limit = 10 } = req.query;
                const filterObj = {
                    role:'student'
                };

                if (courseId) {
                    filterObj.courseId = new mongoose.Types.ObjectId(courseId);
                }
                if (batchId) {
                    filterObj.batchId = new mongoose.Types.ObjectId(batchId);
                }
                if (name) {
                    filterObj.name = { $regex: name, $options: "i" }
                }
    
                const skip = (parseInt(page) - 1) * parseInt(limit);
                const limitVal = parseInt(limit);

                const students = await userModel.aggregate([
                    {
                        $match: filterObj
                    },
                    {
                        $lookup: {
                            from: 'courses',
                            localField: 'courseId',
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
                            localField: 'batchId',
                            foreignField: '_id',
                            as: 'batch'
                        }
                    },
                    {
                        $unwind: '$batch'
                    },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limitVal },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            phoneNumber:1,
                            image: 1,
                            course: { _id: '$course._id', name: '$course.name' },
                            batch: { _id: '$batch._id', name: '$batch.name' }
                        }
                    }
                ])
    
    
                const totalStudents = await userModel.countDocuments(filterObj);
    
                return res.status(200).json({
                    status: true,
                    message: "Students has been fetched successfully",
                    data: students,
                    page: parseInt(page),
                    totalPages: Math.ceil(totalStudents / limitVal)
                })
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
        }
    
        async getSingleStudent(req, res) {
            try {
                const student = await userModel.findById(req.params.id);
                if (!student) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student is not found'
                    })
                }
                return res.status(200).json({
                    status: true,
                    message: 'Student has fetched successfully',
                    data: student
                })
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
        }
    
        async updateStudent(req, res) {
            try {
                const { error } = studentUpdateValidationSchema.validate(req.body);
                if (error) {
                    console.log(error);
                    return res.status(400).json({
                        status: false,
                        message: error.details[0].message
                    });
                }
    
                const { name, email, password, phoneNumber, courseId, batchId } = req.body;
                const studentId = req.params.id;
                const student = await userModel.findById(studentId);
                if (!student) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student is not found'
                    })
                }
    
                const courseExists = await courseModel.findById(courseId);
                if (!courseExists) {
                    return res.status(400).json({
                        status: false,
                        message: 'Course is not found'
                    })
                }
    
                const batchExists = await batchModel.findById(batchId);
                if (!batchExists) {
                    return res.status(400).json({
                        status: false,
                        message: 'Batch is not found'
                    })
                }
    
                let image = req.file ? req.file.path : student.image;
                
                const updatedStudent = await userModel.findByIdAndUpdate(studentId, {
                    name,
                    email,
                    phoneNumber,
                    courseId,
                    batchId,
                    image
                }, { new: true,runValidators:true });
    
                if (!updatedStudent) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student is not found'
                    })
                }
    
                if (batchId && batchId.toString() !== student.batchId.toString()) {
                    await batchModel.findByIdAndUpdate(student.batchId,
                        {
                            $pull: { students: student._id }
                        })
    
                    await batchModel.findByIdAndUpdate(batchId,
                        {
                            $push: { students: student._id }
                        }
                    )
                }
    
                if (req.file && student.image) {
                    try {
                        await fs.access(student.image)
                        await fs.unlink(student.image);
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.error('Error deleting old image:', error);
                        }
                    }
    
                }
    
                return res.status(200).json({
                    status: true,
                    message: "Student has been updated successfully",
                    data: updatedStudent
                })
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
        }
    
        async deleteStudent(req, res) {
            try {
                const id = req.params.id;
                // console.log(id);
                const student = await userModel.findById(id);
                if (!student) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student is not found'
                    })
                }
    
    
                const submissions = await submissionModel.find({ studentId: id });
                if (submissions.length > 0) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student has taken exam.So can not delete'
                    });
                }
    
                await batchModel.findByIdAndUpdate(student.batchId, {
                    $pull: { students: student._id }
                });
    
    
                const deletedStudent = await userModel.findByIdAndDelete(id);
    
                if (!deletedStudent) {
                    return res.status(400).json({
                        status: false,
                        message: 'Student is not found'
                    })
                }
    
                await batchModel.findByIdAndUpdate(student.batchId,
                    {
                        $pull: { students: student._id }
                    }
                )
    
                if (student.image) {
                    try {
                        await fs.access(student.image);
                        await fs.unlink(student.image);
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.error('Error deleting old image:', error);
                        }
                    }
                }
    
                return res.status(200).json({
                    status: true,
                    message: 'Student data has been deleted successfully',
                    data: deletedStudent
                })
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    status: false,
                    message: 'Something went wrong'
                })
            }
        }


    async dashboard(req, res) {
        try {
            const id = req.user._id;
            const student = await userModel.aggregate([
                {
                    $match: { _id: new mongoose.Types.ObjectId(id) }
                },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'course'
                    }
                }, {
                    $unwind: '$course'
                }, {
                    $lookup: {
                        from: 'batches',
                        localField: 'batchId',
                        foreignField: '_id',
                        as: 'batch'
                    }
                }, {
                    $unwind: '$batch'
                }, {

                    $project: {
                        name: 1,
                        email: 1,
                        course: { _id: '$course._id', name: '$course.name' },
                        batch: { _id: '$batch._id', name: '$batch.name', startDate: '$batch.startDate' }
                    }
                }

            ]);

            res.render('dashboard', { title:'Dashboard', studentInfo: student[0] || null });
        } catch (error) {
            console.log(error);
        }
    }

    async getCardData(req, res) {
        try {
            const studentId = req.params.id;

            const student = await userModel.findById(studentId).select('name courseId batchId');
            if (!student) {
                return res.status(400).json({
                    status: false,
                    message: 'Student is not found'
                })
            }

            const examsTaken = await submissionModel.aggregate([
                {
                    $match: {
                        studentId: new mongoose.Types.ObjectId(studentId)
                    }
                },
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'examId',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                { $unwind: '$exam' },
                {
                    $match: {
                        'exam.course': new mongoose.Types.ObjectId(student.courseId),
                        'exam.batch': { $in: [new mongoose.Types.ObjectId(student.batchId)] }
                    }
                },
                {
                    $count: 'count'
                }
            ]);

            const examsTakenCount = examsTaken.length > 0 ? examsTaken[0].count : 0;

            const now = new Date();

            const submissions = await submissionModel.aggregate([
                {
                    $match: {
                        studentId: new mongoose.Types.ObjectId(studentId)
                    }
                },
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'examId',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                { $unwind: '$exam' },
                {
                    $match: {
                        'exam.course': new mongoose.Types.ObjectId(student.courseId),
                        'exam.batch': { $in: [new mongoose.Types.ObjectId(student.batchId)] }
                    }
                },
                {
                    $addFields: {
                        endTime: {
                            $add: ['$exam.startTime', { $multiply: ['$exam.duration', 60000] }]
                        }
                    }
                },
                {
                    $match: {
                        endTime: { $lt: now }
                    }
                },
                {
                    $project: {
                        submit: 1,
                        exam: {
                            totalQuestions: 1,
                            marksPerQuestion: 1,
                            negativeMarkPerWrongAnswer: 1
                        }
                    }
                }
            ]);

            let totalScore = 0;
            let totalExams = 0;
            submissions.forEach((submission) => {

                const { submit, exam } = submission;

                totalExams++;

                const noOfquestionAns = submit.length;
                const noOfCorrectAns = submit.filter((ans) => ans.isCorrect === true).length;
                const noOfIncorrectAns = submit.filter((ans) => ans.isCorrect === false).length;

                const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

                // const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
                const score = Math.max((noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer),0);

                totalScore += score;
            })

            // console.log(totalScore);
            const averageScore = totalExams ? (totalScore / totalExams).toFixed(2) : 0;

            const availableExamCount = await examModel.countDocuments({
                course: student.courseId,
                batch: { $in: [student.batchId] },
                startTime: { $gte: now }
            })

            return res.status(200).json({
                status: true,
                message: 'Data has been fetched successfully',
                data: {
                    examsTakenCount,
                    averageScore,
                    availableExamCount
                }
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getScoreOverDate(req, res) {
        try {
            const studentId = req.params.id;

            const student = await userModel.findById(studentId).select('name courseId batchId');
            if (!student) {
                return res.status(400).json({
                    status: false,
                    message: 'Student is not found'
                })
            }

            const { courseId, batchId } = student;

            const results = [];

            const now = new Date();

            const submissions = await submissionModel.aggregate([
                {
                    $match: {
                        studentId: new mongoose.Types.ObjectId(studentId)
                    }
                },
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'examId',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                { $unwind: '$exam' },
                {
                    $match: {
                        'exam.course': new mongoose.Types.ObjectId(courseId),
                        'exam.batch': { $in: [new mongoose.Types.ObjectId(batchId)] }
                    }
                },
                {
                    $addFields: {
                        endTime: {
                            $add: ['$exam.startTime', { $multiply: ['$exam.duration', 60000] }]
                        }
                    }
                },
                {
                    $match: {
                        endTime: { $lt: now }
                    }
                },
                {
                    $project: {
                        submit: 1,
                        exam: {
                            title: 1,
                            startTime: 1,
                            totalQuestions: 1,
                            marksPerQuestion: 1,
                            negativeMarkPerWrongAnswer: 1
                        }
                    }
                }
            ]);

            submissions.forEach((submission) => {

                const { submit, exam } = submission;

                const noOfquestionAns = submit.length;
                const noOfCorrectAns = submit.filter((ans) => ans.isCorrect === true).length;
                const noOfIncorrectAns = submit.filter((ans) => ans.isCorrect === false).length;

                const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

                const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
                const score = (noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer);

                const percentageScore = Math.max((score / totalMarks) * 100, 0).toFixed(2);

                results.push({
                    title: exam.title,
                    date: exam.startTime.toISOString().split('T')[0],
                    score: percentageScore
                })

            })

            // console.log(results);

            return res.status(200).json({
                status: true,
                message: 'Data has been fetched successfully',
                data: results
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getAnswerBreakdown(req, res) {
        try {
            const studentId = req.params.id;

            const student = await userModel.findById(studentId).select('name courseId batchId');
            if (!student) {
                return res.status(400).json({
                    status: false,
                    message: 'Student not found'
                })
            }

            const { courseId, batchId } = student;

            const now = new Date();

            const submissions = await submissionModel.aggregate([
                {
                    $match: {
                        studentId: new mongoose.Types.ObjectId(studentId)
                    }
                },
                {
                    $lookup: {
                        from: 'exams',
                        localField: 'examId',
                        foreignField: '_id',
                        as: 'exam'
                    }
                },
                { $unwind: '$exam' },
                {
                    $match: {
                        'exam.course': new mongoose.Types.ObjectId(courseId),
                        'exam.batch': { $in: [new mongoose.Types.ObjectId(batchId)] }
                    }
                },
                {
                    $addFields: {
                        endTime: {
                            $add: ['$exam.startTime', { $multiply: ['$exam.duration', 60000] }]
                        }
                    }
                },
                {
                    $match: {
                        endTime: { $lt: now }
                    }
                },
                {
                    $project: {
                        submit: 1,
                        exam: {
                            totalQuestions: 1,
                            marksPerQuestion: 1,
                            negativeMarkPerWrongAnswer: 1
                        }
                    }
                }
            ]);


            let totalCorrectAns = 0;
            let totalWrongAns = 0;
            let totalUnans = 0;
            let totalQuestions = 0;

            submissions.forEach((submission) => {

                const { submit, exam } = submission;

                const noOfquestionAns = submit.length;
                const noOfCorrectAns = submit.filter((ans) => ans.isCorrect === true).length;
                const noOfIncorrectAns = submit.filter((ans) => ans.isCorrect === false).length;

                const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

                totalQuestions += exam.totalQuestions;
                totalCorrectAns += noOfCorrectAns;
                totalWrongAns += noOfIncorrectAns;
                totalUnans += noOfUnansweredQuestion;

            })

            const correctPercent = totalQuestions ? ((totalCorrectAns / totalQuestions) * 100).toFixed(1) : 0;
            const wrongPercent = totalQuestions ? ((totalWrongAns / totalQuestions) * 100).toFixed(1) : 0;
            const unansweredPercent = totalQuestions ? ((totalUnans / totalQuestions) * 100).toFixed(1) : 0;

            // console.log(totalCorrectAns,totalWrongAns,totalUnans,totalQuestions);

            return res.status(200).json({
                status: true,
                message: 'Data has been fetched successfully',
                data: {
                    totalQuestions:parseInt(totalQuestions),
                    totalCorrectAns:parseInt(totalCorrectAns),
                    totalWrongAns:parseInt(totalWrongAns),
                    totalUnans:parseInt(totalUnans),
                    correctPercent:parseFloat(correctPercent),
                    wrongPercent:parseFloat(wrongPercent),
                    unansweredPercent:parseFloat(unansweredPercent)
                }
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }


    async availableExam(req, res) {
        try {
            const id = req.user._id;
            const student = await userModel.findById(id);
            if (!student) {
                return res.redirect('/student/auth/login');
            }

            const now = new Date();

            const exams = await examModel.find({
                course: student.courseId,
                batch: { $in: [student.batchId] },
                $expr: {
                    $gte: [
                        { $add: ["$startTime", { $multiply: ["$duration", 60000] }] },
                        now
                    ]
                }
            }).select('title description course duration startTime');

            return res.render('available-exam', { title:'Available Exam', exams });

        } catch (error) {
            console.log(error);
        }
    }

    async takeExamPage(req, res) {
        const exam = await examModel.findById(req.params.id).select('title startTime duration');
        // console.log(exam);
        if (!exam) {
            return res.redirect('/student/dashboard');
        }

        return res.render('take-exam', { title:'Take Exam', examData: exam, studentId: req.user._id })

    }

    async getQuestions(req, res) {
        try {
            const questions = await questionModel.find({ exam: req.params.id });

            return res.status(200).json({
                status: true,
                messahge: 'Questions fetched successfully',
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

    async getSubmitAnswer(req, res) {
        try {
            const { studentId, examId } = req.params;
            const submission = await submissionModel.findOne({ studentId, examId });
            if (!submission) {
                return res.status(200).json({
                    status: true,
                    data: { submit: [] }
                });
            }
            // console.log(submission);
            return res.status(200).json({
                status: true,
                data: submission
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async submitAnswer(req, res) {
        try {
            const {error}=submissionSchema.validate(req.body);
            if(error){
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }
            const { studentId, examId, questionId, answer, isCorrect } = req.body;
            let submission = await submissionModel.findOne({ studentId, examId });

            if (!submission) {
                submission = new submissionModel({
                    studentId,
                    examId,
                    submit: [
                        {
                            questionId,
                            answer,
                            isCorrect
                        }
                    ]
                });
            } else {
                const existing = submission.submit.find((val) => val.questionId.toString() === questionId);
                if (existing) {
                    existing.answer = answer;
                    existing.isCorrect = isCorrect;
                } else {
                    submission.submit.push({ questionId, answer, isCorrect });
                }
            }

            await submission.save();

            return res.status(200).json({
                status: true,
                message: 'Answer submitted successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }


    async examResultPage(req, res) {
        try {

            const id = req.user._id;
            const student = await userModel.findById(id);
            if (!student) {
                return res.redirect('/student/auth/login');
            }

            const now = new Date();

            const exams = await examModel.aggregate([
                {
                    $match: {
                        course: student.courseId,
                        batch: { $in: [student.batchId] }
                    }
                },
                {
                    $addFields: {
                        endTime: {
                            $add: ['$startTime', { $multiply: ['$duration', 60000] }]
                        }
                    }
                },
                {
                    $match: {
                        endTime: { $lt: now }
                    }
                },
                {
                    $sort:{startTime:-1}
                },
                {
                    $project: {
                        title: 1,
                        startTime: 1
                    }
                }
            ])

            return res.render('exam-result', { title:'Exam Result', exams, studentId: req.user._id });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getExamResult(req, res) {
        try {
            const { studentId, examId } = req.params;

            if (!studentId || studentId === 'null') {
                return res.status(400).json({
                    status: false,
                    message: 'Invalid student ID provided',
                });
            }

            if (!examId || examId === 'null') {
                return res.status(400).json({
                    status: false,
                    message: 'Invalid exam ID provided',
                });
            }

            const exam = await examModel.findById(examId).select('title totalQuestions marksPerQuestion negativeMarkPerWrongAnswer');
            // console.log(exam);

            const submission = await submissionModel.findOne({ studentId, examId });
            // console.log(submission);

            if (!submission) {
                return res.status(400).json({
                    status: false,
                    message: 'Submission not found'
                })
            }

            const noOfquestionAns = submission.submit.length;
            const noOfCorrectAns = submission.submit.filter((ans) => ans.isCorrect === true).length;
            const noOfIncorrectAns = submission.submit.filter((ans) => ans.isCorrect === false).length;

            const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

            const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
            const totalScore = Math.max((noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer),0);
            // console.log(totalScore);

            const questions = await questionModel.find({ exam: examId });

            const submitAns = [];

            for (const s of submission.submit) {
                submitAns[s.questionId.toString()] = { answer: s.answer };
            }

            // console.log(submitAns);

            const quesAns = questions.map((question, index) => {
                function getTextAns(option) {
                    return question.options.find((val) => val.optionId === option).text;
                }
                // question.options.find((val)=>val.optionId===question.correctOption),
                return {
                    qno: index + 1,
                    questionText: question.questionText,
                    correctAns: getTextAns(question.correctOption),
                    yourAns: submitAns[question._id.toString()] ? getTextAns(submitAns[question._id.toString()].answer) : '--'
                }
            })

            // console.log(quesAns);

            return res.status(200).json({
                status: true,
                data: {
                    examTitle: exam.title,
                    totalMarks,
                    totalScore,
                    noOfCorrectAns,
                    noOfIncorrectAns,
                    noOfUnansweredQuestion,
                    questionAnswer: quesAns

                }
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async updatePasswordPage(req, res) {
        try {
            return res.render('update-password', { studentId: req.user._id });
        } catch (error) {
            console.log(error);
        }
    }

    async updatePassword(req, res) {
        try {
            const studentId = req.params.id;
            const { password } = req.body;

            const hassedPassword = await hassPassword(password);

            const updatedStudent = await userModel.findByIdAndUpdate(studentId,
                { $set: { password: hassedPassword } },
                { new: true,runValidators:true }
            )

            if (!updatedStudent) {
                return res.status(200).json({
                    status: false,
                    message: 'Student is not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: 'Password has been updated successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async logout(req, res) {
        try {
            res.clearCookie('student_token');
            return res.redirect('/student/login');

        } catch (error) {
            console.log(error);
        }
    }


}

module.exports = new StudentController();