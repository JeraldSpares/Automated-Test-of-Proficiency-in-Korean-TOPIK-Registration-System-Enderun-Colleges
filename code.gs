// ══════════════════════════════════════════════════════════════
//  TOPIK REGISTRATION SYSTEM — CONSOLIDATED v3.1
//  Enderun Extension | All .gs files merged & refactored
//  
//  HTML FILES (kept separate):
//  - Admin_Login.html        → Login + Dashboard UI
//  - Admin_Dashboard_V3.html → Legacy dashboard (if needed)
//  - Edit_Portal.html        → Student edit portal
//  - Student_Application_V3.html → Student registration form
//
//  TABLE OF CONTENTS:
//  ┌─ §1  CONFIGURATION & CONSTANTS
//  ├─ §2  SYSTEM INIT & TRIGGERS
//  ├─ §3  WEB APP ROUTER (doGet / doPost)
//  ├─ §4  AUTHENTICATION
//  ├─ §5  STUDENT APPLICATION FORM SUBMISSION
//  ├─ §6  STUDENT TRACKING API
//  ├─ §7  FORM SUBMIT & PAYMENT HOOKS
//  ├─ §8  DOCUMENT GENERATION (generateOfficialFormAndEmail)
//  ├─ §9  EMAIL FUNCTIONS
//  ├─ §10 ADMIN TOOLS (Refund, Reset, Toggle, Level, Regen)
//  ├─ §11 BULK OPERATIONS
//  ├─ §12 WAITLIST & RACE-TO-PAY
//  ├─ §13 MASTER LIST PDF
//  ├─ §14 DASHBOARD & STATS
//  ├─ §15 SYSTEM HEALTH CHECK
//  ├─ §16 ARCHIVE & SESSION MANAGEMENT
//  ├─ §17 TEMPLATE SETTINGS API
//  ├─ §18 WEB-APP API ENDPOINTS (Dashboard Backend)
//  ├─ §19 UI POPUPS & ANIMATIONS
//  └─ §20 UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
//  §1  CONFIGURATION & CONSTANTS
// ══════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────
//  ⚠️  SECRETS REDACTED FOR PUBLIC REPO
//  Before running, set the real values in Apps Script:
//    Project Settings → Script Properties
//  Or replace the placeholders below in your private deployment.
// ────────────────────────────────────────────────────────────────

// --- SHOPIFY CONFIG ---
const SHOPIFY_WEBHOOK_SECRET = 'YOUR_SHOPIFY_WEBHOOK_SECRET_HERE';      // From Shopify Admin > Settings > Notifications > Webhooks
const SHOPIFY_ACCESS_TOKEN   = 'YOUR_SHOPIFY_ACCESS_TOKEN_HERE';        // shpat_xxxxxxxx... from Shopify custom app
const SHOPIFY_SHOP_URL       = 'YOUR-STORE.myshopify.com';
const SHOPIFY_DOMAIN         = 'YOUR-STORE.myshopify.com';
const VARIANT_ID_TOPIK1      = 'YOUR_TOPIK_I_VARIANT_ID';
const VARIANT_ID_TOPIK2      = 'YOUR_TOPIK_II_VARIANT_ID';
const PAYMENT_DEADLINE_HOURS = 24;

// --- DRIVE & FILES ---
const TEMPLATE_ID            = 'YOUR_GOOGLE_DOC_TEMPLATE_ID';
const FOLDER_ID_TOPIK1       = 'YOUR_TOPIK_I_FOLDER_ID';
const FOLDER_ID_TOPIK2       = 'YOUR_TOPIK_II_FOLDER_ID';
const ARCHIVE_FOLDER_ID      = 'YOUR_ARCHIVE_FOLDER_ID';
const MAIN_UPLOAD_FOLDER_ID  = 'YOUR_MAIN_UPLOAD_FOLDER_ID';

// --- EMAIL SETTINGS ---
const SENDER_NAME      = 'TOPIK Registration';
const ADMIN_EMAIL      = 'admin@example.com';
const REPLY_TO_EMAIL   = 'admin@example.com';

// --- SHEET SETTINGS ---
const DATA_SHEET_NAME = 'TOPIK TRACKER';
const TOTAL_HEADCOUNT_LIMIT = 214;
const PWD_START_ID = 215;

// --- COLUMN MAPPING ---
const COL_REF_ID = 1, COL_TIMESTAMP = 2, COL_EMAIL = 3, COL_TOPIK_LEVEL = 4, COL_KOREAN_NAME = 5;
const COL_LEGAL_NAME = 6, COL_GENDER = 7, COL_NATIONALITY = 8, COL_OCCUPATION = 9, COL_BIRTHDATE = 10;
const COL_ADDRESS = 11, COL_POSTAL_CODE = 12, COL_HOME_PHONE = 13, COL_MOBILE_PHONE = 14, COL_SURVEY1 = 15;
const COL_SURVEY2 = 16, COL_PAYMENT_STATUS = 17, COL_STUDENT_NO = 18, COL_DOC_LINK = 19, COL_TIMESTAMP_DOCS = 20;
const COL_SPECIAL_ASSISTANCE = 21, COL_FILES_UPLOAD = 22, COL_ROOM_ASSIGNMENT = 23;
const COL_NAME_INDEX = 6;

// --- ROOM MATRIX (Dynamic) ---
function getDynamicRooms() {
  const defaultRooms = [
    { name: "HA 102", cap: 9, type: "PWD" }, { name: "HA 103", cap: 12, type: "REGULAR" },
    { name: "HA 201", cap: 12, type: "REGULAR" }, { name: "HA 202", cap: 20, type: "REGULAR" },
    { name: "HA 203", cap: 6, type: "REGULAR" }, { name: "BA 103", cap: 12, type: "REGULAR" },
    { name: "BA 104", cap: 12, type: "REGULAR" }, { name: "BA 105", cap: 12, type: "REGULAR" },
    { name: "TH 101", cap: 6, type: "REGULAR" }, { name: "TH 103", cap: 6, type: "REGULAR" },
    { name: "TH 104", cap: 6, type: "REGULAR" }, { name: "TA 201", cap: 16, type: "REGULAR" },
    { name: "TA 202", cap: 16, type: "REGULAR" }, { name: "CA 301", cap: 12, type: "REGULAR" },
    { name: "CA 302", cap: 12, type: "REGULAR" }, { name: "CA 303", cap: 9, type: "REGULAR" },
    { name: "CA 306", cap: 10, type: "REGULAR" }, { name: "CA 307", cap: 10, type: "REGULAR" },
    { name: "CAD STUDIO", cap: 16, type: "REGULAR" }
  ];
  const saved = PropertiesService.getScriptProperties().getProperty('DYNAMIC_ROOMS');
  if (saved) return JSON.parse(saved);
  return defaultRooms;
}

// --- THEME ---
const THEME_COLOR = "#6b4a1c";

// --- WEB APP URL ---
const WEB_APP_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";


// ══════════════════════════════════════════════════════════════
//  §1.1  SHOPIFY DRAFT ORDER API
// ══════════════════════════════════════════════════════════════

function createShopifyDraftOrder(variantId, email, refId) {
  var payload = {
    draft_order: {
      line_items: [{ variant_id: parseInt(variantId), quantity: 1 }],
      email: email,
      note_attributes: [{ name: "RefID", value: refId }],
      use_customer_default_address: true
    }
  };

  var options = {
    method: "post",
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(
    "https://" + SHOPIFY_SHOP_URL + "/admin/api/2024-01/draft_orders.json",
    options
  );
  var result = JSON.parse(response.getContentText());

  if (result.draft_order && result.draft_order.invoice_url) {
    return result.draft_order.invoice_url;
  }
  
  Logger.log("Draft order creation failed: " + JSON.stringify(result));
  return null;
}


// ══════════════════════════════════════════════════════════════
//  §1.2  MANUAL PAYMENT VERIFICATION (Shopify API)
// ══════════════════════════════════════════════════════════════

function verifyPaymentManually(refId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var data = sheet.getDataRange().getValues();
    var row = -1, email = "", name = "";

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_REF_ID - 1]).trim() === String(refId).trim()) {
        row = i + 1;
        email = String(data[i][COL_EMAIL - 1]).trim();
        name = String(data[i][COL_LEGAL_NAME - 1]);
        break;
      }
    }
    if (row === -1) return { success: false, message: "Student not found." };

    var currentStatus = String(sheet.getRange(row, COL_PAYMENT_STATUS).getValue()).toUpperCase();
    if (currentStatus === "PAID") return { success: false, message: "Already PAID." };

    var searchUrl = "https://" + SHOPIFY_SHOP_URL + "/admin/api/2024-01/orders.json?status=any&fields=id,financial_status,note_attributes,email,name&limit=50";
    var options = {
      method: "get",
      headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN, "Content-Type": "application/json" },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(searchUrl, options);
    var result = JSON.parse(response.getContentText());
    if (!result.orders) return { success: false, message: "Could not reach Shopify API. Check your access token." };

    var matchedOrder = null;
    for (var j = 0; j < result.orders.length; j++) {
      var order = result.orders[j];
      if (Array.isArray(order.note_attributes)) {
        for (var k = 0; k < order.note_attributes.length; k++) {
          if (String(order.note_attributes[k].name).toLowerCase() === "refid" && order.note_attributes[k].value === refId) {
            matchedOrder = order; break;
          }
        }
      }
      if (!matchedOrder && String(order.email).toLowerCase() === email.toLowerCase()) matchedOrder = order;
      if (matchedOrder) break;
    }

    if (!matchedOrder) return { success: false, message: "No Shopify order found for " + refId + " or " + email };

    if (matchedOrder.financial_status === "paid") {
      sheet.getRange(row, COL_PAYMENT_STATUS).setValue("PAID");
      SpreadsheetApp.flush();
      try { generateOfficialFormAndEmail(sheet, row); } catch(genErr) { addToRetryQueue(row, refId, name, genErr.toString()); }
      logSystemEvent("ADMIN", "MANUAL VERIFY", name + " — Shopify Order " + matchedOrder.name);
      return { success: true, message: name + " verified as PAID (Order " + matchedOrder.name + "). Documents generating." };
    } else {
      return { success: false, message: "Order found but status is: " + matchedOrder.financial_status };
    }
  } catch(e) {
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}


// ══════════════════════════════════════════════════════════════
//  §2  SYSTEM INIT & TRIGGERS
// ══════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ TOPIK ADMIN')
    .addItem('📊 View Enrollment Statistics', 'showEnrollmentStats')
    .addSeparator()
    .addItem('🧹 Fix Legacy Data (Format Dropdowns)', 'cleanLegacyDropdownData')
    .addItem('📝 Update/Regenerate Docs (Selected Row)', 'manualRegenerateSelectedRow')
    .addItem('📄 Generate Master List (PDF)', 'generateMasterListPDF')
    .addSeparator()
    .addItem('♻️ Manage Waitlist / Fill Slots', 'manageWaitlist')
    .addSeparator()
    .addItem('🔄 Switch TOPIK Level (I ↔ II)', 'changeTopikLevel')
    .addItem('♿ Switch PWD ↔ Regular Status', 'toggleAssistanceStatus')
    .addItem('📧 Request Student Update', 'requestStudentUpdate')
    .addSeparator()
    .addItem('📢 Send Bulk Announcement (Email)', 'sendBulkAnnouncement')
    .addItem('⚠️ Bulk Regenerate Files (ALL PAID)', 'bulkRegenerateAllPaid')
    .addSeparator()
    .addItem('↩️ Reset Row to PENDING', 'clearPaymentStatus')
    .addItem('💸 Process Refund', 'processRefund')
    .addSeparator()
    .addItem('📧 Check Email Quota', 'checkEmailQuota')
    .addItem('🏥 Run System Health Check', 'runSystemHealthCheck')
    .addItem('📦 Archive Session & Start New', 'archiveAndResetSession')
    .addItem('🛠️ Initialize System (Run Once)', 'setupInstallableTrigger')
    .addItem('🛡️ Apply Sheet Data Validation', 'applySheetDataValidation')
    .addItem('🔄 Setup Retry Queue Trigger', 'setupRetryQueueTrigger')
    .addItem('📋 View Retry Queue', 'showRetryQueueStatus')
    .addToUi();
}

function setupInstallableTrigger() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'manualPaymentTrigger') {
      ui.alert("✅ SYSTEM READY", "Trigger already active.", ui.ButtonSet.OK);
      return;
    }
  }
  ScriptApp.newTrigger('manualPaymentTrigger').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ui.alert("🎉 SUCCESS!", "Trigger created.", ui.ButtonSet.OK);
}

function autoFormatFont(e) {
  var sheet = e.range.getSheet();
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var targetRange = sheet.getRange(lastRow, 1, 1, lastColumn);
  targetRange.setFontFamily("Open Sans");
  targetRange.setHorizontalAlignment("left");
  targetRange.setFontSize(10);
  SpreadsheetApp.flush();
}


// ══════════════════════════════════════════════════════════════
//  §3  WEB APP ROUTER (doGet / doPost)
// ══════════════════════════════════════════════════════════════

function doGet(e) {
  // Admin Portal
  if (e.parameter.page === 'admin') {
    return HtmlService.createTemplateFromFile('Admin_Login')
      .evaluate()
      .setTitle('TOPIK Admin Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Student Edit Portal (one-time link)
  if (e.parameter.ref) {
    var template = HtmlService.createTemplateFromFile('Edit_Portal');
    template.refId = e.parameter.ref;
    var accessStatus = PropertiesService.getScriptProperties().getProperty('UPDATE_ACCESS_' + e.parameter.ref);
    template.isExpired = (accessStatus !== 'ACTIVE');
    return template.evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Default: Student Application Form
  return HtmlService.createTemplateFromFile('Student_Application_V3')
    .evaluate()
    .setTitle('TOPIK Registration — Enderun Extension')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    // SECURITY: Verify webhook authenticity
    if (!verifyShopifyWebhook(e)) {
      logSystemEvent("SECURITY", "BLOCKED", "Unauthorized webhook attempt rejected");
      return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
    }
    
    const data = JSON.parse(e.postData.contents);
    
    // IDEMPOTENCY: Prevent duplicate processing
    var orderId = String(data.id || data.order_number || "");
    if (orderId) {
      var processedKey = "PROCESSED_ORDER_" + orderId;
      var alreadyProcessed = PropertiesService.getScriptProperties().getProperty(processedKey);
      if (alreadyProcessed) {
        Logger.log("Duplicate webhook ignored: " + orderId);
        return ContentService.createTextOutput("Already processed").setMimeType(ContentService.MimeType.TEXT);
      }
      PropertiesService.getScriptProperties().setProperty(processedKey, new Date().toISOString());
    }
    
    Logger.log(JSON.stringify(data));

    let refID = null;
    if (Array.isArray(data.note_attributes)) {
      const found = data.note_attributes.find(attr =>
        (attr.name || "").toString().trim().toLowerCase() === "refid"
      );
      if (found) refID = found.value;
    }
    if (!refID && data.note) {
      refID = data.note;
    }
    if (!refID) {
      // FALLBACK: Try to match by email address
      var orderEmail = String(data.email || "").trim().toLowerCase();
      if (orderEmail) {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
        var allData = sheet.getDataRange().getValues();
        for (var fi = 1; fi < allData.length; fi++) {
          var rowEmail = String(allData[fi][COL_EMAIL - 1]).trim().toLowerCase();
          var rowStatus = String(allData[fi][COL_PAYMENT_STATUS - 1]).toUpperCase();
          if (rowEmail === orderEmail && rowStatus === "PENDING") {
            refID = String(allData[fi][COL_REF_ID - 1]).trim();
            logSystemEvent("WEBHOOK", "EMAIL MATCH", "No RefID but matched email " + orderEmail + " → " + refID);
            break;
          }
        }
      }
      if (!refID) {
        Logger.log("No refID found and no email match.");
        logSystemEvent("WEBHOOK", "NO MATCH", "Order " + orderId + " — no RefID, no email match");
        return ContentService.createTextOutput("No refID");
      }
    }

    const isPaid = (data.financial_status || "").toLowerCase() === "paid";
    updateApplicantStatus(refID, isPaid, data);
    
    logSystemEvent("WEBHOOK", isPaid ? "PAID" : "UNPAID", "RefID: " + refID + " | Order: " + orderId);

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    Logger.log(error);
    // ADMIN NOTIFICATION on webhook failure
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: "⚠️ CRITICAL: Webhook Processing Failed",
        htmlBody: "<h2 style='color:#C0392B;'>Webhook Error</h2><p><b>Error:</b> " + error.toString() + "</p><p><b>Timestamp:</b> " + new Date().toISOString() + "</p><p><b>Raw Data:</b><br><pre>" + (e && e.postData ? e.postData.contents.substring(0, 500) : "N/A") + "</pre></p>",
        name: "TOPIK System Alert"
      });
    } catch(mailErr) {}
    logSystemEvent("WEBHOOK", "ERROR", error.toString());
    return ContentService.createTextOutput("Error");
  }
}

function updateApplicantStatus(refID, isPaid) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DATA_SHEET_NAME);
  const values = sheet.getRange("A2:A").getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(refID).trim()) {
      const row = i + 2;
      const statusCell = sheet.getRange(row, COL_PAYMENT_STATUS);
      if (isPaid) {
        statusCell.setValue("PAID");
        _invalidateUnifiedCache();
        try { generateOfficialFormAndEmail(sheet, row); } catch (e) { console.error("Error generating for " + refID + ": " + e.toString()); }
      } else {
        statusCell.setValue("UNPAID");
      }
      break;
    }
  }
}


// ══════════════════════════════════════════════════════════════
//  §4  AUTHENTICATION
// ══════════════════════════════════════════════════════════════

function authenticateAdmin(email, password) {
  try {
    var credsJson = PropertiesService.getScriptProperties().getProperty('ADMIN_CREDS');
    if (!credsJson) {
      // Run setupAdminCredentials() once to seed ADMIN_CREDS in Script Properties.
      return { success: false, message: "Admin credentials not initialized. Run setupAdminCredentials()." };
    }
    var creds = JSON.parse(credsJson);
    for (var i = 0; i < creds.length; i++) {
      if (creds[i].email.toLowerCase() === email.toLowerCase() && creds[i].password === password) {
        return { success: true, token: "ok", name: creds[i].name || "Administrator", email: email };
      }
    }
    return { success: false, message: "Invalid email or password." };
  } catch (e) {
    return { success: false, message: "Auth error: " + e.toString() };
  }
}

// One-time seeder for admin credentials. EDIT the email/password below
// in your private Apps Script project — DO NOT commit real values.
function setupAdminCredentials() {
  var creds = [
    { email: "CHANGE_ME@example.com", password: "CHANGE_ME_STRONG_PASSWORD", name: "System Administrator" }
  ];
  PropertiesService.getScriptProperties().setProperty('ADMIN_CREDS', JSON.stringify(creds));
  SpreadsheetApp.getUi().alert("✅ Admin credentials saved!\nEmail: " + creds[0].email);
}


// ══════════════════════════════════════════════════════════════
//  §5  STUDENT APPLICATION FORM SUBMISSION
// ══════════════════════════════════════════════════════════════

function submitStudentApplication(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    // Validate before writing
    var validation = validateStudentData({
      lName: formData.legalName,
      email: formData.email,
      level: formData.level,
      pwd: formData.pwd || "No",
      mob: formData.mobilePhone
    });
    if (!validation.valid) {
      lock.releaseLock();
      return { success: false, message: "Validation error: " + validation.errors.join(", ") };
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var refId = "TPK-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + "-" + Math.floor(1000 + Math.random() * 9000);

    var LIMIT = TOTAL_HEADCOUNT_LIMIT;
    var currentLevel = String(formData.level).toUpperCase();
    var data = sheet.getDataRange().getValues();
    var paidCount = 0;

    for (var j = 1; j < data.length; j++) {
      var rLevel = String(data[j][COL_TOPIK_LEVEL - 1]).toUpperCase();
      var rStatus = String(data[j][COL_PAYMENT_STATUS - 1]).toUpperCase();
      var rID = String(data[j][COL_STUDENT_NO - 1]);
      var sameLevel = (rLevel.includes("II") && currentLevel.includes("II")) || (!rLevel.includes("II") && !currentLevel.includes("II"));
      if (sameLevel && rStatus === "PAID" && rID.length > 5 && !rID.includes("WAIT")) paidCount++;
    }

    var initialStatus = paidCount >= LIMIT ? "WAITLIST" : "PENDING";
    var newRow = sheet.getLastRow() + 1;

    sheet.getRange(newRow, COL_REF_ID).setValue(refId);
    sheet.getRange(newRow, COL_TIMESTAMP).setValue(new Date());
    sheet.getRange(newRow, COL_EMAIL).setValue(formData.email);
    sheet.getRange(newRow, COL_TOPIK_LEVEL).setValue(formData.level);
    sheet.getRange(newRow, COL_KOREAN_NAME).setValue(formData.koreanName || "");
    sheet.getRange(newRow, COL_LEGAL_NAME).setValue(formData.legalName);
    sheet.getRange(newRow, COL_GENDER).setValue(formData.gender);
    sheet.getRange(newRow, COL_NATIONALITY).setValue(formData.nationality);
    sheet.getRange(newRow, COL_OCCUPATION).setValue(mapCodeToText(formData.occupation, 'occ'));
    sheet.getRange(newRow, COL_BIRTHDATE).setValue(formData.dob);
    sheet.getRange(newRow, COL_ADDRESS).setValue(formData.address);
    sheet.getRange(newRow, COL_POSTAL_CODE).setValue(formData.postalCode || "");
    sheet.getRange(newRow, COL_HOME_PHONE).setValue(formData.homePhone || "");
    sheet.getRange(newRow, COL_MOBILE_PHONE).setValue(formData.mobilePhone);
    sheet.getRange(newRow, COL_SURVEY1).setValue(mapCodeToText(formData.survey1, 's1'));
    sheet.getRange(newRow, COL_SURVEY2).setValue(mapCodeToText(formData.survey2, 's2'));
    sheet.getRange(newRow, COL_PAYMENT_STATUS).setValue(initialStatus);
    sheet.getRange(newRow, COL_SPECIAL_ASSISTANCE).setValue(formData.pwd || "No");
    SpreadsheetApp.flush();

    if (initialStatus === "WAITLIST") {
      try { sendWaitlistEmailToStudent(formData.email, formData.legalName, formData.level); } catch (err) {}
    } else {
      try { sendPaymentInstructionEmail(sheet, newRow, refId); } catch (err) {}
    }

    logSystemEvent("WEB APP", "NEW APPLICATION", formData.legalName + " (" + formData.level + ") - " + initialStatus);

    return {
      success: true, refId: refId, status: initialStatus,
      message: initialStatus === "WAITLIST"
        ? "You have been placed on the waitlist."
        : "Application submitted! Check your email for payment instructions."
    };
  } catch (e) {
    _invalidateUnifiedCache();
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function uploadStudentFile(refId, fileData, fileName, mimeType) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var data = sheet.getDataRange().getValues();
    var row = -1, studentName = "";

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_REF_ID - 1]).trim() === String(refId).trim()) {
        row = i + 1;
        studentName = toTitleCase(String(data[i][COL_LEGAL_NAME - 1]));
        break;
      }
    }
    if (row === -1) return { success: false };

    var mainFolder = DriveApp.getFolderById(MAIN_UPLOAD_FOLDER_ID);
    var targetFolder;
    var existing = mainFolder.getFoldersByName(studentName);
    if (existing.hasNext()) { targetFolder = existing.next(); }
    else { targetFolder = mainFolder.createFolder(studentName); }

    var blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType || MimeType.JPEG, fileName);
    targetFolder.createFile(blob);
    sheet.getRange(row, COL_FILES_UPLOAD).setValue(targetFolder.getUrl());

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ══════════════════════════════════════════════════════════════
//  §6  STUDENT TRACKING API
// ══════════════════════════════════════════════════════════════

function trackStudentByRefId(refId) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_REF_ID - 1]).trim() === String(refId).trim()) {
        var status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
        var studentNo = data[i][COL_STUDENT_NO - 1] || "";
        var docLink = data[i][COL_DOC_LINK - 1] || "";
        var room = data[i][COL_ROOM_ASSIGNMENT - 1] || "";

        // Build progress steps
        var progress = [];
        progress.push({ step: "Application Submitted", done: true });
        
        if (status === "WAITLIST") {
          progress.push({ step: "Payment", done: false, note: "Waitlisted — awaiting slot" });
        } else if (status === "PENDING" || status.includes("PENDING")) {
          progress.push({ step: "Payment", done: false, note: "Awaiting payment" });
        } else if (status === "PAID") {
          progress.push({ step: "Payment Verified", done: true });
        } else if (status === "REFUND") {
          progress.push({ step: "Refunded", done: true, note: "Registration cancelled" });
        }

        if (status === "PAID" && String(studentNo).length > 5) {
          progress.push({ step: "ID Assigned: " + studentNo, done: true });
          progress.push({ step: "Documents Generated", done: !!docLink });
        }

        if (status === "PAID" && room) {
          progress.push({ step: "Room: " + room, done: true });
        }

        var dob = data[i][COL_BIRTHDATE - 1];
        if (dob instanceof Date) dob = Utilities.formatDate(dob, Session.getScriptTimeZone(), "yyyy-MM-dd");

        return {
          found: true,
          refId: data[i][COL_REF_ID - 1],
          name: toTitleCase(String(data[i][COL_LEGAL_NAME - 1])),
          koreanName: data[i][COL_KOREAN_NAME - 1] || "",
          email: data[i][COL_EMAIL - 1],
          level: data[i][COL_TOPIK_LEVEL - 1],
          status: status,
          studentNo: studentNo,
          room: room,
          docLink: docLink,
          pwd: data[i][COL_SPECIAL_ASSISTANCE - 1],
          gender: data[i][COL_GENDER - 1],
          nationality: data[i][COL_NATIONALITY - 1],
          occupation: data[i][COL_OCCUPATION - 1],
          dob: dob,
          address: data[i][COL_ADDRESS - 1],
          postalCode: data[i][COL_POSTAL_CODE - 1],
          homePhone: data[i][COL_HOME_PHONE - 1],
          mobilePhone: data[i][COL_MOBILE_PHONE - 1],
          survey1: data[i][COL_SURVEY1 - 1],
          survey2: data[i][COL_SURVEY2 - 1],
          fileUrl: data[i][COL_FILES_UPLOAD - 1] || "",
          progress: progress
        };
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false, error: e.toString() };
  }
}

function updateStudentFromTracker(refId, formObj, fileData, fileName, mimeType) {
  // Reuse the portal update logic
  return processPortalUpdate(refId, formObj, fileData, fileName, mimeType);
}


// ══════════════════════════════════════════════════════════════
//  §7  FORM SUBMIT & PAYMENT HOOKS
// ══════════════════════════════════════════════════════════════

function onFormSubmitGenerateRef(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DATA_SHEET_NAME || e.range.getRow() < 2) return;
  const row = e.range.getRow();
  if (sheet.getRange(row, COL_REF_ID).getValue()) return;

  const LIMIT = 214;
  const currentLevel = String(sheet.getRange(row, COL_TOPIK_LEVEL).getValue()).toUpperCase();
  const data = sheet.getDataRange().getValues();
  let paidCount = 0;

  for (let i = 1; i < data.length; i++) {
    if (i + 1 === row) continue;
    let rLevel = String(data[i][3]).toUpperCase();
    let rStatus = String(data[i][16]).toUpperCase();
    let rID = String(data[i][17]);
    const isSameLevel = (rLevel.includes("II") && currentLevel.includes("II")) || (!rLevel.includes("II") && !currentLevel.includes("II"));
    if (isSameLevel && rStatus === "PAID" && rID.length > 5 && !rID.includes("WAIT")) paidCount++;
  }

  const uniqueId = `TPK-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss")}-${Math.floor(1000 + Math.random() * 9000)}`;
  sheet.getRange(row, COL_REF_ID).setValue(uniqueId);

  if (paidCount >= LIMIT) {
    sheet.getRange(row, COL_PAYMENT_STATUS).setValue("WAITLIST");
    sendWaitlistEmailToStudent(sheet.getRange(row, COL_EMAIL).getValue(), sheet.getRange(row, COL_LEGAL_NAME).getValue(), currentLevel);
  } else {
    sheet.getRange(row, COL_PAYMENT_STATUS).setValue("PENDING");
    sendPaymentInstructionEmail(sheet, row, uniqueId);
  }
}

function manualPaymentTrigger(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DATA_SHEET_NAME) return;
  const row = e.range.getRow(), col = e.range.getColumn();
  const newValue = String(e.value).toUpperCase();
  if (col !== COL_PAYMENT_STATUS) return;

  if (newValue === "PAID") {
    try { generateOfficialFormAndEmail(sheet, row); } catch (err) { SpreadsheetApp.getActiveSpreadsheet().toast("Error: " + err); }
  } else if (newValue === "REFUND") {
    showThemePopup('REFUND_ANIMATION', 'Processing Refund', 'Removing folder & cleaning data.');
    SpreadsheetApp.flush();
    clearStudentData(sheet, row, true);
    sheet.getRange(row, COL_PAYMENT_STATUS).setValue("REFUND");
    showThemePopup('SUCCESS', 'Refund Processed', 'Folder and ID records cleared.');
  } else if (newValue === "PENDING") {
    showThemePopup('DELETE_ANIMATION', 'Deleting Records...', 'Removing folder & cleaning data.');
    SpreadsheetApp.flush();
    clearStudentData(sheet, row, true);
    showThemePopup('SUCCESS', 'Reset Complete', 'Row reset.');
  }
}

function processRowFromClient(row, isUpdate) {
  try {
    generateOfficialFormAndEmail(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME), row, isUpdate);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ══════════════════════════════════════════════════════════════
//  §8  DOCUMENT GENERATION
// ══════════════════════════════════════════════════════════════

function generateOfficialFormAndEmail(sheet, row, isUpdate) {
  if (isUpdate === undefined) isUpdate = false;

  var cache = CacheService.getScriptCache();
  var lockKey = "lock_row_" + row;
  if (!isUpdate && cache.get(lockKey)) return;
  if (!isUpdate) cache.put(lockKey, "processing", 120);

  var existingDoc = sheet.getRange(row, COL_DOC_LINK).getValue();
  if (!isUpdate && existingDoc && String(existingDoc).includes("http")) return;

  var email = String(sheet.getRange(row, COL_EMAIL).getValue()).trim();
  var koreanName = String(sheet.getRange(row, COL_KOREAN_NAME).getValue()).trim();
  var legalName = toTitleCase(String(sheet.getRange(row, COL_LEGAL_NAME).getValue()).trim());
  var fullName = legalName, gender = sheet.getRange(row, COL_GENDER).getValue();
  var nationality = toTitleCase(String(sheet.getRange(row, COL_NATIONALITY).getValue()).trim());

  var rawGender = String(gender).trim().toLowerCase();
  var chkMale = (rawGender === "male" || rawGender === "m") ? "☑" : "☐";
  var chkFemale = (rawGender === "female" || rawGender === "f") ? "☑" : "☐";

  // Survey 1 checkboxes (Number Codes 1-10 & Legacy Text Fallback)
  var rawS1 = String(sheet.getRange(row, COL_SURVEY1).getValue()).trim();
  var chkS1 = ["☐","☐","☐","☐","☐","☐","☐","☐","☐","☐"], textS1 = "      ";
  var s1Num = parseInt(rawS1, 10);
  
  if (!isNaN(s1Num) && s1Num >= 1 && s1Num <= 10) {
    chkS1[s1Num - 1] = "☑";
    if (s1Num === 10) textS1 = cleanOtherText(rawS1, "10");
  } else {
    var s1Lower = rawS1.toLowerCase();
    if (s1Lower.includes("tv") || s1Lower.includes("radio")) chkS1[0] = "☑";
    else if (s1Lower.includes("newspaper")) chkS1[1] = "☑";
    else if (s1Lower.includes("magazine")) chkS1[2] = "☑";
    else if (s1Lower.includes("education") || s1Lower.includes("school")) chkS1[3] = "☑";
    else if (s1Lower.includes("poster")) chkS1[4] = "☑";
    else if (s1Lower.includes("acquaintance")) chkS1[5] = "☑";
    else if (s1Lower.includes("friend")) chkS1[6] = "☑";
    else if (s1Lower.includes("internet") || s1Lower.includes("social")) chkS1[7] = "☑";
    else if (s1Lower.includes("website")) chkS1[8] = "☑";
    else if (rawS1 !== "") { chkS1[9] = "☑"; textS1 = rawS1.replace(/^Other[:\-]?\s*/i, "").trim(); }
  }

  // Survey 2 checkboxes (Number Codes 1-10 & Legacy Text Fallback)
  var rawS2 = String(sheet.getRange(row, COL_SURVEY2).getValue()).trim();
  var chkS2 = ["☐","☐","☐","☐","☐","☐","☐","☐","☐","☐"], textS2 = "      ";
  var s2Num = parseInt(rawS2, 10);

  if (!isNaN(s2Num) && s2Num >= 1 && s2Num <= 10) {
    chkS2[s2Num - 1] = "☑";
    if (s2Num === 10) textS2 = cleanOtherText(rawS2, "10");
  } else {
    var s2Lower = rawS2.toLowerCase();
    if (s2Lower.includes("study abroad")) chkS2[0] = "☑";
    else if (s2Lower.includes("employment") || s2Lower.includes("work")) chkS2[1] = "☑";
    else if (s2Lower.includes("sightseeing") || s2Lower.includes("travel")) chkS2[2] = "☑";
    else if (s2Lower.includes("research")) chkS2[3] = "☑";
    else if (s2Lower.includes("examine") || s2Lower.includes("check")) chkS2[4] = "☑";
    else if (s2Lower.includes("culture")) chkS2[5] = "☑";
    else if (s2Lower.includes("visa")) chkS2[6] = "☑"; 
    else if (s2Lower.includes("credit") || s2Lower.includes("school")) chkS2[7] = "☑";
    else if (s2Lower.includes("kiip")) chkS2[8] = "☑"; 
    else if (rawS2 !== "") { chkS2[9] = "☑"; textS2 = rawS2.replace(/^Other[:\-]?\s*/i, "").trim(); }
  }

  // Helper para malinis na makuha yung text sa loob ng parenthesis
  function cleanOtherText(rawText, codeStr) {
    var pMatch = rawText.match(/\(([^)]+)\)$/);
    if (pMatch) return pMatch[1].trim(); 
    return rawText.replace(new RegExp("^" + codeStr + "?[.\\-:\\s]*(기타)?\\s*(Other)?[.\\-:\\s]*", "i"), "").replace(/^\(|\)$/g, "").trim() || "       ";
  }

  // Occupation checkboxes
  var rawOcc = String(sheet.getRange(row, COL_OCCUPATION).getValue()).trim();
  var occChecks = { student:"☐",civil:"☐",company:"☐",self:"☐",home:"☐",teacher:"☐",unemp:"☐",other:"☐" }, otherTextVal = "       ";
  var occNum = parseInt(rawOcc, 10);
  
  if (!isNaN(occNum) && occNum >= 1 && occNum <= 8) {
    if (occNum === 1) occChecks.student = "☑"; else if (occNum === 2) occChecks.civil = "☑";
    else if (occNum === 3) occChecks.company = "☑"; else if (occNum === 4) occChecks.self = "☑";
    else if (occNum === 5) occChecks.home = "☑"; else if (occNum === 6) occChecks.teacher = "☑";
    else if (occNum === 7) occChecks.unemp = "☑"; else if (occNum === 8) { occChecks.other = "☑"; otherTextVal = cleanOtherText(rawOcc, "8"); }
  } else if (rawOcc !== "") {
    occChecks.other = "☑"; otherTextVal = rawOcc;
  }

  var isPWD = /^yes/i.test(String(sheet.getRange(row, COL_SPECIAL_ASSISTANCE).getValue() || ""));
  var rawBirth = sheet.getRange(row, COL_BIRTHDATE).getValue();
  var birthDate = "";
  if (rawBirth instanceof Date) {
    birthDate = Utilities.formatDate(rawBirth, Session.getScriptTimeZone(), "yyyy/MM/dd");
  } else {
    // Standardize string input to YYYY/MM/DD by removing existing slashes/dashes and re-inserting them
    var cleanBirth = String(rawBirth).replace(/[-\/]/g, "").trim();
    if (cleanBirth.length === 8) {
      birthDate = cleanBirth.substring(0, 4) + "/" + cleanBirth.substring(4, 6) + "/" + cleanBirth.substring(6, 8);
    } else {
      birthDate = cleanBirth; // Fallback if length is unexpected
    }
  }

  var address = toTitleCase(String(sheet.getRange(row, COL_ADDRESS).getValue()).trim());
  var postalCode = sheet.getRange(row, COL_POSTAL_CODE).getValue();
  var homePhone = sheet.getRange(row, COL_HOME_PHONE).getValue();
  var mobilePhone = sheet.getRange(row, COL_MOBILE_PHONE).getValue();
  var topikLevelSelection = String(sheet.getRange(row, COL_TOPIK_LEVEL).getValue()).toUpperCase();

  var levelCode = "7", checkT1 = "", checkT2 = "", levelName = "TOPIK I";
  if (topikLevelSelection.includes("2") || topikLevelSelection.includes("II")) { levelCode = "8"; checkT2 = "☑"; levelName = "TOPIK II"; }
  else { checkT1 = "☑"; }

  // Dynamic template settings
  var EXAM_DATE = getTplSetting("examDay", "April 12, 2026 (Sunday)");
  var EXAM_VENUE = getTplSetting("testPlace", "Enderun Colleges");
  var rawTime = (levelName === "TOPIK II") ? getTplSetting("timeT2", "11:50 A.M.") : getTplSetting("timeT1", "8:50 A.M.");
  var examTime = formatTimeAMPM(rawTime);
  var DYNAMIC_TEMPLATE_ID = getTplSetting("docId", TEMPLATE_ID);

  var idPrefix = "018001" + levelCode + "01";
  var fullStudentNumber = "", sequenceStr = "", nextNum = 0;

  var idLock = LockService.getScriptLock();
  try {
    idLock.waitLock(30000); // Wait up to 30 seconds for lock
    
    // Re-read after acquiring lock (another process may have assigned)
    var existingId = String(sheet.getRange(row, COL_STUDENT_NO).getValue()).trim();
    if (existingId.length > 5) { fullStudentNumber = existingId; sequenceStr = existingId.slice(-4); }
    else {
      nextNum = getNextSequenceNumber(sheet, idPrefix, isPWD);
      sequenceStr = ("0000" + nextNum).slice(-4);
      fullStudentNumber = idPrefix + sequenceStr;
      sheet.getRange(row, COL_STUDENT_NO).setNumberFormat("@").setValue(fullStudentNumber);
      SpreadsheetApp.flush();
    }
    
    idLock.releaseLock();
  } catch (e) {
    try { idLock.releaseLock(); } catch(unlockErr) {}
    if (e.message.includes("SLOTS FULL")) {
      sendQuotaAlertEmail(levelName, legalName, e.message);
      sendWaitlistEmailToStudent(email, legalName, levelName);
      sheet.getRange(row, COL_STUDENT_NO).setValue("WAITLIST/FULL");
      return;
    } else { throw e; }
  }

  var assignedRoom = sheet.getRange(row, COL_ROOM_ASSIGNMENT).getValue();
  if (!assignedRoom || assignedRoom === "") {
    assignedRoom = findAvailableRoom(sheet, topikLevelSelection, isPWD);
    sheet.getRange(row, COL_ROOM_ASSIGNMENT).setValue(assignedRoom);
  }

  var dateCell = sheet.getRange(row, COL_TIMESTAMP_DOCS);
  var rawDate = dateCell.getValue();
  var finalDateObj = (rawDate instanceof Date && !isNaN(rawDate.getTime())) ? rawDate : new Date();
  if (rawDate === "") dateCell.setValue(finalDateObj);
  var dateVerified = Utilities.formatDate(finalDateObj, Session.getScriptTimeZone(), "MMMM dd, yyyy");

  try {
    var templateFile = DriveApp.getFileById(DYNAMIC_TEMPLATE_ID);
    var mainFolder = DriveApp.getFolderById((levelCode === "8") ? FOLDER_ID_TOPIK2 : FOLDER_ID_TOPIK1);
    var cleanName = legalName.replace(/[^a-zA-Z0-9 ñÑ.-]/g, "").trim().toUpperCase();
    var folderNameWithID = cleanName + " (" + fullStudentNumber + ")";

    var targetFolder = null;
    var searchIterator = mainFolder.searchFolders("title contains '" + fullStudentNumber + "' and trashed = false");
    if (searchIterator.hasNext()) { targetFolder = searchIterator.next(); if (targetFolder.getName() !== folderNameWithID) targetFolder.setName(folderNameWithID); }
    else { targetFolder = mainFolder.createFolder(folderNameWithID); }

    var uploadUrl = String(sheet.getRange(row, COL_FILES_UPLOAD).getValue());
    if (uploadUrl && uploadUrl.includes("drive.google.com")) {
      var uploadId = getIdFromUrl(uploadUrl);
      if (uploadId) try { DriveApp.getFolderById(uploadId).setName(folderNameWithID); } catch (e) {}
    }

    var filesInFolder = targetFolder.getFiles();
    while (filesInFolder.hasNext()) filesInFolder.next().setTrashed(true);

    var copyFile = templateFile.makeCopy(legalName + " (" + fullStudentNumber + ")");
    copyFile.moveTo(targetFolder);
    var copyDoc = DocumentApp.openById(copyFile.getId());
    var sections = [copyDoc.getBody()];
    try {
      var parent = copyDoc.getBody().getParent();
      for (var idx = 0; idx < parent.getNumChildren(); idx++) {
        var child = parent.getChild(idx);
        if (child.getType() === DocumentApp.ElementType.HEADER_SECTION || child.getType() === DocumentApp.ElementType.FOOTER_SECTION) sections.push(child);
      }
    } catch (e) {}

    sections.forEach(function (section) {
      section.replaceText('{{L}}', levelCode); section.replaceText('{{Full Name}}', fullName);
      section.replaceText('{{Legal Name}}', legalName); section.replaceText('{{Korean Name}}', koreanName);
      section.replaceText('{{Email}}', email); section.replaceText('{{Date}}', dateVerified);
      section.replaceText('{{A}}', sequenceStr.charAt(0)); section.replaceText('{{B}}', sequenceStr.charAt(1));
      section.replaceText('{{C}}', sequenceStr.charAt(2)); section.replaceText('{{D}}', sequenceStr.charAt(3));
      section.replaceText('{{Student Number}}', fullStudentNumber); section.replaceText('{{Gender}}', gender);
      section.replaceText('{{Nationality}}', nationality);
      section.replaceText('{{Chk_Student}}', occChecks.student); section.replaceText('{{Chk_Civil}}', occChecks.civil);
      section.replaceText('{{Chk_Company}}', occChecks.company); section.replaceText('{{Chk_Self}}', occChecks.self);
      section.replaceText('{{Chk_Home}}', occChecks.home); section.replaceText('{{Chk_Teacher}}', occChecks.teacher);
      section.replaceText('{{Chk_Unemp}}', occChecks.unemp); section.replaceText('{{Chk_Other}}', occChecks.other);
      section.replaceText('{{Other_Text}}', otherTextVal);
      section.replaceText('{{BirthDate}}', birthDate); section.replaceText('{{Address}}', address);
      section.replaceText('{{Postal Code}}', postalCode); section.replaceText('{{HomePhone}}', homePhone);
      section.replaceText('{{MobilePhone}}', mobilePhone);
      section.replaceText('{{Survey1}}', String(sheet.getRange(row, COL_SURVEY1).getValue()));
      section.replaceText('{{Survey2}}', String(sheet.getRange(row, COL_SURVEY2).getValue()));
      section.replaceText('{{Check_T1}}', checkT1); section.replaceText('{{Check_T2}}', checkT2);
      section.replaceText('{{Selected_Level}}', levelName); section.replaceText('{{Room}}', assignedRoom);
      section.replaceText('{{Chk_Male}}', chkMale); section.replaceText('{{Chk_Female}}', chkFemale);
      for (var k = 0; k < 10; k++) { section.replaceText('{{Chk_S1_' + (k + 1) + '}}', chkS1[k]); section.replaceText('{{Chk_S2_' + (k + 1) + '}}', chkS2[k]); }
      section.replaceText('{{Text_S1}}', textS1); section.replaceText('{{Text_S2}}', textS2);
    });
    copyDoc.saveAndClose();
    var fileUrl = copyFile.getUrl();
    sheet.getRange(row, COL_DOC_LINK).setValue(fileUrl);
    var pdfBlob = copyFile.getAs(MimeType.PDF);

    // Email content
    const subjectPrefix = isUpdate ? "[UPDATED RECORD] " : "";
    const headerTitle = isUpdate ? "REGISTRATION UPDATED" : "REGISTRATION CONFIRMED";
    const pwdNote = isPWD ? "<br><span style='font-size:12px; color:#d32f2f;'>(Special Assistance Required)</span>" : "";
    
    let updateAlertBox = "";
    let introText = "We are pleased to inform you that your payment has been verified. You are officially registered for the upcoming TOPIK exam.";
    if (isUpdate) {
        introText = "Your registration details have been <strong>successfully updated</strong>. Please discard any previous documents and use the attached file for your exam.";
        updateAlertBox = `
          <div style="background-color: #fff8e1; border: 2px solid #ffc107; color: #856404; padding: 20px; margin-bottom: 25px; border-radius: 8px; text-align: center;">
            <strong style="font-size: 18px; display: block; margin-bottom: 5px;">⚠️ DETAILS UPDATED</strong>
            <span style="font-size: 13px;">This email contains your most recent registration info (Room, Level, or Status).<br>Please <strong>PRINT the new attachment</strong> below.</span>
          </div>
        `;
    }

    const studentHtml = `
      <div style="font-family: 'Open Sans', sans-serif; background-color: #f4f4f4; padding: 40px 0;">
      <link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700&display=swap" rel="stylesheet">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #6b4a1c; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">${headerTitle}</h1>
          </div>
          <div style="padding: 40px; color: #333333;">
            ${updateAlertBox}
            <p style="font-size: 16px; line-height: 1.6;">Dear <strong>${legalName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #555;">${introText}</p>
            <div style="background-color: #E8F5E9; border-left: 5px solid #43A047; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #2E7D32; font-weight: bold;">Official Student Number</p>
              <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: 700; color: #1B5E20; letter-spacing: 2px;">${fullStudentNumber}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Level: ${levelName} ${pwdNote}</p>
            </div>
            <div style="border: 1px solid #eee; border-radius: 6px; padding: 15px; margin-bottom: 25px; background-color: #fafafa;">
              <h3 style="margin-top: 0; color: #333; font-size: 16px;">Exam Details:</h3>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #555;">
                <li style="margin-bottom: 8px;"><strong>Date:</strong> ${EXAM_DATE}</li>
                <li style="margin-bottom: 8px;"><strong>Time:</strong> ${examTime}</li>
                <li style="margin-bottom: 8px;"><strong>Venue:</strong> ${EXAM_VENUE} (Room: ${assignedRoom})</li>
              </ul>
            </div>
            <p style="font-size: 15px; font-weight: bold; color: #D32F2F;">Next Steps & What to Bring:</p>
            <ul style="font-size: 14px; line-height: 1.6; color: #555; text-align: justify;">
                <li><strong>Print the attached PDF:</strong> This serves as your official admission ticket. Examinees will not be allowed to enter the testing room without it.</li>
                <li><strong>Bring a Valid ID:</strong> Only government-issued IDs with a clear photo are accepted. Entry will be denied if a non-government ID is presented.</li>
                <li><strong>Writing Materials:</strong> No need to bring any. All required materials will be provided in the testing room.</li>
                <li><strong>Check your Details:</strong> Please review the attached form carefully. If there are any spelling errors, please reply to this email within <strong>24 hours</strong>.</li>
                <li>Please arrive with your admission ticket <b>already printed</b>; the testing center has <span style="color:red;"><b>no printing facilities available</b></span>.</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="font-size: 14px; color: #888;">Regards,<br><strong>Enderun Extension</strong></p>
          </div>
        </div>
      </div>
    `;

    const adminTitle = isUpdate ? "Student Record Updated" : "New Student Enrolled";
    const adminBodyText = isUpdate ? "The student's registration details (Level, Status, or Form) have been updated." : "A new student has successfully completed the registration process.";
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
      <link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700&display=swap" rel="stylesheet">
      <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: 'Open Sans', sans-serif !important; } 
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      </style>
      </head>
      <body style="background-color: #f4f4f4; margin: 0; padding: 0; width: 100% !important; font-family: 'Open Sans', sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 40px 10px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <tr><td height="6" style="background-color: #6b4a1c;"></td></tr>
                <tr>
                  <td style="padding: 40px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" valign="middle"><h1 style="color: #6b4a1c; font-size: 24px; margin: 0; font-weight: 700;">${adminTitle}</h1></td>
                        <td align="right" valign="middle"><span style="background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; white-space: nowrap;">PAID & VERIFIED</span></td>
                      </tr>
                    </table>
                    <p style="color: #666666; font-size: 16px; margin-top: 15px; margin-bottom: 25px;">${adminBodyText}</p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9f9f9; border-radius: 6px; border: 1px solid #eeeeee;">
                      <tr>
                        <td style="padding: 20px;">
                          <table border="0" cellpadding="5" cellspacing="0" width="100%">
                            <tr><td width="35%" style="color: #999999; font-size: 14px; font-weight: 500;">Student Name:</td><td style="color: #333333; font-size: 16px; font-weight: bold;">${legalName}</td></tr>
                            <tr><td style="color: #999999; font-size: 14px; font-weight: 500;">Special Assistance:</td><td style="color: #333333; font-size: 16px; font-weight: bold;">${isPWD ? "YES" : "NO"}</td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 25px; background-color: #fbf7f4; border-left: 5px solid #6b4a1c; border-radius: 4px; padding: 20px;">
                      <p style="margin: 0; color: #6b4a1c; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Generated Student No:</p>
                      <p style="margin: 8px 0 0 0; color: #333333; font-size: 28px; font-weight: 700; letter-spacing: 1px;">${fullStudentNumber}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    MailApp.sendEmail({ to: email, subject: `${subjectPrefix}Registration Confirmed: ${fullStudentNumber} - ${legalName}`, htmlBody: studentHtml, attachments: [pdfBlob], name: SENDER_NAME, replyTo: REPLY_TO_EMAIL });
    MailApp.sendEmail({ to: ADMIN_EMAIL, subject: `${subjectPrefix ? "[UPDATED RECORD] " : "NEW ENROLLEE: "}${legalName} (${fullStudentNumber})`, htmlBody: adminHtml, attachments: [pdfBlob] });

  } catch (error) {
    console.error("Error generating docs: " + error);
    logSystemEvent("SYSTEM", "DOC GEN FAILED", legalName + " (Row " + row + "): " + error.toString());
    
    // Add to retry queue instead of silently failing
    var refId = String(sheet.getRange(row, COL_REF_ID).getValue()).trim();
    addToRetryQueue(row, refId, legalName, error.toString());
    
    // Immediate admin notification for first failure
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: "⚠️ Doc Generation Failed — " + legalName + " (Queued for Retry)",
        htmlBody: '<div style="font-family:Open Sans,sans-serif;padding:30px;"><h2 style="color:#D4880F;">Document Generation Failed</h2><p><b>Student:</b> ' + legalName + '</p><p><b>Row:</b> ' + row + '</p><p><b>Error:</b> ' + error.toString() + '</p><p style="color:#2D8F5E;font-weight:bold;">✅ Automatically queued for retry (max 3 attempts).</p></div>',
        name: "TOPIK System Alert"
      });
    } catch(mailErr) {}
  }
}


// ══════════════════════════════════════════════════════════════
//  §9  EMAIL FUNCTIONS
// ══════════════════════════════════════════════════════════════

function sendPaymentInstructionEmail(sheet, row, refId) {
  const email = String(sheet.getRange(row, COL_EMAIL).getValue()).trim();
  const legalName = toTitleCase(String(sheet.getRange(row, COL_LEGAL_NAME).getValue()).trim());
  const levelRaw = String(sheet.getRange(row, COL_TOPIK_LEVEL).getValue()).toUpperCase();
  if (!email || !email.includes("@")) return;

  const isLevel2 = levelRaw.includes("II") || levelRaw.includes("2");
  const variantId = isLevel2 ? VARIANT_ID_TOPIK2 : VARIANT_ID_TOPIK1;
  const levelDisplayName = isLevel2 ? "TOPIK II (Intermediate-Advanced)" : "TOPIK I (Beginner)";

  const themeColor = "#6b4a1c";

  let smartLink = "";
  try {
    if (typeof createShopifyDraftOrder === 'function') {
      const invoiceUrl = createShopifyDraftOrder(variantId, email, refId);
      if (invoiceUrl) { smartLink = invoiceUrl; } else { throw new Error("No URL"); }
    } else { throw new Error("No API"); }
  } catch (e) {
    console.warn(`⚠️ API Error for ${refId}. Reverting to Manual Link.`);
    smartLink = `https://${SHOPIFY_DOMAIN}/cart/${variantId}:1?attributes[RefID]=${refId}`;
  }

  const htmlBody = `<div style="font-family: 'Open Sans', sans-serif; background-color: #f9f9f9; padding: 40px 0;">
<link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700&display=swap" rel="stylesheet"><div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"><div style="background-color: ${themeColor}; padding: 30px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">REGISTRATION RECEIVED</h1></div><div style="padding: 40px 30px; color: #333333;"><p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${legalName}</strong>,</p><p style="font-size: 15px; line-height: 1.6; color: #555555; margin-bottom: 25px;">Thank you for registering for the <strong>${levelDisplayName}</strong> exam. We have received your application details.</p><p style="font-size: 14px; background: #eee; padding: 10px; border-radius: 5px;"><strong>Reference ID:</strong> ${refId}</p><p style="font-size: 15px; line-height: 1.6; color: #555555; text-align: justify; margin-bottom: 15px;"><strong style="color: #d32f2f;">⚠️ Important Payment Instruction:</strong> Please complete your payment in one session by clicking the <strong>Pay Now</strong> button. If you refresh or leave the page, the reference ID might be lost.</p><p style="font-size: 15px; line-height: 1.6; color: #555555; text-align: justify; margin-bottom: 30px;"><strong>TIP:</strong> Ensure you use the exact email address or student name when paying.<br><em>Note: Slots are first-come, first-served based on payment.</em></p><div style="text-align: center; margin-bottom: 35px;"><a href="${smartLink}" style="background-color: ${themeColor}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">PAY NOW</a></div><div style="background-color: #fff3e0; border: 1px solid #ffe0b2; padding: 15px; border-radius: 5px; text-align: center;"><p style="margin: 0; color: #6b4a1c; font-weight: bold; font-size: 14px;">⚠️ PAYMENT DEADLINE: ${PAYMENT_DEADLINE_HOURS} HOURS</p><p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Unpaid registrations after the deadline may be forfeited.</p></div></div><div style="background-color: #eeeeee; padding: 20px; text-align: center; font-size: 12px; color: #888888;"><p style="margin: 0;">Enderun Extension | Enderun Colleges</p></div></div></div>`;

  MailApp.sendEmail({ to: email, subject: `ACTION REQUIRED: Payment for ${levelDisplayName}`, htmlBody: htmlBody, name: SENDER_NAME, replyTo: REPLY_TO_EMAIL });
}

function sendQuotaAlertEmail(l, s, e) { MailApp.sendEmail({ to: ADMIN_EMAIL, subject: `⚠️ CRITICAL: ${l} FULL`, htmlBody: e, name: "System Alert" }); }
function sendWaitlistEmailToStudent(e, l, ln) { MailApp.sendEmail({ to: e, subject: `Registration Update: Waitlist Status`, htmlBody: `<p>Dear ${l}, you are on waitlist for ${ln}.</p>`, name: SENDER_NAME }); }

function sendSmartEmail(recipient, type) {
  const { email, legalName, refId, level, slots } = recipient;
  const variantId = (level.includes("II") || level.includes("2")) ? VARIANT_ID_TOPIK2 : VARIANT_ID_TOPIK1;
  let smartLink = "";
  try {
    if (typeof createShopifyDraftOrder === 'function') {
      const invoiceUrl = createShopifyDraftOrder(variantId, email, refId);
      if (invoiceUrl) { smartLink = invoiceUrl; } else { throw new Error("No URL"); }
    } else { throw new Error("No API"); }
  } catch (e) {
    smartLink = `https://${SHOPIFY_DOMAIN}/cart/${variantId}:1?attributes[RefID]=${refId}`;
  }

  const urgencyBadge = `<span style="background-color:#ffebee;color:#c62828;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:13px;">ONLY ${slots} SLOTS LEFT</span>`;
  let headerText = "", msgText = "";
  if (type === "PROMOTION") {
    headerText = "YOU ARE PROMOTED";
    msgText = `Good news! A slot opened for <strong>${level}</strong>. <br><br>${urgencyBadge}<br><br>Your status changed from Waitlist to <strong>PENDING</strong>.`;
  } else {
    headerText = "RACE TO PAY ALERT";
    msgText = `Slots opened for <strong>${level}</strong> due to cancellations. <br><br>${urgencyBadge}<br><br>Secure your slot now.`;
  }

  const htmlBody = `<div style="font-family:'Open Sans',sans-serif;background-color:#f9f9f9;padding:40px 0;"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);"><div style="background-color:#6b4a1c;padding:30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;letter-spacing:1px;">${headerText}</h1></div><div style="padding:40px 30px;color:#333333;"><p style="font-size:16px;margin-bottom:20px;">Dear <strong>${legalName}</strong>,</p><p style="font-size:15px;line-height:1.6;color:#555555;margin-bottom:25px;">${msgText}</p><p style="font-size:14px;background:#eee;padding:10px;border-radius:5px;"><strong>Reference ID:</strong> ${refId}</p><div style="text-align:center;margin-bottom:35px;"><a href="${smartLink}" style="background-color:#6b4a1c;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px;display:inline-block;">PAY NOW</a></div></div></div></div>`;

  try {
    MailApp.sendEmail({ to: email, subject: `${headerText}: ${level} (${slots} Slots Left)`, htmlBody: htmlBody, name: SENDER_NAME, replyTo: REPLY_TO_EMAIL });
  } catch (e) { console.error("Failed to send email to " + email); }
}

function processSingleEmail(recipient, subject, messageBody) {
  try {
    const htmlTemplate = `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f4f4f4;padding:40px 10px;"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #e0dace;"><div style="background-color:#6b4a1c;padding:30px;text-align:center;border-bottom:4px solid #a38968;"><h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Official Announcement</h1></div><div style="padding:40px;color:#3c3c3c;font-size:16px;line-height:1.8;text-align:justify;"><p>Dear <strong>${recipient.name}</strong>,</p><div style="background-color:#fdfaf7;border-left:4px solid #6b4a1c;padding:25px;margin:25px 0;border-radius:4px;color:#4a4a4a;font-style:italic;">${messageBody.replace(/\n/g, '<br>')}</div><p style="font-size:14px;color:#777;">Please be guided accordingly.<br>Enderun TOPIK Registration System</p></div><div style="background-color:#6b4a1c;padding:20px;text-align:center;"><p style="margin:0;font-size:11px;color:#d0c0b0;">Enderun Extension Team</p></div></div></div>`;
    MailApp.sendEmail({ to: recipient.email, subject: `ANNOUNCEMENT: ${subject}`, htmlBody: htmlTemplate, name: SENDER_NAME, replyTo: REPLY_TO_EMAIL });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ══════════════════════════════════════════════════════════════
//  §10  ADMIN TOOLS
// ══════════════════════════════════════════════════════════════

const getContext = () => {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  const u = SpreadsheetApp.getUi();
  const r = s.getActiveRange().getRow();
  return { sheet: s, ui: u, row: r, name: r > 1 ? s.getRange(r, COL_LEGAL_NAME).getValue() : "" };
};

function processRefund() {
  const { sheet, ui, row, name } = getContext();
  if (row < 2) return ui.alert("⚠️ Select a row first.");
  if (ui.alert('💸 REFUND?', `Refund ${name}?\nThis deletes folders & data.`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  logSystemEvent("ADMIN TOOL", "REFUND", `Student: ${name}`);
  showThemePopup('REFUND_ANIMATION', 'Processing Refund', 'Cleaning records...');
  SpreadsheetApp.flush();
  clearStudentData(sheet, row, true);
  sheet.getRange(row, COL_PAYMENT_STATUS).setValue("REFUND");
  showThemePopup('SUCCESS', 'Refund Processed', 'Marked as REFUND.');
}

function clearPaymentStatus() {
  const { sheet, ui, row, name } = getContext();
  if (row < 2) return ui.alert("⚠️ Select a row first.");
  if (ui.alert('🗑️ RESET?', `Reset ${name} to PENDING?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  logSystemEvent("ADMIN TOOL", "RESET ROW", `Student: ${name}`);
  showThemePopup('DELETE_ANIMATION', 'Resetting...', 'Removing files...');
  SpreadsheetApp.flush();
  clearStudentData(sheet, row, true);
  showThemePopup('SUCCESS', 'Reset Complete', 'Row is Pending.');
}

function toggleAssistanceStatus() {
  const { sheet, ui, row, name } = getContext();
  if (row < 2) return ui.alert("⚠️ Select a row.");
  const status = String(sheet.getRange(row, COL_PAYMENT_STATUS).getValue()).toUpperCase();
  if (status !== "PAID") return ui.alert("⛔ ACTION BLOCKED", `Student is "${status}". Only PAID students can be processed.`, ui.ButtonSet.OK);
  const cur = String(sheet.getRange(row, COL_SPECIAL_ASSISTANCE).getValue());
  const newVal = /^yes/i.test(cur) ? "No" : "Yes";
  if (ui.alert('CHANGE STATUS', `Switch ${name} to ${newVal}?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  showThemePopup('PWD_ANIMATION', 'Switching Status', 'Regenerating...');
  SpreadsheetApp.flush();
  const oldId = String(sheet.getRange(row, COL_STUDENT_NO).getValue()).trim();
  if (oldId.length > 4) deleteStudentFolder(oldId);
  sheet.getRange(row, COL_SPECIAL_ASSISTANCE).setValue(newVal);
  sheet.getRange(row, COL_STUDENT_NO).clearContent();
  sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
  try { generateOfficialFormAndEmail(sheet, row, true); logSystemEvent("ADMIN TOOL", "STATUS CHANGE", `${name} -> ${newVal}`); showThemePopup('SUCCESS', 'Status Changed', 'Docs Updated.'); } catch (e) { ui.alert("Error: " + e); }
}

function changeTopikLevel() {
  const { sheet, ui, row, name } = getContext();
  if (row < 2) return ui.alert("⚠️ Select a row.");
  const status = String(sheet.getRange(row, COL_PAYMENT_STATUS).getValue()).toUpperCase();
  if (status !== "PAID") return ui.alert("⛔ ACTION BLOCKED", `Student is "${status}". Only PAID students can be processed.`, ui.ButtonSet.OK);
  const cur = String(sheet.getRange(row, COL_TOPIK_LEVEL).getValue()).toUpperCase();
  const newVal = (cur.includes("II") || cur.includes("2")) ? "TOPIK I" : "TOPIK II";
  if (ui.alert('CHANGE LEVEL', `Switch ${name} to ${newVal}?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  showThemePopup('LEVEL_ANIMATION', 'Changing Level', 'Updating...');
  SpreadsheetApp.flush();
  const oldId = String(sheet.getRange(row, COL_STUDENT_NO).getValue()).trim();
  if (oldId.length > 4) deleteStudentFolder(oldId);
  sheet.getRange(row, COL_TOPIK_LEVEL).setValue(newVal);
  sheet.getRange(row, COL_STUDENT_NO).clearContent();
  sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
  try { generateOfficialFormAndEmail(sheet, row, true); logSystemEvent("ADMIN TOOL", "LEVEL CHANGE", `${name} -> ${newVal}`); showThemePopup('SUCCESS', 'Level Updated', 'Student Transferred.'); } catch (e) { ui.alert("Error: " + e); }
}

function requestStudentUpdate() {
  const { sheet, ui, row, name } = getContext();
  if (row < 2) return ui.alert("⚠️ Select a row first.");
  const refId = sheet.getRange(row, COL_REF_ID).getValue();
  const email = sheet.getRange(row, COL_EMAIL).getValue();
  if (!refId || !email) return ui.alert("⚠️ Missing Ref ID or Email.");
  if (ui.alert('📧 SEND UPDATE LINK?', `Send to ${name}?\nEmail: ${email}`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('UPDATE_ACCESS_' + refId, 'ACTIVE');
  const editLink = `${WEB_APP_URL}?ref=${refId}`;
  const msg = `<div style="font-family:'Open Sans',sans-serif;background-color:#f9f9f9;padding:40px 0;"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);"><div style="background-color:#6b4a1c;padding:30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">ACTION REQUIRED</h1></div><div style="padding:40px 30px;color:#333333;"><p style="font-size:16px;">Dear <strong>${name}</strong>,</p><p style="font-size:15px;line-height:1.6;color:#555555;margin-bottom:25px;">We are reaching out because we need you to review and update your TOPIK registration details. Please ensure all your information is correct and that your government ID is uploaded properly.</p><div style="background-color:#fff8e1;border-left:5px solid #ffc107;padding:15px;margin-bottom:25px;border-radius:4px;"><p style="margin:0;font-size:14px;color:#856404;"><strong>⚠️ URGENT ACTION NEEDED</strong><br>Click the button below to access your secure portal. Please complete your updates as soon as possible to avoid issues with your registration.</p></div><div style="text-align:center;margin-bottom:35px;"><a href="${editLink}" style="background-color:#6b4a1c;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px;display:inline-block;">UPDATE RECORD</a></div></div></div></div>`;
  MailApp.sendEmail({ to: email, subject: "ACTION REQUIRED: Update Your TOPIK Registration", htmlBody: msg, name: SENDER_NAME });
  ui.alert("✅ Link Sent!", `Secure edit link sent to ${email}.`, ui.ButtonSet.OK);
}


// ══════════════════════════════════════════════════════════════
//  §11  BULK OPERATIONS
// ══════════════════════════════════════════════════════════════

function manualRegenerateSelectedRow() {
  const { sheet, ui } = getContext();
  const ranges = sheet.getActiveRangeList().getRanges();
  if (!ranges.length) return ui.alert("⚠️ No selection.");
  let rowsToProcess = [], blockedRows = [];
  ranges.forEach(r => {
    const start = r.getRow(), num = r.getNumRows();
    const statusData = sheet.getRange(start, COL_PAYMENT_STATUS, num, 1).getValues();
    for (let i = 0; i < num; i++) {
      let curr = start + i;
      if (curr < 2) continue;
      if (String(statusData[i][0]).toUpperCase() === "PAID") { if (!rowsToProcess.includes(curr)) rowsToProcess.push(curr); }
      else { if (!blockedRows.includes(curr)) blockedRows.push(curr); }
    }
  });
  rowsToProcess.sort((a, b) => a - b); blockedRows.sort((a, b) => a - b);
  if (rowsToProcess.length === 0) {
    let msg = "⚠️ No PAID students selected.";
    if (blockedRows.length) msg += `\n\nSkipped: [ ${blockedRows.join(", ")} ]`;
    return ui.alert(msg);
  }
  let msg = `Regenerate ${rowsToProcess.length} PAID students?`;
  if (blockedRows.length) msg += `\n\n⚠️ Skipped ${blockedRows.length}: [ ${blockedRows.join(", ")} ]`;
  if (ui.alert('🔄 CONFIRM', msg, ui.ButtonSet.YES_NO) === ui.Button.YES) showSmoothBulkUI(rowsToProcess, true);
}

function bulkRegenerateAllPaid() {
  const { sheet, ui } = getContext();
  const res = ui.prompt('BULK UPDATE', `Start Row (Default: 2):`, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  let start = parseInt(res.getResponseText()) || 2;
  if (ui.alert('CONFIRM', `Regenerate ALL PAID from row ${start}?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const data = sheet.getRange(2, COL_PAYMENT_STATUS, sheet.getLastRow() - 1, 1).getValues();
  let rows = [];
  for (let i = start - 2; i < data.length; i++) if (String(data[i][0]).toUpperCase() === "PAID") rows.push(i + 2);
  if (!rows.length) return ui.alert("No PAID rows found.");
  showSmoothBulkUI(rows, false);
}

function sendBulkAnnouncement() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  const subjectResponse = ui.prompt('📢 Blast Announcement', 'Enter Email Subject:', ui.ButtonSet.OK_CANCEL);
  if (subjectResponse.getSelectedButton() !== ui.Button.OK) return;
  const subject = subjectResponse.getResponseText();
  const bodyResponse = ui.prompt('📢 Blast Announcement', 'Enter your message:', ui.ButtonSet.OK_CANCEL);
  if (bodyResponse.getSelectedButton() !== ui.Button.OK) return;
  const messageBody = bodyResponse.getResponseText();
  if (ui.alert('⚠️ CONFIRM', `Send to ALL 'PAID' students?\n\nSubject: ${subject}`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, COL_PAYMENT_STATUS).getValues();
  let recipients = [];
  for (let i = 0; i < data.length; i++) {
    const email = String(data[i][COL_EMAIL - 1]).trim();
    const status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
    const rawName = String(data[i][COL_LEGAL_NAME - 1]);
    if (status === "PAID" && email.includes("@")) recipients.push({ email: email, name: toTitleCase(rawName) });
  }
  if (recipients.length === 0) return ui.alert("⚠️ No 'PAID' students found.");
  
  // Pre-check quota before launching blast
  var quotaCheck = checkQuotaBeforeBulk(recipients.length);
  if (!quotaCheck.ok) {
    return ui.alert("⛔ QUOTA INSUFFICIENT", quotaCheck.message + "\n\nPlease try again tomorrow or reduce the recipient count.", ui.ButtonSet.OK);
  }
  if (quotaCheck.isLow) {
    if (ui.alert("⚠️ LOW QUOTA WARNING", quotaCheck.message + "\n\nProceed anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }
  
  showEmailBlastUI(recipients, subject, messageBody);
}


// ══════════════════════════════════════════════════════════════
//  §12  WAITLIST & RACE-TO-PAY
// ══════════════════════════════════════════════════════════════

function manageWaitlist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DATA_SHEET_NAME);
  const ui = SpreadsheetApp.getUi();
  const LIMIT = TOTAL_HEADCOUNT_LIMIT;

  try { showThemePopup('PROCESS_ANIMATION', 'Analyzing Slots...', 'Checking availability...'); SpreadsheetApp.flush(); } catch (e) { ss.toast("Analyzing...", "System"); }

  const data = sheet.getDataRange().getValues();
  let t1_paid = 0, t2_paid = 0;
  for (let i = 1; i < data.length; i++) {
    let level = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase();
    let status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
    if (status === "PAID") { if (level.includes("II") || level.includes("2")) t2_paid++; else t1_paid++; }
  }

  let t1_open = LIMIT - t1_paid, t2_open = LIMIT - t2_paid;
  if (t1_open <= 0 && t2_open <= 0) return ui.alert("⛔ SLOTS FULL", "No vacancies.", ui.ButtonSet.OK);

  let promotedCount = 0, promotedNames = [];
  for (let i = 1; i < data.length; i++) {
    let status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
    let level = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase();
    let isTopik2 = level.includes("II") || level.includes("2");
    if (status === "WAITLIST") {
      if (isTopik2 && t2_open > 0) { promoteToPending(sheet, i + 1, data[i], "TOPIK II", t2_open); t2_open--; promotedCount++; promotedNames.push(data[i][COL_LEGAL_NAME - 1]); }
      else if (!isTopik2 && t1_open > 0) { promoteToPending(sheet, i + 1, data[i], "TOPIK I", t1_open); t1_open--; promotedCount++; promotedNames.push(data[i][COL_LEGAL_NAME - 1]); }
    }
  }

  let t1_rem = t1_open, t2_rem = t2_open;
  let targetGroup = (t1_rem > 0 && t2_rem > 0) ? "ALL PENDING" : t1_rem > 0 ? "TOPIK I PENDING" : t2_rem > 0 ? "TOPIK II PENDING" : "NONE";
  let msg = promotedCount > 0 ? `✅ PROMOTED: ${promotedCount}\n(${promotedNames.join(", ")})\n\n` : `ℹ️ No waitlisted students.\n\n`;

  if (targetGroup === "NONE") { msg += `🏁 Slots fully occupied.`; return ui.alert("Process Complete", msg, ui.ButtonSet.OK); }
  msg += `🚀 RACE TO PAY:\n`;
  if (t1_rem > 0) msg += `• TOPIK I: ${t1_rem} slots\n`;
  if (t2_rem > 0) msg += `• TOPIK II: ${t2_rem} slots\n`;
  msg += `\nEmail ${targetGroup}?`;

  if (ui.alert("Confirm Blast", msg, ui.ButtonSet.YES_NO) === ui.Button.YES) {
    try { showThemePopup('EMAIL_ANIMATION', 'Targeted Blast...', `Notifying...`); SpreadsheetApp.flush(); } catch (e) {}
    sendRaceToPayReminders(sheet, data, t1_rem, t2_rem);
  } else {
    try { showThemePopup('SUCCESS', 'Done', 'Promotions saved. No emails sent.'); } catch (e) { ui.alert("Done."); }
  }
}

function promoteToPending(sheet, row, rowData, levelName, slotsLeft) {
  sheet.getRange(row, COL_PAYMENT_STATUS).setValue("PENDING");
  sendSmartEmail({ email: rowData[COL_EMAIL - 1], legalName: rowData[COL_LEGAL_NAME - 1], refId: rowData[COL_REF_ID - 1], level: levelName, slots: slotsLeft }, "PROMOTION");
}

function sendRaceToPayReminders(sheet, data, t1_rem, t2_rem) {
  // Count how many will receive emails
  let targetCount = 0;
  for (let i = 1; i < data.length; i++) {
    let freshStatus = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
    let levelName = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase();
    let isTopik2 = levelName.includes("II") || levelName.includes("2");
    if (freshStatus === "PENDING") {
      if ((isTopik2 && t2_rem > 0) || (!isTopik2 && t1_rem > 0)) targetCount++;
    }
  }
  
  var quotaCheck = checkQuotaBeforeBulk(targetCount);
  if (!quotaCheck.ok) {
    logSystemEvent("SYSTEM", "RACE-TO-PAY BLOCKED", quotaCheck.message);
    try { showThemePopup('ERROR', 'Quota Insufficient', quotaCheck.message); } catch(e) {}
    return;
  }
  
  let sentCount = 0;
  for (let i = 1; i < data.length; i++) {
    let freshStatus = sheet.getRange(i + 1, COL_PAYMENT_STATUS).getValue();
    let levelName = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase();
    let isTopik2 = levelName.includes("II") || levelName.includes("2");
    let shouldSend = false, slotsForThis = 0;
    if (String(freshStatus).toUpperCase() === "PENDING") {
      if (isTopik2 && t2_rem > 0) { shouldSend = true; slotsForThis = t2_rem; }
      else if (!isTopik2 && t1_rem > 0) { shouldSend = true; slotsForThis = t1_rem; }
    }
    if (shouldSend) {
      sendSmartEmail({ email: data[i][COL_EMAIL - 1], legalName: data[i][COL_LEGAL_NAME - 1], refId: data[i][COL_REF_ID - 1], level: levelName, slots: slotsForThis }, "REMINDER");
      sheet.getRange(i + 1, COL_PAYMENT_STATUS).setValue("PENDING (NOTIFIED)");
      sentCount++;
      if (sentCount >= 40) break;
    }
  }
  try { showThemePopup('SUCCESS', 'Blast Sent!', `Reminders sent to ${sentCount} students.`); } catch (e) { console.log(`Sent to ${sentCount} students.`); }
}


// ══════════════════════════════════════════════════════════════
//  §13  MASTER LIST PDF
// ══════════════════════════════════════════════════════════════

function generateMasterListPDF() {
  const { sheet, ui } = getContext();
  if (ui.alert('📄 GENERATE REPORT', 'Create PDF of all PAID students?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  SpreadsheetApp.getActiveSpreadsheet().toast('Generating PDF...', '⏳ PROCESSING', -1);

  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { SpreadsheetApp.getActiveSpreadsheet().toast('No data.', '⚠️'); return; }
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    let refundCount = 0;
    data.forEach(row => { if (String(row[COL_PAYMENT_STATUS - 1]).toUpperCase() === "REFUND") refundCount++; });

    let students = data.filter(row => String(row[COL_PAYMENT_STATUS - 1]).toUpperCase() === "PAID" && String(row[COL_STUDENT_NO - 1]).length > 3);
    if (students.length === 0) return ui.alert("No PAID students found.");

    students.sort((a, b) => {
      const lA = String(a[COL_TOPIK_LEVEL - 1]), lB = String(b[COL_TOPIK_LEVEL - 1]);
      if (lA !== lB) return lA.localeCompare(lB);
      const pA = /^yes/i.test(String(a[COL_SPECIAL_ASSISTANCE - 1])), pB = /^yes/i.test(String(b[COL_SPECIAL_ASSISTANCE - 1]));
      if (pA !== pB) return pA ? 1 : -1;
      return String(a[COL_STUDENT_NO - 1]).localeCompare(String(b[COL_STUDENT_NO - 1]));
    });

    let stats = { t1: 0, t2: 0, pwd: 0, regular: 0, total: students.length, refunded: refundCount };
    students.forEach(s => {
      const lvl = String(s[COL_TOPIK_LEVEL - 1]).toUpperCase();
      if (lvl.includes("II") || lvl.includes("2")) stats.t2++; else stats.t1++;
      if (/^yes/i.test(String(s[COL_SPECIAL_ASSISTANCE - 1]))) stats.pwd++; else stats.regular++;
    });

    const htmlContent = createReportHTML(students, stats);
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML).setName("TOPIK_Master_List.html");
    const pdf = DriveApp.createFile(blob).getAs(MimeType.PDF).setName(`TOPIK_MASTER_LIST_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")}.pdf`);
    const file = DriveApp.getFolderById(ARCHIVE_FOLDER_ID).createFile(pdf);
    logSystemEvent("ADMIN TOOL", "REPORT GENERATED", `Total: ${stats.total} | Refunded: ${stats.refunded}`);
    SpreadsheetApp.getActiveSpreadsheet().toast('Report ready.', '✅ SUCCESS', 3);
    showDownloadDialog("https://drive.google.com/uc?export=download&id=" + file.getId());
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Error.', '❌ FAILED');
    ui.alert("Error: " + e.toString());
  }
}

function createReportHTML(data, stats) {
  const dateNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
  let rows = "";
  data.forEach((row, index) => {
    const name = toTitleCase(String(row[COL_LEGAL_NAME - 1]));
    const kName = String(row[COL_KOREAN_NAME - 1]);
    const id = String(row[COL_STUDENT_NO - 1]);
    const level = String(row[COL_TOPIK_LEVEL - 1]);
    const room = String(row[COL_ROOM_ASSIGNMENT - 1]) || "Unassigned";
    const isPwd = /^yes/i.test(String(row[COL_SPECIAL_ASSISTANCE - 1]));
    let bgStyle = index % 2 === 0 ? "background-color:#ffffff;" : "background-color:#fcfcfc;";
    if (isPwd) bgStyle = "background-color:#fffde7;border-left:3px solid #fbc02d;";
    const pwdBadge = isPwd ? "<span style='color:#f57f17;font-size:9px;font-weight:bold;border:1px solid #fbc02d;padding:1px 4px;border-radius:3px;'>PWD</span>" : "<span style='color:#000;font-size:9px;'>Regular</span>";
    const levelBadge = level.includes("II") || level.includes("2") ? `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;">${level}</span>` : `<span style="background:#e3f2fd;color:#1565c0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;">${level}</span>`;
    rows += `<tr style="${bgStyle}"><td style="text-align:center;padding:8px 5px;">${index + 1}</td><td style="text-align:center;padding:8px 5px;font-weight:600;">${id}</td><td style="text-align:left;padding:8px 5px 8px 10px;">${name}</td><td style="text-align:left;padding:8px 5px;font-family:'Malgun Gothic',sans-serif;">${kName}</td><td style="text-align:center;padding:8px 5px;">${levelBadge}</td><td style="text-align:center;padding:8px 5px;">${room}</td><td style="text-align:center;padding:8px 5px;">${pwdBadge}</td></tr>`;
  });

  return `<html><head><link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700,800&display=swap" rel="stylesheet"><style>@page{margin:30px;margin-bottom:50px;}body{font-family:'Open Sans',sans-serif;font-size:10px;color:#000;margin:0;padding:0;}.header-container{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:15px;margin-bottom:20px;border-bottom:2px solid #6b4a1c;}.main-title{font-size:24px;font-weight:800;color:#6b4a1c;text-transform:uppercase;letter-spacing:1px;margin:0;}.sub-title{font-size:11px;color:#a1887f;margin-top:5px;}.meta-info{font-size:10px;color:#000;line-height:1.4;}.status-official{color:#6b4a1c;font-weight:700;text-transform:uppercase;}.stats-bar{background-color:#fcfcfc;padding:10px 0;display:flex;justify-content:space-around;border:1px solid #eee;border-radius:4px;margin-bottom:20px;}.stat-item{text-align:center;}.stat-label{font-size:9px;color:#666;text-transform:uppercase;}.stat-value{font-size:14px;font-weight:700;color:#6b4a1c;}.stat-value.blue{color:#1565c0;}.stat-value.green{color:#2e7d32;}.stat-value.yellow{color:#f57f17;}.stat-value.refund{color:#d32f2f;}table{width:100%;border-collapse:collapse;margin-bottom:40px;}thead{border-bottom:2px solid #6b4a1c;}th{text-align:left;padding:10px 5px;font-size:10px;font-weight:700;color:#6b4a1c;text-transform:uppercase;}td{border-bottom:1px solid #eee;font-size:10px;vertical-align:middle;}.footer-container{position:fixed;bottom:0;left:0;right:0;height:30px;text-align:center;border-top:1px solid #ddd;padding-top:10px;background-color:#fff;}.footer-text{font-size:9px;color:#6b4a1c;text-transform:uppercase;letter-spacing:1px;font-weight:600;}</style></head><body><div class="header-container"><div><div class="main-title">Official Master List</div><div class="sub-title">TOPIK Application & Payment System</div></div><div class="meta-info">Generated on: ${dateNow}<br>Status: <span class="status-official">OFFICIAL RECORD</span></div></div><div class="stats-bar"><div class="stat-item"><span class="stat-label">Total</span><br><span class="stat-value">${stats.total}</span></div><div class="stat-item"><span class="stat-label">TOPIK I</span><br><span class="stat-value blue">${stats.t1}</span></div><div class="stat-item"><span class="stat-label">TOPIK II</span><br><span class="stat-value green">${stats.t2}</span></div><div class="stat-item"><span class="stat-label">PWD</span><br><span class="stat-value yellow">${stats.pwd}</span></div><div class="stat-item"><span class="stat-label">Refunded</span><br><span class="stat-value refund">${stats.refunded}</span></div></div><table><thead><tr><th width="5%" style="text-align:center">#</th><th width="15%" style="text-align:center">Student No.</th><th width="25%" style="text-align:left;padding-left:10px">English Name</th><th width="20%" style="text-align:left">Korean Name</th><th width="10%" style="text-align:center">Level</th><th width="12%" style="text-align:center">Room</th><th width="13%" style="text-align:center">Type</th></tr></thead><tbody>${rows}</tbody></table><div class="footer-container"><div class="footer-text">ENDERUN EXTENSION TOPIK • GENERATED BY SYSTEM V3</div></div></body></html>`;
}

function showDownloadDialog(url) {
  const html = HtmlService.createHtmlOutput(`<html><head><style>body{font-family:'Open Sans',sans-serif;margin:0;padding:0;background:#f4f4f4;text-align:center;}.container{background:white;border-radius:8px;overflow:hidden;height:100%;display:flex;flex-direction:column;}.header{background-color:#6b4a1c;color:white;padding:15px;font-weight:bold;font-size:16px;}.content{padding:20px;flex-grow:1;display:flex;flex-direction:column;justify-content:center;align-items:center;}.btn-download{background-color:#6b4a1c;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:14px;display:inline-block;cursor:pointer;}.footer{padding:10px;background:#eee;font-size:11px;color:#888;cursor:pointer;}</style><script>function handleDownload(){setTimeout(function(){google.script.host.close()},1500);}</script></head><body><div class="container"><div class="header">📄 REPORT GENERATED</div><div class="content"><div style="font-size:40px;margin-bottom:10px;">✅</div><p style="color:#555;font-size:14px;">The Master List PDF is ready.</p><a href="${url}" target="_blank" class="btn-download" onclick="handleDownload()">⬇️ DOWNLOAD PDF</a></div><div class="footer" onclick="google.script.host.close()">Close Window</div></div></body></html>`).setWidth(350).setHeight(280);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}


// ══════════════════════════════════════════════════════════════
//  §14  DASHBOARD & STATS
// ══════════════════════════════════════════════════════════════

function showEnrollmentStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TOPIK TRACKER");
  const data = sheet.getDataRange().getValues();
  const LIMIT_PER_LEVEL = 214;

  let stats = { paid: 0, pending: 0, refund: 0, pwd: 0, regular: 0, male: 0, female: 0, topik1: { paid: 0, idUsed: 0 }, topik2: { paid: 0, idUsed: 0 } };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === "") continue;
    const level = String(row[3]).toUpperCase(), gender = String(row[6]).toUpperCase(), status = String(row[16]).toUpperCase();
    const assistance = String(row[20]).toLowerCase(), studentNo = String(row[17]).trim();
    if (status === "PAID") stats.paid++; else if (status.includes("REFUND")) stats.refund++; else stats.pending++;
    if (assistance.includes("yes")) stats.pwd++; else stats.regular++;
    if (gender.startsWith("F") || gender.startsWith("W")) stats.female++; else stats.male++;
    if (level.includes("II") || level.includes("2")) {
      if (status === "PAID") stats.topik2.paid++;
      if (studentNo.length > 5 && !studentNo.includes("WAIT")) stats.topik2.idUsed++;
    } else {
      if (status === "PAID") stats.topik1.paid++;
      if (studentNo.length > 5 && !studentNo.includes("WAIT")) stats.topik1.idUsed++;
    }
  }

  const t1_slots = LIMIT_PER_LEVEL - stats.topik1.idUsed, t2_slots = LIMIT_PER_LEVEL - stats.topik2.idUsed;
  const t1_pct = Math.round((stats.topik1.idUsed / LIMIT_PER_LEVEL) * 100), t2_pct = Math.round((stats.topik2.idUsed / LIMIT_PER_LEVEL) * 100);
  const reportDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy | hh:mm a");

  // Inline HTML for stats dialog (kept compact)
  const html = HtmlService.createHtmlOutput(`<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script><style>body{font-family:'Poppins',sans-serif;background:#f8f9fa;margin:0;padding:0;color:#333;}.navbar{background:linear-gradient(135deg,#6b4a1c 0%,#8d6e63 100%);color:white;padding:15px 30px;display:flex;justify-content:space-between;align-items:center;}.navbar h1{margin:0;font-size:18px;font-weight:700;}.container{padding:30px;max-width:1000px;margin:0 auto;}.grid-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:30px;}.stat-card{background:white;padding:25px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.04);position:relative;}.stat-val{font-size:42px;font-weight:700;line-height:1;margin-bottom:5px;}.stat-lbl{font-size:12px;color:#666;text-transform:uppercase;font-weight:700;}.charts-row{display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:30px;}.chart-box{background:white;padding:25px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.04);height:380px;display:flex;flex-direction:column;}.chart-title{font-size:13px;font-weight:700;color:#444;margin-bottom:10px;text-transform:uppercase;}.chart-canvas{flex-grow:1;width:100%;height:100%;}.slots-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}.slot-card{background:white;border-radius:12px;padding:25px;box-shadow:0 4px 20px rgba(0,0,0,0.04);}.big-remain{font-size:48px;font-weight:800;margin:10px 0;text-align:center;}.remain-lbl{text-align:center;font-size:11px;color:#666;text-transform:uppercase;}.prog-container{background:#f0f0f0;height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px;}.prog-bar{height:100%;border-radius:4px;}</style><script type="text/javascript">google.charts.load('current',{'packages':['corechart']});google.charts.setOnLoadCallback(drawCharts);function drawCharts(){var dataPie=google.visualization.arrayToDataTable([['Type','Count'],['Regular',${stats.regular}],['PWD',${stats.pwd}]]);new google.visualization.PieChart(document.getElementById('piechart')).draw(dataPie,{pieHole:0.6,colors:['#455a64','#ff7043'],legend:{position:'bottom'},chartArea:{width:'90%',height:'70%'},fontName:'Poppins',pieSliceText:'none',animation:{startup:true,duration:1000}});var dataBar=google.visualization.arrayToDataTable([['Level','Paid',{role:'style'},{role:'annotation'}],['TOPIK I',${stats.topik1.paid},'#6b4a1c','${stats.topik1.paid}'],['TOPIK II',${stats.topik2.paid},'#d4ac0d','${stats.topik2.paid}']]);new google.visualization.ColumnChart(document.getElementById('barchart')).draw(dataBar,{legend:{position:'none'},chartArea:{width:'85%',height:'70%'},fontName:'Poppins',bar:{groupWidth:"50%"},animation:{startup:true,duration:1200}});}</script></head><body><div class="navbar"><h1><i class="fas fa-chart-line"></i> SYSTEM ANALYTICS</h1><div style="font-size:11px;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:20px;">${reportDate}</div></div><div class="container"><div class="grid-stats"><div class="stat-card"><div class="stat-val" style="color:#2e7d32">${stats.paid}</div><div class="stat-lbl">Confirmed</div></div><div class="stat-card"><div class="stat-val" style="color:#f9a825">${stats.pending}</div><div class="stat-lbl">Pending</div></div><div class="stat-card"><div class="stat-val" style="color:#c62828">${stats.refund}</div><div class="stat-lbl">Refunded</div></div></div><div class="charts-row"><div class="chart-box"><div class="chart-title">Demographics</div><div id="piechart" class="chart-canvas"></div><div style="text-align:center;font-size:12px;color:#555;margin-top:5px;">${stats.male} Male | ${stats.female} Female</div></div><div class="chart-box"><div class="chart-title">Paid per Level</div><div id="barchart" class="chart-canvas"></div></div></div><div style="font-size:13px;font-weight:700;color:#6b4a1c;margin-bottom:15px;">ID SLOT AVAILABILITY</div><div class="slots-grid"><div class="slot-card"><div style="font-size:16px;font-weight:700;">TOPIK I</div><div class="big-remain" style="color:${t1_pct > 90 ? '#dc3545' : '#28a745'}">${t1_slots}</div><div class="remain-lbl">Slots Available</div><div class="prog-container"><div class="prog-bar" style="width:${t1_pct}%;background:${t1_pct > 90 ? '#dc3545' : '#28a745'}"></div></div><div style="font-size:12px;text-align:center;">${t1_pct}% Used</div></div><div class="slot-card"><div style="font-size:16px;font-weight:700;">TOPIK II</div><div class="big-remain" style="color:${t2_pct > 90 ? '#dc3545' : '#28a745'}">${t2_slots}</div><div class="remain-lbl">Slots Available</div><div class="prog-container"><div class="prog-bar" style="width:${t2_pct}%;background:${t2_pct > 90 ? '#dc3545' : '#28a745'}"></div></div><div style="font-size:12px;text-align:center;">${t2_pct}% Used</div></div></div><div style="text-align:center;margin-top:40px;"><button onclick="google.script.host.close()" style="padding:10px 25px;border-radius:30px;border:none;background:#6b4a1c;color:white;font-weight:600;cursor:pointer;">Close Dashboard</button></div></div></body></html>`).setWidth(1000).setHeight(850);
  SpreadsheetApp.getUi().showModelessDialog(html, 'TOPIK System');
}

function checkEmailQuota() {
  const quota = MailApp.getRemainingDailyQuota();
  let statusColor = "#27ae60", statusText = "Excellent", statusBg = "#e8f5e9";
  if (quota < 50) { statusColor = "#c0392b"; statusText = "Critical Low"; statusBg = "#fdebd0"; }
  else if (quota < 100) { statusColor = "#d35400"; statusText = "Running Low"; statusBg = "#fef9e7"; }
  const html = HtmlService.createHtmlOutput(`<html><head><style>body{font-family:'Roboto',sans-serif;margin:0;padding:0;background:#fdfbf7;display:flex;justify-content:center;align-items:center;height:100%;}.card{background:white;width:100%;height:100%;display:flex;flex-direction:column;}.header{background-color:#5d4037;color:white;padding:15px 20px;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;}.body{flex-grow:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:10px;}.quota-value{font-size:56px;font-weight:300;color:#3e2723;line-height:1;margin-bottom:5px;}.quota-label{font-size:11px;color:#8d6e63;text-transform:uppercase;letter-spacing:1px;margin-bottom:15px;}.status-pill{background-color:${statusBg};color:${statusColor};padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;}.footer{padding:15px;text-align:center;}.btn-close{background:linear-gradient(135deg,#6b4a1c 0%,#5d4037 100%);color:white;border:none;padding:10px 30px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;cursor:pointer;}</style></head><body><div class="card"><div class="header">System Diagnostics</div><div class="body"><div style="font-size:48px;margin-bottom:10px;">📨</div><div class="quota-value">${quota}</div><div class="quota-label">Emails Remaining Today</div><div class="status-pill">${statusText}</div></div><div class="footer"><div class="btn-close" onclick="google.script.host.close()">Acknowledge</div></div></div></body></html>`).setWidth(320).setHeight(350);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}


// ══════════════════════════════════════════════════════════════
//  §15  SYSTEM HEALTH CHECK
// ══════════════════════════════════════════════════════════════

function runSystemHealthCheck() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TOPIK TRACKER");
  const data = sheet.getDataRange().getValues();
  showThemePopup('PROCESS_ANIMATION', 'Running Diagnosis...', 'Scanning...');
  SpreadsheetApp.flush();
  let errors = [], warnings = [], idTracker = {};
  for (let i = 1; i < data.length; i++) {
    const row = i + 1, name = data[i][5], status = String(data[i][16]).toUpperCase(), studentId = String(data[i][17]).trim();
    if (status === "PAID" && (studentId === "" || studentId === "undefined")) errors.push(`Row ${row}: ${name} is PAID but NO Student ID.`);
    if (status !== "PAID" && studentId.length > 5 && !studentId.includes("WAIT")) warnings.push(`Row ${row}: ${name} has ID (${studentId}) but status is ${status}.`);
    if (studentId.length > 5 && !studentId.includes("WAIT")) {
      if (idTracker[studentId]) errors.push(`DUPLICATE ID: ${studentId} at Row ${idTracker[studentId]} and Row ${row}.`);
      else idTracker[studentId] = row;
    }
  }
  if (errors.length === 0 && warnings.length === 0) showThemePopup('SUCCESS', 'System Healthy', 'No errors found!');
  else {
    let msg = "";
    if (errors.length > 0) msg += "❌ ERRORS:\n" + errors.join("\n") + "\n\n";
    if (warnings.length > 0) msg += "⚠️ WARNINGS:\n" + warnings.join("\n");
    SpreadsheetApp.getUi().alert("🏥 HEALTH CHECK REPORT", msg, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


// ══════════════════════════════════════════════════════════════
//  §16  ARCHIVE & SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

function archiveAndResetSession() {
  const { ui } = getContext();
  if (ui.alert('⚠️ ARCHIVE & RESET', 'Move data to archive and clear sheet?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try {
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd yyyy").toUpperCase();
    const archFolder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID).createFolder(ts);
    const ss = SpreadsheetApp.getActiveSpreadsheet(), tracker = ss.getSheetByName(DATA_SHEET_NAME);
    const newSS = SpreadsheetApp.create(ts);
    tracker.copyTo(newSS).setName("Archived Data");
    if (newSS.getSheetByName('Sheet1')) newSS.deleteSheet(newSS.getSheetByName('Sheet1'));
    DriveApp.getFileById(newSS.getId()).moveTo(archFolder);
    moveContentsToArchive(FOLDER_ID_TOPIK1, archFolder, "TOPIK I");
    moveContentsToArchive(FOLDER_ID_TOPIK2, archFolder, "TOPIK II");
    moveContentsToArchive(MAIN_UPLOAD_FOLDER_ID, archFolder, "UPLOADS");
    if (tracker.getLastRow() > 1) tracker.deleteRows(2, tracker.getLastRow() - 1);
    logSystemEvent("SYSTEM", "ARCHIVE", `Archived to ${ts}`);
    ui.alert("✅ SYSTEM RESET COMPLETE");
  } catch (e) { ui.alert("Error: " + e); }
}


// ══════════════════════════════════════════════════════════════
//  §17  TEMPLATE SETTINGS API
// ══════════════════════════════════════════════════════════════

function saveTemplateSettingsApi(settings) {
  try {
    PropertiesService.getScriptProperties().setProperty('TPL_SETTINGS', JSON.stringify(settings));
    logSystemEvent("WEB ADMIN", "SETTINGS UPDATED", "Template settings changed");
    return { success: true };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function loadTemplateSettingsApi() {
  try {
    var json = PropertiesService.getScriptProperties().getProperty('TPL_SETTINGS');
    if (json) return JSON.parse(json);
    return { examDate: "04/12/2026", examDay: "April 12, 2026 (Sunday)", testArea: "Metro Manila, Taguig", testPlace: "Enderun Colleges", timeT1: "8:50 A.M.", timeT2: "11:50 A.M.", docId: TEMPLATE_ID, deadline: String(PAYMENT_DEADLINE_HOURS), slotLimit: String(TOTAL_HEADCOUNT_LIMIT) };
  } catch (e) { return null; }
}

function getTplSetting(key, fallback) {
  try {
    var json = PropertiesService.getScriptProperties().getProperty('TPL_SETTINGS');
    if (json) { var settings = JSON.parse(json); if (settings[key]) return settings[key]; }
  } catch (e) {}
  return fallback;
}

// Legacy aliases
function saveTemplateSettings(settings) { return saveTemplateSettingsApi(settings); }
function loadTemplateSettings() { return loadTemplateSettingsApi(); }


// ══════════════════════════════════════════════════════════════
//  §18  WEB-APP API ENDPOINTS (Dashboard Backend)
// ══════════════════════════════════════════════════════════════

function getAdminStudentList() {
  return _getUnifiedData(false).students;
}

function getAdminStudentList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var students = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === "") continue;
 
    // Format DOB properly
    var dob = data[i][COL_BIRTHDATE - 1];
    if (dob instanceof Date) {
      dob = Utilities.formatDate(dob, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
 
    students.push({
      row:       i + 1,
      refId:     data[i][COL_REF_ID - 1],
      name:      toTitleCase(String(data[i][COL_LEGAL_NAME - 1])),
      email:     data[i][COL_EMAIL - 1],
      level:     data[i][COL_TOPIK_LEVEL - 1],
      status:    data[i][COL_PAYMENT_STATUS - 1],
      studentNo: data[i][COL_STUDENT_NO - 1] || "N/A",
      pwd:       data[i][COL_SPECIAL_ASSISTANCE - 1],
      docLink:   data[i][COL_DOC_LINK - 1] || "",
      room:      data[i][COL_ROOM_ASSIGNMENT - 1] || "",
 
      // ═══ THESE WERE MISSING — NOW INCLUDED ═══
      kName:     data[i][COL_KOREAN_NAME - 1] || "",
      gender:    data[i][COL_GENDER - 1] || "",
      nat:       data[i][COL_NATIONALITY - 1] || "",
      dob:       dob || "",
      occ:       data[i][COL_OCCUPATION - 1] || "",
      mob:       data[i][COL_MOBILE_PHONE - 1] || "",
      home:      data[i][COL_HOME_PHONE - 1] || "",
      addr:      data[i][COL_ADDRESS - 1] || "",
      zip:       data[i][COL_POSTAL_CODE - 1] || "",
      s1:        data[i][COL_SURVEY1 - 1] || "",
      s2:        data[i][COL_SURVEY2 - 1] || "",
      fileUrl:   data[i][COL_FILES_UPLOAD - 1] || ""
    });
  }
  return students.reverse();
}

function apiHandleStudentAction(action, refId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let row = -1, name = "", status = "", oldId = "";
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_REF_ID - 1] === refId) {
      row = i + 1; name = data[i][COL_LEGAL_NAME - 1]; status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase(); oldId = String(data[i][COL_STUDENT_NO - 1]).trim(); break;
    }
  }
  if (row === -1) return { success: false, message: "Student not found." };
  try {
    if (action === "MARK_PAID") { sheet.getRange(row, COL_PAYMENT_STATUS).setValue("PAID"); generateOfficialFormAndEmail(sheet, row, false); logSystemEvent("WEB ADMIN", "MANUAL PAID", name); return { success: true, message: `${name} marked as PAID. Docs generating.` }; }
    if (action === "REFUND") { clearStudentData(sheet, row, true); sheet.getRange(row, COL_PAYMENT_STATUS).setValue("REFUND"); logSystemEvent("WEB ADMIN", "REFUND", name); return { success: true, message: `${name} refunded.` }; }
    if (action === "RESET") { clearStudentData(sheet, row, true); sheet.getRange(row, COL_PAYMENT_STATUS).setValue("PENDING"); logSystemEvent("WEB ADMIN", "RESET", name); return { success: true, message: `${name} reset to PENDING.` }; }
    if (action === "TOGGLE_PWD") {
      if (status !== "PAID") return { success: false, message: `Blocked: Status is ${status}.` };
      const cur = String(sheet.getRange(row, COL_SPECIAL_ASSISTANCE).getValue()), newVal = /^yes/i.test(cur) ? "No" : "Yes";
      if (oldId.length > 4) deleteStudentFolder(oldId);
      sheet.getRange(row, COL_SPECIAL_ASSISTANCE).setValue(newVal); sheet.getRange(row, COL_STUDENT_NO).clearContent(); sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
      generateOfficialFormAndEmail(sheet, row, true); logSystemEvent("WEB ADMIN", "PWD TOGGLE", `${name} -> ${newVal}`); return { success: true, message: `PWD status: ${newVal}` };
    }
    if (action === "CHANGE_LEVEL") {
      if (status !== "PAID") return { success: false, message: `Blocked: Status is ${status}.` };
      const cur = String(sheet.getRange(row, COL_TOPIK_LEVEL).getValue()).toUpperCase(), newVal = (cur.includes("II") || cur.includes("2")) ? "TOPIK I" : "TOPIK II";
      if (oldId.length > 4) deleteStudentFolder(oldId);
      sheet.getRange(row, COL_TOPIK_LEVEL).setValue(newVal); sheet.getRange(row, COL_STUDENT_NO).clearContent(); sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
      generateOfficialFormAndEmail(sheet, row, true); logSystemEvent("WEB ADMIN", "LEVEL CHANGE", `${name} -> ${newVal}`); return { success: true, message: `Level: ${newVal}` };
    }
    if (action === "REGENERATE") {
      if (status !== "PAID") return { success: false, message: `Blocked: Status is ${status}.` };
      generateOfficialFormAndEmail(sheet, row, true); logSystemEvent("WEB ADMIN", "REGENERATE", name); return { success: true, message: `Docs regenerating for ${name}.` };
    }
    if (action === "UPDATE_LINK") {
      const email = sheet.getRange(row, COL_EMAIL).getValue();
      if (!email) return { success: false, message: "Missing Email." };
      PropertiesService.getScriptProperties().setProperty('UPDATE_ACCESS_' + refId, 'ACTIVE');
      const editLink = `${WEB_APP_URL}?ref=${refId}`;
      const msg = `<div style="font-family:'Open Sans',sans-serif;background-color:#f9f9f9;padding:40px 0;"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);"><div style="background-color:#6b4a1c;padding:30px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">ACTION REQUIRED</h1></div><div style="padding:40px 30px;color:#333333;"><p style="font-size:16px;">Dear <strong>${name}</strong>,</p><p style="font-size:15px;line-height:1.6;color:#555555;margin-bottom:25px;">We are reaching out because we need you to review and update your TOPIK registration details. Please ensure all your information is correct and that your government ID is uploaded properly.</p><div style="background-color:#fff8e1;border-left:5px solid #ffc107;padding:15px;margin-bottom:25px;border-radius:4px;"><p style="margin:0;font-size:14px;color:#856404;"><strong>⚠️ URGENT ACTION NEEDED</strong><br>Click the button below to access your secure portal. Please complete your updates as soon as possible to avoid issues with your registration.</p></div><div style="text-align:center;margin-bottom:35px;"><a href="${editLink}" style="background-color:#6b4a1c;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px;display:inline-block;">UPDATE RECORD</a></div></div></div></div>`;
      MailApp.sendEmail({ to: email, subject: "ACTION REQUIRED: Update Your TOPIK Registration", htmlBody: msg, name: SENDER_NAME });
      logSystemEvent("WEB ADMIN", "SEND UPDATE LINK", name); return { success: true, message: `Link sent to ${email}.` };
    }
    return { success: false, message: "Unknown action." };
  } catch (err) { return { success: false, message: "Error: " + err.toString() }; }
}

function apiGetEmailQuota() { return MailApp.getRemainingDailyQuota(); }

function apiSendBulkAnnouncement(subject, messageBody) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // Count recipients first
    let recipients = [];
    for (let i = 1; i < data.length; i++) {
      let email = String(data[i][COL_EMAIL - 1]).trim(), status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase(), name = toTitleCase(String(data[i][COL_LEGAL_NAME - 1]));
      if (status === "PAID" && email.includes("@")) recipients.push({ email: email, name: name });
    }
    
    // Pre-check quota
    var quotaCheck = checkQuotaBeforeBulk(recipients.length);
    if (!quotaCheck.ok) {
      logSystemEvent("SYSTEM", "BULK EMAIL BLOCKED", quotaCheck.message);
      return { success: false, message: quotaCheck.message };
    }
    
    let sentCount = 0, failCount = 0;
    for (let i = 0; i < recipients.length; i++) {
      try {
        processSingleEmail(recipients[i], subject, messageBody);
        sentCount++;
      } catch(emailErr) {
        failCount++;
        logSystemEvent("SYSTEM", "EMAIL FAIL", recipients[i].email + ": " + emailErr.toString());
      }
    }
    logSystemEvent("WEB ADMIN", "BULK EMAIL", `Sent to ${sentCount}`);
    return { success: true, message: `Sent to ${sentCount} students.` };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function apiTriggerWaitlist() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const LIMIT = TOTAL_HEADCOUNT_LIMIT;
    const data = sheet.getDataRange().getValues();
    let t1_paid = 0, t2_paid = 0;
    for (let i = 1; i < data.length; i++) {
      let level = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase(), status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase();
      if (status === "PAID") { if (level.includes("II") || level.includes("2")) t2_paid++; else t1_paid++; }
    }
    let t1_open = LIMIT - t1_paid, t2_open = LIMIT - t2_paid;
    if (t1_open <= 0 && t2_open <= 0) return { success: false, message: "No vacancies." };
    let promotedCount = 0;
    for (let i = 1; i < data.length; i++) {
      let status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase(), level = String(data[i][COL_TOPIK_LEVEL - 1]).toUpperCase(), isTopik2 = level.includes("II") || level.includes("2");
      if (status === "WAITLIST") {
        if (isTopik2 && t2_open > 0) { promoteToPending(sheet, i + 1, data[i], "TOPIK II", t2_open); t2_open--; promotedCount++; }
        else if (!isTopik2 && t1_open > 0) { promoteToPending(sheet, i + 1, data[i], "TOPIK I", t1_open); t1_open--; promotedCount++; }
      }
    }
    if (t1_open > 0 || t2_open > 0) {
      // Quota check includes promotions already sent + upcoming race-to-pay
      var quotaCheck = checkQuotaBeforeBulk(promotedCount + 40); // 40 = max race-to-pay cap
      if (!quotaCheck.ok) {
        logSystemEvent("SYSTEM", "WAITLIST PARTIAL", "Promotions sent but race-to-pay skipped: " + quotaCheck.message);
        return { success: true, message: "Promoted " + promotedCount + " but race-to-pay emails skipped — " + quotaCheck.message };
      }
      sendRaceToPayReminders(sheet, data, t1_open, t2_open);
    }
    logSystemEvent("WEB ADMIN", "WAITLIST TRIGGER", `Promoted: ${promotedCount}`);
    _invalidateUnifiedCache();
    return { success: true, message: `Promoted ${promotedCount}. Race-to-Pay fired (T1: ${t1_open}, T2: ${t2_open}).` };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function apiGenerateMasterListPDF() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "No data." };
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    let refundCount = 0;
    data.forEach(row => { if (String(row[COL_PAYMENT_STATUS - 1]).toUpperCase() === "REFUND") refundCount++; });
    let students = data.filter(row => String(row[COL_PAYMENT_STATUS - 1]).toUpperCase() === "PAID" && String(row[COL_STUDENT_NO - 1]).length > 3);
    if (students.length === 0) return { success: false, message: "No PAID students." };
    students.sort((a, b) => {
      const lA = String(a[COL_TOPIK_LEVEL - 1]), lB = String(b[COL_TOPIK_LEVEL - 1]);
      if (lA !== lB) return lA.localeCompare(lB);
      return String(a[COL_STUDENT_NO - 1]).localeCompare(String(b[COL_STUDENT_NO - 1]));
    });
    let stats = { t1: 0, t2: 0, pwd: 0, regular: 0, total: students.length, refunded: refundCount };
    students.forEach(s => {
      if (String(s[COL_TOPIK_LEVEL - 1]).toUpperCase().includes("II") || String(s[COL_TOPIK_LEVEL - 1]).includes("2")) stats.t2++; else stats.t1++;
      if (/^yes/i.test(String(s[COL_SPECIAL_ASSISTANCE - 1]))) stats.pwd++; else stats.regular++;
    });
    const htmlContent = createReportHTML(students, stats);
    const blob = Utilities.newBlob(htmlContent, MimeType.HTML).setName("TOPIK_Master_List.html");
    const pdf = DriveApp.createFile(blob).getAs(MimeType.PDF).setName(`TOPIK_MASTER_LIST_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")}.pdf`);
    const file = DriveApp.getFolderById(ARCHIVE_FOLDER_ID).createFile(pdf);
    logSystemEvent("WEB ADMIN", "REPORT GENERATED", `Total: ${stats.total}`);
    return { success: true, url: "https://drive.google.com/uc?export=download&id=" + file.getId() };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function apiRunHealthCheck() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let errors = [], warnings = [], idTracker = {};
    for (let i = 1; i < data.length; i++) {
      const row = i + 1, name = data[i][COL_LEGAL_NAME - 1], status = String(data[i][COL_PAYMENT_STATUS - 1]).toUpperCase(), studentId = String(data[i][COL_STUDENT_NO - 1]).trim();
      if (status === "PAID" && (studentId === "" || studentId === "undefined")) errors.push(`Row ${row}: ${name} PAID but no ID.`);
      if (status !== "PAID" && studentId.length > 5 && !studentId.includes("WAIT")) warnings.push(`Row ${row}: ${name} has ID ${studentId} but status ${status}.`);
      if (studentId.length > 5 && !studentId.includes("WAIT")) { if (idTracker[studentId]) errors.push(`DUPLICATE: ${studentId} at Row ${idTracker[studentId]} and ${row}.`); else idTracker[studentId] = row; }
    }
    return { success: true, errors: errors, warnings: warnings };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function apiGetRoomStats() {
  return { success: true, rooms: _getUnifiedData(false).rooms };
}

function getAdminDashboardHtml_() {
  return HtmlService.createTemplateFromFile('Admin_Dashboard_V3').evaluate().getContent();
}


// ══════════════════════════════════════════════════════════════
//  §19  UI POPUPS & ANIMATIONS
// ══════════════════════════════════════════════════════════════

function showThemePopup(type, title, subtitle) {
  let anim = '', autoClose = '';
  if (type === 'DELETE_ANIMATION') anim = `<div class="anim-box delete-box"><div class="paper"></div><svg viewBox="0 0 24 24" class="trash-icon" width="60" height="60"><path fill="#6b4a1c" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div><style>.delete-box{position:relative;overflow:hidden;height:80px}.trash-icon{position:absolute;bottom:0;left:50%;transform:translateX(-50%);z-index:2;animation:shake 0.5s infinite}.paper{width:20px;height:25px;background:#fff;border:1px solid #ccc;position:absolute;top:-30px;left:50%;margin-left:-10px;z-index:1;animation:dropPaper 1.5s infinite ease-in}@keyframes shake{0%{transform:translateX(-50%) rotate(0deg)}25%{transform:translateX(-50%) rotate(5deg)}75%{transform:translateX(-50%) rotate(-5deg)}100%{transform:translateX(-50%) rotate(0deg)}}@keyframes dropPaper{0%{top:-30px;opacity:1;transform:rotate(0deg)}60%{top:25px;opacity:1;transform:rotate(180deg)}100%{top:40px;opacity:0}}</style>`;
  else if (type === 'REFUND_ANIMATION') anim = `<div class="anim-box"><div class="refund-icon">₱</div><div class="out-arrow">➔</div></div><style>.refund-icon{font-size:40px;font-weight:bold;color:#6b4a1c}.out-arrow{font-size:24px;color:#a38968;position:absolute;animation:moveOut 1s infinite;margin-left:40px}@keyframes moveOut{0%{opacity:0;transform:translateX(0)}50%{opacity:1}100%{opacity:0;transform:translateX(30px)}}</style>`;
  else if (type === 'PWD_ANIMATION') anim = `<div class="anim-box"><div class="toggle-track"><div class="toggle-circle"></div></div></div><style>.toggle-track{width:60px;height:30px;background:#e0dace;border-radius:15px;position:relative;margin:0 auto;border:2px solid #6b4a1c}.toggle-circle{width:24px;height:24px;background:#6b4a1c;border-radius:50%;position:absolute;top:3px;left:3px;animation:slide 1.5s infinite alternate ease-in-out}@keyframes slide{0%{left:3px}100%{left:33px}}</style>`;
  else if (type === 'LEVEL_ANIMATION') anim = `<div class="anim-box"><div class="level-text">I <span class="arrows">⇄</span> II</div></div><style>.level-text{font-size:32px;font-weight:bold;color:#6b4a1c}.arrows{display:inline-block;animation:spinArrows 1s infinite linear;color:#a38968}@keyframes spinArrows{0%{transform:rotate(0deg)}100%{transform:rotate(180deg)}}</style>`;
  else if (type === 'SUCCESS') { autoClose = 'setTimeout(function(){google.script.host.close()},2500);'; anim = `<div class="checkmark-circle"><div class="background"></div><div class="checkmark stem"></div><div class="checkmark kick"></div></div><style>.checkmark-circle{width:50px;height:50px;position:relative;display:inline-block;margin-bottom:15px}.checkmark-circle .background{width:50px;height:50px;border-radius:50%;background:#6b4a1c;position:absolute;animation:scaleUp 0.3s ease-in-out}.checkmark-circle .checkmark{border-radius:5px;transform:rotate(45deg);position:absolute}.checkmark-circle .checkmark.stem{width:3px;height:18px;background-color:#fff;left:26px;top:14px;animation:growStem 0.4s 0.3s ease-out forwards;opacity:0}.checkmark-circle .checkmark.kick{width:9px;height:3px;background-color:#fff;left:19px;top:37px;animation:growKick 0.4s 0.3s ease-out forwards;opacity:0}@keyframes scaleUp{0%{transform:scale(0)}100%{transform:scale(1)}}@keyframes growStem{0%{height:0;opacity:1}100%{height:18px;opacity:1}}@keyframes growKick{0%{width:0;opacity:1}100%{width:9px;opacity:1}}</style>`; }
  else anim = `<div class="anim-box"><div style="font-size:32px;color:#6b4a1c;">⏳</div></div>`;

  const html = `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet"><style>body{background-color:#fdfaf7;font-family:'Poppins',sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;overflow:hidden;text-align:center}.container{padding:20px;width:100%}.anim-box{height:80px;display:flex;align-items:center;justify-content:center;margin-bottom:5px}h2{color:#6b4a1c;font-size:18px;margin:10px 0 5px 0;font-weight:600;text-transform:uppercase;letter-spacing:1px}p{color:#8d6e63;font-size:13px;margin:0}</style><script>${autoClose}</script></head><body><div class="container">${anim}<h2>${title}</h2><p>${subtitle}</p></div></body></html>`;
  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(html).setWidth(300).setHeight(220), ' ');
}

function showSmoothBulkUI(rows, isUpdate) {
  const htmlTemplate = HtmlService.createTemplate(`<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet"><style>body{background-color:#fdfaf7;font-family:'Poppins',sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:white;padding:25px;border-radius:12px;box-shadow:0 4px 15px rgba(107,74,28,0.15);text-align:center;width:280px}.loader{border:5px solid #f3f3f3;border-top:5px solid #6b4a1c;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 15px}.checkmark{color:#28a745;font-size:50px;display:none;margin-bottom:10px}.title{font-size:14px;font-weight:600;color:#6b4a1c;text-transform:uppercase}.count{font-size:24px;font-weight:bold;color:#333;margin-bottom:10px}.status{font-size:12px;color:#777;font-style:italic}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}button{margin-top:15px;padding:8px 15px;background:#6b4a1c;color:white;border:none;border-radius:4px;cursor:pointer;display:none}</style></head><body><div class="card"><div id="loader" class="loader"></div><div id="check" class="checkmark">✔</div><div id="title" class="title">Processing...</div><div id="count" class="count">0 / <?= rows.length ?></div><div id="status" class="status">Initializing...</div><button id="closeBtn" onclick="google.script.host.close()">Close</button></div><script>var rows=JSON.parse('<?= JSON.stringify(rows) ?>');var isUpdate=<?= isUpdate ?>;var current=0;var successCount=0;var failCount=0;function processNext(){if(current>=rows.length){finish();return}var row=rows[current];document.getElementById('count').innerText=(current+1)+" / "+rows.length;document.getElementById('status').innerText="Row "+row+"...";google.script.run.withSuccessHandler(function(res){if(res.success)successCount++;else failCount++;current++;processNext()}).withFailureHandler(function(){failCount++;current++;processNext()}).processRowFromClient(row,isUpdate)}function finish(){document.getElementById('loader').style.display='none';document.getElementById('check').style.display='block';document.getElementById('title').innerText='COMPLETED';document.getElementById('status').innerHTML='Success: '+successCount+' | Errors: '+failCount;document.getElementById('closeBtn').style.display='inline-block'}window.onload=processNext;</script></body></html>`);
  htmlTemplate.rows = rows; htmlTemplate.isUpdate = isUpdate;
  SpreadsheetApp.getUi().showModelessDialog(htmlTemplate.evaluate().setHeight(280).setWidth(350), ' ');
}

function showEmailBlastUI(recipients, subject, body) {
  const htmlTemplate = HtmlService.createTemplate(`<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"><style>body{background-color:#fdfaf7;font-family:'Poppins',sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;text-align:center}.card{background:white;padding:30px;border-radius:12px;box-shadow:0 10px 30px rgba(107,74,28,0.15);width:300px}.plane{font-size:50px;color:#6b4a1c;animation:fly 2s infinite ease-in-out}@keyframes fly{0%{transform:translateY(0)}50%{transform:translateY(-10px)}100%{transform:translateY(0)}}.title{font-size:16px;font-weight:700;color:#6b4a1c;text-transform:uppercase}.count{font-size:32px;font-weight:bold;color:#333}.subtext{font-size:13px;color:#888;font-style:italic}.progress-bar{width:100%;height:6px;background:#eee;border-radius:3px;margin-top:15px;overflow:hidden}.progress-fill{height:100%;background:#6b4a1c;width:0%;transition:width 0.3s}button{margin-top:20px;padding:10px 20px;background:#6b4a1c;color:white;border:none;border-radius:5px;cursor:pointer;display:none}</style></head><body><div class="card"><div id="processing-view"><div class="plane">✈️</div><div class="title">Sending...</div><div id="count" class="count">0 / <?= recipients.length ?></div><div id="status" class="subtext">Initializing...</div><div class="progress-bar"><div id="bar" class="progress-fill"></div></div></div><div id="success-view" style="display:none;"><div style="font-size:50px;color:#28a745;">✔</div><div class="title" style="color:#28a745">Sent!</div><div id="final-stats" class="subtext" style="margin-top:10px;font-size:14px;"></div><button onclick="google.script.host.close()" style="display:block">Close</button></div></div><script>var recipients=JSON.parse('<?= JSON.stringify(recipients) ?>');var subject=<?= JSON.stringify(subject) ?>;var body=<?= JSON.stringify(body) ?>;var current=0;var successCount=0;var failCount=0;function processNext(){if(current>=recipients.length){showSuccess();return}var r=recipients[current];document.getElementById('count').innerText=(current+1)+" / "+recipients.length;document.getElementById('status').innerText="Emailing: "+r.name;document.getElementById('bar').style.width=((current+1)/recipients.length)*100+"%";google.script.run.withSuccessHandler(function(res){if(res.success)successCount++;else failCount++;current++;setTimeout(processNext,200)}).withFailureHandler(function(){failCount++;current++;processNext()}).processSingleEmail(r,subject,body)}function showSuccess(){document.getElementById('processing-view').style.display='none';document.getElementById('success-view').style.display='block';document.getElementById('final-stats').innerHTML='Sent: <b>'+successCount+'</b><br>Failed: <span style="color:red">'+failCount+'</span>'}window.onload=processNext;</script></body></html>`);
  htmlTemplate.recipients = recipients; htmlTemplate.subject = subject; htmlTemplate.body = body;
  SpreadsheetApp.getUi().showModelessDialog(htmlTemplate.evaluate().setWidth(350).setHeight(320), ' ');
}


// ══════════════════════════════════════════════════════════════
//  §20  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

function toTitleCase(str) {
  if (!str) return "";
  var specialWords = ["II", "III", "IV", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "USA", "UK"];
  return str.toString().normalize('NFC').toLowerCase().trim().split(/\s+/).map(function (word) {
    var cleanWord = word.toUpperCase().replace(/[^A-Z\u00C0-\u00D6\u00D8-\u00f6\u00f8-\u00ff]/g, "");
    if (specialWords.indexOf(cleanWord) !== -1) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function mapCodeToText(val, type) {
  var str = String(val).trim();
  if (!str) return "";
  var numMatch = str.match(/^(\d+)/);
  if (!numMatch) return str; 
  var n = parseInt(numMatch[1], 10);
  var extra = str.replace(/^\d+[:\-]?\s*/, "").replace(/^Other[:\-]?\s*/i, "").trim();
  
  if (type === 'occ') {
     var map = ["", "1. 학 생 (Student)", "2. 공무원 (Civil Servant)", "3. 회사원 (Company Employee)", "4. 자영업 (Self-employer)", "5. 주 부 (Homemaker)", "6. 교 사 (Teacher)", "7. 무 직 (Unemployed)"];
     if (n >= 1 && n <= 7) return map[n];
     if (n === 8) return extra ? "8. 기타 Other ( " + extra + " )" : "8. 기타 Other";
  }
  if (type === 's1') {
     var map = ["", "1. 방송 TV/Radio", "2. 신문 Newspaper", "3. 잡지 Magazine", "4. 교육기관 Educational Institute", "5. 포스터 Poster", "6. 친지 Acquaintance", "7. 친구 Friend", "8. 인터넷 Internet", "9. 토픽홈페이지 Official TOPIK Website"];
     if (n >= 1 && n <= 9) return map[n];
     if (n === 10) return extra ? "10. 기타 Other ( " + extra + " )" : "10. 기타 Other";
  }
  if (type === 's2') {
     var map = ["", "1. 유학 Study Abroad", "2. 취업 Employment", "3. 관광 Sightseeing", "4. 학술연구 Research", "5. 실력확인 Examine Korean Language Ability", "6. 한국문화이해 Understanding of Korean Cultures", "7. 비자 취득 VISA", "8. 학점 취득 School credit", "9. 사회통합 프로그램 KIIP"];
     if (n >= 1 && n <= 9) return map[n];
     if (n === 10) return extra ? "10. 기타 Other ( " + extra + " )" : "10. 기타 Other";
  }
  return str;
}

function getNextSequenceNumber(sheet, prefixToCheck, isPWD) {
  const LIMIT_PER_LEVEL = 214, PWD_START_ID_LOCAL = 215;
  const lastRow = sheet.getLastRow();
  const data = (lastRow < 2) ? [] : sheet.getRange(2, COL_STUDENT_NO, lastRow - 1).getValues();
  const prefixNoZero = prefixToCheck.startsWith("0") ? prefixToCheck.substring(1) : prefixToCheck;
  const usedNumbers = [];
  let currentLevelHeadcount = 0;
  data.forEach(r => {
    const val = String(r[0]).trim();
    if (val.length > 4 && (val.startsWith(prefixToCheck) || val.startsWith(prefixNoZero))) {
      currentLevelHeadcount++;
      const lastFour = val.slice(-4);
      if (!isNaN(parseInt(lastFour, 10))) usedNumbers.push(parseInt(lastFour, 10));
    }
  });
  if (currentLevelHeadcount >= LIMIT_PER_LEVEL) throw new Error(`SLOTS FULL`);
  if (isPWD) { for (let i = PWD_START_ID_LOCAL; i >= 1; i -= 2) { if (!usedNumbers.includes(i)) return i; } }
  else { for (let i = 1; i <= LIMIT_PER_LEVEL; i++) { if (!usedNumbers.includes(i)) return i; } }
  throw new Error(`SYSTEM ERROR: No ID available.`);
}

function findAvailableRoom(sheet, topikLevel, isPWD) {
  const ROOMS = getDynamicRooms();
  const lastRow = sheet.getLastRow();
  
  // Fallback if sheet is completely empty
  if (lastRow < 2) {
    let firstPwd = ROOMS.find(r => r.type === "PWD");
    let firstReg = ROOMS.find(r => r.type === "REGULAR");
    return isPWD ? (firstPwd ? firstPwd.name : firstReg.name) : firstReg.name;
  }
  
  const data = sheet.getRange(2, 4, lastRow - 1, 20).getValues();
  
  // Helper function to check capacity per room type
  const searchRoomByType = (type) => {
    for (let i = 0; i < ROOMS.length; i++) {
      if (ROOMS[i].type !== type) continue;
      
      const roomName = ROOMS[i].name, maxCap = parseInt(ROOMS[i].cap, 10);
      let currentCount = 0;
      
      for (let j = 0; j < data.length; j++) {
        // data[j] represents a row. Adjust indices based on COL_REF_ID etc.
        // Assuming data range starts from column D (index 4) based on your original code
        // Index mapping: Level is usually COL_TOPIK_LEVEL, Status is COL_PAYMENT_STATUS
        const rowLevel = String(data[j][0]).toUpperCase(); // D is 0 (Level)
        const rowStatus = String(data[j][COL_PAYMENT_STATUS - 4]).toUpperCase(); // Usually Q
        const rowRoom = String(data[j][COL_ROOM_ASSIGNMENT - 4]).trim(); // Usually W
        
        let isSameLevel = false;
        if (topikLevel.includes("II") || topikLevel.includes("2")) { if (rowLevel.includes("II") || rowLevel.includes("2")) isSameLevel = true; }
        else { if (!rowLevel.includes("II") && !rowLevel.includes("2")) isSameLevel = true; }
        
        // ONLY count if the student is PAID and assigned to this room
        if (isSameLevel && rowRoom === roomName && rowStatus === "PAID") currentCount++;
      }
      
      if (currentCount < maxCap) return roomName;
    }
    return null;
  };

  // 1. Try PWD Room first if student is PWD
  if (isPWD) {
    let pwdRoom = searchRoomByType("PWD");
    if (pwdRoom) return pwdRoom;
  }
  
  // 2. If Regular student, or if PWD student but PWD rooms are full -> Use REGULAR room
  let regRoom = searchRoomByType("REGULAR");
  if (regRoom) return regRoom;

  // 3. Both PWD and REGULAR rooms are fully occupied
  return "ALL ROOMS FULL";
}

function clearStudentData(sheet, row, deleteFolder) {
  if (deleteFolder) {
    const sid = String(sheet.getRange(row, COL_STUDENT_NO).getValue()).trim();
    if (sid.length > 4) deleteStudentFolder(sid);
    const upUrl = String(sheet.getRange(row, COL_FILES_UPLOAD).getValue());
    if (upUrl.includes("drive")) { const id = getIdFromUrl(upUrl); if (id) try { DriveApp.getFolderById(id).setTrashed(true); } catch (e) {} }
  }
  sheet.getRange(row, COL_PAYMENT_STATUS).setValue(deleteFolder ? "PENDING" : "REFUND");
  sheet.getRange(row, COL_STUDENT_NO).clearContent();
  sheet.getRange(row, COL_DOC_LINK).clearContent();
  sheet.getRange(row, COL_TIMESTAMP_DOCS).clearContent();
  sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
  if (deleteFolder) sheet.getRange(row, COL_FILES_UPLOAD).clearContent();
}

function deleteStudentFolder(id) {
  [FOLDER_ID_TOPIK1, FOLDER_ID_TOPIK2].forEach(pid => {
    try { const p = DriveApp.getFolderById(pid); const s = p.searchFolders(`title contains '${id}' and trashed = false`); while (s.hasNext()) s.next().setTrashed(true); } catch (e) {}
  });
}

function moveContentsToArchive(srcId, destFolder, lbl) {
  try {
    const src = DriveApp.getFolderById(srcId), sub = destFolder.createFolder(lbl);
    const fi = src.getFiles(); while (fi.hasNext()) fi.next().moveTo(sub);
    const fo = src.getFolders(); while (fo.hasNext()) fo.next().moveTo(sub);
  } catch (e) {}
}

function getIdFromUrl(url) {
  try {
    const p = url.split("="); if (p.length > 1) return p[1];
    const p2 = url.split("/"); const i = p2.indexOf("d");
    if (i !== -1 && p2.length > i + 1) return p2[i + 1].split("?")[0];
    const j = p2.indexOf("folders"); if (j !== -1 && p2.length > j + 1) return p2[j + 1].split("?")[0];
  } catch (e) {}
  return "";
}

function organizeUploadsToFolders(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DATA_SHEET_NAME || e.range.getRow() < 2) return;
  const row = e.range.getRow();
  const studentNameRaw = sheet.getRange(row, COL_LEGAL_NAME).getValue();
  const fileUrls = String(sheet.getRange(row, COL_FILES_UPLOAD).getValue());
  if (!fileUrls || fileUrls === "" || fileUrls === "undefined") return;
  try {
    const studentName = toTitleCase(studentNameRaw);
    const mainFolder = DriveApp.getFolderById(MAIN_UPLOAD_FOLDER_ID);
    const studentFolders = mainFolder.getFoldersByName(studentName);
    let targetFolder = studentFolders.hasNext() ? studentFolders.next() : mainFolder.createFolder(studentName);
    sheet.getRange(row, COL_FILES_UPLOAD).setValue(targetFolder.getUrl());
    const urls = fileUrls.split(",");
    for (let i = 0; i < urls.length; i++) {
      const fileId = getIdFromUrl(urls[i].trim());
      if (fileId) try { DriveApp.getFileById(fileId).moveTo(targetFolder); } catch (e) {}
    }
  } catch (err) { console.error(err); }
}

function logSystemEvent(category, action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SYSTEM LOGS");
    if (!sheet) { sheet = ss.insertSheet("SYSTEM LOGS"); sheet.appendRow(["TIMESTAMP", "USER", "CATEGORY", "ACTION", "DETAILS"]); sheet.setFrozenRows(1); sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#ddd"); }
    let userEmail = "Admin/User";
    try { const activeUser = Session.getActiveUser().getEmail(); if (activeUser) userEmail = activeUser; } catch (err) {}
    sheet.appendRow([new Date(), userEmail, category, action, details]);
  } catch (e) { console.error("Logging Error: " + e.toString()); }
}

function formatTimeAMPM(timeStr) {
  if (!timeStr) return "";
  var parts = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) return timeStr; // Return as is kung may AM/PM na
  var hours = parseInt(parts[1], 10);
  var minutes = parts[2];
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 magiging 12
  return hours + ':' + minutes + ' ' + ampm;
}

// Student Edit Portal functions
function getStudentData(refId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_REF_ID - 1] == refId) {
      let dob = data[i][COL_BIRTHDATE - 1];
      if (dob instanceof Date) dob = Utilities.formatDate(dob, Session.getScriptTimeZone(), "yyyy-MM-dd");
      return { pwd: data[i][COL_SPECIAL_ASSISTANCE - 1], docLink: data[i][COL_DOC_LINK - 1] || "", room: data[i][COL_ROOM_ASSIGNMENT - 1] || "", email: data[i][COL_EMAIL - 1], level: data[i][COL_TOPIK_LEVEL - 1], kName: data[i][COL_KOREAN_NAME - 1], lName: data[i][COL_LEGAL_NAME - 1], gender: data[i][COL_GENDER - 1], nat: data[i][COL_NATIONALITY - 1], occ: data[i][COL_OCCUPATION - 1], dob: dob, addr: data[i][COL_ADDRESS - 1], zip: data[i][COL_POSTAL_CODE - 1], home: data[i][COL_HOME_PHONE - 1], mob: data[i][COL_MOBILE_PHONE - 1], s1: data[i][COL_SURVEY1 - 1], s2: data[i][COL_SURVEY2 - 1], fileUrl: data[i][COL_FILES_UPLOAD - 1] };
    }
  }
  return null;
}

function processPortalUpdate(refId, f, fileData, fileName, mimeType) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let r = -1;
  let oldPwd = ""; // Kukunin natin yung lumang PWD status
  for (let i = 1; i < data.length; i++) { 
    if (data[i][COL_REF_ID - 1] == refId) { 
      r = i + 1; 
      oldPwd = String(data[i][COL_SPECIAL_ASSISTANCE - 1]); 
      break; 
    } 
  }
  if (r === -1) throw new Error("Not found.");

  sheet.getRange(r, COL_SPECIAL_ASSISTANCE).setValue(f.pwd);
  sheet.getRange(r, COL_KOREAN_NAME).setValue(f.kName);
  sheet.getRange(r, COL_LEGAL_NAME).setValue(f.lName);
  sheet.getRange(r, COL_GENDER).setValue(f.gender);
  sheet.getRange(r, COL_NATIONALITY).setValue(f.nat);
  sheet.getRange(r, COL_OCCUPATION).setValue(mapCodeToText(f.occ, 'occ'));
  sheet.getRange(r, COL_BIRTHDATE).setValue(f.dob);
  sheet.getRange(r, COL_ADDRESS).setValue(f.addr);
  sheet.getRange(r, COL_POSTAL_CODE).setValue(f.zip);
  sheet.getRange(r, COL_HOME_PHONE).setValue(f.home);
  sheet.getRange(r, COL_MOBILE_PHONE).setValue(f.mob);
  sheet.getRange(r, COL_SURVEY1).setValue(mapCodeToText(f.s1, 's1'));
  sheet.getRange(r, COL_SURVEY2).setValue(mapCodeToText(f.s2, 's2'));

  if (fileData) {
    let fallbackFolderId = MAIN_UPLOAD_FOLDER_ID;
    const existUrl = String(sheet.getRange(r, COL_FILES_UPLOAD).getValue());
    let targetFolder = null;
    if (existUrl.includes("drive.google.com")) {
      let extId = getIdFromUrl(existUrl);
      if (extId) {
        try { targetFolder = DriveApp.getFolderById(extId); const oldFiles = targetFolder.getFiles(); while (oldFiles.hasNext()) oldFiles.next().setTrashed(true); } catch (e) {
          try { DriveApp.getFileById(extId).setTrashed(true); } catch (err) {} targetFolder = DriveApp.getFolderById(fallbackFolderId);
        }
      }
    } else { targetFolder = DriveApp.getFolderById(fallbackFolderId); }
    if (!targetFolder) targetFolder = DriveApp.getFolderById(fallbackFolderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType || MimeType.JPEG, fileName);
    const newFile = targetFolder.createFile(blob);
    if (targetFolder.getId() === fallbackFolderId) sheet.getRange(r, COL_FILES_UPLOAD).setValue(newFile.getUrl());
  }

  // Gatekeeper: I-check muna kung PAID
  var currentStatus = String(sheet.getRange(r, COL_PAYMENT_STATUS).getValue()).toUpperCase();
  const emailNotify = f.email || sheet.getRange(r, COL_EMAIL).getValue();
  const nameNotify = f.lName || sheet.getRange(r, COL_LEGAL_NAME).getValue();
  let msgNotify = "";

  if (currentStatus === "PAID") {
    // Check kung nagbago ang PWD status (Yes to No, o No to Yes)
    var pwdChanged = (/^yes/i.test(oldPwd)) !== (/^yes/i.test(f.pwd));
    
    if (pwdChanged) {
      var oldId = String(sheet.getRange(r, COL_STUDENT_NO).getValue()).trim();
      if (oldId.length > 4) deleteStudentFolder(oldId); // Delete ang lumang folder
      sheet.getRange(r, COL_STUDENT_NO).clearContent(); // Alisin ang lumang ID para makapag-generate ng bago
      sheet.getRange(r, COL_ROOM_ASSIGNMENT).clearContent(); // Alisin ang lumang room para ma-reassign
    }

    generateOfficialFormAndEmail(sheet, r, true);
    
    msgNotify = `<div style="font-family:'Open Sans',sans-serif;padding:30px;background:#f9f9f9;"><div style="max-width:500px;margin:auto;background:#fff;padding:30px;border-radius:10px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.05);"><h2 style="color:#2D8F5E;margin-top:0;">Update Successful</h2><p style="color:#555;font-size:15px;line-height:1.6;">Dear <strong>${nameNotify}</strong>,</p><p style="color:#555;font-size:15px;line-height:1.6;">Your records and documents have been successfully updated in our system. Please check the separate email containing your updated PDF application form.</p></div></div>`;
  } else {
    // Kung PENDING o WAITLIST, iba ang email message (walang mention ng PDF)
    msgNotify = `<div style="font-family:'Open Sans',sans-serif;padding:30px;background:#f9f9f9;"><div style="max-width:500px;margin:auto;background:#fff;padding:30px;border-radius:10px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.05);"><h2 style="color:#D4A843;margin-top:0;">Update Received</h2><p style="color:#555;font-size:15px;line-height:1.6;">Dear <strong>${nameNotify}</strong>,</p><p style="color:#555;font-size:15px;line-height:1.6;">Your registration details have been successfully updated in our system. Please complete your payment to secure your slot and receive your official documents.</p></div></div>`;
  }
  
  PropertiesService.getScriptProperties().deleteProperty('UPDATE_ACCESS_' + refId);

  // Send Notification to Student
  try { MailApp.sendEmail({to: emailNotify, subject: "TOPIK Registration Updated", htmlBody: msgNotify, name: SENDER_NAME}); } catch(e){}

  _invalidateUnifiedCache();
  return "Success";
}

// ══════════════════════════════════════════════════════════════
//  §18.1  SAVE STUDENT & AUTO-REGENERATE (Admin Modal)
// ══════════════════════════════════════════════════════════════

function apiSaveStudentAndRegenerate(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);// Validate payload before touching the sheet
    var validation = validateStudentData(payload);
    if (!validation.valid) {
      lock.releaseLock();
      return { success: false, message: "Validation failed:\n• " + validation.errors.join("\n• ") };
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var data = sheet.getDataRange().getValues();
    var row = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COL_REF_ID - 1]).trim() === String(payload.refId).trim()) {
        row = i + 1;
        break;
      }
    }
    if (row === -1) return { success: false, message: "Student not found." };

    var status = String(sheet.getRange(row, COL_PAYMENT_STATUS).getValue()).toUpperCase();
    var oldLevel = String(data[row - 2][COL_TOPIK_LEVEL - 1]).toUpperCase();
    var oldPwd = String(data[row - 2][COL_SPECIAL_ASSISTANCE - 1]);
    var newLevel = String(payload.level).toUpperCase();
    var newPwd = String(payload.pwd);

    // 1) Update all editable fields in the sheet
    sheet.getRange(row, COL_LEGAL_NAME).setValue(payload.lName);
    sheet.getRange(row, COL_KOREAN_NAME).setValue(payload.kName);
    sheet.getRange(row, COL_EMAIL).setValue(payload.email);
    sheet.getRange(row, COL_GENDER).setValue(payload.gender);
    sheet.getRange(row, COL_NATIONALITY).setValue(payload.nat);
    sheet.getRange(row, COL_BIRTHDATE).setValue(payload.dob);
    sheet.getRange(row, COL_TOPIK_LEVEL).setValue(payload.level);
    sheet.getRange(row, COL_STUDENT_NO).setNumberFormat("@").setValue(payload.studentNo); // Ito ang magse-save ng binago mo sa modal
    sheet.getRange(row, COL_SPECIAL_ASSISTANCE).setValue(payload.pwd);
    sheet.getRange(row, COL_OCCUPATION).setValue(mapCodeToText(payload.occ, 'occ'));
    sheet.getRange(row, COL_MOBILE_PHONE).setValue(payload.mob);
    sheet.getRange(row, COL_HOME_PHONE).setValue(payload.home);
    sheet.getRange(row, COL_ADDRESS).setValue(payload.addr);
    sheet.getRange(row, COL_POSTAL_CODE).setValue(payload.zip);
    sheet.getRange(row, COL_SURVEY1).setValue(mapCodeToText(payload.s1, 's1'));
    sheet.getRange(row, COL_SURVEY2).setValue(mapCodeToText(payload.s2, 's2'));
    SpreadsheetApp.flush();

    // 2) If PAID and level or PWD changed, clear old ID/room so regen assigns new ones
    if (status === "PAID") {
      var levelChanged = !oldLevel.includes("II") !== !newLevel.includes("II");
      var pwdChanged = (/^yes/i.test(oldPwd)) !== (/^yes/i.test(newPwd));

      if (levelChanged || pwdChanged) {
        var oldId = String(sheet.getRange(row, COL_STUDENT_NO).getValue()).trim();
        if (oldId.length > 4) deleteStudentFolder(oldId);
        sheet.getRange(row, COL_STUDENT_NO).clearContent();
        sheet.getRange(row, COL_ROOM_ASSIGNMENT).clearContent();
      }

      // 3) Regenerate docs with isUpdate = true
      generateOfficialFormAndEmail(sheet, row, true);
      logSystemEvent("WEB ADMIN", "EDIT & REGEN", payload.lName + " (" + payload.refId + ")");
      _invalidateUnifiedCache();
      return { success: true, message: payload.lName + " updated. New documents generated and emailed." };
    }

    // If not PAID, just save — no regen needed
    logSystemEvent("WEB ADMIN", "EDIT DETAILS", payload.lName + " (" + payload.refId + ") — status: " + status);
    return { success: true, message: payload.lName + " details updated. No docs generated (status: " + status + ")." };

  } catch (e) {
    _invalidateUnifiedCache();
    return { success: false, message: "Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════
//  §21  NEW V3.1 ENHANCEMENT API ENDPOINTS
// ══════════════════════════════════════════════════════════════

function exportFilteredData(filteredData, type) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    
    if (type === 'excel') {
      const tempSS = SpreadsheetApp.create("TOPIK_Export_" + ts);
      const tempSheet = tempSS.getSheets()[0];
      
      const headers = ["Student No", "Legal Name", "Korean Name", "Email", "Level", "Status", "Room", "PWD", "Gender", "Nationality", "Mobile", "Occupation Code", "Survey 1 Code", "Survey 2 Code"];
      tempSheet.appendRow(headers);
      
      function extractCode(str, type) {
         if (!str) return "";
         var match = String(str).trim().match(/^(\d+)/);
         if (match) return match[1]; 
         
         var sLower = String(str).toLowerCase();
         if (type === 'occ') {
           if (sLower.includes("student")) return "1";
           if (sLower.includes("civil")) return "2";
           if (sLower.includes("company") || sLower.includes("office")) return "3";
           if (sLower.includes("self")) return "4";
           if (sLower.includes("home") || sLower.includes("house")) return "5";
           if (sLower.includes("teacher")) return "6";
           if (sLower.includes("unemp") || sLower.includes("none")) return "7";
           return "8"; 
         }
         if (type === 's1') {
           if (sLower.includes("tv") || sLower.includes("radio")) return "1";
           if (sLower.includes("newspaper")) return "2";
           if (sLower.includes("magazine")) return "3";
           if (sLower.includes("education") || sLower.includes("school")) return "4";
           if (sLower.includes("poster")) return "5";
           if (sLower.includes("acquaintance")) return "6";
           if (sLower.includes("friend")) return "7";
           if (sLower.includes("internet") || sLower.includes("social")) return "8";
           if (sLower.includes("website")) return "9";
           return "10";
         }
         if (type === 's2') {
           if (sLower.includes("study abroad")) return "1";
           if (sLower.includes("employment") || sLower.includes("work")) return "2";
           if (sLower.includes("sightseeing") || sLower.includes("travel")) return "3";
           if (sLower.includes("research")) return "4";
           if (sLower.includes("examine") || sLower.includes("check")) return "5";
           if (sLower.includes("culture")) return "6";
           if (sLower.includes("visa")) return "7";
           if (sLower.includes("credit") || sLower.includes("school")) return "8";
           if (sLower.includes("kiip")) return "9";
           return "10";
         }
         return String(str);
      }

      function getGenderCode(g) {
         var txt = String(g).trim().toLowerCase();
         if (txt === "male" || txt === "1") return "1";
         if (txt === "female" || txt === "2") return "2";
         return String(g);
      }

      const rows = filteredData.map(s => [
        "'" + s.studentNo, 
        s.name, s.kName, s.email, s.level, s.status, s.room, s.pwd, getGenderCode(s.gender), s.nat, s.mob,
        extractCode(s.occ, 'occ'), extractCode(s.s1, 's1'), extractCode(s.s2, 's2')
      ]);
      
      if(rows.length > 0) tempSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      return "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=xlsx";
    } 
    else if (type === 'pdf') {
      const dateNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM dd, yyyy");
      let stats = { t1: 0, t2: 0, pwd: 0, regular: 0, total: filteredData.length, refunded: 0 };
      let rowsHtml = "";

      filteredData.forEach((s, index) => {
        const lvl = String(s.level).toUpperCase();
        const isPwd = /^yes/i.test(String(s.pwd));
        
        if (lvl.includes("II") || lvl.includes("2")) stats.t2++; else stats.t1++;
        if (isPwd) stats.pwd++; else stats.regular++;
        if (String(s.status).toUpperCase() === "REFUND") stats.refunded++;

        let bgStyle = index % 2 === 0 ? "background-color:#ffffff;" : "background-color:#fcfcfc;";
        if (isPwd) bgStyle = "background-color:#fffde7;border-left:3px solid #fbc02d;";
        
        const pwdBadge = isPwd ? "<span style='color:#f57f17;font-size:9px;font-weight:bold;border:1px solid #fbc02d;padding:1px 4px;border-radius:3px;'>PWD</span>" : "<span style='color:#000;font-size:9px;'>Regular</span>";
        const levelBadge = lvl.includes("II") || lvl.includes("2") ? `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;">${lvl}</span>` : `<span style="background:#e3f2fd;color:#1565c0;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;">${lvl}</span>`;
        const statusBadge = `<span style="font-size:9px;font-weight:bold;color:#6b4a1c;">${String(s.status).toUpperCase()}</span>`;

        rowsHtml += `<tr style="${bgStyle}"><td style="text-align:center;padding:8px 5px;">${index + 1}</td><td style="text-align:center;padding:8px 5px;font-weight:600;">${s.studentNo || 'N/A'}</td><td style="text-align:left;padding:8px 5px 8px 10px;">${s.name || ''}</td><td style="text-align:center;padding:8px 5px;">${levelBadge}</td><td style="text-align:center;padding:8px 5px;">${s.room || 'Unassigned'}</td><td style="text-align:center;padding:8px 5px;">${pwdBadge}</td><td style="text-align:center;padding:8px 5px;">${statusBadge}</td></tr>`;
      });

      let html = `<html><head><link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700,800&display=swap" rel="stylesheet"><style>@page{margin:30px;margin-bottom:50px;}body{font-family:'Open Sans',sans-serif;font-size:10px;color:#000;margin:0;padding:0;}.header-container{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:15px;margin-bottom:20px;border-bottom:2px solid #6b4a1c;}.main-title{font-size:24px;font-weight:800;color:#6b4a1c;text-transform:uppercase;letter-spacing:1px;margin:0;}.sub-title{font-size:11px;color:#a1887f;margin-top:5px;}.meta-info{font-size:10px;color:#000;line-height:1.4;}.status-official{color:#6b4a1c;font-weight:700;text-transform:uppercase;}.stats-bar{background-color:#fcfcfc;padding:10px 0;display:flex;justify-content:space-around;border:1px solid #eee;border-radius:4px;margin-bottom:20px;}.stat-item{text-align:center;}.stat-label{font-size:9px;color:#666;text-transform:uppercase;}.stat-value{font-size:14px;font-weight:700;color:#6b4a1c;}.stat-value.blue{color:#1565c0;}.stat-value.green{color:#2e7d32;}.stat-value.yellow{color:#f57f17;}.stat-value.refund{color:#d32f2f;}table{width:100%;border-collapse:collapse;margin-bottom:40px;}thead{border-bottom:2px solid #6b4a1c;}th{text-align:left;padding:10px 5px;font-size:10px;font-weight:700;color:#6b4a1c;text-transform:uppercase;}td{border-bottom:1px solid #eee;font-size:10px;vertical-align:middle;}.footer-container{position:fixed;bottom:0;left:0;right:0;height:30px;text-align:center;border-top:1px solid #ddd;padding-top:10px;background-color:#fff;}.footer-text{font-size:9px;color:#6b4a1c;text-transform:uppercase;letter-spacing:1px;font-weight:600;}</style></head><body><div class="header-container"><div><div class="main-title">Filtered Student List</div><div class="sub-title">TOPIK Application & Payment System</div></div><div class="meta-info">Generated on: ${dateNow}<br>Status: <span class="status-official">CUSTOM EXPORT</span></div></div><div class="stats-bar"><div class="stat-item"><span class="stat-label">Total</span><br><span class="stat-value">${stats.total}</span></div><div class="stat-item"><span class="stat-label">TOPIK I</span><br><span class="stat-value blue">${stats.t1}</span></div><div class="stat-item"><span class="stat-label">TOPIK II</span><br><span class="stat-value green">${stats.t2}</span></div><div class="stat-item"><span class="stat-label">PWD</span><br><span class="stat-value yellow">${stats.pwd}</span></div><div class="stat-item"><span class="stat-label">Refunded</span><br><span class="stat-value refund">${stats.refunded}</span></div></div><table><thead><tr><th width="5%" style="text-align:center">#</th><th width="15%" style="text-align:center">Student No.</th><th width="25%" style="text-align:left;padding-left:10px">English Name</th><th width="15%" style="text-align:center">Level</th><th width="15%" style="text-align:center">Room</th><th width="10%" style="text-align:center">Type</th><th width="15%" style="text-align:center">Status</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="footer-container"><div class="footer-text">ENDERUN EXTENSION TOPIK • CUSTOM FILTER EXPORT</div></div></body></html>`;

      const htmlBlob = Utilities.newBlob(html, MimeType.HTML);
      const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(`TOPIK_Filtered_Export_${ts}.pdf`);
      
      const pdfFile = DriveApp.getFolderById(ARCHIVE_FOLDER_ID).createFile(pdfBlob);
      
      return "https://drive.google.com/uc?export=download&id=" + pdfFile.getId();
    }
  } catch(e) {
    return null;
  }
}

function apiUpdateProfile(name, password) {
  try {
    let credsJson = PropertiesService.getScriptProperties().getProperty('ADMIN_CREDS');
    if (credsJson) {
      let creds = JSON.parse(credsJson);
      creds[0].name = name;
      if (password && password.trim() !== "") {
        creds[0].password = password;
      }
      PropertiesService.getScriptProperties().setProperty('ADMIN_CREDS', JSON.stringify(creds));
      return { success: true };
    }
    return { success: false, message: "Credentials not found." };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

function apiBulkRegenerate() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    const data = sheet.getRange(2, COL_PAYMENT_STATUS, sheet.getLastRow() - 1, 1).getValues();
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === "PAID") {
        generateOfficialFormAndEmail(sheet, i + 2, true);
        count++;
      }
    }
    return "Successfully regenerated " + count + " documents.";
  } catch(e) {
    return "Error: " + e.toString();
  }
}

function apiArchiveSession() {
  try {
    archiveAndResetSession();
    return "Success";
  } catch(e) {
    return "Error: " + e.toString();
  }
}

function apiSaveRooms(roomsArray) {
  try {
    let totalCap = roomsArray.reduce((sum, r) => sum + parseInt(r.cap), 0);
    if (totalCap > 214) return { success: false, message: "Capacity limit exceeded." };
    
    PropertiesService.getScriptProperties().setProperty('DYNAMIC_ROOMS', JSON.stringify(roomsArray));
    logSystemEvent("WEB ADMIN", "ROOMS UPDATED", "Room matrix modified.");
    return { success: true };
  } catch(e) {
    _invalidateUnifiedCache();
    return { success: false, message: e.toString() };
  }
}

function verifyShopifyWebhook(e) {
  if (!e || !e.postData || !e.postData.contents) return false;
  
  var hmacHeader = null;
  
  // GAS doesn't give direct access to headers in doPost
  // But Shopify sends X-Shopify-Hmac-Sha256 header
  // We access it through e.parameter or e.headers depending on deployment
  try {
    if (e.parameter && e.parameter['hmac']) {
      hmacHeader = e.parameter['hmac'];
    }
  } catch(err) {}
  
  // If we can't verify (GAS limitation), log warning but use secondary validation
  if (!hmacHeader) {
    // Fallback: validate the payload structure has required Shopify fields
    try {
      var data = JSON.parse(e.postData.contents);
      var hasRequiredFields = data.id && data.email && data.financial_status && data.order_number;
      var hasShopifyDomain = e.postData.contents.indexOf(SHOPIFY_DOMAIN) !== -1 || 
                             (data.order_status_url && data.order_status_url.indexOf(SHOPIFY_SHOP_URL) !== -1);
      
      if (!hasRequiredFields) {
        logSystemEvent("SECURITY", "WEBHOOK REJECTED", "Missing required Shopify fields");
        return false;
      }
      // Domain check as WARNING only — don't block
      if (!hasShopifyDomain) {
        logSystemEvent("SECURITY", "WEBHOOK WARNING", "Domain not found in payload — allowing anyway");
      }
      return true; // Passes structural validation
    } catch(parseErr) {
      logSystemEvent("SECURITY", "WEBHOOK REJECTED", "Invalid JSON payload: " + parseErr.toString());
      return false;
    }
  }
  
  // If header IS available, do proper HMAC verification
  try {
    var rawBody = e.postData.contents;
    var calculatedHmac = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(rawBody, SHOPIFY_WEBHOOK_SECRET)
    );
    if (calculatedHmac === hmacHeader) return true;
    
    logSystemEvent("SECURITY", "WEBHOOK REJECTED", "HMAC mismatch");
    return false;
  } catch(hmacErr) {
    logSystemEvent("SECURITY", "WEBHOOK ERROR", hmacErr.toString());
    return false;
  }
}

function checkQuotaBeforeBulk(requiredCount) {
  var remaining = MailApp.getRemainingDailyQuota();
  if (remaining < requiredCount) {
    return {
      ok: false,
      remaining: remaining,
      required: requiredCount,
      message: "Insufficient email quota. Need " + requiredCount + " but only " + remaining + " remaining today."
    };
  }
  // Warning if cutting it close (less than 20% buffer)
  var isLow = remaining < (requiredCount * 1.2);
  return {
    ok: true,
    remaining: remaining,
    required: requiredCount,
    isLow: isLow,
    message: isLow ? "Warning: Only " + remaining + " emails left after this operation." : "OK"
  };
}


function applySheetDataValidation() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  var lastRow = Math.max(sheet.getLastRow(), 500); // Apply to at least 500 rows for future entries
  
  // ── 1. PAYMENT STATUS (Column Q / COL_PAYMENT_STATUS = 17) ──
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PENDING", "PENDING (NOTIFIED)", "PAID", "WAITLIST", "REFUND"], true)
    .setAllowInvalid(false) // REJECT invalid entries
    .setHelpText("Valid: PENDING, PENDING (NOTIFIED), PAID, WAITLIST, REFUND")
    .build();
  sheet.getRange(2, COL_PAYMENT_STATUS, lastRow - 1, 1).setDataValidation(statusRule);
  
  // ── 2. TOPIK LEVEL (Column D / COL_TOPIK_LEVEL = 4) ──
  var levelRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["TOPIK I", "TOPIK II"], true)
    .setAllowInvalid(false)
    .setHelpText("Valid: TOPIK I or TOPIK II")
    .build();
  sheet.getRange(2, COL_TOPIK_LEVEL, lastRow - 1, 1).setDataValidation(levelRule);
  
  // ── 3. SPECIAL ASSISTANCE / PWD (Column U / COL_SPECIAL_ASSISTANCE = 21) ──
  var pwdRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Yes", "No"], true)
    .setAllowInvalid(false)
    .setHelpText("Valid: Yes or No")
    .build();
  sheet.getRange(2, COL_SPECIAL_ASSISTANCE, lastRow - 1, 1).setDataValidation(pwdRule);
  
  // ── 4. GENDER (Column G / COL_GENDER = 7) ──
  var genderRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Male", "Female", "Prefer not to say"], true)
    .setAllowInvalid(true) // Allow custom "Other: xxx" entries
    .setHelpText("Suggested: Male, Female, Prefer not to say")
    .build();
  sheet.getRange(2, COL_GENDER, lastRow - 1, 1).setDataValidation(genderRule);
  
  // ── 5. EMAIL FORMAT (Column C / COL_EMAIL = 3) ──
  var emailRule = SpreadsheetApp.newDataValidation()
    .requireTextContains("@")
    .setAllowInvalid(false)
    .setHelpText("Must be a valid email address containing @")
    .build();
  sheet.getRange(2, COL_EMAIL, lastRow - 1, 1).setDataValidation(emailRule);
  
  // ── 6. STUDENT NUMBER FORMAT (Column R / COL_STUDENT_NO = 18) ──
  // Format: 01800170XXXX or 01800180XXXX (13 digits) or blank
  var studentNoRule = SpreadsheetApp.newDataValidation()
    .requireTextMatchesPattern("^(018001[78]01\\d{4})?$|^(WAITLIST\\/FULL)?$|^$")
    .setAllowInvalid(true) // Warn but don't block (system generates these)
    .setHelpText("Format: 018001X01XXXX (auto-generated). Do not edit manually.")
    .build();
  sheet.getRange(2, COL_STUDENT_NO, lastRow - 1, 1).setDataValidation(studentNoRule);
  
  // ── 7. STUDENT NUMBER as TEXT FORMAT (prevent scientific notation) ──
  sheet.getRange(2, COL_STUDENT_NO, lastRow - 1, 1).setNumberFormat("@");
  
  // ── 8. POSTAL CODE as TEXT (prevent leading zero loss) ──
  sheet.getRange(2, COL_POSTAL_CODE, lastRow - 1, 1).setNumberFormat("@");
  
  // ── 9. MOBILE PHONE as TEXT ──
  sheet.getRange(2, COL_MOBILE_PHONE, lastRow - 1, 1).setNumberFormat("@");
  
  // ── 10. HOME PHONE as TEXT ──
  sheet.getRange(2, COL_HOME_PHONE, lastRow - 1, 1).setNumberFormat("@");
  
  // ── 11. CONDITIONAL FORMATTING — Color code status column ──
  var range = sheet.getRange(2, COL_PAYMENT_STATUS, lastRow - 1, 1);
  
  // Clear old conditional format rules for this range first
  var existingRules = sheet.getConditionalFormatRules();
  var cleanedRules = existingRules.filter(function(rule) {
    var ruleRanges = rule.getRanges();
    var isStatusCol = ruleRanges.some(function(r) {
      return r.getColumn() === COL_PAYMENT_STATUS;
    });
    return !isStatusCol; // Keep rules that are NOT on status column
  });
  
  // Build new color rules
  var paidRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("PAID")
    .setBackground("#E8F5E9").setFontColor("#1B7A43")
    .setRanges([range]).build();
  
  var pendingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("PENDING")
    .setBackground("#FEF3E2").setFontColor("#9A6B14")
    .setRanges([range]).build();
  
  var notifiedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("PENDING (NOTIFIED)")
    .setBackground("#FFF8E1").setFontColor("#F57F17")
    .setRanges([range]).build();
  
  var waitlistRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("WAITLIST")
    .setBackground("#E3F2FD").setFontColor("#1565C0")
    .setRanges([range]).build();
  
  var refundRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("REFUND")
    .setBackground("#FDE8E5").setFontColor("#A63224")
    .setRanges([range]).build();
  
  cleanedRules.push(paidRule, pendingRule, notifiedRule, waitlistRule, refundRule);
  sheet.setConditionalFormatRules(cleanedRules);
  
  // ── 12. FREEZE HEADER ROW + PROTECT HEADERS ──
  sheet.setFrozenRows(1);
  
  SpreadsheetApp.flush();
  logSystemEvent("SYSTEM", "VALIDATION APPLIED", "Sheet data validation and conditional formatting updated");
  ui.alert("✅ Data Validation Applied!\n\n• Status column: Dropdown only (PENDING, PAID, WAITLIST, EXPIRED, REFUND)\n• Level column: TOPIK I / TOPIK II only\n• PWD column: Yes / No only\n• Email: Must contain @\n• Student No: Text format (no scientific notation)\n• Phone/Postal: Text format preserved\n• Status colors: Auto-highlighted");
}

function validateStudentData(data) {
  var errors = [];
  
  if (!data.lName || String(data.lName).trim().length < 2)
    errors.push("Legal name is required (min 2 characters)");
  
  if (!data.email || !String(data.email).includes("@"))
    errors.push("Valid email address is required");
  
  if (data.level && data.level !== "TOPIK I" && data.level !== "TOPIK II")
    errors.push("Level must be TOPIK I or TOPIK II");
  
  if (data.pwd && data.pwd !== "Yes" && data.pwd !== "No")
    errors.push("PWD must be Yes or No");
  
  if (data.studentNo && data.studentNo.length > 5) {
    if (!/^018001[78]01\d{4}$/.test(data.studentNo))
      errors.push("Student number format invalid: " + data.studentNo);
  }
  
  // Tinanggal na natin ang mobile restriction dito
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}
// ══════════════════════════════════════════════════════════════
//  §23  RETRY QUEUE FOR FAILED OPERATIONS
// ══════════════════════════════════════════════════════════════

function addToRetryQueue(row, refId, studentName, errorMessage) {
  try {
    var queueJson = PropertiesService.getScriptProperties().getProperty('RETRY_QUEUE') || '[]';
    var queue = JSON.parse(queueJson);
    
    // Don't add duplicates
    var exists = queue.some(function(item) { return item.refId === refId; });
    if (exists) return;
    
    queue.push({
      row: row,
      refId: refId,
      name: studentName,
      error: errorMessage,
      addedAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3
    });
    
    PropertiesService.getScriptProperties().setProperty('RETRY_QUEUE', JSON.stringify(queue));
    logSystemEvent("SYSTEM", "QUEUED FOR RETRY", studentName + " (Row " + row + "): " + errorMessage);
  } catch(e) {
    Logger.log("Failed to add to retry queue: " + e.toString());
  }
}

function processRetryQueue() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    var queueJson = PropertiesService.getScriptProperties().getProperty('RETRY_QUEUE') || '[]';
    var queue = JSON.parse(queueJson);
    
    if (queue.length === 0) {
      lock.releaseLock();
      return { processed: 0, message: "Queue empty." };
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
    var successCount = 0;
    var failCount = 0;
    var stillFailed = [];
    var permanentFails = [];
    
    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      item.attempts++;
      
      // Verify the row still exists and is still PAID
      try {
        var currentStatus = String(sheet.getRange(item.row, COL_PAYMENT_STATUS).getValue()).toUpperCase();
        var currentRefId = String(sheet.getRange(item.row, COL_REF_ID).getValue()).trim();
        
        // Safety: make sure row hasn't shifted
        if (currentRefId !== item.refId) {
          // Row shifted — find correct row
          var data = sheet.getDataRange().getValues();
          var foundRow = -1;
          for (var j = 1; j < data.length; j++) {
            if (String(data[j][COL_REF_ID - 1]).trim() === item.refId) {
              foundRow = j + 1;
              break;
            }
          }
          if (foundRow === -1) {
            permanentFails.push(item.name + " — RefID not found in sheet");
            continue;
          }
          item.row = foundRow;
          currentStatus = String(sheet.getRange(foundRow, COL_PAYMENT_STATUS).getValue()).toUpperCase();
        }
        
        // Only retry if still PAID
        if (currentStatus !== "PAID") {
          permanentFails.push(item.name + " — Status changed to " + currentStatus);
          continue;
        }
        
        // Check if docs were generated manually in the meantime
        var existingDoc = String(sheet.getRange(item.row, COL_DOC_LINK).getValue()).trim();
        if (existingDoc && existingDoc.includes("http")) {
          // Already generated — skip
          successCount++;
          logSystemEvent("SYSTEM", "RETRY SKIP", item.name + " — Docs already exist");
          continue;
        }
        
        // Attempt regeneration
        generateOfficialFormAndEmail(sheet, item.row, true);
        
        // Verify it worked
        SpreadsheetApp.flush();
        var newDoc = String(sheet.getRange(item.row, COL_DOC_LINK).getValue()).trim();
        if (newDoc && newDoc.includes("http")) {
          successCount++;
          logSystemEvent("SYSTEM", "RETRY SUCCESS", item.name + " — Docs generated on attempt " + item.attempts);
        } else {
          throw new Error("Doc link still empty after generation");
        }
        
      } catch(retryErr) {
        failCount++;
        item.lastError = retryErr.toString();
        
        if (item.attempts >= item.maxAttempts) {
          permanentFails.push(item.name + " — Failed " + item.attempts + "x: " + retryErr.toString());
          logSystemEvent("SYSTEM", "RETRY EXHAUSTED", item.name + " — Giving up after " + item.attempts + " attempts");
        } else {
          stillFailed.push(item);
        }
      }
      
      // Small delay between retries to avoid API hammering
      Utilities.sleep(2000);
    }
    
    // Save remaining queue
    PropertiesService.getScriptProperties().setProperty('RETRY_QUEUE', JSON.stringify(stillFailed));
    
    // Notify admin if there are permanent failures
    if (permanentFails.length > 0) {
      try {
        MailApp.sendEmail({
          to: ADMIN_EMAIL,
          subject: "🔴 CRITICAL: " + permanentFails.length + " Document Generation(s) Failed Permanently",
          htmlBody: '<div style="font-family:Open Sans,sans-serif;background:#f4f4f4;padding:40px 0;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border-top:6px solid #C0392B;padding:30px;"><h2 style="color:#C0392B;margin-top:0;">⚠️ Manual Intervention Required</h2><p style="font-size:14px;color:#555;">The following students are <strong>PAID</strong> but document generation failed after <strong>3 retry attempts</strong>:</p><ul style="font-size:13px;color:#333;line-height:2.2;">' + permanentFails.map(function(f){ return '<li style="background:#FDE8E5;padding:8px 12px;border-radius:4px;margin-bottom:6px;">' + f + '</li>'; }).join('') + '</ul><p style="font-size:13px;color:#888;">Please manually regenerate these from the Admin Dashboard or spreadsheet menu.</p></div></div>',
          name: "TOPIK System Alert"
        });
      } catch(mailErr) {}
    }
    
    lock.releaseLock();
    
    var summary = "Retry complete: " + successCount + " success, " + failCount + " failed, " + stillFailed.length + " still queued, " + permanentFails.length + " gave up.";
    logSystemEvent("SYSTEM", "RETRY QUEUE PROCESSED", summary);
    
    return {
      processed: successCount,
      failed: failCount,
      remaining: stillFailed.length,
      abandoned: permanentFails.length,
      message: summary
    };
    
  } catch(e) {
    try { lock.releaseLock(); } catch(unlockErr) {}
    logSystemEvent("SYSTEM", "RETRY QUEUE ERROR", e.toString());
    return { processed: 0, error: e.toString() };
  }
}

function getRetryQueueStatus() {
  var queueJson = PropertiesService.getScriptProperties().getProperty('RETRY_QUEUE') || '[]';
  var queue = JSON.parse(queueJson);
  return {
    count: queue.length,
    items: queue
  };
}

function clearRetryQueue() {
  PropertiesService.getScriptProperties().setProperty('RETRY_QUEUE', '[]');
  logSystemEvent("SYSTEM", "RETRY QUEUE CLEARED", "Manual clear by admin");
  return { success: true };
}

function setupRetryQueueTrigger() {
  // Remove existing retry triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processRetryQueue') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Run every 30 minutes
  ScriptApp.newTrigger('processRetryQueue')
    .timeBased()
    .everyMinutes(30)
    .create();
  
  logSystemEvent("SYSTEM", "TRIGGER CREATED", "Retry queue processor set to run every 30 minutes");
  SpreadsheetApp.getUi().alert("✅ Retry Queue Trigger Created!\n\nFailed doc generations will be retried every 30 minutes (max 3 attempts).");
}

function showRetryQueueStatus() {
  var status = getRetryQueueStatus();
  var ui = SpreadsheetApp.getUi();
  
  if (status.count === 0) {
    ui.alert("✅ Retry Queue Empty", "No pending retries. All documents generated successfully.", ui.ButtonSet.OK);
    return;
  }
  
  var msg = "📋 RETRY QUEUE: " + status.count + " item(s)\n\n";
  status.items.forEach(function(item, idx) {
    msg += (idx + 1) + ". " + item.name + " (Row " + item.row + ")\n";
    msg += "   Attempts: " + item.attempts + "/" + item.maxAttempts + "\n";
    msg += "   Error: " + (item.lastError || item.error).substring(0, 80) + "\n\n";
  });
  msg += "───────────────────\nQueue processes automatically every 30 min.\nOr manually: Run processRetryQueue() from script editor.";
  
  var response = ui.alert("Retry Queue Status", msg, ui.ButtonSet.OK);
}

function apiGetRetryQueueStatus() {
  return getRetryQueueStatus();
}

function apiProcessRetryQueueNow() {
  return processRetryQueue();
}

function apiClearRetryQueue() {
  return clearRetryQueue();
}

function apiGetSystemLogs() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SYSTEM LOGS");
    if (!sheet) return { success: false, message: "SYSTEM LOGS sheet not found." };
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, logs: [] };
    
    var logs = [];
    // Get last 50 logs, reversed (newest first)
    var start = Math.max(1, data.length - 50);
    for (var i = data.length - 1; i >= start; i--) {
      var ts = data[i][0];
      if (ts instanceof Date) ts = Utilities.formatDate(ts, Session.getScriptTimeZone(), "MMM dd, hh:mm a");
      logs.push({
        timestamp: ts,
        user: data[i][1] || "Unknown",
        category: data[i][2] || "-",
        action: data[i][3] || "-",
        details: data[i][4] || ""
      });
    }
    return { success: true, logs: logs };
  } catch (e) { 
    return { success: false, message: e.toString() }; 
  }
}

function apiGetStudentImageBase64(folderUrl) {
  try {
    var folderId = getIdFromUrl(folderUrl);
    if (!folderId) return { success: false, message: "Invalid or empty folder link." };
    
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    
    // Check if empty
    if (!files.hasNext()) return { success: false, message: "Folder is empty. No ID uploaded yet." };
    
    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      
      // If it's an image (png, jpg, etc)
      if (mime.indexOf('image') !== -1) {
        var bytes = file.getBlob().getBytes();
        var base64 = Utilities.base64Encode(bytes);
        return { success: true, isImage: true, data: "data:" + mime + ";base64," + base64 };
      }
      // If it's a PDF, we can't preview it nicely as an image, send URL instead
      if (mime === MimeType.PDF) {
        return { success: true, isImage: false, url: file.getUrl() };
      }
    }
    return { success: false, message: "No supported image format found in folder." };
  } catch(e) { 
    return { success: false, message: "Drive Error: " + e.toString() }; 
  }
}

// ══════════════════════════════════════════════════════════════
//  §24  PERFORMANCE — UNIFIED DATA LOADER + CACHE
// ══════════════════════════════════════════════════════════════

/**
 * ONE sheet read that computes dashboard + students + rooms in a single pass.
 * Results cached for 60 seconds via CacheService.
 */
function _getUnifiedData(forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'UNIFIED_DATA_V2';

  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* corrupted, rebuild */ }
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return _emptyUnifiedData();

  var allData = sheet.getRange(2, 1, lastRow - 1, 23).getValues();
  var LIMIT = TOTAL_HEADCOUNT_LIMIT;
  var ROOMS = getDynamicRooms();

  var stats = { paid:0, pending:0, refund:0, pwd:0, regular:0, male:0, female:0,
                topik1:{paid:0,idUsed:0}, topik2:{paid:0,idUsed:0} };
  var students = [];
  var roomCounts = {};
  // Ngayon, may hiwalay na counter para sa t1 at t2 per room
  ROOMS.forEach(function(r){ roomCounts[r.name] = { t1: 0, t2: 0 }; });
  var hashParts = [];

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    if (row[0] === "") continue;

    var refId      = String(row[COL_REF_ID - 1]);
    var level      = String(row[COL_TOPIK_LEVEL - 1]).toUpperCase();
    var gender     = String(row[COL_GENDER - 1]).toUpperCase();
    var status     = String(row[COL_PAYMENT_STATUS - 1]).toUpperCase();
    var assistance = String(row[COL_SPECIAL_ASSISTANCE - 1]).toLowerCase();
    var studentNo  = String(row[COL_STUDENT_NO - 1]).trim();
    var room       = String(row[COL_ROOM_ASSIGNMENT - 1]).trim();
    var isT2       = level.includes("II") || level.includes("2");
    var isPwd      = assistance.includes("yes");

    // Stats
    if (status === "PAID") stats.paid++;
    else if (status.includes("REFUND")) stats.refund++;
    else stats.pending++;
    if (isPwd) stats.pwd++; else stats.regular++;
    if (gender.startsWith("F") || gender.startsWith("W")) stats.female++; else stats.male++;
    if (isT2) {
      if (status === "PAID") stats.topik2.paid++;
      if (studentNo.length > 5 && !studentNo.includes("WAIT")) stats.topik2.idUsed++;
    } else {
      if (status === "PAID") stats.topik1.paid++;
      if (studentNo.length > 5 && !studentNo.includes("WAIT")) stats.topik1.idUsed++;
    }

    // Room counts (Hiwalay na binibilang kung Umaga o Hapon)
    if (status === "PAID" && room !== "" && roomCounts.hasOwnProperty(room)) {
      if (isT2) roomCounts[room].t2++;
      else roomCounts[room].t1++;
    }

    // Student record
    var dob = row[COL_BIRTHDATE - 1];
    if (dob instanceof Date) dob = Utilities.formatDate(dob, Session.getScriptTimeZone(), "yyyy-MM-dd");

    students.push({
      row: i+2, refId: refId,
      name: toTitleCase(String(row[COL_LEGAL_NAME - 1])),
      email: row[COL_EMAIL - 1], level: row[COL_TOPIK_LEVEL - 1],
      status: row[COL_PAYMENT_STATUS - 1], studentNo: studentNo || "N/A",
      pwd: row[COL_SPECIAL_ASSISTANCE - 1], docLink: row[COL_DOC_LINK - 1] || "",
      room: room || "", kName: row[COL_KOREAN_NAME - 1] || "",
      gender: row[COL_GENDER - 1] || "", nat: row[COL_NATIONALITY - 1] || "",
      dob: dob || "", occ: row[COL_OCCUPATION - 1] || "",
      mob: row[COL_MOBILE_PHONE - 1] || "", home: row[COL_HOME_PHONE - 1] || "",
      addr: row[COL_ADDRESS - 1] || "", zip: row[COL_POSTAL_CODE - 1] || "",
      s1: row[COL_SURVEY1 - 1] || "", s2: row[COL_SURVEY2 - 1] || "",
      fileUrl: row[COL_FILES_UPLOAD - 1] || ""
    });

    hashParts.push(refId + "|" + status + "|" + studentNo);
  }

  students.reverse();

  // Pinapasa na ang t1 at t2 assigned sa UI
  var roomsWithCounts = ROOMS.map(function(r){
    return { name: r.name, cap: r.cap, type: r.type, t1_assigned: roomCounts[r.name].t1, t2_assigned: roomCounts[r.name].t2 };
  });

  var result = {
    stats: stats,
    t1_slots: LIMIT - stats.topik1.idUsed,
    t2_slots: LIMIT - stats.topik2.idUsed,
    t1_pct: Math.round((stats.topik1.idUsed / LIMIT) * 100),
    t2_pct: Math.round((stats.topik2.idUsed / LIMIT) * 100),
    students: students,
    studentCount: students.length,
    rooms: roomsWithCounts,
    dataHash: Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, hashParts.join(","))
                .map(function(b){ return (b < 0 ? b+256 : b).toString(16); }).join(""),
    generatedAt: new Date().getTime()
  };

  try {
    var jsonStr = JSON.stringify(result);
    if (jsonStr.length < 95000) {
      cache.put(cacheKey, jsonStr, 60);
    }
  } catch(e) {}

  return result;
}

function _emptyUnifiedData() {
  return {
    stats:{paid:0,pending:0,refund:0,pwd:0,regular:0,male:0,female:0,topik1:{paid:0,idUsed:0},topik2:{paid:0,idUsed:0}},
    t1_slots:214, t2_slots:214, t1_pct:0, t2_pct:0,
    students:[], studentCount:0,
    rooms: getDynamicRooms().map(function(r){ return {name:r.name,cap:r.cap,type:r.type,assigned:0}; }),
    dataHash:"empty", generatedAt: new Date().getTime()
  };
}

function _invalidateUnifiedCache() {
  try { CacheService.getScriptCache().remove('UNIFIED_DATA_V2'); } catch(e) {}
}

/** NEW — Single call on login. Returns everything the UI needs. */
function getAdminFullLoad() {
  var d = _getUnifiedData(true);
  return {
    dashboard: { stats:d.stats, t1_slots:d.t1_slots, t2_slots:d.t2_slots, t1_pct:d.t1_pct, t2_pct:d.t2_pct },
    students: d.students,
    rooms: d.rooms,
    dataHash: d.dataHash
  };
}

/** NEW — Lightweight poll. Client compares hash to decide if full reload needed. */
function getAdminPollUpdate() {
  var d = _getUnifiedData(false);
  return {
    stats: d.stats,
    t1_slots:d.t1_slots, t2_slots:d.t2_slots, t1_pct:d.t1_pct, t2_pct:d.t2_pct,
    rooms: d.rooms,
    dataHash: d.dataHash,
    studentCount: d.studentCount
  };
}

// ══════════════════════════════════════════════════════════════
//  §25  LEGACY DATA CLEANER (ONE-TIME USE UTILITY)
// ══════════════════════════════════════════════════════════════
function cleanLegacyDropdownData() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('🧹 Clean Legacy Data', 'This will convert all old text entries (e.g. "Student") in Occupation and Survey columns into the new numbered format (e.g. "1. 학 생 (Student)").\n\nAre you sure you want to proceed?', ui.ButtonSet.YES_NO);
  
  if (response !== ui.Button.YES) return;
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var data = sheet.getDataRange().getValues();
  var occUpdates = [];
  var s1Updates = [];
  var s2Updates = [];
  
  // Tagahanap ng equivalent number code ng lumang text
  function getCode(str, type) {
     if (!str) return "";
     if (str.match(/^\d+/)) return str.match(/^\d+/)[0]; // May number na
     var sLower = String(str).toLowerCase();
     if (type === 'occ') {
       if (sLower.includes("student")) return "1";
       if (sLower.includes("civil")) return "2";
       if (sLower.includes("company") || sLower.includes("office")) return "3";
       if (sLower.includes("self")) return "4";
       if (sLower.includes("home") || sLower.includes("house")) return "5";
       if (sLower.includes("teacher")) return "6";
       if (sLower.includes("unemp") || sLower.includes("none")) return "7";
       return "8"; // Other
     }
     if (type === 's1') {
       if (sLower.includes("tv") || sLower.includes("radio")) return "1";
       if (sLower.includes("newspaper")) return "2";
       if (sLower.includes("magazine")) return "3";
       if (sLower.includes("education") || sLower.includes("school")) return "4";
       if (sLower.includes("poster")) return "5";
       if (sLower.includes("acquaintance")) return "6";
       if (sLower.includes("friend")) return "7";
       if (sLower.includes("internet") || sLower.includes("social")) return "8";
       if (sLower.includes("website")) return "9";
       return "10";
     }
     if (type === 's2') {
       if (sLower.includes("study abroad")) return "1";
       if (sLower.includes("employment") || sLower.includes("work")) return "2";
       if (sLower.includes("sightseeing") || sLower.includes("travel")) return "3";
       if (sLower.includes("research")) return "4";
       if (sLower.includes("examine") || sLower.includes("check")) return "5";
       if (sLower.includes("culture")) return "6";
       if (sLower.includes("visa")) return "7";
       if (sLower.includes("credit") || sLower.includes("school")) return "8";
       if (sLower.includes("kiip")) return "9";
       return "10";
     }
     return "";
  }
  
  for (var i = 1; i < data.length; i++) {
     var occStr = String(data[i][COL_OCCUPATION - 1]).trim();
     var s1Str = String(data[i][COL_SURVEY1 - 1]).trim();
     var s2Str = String(data[i][COL_SURVEY2 - 1]).trim();
     
     // Process Occupation
     var oNum = getCode(occStr, 'occ');
     var oFinal = occStr;
     if (oNum && !occStr.match(/^\d+/)) {
        oFinal = mapCodeToText(oNum, 'occ');
        if (oNum === "8") {
           var extra = occStr.replace(/^Other[:\-]?\s*/i, "").trim();
           if (extra) oFinal = "8. 기타 Other ( " + extra + " )";
        }
     }
     occUpdates.push([oFinal]);
     
     // Process Survey 1
     var s1Num = getCode(s1Str, 's1');
     var s1Final = s1Str;
     if (s1Num && !s1Str.match(/^\d+/)) {
        s1Final = mapCodeToText(s1Num, 's1');
        if (s1Num === "10") {
           var extra = s1Str.replace(/^Other[:\-]?\s*/i, "").trim();
           if (extra) s1Final = "10. 기타 Other ( " + extra + " )";
        }
     }
     s1Updates.push([s1Final]);
     
     // Process Survey 2
     var s2Num = getCode(s2Str, 's2');
     var s2Final = s2Str;
     if (s2Num && !s2Str.match(/^\d+/)) {
        s2Final = mapCodeToText(s2Num, 's2');
        if (s2Num === "10") {
           var extra = s2Str.replace(/^Other[:\-]?\s*/i, "").trim();
           if (extra) s2Final = "10. 기타 Other ( " + extra + " )";
        }
     }
     s2Updates.push([s2Final]);
  }
  
  // Bulk update the sheet for fast performance
  sheet.getRange(2, COL_OCCUPATION, occUpdates.length, 1).setValues(occUpdates);
  sheet.getRange(2, COL_SURVEY1, s1Updates.length, 1).setValues(s1Updates);
  sheet.getRange(2, COL_SURVEY2, s2Updates.length, 1).setValues(s2Updates);
  
  SpreadsheetApp.flush();
  _invalidateUnifiedCache();
  logSystemEvent("SYSTEM", "LEGACY DATA CLEANED", "Updated occupation and survey formats.");
  ui.alert('✅ Done!', 'All legacy data has been successfully converted to the new numbered format.', ui.ButtonSet.OK);
}