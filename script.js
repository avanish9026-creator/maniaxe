// ===============================
// COURSE WEBSITE SETTINGS
// ===============================
// Replace this URL with your real payment/checkout page.
// Examples: Razorpay Payment Link, Stripe Checkout, Instamojo, etc.
const PAYMENT_URL = "https://ibb.co/ynhrjwR5";

document.getElementById("year").textContent = new Date().getFullYear();

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function filterCourses(category, button) {
  document.querySelectorAll(".filter").forEach(btn => btn.classList.remove("active"));
  button.classList.add("active");

  document.querySelectorAll(".course-item").forEach(card => {
    const show = category === "all" || card.dataset.category === category;
    card.classList.toggle("hidden", !show);
  });
}

function openPurchase(courseName, price) {
  document.getElementById("selectedCourse").textContent = courseName;
  document.getElementById("selectedPrice").textContent = price;
  document.getElementById("paymentLink").href = PAYMENT_URL;
  document.getElementById("purchaseModal").style.display = "block";
  document.body.style.overflow = "hidden";
}

function closePurchase() {
  document.getElementById("purchaseModal").style.display = "none";
  document.body.style.overflow = "";
}

window.addEventListener("click", function(event) {
  const modal = document.getElementById("purchaseModal");
  if (event.target === modal) closePurchase();
});

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") closePurchase();
});

function submitContact(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();
  const output = document.getElementById("formMessage");

  if (!name || !email || !message) {
    output.textContent = "Please fill in all fields.";
    return;
  }

  // Front-end demo only.
  // Connect this form to Formspree, EmailJS, your backend, etc. for real messages.
  output.textContent = "Thanks! Your message is ready to be connected to your email service.";
  event.target.reset();
}
