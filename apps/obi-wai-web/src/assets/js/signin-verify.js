/**
 * Sign-in verify page controller.
 *
 * Reads the token from the URL, calls /api/auth/verify, signs the user in,
 * then redirects to the intended destination.
 */
import { signIn, getLocalUser } from "/assets/js/auth/auth.js";
import { readIntendedPath, clearIntendedPath } from "/assets/js/auth/auth-intent.js";

function show(id) {
  ["state-loading", "state-success", "state-expired", "state-invalid"].forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  show("state-loading");

  const token = new URLSearchParams(location.search).get("token");
  if (!token) {
    show("state-invalid");
    return;
  }

  try {
    const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);

    if (res.status === 410) {
      show("state-expired");
      return;
    }

    if (!res.ok) {
      show("state-invalid");
      return;
    }

    const user = await res.json();
    if (!user.ok || !user.userId) {
      show("state-invalid");
      return;
    }

    // Capture guest ID before signIn() overwrites localStorage
    const guestId = getLocalUser()?._userId || null;

    // Write authenticated session to localStorage (no page reload yet)
    signIn({ _userId: user.userId, _email: user.email, profile: user.profile || {} }, false);

    // If this device had a different anonymous ID, migrate its data
    if (guestId && guestId !== user.userId) {
      try {
        await fetch("/api/migrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldUserId: guestId, newUserId: user.userId })
        });
      } catch {
        // Non-fatal — proceed with sign-in regardless
      }
    }

    show("state-success");

    const dest = readIntendedPath();
    clearIntendedPath();

    setTimeout(() => {
      location.replace(dest && dest !== "/signin/" && dest !== "/signin/verify/" ? dest : "/practice/");
    }, 800);
  } catch {
    show("state-invalid");
  }
});
