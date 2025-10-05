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
const Gemini_API_KEY = "AIzaSyDkRemmIu6UkJO0M8qiVWHnibKJxQ7NpaA";

app.use(cors());
app.use(bodyParser.json());
// ---------------- CHAT / PLAN ----------------
app.post("/chat", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });

  const { prompt, type } = req.body;

  try {
    // Get user profile
    const [rows] = await new Promise((resolve, reject) => {
      db.query(
        "SELECT name, age, gender, height, weight, goal FROM users WHERE id = ?",
        [req.session.userId],
        (err, results) => (err ? reject(err) : resolve([results]))
      );
    });

    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    // --- 1️⃣ Generate a chat reply (normal text answer) ---
    const chatReplyResponse = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
You are a helpful and knowledgeable fitness assistant.
User profile:
- Name: ${user.name}
- Age: ${user.age}
- Gender: ${user.gender}
- Height: ${user.height} cm
- Weight: ${user.weight} kg
- Goal: ${user.goal}

Task: Reply conversationally to the user’s question or statement.
User: ${prompt}
`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": Gemini_API_KEY,
        },
      }
    );

    const chatReply =
      chatReplyResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "I'm not sure, could you rephrase that?";

    // --- 2️⃣ Generate plan (diet + workout) like before ---
    const systemInstruction = `
You are a fitness assistant.
User Profile:
- Name: ${user.name}
- Age: ${user.age}
- Gender: ${user.gender}
- Height: ${user.height} cm
- Weight: ${user.weight} kg
- Goal: ${user.goal}

TASK:
Suggest EXACTLY 3 diet foods and 3 workouts.
- First diet: fruits/snacks, second: main meal/lunch, third: breakfast/drink
- First workout: strength, second: cardio, third: yoga
- Provide short descriptions
- Output ONLY valid JSON with "food" and "workout" arrays.
Each item must have "name" and "description".
`;

    const planResponse = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          { role: "user", parts: [{ text: systemInstruction }] },
          { role: "user", parts: [{ text: prompt }] },
        ],
      },
      { headers: { "Content-Type": "application/json", "x-goog-api-key": Gemini_API_KEY } }
    );

    let generatedText =
      planResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let plan = { food: [], workout: [] };
    try {
      plan = JSON.parse(generatedText);
    } catch {
      const match = generatedText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          plan = JSON.parse(match[0]);
        } catch {}
      }
    }

    // Add static images
    const staticFoodImages = [
      "/images/fruits.jpg",
      "/images/meals.png",
      "/images/breakfast.png",
    ];
    const staticWorkoutImages = [
      "/images/strength.jpeg",
      "/images/cardio.jpeg",
      "/images/yoga.jpeg",
    ];

    plan.food = (plan.food || []).slice(0, 3).map((item, index) => ({
      ...item,
      img: staticFoodImages[index],
    }));

    plan.workout = (plan.workout || []).slice(0, 3).map((item, index) => ({
      ...item,
      img: staticWorkoutImages[index],
    }));

    // --- 3️⃣ Send both reply + plan ---
    res.json({
      reply: chatReply, // text for chatbot window
      plan: plan, // plan for dashboard
    });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});





app.listen(3000, () => console.log("Server running on http://localhost:3000"));





// ---------------- LOGOUT ----------------
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/homepage.html')));

// ---------------- SERVER ----------------
app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
