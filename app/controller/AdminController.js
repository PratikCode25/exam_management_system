const userModel = require('../model/user');
const examModel = require('../model/exam');
const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const questionModel = require('../model/question');
const submissionModel = require('../model/submission');

const fs = require('fs').promises;
const emailLoginDetail = require('../helper/emailLoginDetail');
const mongoose = require('mongoose');

const { hassPassword, comparePassword } = require('../helper/password');
const jwt = require('jsonwebtoken');


class AdminController {
    async addUser(req, res) {
        try {
            const { name, email, password } = req.body;
            const existUser = await userModel.findOne({ email });
            if (existUser) {
                return res.status(400).json({
                    status: false,
                    message: 'User already exists'
                })
            }
            const hassedPassword = await hassPassword(password);
            const newUser = new userModel({
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
        res.render('admin/login',{title:'Admin Login'});
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
            const user = await userModel.findOne({ email,role:'admin' });
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
            res.cookie('admin_token', token, { httpOnly: true, maxAge: 3600000*3 }); // 3 hour maxAge

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
            return res.render('admin/update-password', { userId: req.user._id,title:'Update Password' });
        } catch (error) {
            console.log(error);
        }
    }

    async updatePassword(req, res) {
        try {
            const userId = req.params.id;
            const { password } = req.body;
        
            const hassedPassword = await hassPassword(password);

            const updatedUser = await userModel.findByIdAndUpdate(userId,
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
            res.render('admin/dashboard', { courses, title:'Course' });
        } catch (error) {
            console.log(error);
        }
    }

    async getCardData(req, res) {
        try {
            const courseCount = await courseModel.countDocuments();
            const batchCount = await batchModel.countDocuments();
            const examCount = await examModel.countDocuments();
            const studentCount = await userModel.countDocuments({role:'student'});

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
                const currentStudents = await userModel.find({ courseId: course._id,role:'student' }).select('_id');
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

            const currentStudents = await userModel.find({ courseId,role:'student' }).select('_id');
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


    async studentRankingPage(req, res) {
        try {
            const courses = await courseModel.find({});
            const batches = await batchModel.find({});
            const exams = await examModel.find({});
            res.render('admin/student-ranking', { title:'Student Rankings', courses, batches, exams });
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
                        from: 'users',
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
                    avgScore:avgScore.toFixed(2),
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
            res.render('admin/absent-students', {title:'Absent Students', courses, batches, exams });
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
                        from: 'users',
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

        const absentStudents=await userModel.aggregate([
            {
                $match:{
                    batchId:new mongoose.Types.ObjectId(batchId),
                    _id:{$nin:presentStudentsIds},
                    role:'student'
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