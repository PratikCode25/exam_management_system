const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    startDate: { type: Date, required: true },
    students: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student'
        }
    ]
}, { timestamps: true })

module.exports = mongoose.model('Batch', batchSchema);