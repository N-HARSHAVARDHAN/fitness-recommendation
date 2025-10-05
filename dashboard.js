<script>
function calculateBMI(weight, height) {
  height = height / 100;
  return (weight / (height * height)).toFixed(1);
}

function getPlan(bmi, goal) {
  let category;
  if (bmi < 18.5) category = "underweight";
  else if (bmi >= 18.5 && bmi < 25) category = "normal";
  else category = "overweight";
  let plan;
  if (category === "underweight") {
    plan = goal === "muscle_gain" ? {
      food: [
        { name: "Eggs", img: "images/eggs.jpeg" },
        { name: "Chicken", img: "images/chicken.jpeg" },
        { name: "Milk", img: "images/milk.jpeg" }
      ],
      workout: [
        { name: "Weight Lifting", img: "images/weights.jpeg" },
        { name: "Push-ups", img: "images/pushups.jpeg" },
        { name: "Squats", img: "images/squats.jpeg" }
      ]
    } : {
      food: [
        { name: "Rice", img: "images/rice.jpeg" },
        { name: "Bread", img: "images/bread.jpeg" },
        { name: "Bananas", img: "images/bananas.jpeg" }
      ],
      workout: [
        { name: "Yoga", img: "images/yoga.jpeg" },
        { name: "Stretching", img: "images/streching.jpeg" },
        { name: "Walking", img: "images/waliking.jpeg" }
      ]
    };
  } else if (category === "normal") {
    plan = goal === "muscle_gain" ? {
      food: [
        { name: "Paneer", img: "images/paneer.jpeg" },
        { name: "Lean Meat", img: "images/chicken.jpeg" },
        { name: "Nuts", img: "images/nuts.jpeg" }
      ],
      workout: [
        { name: "Bench Press", img: "images/benchpress.jpeg" },
        { name: "Deadlifts", img: "images/deadlifts.jpeg" },
        { name: "Pull-ups", img: "images/pullups.jpeg" }
      ]
    } : {
      food: [
        { name: "Salad", img: "images/salad.jpeg" },
        { name: "Grilled Fish", img: "images/fish.jpeg" },
        { name: "Fruits", img: "images/fruits.jpeg" }
      ],
      workout: [
        { name: "Jogging", img: "images/waliking.jpeg" },
        { name: "Cycling", img: "images/cycling.jpeg" },
        { name: "Plank", img: "images/plank.jpeg" }
      ]
    };
  } else {
    plan = goal === "muscle_gain" ? {
      food: [
        { name: "High Protein Salad", img: "images/protien salad.jpeg" },
        { name: "Chicken Breast", img: "images/chicken.jpeg" },
        { name: "Boiled Eggs", img: "images/eggs.jpeg" }
      ],
      workout: [
        { name: "Strength Training", img: "images/weights.jpeg" },
        { name: "Resistance Bands", img: "images/babd.jpeg" },
        { name: "Swimming", img: "images/swimming.jpeg" }
      ]
    } : {
      food: [
        { name: "Vegetables", img: "images/healthy veg.jpg" },
        { name: "Oats", img: "images/oats.jpeg" },
        { name: "Soup", img: "images/soup.jpeg" }
      ],
      workout: [
        { name: "Cardio", img: "images/waliking.jpeg" },
        { name: "Skipping", img: "images/skipping.jpeg" },
        { name: "HIIT", img: "images/hiit.jpeg" }
      ]
    };
  }
  return plan;
}

function renderItems(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(i => `
    <div>
      <img src="${i.img}" alt="${i.name}">
      <p>${i.name}</p>
    </div>
  `).join("");
}

function loadProfile() {
  fetch('/api/profile')
    .then(res => res.json())
    .then(user => {
      const bmi = calculateBMI(user.weight, user.height);
      const plan = getPlan(bmi, user.goal);
      renderItems("food", plan.food);
      renderItems("workout", plan.workout);
      document.getElementById("profileBox").innerHTML = `
        <img src="${user.profile_pic || 'images/default.png'}" alt="Profile">
        <h3>${user.name}</h3>
        <p>Age: ${user.age}</p>
        <p>Gender: ${user.gender}</p>
        <p>Height: ${user.height} cm</p>
        <p>Weight: ${user.weight} kg</p>
        <p>Goal: ${user.goal}</p>
        <p><strong>BMI: ${bmi}</strong></p>
      `;
      document.getElementById("header").innerHTML = `
        <h1>Welcome Back, ${user.name}!</h1>
        <p>Stay consistent 💪 — your personalized fitness & diet plan is ready 🚀</p>
      `;
    });
}
loadProfile();

  // Toggle chat window
  const chatButton = document.getElementById("chatButton");
  const chatbot = document.getElementById("chatbot");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");

  chatButton.addEventListener("click", () => {
    chatbot.style.display =
      chatbot.style.display === "none" ? "flex" : "none";
  });

  // Send message to backend
  // Send message to backend
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Show user message
  chatMessages.innerHTML += `<div class="user-msg">${message}</div>`;
  chatInput.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: message })   // ✅ match backend "prompt"
    });

    const data = await res.json();

    // Show bot reply
    chatMessages.innerHTML += `<div class="bot-msg">${data.code}</div>`; // ✅ match backend "code"
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error(err);
    chatMessages.innerHTML += `<div class="bot-msg">⚠️ Error: could not connect</div>`;
  }
}

</script>
