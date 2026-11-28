/* Equity Intelligence — Institutional User Authentication & Cloud Sync (Firebase v11 Modular SDK)
 * Scales smoothly to 50,000+ MAU on Firebase Auth + Cloud Firestore with strict per-user isolation.
 * Supports Sign In, Sign Up, Forgot Password, Google Sign-In, Profile Management, Cloud Watchlist & Chart Sync,
 * and in-app Account Deletion (Apple App Store Review Guideline 5.1.1(v) compliant).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Firebase Web Client Configuration:
// - Restricted in Google Cloud API Keys v2 to allowed HTTP referrers (esrasekerci.github.io, firebaseapp.com, localhost)
// - Restricted to least-privilege client APIs only (identitytoolkit, securetoken, firestore, firebaseinstallations)
// - Protected by owner-only Cloud Firestore Security Rules (firestore.rules)
const FIREBASE_CONFIG = {
  projectId: "equity-intel-app-2026",
  appId: "1:454383756252:web:e0144ed8f9f64f5caae519",
  storageBucket: "equity-intel-app-2026.firebasestorage.app",
  apiKey: "AIzaSyD3I9f6mXioDtiisXQfTdo0692x6-PvRBo",
  authDomain: "equity-intel-app-2026.firebaseapp.com",
  messagingSenderId: "454383756252",
};

const ALLOWED_OVERLAY_KEYS = ["sma20", "sma50", "sma200", "sr", "weekends"];
const ALLOWED_OVERVIEW_SECTIONS = ["kpis", "watchlist", "news", "signals", "sectors", "movers", "earnings"];

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const authState = {
  user: null,
  ready: false,
  mode: "login", // "login" | "signup" | "forgot" | "account" | "personalize"
  prevMode: "login",
  busy: false,
  unsubDoc: null,
  docHydrated: false,
  pendingSync: false,
  resetCooldownUntil: 0,
  resetTimer: null,
  deleteConfirmOpen: false,
  prefillEmail: "",
  pendingSignupName: "",
};

function sanitizeWatchlist(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const sym = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
    if (!sym || sym.length > 12 || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= 200) break;
  }
  return out;
}

function sanitizeOverlays(ov) {
  const clean = {};
  if (!ov || typeof ov !== "object") return clean;
  for (const k of ALLOWED_OVERLAY_KEYS) {
    if (k in ov) clean[k] = Boolean(ov[k]);
  }
  return clean;
}

function sanitizeOverviewPrefs(prefs) {
  const valid = new Set(ALLOWED_OVERVIEW_SECTIONS);
  const order = [];
  for (const raw of Array.isArray(prefs?.order) ? prefs.order : []) {
    const id = String(raw || "").trim();
    if (valid.has(id) && !order.includes(id)) order.push(id);
  }
  for (const d of ALLOWED_OVERVIEW_SECTIONS) {
    if (!order.includes(d)) order.push(d);
  }
  const hidden = [];
  for (const raw of Array.isArray(prefs?.hidden) ? prefs.hidden : []) {
    const id = String(raw || "").trim();
    if (valid.has(id) && !hidden.includes(id)) hidden.push(id);
  }
  if (hidden.length >= ALLOWED_OVERVIEW_SECTIONS.length) {
    hidden.pop();
  }
  return { order, hidden };
}

function friendlyAuthError(err) {
  const code = String(err?.code || "");
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password. Please try again or reset your password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 8 characters long.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment or use Forgot Password.";
    case "auth/network-request-failed":
      return "Network connection interrupted. Check your internet and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in window was closed before completing.";
    case "auth/popup-blocked":
      return "Popup was blocked by the browser. Redirecting to Google Sign-In…";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled yet. Please use Email & Password.";
    case "auth/unauthorized-domain":
      return "This domain is not yet authorized in Firebase Auth settings. Use Email & Password or add this hostname in Authorized Domains.";
    case "auth/requires-recent-login":
      return "For your security, please enter your password (or re-verify with Google) to complete account deletion.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return err?.message ? String(err.message).replace(/^Firebase:\s*/i, "") : "Authentication failed. Please try again.";
  }
}

function userDisplayLabel(user) {
  if (!user) return "Sign In";
  const name = String(user.displayName || "").trim();
  if (name) return name.split(/\s+/)[0].slice(0, 16);
  const email = String(user.email || "").trim();
  if (email && email.includes("@")) return email.split("@")[0].slice(0, 16);
  return "Account";
}

function userInitials(user) {
  if (!user) return "";
  const name = String(user.displayName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const email = String(user.email || "").trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

function updateTopbarAccountPill() {
  const btn = $("userAccountBtn");
  const labelEl = $("userAccountLabel");
  const user = authState.user;

  if (!btn || !labelEl) return;

  if (user) {
    btn.classList.add("is-authenticated");
    labelEl.textContent = userDisplayLabel(user);
  } else {
    btn.classList.remove("is-authenticated");
    labelEl.textContent = "Sign In";
  }
}

function setBanner(type, msg) {
  const el = $("authStatusBanner");
  if (!el) return;
  if (!msg) {
    el.className = "auth-banner hidden";
    el.textContent = "";
    return;
  }
  el.className = `auth-banner ${type === "ok" ? "is-ok" : type === "info" ? "is-info" : "is-err"}`;
  el.textContent = msg;
}

function passwordStrength(pw) {
  const s = String(pw || "");
  if (!s) return { score: 0, label: "", cls: "" };
  if (s.length < 8) return { score: 1, label: "Min 8 chars required", cls: "weak" };
  let pts = 1;
  if (s.length >= 10) pts++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) pts++;
  if (/\d/.test(s) || /[^A-Za-z0-9]/.test(s)) pts++;
  if (pts >= 4) return { score: 3, label: "Strong", cls: "strong" };
  return { score: 2, label: "Good", cls: "good" };
}

function googleSvgIcon() {
  return `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-.97 2.33-2.06 3.05l3.33 2.58c1.94-1.79 3.06-4.43 3.06-7.56 0-.73-.07-1.43-.19-2.1H12z"/><path fill="#34A853" d="M12 22c2.77 0 5.1-.92 6.8-2.49l-3.33-2.58c-.92.62-2.1.99-3.47.99-2.67 0-4.93-1.8-5.74-4.22l-3.44 2.66C4.51 19.73 7.98 22 12 22z"/><path fill="#4A90E2" d="M6.26 13.7A6.04 6.04 0 0 1 5.94 12c0-.59.11-1.16.32-1.7L2.82 7.64A9.96 9.96 0 0 0 2 12c0 1.61.39 3.14 1.08 4.49l3.18-2.79z"/><path fill="#FBBC05" d="M12 5.98c1.51 0 2.86.52 3.93 1.54l2.95-2.95C17.09 2.9 14.77 2 12 2 7.98 2 4.51 4.27 2.82 7.64l3.44 2.66C7.07 7.78 9.33 5.98 12 5.98z"/></svg>`;
}

function eyeSvgIcon(shown) {
  return shown
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function renderAuthModalContent() {
  const body = $("authModalBody");
  if (!body) return;
  if (authState.resetTimer) {
    clearInterval(authState.resetTimer);
    authState.resetTimer = null;
  }

  const user = authState.user;
  if (authState.mode !== "personalize") {
    if (user && authState.mode !== "account") {
      authState.mode = "account";
    } else if (!user && authState.mode === "account") {
      authState.mode = "login";
    }
  }

  const mode = authState.mode;

  if (mode === "personalize") {
    const specs = window.EQAppBridge?.getOverviewSpec?.() || ALLOWED_OVERVIEW_SECTIONS.map((id) => ({ id, title: id, sub: "" }));
    const specMap = Object.fromEntries(specs.map((s) => [s.id, s]));
    const prefs = sanitizeOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
    const hiddenSet = new Set(prefs.hidden);
    const isDefault =
      prefs.hidden.length === 0 &&
      prefs.order.every((id, idx) => id === ALLOWED_OVERVIEW_SECTIONS[idx]);

    body.innerHTML = `
      <div class="auth-sheet-handle" aria-hidden="true"></div>
      <div class="auth-hdr">
        <div>
          <button type="button" class="auth-back-link" id="authPersonalizeBackBtn">← Back</button>
          <h3 class="auth-title" style="margin-top:4px">Personalize Overview</h3>
        </div>
        <button type="button" class="auth-close-btn" id="authModalCloseBtn" aria-label="Close">✕</button>
      </div>

      <p class="auth-sub" style="margin-bottom:11px">Choose what to include on Overview and drag or tap ↑ ↓ to reorder sections.</p>

      <div class="ov-pref-list" id="ovPersonalizeList">
        ${prefs.order.map((id, idx) => {
          const sp = specMap[id] || { id, title: id, sub: "" };
          const on = !hiddenSet.has(id);
          return `
            <div class="ov-pref-row ${on ? "" : "is-off"}" data-pref-id="${esc(id)}">
              <span class="ov-pref-grip" data-pref-grip="1" title="Drag to reorder" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
              </span>
              <div class="ov-pref-text">
                <div class="ov-pref-title">${esc(sp.title)}</div>
                <div class="ov-pref-sub">${esc(sp.sub)}</div>
              </div>
              <div class="ov-pref-controls">
                <button type="button" class="ov-pref-move" data-pref-move="-1" data-pref-id="${esc(id)}" ${idx === 0 ? "disabled" : ""} aria-label="Move ${esc(sp.title)} up">↑</button>
                <button type="button" class="ov-pref-move" data-pref-move="1" data-pref-id="${esc(id)}" ${idx === prefs.order.length - 1 ? "disabled" : ""} aria-label="Move ${esc(sp.title)} down">↓</button>
                <button type="button" class="ov-pref-switch ${on ? "is-on" : ""}" role="switch" aria-checked="${on}" data-pref-toggle="${esc(id)}" aria-label="Show ${esc(sp.title)}">
                  <span class="ov-pref-knob"></span>
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="ov-pref-foot">
        <span class="muted">${user ? "Synced to your account" : "Saved on this device"}</span>
        ${!isDefault ? `<button type="button" class="auth-inline-link" id="ovPrefResetBtn">Reset default</button>` : ""}
      </div>
    `;

    wirePersonalizeHandlers();
    return;
  }

  if (mode === "account" && user) {
    const providerId = user.providerData?.[0]?.providerId || "password";
    const isPasswordUser = user.providerData?.some((p) => p.providerId === "password") || providerId === "password";
    const verified = Boolean(user.emailVerified) || providerId === "google.com";

    body.innerHTML = `
      <div class="auth-sheet-handle" aria-hidden="true"></div>
      <div class="auth-hdr">
        <div>
          <h3 class="auth-title">Account</h3>
        </div>
        <button type="button" class="auth-close-btn" id="authModalCloseBtn" aria-label="Close">✕</button>
      </div>

      <div id="authStatusBanner" class="auth-banner hidden"></div>

      <div class="auth-profile-card">
        <div class="auth-profile-meta">
          <div class="auth-profile-name-row">
            <strong>${esc(user.displayName || userDisplayLabel(user))}</strong>
          </div>
          <div class="auth-profile-email">${esc(user.email || "Signed in")}</div>
          ${!verified ? `
            <div class="auth-profile-badges">
              <span class="auth-mini-tag warn">Unverified email</span>
              <button type="button" class="auth-inline-link" id="authResendVerifyBtn">Send verification</button>
            </div>
          ` : ""}
        </div>
      </div>

      <form id="authProfileForm" class="auth-section-box" autocomplete="off">
        <label class="auth-label" for="authDisplayNameInp">Name</label>
        <div class="auth-inline-edit">
          <input id="authDisplayNameInp" class="auth-input" type="text" maxlength="80" value="${esc(user.displayName || "")}" placeholder="Your name" />
          <button type="submit" class="auth-btn-secondary" id="authSaveNameBtn">Save</button>
        </div>
      </form>

      <div class="auth-actions-stack">
        <button type="button" class="auth-action-row" id="authOpenPersonalizeBtn">
          <span>Personalize Overview</span>
          <span class="muted">Sections &amp; order →</span>
        </button>
        ${user.email ? `
          <button type="button" class="auth-action-row" id="authSendPwResetLoggedBtn">
            <span>${isPasswordUser ? "Reset Password" : "Set Password"}</span>
            <span class="muted">Email link →</span>
          </button>
        ` : ""}
        <button type="button" class="auth-action-row" id="authSignOutBtn">
          <span>Sign Out</span>
          <span class="muted">→</span>
        </button>
        <button type="button" class="auth-action-row danger" id="authToggleDeleteBtn">
          <span>Delete Account</span>
          <span class="muted">Permanent</span>
        </button>
      </div>

      <div id="authDeleteConfirmBox" class="auth-delete-box ${authState.deleteConfirmOpen ? "" : "hidden"}">
        <div class="auth-delete-warn">
          <strong>Delete account permanently?</strong>
          <p>This deletes your account and saved preferences permanently.</p>
        </div>
        ${isPasswordUser ? `
          <label class="auth-label" for="authDeletePwInp">Confirm password</label>
          <input id="authDeletePwInp" class="auth-input" type="password" autocomplete="current-password" placeholder="Enter password" />
        ` : ""}
        <div class="auth-delete-btns">
          <button type="button" class="auth-btn-secondary" id="authCancelDeleteBtn">Cancel</button>
          <button type="button" class="auth-btn-danger" id="authConfirmDeleteBtn">Delete</button>
        </div>
      </div>
    `;

    wireAccountHandlers();
    return;
  }

  if (mode === "forgot") {
    const remSec = Math.max(0, Math.ceil((authState.resetCooldownUntil - Date.now()) / 1000));
    body.innerHTML = `
      <div class="auth-sheet-handle" aria-hidden="true"></div>
      <div class="auth-hdr">
        <div>
          <button type="button" class="auth-back-link" id="authBackToLoginBtn">← Back to Sign In</button>
          <h3 class="auth-title" style="margin-top:4px">Reset Password</h3>
        </div>
        <button type="button" class="auth-close-btn" id="authModalCloseBtn" aria-label="Close">✕</button>
      </div>

      <p class="auth-sub">Enter the email associated with your account and we'll send an instant password reset link.</p>

      <div id="authStatusBanner" class="auth-banner hidden"></div>

      <form id="authForgotForm" class="auth-form" novalidate>
        <div class="auth-field">
          <label class="auth-label" for="authForgotEmail">Email Address</label>
          <input id="authForgotEmail" class="auth-input" type="email" inputmode="email" autocomplete="email" required placeholder="you@domain.com" value="${esc(authState.prefillEmail)}" />
        </div>
        <button type="submit" class="auth-btn-primary" id="authForgotSubmitBtn" ${remSec > 0 ? "disabled" : ""}>
          ${remSec > 0 ? `Resend available in ${remSec}s` : "Send Reset Link"}
        </button>
      </form>
    `;

    wireForgotHandlers();
    return;
  }

  const isSignup = mode === "signup";
  body.innerHTML = `
    <div class="auth-sheet-handle" aria-hidden="true"></div>
    <div class="auth-hdr">
      <div>
        <div class="auth-kicker">Equity Intelligence</div>
        <h3 class="auth-title">${isSignup ? "Create Your Account" : "Welcome Back"}</h3>
      </div>
      <button type="button" class="auth-close-btn" id="authModalCloseBtn" aria-label="Close">✕</button>
    </div>

    <div class="auth-tabs" role="tablist">
      <button type="button" class="auth-tab ${!isSignup ? "active" : ""}" data-auth-mode="login" role="tab" aria-selected="${!isSignup}">Sign In</button>
      <button type="button" class="auth-tab ${isSignup ? "active" : ""}" data-auth-mode="signup" role="tab" aria-selected="${isSignup}">Sign Up</button>
    </div>

    <div id="authStatusBanner" class="auth-banner hidden"></div>

    <button type="button" class="auth-google-btn" id="authGoogleBtn">
      ${googleSvgIcon()}
      <span>Continue with Google</span>
    </button>

    <div class="auth-divider"><span>or continue with email</span></div>

    <form id="authCredentialsForm" class="auth-form" novalidate>
      ${isSignup ? `
        <div class="auth-field">
          <label class="auth-label" for="authNameInp">Full Name</label>
          <input id="authNameInp" class="auth-input" type="text" autocomplete="name" maxlength="80" placeholder="Alex Morgan" />
        </div>
      ` : ""}

      <div class="auth-field">
        <label class="auth-label" for="authEmailInp">Email Address</label>
        <input id="authEmailInp" class="auth-input" type="email" inputmode="email" autocomplete="email" required placeholder="you@domain.com" value="${esc(authState.prefillEmail)}" />
      </div>

      <div class="auth-field">
        <div class="auth-label-row">
          <label class="auth-label" for="authPasswordInp">Password</label>
          ${!isSignup ? `<button type="button" class="auth-inline-link" id="authForgotLinkBtn">Forgot password?</button>` : `<span id="authPwStrengthLbl" class="auth-pw-lbl"></span>`}
        </div>
        <div class="auth-pw-wrap">
          <input id="authPasswordInp" class="auth-input" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" required placeholder="${isSignup ? "At least 8 characters" : "Enter your password"}" />
          <button type="button" class="auth-pw-eye" id="authPwToggleBtn" aria-label="Show password">${eyeSvgIcon(false)}</button>
        </div>
        ${isSignup ? `<div class="auth-pw-meter"><div id="authPwMeterFill" class="auth-pw-meter-fill"></div></div>` : ""}
      </div>

      ${isSignup ? `
        <div class="auth-field">
          <label class="auth-label" for="authConfirmPwInp">Confirm Password</label>
          <input id="authConfirmPwInp" class="auth-input" type="password" autocomplete="new-password" required placeholder="Re-enter password" />
        </div>
      ` : ""}

      <button type="submit" class="auth-btn-primary" id="authPrimarySubmitBtn">
        ${isSignup ? "Create Account" : "Sign In"}
      </button>
    </form>

    <div class="auth-actions-stack" style="margin-top:14px">
      <button type="button" class="auth-action-row" id="authGuestPersonalizeBtn">
        <span>Personalize Overview</span>
        <span class="muted">Sections &amp; order →</span>
      </button>
    </div>

    <div class="auth-foot-note">
      Syncs your Watchlist, Overview layout &amp; chart indicators across iOS, Android, and Web.
    </div>
  `;

  wireLoginSignupHandlers(isSignup);
}

function wireLoginSignupHandlers(isSignup) {
  $("authModalCloseBtn")?.addEventListener("click", closeAuthModal);

  $("authGuestPersonalizeBtn")?.addEventListener("click", () => {
    authState.prevMode = authState.mode;
    authState.mode = "personalize";
    renderAuthModalContent();
  });

  document.querySelectorAll("#authModalBody [data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const emailEl = $("authEmailInp");
      if (emailEl?.value) authState.prefillEmail = emailEl.value.trim();
      authState.mode = btn.dataset.authMode;
      renderAuthModalContent();
    });
  });

  $("authForgotLinkBtn")?.addEventListener("click", () => {
    const emailEl = $("authEmailInp");
    if (emailEl?.value) authState.prefillEmail = emailEl.value.trim();
    authState.mode = "forgot";
    renderAuthModalContent();
  });

  const pwInp = $("authPasswordInp");
  const pwToggle = $("authPwToggleBtn");
  if (pwInp && pwToggle) {
    pwToggle.addEventListener("click", () => {
      const show = pwInp.type === "password";
      pwInp.type = show ? "text" : "password";
      pwToggle.innerHTML = eyeSvgIcon(show);
      pwToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  }

  if (isSignup && pwInp) {
    pwInp.addEventListener("input", () => {
      const st = passwordStrength(pwInp.value);
      const lbl = $("authPwStrengthLbl");
      const fill = $("authPwMeterFill");
      if (lbl) {
        lbl.textContent = st.label;
        lbl.className = `auth-pw-lbl ${st.cls}`;
      }
      if (fill) {
        fill.className = `auth-pw-meter-fill ${st.cls}`;
        fill.style.width = st.score === 0 ? "0%" : st.score === 1 ? "33%" : st.score === 2 ? "68%" : "100%";
      }
    });
  }

  $("authGoogleBtn")?.addEventListener("click", handleGoogleSignIn);

  $("authCredentialsForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (authState.busy) return;

    const email = ($("authEmailInp")?.value || "").trim();
    const password = $("authPasswordInp")?.value || "";
    authState.prefillEmail = email;

    if (!email || !email.includes("@")) {
      setBanner("err", "Please enter a valid email address.");
      $("authEmailInp")?.focus();
      return;
    }

    if (isSignup) {
      const name = ($("authNameInp")?.value || "").trim();
      const confirmPw = $("authConfirmPwInp")?.value || "";
      if (password.length < 8) {
        setBanner("err", "Password must be at least 8 characters long.");
        $("authPasswordInp")?.focus();
        return;
      }
      if (password !== confirmPw) {
        setBanner("err", "Passwords do not match.");
        $("authConfirmPwInp")?.focus();
        return;
      }
      const btn = $("authPrimarySubmitBtn");
      authState.busy = true;
      authState.pendingSignupName = name;
      if (btn) { btn.disabled = true; btn.textContent = "Creating account…"; }
      setBanner("", "");
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          try { await updateProfile(cred.user, { displayName: name }); } catch {}
        }
        try { await sendEmailVerification(cred.user); } catch {}
        await hydrateAndSubscribeUserDoc(cred.user, name);
        updateTopbarAccountPill();
        closeAuthModal();
        window.EQAppBridge?.showToast?.(`Welcome${name ? `, ${name.split(/\s+/)[0]}` : ""}! Cloud sync enabled.`);
      } catch (err) {
        setBanner("err", friendlyAuthError(err));
      } finally {
        authState.busy = false;
        authState.pendingSignupName = "";
        if ($("authPrimarySubmitBtn")) {
          $("authPrimarySubmitBtn").disabled = false;
          $("authPrimarySubmitBtn").textContent = "Create Account";
        }
      }
    } else {
      if (!password) {
        setBanner("err", "Please enter your password.");
        $("authPasswordInp")?.focus();
        return;
      }
      const btn = $("authPrimarySubmitBtn");
      authState.busy = true;
      if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
      setBanner("", "");
      try {
        await signInWithEmailAndPassword(auth, email, password);
        closeAuthModal();
        window.EQAppBridge?.showToast?.("Signed in · Cloud watchlist synced");
      } catch (err) {
        setBanner("err", friendlyAuthError(err));
      } finally {
        authState.busy = false;
        if ($("authPrimarySubmitBtn")) {
          $("authPrimarySubmitBtn").disabled = false;
          $("authPrimarySubmitBtn").textContent = "Sign In";
        }
      }
    }
  });
}

async function handleGoogleSignIn() {
  if (authState.busy) return;
  authState.busy = true;
  const gBtn = $("authGoogleBtn");
  if (gBtn) gBtn.disabled = true;
  setBanner("", "");
  try {
    await signInWithPopup(auth, googleProvider);
    closeAuthModal();
    window.EQAppBridge?.showToast?.("Signed in with Google · Cloud synced");
  } catch (err) {
    const code = String(err?.code || "");
    if (code === "auth/popup-blocked") {
      setBanner("info", friendlyAuthError(err));
      try {
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (rErr) {
        setBanner("err", friendlyAuthError(rErr));
      }
    } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      setBanner("err", friendlyAuthError(err));
    }
  } finally {
    authState.busy = false;
    if ($("authGoogleBtn")) $("authGoogleBtn").disabled = false;
  }
}

function startResetCooldown() {
  authState.resetCooldownUntil = Date.now() + 30000;
  const tick = () => {
    const btn = $("authForgotSubmitBtn");
    if (!btn) {
      if (authState.resetTimer) { clearInterval(authState.resetTimer); authState.resetTimer = null; }
      return;
    }
    const rem = Math.max(0, Math.ceil((authState.resetCooldownUntil - Date.now()) / 1000));
    if (rem > 0) {
      btn.disabled = true;
      btn.textContent = `Resend available in ${rem}s`;
    } else {
      btn.disabled = false;
      btn.textContent = "Send Reset Link";
      if (authState.resetTimer) { clearInterval(authState.resetTimer); authState.resetTimer = null; }
    }
  };
  tick();
  if (authState.resetTimer) clearInterval(authState.resetTimer);
  authState.resetTimer = setInterval(tick, 1000);
}

function wireForgotHandlers() {
  $("authModalCloseBtn")?.addEventListener("click", closeAuthModal);
  $("authBackToLoginBtn")?.addEventListener("click", () => {
    const em = ($("authForgotEmail")?.value || "").trim();
    if (em) authState.prefillEmail = em;
    authState.mode = "login";
    renderAuthModalContent();
  });

  if (authState.resetCooldownUntil > Date.now()) {
    startResetCooldown();
  }

  $("authForgotForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (authState.busy || Date.now() < authState.resetCooldownUntil) return;
    const email = ($("authForgotEmail")?.value || "").trim();
    authState.prefillEmail = email;
    if (!email || !email.includes("@")) {
      setBanner("err", "Please enter a valid email address.");
      $("authForgotEmail")?.focus();
      return;
    }
    const btn = $("authForgotSubmitBtn");
    authState.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = "Sending reset link…"; }
    setBanner("", "");
    try {
      await sendPasswordResetEmail(auth, email);
      setBanner("ok", `Password reset link sent to ${email}. Check your inbox (and spam folder) to set a new password.`);
      startResetCooldown();
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
      if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link"; }
    } finally {
      authState.busy = false;
    }
  });
}

function wirePersonalizeHandlers() {
  $("authModalCloseBtn")?.addEventListener("click", closeAuthModal);
  $("authPersonalizeBackBtn")?.addEventListener("click", () => {
    authState.mode = authState.user ? "account" : (authState.prevMode || "login");
    renderAuthModalContent();
  });

  $("ovPrefResetBtn")?.addEventListener("click", () => {
    window.EQAppBridge?.setOverviewPrefs?.({ order: [...ALLOWED_OVERVIEW_SECTIONS], hidden: [] });
    renderAuthModalContent();
    window.EQAppBridge?.showToast?.("Overview restored to default");
  });

  const listEl = $("ovPersonalizeList");
  if (!listEl) return;

  listEl.querySelectorAll("[data-pref-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.prefToggle;
      const cur = sanitizeOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
      const hidden = new Set(cur.hidden);
      if (hidden.has(id)) {
        hidden.delete(id);
      } else {
        if (hidden.size + 1 >= ALLOWED_OVERVIEW_SECTIONS.length) {
          window.EQAppBridge?.showToast?.("Keep at least one section visible on Overview");
          return;
        }
        hidden.add(id);
      }
      window.EQAppBridge?.setOverviewPrefs?.({ order: cur.order, hidden: [...hidden] });
      renderAuthModalContent();
    });
  });

  listEl.querySelectorAll("[data-pref-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.prefId;
      const delta = Number(btn.dataset.prefMove || 0);
      const cur = sanitizeOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
      const idx = cur.order.indexOf(id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= cur.order.length) return;
      const nextOrder = [...cur.order];
      const [moved] = nextOrder.splice(idx, 1);
      nextOrder.splice(target, 0, moved);
      window.EQAppBridge?.setOverviewPrefs?.({ order: nextOrder, hidden: cur.hidden });
      renderAuthModalContent();
    });
  });

  // Smooth touch & pointer drag-to-reorder via grip handle (≡) on iOS, Android & Desktop
  let dragRow = null;
  let dragPointerId = null;

  listEl.querySelectorAll("[data-pref-grip]").forEach((grip) => {
    grip.addEventListener("pointerdown", (e) => {
      const row = grip.closest(".ov-pref-row");
      if (!row) return;
      e.preventDefault();
      dragRow = row;
      dragPointerId = e.pointerId;
      row.classList.add("is-dragging");
      try { grip.setPointerCapture(e.pointerId); } catch {}
    });

    grip.addEventListener("pointermove", (e) => {
      if (!dragRow || e.pointerId !== dragPointerId) return;
      e.preventDefault();
      const siblings = [...listEl.querySelectorAll(".ov-pref-row")].filter((r) => r !== dragRow);
      let nextSibling = null;
      for (const sib of siblings) {
        const box = sib.getBoundingClientRect();
        if (e.clientY < box.top + box.height / 2) {
          nextSibling = sib;
          break;
        }
      }
      if (nextSibling) {
        listEl.insertBefore(dragRow, nextSibling);
      } else {
        listEl.appendChild(dragRow);
      }
    });

    const endDrag = (e) => {
      if (!dragRow || (e && dragPointerId != null && e.pointerId !== dragPointerId)) return;
      dragRow.classList.remove("is-dragging");
      dragRow = null;
      dragPointerId = null;
      const domOrder = [...listEl.querySelectorAll(".ov-pref-row[data-pref-id]")]
        .map((r) => r.dataset.prefId)
        .filter(Boolean);
      const cur = sanitizeOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
      window.EQAppBridge?.setOverviewPrefs?.({ order: domOrder, hidden: cur.hidden });
      renderAuthModalContent();
    };

    grip.addEventListener("pointerup", endDrag);
    grip.addEventListener("pointercancel", endDrag);
  });
}

function wireAccountHandlers() {
  $("authModalCloseBtn")?.addEventListener("click", closeAuthModal);

  $("authOpenPersonalizeBtn")?.addEventListener("click", () => {
    authState.prevMode = "account";
    authState.mode = "personalize";
    renderAuthModalContent();
  });

  $("authProfileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = authState.user;
    if (!user || authState.busy) return;
    const newName = ($("authDisplayNameInp")?.value || "").trim().slice(0, 80);
    const btn = $("authSaveNameBtn");
    authState.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    try {
      await updateProfile(user, { displayName: newName });
      await setDoc(
        doc(db, "users", user.uid),
        { uid: user.uid, displayName: newName || null, updatedAt: serverTimestamp() },
        { merge: true }
      );
      updateTopbarAccountPill();
      renderAuthModalContent();
      setBanner("ok", "Display name updated.");
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
    } finally {
      authState.busy = false;
      if ($("authSaveNameBtn")) { $("authSaveNameBtn").disabled = false; $("authSaveNameBtn").textContent = "Save"; }
    }
  });

  $("authResendVerifyBtn")?.addEventListener("click", async () => {
    const user = authState.user;
    if (!user || authState.busy) return;
    authState.busy = true;
    try {
      await sendEmailVerification(user);
      setBanner("ok", `Verification link sent to ${user.email}.`);
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
    } finally {
      authState.busy = false;
    }
  });

  $("authOpenWatchlistBtn")?.addEventListener("click", () => {
    closeAuthModal();
    window.EQAppBridge?.openSavedWatchlist?.();
  });

  document.querySelectorAll("#authModalBody [data-auth-sym]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sym = btn.dataset.authSym;
      closeAuthModal();
      window.EQAppBridge?.openStock?.(sym);
    });
  });

  document.querySelectorAll("#authModalBody [data-auth-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sym = btn.dataset.authRm;
      window.EQAppBridge?.toggleWatchlist?.(sym);
      renderAuthModalContent();
    });
  });

  $("authSendPwResetLoggedBtn")?.addEventListener("click", async () => {
    const user = authState.user;
    if (!user?.email || authState.busy) return;
    authState.busy = true;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setBanner("ok", `Password reset email sent to ${user.email}.`);
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
    } finally {
      authState.busy = false;
    }
  });

  $("authSignOutBtn")?.addEventListener("click", async () => {
    if (authState.busy) return;
    authState.busy = true;
    try {
      cleanupFirestoreSub();
      await signOut(auth);
      authState.deleteConfirmOpen = false;
      closeAuthModal();
      window.EQAppBridge?.showToast?.("Signed out");
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
    } finally {
      authState.busy = false;
    }
  });

  $("authToggleDeleteBtn")?.addEventListener("click", () => {
    authState.deleteConfirmOpen = !authState.deleteConfirmOpen;
    $("authDeleteConfirmBox")?.classList.toggle("hidden", !authState.deleteConfirmOpen);
  });

  $("authCancelDeleteBtn")?.addEventListener("click", () => {
    authState.deleteConfirmOpen = false;
    $("authDeleteConfirmBox")?.classList.add("hidden");
  });

  $("authConfirmDeleteBtn")?.addEventListener("click", async () => {
    const user = authState.user;
    if (!user || authState.busy) return;
    const isPasswordUser = user.providerData?.some((p) => p.providerId === "password");
    const pw = $("authDeletePwInp")?.value || "";
    if (isPasswordUser && !pw) {
      setBanner("err", "Please enter your current password to confirm account deletion.");
      $("authDeletePwInp")?.focus();
      return;
    }

    const delBtn = $("authConfirmDeleteBtn");
    authState.busy = true;
    if (delBtn) { delBtn.disabled = true; delBtn.textContent = "Deleting…"; }
    setBanner("", "");

    try {
      if (isPasswordUser && user.email) {
        const cred = EmailAuthProvider.credential(user.email, pw);
        await reauthenticateWithCredential(user, cred);
      }
      cleanupFirestoreSub();
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch {}
      try {
        await deleteUser(user);
      } catch (delErr) {
        if (delErr?.code === "auth/requires-recent-login" && !isPasswordUser) {
          await reauthenticateWithPopup(user, googleProvider);
          await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
          await deleteUser(user);
        } else {
          throw delErr;
        }
      }
      authState.deleteConfirmOpen = false;
      closeAuthModal();
      window.EQAppBridge?.showToast?.("Your account and cloud data have been permanently deleted.");
    } catch (err) {
      setBanner("err", friendlyAuthError(err));
      if ($("authConfirmDeleteBtn")) {
        $("authConfirmDeleteBtn").disabled = false;
        $("authConfirmDeleteBtn").textContent = "Delete Permanently";
      }
    } finally {
      authState.busy = false;
    }
  });
}

function cleanupFirestoreSub() {
  if (authState.unsubDoc) {
    try { authState.unsubDoc(); } catch {}
    authState.unsubDoc = null;
  }
  authState.docHydrated = false;
}

async function hydrateAndSubscribeUserDoc(user, overrideName = "") {
  if (!user) return;
  cleanupFirestoreSub();
  const userRef = doc(db, "users", user.uid);
  const localWl = sanitizeWatchlist(window.EQAppBridge?.getWatchlist?.() || []);
  const localOv = sanitizeOverlays(window.EQAppBridge?.getChartOverlays?.() || {});
  const localPref = sanitizeOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
  const providerId = String(user.providerData?.[0]?.providerId || "password").slice(0, 40);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email ? String(user.email).slice(0, 254) : null,
        displayName: (overrideName || user.displayName || "").trim().slice(0, 80) || null,
        photoURL: user.photoURL ? String(user.photoURL).slice(0, 1024) : null,
        provider: providerId,
        watchlist: localWl,
        chartOverlays: localOv,
        overviewPrefs: localPref,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      authState.docHydrated = true;
    } else {
      const data = snap.data() || {};
      const cloudWl = sanitizeWatchlist(data.watchlist || []);
      // Merge any pre-login local watchlist stars with cloud watchlist so user never loses selections
      const mergedWl = sanitizeWatchlist([...cloudWl, ...localWl]);
      const cloudOv = data.chartOverlays && typeof data.chartOverlays === "object" ? sanitizeOverlays(data.chartOverlays) : localOv;
      const cloudPref = data.overviewPrefs && typeof data.overviewPrefs === "object" ? sanitizeOverviewPrefs(data.overviewPrefs) : localPref;
      authState.docHydrated = true;
      window.EQAppBridge?.applyCloudState?.({
        user: serializeUser(user),
        watchlist: mergedWl,
        chartOverlays: cloudOv,
        overviewPrefs: cloudPref,
      });
      if (mergedWl.length !== cloudWl.length || !data.overviewPrefs) {
        await setDoc(userRef, { uid: user.uid, watchlist: mergedWl, overviewPrefs: cloudPref, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  } catch (err) {
    console.warn("[EQAuth] Initial cloud sync warning:", err?.message || err);
    authState.docHydrated = true;
  }

  authState.unsubDoc = onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      window.EQAppBridge?.applyCloudState?.({
        user: serializeUser(user),
        watchlist: Array.isArray(d.watchlist) ? sanitizeWatchlist(d.watchlist) : undefined,
        chartOverlays: d.chartOverlays && typeof d.chartOverlays === "object" ? sanitizeOverlays(d.chartOverlays) : undefined,
        overviewPrefs: d.overviewPrefs && typeof d.overviewPrefs === "object" ? sanitizeOverviewPrefs(d.overviewPrefs) : undefined,
      });
      if (!$("authModal")?.classList.contains("hidden") && (authState.mode === "account" || authState.mode === "personalize")) {
        if (document.activeElement?.id !== "authDisplayNameInp" && document.activeElement?.id !== "authDeletePwInp") {
          renderAuthModalContent();
        }
      }
    },
    (err) => {
      console.warn("[EQAuth] Realtime listener warning:", err?.message || err);
    }
  );

  if (authState.pendingSync) {
    authState.pendingSync = false;
    syncWatchlist(window.EQAppBridge?.getWatchlist?.() || []);
    syncChartOverlays(window.EQAppBridge?.getChartOverlays?.() || {});
    syncOverviewPrefs(window.EQAppBridge?.getOverviewPrefs?.() || {});
  }
}

function serializeUser(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || "",
    displayName: u.displayName || "",
    photoURL: u.photoURL || "",
    emailVerified: Boolean(u.emailVerified),
  };
}

async function syncWatchlist(list) {
  const user = authState.user;
  if (!user) return;
  if (!authState.docHydrated) {
    authState.pendingSync = true;
    return;
  }
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { uid: user.uid, watchlist: sanitizeWatchlist(list), updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("[EQAuth] Watchlist sync failed:", err?.message || err);
  }
}

async function syncChartOverlays(overlays) {
  const user = authState.user;
  if (!user) return;
  if (!authState.docHydrated) {
    authState.pendingSync = true;
    return;
  }
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { uid: user.uid, chartOverlays: sanitizeOverlays(overlays), updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("[EQAuth] Chart overlays sync failed:", err?.message || err);
  }
}

async function syncOverviewPrefs(prefs) {
  const user = authState.user;
  if (!user) return;
  if (!authState.docHydrated) {
    authState.pendingSync = true;
    return;
  }
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { uid: user.uid, overviewPrefs: sanitizeOverviewPrefs(prefs), updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("[EQAuth] Overview prefs sync failed:", err?.message || err);
  }
}

function openAuthModal(preferredMode) {
  const modal = $("authModal");
  if (!modal) return;
  authState.deleteConfirmOpen = false;
  if (preferredMode === "personalize") {
    authState.prevMode = authState.user ? "account" : "login";
    authState.mode = "personalize";
  } else if (authState.user) {
    authState.mode = "account";
  } else {
    authState.mode = preferredMode && ["login", "signup", "forgot"].includes(preferredMode) ? preferredMode : "login";
  }
  renderAuthModalContent();
  modal.classList.remove("hidden");
  try {
    history.pushState({ ...(history.state || {}), overlay: "auth" }, "", location.href);
  } catch {}
}

function closeAuthModal() {
  const modal = $("authModal");
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  if (authState.resetTimer) {
    clearInterval(authState.resetTimer);
    authState.resetTimer = null;
  }
}

function initAuthUI() {
  $("userAccountBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openAuthModal(authState.user ? "account" : "login");
  });

  $("authModalBackdrop")?.addEventListener("click", closeAuthModal);

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && $("authModal") && !$("authModal").classList.contains("hidden")) {
      closeAuthModal();
    }
  });

  window.addEventListener("popstate", () => {
    if ($("authModal") && !$("authModal").classList.contains("hidden")) {
      closeAuthModal();
    }
  });

  updateTopbarAccountPill();

  // Complete any redirect-based Google sign-in seamlessly
  getRedirectResult(auth)
    .then((res) => {
      if (res?.user) {
        window.EQAppBridge?.showToast?.("Signed in with Google · Cloud synced");
      }
    })
    .catch((err) => {
      if (err && err.code !== "auth/popup-closed-by-user") {
        console.warn("[EQAuth] Redirect sign-in warning:", err.message || err);
      }
    });

  onAuthStateChanged(auth, async (user) => {
    authState.user = user || null;
    authState.ready = true;
    updateTopbarAccountPill();

    if (user) {
      window.EQAppBridge?.applyCloudState?.({ user: serializeUser(user) });
      await hydrateAndSubscribeUserDoc(user, authState.pendingSignupName);
    } else {
      cleanupFirestoreSub();
      window.EQAppBridge?.applyCloudState?.({ user: null });
    }
  });
}

window.EQAuth = {
  open: openAuthModal,
  close: closeAuthModal,
  getUser: () => serializeUser(authState.user),
  syncWatchlist,
  syncChartOverlays,
  syncOverviewPrefs,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthUI);
} else {
  initAuthUI();
}
