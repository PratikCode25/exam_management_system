const jwt = require('jsonwebtoken');

const authAdmin = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) {
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/admin/login');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        res.locals.adminData = { name: req.user.username };
    } catch (error) {
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/admin/login');
    }
    return next();
}

const authStudent = (req, res, next) => {
    const token = req.cookies.student_token;
    if (!token) {
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/student/login');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/student/login');
    }
    return next();
}

module.exports = {
    authAdmin,
    authStudent
}