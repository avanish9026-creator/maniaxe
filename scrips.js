const question = document.getElementById("question");
const gif = document.getElementById("gif");
const yesBtn = document.getElementById("yes-btn");
const noBtn = document.getElementById("no-btn");

yesBtn.addEventListener("click", () => {
  question.innerHTML = "I knew it 😍";
  gif.src = "https://media.giphy.com/media/UMon0fuimoAN9ueUNP/giphy.gif";
});

// Function to move the No button randomly on screen
function moveNoButton() {
  if (noBtn.style.position !== "absolute") {
    noBtn.style.position = "absolute";
  }

  const noBtnRect = noBtn.getBoundingClientRect();
  
  // Constrain button movement to viewport edges with 20px padding
  const padding = 20;
  const maxX = window.innerWidth - noBtnRect.width - padding;
  const maxY = window.innerHeight - noBtnRect.height - padding;

  // Choose a random coordinate within padding and maximum bounds
  const randomX = Math.max(padding, Math.floor(Math.random() * maxX));
  const randomY = Math.max(padding, Math.floor(Math.random() * maxY));

  noBtn.style.left = randomX + "px";
  noBtn.style.top = randomY + "px";
}

// Hover/Mouseover event (Desktop)
noBtn.addEventListener("mouseover", moveNoButton);

// Touchstart event (Mobile/Tablet)
noBtn.addEventListener("touchstart", (e) => {
  e.preventDefault(); // Prevents tap/click action on mobile
  moveNoButton();
});

// Prevent focusing/clicking via keyboard tab key
noBtn.addEventListener("focus", (e) => {
  e.preventDefault();
  moveNoButton();
});
