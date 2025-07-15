const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email:{type:String,required:true},
    password:{type:String,requird:true},
    tempPassword:{type:String,requird:true},
    phoneNumber:{type:String},
    image:{type:String,default:''},
    courseId:{type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true},
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true }
    
}, { timestamps: true })

module.exports = mongoose.model('Student', studentSchema);