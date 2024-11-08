const express = require('express');
const oracledb = require('oracledb');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const bodyParser = require('body-parser');
const otpGenerator = require('otp-generator');
const flash = require('connect-flash');
const crypto = require('crypto');
const moment = require('moment');
const fetch = require('node-fetch'); // Ensure you use node-fetch for making API calls

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware for session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// Initialize the Oracle DB connection pool
async function initializeDB() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING
        });
        console.log('Database connection pool created');
    } catch (err) {
        console.error('Error creating connection pool:', err);
    }
}

initializeDB();

// Register route
app.post('/register', async (req, res) => {
    const { username, password, email, name } = req.body;
    let connection;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        connection = await oracledb.getConnection();

        await connection.execute(
            `INSERT INTO newusers (name, username, password, email) 
             VALUES (:name, :username, :password, :email)`,
            [name, username, hashedPassword, email],
            { autoCommit: true }
        );

        res.send('User registered successfully!');
    } catch (err) {
        console.error('Error during registration:', err.message);
        res.status(500).send('Error registering user!');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('Error closing connection:', closeErr.message);
            }
        }
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { device_id, password } = req.body;
    let connection;

    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(
            `SELECT * FROM farmers WHERE device_id = :device_id AND password = :password`,
            { device_id, password }
        );

        if (result.rows.length > 0) {
            res.status(200).json({ message: 'Login successful' });
        } else {
            res.status(404).json({ message: 'No user found with that device ID and password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Payment route (example)
app.get('/payment', (req, res) => {
    const { name, phone, amount } = req.query;
    res.send(`
        <h1>Confirm Payment</h1>
        <p>Name: ${name}</p>
        <p>Phone: ${phone}</p>
        <p>Total Amount: ₹${amount}</p>

        <form action="/process-payment" method="POST">
            <input type="hidden" name="name" value="${name}">
            <input type="hidden" name="phone" value="${phone}">
            <input type="hidden" name="amount" value="${amount}">

            <label>Select Payment Method:</label>
            <select name="payment_method">
                <option value="cash">Cash</option>
                <option value="emi">EMI</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
            </select><br>

            <button type="submit">Pay Now</button>
        </form>
    `);
});

// API route to interact with another service (example)
app.post('/askyourplant', async (req, res) => {
    const data = req.body;
    try {
        const apiResponse = await fetch('http://localhost:5000/predict-disease', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: data.features })
        });
        const result = await apiResponse.json();
        res.render('ask-your-plant', { prediction: result.prediction });
    } catch (error) {
        console.error('Error fetching disease prediction:', error);
        res.status(500).send('Error during disease prediction');
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes to serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Listen to the port specified by Vercel
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
