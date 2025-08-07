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
        res.locals.studentData = { name: req.user.username, image: req.user.image };
    } catch (error) {
        if (req.xhr) {
            return res.status(401).json({ status: false, message: 'Unauthorized access' });
        }
        return res.status(401).redirect('/student/login');
    }
    return next();
}

const authorizeRoles = (allowedRole) => {
    return (req, res, next) => {
        if (!req.user || req.user.role!==allowedRole) {
            console.log(`Unauthorized access attempt to a forbidden resource by user ${req.user?._id} with role ${req.user?.role}`)
            if (req.xhr) {
                return res.status(403).json({
                    status: false,
                    message: 'Forbidden: You do not have the required permissions.'
                });
            }
            return res.redirect(`/${req.user.role}/login`);

        }
        return next();
    };
};

module.exports = {
    authAdmin,
    authStudent,
    authorizeRoles
}