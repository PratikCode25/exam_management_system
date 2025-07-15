const bcrypt = require('bcryptjs');

const hassPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
}

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hassPassword,
    comparePassword
}