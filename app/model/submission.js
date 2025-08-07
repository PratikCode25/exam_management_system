const mongoose = require('mongoose');

const submitSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true
    },
    answer: {
        type: String,
        enum: ['A', 'B', 'C', 'D'],
        required: true
    },
    isCorrect:{
        type:Boolean,
        required:true
    }
})

const submissionSchema = new mongoose.Schema({
    studentId:{
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
    },
    examId: { 
        type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true 
    },
    submit:{
        type:[submitSchema]
    }
 
}, { timestamps: true })

module.exports = mongoose.model('Submission', submissionSchema);