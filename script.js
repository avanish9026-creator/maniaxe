// ======================================================
// MANIAXE ACADEMY - JAVASCRIPT
// ======================================================


// ======================================================
// 1. COURSE PAYMENT LINK
// ======================================================

// Replace this with your actual payment link.
//
// Example:
// const PAYMENT_URL = "https://rzp.io/l/xxxxxxxx";
//
// You can also put your UPI/payment page here.

const PAYMENT_URL =
    "https://example.com/your-payment-link";


// ======================================================
// 2. EMAILJS CONFIGURATION
// ======================================================

const EMAILJS_PUBLIC_KEY =
    "WZEM5PYoMJmw7VoZo";

const EMAILJS_SERVICE_ID =
    "service_hzq5qsl";

const EMAILJS_TEMPLATE_ID =
    "template_m6fg0y8";


// ======================================================
// 3. INITIALIZE EMAILJS
// ======================================================

emailjs.init({
    publicKey: EMAILJS_PUBLIC_KEY
});


// ======================================================
// 4. CURRENT YEAR
// ======================================================

const yearElement =
    document.getElementById("year");

if (yearElement) {

    yearElement.textContent =
        new Date().getFullYear();

}


// ======================================================
// 5. MOBILE MENU
// ======================================================

function toggleMenu() {

    const menu =
        document.getElementById("mobileMenu");

    if (!menu) {
        return;
    }


    if (menu.style.display === "block") {

        menu.style.display = "none";

    } else {

        menu.style.display = "block";

    }

}


// ======================================================
// 6. COURSE FILTER
// ======================================================

function filterCourses(
    category,
    button
) {

    // Remove active class
    document
        .querySelectorAll(".filter")
        .forEach(function (btn) {

            btn.classList.remove("active");

        });


    // Add active class
    if (button) {

        button.classList.add("active");

    }


    // Get all courses
    const courses =
        document.querySelectorAll(".course-item");


    courses.forEach(function (course) {

        const courseCategory =
            course.dataset.category;


        if (
            category === "all" ||
            courseCategory === category
        ) {

            course.classList.remove("hidden");

        } else {

            course.classList.add("hidden");

        }

    });

}


// ======================================================
// 7. OPEN PURCHASE MODAL
// ======================================================

function openPurchase(
    courseName,
    price
) {

    const modal =
        document.getElementById("purchaseModal");

    const course =
        document.getElementById("selectedCourse");

    const selectedPrice =
        document.getElementById("selectedPrice");

    const paymentLink =
        document.getElementById("paymentLink");


    if (course) {

        course.textContent =
            courseName;

    }


    if (selectedPrice) {

        selectedPrice.textContent =
            price;

    }


    if (paymentLink) {

        paymentLink.href =
            PAYMENT_URL;

    }


    if (modal) {

        modal.style.display =
            "block";

    }


    document.body.style.overflow =
        "hidden";

}


// ======================================================
// 8. CLOSE PURCHASE MODAL
// ======================================================

function closePurchase() {

    const modal =
        document.getElementById("purchaseModal");


    if (modal) {

        modal.style.display =
            "none";

    }


    document.body.style.overflow =
        "";

}


// ======================================================
// 9. CLOSE MODAL WHEN CLICKING OUTSIDE
// ======================================================

window.addEventListener(
    "click",
    function (event) {

        const modal =
            document.getElementById("purchaseModal");


        if (
            modal &&
            event.target === modal
        ) {

            closePurchase();

        }

    }
);


// ======================================================
// 10. CLOSE MODAL WITH ESC KEY
// ======================================================

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closePurchase();

        }

    }
);


// ======================================================
// 11. CONTACT FORM
//     EMAILJS → YOUR EMAIL
// ======================================================

const contactForm =
    document.getElementById("contactForm");


if (contactForm) {


    contactForm.addEventListener(
        "submit",
        function (event) {

            // Stop page refresh
            event.preventDefault();


            const button =
                document.getElementById("sendButton");


            const messageBox =
                document.getElementById("formMessage");


            // Safety check
            if (
                !button ||
                !messageBox
            ) {

                return;

            }


            // Show sending status
            button.disabled =
                true;

            button.textContent =
                "Sending...";


            messageBox.textContent =
                "";


            // Send form through EmailJS
            emailjs.sendForm(

                EMAILJS_SERVICE_ID,

                EMAILJS_TEMPLATE_ID,

                contactForm

            )

            .then(
                function (response) {

                    console.log(
                        "EMAIL SENT:",
                        response.status,
                        response.text
                    );


                    messageBox.style.color =
                        "#16a34a";


                    messageBox.textContent =
                        "Message sent successfully! ✓";


                    // Clear form
                    contactForm.reset();

                }
            )

            .catch(
                function (error) {

                    console.error(
                        "EMAILJS ERROR:",
                        error
                    );


                    messageBox.style.color =
                        "#dc2626";


                    messageBox.textContent =
                        "Message could not be sent. Please try again.";

                }
            )

            .finally(
                function () {

                    button.disabled =
                        false;


                    button.textContent =
                        "Send Message";

                }
            );

        }
    );

}
