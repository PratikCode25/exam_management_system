const courseModel = require('../model/course');
const batchModel = require('../model/batch');
const userModel = require('../model/user');
const examModel = require('../model/exam');
const { batchValidationSchema } = require('../validations/batchValidation');
const mongoose=require('mongoose');

class BatchController{
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
                const { error } = batchValidationSchema.validate(req.body);
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
                const { error } = batchValidationSchema.validate(req.body);
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
    
                const students = await userModel.find({ batchId: id,role:'student' });
                const exams = await examModel.find({ batch: { $in: [id] } });
    
                if (students.length > 0 || exams.length > 0) {
                    return res.status(400).json({
                        status: false,
                        message: 'Batch is in use in students or exams.So it can not be deleted.'
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
}

module.exports=new BatchController();