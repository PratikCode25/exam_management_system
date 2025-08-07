const transporter=require('../config/emailConfig');

const emailLoginDetail=async(req,user,password)=>{

 
 const loginLink=`${req.protocol}://${req.get('host')}`+`/student/login`;

//  console.log(loginLink);

 const info=await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "Testing Node.js Project- Student Login Details",
    text: `Dear ${user.name},
    
    This is your login link : ${loginLink}
    Email: ${user.email}
    Password : ${password}
    `
  })

  console.log("Message sent: ", info.messageId);

}

module.exports=emailLoginDetail;