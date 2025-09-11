const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const axios = require("axios");   // ✅ changed import to require
const cors = require("cors");     // ✅ changed import to require


const app = express();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'supersecretkey',
    resave: false,
    saveUninitialized: true
}));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'harsha',
    database: 'diet_exercise'
});

db.connect(err => {
    if (err) throw err;
    console.log('✅ MySQL Connected...');
});

// ---------------- SIGNUP ----------------
app.post('/signup', upload.single('profilePic'), (req, res) => {
    const { name, email, password, age, gender, height, weight, goal } = req.body;
    const profilePic = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `
        INSERT INTO users 
        (name, email, password, age, gender, height, weight, goal, profile_pic, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(sql, [name, email, password, age, gender, height, weight, goal, profilePic], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: "Email already registered" });
            return res.status(500).json({ success: false, message: "Something went wrong" });
        }

        db.query('SELECT * FROM users WHERE id = ?', [result.insertId], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: "Error after signup" });
            req.session.user = results[0];
            req.session.userId = results[0].id;
            res.json({ success: true, redirect: "/dashboard.html" });
        });
    });
});

// ---------------- LOGIN ----------------
app.post('/login', upload.none(), (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';

    db.query(sql, [email, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Server error" });

        if (results.length > 0) {
            req.session.user = results[0];
            req.session.userId = results[0].id;
            res.json({ success: true, redirect: "/dashboard.html" });
        } else {
            res.status(400).json({ success: false, message: "Invalid email or password" });
        }
    });
});

// ---------------- PROFILE API ----------------
app.get('/api/profile', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(req.session.user);
});

// ---------------- USER DATA FOR PROFILE ----------------
app.get('/api/user-data', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    db.query('SELECT height, weight, goal FROM users WHERE id = ?', [req.session.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(results[0]);
    });
});

// ---------------- UPDATE PROFILE ----------------
app.post('/api/update-profile', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { height, weight, goal } = req.body;
    db.query(
        'UPDATE users SET height = ?, weight = ?, goal = ? WHERE id = ?',
        [height, weight, goal, req.session.userId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Update failed' });

            db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, results) => {
                if (!err && results[0]) req.session.user = results[0];
                res.json({ message: 'Profile updated successfully' });
            });
        }
    );
});
const Gemini_API_KEY = "your gemini api key";

app.use(cors());
app.use(bodyParser.json());

app.post("/chat", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    // 1. Get user profile from DB
    db.query(
      "SELECT name, age, gender, height, weight, goal FROM users WHERE id = ?",
      [req.session.userId],
      async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!results[0]) return res.status(404).json({ error: "User not found" });

        const user = results[0];

        // 2. Build context for Gemini
        const systemInstruction = `
You are a helpful fitness and diet assistant.
Answer only fitness, exercise, and nutrition questions and greetings.
Base your answers on the user's profile:
- Name: ${user.name}
- Age: ${user.age}
- Gender: ${user.gender}
- Height: ${user.height} cm
- Weight: ${user.weight} kg
- Goal: ${user.goal}
If the user asks unrelated questions, politely say:
"I can only help with fitness and diet related questions."
        `;

        // 3. Send request to Gemini API
        const response = await axios.post(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
          {
            contents: [
              { role: "user", parts: [{ text: systemInstruction }] },
              { role: "user", parts: [{ text: req.body.prompt }] }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": Gemini_API_KEY
            }
          }
        );

        console.log("Gemini raw response:", JSON.stringify(response.data, null, 2));

        const generatedText =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

        res.json({ code: generatedText.trim() });
      }
    );
  } catch (error) {
    console.error("Gemini Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});



// ---------------- LOGOUT ----------------
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/homepage.html')));

// ---------------- SERVER ----------------
app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
