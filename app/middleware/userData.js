const userModel = require('../model/user');
const adminModel = require('../model/admin');

const studentData=async (req,res,next)=>{
try {
    const student=await userModel.findOne({_id:req.user._id,role:'student'});
    if(!student){
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/student/login');
    }
    res.locals.studentData={name:student.name,image:student.image};
} catch (error) {
    console.log(error);
    return res.status(401).redirect('/student/login');
}
return next();
}


module.exports={
    studentData
}