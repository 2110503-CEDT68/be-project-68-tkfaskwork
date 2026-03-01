const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

dotenv.config({path:'./config/config.env'});
const auth = require('./routes/auth');

connectDB();

const app = express();
app.set('query parser', 'extended');

app.use(express.json());

app.use(cookieParser());

const coworkingSpaces = require('./routes/coworkingSpaces');
const reservations = require('./routes/reservations');

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const recommend = require('./routes/recommend');

app.use('/api/v1/coworkingSpaces', coworkingSpaces);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/auth', auth);
app.use('/api/v1/recommend', recommend);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT));

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});

