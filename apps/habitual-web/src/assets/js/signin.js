/**
 * Sign-in page controller.
 *
 * Flow: user enters email → lookup via /api/users → signIn() → redirect.
 * No password required — simple email-based auth for personal projects.
 */
import { signIn, isSignedIn, getFriendlyName } from "/assets/js/auth/auth.js";
import { getRemoteUserByEmail } from "/assets/js/auth/auth-remote.js";
import { readIntendedPath, clearIntendedPath } from "/assets/js/auth/auth-intent.js";

function sanitizePath(path) {
  if (!path || typeof path !== "string") return "/";
  // Only allow relative paths starting with /
  if (!path.startsWith("/")) return "/";
  // Block protocol-relative URLs
  if (path.startsWith("//")) return "/";
  return path;
}

document.addEventListener("DOMContentLoaded", () => {
  const signInBtn = document.getElementById("signInBtn");
  const emailInput = document.getElementById("emailInput");
  const errorMsg = document.getElementById("errorMsg");
  const formEl = document.getElementById("signin-form");
  const alreadyEl = document.getElementById("already-signed-in");

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

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      errorMsg.textContent = "Please enter a valid email.";
      errorMsg.style.display = "";
      return;
    }

    signInBtn.textContent = "Checking...";
    signInBtn.disabled = true;

    try {
      const user = await getRemoteUserByEmail(email);
      if (!user) throw new Error("not found");

      // Sign in (persist to localStorage), don't reload yet
      signIn(user, false);

      // Redirect to intended path
      const dest = sanitizePath(readIntendedPath());
      clearIntendedPath();
      location.replace(dest);
    } catch {
      errorMsg.textContent = "Sorry, we couldn't find that account.";
      errorMsg.style.display = "";
      signInBtn.textContent = "Sign in";
      signInBtn.disabled = false;
    }
  });
});
