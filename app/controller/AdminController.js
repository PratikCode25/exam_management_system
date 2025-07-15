const adminModel = require('../model/admin');
const examModel = require('../model/exam');
const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const studentModel = require('../model/student');
const questionModel = require('../model/question');
const submissionModel = require('../model/submission');

const fs = require('fs').promises;
const emailLoginDetail = require('../helper/emailLoginDetail');
const mongoose = require('mongoose');

const { hassPassword, comparePassword } = require('../helper/password');
const jwt = require('jsonwebtoken');

const { courseValidationSchema } = require('../validations/courseValidation');
const { batchSchema } = require('../validations/batchValidation');
const { examValidationSchema } = require('../validations/examValidation');
const { questionSchema } = require('../validations/questionValidation');
const { studentSchema } = require('../validations/studentValidation');


class AdminController {
    async addUser(req, res) {
        try {
            const { name, email, password, role } = req.body;
            const existUser = await adminModel.findOne({ email });
            if (existUser) {
                return res.status(400).json({
                    status: false,
                    message: 'User already exists'
                })
            }
            const hassedPassword = await hassPassword(password);
            const newUser = new adminModel({
                name,
                email,
                password: hassedPassword,
                role: 'admin'
            })

            const savedUser = await newUser.save();
            return res.status(200).json({
                status: true,
                message: 'User is saved'
            })

        } catch (error) {
            return res.status(500).json({
                message: error.message
            })
        }
    }

    async loginPage(req, res) {
        res.render('admin/login');
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
            const user = await adminModel.findOne({ email });
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
                role: user.role
            }

            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });
            res.cookie('admin_token', token, { httpOnly: true, maxAge: 3600000 }); // 1 hour maxAge

            return res.status(200).json({
                status: true,
                message: 'Admin logged in successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    // ----- logout-------

    async logout(req, res) {
        try {
            res.clearCookie('admin_token');
            return res.redirect('/admin/login');
        } catch (error) {
            console.log(error);
        }
    }


    // ------- update password-------------

    async updatePasswordPage(req, res) {
        try {
            return res.render('admin/update-password', { userId: req.user._id });
        } catch (error) {
            console.log(error);
        }
    }

    async updatePassword(req, res) {
        try {
            const userId = req.params.id;
            const { password } = req.body;
        
            const hassedPassword = await hassPassword(password);

            const updatedUser = await adminModel.findByIdAndUpdate(userId,
                { $set: { password: hassedPassword } },
                { new: true,runValidators:true }
            )

            if (!updatedUser) {
                return res.status(200).json({
                    status: false,
                    message: 'User not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: 'Password updated successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    // ------------- dashboard------------
    async dashboard(req, res) {
        try {
            const courses = await courseModel.find({});
            res.render('admin/dashboard', { courses });
        } catch (error) {
            console.log(error);
        }
    }

    async getCardData(req, res) {
        try {
            const courseCount = await courseModel.countDocuments();
            const batchCount = await batchModel.countDocuments();
            const examCount = await examModel.countDocuments();
            const studentCount = await studentModel.countDocuments();

            const now = new Date(new Date().toISOString());
            const ongoingExams = await examModel.aggregate([
                {
                    $addFields: {
                        endTime: {
                            $add: ['$startTime', { $multiply: ['$duration', 60000] }]
                        }
                    }
                },
                {
                    $match: {
                        startTime: { $lt: now },
                        endTime: { $gt: now }
                    }
                },
                {
                    $count: 'count'

                }
            ])

            const pendingExamsCount = await examModel.countDocuments({ startTime: { $gt: now } });

            return res.status(200).json({
                status: true,
                message: 'Data has been fetched successfuly',
                data: {
                    courseCount,
                    batchCount,
                    studentCount,
                    examCount,
                    ongoingExamsCount: ongoingExams[0]?.count || 0,
                    pendingExamsCount
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

    async getAvgScorePerCourse(req, res) {
        try {
            const courses = await courseModel.find({}).select('name');
            const now = new Date(new Date().toISOString());
            const results = [];

            for (const course of courses) {
                // console.log(course.name);
                const currentStudents = await studentModel.find({ courseId: course._id }).select('_id');
                const currentStudentIds = currentStudents.map((stu) => stu._id.toString());

                const exams = await examModel.aggregate([
                    {
                        $match: {
                            course: course._id
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
                        $project: {
                            title: 1,
                            startTime: 1,
                            totalQuestions: 1,
                            marksPerQuestion: 1,
                            negativeMarkPerWrongAnswer: 1
                        }
                    }
                ])


                let totalExamsAvgPercentage = 0;
                let examCount = 0;
                for (const exam of exams) {
                    examCount++;

                    let examTotalMarks = exam.totalQuestions * exam.marksPerQuestion;

                    let examTotalPercentage = 0;

                    const submissions = await submissionModel.find({ examId: exam._id }).select('studentId submit');
                    const filteredSubmissions = submissions.filter((sub) => currentStudentIds.includes(sub.studentId.toString()));

                    //   console.log('submission :',submissions);

                    let studentCount = 0;
                    for (const submission of filteredSubmissions) {
                        studentCount++;
                        const noOfquestionAns = submission.submit.length;
                        const noOfCorrectAns = submission.submit.filter((ans) => ans.isCorrect === true).length;
                        const noOfIncorrectAns = submission.submit.filter((ans) => ans.isCorrect === false).length;

                        const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;
                        const studentScore = Math.max((noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer),0);

                        // console.log({stu:submission.studentId,score:studentScore});
                        const studentScorePercetage = (studentScore / examTotalMarks) * 100;
                        examTotalPercentage += studentScorePercetage;
                        // console.log(course.name,studentScorePercetage);
                        // console.log(course.name,examTotalPercentage);

                    } // end of submission
                    // console.log(course.name,studentCount);
                    const examAvgPercentage = studentCount>0? examTotalPercentage / studentCount:0;
                    totalExamsAvgPercentage += examAvgPercentage;

                    // console.log(course.name,examAvgPercentage);
                }// end of exams
                const courseAvgPercentage = examCount > 0 ? totalExamsAvgPercentage / examCount : 0;

                results.push({
                    courseName: course.name,
                    courseAvgPercentage: parseFloat(courseAvgPercentage.toFixed(2))
                })

                // console.log(results);

            } // end of course



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

    async getPassFailPerCourse(req, res) {
        try {
            const courseId = req.params.id;

            if (!courseId || courseId === 'null') {
                return res.status(400).json({
                    status: false,
                    message: 'Invalid course ID provided',
                });
            }

            const course = await courseModel.findById(courseId).select('name');
            if (!course) {
                return res.status(400).json({
                    status: false,
                    message: 'Course not found'
                })
            }
            const now = new Date(new Date().toISOString());
            const exams = await examModel.aggregate([
                {
                    $match: {
                        course: new mongoose.Types.ObjectId(courseId)
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
                    $project: {
                        title: 1,
                        startTime: 1,
                        totalQuestions: 1,
                        marksPerQuestion: 1,
                        negativeMarkPerWrongAnswer: 1,
                        passingPercentage: 1,
                        batch: 1
                    }
                }
            ])
            // console.log(exams); 

            let totalPass = 0;
            let totalFail = 0;
            let allStudentIds = new Set();

            const currentStudents = await studentModel.find({ courseId }).select('_id');
            const currentStudentIds = new Set(currentStudents.map((stu) => stu._id.toString()));


            for (const exam of exams) {
                let studentIds = [];

                for (const batch of exam.batch) {
                    const batchData = await batchModel.findById(batch).select('name students');
                    // console.log(batchData);
                    studentIds.push(...batchData.students.map((id) => id.toString()));
                }


                studentIds = studentIds.filter((id) => currentStudentIds.has(id));
                studentIds.forEach((id) => allStudentIds.add(id));
                // console.log(studentIds);

                const submissions = await submissionModel.find({ examId: exam._id }).select('studentId submit')

                const submittedStdentIds = submissions.map((submission) => submission.studentId.toString()).filter((id) => currentStudentIds.has(id));
                //    console.log('subm',submittedStdentIds);
                const absentStudents = studentIds.filter((id) => !submittedStdentIds.includes(id));
                // console.log('abs', absentStudents);

                totalFail += absentStudents.length;

                for (const submission of submissions) {

                    if (!currentStudentIds.has(submission.studentId.toString())) {
                        continue;
                    }

                    const noOfquestionAns = submission.submit.length;
                    const noOfCorrectAns = submission.submit.filter((ans) => ans.isCorrect === true).length;
                    const noOfIncorrectAns = submission.submit.filter((ans) => ans.isCorrect === false).length;

                    const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

                    const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
                    const totalScore = Math.max((noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer),0);

                    const passingMarks = totalMarks * (exam.passingPercentage / 100);
                    if (totalScore >= passingMarks) {
                        totalPass++;
                    } else {
                        totalFail++;
                    }

                }

            }
            const totalStudents = allStudentIds.size;
            const passPercentage = totalStudents ? ((totalPass / totalStudents) * 100).toFixed(2) : 0;
            const failPercentage = totalStudents ? ((totalFail / totalStudents) * 100).toFixed(2) : 0;
            return res.status(200).json({
                status: true,
                message: 'Data has been fetched successfully',
                data: {
                    totalStudents:parseInt(totalStudents),
                    totalPass:parseInt(totalPass),
                    totalFail:parseInt(totalFail),
                    passPercentage:parseFloat(passPercentage),
                    failPercentage:parseFloat(failPercentage),
                    course: course.name
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



    // ---------- Exam ------------------
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

    // ------- course --------------

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
                { new: true,runValidators:true }
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

    // ---------- batch ----------

    async batchPage(req, res) {
        try {
            const courses = await courseModel.find({});
            res.render('admin/batch', { courses });
        } catch (error) {
            console.log(error);
        }
    }

    async addBatch(req, res) {
        try {
            const { error } = batchSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { courseId, name, startDate } = req.body;
            if (!courseId || !name || !startDate) {
                return res.status(400).json({
                    status: false,
                    message: 'All fields are required'
                })
            }

            const newBatch = new batchModel({
                courseId,
                name,
                startDate: new Date(startDate)
            })

            await newBatch.save();

            return res.status(200).json({
                status: true,
                message: 'Batch has been saved successfully'
            })

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }


    async getAllBatches(req, res) {
        try {

            // const batches = await batchModel.find({})
            //     .populate('courseId');

            const batches = await batchModel.aggregate([
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'courseId'
                    }
                },
                {
                    $unwind: '$courseId'
                }
            ])

            return res.status(200).json({
                status: true,
                message: "Batch data has been fetched successfully",
                data: batches,
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getFilteredPaginatedBatches(req, res) {
        try {
            const { courseId, page = 1, limit = 5 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const limitVal = parseInt(limit);

            const matchStage = {};
            if (courseId) {
                matchStage.courseId = new mongoose.Types.ObjectId(courseId);
            }

            const batches = await batchModel.aggregate([
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                { $unwind: '$course' },
                { $sort: { createdAt: -1 } },
                {
                    $skip: skip,
                },
                {
                    $limit: limitVal
                }
            ]);

            const totalBatches = await batchModel.countDocuments(matchStage);

            return res.status(200).json({
                status: true,
                message: "Batch data has been fetched successfully",
                data: batches,
                page: parseInt(page),
                totalPages: Math.ceil(totalBatches / limitVal)
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async singleBatch(req, res) {
        try {
            const batch = await batchModel.findById(req.params.id);
            if (!batch) {
                return res.status(400).json({
                    status: false,
                    message: 'Batch data not found'
                })
            }
            return res.status(200).json({
                status: true,
                message: 'Batch has been fetched successfully',
                data: batch
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async getBatchesByFilter(req, res) {
        try {
            const { courseId } = req.query;
            const filterObj = {};
            if (courseId) {
                filterObj.courseId = courseId;
            }

            const batches = await batchModel.find(filterObj);

            return res.status(200).json({
                status: true,
                message: "Batch data has been fetched successfully",
                data: batches
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async updateBatch(req, res) {
        try {
            const { error } = batchSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { courseId, name, startDate } = req.body;
            const batchId = req.params.id;

            const course = await courseModel.findById(courseId);
            if (!course) {
                return res.status(400).json({
                    status: false,
                    message: 'Course is not found'
                })
            }

            const updateBatch = await batchModel.findByIdAndUpdate(batchId,
                {
                    courseId,
                    name,
                    startDate: new Date(startDate)
                },
                { new: true,runValidators:true }
            )

            if (!updateBatch) {
                return res.status(400).json({
                    status: false,
                    message: 'Batch is not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: "Batch has been updated successfully",
                data: updateBatch
            })
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    async deleteBatch(req, res) {
        try {
            const id = req.params.id;

            const students = await studentModel.find({ batchId: id });
            const exams = await examModel.find({ batch: { $in: [id] } });

            if (students.length > 0 || exams.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Batch is used in students or exams.So can not delete'
                });
            }

            const deletedBatch = await batchModel.findByIdAndDelete(id);
            if (!deletedBatch) {
                return res.status(400).json({
                    status: false,
                    message: 'Batch is not found'
                })
            }

            return res.status(200).json({
                status: true,
                message: 'Batch has been deleted successfully',
                data: deletedBatch
            })


        } catch (error) {
            console.log(error);
            return res.status(500).json({
                status: false,
                message: 'Something went wrong'
            })
        }
    }

    // ----------- student -------------

    async addStudentPage(req, res) {
        try {
            const courses = await courseModel.find({}).select('name');
            const batches = await batchModel.find({}).select('name');

            res.render('admin/add-student', { courses, batches });
        } catch (error) {
            console.log(error);
        }
    }

    async addStudent(req, res) {
        try {

            const { error } = studentSchema.validate(req.body);
            if (error) {
                console.log(error);
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { name, email, password, phoneNumber, courseId, batchId } = req.body;

            const existStudent = await studentModel.findOne({ email });
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

            const newStudent = new studentModel({
                name,
                email,
                phoneNumber,
                password: hassedPassword,
                tempPassword: password,
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

            await emailLoginDetail(req, savedStudent);

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
            res.render('admin/student-list', { courses, batches })
        } catch (error) {
            console.log(error);
        }
    }

    async getAllStudents(req, res) {
        try {
            // const students = await studentModel.find(filterObj).populate([{ path: 'courseId', select: 'name' }, { path: 'batchId', select: 'name' }]);
            const students = await studentModel.aggregate([
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
            const filterObj = {};
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

            // const students = await studentModel.find(filterObj).populate([{ path: 'courseId', select: 'name' }, { path: 'batchId', select: 'name' }])
            //     .skip(skip)
            //     .limit(limitVal)
            //     .sort('-createdAt')


            const students = await studentModel.aggregate([
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
                        image: 1,
                        course: { _id: '$course._id', name: '$course.name' },
                        batch: { _id: '$batch._id', name: '$batch.name' }
                    }
                }
            ])


            const totalStudents = await studentModel.countDocuments(filterObj);

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
            const student = await studentModel.findById(req.params.id);
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
            const { error } = studentSchema.validate(req.body);
            if (error) {
                console.log(error);
                return res.status(400).json({
                    status: false,
                    message: error.details[0].message
                });
            }

            const { name, email, password, phoneNumber, courseId, batchId } = req.body;
            const studentId = req.params.id;
            const student = await studentModel.findById(studentId);
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
            const hassedPassword = await hassPassword(password);

            const updatedStudent = await studentModel.findByIdAndUpdate(studentId, {
                name,
                email,
                phoneNumber,
                password: hassedPassword,
                tempPassword: password,
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
            const student = await studentModel.findById(id);
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


            const deletedStudent = await studentModel.findByIdAndDelete(id);

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

    // --------- question ------------

    async addQuestionPage(req, res) {
        const now = new Date(new Date().toISOString());
        const exams = await examModel.find({ startTime: { $gt: now } });
        res.render('admin/add-question', { exams });
    }

    async addQuestion(req, res) {
        const { error } = questionSchema.validate(req.body);
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
            const { error } = questionSchema.validate(req.body);
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

    async studentRankingPage(req, res) {
        try {
            const courses = await courseModel.find({});
            const batches = await batchModel.find({});
            const exams = await examModel.find({});
            res.render('admin/student-ranking', { courses, batches, exams });
        } catch (error) {
            console.log(error);

        }
    }

    async getStudentRankings(req, res) {
        try {
            const { batchId, examId } = req.params;
            const batch = await batchModel.findById(batchId).select('name');
            if(!batch){
                return res.status(400).json({
                    status:false,
                    message:'Batch is not found'
                })
            }
            const exam = await examModel.findById(examId).select('title totalQuestions marksPerQuestion negativeMarkPerWrongAnswer passingPercentage');
            if(!exam){
                return res.status(400).json({
                    status:false,
                    message:'Exam is not found'
                })
            }
           
            const submissions = await submissionModel.aggregate([
                {
                    $match: { examId: new mongoose.Types.ObjectId(examId) }
                },
                {
                    $lookup: {
                        from: 'students',
                        localField: 'studentId',
                        foreignField: '_id',
                        as: 'studentDetails'
                    }
                },
                {
                    $unwind: '$studentDetails'
                },
                {
                    $match: { 'studentDetails.batchId': new mongoose.Types.ObjectId(batchId) }
                },
                {
                    $project: {
                        title: 1,
                        studentId: 1,
                        submit: 1,
                        'studentDetails.name': 1
                    }
                }


            ]);

            // console.log(submissions);

            const questions = await questionModel.find({ exam: examId });

            let studentsScore = [];
            submissions.forEach((submission) => {
                const noOfquestionAns = submission.submit.length;
                const noOfCorrectAns = submission.submit.filter((ans) => ans.isCorrect === true).length;
                const noOfIncorrectAns = submission.submit.filter((ans) => ans.isCorrect === false).length;

                const noOfUnansweredQuestion = exam.totalQuestions - noOfquestionAns;

                const totalMarks = exam.totalQuestions * exam.marksPerQuestion;
                const totalScore = Math.max((noOfCorrectAns * exam.marksPerQuestion - (noOfIncorrectAns + noOfUnansweredQuestion) * exam.negativeMarkPerWrongAnswer),0);


                const submitAns = [];

                for (const s of submission.submit) {
                    submitAns[s.questionId.toString()] = { answer: s.answer };
                }

                const quesAns = questions.map((question, index) => {
                    function getTextAns(option) {
                        return question.options.find((val) => val.optionId === option).text;
                    }

                    return {
                        qno: index + 1,
                        questionText: question.questionText,
                        correctAns: getTextAns(question.correctOption),
                        yourAns: submitAns[question._id.toString()] ? getTextAns(submitAns[question._id.toString()].answer) : '--'
                    }
                })

                // console.log(quesAns);
                studentsScore.push({
                    studentId: submission.studentId,
                    studentName: submission.studentDetails.name,
                    score: totalScore,
                    totalMarks: totalMarks,
                    status: totalScore >= totalMarks * (exam.passingPercentage / 100) ? 'Passed' : 'Failed',
                    quesAns
                })


            })

            studentsScore.sort((a, b) => b.score - a.score);
            studentsScore = studentsScore.map((val, index) => {
                return {
                    rank: index + 1,
                    ...val
                }
            })



            const topScore = studentsScore.length > 0 ? studentsScore[0].score : 0;
            const avgScore = studentsScore.length > 0 ? studentsScore.reduce((acc, cur) => {
                return acc + cur.score
            }, 0) / studentsScore.length : 0;

            // console.log(studentsScore);

            return res.status(200).json({
                status: true,
                message: 'Ranking data fetched successfully',
                data: {
                    examTitle: exam.title,
                    batchName: batch.name,
                    topScore,
                    avgScore,
                    rankData: studentsScore
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

    async absentStudentsPage(req, res) {
        try {
            const courses = await courseModel.find({});
            const batches = await batchModel.find({});
            const exams = await examModel.find({});
            res.render('admin/absent-students', { courses, batches, exams });
        } catch (error) {
            console.log(error);
        }
    }

    async getAbsentStudents(req, res) {
        try {
            const { batchId, examId } = req.params;
            const batch = await batchModel.findById(batchId);
            if (!batch) {
                return res.status(400).json({
                    status: false,
                    message: 'Batch is not found'
                })
            }
            const exam = await examModel.findById(examId);
            if (!exam) {
                return res.status(400).json({
                    status: false,
                    message: 'Exam is not found'
                })
            }

            const submissions = await submissionModel.aggregate([
                {
                    $match: { examId: new mongoose.Types.ObjectId(examId) }
                }, {
                    $lookup: {
                        from: 'students',
                        localField: 'studentId',
                        foreignField: '_id',
                        as: 'student'
                    }
                },
                {
                    $match: {
                        'student.batchId': new mongoose.Types.ObjectId(batchId)
                    }
                },
                {
                    $unwind:'$student'
                },
                {
                    $project:{
                        'student._id':1
                    }
                }
            ])

            const presentStudentsIds=[];
            presentStudentsIds.push(...submissions.map((item)=>new mongoose.Types.ObjectId(item.student._id)));
        //    console.log(presentStudentsIds);

        const absentStudents=await studentModel.aggregate([
            {
                $match:{
                    batchId:new mongoose.Types.ObjectId(batchId),
                    _id:{$nin:presentStudentsIds}
                }
            },{
                $lookup:{
                    from:'courses',
                    localField:'courseId',
                    foreignField:'_id',
                    as:'course'
                }
            },{
                $unwind:'$course'
            },
            {
                $lookup:{
                    from:'batches',
                    localField:'batchId',
                    foreignField:'_id',
                    as:'batch'
                }
            },
            {
                $unwind:'$batch'
            },{
                $project:{
                    name:1,
                    email:1,
                    phoneNumber:1,
                    image:1,
                    course:{_id:'$course._id',name:'$course.name'},
                    batch:{_id:'$batch._id',name:'$batch.name'}
                }
            }
        ])

        // console.log(absentStudents); 

            return res.status(200).json({
                status:true,
                message:'Data has benn fetched successfully',
                data:absentStudents
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

module.exports = new AdminController();