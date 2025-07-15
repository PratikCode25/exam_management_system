const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String},
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Batch',
            required: true
        }
    ],
    questions: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
        }
    ],
    duration: { type: Number, required: true },
    startTime: { type: Date, required: true },
    totalQuestions: { type: Number, required: true },
    marksPerQuestion: { type: Number, required: true },
    negativeMarkPerWrongAnswer: { type: Number, required: true, default:0},
    passingPercentage:{ type: Number, required: true}
}, { timestamps: true })



  

module.exports = mongoose.model('Exam', examSchema);