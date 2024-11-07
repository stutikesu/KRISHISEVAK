const express = require('express');
const oracledb = require('oracledb');
const session = require('express-session');
const bcrypt = require('bcrypt'); // Library for password hashing
const path = require('path');
const bodyParser = require('body-parser');
const otpGenerator = require('otp-generator');
const flash = require('connect-flash');


const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Middleware for session management
app.use(session({
    secret: 'your-secret-key', // Change this to a strong secret key
    resave: false,
    saveUninitialized: true,
}));







app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});



// Function to initialize the database connection pool
async function initializeDB() {
    try {
        await oracledb.createPool({
            user: 'STUTI02', // Replace with your database username
            password: 'stuti123', // Replace with your database password
            connectString: 'localhost:1521/XE' // Update with your connection string (use correct port and service name)
        });
        console.log('Database connection pool created');
    } catch (err) {
        console.error('Error creating connection pool:', err);
    }
}

// Call the function to initialize the database
initializeDB();



// register

app.post('/register', async (req, res) => {
    const { username, password, email, name } = req.body;

    let connection;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        connection = await oracledb.getConnection();

        const result = await connection.execute(
            `INSERT INTO newusers (name, username, password, email) 
             VALUES (:name, :username, :password, :email)`,
            [name, username, hashedPassword, email],
            { autoCommit: true }
        );

        res.send('User registered successfully!');
    } catch (err) {
        console.error('Error during registration:', err.message); // Log the error message
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
app.post('/login', async (req, res) => {
    const { device_id, password } = req.body;
    let connection; // Declare the connection variable here

    try {
        connection = await oracledb.getConnection(); // Assign connection

        const result = await connection.execute(
            `SELECT * FROM farmers WHERE device_id = :device_id AND password = :password`, // Add backticks to the SQL string
            { device_id, password }
        );

        if (result.rows.length > 0) {
            // User found
            res.status(200).json({ message: 'Login successful' });
        } else {
            // No user found
            res.status(404).json({ message: 'No user found with that device ID and password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        // Ensure connection is closed
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});





// Home route
// Home route
app.get('/home', async (req, res) => {
    const username = req.session.username; // Get the username from session

    if (!username) {
        return res.redirect('/login'); // Redirect if not logged in
    }

    let connection;

    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(
            `SELECT * FROM newusers WHERE username = :username`,
            [username]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const profileImage = user[5]; // Assuming profile image URL is in the 6th column

            // Render the home page with user data
            res.send(`
                <h1>Welcome, ${user[1]}!</h1>
                <img src="${profileImage}" alt="Profile Image" style="width: 100px; height: 100px; float: right;"/>
                <p>Your email: ${user[3]}</p>
                <p>Your profile image is displayed on the right.</p>
            `); // You may want to use a templating engine for better structure
        } else {
            res.send('No user found.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving user data');
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error releasing connection:', err);
            }
        }
    }
});



// Function to generate a random password
function generatePassword() {
    return crypto.randomBytes(5).toString('hex'); // 10-character random password
}

// Function to generate a username based on the name
function generateUsername(name) {
    return name.split(' ')[0] + Math.floor(Math.random() * 1000); // Example: "Priya123"
}

app.post('/engineeregister', async (req, res) => {
    const { name, email, phone, experience } = req.body;

    // Generate the username and plain-text password
    const username = generateUsername(name); // Make sure generateUsername is defined
    const plainPassword = generatePassword(); // Make sure generatePassword is defined

    if (!plainPassword) {
        return res.status(500).send('Error: Password generation failed');
    }

    try {
        // Hash the generated password using bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

        // Connect to Oracle Database
        const connection = await oracledb.getConnection(/* your connection details */);

        // Insert the user data into Oracle with the hashed password
        const result = await connection.execute(
            `INSERT INTO engineer (name, email, phone, experience, username, password)
            VALUES (:name, :email, :phone, :experience, :username, :password)`,
            { name, email, phone, experience, username, password: hashedPassword }
        );

        await connection.commit(); // Commit the transaction
        console.log('User data inserted successfully');

        // Log the username and password to the terminal
        console.log(`Username: ${username}, Password: ${plainPassword}`);

        // Send SMS with username and plain-text password
        await sendSMS(phone, username, plainPassword);

        res.send(`User registered. Username and password will be sent to ${phone}.`);

        await connection.close();
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).send('Error occurred during registration');
    }
});
async function engineeregister(req, res) {
    const { name, email, phone, experience } = req.body;

    // Generate a random username and password
    const username = `user_${Date.now()}`; // Example username generation
    const password = Math.random().toString(36).slice(-8); // Random password

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store in the database
    try {
        const connection = await oracledb.getConnection(/* your connection details */);
        const result = await connection.execute(
            `INSERT INTO engineer (name, email, phone, experience, username, password) VALUES (:name, :email, :phone, :experience, :username, :password)`,
            {
                name,
                email,
                phone,
                experience,
                username,
                password: hashedPassword
            }
        );
        await connection.commit();
        connection.close();

        
        // Send SMS with username and password
        await sendSMS(phone, username, password);
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Error during registration' });
    }
}

// Placeholder function to send SMS (you can integrate Twilio or any other SMS service here)
function sendSMS(phone, username, password) {
    console.log(`Sending SMS to ${phone}: Username: ${username}, Password: ${password}`);
}

async function engineerlogin(req, res) {
    const { username, password } = req.body;

    try {
        const connection = await oracledb.getConnection(/* your connection details */);
        const result = await connection.execute(
            `SELECT password FROM engineer WHERE username = :username`,
            { username }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const hashedPassword = result.rows[0][0];

        // Compare the hashed password with the provided password
        const isMatch = await bcrypt.compare(password, hashedPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // If valid, proceed with login
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Error during login' });
    }
}
function generateDeviceId() {
    return 'KRISHI-' + Math.floor(Math.random() * 1000000); // Example: KRISHI-123456
}

// Function to send SMS using Textbelt (Free option)
async function sendSMS(phone, deviceId, password) {
    try {
        const response = await fetch('https://textbelt.com/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone, // Must be in E.164 format, e.g., +91965305XXXX
                message: `Your Device ID: ${deviceId}, Password: ${password}`,
                key: 'textbelt' // Free API key
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log(`SMS sent successfully to ${phone}`);
        } else {
            console.error('Failed to send SMS:', result.error);
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
}


// Connect to OracleDB (make sure your DB credentials are correct)
async function initDB() {
    try {
        await oracledb.createPool({
            user: "your_username",
            password: "your_password",
            connectString: "your_connect_string"
        });
        console.log('Database pool initialized');
    } catch (err) {
        console.error('Error initializing pool:', err);
    }
}
initDB();





app.post('/buysellproduct', async (req, res) => {
    const { name, email, phone, state, district, farmer_type, product_name, irrigation_type, final_price, quantity, paymentmode } = req.body;

    console.log("Incoming request:", req.body);
    let connection;

    try {
        connection = await oracledb.getConnection();
        console.log("Connected to Oracle database");

        // Generate unique device_id and password
        const device_id = generateDeviceId(); // Generate unique device_id
        const password = crypto.randomBytes(4).toString('hex'); // Generate a random 8-character password

        // Log device_id and password to the terminal
        console.log("Generated device ID:", device_id);
        console.log("Generated password:", password);

        // Insert farmer details with device_id and password
        const farmerResult = await connection.execute(
            `INSERT INTO farmers (name, email, phone, state, district, farmer_type, device_id, password) 
             VALUES (:name, :email, :phone, :state, :district, :farmer_type, :device_id, :password) 
             RETURNING farmer_uuid INTO :uuid`,
            {
                name,
                email,
                phone,
                state,
                district,
                farmer_type,
                device_id,
                password,
                uuid: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
            }
        );

        const farmerUUID = farmerResult.outBinds.uuid[0];
        console.log("Farmer inserted with UUID:", farmerUUID);

        // Insert order details with quantity and payment mode
        const orderResult = await connection.execute(
            `INSERT INTO orders (farmer_uuid, product_name, irrigation_type, final_price, quantity, paymentmode) 
             VALUES (:farmer_uuid, :product_name, :irrigation_type, :final_price, :quantity, :paymentmode) 
             RETURNING order_uuid INTO :uuid`,
            {
                farmer_uuid: farmerUUID,
                product_name,
                irrigation_type,
                final_price,
                quantity,
                paymentmode,
                uuid: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
            }
        );

        const orderUUID = orderResult.outBinds.uuid[0];
        console.log("Order inserted with UUID:", orderUUID);

        // Commit the transaction
        await connection.commit();
        console.log("Transaction committed");

        // Send device_id and password via SMS
        await sendSMS(phone, device_id, password); // Call the sendSMS function

        // Send response to client
        res.status(201).json({ message: 'Thankyou for choosing KrishiSeva.AI. Your Order placed successfully. Kindly use these information for Login ', deviceid: device_id, password: password });
    } catch (error) {
        console.error('Error during registration and order:', error);
        res.status(500).json({ error: 'Failed to place order. Check the server logs for more details.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log("Oracle connection closed");
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
});


// Payment page route
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

const moment = require('moment');

app.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;

    // Check if OTP matches the one stored in session (or DB)
    if (req.session.otp === otp) {
        // OTP is correct, confirm the payment
        const { transaction_id, paymentOption, amount } = req.session.transactionDetails;

        // Generate device_id and password (for login)
        const device_id = crypto.randomBytes(8).toString('hex');
        const password = crypto.randomBytes(6).toString('hex');  // Or any other password generation logic

        // Capture payment time
        const paymentTime = moment().format('YYYY-MM-DD HH:mm:ss');

        // Store the payment details in the database
        await connection.execute(
            `INSERT INTO payments (transaction_id, amount, payment_time, payment_option, device_id, password) 
             VALUES (:transaction_id, :amount, :payment_time, :paymentOption, :device_id, :password)`,
            { transaction_id, amount, payment_time: paymentTime, paymentOption, device_id, password }
        );

        // Commit the transaction
        await connection.commit();

        // Send confirmation details (device_id and password) to farmer's phone
        const confirmationMessage = `Payment successful! Your device ID: ${device_id}, Password: ${password}. Please use these credentials to log in.`;
        
        client.messages.create({
            body: confirmationMessage,
            from: '+1234567890',
            to: req.session.phone  // Farmer's phone number stored in session
        }).then(message => {
            console.log('Payment confirmation sent:', message.sid);
            res.send('Payment successful and confirmation sent to farmer!');
        }).catch(err => {
            console.error('Error sending confirmation:', err);
            res.status(500).send('Error sending payment confirmation');
        });

    } else {
        // OTP does not match
        res.status(400).send('Invalid OTP. Please try again.');
    }
});


app.post('/generate-otp', async (req, res) => {
    const { phone, paymentOption, transaction_id, amount } = req.body;

    // Generate OTP (4-6 digits, customizable)
    const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });

    // Save the OTP and other transaction details in session (or DB)
    req.session.otp = otp;
    req.session.transactionDetails = { transaction_id, paymentOption, amount };

    // Send OTP via SMS (using Twilio or other SMS service)
    const message = `Your OTP for the payment confirmation is: ${otp}. It is valid for 10 minutes.`;
    
    // Example using Twilio to send the SMS
    client.messages.create({
        body: message,
        from: '+1234567890',  // Your Twilio phone number
        to: phone  // Farmer's phone number
    }).then(message => {
        console.log('OTP sent:', message.sid);
        res.redirect('/verify-otp');  // Redirect to OTP verification page
    }).catch(err => {
        console.error('Error sending OTP:', err);
        res.status(500).send('Error sending OTP');
    });
});

app.post('/askyourplant', async (req, res) => {
    const data = req.body;
    const apiResponse = await fetch('http://localhost:5000/predict-disease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: data.features })
    });
    const result = await apiResponse.json();
    res.render('ask-your-plant', { prediction: result.prediction });
});


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes to serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));  // Correct path
});

app.get('/devices', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'Devices.html'));
});

app.get('/waterstatus', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'waterstatus.html'));
});

app.get('/aboutus', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'Aboutus.html')); // Ensure this route points to Aboutus.html
});

app.get('/contactus', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contactus.html'));
});

app.get('/askyourplant', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'askyourplant.html'));
});

app.get('/rewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'rewards.html'));
});

app.get('/unlockrewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'unlockrewards.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'engineeregister.html'));
});

app.get('/engineerlogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'engineerlogin.html'));
});
app.get('/buysellportal', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'buysellportal.html'));
});
app.get('/confirmpayment', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'confirmpayment.html'));
});

app.listen(3000, async () => {
    await initializeDB(); // Make sure the kitchen (database) is ready
    console.log('Server running on http://localhost:3000');
});
