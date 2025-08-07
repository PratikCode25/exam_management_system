const express = require('express');
require('dotenv').config();
const path = require('path');
const cookieparser = require('cookie-parser');
const connectDB = require('./app/config/db');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser());

app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoute = require('./app/router/adminRoute');
app.use('/admin', adminRoute);

const studentRoute=require('./app/router/studentRoute');
app.use('/student',studentRoute);

const port = 3005;
const start = async () => {
    await connectDB(process.env.MONGO_URI);
    console.log('Database connected')
    app.listen(port, () => console.log(`Server is running on port ${port}`));
}

start();