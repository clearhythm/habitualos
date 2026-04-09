/**
 * Sign-in page controller — magic link flow.
 *
 * Flow: user enters email → POST /api/auth/magic-link → show "check your email" state.
 * Actual sign-in happens on the /signin/verify/ page when they click the link.
 */
import { isSignedIn, getFriendlyName, getLocalUser } from "/assets/js/auth/auth.js";
import { readIntendedPath, clearIntendedPath } from "/assets/js/auth/auth-intent.js";

function sanitizePath(path) {
  if (!path || typeof path !== "string") return "/";
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";
  return path;
}

document.addEventListener("DOMContentLoaded", () => {
  const signInBtn = document.getElementById("signInBtn");
  const emailInput = document.getElementById("emailInput");
  const errorMsg = document.getElementById("errorMsg");
  const formEl = document.getElementById("signin-form");
  const alreadyEl = document.getElementById("already-signed-in");
  const emailSentEl = document.getElementById("email-sent");
  const sentToEmailEl = document.getElementById("sentToEmail");

  const nextPath = sanitizePath(readIntendedPath());

  // Already signed in — redirect or show message
  if (isSignedIn()) {
    if (nextPath && nextPath !== "/signin/") {
      clearIntendedPath();
      location.replace(nextPath);
      return;
    }
    document.getElementById("signedInName").textContent = getFriendlyName();
    alreadyEl.style.display = "";
    return;
  }

  // Show sign-in form
  formEl.style.display = "";

  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      signInBtn.click();
    }
  });

  signInBtn.addEventListener("click", async () => {
    const email = (emailInput.value || "").trim();
    errorMsg.style.display = "none";
    errorMsg.textContent = "";

    if (!email) {
      errorMsg.textContent = "Please enter your email.";
      errorMsg.style.display = "";
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      errorMsg.textContent = "Please enter a valid email.";
      errorMsg.style.display = "";
      return;
    }

    signInBtn.textContent = "Sending...";
    signInBtn.disabled = true;

    // Capture current guest ID so the server can preserve anonymous data
    const guestId = getLocalUser()?._userId || null;

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, guestId })
      });

      if (!res.ok) throw new Error("send failed");

      // Show success state
      formEl.style.display = "none";
      sentToEmailEl.textContent = email;
      emailSentEl.style.display = "";
    } catch {
      errorMsg.textContent = "Something went wrong. Please try again.";
      errorMsg.style.display = "";
      signInBtn.textContent = "Send sign-in link";
      signInBtn.disabled = false;
    }
  });
});
