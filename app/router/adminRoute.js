const express=require('express');
const router=express.Router();
const AdminController=require('../controller/AdminController');
const {authAdmin,authorizeRoles}=require('../middleware/authMiddleware');
const imageUpload=require('../helper/imageUpload');
const CourseController = require('../controller/CourseController');
const BatchController = require('../controller/BatchController');
const ExamController = require('../controller/ExamController');
const QuestionController = require('../controller/QuestionController');
const StudentController = require('../controller/StudentController');

router.post('/add-user',AdminController.addUser);
router.get('/login',AdminController.loginPage);
router.post('/auth/login',AdminController.login);

router.use(authAdmin);
router.use(authorizeRoles('admin'))

// ----- update password -------------
router.get('/auth/update-password',AdminController.updatePasswordPage);
router.post('/auth/password/:id',AdminController.updatePassword);

// ------ logout --------------------
router.get('/auth/logout',AdminController.logout);


// ----- dashboard-------
router.get('/dashboard',AdminController.dashboard);
router.get('/dashboard/cards',AdminController.getCardData);
router.get('/dashboard/charts/average-score-per-course',AdminController.getAvgScorePerCourse);
router.get('/dashboard/charts/pass-fail-per-course/:id',AdminController.getPassFailPerCourse);


// ------ exam------------
router.get('/exams/add-exam',ExamController.addExamPage);
router.post('/exams/add',ExamController.addExam);
router.get('/exams',ExamController.examListPage);
router.get('/exams/pagination',ExamController.getFilteredPaginatedExams);
router.get('/exams/all',ExamController.getAllExams);
router.get('/exams/filter',ExamController.getExamsByFilter);
router.get('/exams/:id',ExamController.getSingleExam);
router.post('/exams/:id/update',ExamController.updateExam);
router.post('/exams/:id/delete',ExamController.deleteExam);

// ---- course -----
router.get('/courses',CourseController.coursePage);
router.post('/courses/add',CourseController.addCourse);
router.get('/courses/pagination',CourseController.getPaginatedCourses);
router.get('/courses/all',CourseController.getAllCourses);
router.get('/courses/:id',CourseController.getSingleCourse);
router.post('/courses/:id/update',CourseController.updateCourse);
router.post('/courses/:id/delete',CourseController.deleteCourse);

// --------- batch ---------
router.get('/batches',BatchController.batchPage);
router.post('/batches/add',BatchController.addBatch);
router.get('/batches/pagination',BatchController.getFilteredPaginatedBatches);
router.get('/batches/all',BatchController.getAllBatches);
router.get('/batches/filter',BatchController.getBatchesByFilter);
router.get('/batches/:id',BatchController.singleBatch);
router.post('/batches/:id/update',BatchController.updateBatch);
router.post('/batches/:id/delete',BatchController.deleteBatch);

// ------------- student ------------- 
router.get('/students/add-student',StudentController.addStudentPage);
router.post('/students/add',imageUpload.single('image'),StudentController.addStudent);
router.get('/students',StudentController.studentPage);
router.get('/students/pagination',StudentController.getFilteredPaginatedStudents);
router.get('/students/all',StudentController.getAllStudents);
router.get('/students/:id',StudentController.getSingleStudent);
router.post('/students/:id/update',imageUpload.single('image'),StudentController.updateStudent);
router.post('/students/:id/delete',StudentController.deleteStudent);

// --------- question ------------
router.get('/questions/add-question',QuestionController.addQuestionPage);
router.post('/questions/add',QuestionController.addQuestion);
router.get('/questions',QuestionController.questionPage);
router.get('/questions/pagination',QuestionController.getFilteredPaginatedQuestions);
router.get('/questions/all',QuestionController.getAllQuestions);
router.get('/questions/:id',QuestionController.getSingleQuestion);
router.post('/questions/:id/update',QuestionController.updateQuestion);
router.post('/questions/:id/delete',QuestionController.deleteQuestion);

// -------- ranking -------------
router.get('/ranks',AdminController.studentRankingPage);
router.get('/ranks/:batchId/:examId',AdminController.getStudentRankings);

router.get('/absent-students',AdminController.absentStudentsPage);
router.get('/absent-students/:batchId/:examId',AdminController.getAbsentStudents);






module.exports=router;