const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, requird: true },
    role: { type: String, enum: ['admin', 'student'], default: 'student' },
    phoneNumber: { type: String },
    image: { type: String, default: '' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }

}, { timestamps: true })

module.exports = mongoose.model('User', userSchema);