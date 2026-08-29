export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - CareFlow Clinic Management</title>
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .card {
      background: var(--card);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    h1 {
      color: var(--primary-dark);
      font-size: 2rem;
      margin-top: 0;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
    }
    h2 {
      color: var(--primary);
      font-size: 1.3rem;
      margin-top: 28px;
    }
    p, li {
      color: var(--muted);
      font-size: 1rem;
    }
    ul {
      padding-left: 24px;
    }
    .badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.85rem;
      margin-bottom: 16px;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 0.875rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <span class="badge">CareFlow Privacy Policy</span>
      <h1>Privacy Policy for CareFlow Clinic</h1>
      <p><em>Last Updated: August 2026</em></p>
      
      <p>CareFlow ("we", "our", or "us") is dedicated to protecting the privacy and confidentiality of healthcare providers and patients using our Clinic Management application.</p>

      <h2>1. Information We Collect and Local Data Storage</h2>
      <p>CareFlow operates primarily as a desktop application. Patient records, medical prescriptions, laboratory orders, and financial invoices are stored locally on your device in an encrypted/secured SQLite database.</p>

      <h2>2. Google Drive Integration & Data Usage</h2>
      <p>CareFlow offers an optional Cloud Backup feature via Google Drive. When you choose to connect your Google Account:</p>
      <ul>
        <li><strong>Scope of Access:</strong> We request limited access (<code>drive.file</code>) which only grants permission to read and write files specifically created by CareFlow inside your Google Drive account.</li>
        <li><strong>CareFlow Backups Folder:</strong> CareFlow automatically creates a designated <code>CareFlow Backups</code> folder in your personal Google Drive to upload encrypted clinic database ZIP archives.</li>
        <li><strong>No Third-Party Access:</strong> Your backup files remain entirely private to your Google Account. We do not sell, transfer, or share your Google user data or medical records with any third parties or advertisers.</li>
      </ul>

      <h2>3. Data Protection and Security</h2>
      <p>We employ industry-standard OAuth 2.0 PKCE authentication for Google integrations. Your authentication tokens are stored securely on your local device. CareFlow staff never have access to your personal Google Drive contents or your local clinic database records.</p>

      <h2>4. User Rights and Controls</h2>
      <p>You maintain full ownership of your data at all times. You may disconnect Google Drive integration at any time directly from CareFlow Settings or by revoking access through your Google Account Security Permissions page.</p>

      <h2>5. Contact Us</h2>
      <p>If you have any questions or concerns regarding this Privacy Policy or your data privacy, please contact us at:</p>
      <p><strong>Email:</strong> careflow.support@gmail.com<br/>
      <strong>Support Website:</strong> <a href="https://careflow-flame.vercel.app">careflow-flame.vercel.app</a></p>
    </div>
    <div class="footer">
      &copy; 2026 CareFlow Clinic Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`);
}
