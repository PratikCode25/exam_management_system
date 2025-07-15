const express=require('express');
const router=express.Router();
const AdminController=require('../controller/AdminController');
const {authAdmin}=require('../middleware/authMiddleware');
const imageUpload=require('../helper/imageUpload');

router.post('/add-user',AdminController.addUser);
router.get('/login',AdminController.loginPage);
router.post('/auth/login',AdminController.login);

router.use(authAdmin);

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
router.get('/exams/add-exam',AdminController.addExamPage);
router.post('/exams/add',AdminController.addExam);
router.get('/exams',AdminController.examListPage);
router.get('/exams/pagination',AdminController.getFilteredPaginatedExams);
router.get('/exams/all',AdminController.getAllExams);
router.get('/exams/filter',AdminController.getExamsByFilter);
router.get('/exams/:id',AdminController.getSingleExam);
router.post('/exams/:id/update',AdminController.updateExam);
router.post('/exams/:id/delete',AdminController.deleteExam);

// ---- course -----
router.get('/courses',AdminController.coursePage);
router.post('/courses/add',AdminController.addCourse);
router.get('/courses/pagination',AdminController.getPaginatedCourses);
router.get('/courses/all',AdminController.getAllCourses);
router.get('/courses/:id',AdminController.getSingleCourse);
router.post('/courses/:id/update',AdminController.updateCourse);
router.post('/courses/:id/delete',AdminController.deleteCourse);

// --------- batch ---------
router.get('/batches',AdminController.batchPage);
router.post('/batches/add',AdminController.addBatch);
router.get('/batches/pagination',AdminController.getFilteredPaginatedBatches);
router.get('/batches/all',AdminController.getAllBatches);
router.get('/batches/filter',AdminController.getBatchesByFilter);
router.get('/batches/:id',AdminController.singleBatch);
router.post('/batches/:id/update',AdminController.updateBatch);
router.post('/batches/:id/delete',AdminController.deleteBatch);

// ------------- student ------------- 
router.get('/students/add-student',AdminController.addStudentPage);
router.post('/students/add',imageUpload.single('image'),AdminController.addStudent);
router.get('/students',AdminController.studentPage);
router.get('/students/pagination',AdminController.getFilteredPaginatedStudents);
router.get('/students/all',AdminController.getAllStudents);
router.get('/students/:id',AdminController.getSingleStudent);
router.post('/students/:id/update',imageUpload.single('image'),AdminController.updateStudent);
router.post('/students/:id/delete',AdminController.deleteStudent);

// --------- question ------------
router.get('/questions/add-question',AdminController.addQuestionPage);
router.post('/questions/add',AdminController.addQuestion);
router.get('/questions',AdminController.questionPage);
router.get('/questions/pagination',AdminController.getFilteredPaginatedQuestions);
router.get('/questions/all',AdminController.getAllQuestions);
router.get('/questions/:id',AdminController.getSingleQuestion);
router.post('/questions/:id/update',AdminController.updateQuestion);
router.post('/questions/:id/delete',AdminController.deleteQuestion);

// -------- ranking -------------
router.get('/ranks',AdminController.studentRankingPage);
router.get('/ranks/:batchId/:examId',AdminController.getStudentRankings);

router.get('/absent-students',AdminController.absentStudentsPage);
router.get('/absent-students/:batchId/:examId',AdminController.getAbsentStudents);






module.exports=router;