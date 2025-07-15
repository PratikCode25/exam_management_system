const express=require('express');
const router=express.Router();
const StudentController=require('../controller/StudentController');
const {authStudent}=require('../middleware/authMiddleware');
const {studentData}=require('../middleware/userData');
const imageUpload=require('../helper/imageUpload');


router.get('/login',StudentController.loginPage);
router.post('/auth/login',StudentController.login);

router.use(authStudent);
router.get('/dashboard',studentData,StudentController.dashboard);
router.get('/dashboard/cards/:id',StudentController.getCardData);
router.get('/dashboard/charts/score-over-date/:id',StudentController.getScoreOverDate);
router.get('/dashboard/charts/answer/:id',StudentController.getAnswerBreakdown);

router.get('/available-exam',studentData,StudentController.availableExam);

router.get('/take-exam/:id',studentData,StudentController.takeExamPage);
router.get('/question/exam/:id',StudentController.getQuestions);
router.get('/submission/:studentId/:examId',StudentController.getSubmitAnswer);
router.post('/submit/answer',StudentController.submitAnswer);

router.get('/exam-result',studentData,StudentController.examResultPage);
router.get('/exam-result/:studentId/:examId',StudentController.getExamResult);

router.get('/auth/update-password',studentData,StudentController.updatePasswordPage);
router.post('/auth/password/:id',StudentController.updatePassword);

router.get('/auth/logout',StudentController.logout);


module.exports=router;