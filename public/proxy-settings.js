"use strict";

const settingsEl = document.getElementById("custom-settings");

const notifyAndReload = (msg = "Saved!") => {
  alert(msg);
  window.location.reload();
};

async function renderSettings() {
  const user = window.Clerk.user;
  if (!user) {
    settingsEl.innerHTML = `<div class="card"><div class="title">Not signed in</div><a href="/sign-in" class="btn">Sign In</a></div>`;
    return;
  }

  // 1. Cleanup: Silently remove any failed/unverified SSO attempts from Clerk's side
  const unverifiedAccounts = user.externalAccounts.filter(acc => acc.verification.status !== 'verified');
  if (unverifiedAccounts.length > 0) {
    for (const acc of unverifiedAccounts) {
      try { await acc.destroy(); } catch (e) { /* already gone */ }
    }
  }

  // 2. Identify active login methods
  const hasPassword = user.passwordEnabled;
  const verifiedAccounts = user.externalAccounts.filter(acc => acc.verification.status === 'verified');
  const emailAddresses = user.emailAddresses;
  
  // Logic for Last Login Method Protection
  const totalMethods = verifiedAccounts.length + (hasPassword ? 1 : 0);
  const canDisconnect = totalMethods > 1;

  const googleAccount = verifiedAccounts.find(acc => acc.provider === 'google');
  const githubAccount = verifiedAccounts.find(acc => acc.provider === 'github');

  settingsEl.innerHTML = `
    <div class="card">
      <div class="title">Profile Image</div>
      <div class="profile-upload-area">
        <img id="pfp-preview" class="avatar" src="${user.imageUrl}" />
        <div class="file-input-wrapper">
          <button class="custom-file-btn" id="file-btn-text">Choose New Photo</button>
          <input type="file" id="pfp-upload" accept="image/*">
        </div>
        <button id="pfp-save" class="btn-primary" style="display:none;">Update Avatar</button>
      </div>
    </div>

    <div class="card">
      <div class="title">Personal Information</div>
      <div class="input-group">
        <div class="section-label">First Name</div>
        <input id="first-name" value="${user.firstName || ""}" placeholder="First Name">
      </div>
      <div class="input-group">
        <div class="section-label">Last Name</div>
        <input id="last-name" value="${user.lastName || ""}" placeholder="Last Name">
      </div>
      <div class="input-group">
        <div class="section-label">Username</div>
        <input id="username" value="${user.username || ""}" placeholder="Username">
      </div>
      <button id="save-account" class="btn-primary">Save Profile</button>
    </div>

    <div class="card">
      <div class="title">Email Addresses</div>
      ${emailAddresses.map(email => `
        <div class="sso-badge">
            <div>
                <span>${email.emailAddress}</span>
                <span class="status-tag ${email.verification.status === 'verified' ? 'status-connected' : 'status-disconnected'}">
                ${email.verification.status}
                </span>
            </div>
            ${emailAddresses.length > 1 ? `<button class="btn-danger" onclick="removeEmail('${email.id}')">Remove</button>` : ''}
        </div>
      `).join('')}
      
      <div class="input-group" style="margin-top:1rem;">
        <div class="section-label">Add Email Address</div>
        <input id="new-email" type="email" placeholder="new-email@example.com">
        <button id="add-email-btn" class="btn-primary">Add Email</button>
      </div>
      <div id="email-verify-area" style="display:none; margin-top:1rem;">
        <div class="section-label">Enter Verification Code</div>
        <input id="email-code" placeholder="123456">
        <button id="verify-email-btn" class="btn-primary">Verify & Add</button>
      </div>
    </div>

    <div class="card">
      <div class="title">${hasPassword ? 'Change Password' : 'Set Password'}</div>
      ${hasPassword ? `
        <div class="input-group">
          <div class="section-label">Current Password</div>
          <input id="curr-pass" type="password">
        </div>
      ` : `<p style="font-size:0.8rem; opacity:0.7; margin-bottom:1rem;">You are currently using SSO. Set a password to enable email/password login.</p>`}
      <div class="input-group">
        <div class="section-label">New Password</div>
        <input id="new-pass" type="password">
      </div>
      <button id="update-pass-btn" class="btn-primary">${hasPassword ? 'Update Password' : 'Set Password'}</button>
    </div>

    <div class="card">
      <div class="title">Connected Accounts</div>
      <div class="sso-badge">
        <div>
          <span>Google</span>
          <span class="status-tag ${googleAccount ? 'status-connected' : 'status-disconnected'}">${googleAccount ? 'Connected' : 'Disconnected'}</span>
        </div>
        ${googleAccount 
          ? `<button class="btn-danger" ${!canDisconnect ? 'disabled' : ''} onclick="unlinkAccount('${googleAccount.id}')">Disconnect</button>` 
          : `<button onclick="linkAccount('oauth_google')">Connect</button>`}
      </div>
      <div class="sso-badge">
        <div>
          <span>GitHub</span>
          <span class="status-tag ${githubAccount ? 'status-connected' : 'status-disconnected'}">${githubAccount ? 'Connected' : 'Disconnected'}</span>
        </div>
        ${githubAccount 
          ? `<button class="btn-danger" ${!canDisconnect ? 'disabled' : ''} onclick="unlinkAccount('${githubAccount.id}')">Disconnect</button>` 
          : `<button onclick="linkAccount('oauth_github')">Connect</button>`}
      </div>
      ${!canDisconnect ? `<p style="font-size: 0.7rem; color: #ff3b30; margin-top: 10px;">Note: You cannot disconnect your only login method.</p>` : ''}
    </div>

    <div class="card">
      <div class="title">Session</div>
      <button id="sign-out" style="width:100%">Sign Out</button>
    </div>

    <div class="card" style="border-color: rgba(255,59,48,0.2)">
      <div class="title" style="color: #ff3b30">Danger Zone</div>
      <button id="delete-account" class="btn-danger" style="width:100%">Delete Account</button>
    </div>
  `;

  setupEventListeners(user);
}

function setupEventListeners(user) {
  // --- Profile Image ---
  const pfpUpload = document.getElementById("pfp-upload");
  const pfpSave = document.getElementById("pfp-save");
  if(pfpUpload) {
    pfpUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          document.getElementById("file-btn-text").innerText = `Selected: ${file.name}`;
          pfpSave.style.display = "block";
          const reader = new FileReader();
          reader.onload = (ev) => { document.getElementById("pfp-preview").src = ev.target.result; };
          reader.readAsDataURL(file);
        }
      };
  }
  
  pfpSave.onclick = async () => {
    try {
      await user.setProfileImage({ file: pfpUpload.files[0] });
      notifyAndReload("Image updated!");
    } catch (err) { alert(err.errors[0].message); }
  };

  // --- Profile Details ---
  document.getElementById("save-account").onclick = async () => {
    try {
      await user.update({
        firstName: document.getElementById("first-name").value,
        lastName: document.getElementById("last-name").value,
        username: document.getElementById("username").value
      });
      notifyAndReload("Profile updated!");
    } catch (err) { alert(err.errors[0].message); }
  };

  // --- Password Logic ---
  document.getElementById("update-pass-btn").onclick = async () => {
    const newPassword = document.getElementById("new-pass").value;
    const currentPassword = document.getElementById("curr-pass")?.value;
    try {
      if (user.passwordEnabled) {
        await user.updatePassword({ currentPassword, newPassword });
      } else {
        await user.update({ password: newPassword });
      }
      notifyAndReload("Password updated!");
    } catch (err) { alert("Password Error: " + err.errors[0].message); }
  };

  // --- Email Logic ---
  let pendingEmail;
  document.getElementById("add-email-btn").onclick = async () => {
    const email = document.getElementById("new-email").value;
    try {
      pendingEmail = await user.createEmailAddress({ email });
      await pendingEmail.prepareVerification({ strategy: "email_code" });
      document.getElementById("email-verify-area").style.display = "block";
      alert("Verification code sent!");
    } catch (err) { alert(err.errors[0].message); }
  };

  document.getElementById("verify-email-btn").onclick = async () => {
    const code = document.getElementById("email-code").value;
    try {
      await pendingEmail.attemptVerification({ code });
      notifyAndReload("Email verified!");
    } catch (err) { alert("Verification failed: " + err.errors[0].message); }
  };

  // --- General ---
  document.getElementById("sign-out").onclick = () => window.Clerk.signOut(() => window.location.href = "/");
  document.getElementById("delete-account").onclick = async () => {
    if (confirm("Permanently delete account?")) {
      await user.delete();
      window.location.href = "/";
    }
  };
}

// Global scope helpers
window.removeEmail = async (id) => {
  if (confirm("Remove this email?")) {
    try {
      const email = window.Clerk.user.emailAddresses.find(e => e.id === id);
      await email.destroy();
      notifyAndReload("Email removed.");
    } catch (err) { alert(err.errors[0].message); }
  }
};

window.linkAccount = async (strategy) => {
  try {
    const res = await window.Clerk.user.createExternalAccount({ 
      strategy, 
      redirect_url: window.location.href 
    });
    if (res.verification.externalVerificationRedirectURL) {
        window.location.href = res.verification.externalVerificationRedirectURL.href;
    }
  } catch (err) { alert(err.errors[0].message); }
};

window.unlinkAccount = async (id) => {
  if (confirm("Disconnect this provider?")) {
    try {
      const account = window.Clerk.user.externalAccounts.find(a => a.id === id);
      await account.destroy();
      notifyAndReload("Disconnected.");
    } catch (err) { alert(err.errors[0].message); }
  }
};

// Initialization
window.addEventListener("load", () => {
  window.Clerk.load().then(() => {
    renderSettings();
  });
});