const express=require('express');
const router=express.Router();
const StudentController=require('../controller/StudentController');
const {authStudent,authorizeRoles}=require('../middleware/authMiddleware');
// const {studentData}=require('../middleware/userData');
const imageUpload=require('../helper/imageUpload');


router.get('/login',StudentController.loginPage);
router.post('/auth/login',StudentController.login);

router.use(authStudent);
router.use(authorizeRoles('student'));

router.get('/dashboard',StudentController.dashboard);
router.get('/dashboard/cards/:id',StudentController.getCardData);
router.get('/dashboard/charts/score-over-date/:id',StudentController.getScoreOverDate);
router.get('/dashboard/charts/answer/:id',StudentController.getAnswerBreakdown);

router.get('/available-exam',StudentController.availableExam);

router.get('/take-exam/:id',StudentController.takeExamPage);
router.get('/question/exam/:id',StudentController.getQuestions);
router.get('/submission/:studentId/:examId',StudentController.getSubmitAnswer);
router.post('/submit/answer',StudentController.submitAnswer);

router.get('/exam-result',StudentController.examResultPage);
router.get('/exam-result/:studentId/:examId',StudentController.getExamResult);

router.get('/auth/update-password',StudentController.updatePasswordPage);
router.post('/auth/password/:id',StudentController.updatePassword);

router.get('/auth/logout',StudentController.logout);


module.exports=router;