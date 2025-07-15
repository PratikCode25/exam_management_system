const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    optionId: {
        type: String,
        enum: ['A', 'B', 'C', 'D'],
        required: true
    },
    text: {
        type: String,
        required: true
    }
})


const questionSchema = new mongoose.Schema({
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    questionText:{
        type:String,
        required:true
    },
    options: {
        type: [optionSchema],
        validate: function (v) {
            return v.length === 4;
        }
    },
    correctOption: {
        type: String,
        enum: ['A', 'B', 'C', 'D'],
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model('Question', questionSchema);