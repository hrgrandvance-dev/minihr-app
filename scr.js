/**
 * ============================================================
 * Mini HR App — Entry Point
 * ============================================================
 */

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (parseErr) {
    return jsonOutput({ ok: false, error: 'invalid_json' });
  }

  try {
    const clientIp = e.parameter ? e.parameter['x-forwarded-for'] : 'unknown';
    const userId = body.lineUserId || clientIp;
    if (isRateLimited(userId)) {
      logWarn('doPost', 'rate_limited', { userId, action: body.action }, userId);
      return jsonOutput({ ok: false, error: 'rate_limited', message: 'ลองใหม่ในไม่กี่วินาทีต่อมา' });
    }

    if (body.events && Array.isArray(body.events)) {
      return handleLineWebhook(body.events);
    }

    const action = body.action;
    if (!action) {
      return jsonOutput({ ok: false, error: 'missing_action' });
    }

    return routeAction(action, body);

  } catch (err) {
    logError('doPost', err.message, { body, stack: err.stack });
    return jsonOutput({ ok: false, error: 'internal_error', message: err.message });
  }
}

function doGet(e) {
  const page = (e.parameter && e.parameter.page) || 'home';
  const allowedPages = [
    'register', 'checkin', 'leave', 'ot', 'balance',
    'hr-tools', 'approval-inbox', 'evidence', 'response', 'home'
  ];

  if (!allowedPages.includes(page)) {
    return HtmlService.createHtmlOutput('Page not found').setTitle('404');
  }

  try {
    const template = HtmlService.createTemplateFromFile(page);
    template.SCRIPT_URL = ScriptApp.getService().getUrl();
    template.LIFF_ID = getLiffIdForPage(page);
    return template.evaluate()
      .setTitle('Mini HR App — ' + page)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
  } catch (err) {
    logError('doGet', err.message, { page });
    return HtmlService.createHtmlOutput('Error loading page: ' + err.message);
  }
}

function getLiffIdForPage(page) {
  const props = PropertiesService.getScriptProperties();
  const map = {
    'register': 'LIFF_ID_REGISTER',
    'checkin': 'LIFF_ID_CHECKIN',
    'leave': 'LIFF_ID_LEAVE',
    'ot': 'LIFF_ID_OT',
    'balance': 'LIFF_ID_BALANCE',
    'hr-tools': 'LIFF_ID_HR_TOOLS',
    'approval-inbox': 'LIFF_ID_APPROVAL',
    'evidence': 'LIFF_ID_EVIDENCE',
    'response': 'LIFF_ID_RESPONSE',
  };
  return map[page] ? props.getProperty(map[page]) : '';
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isRateLimited(userId) {
  const cache = CacheService.getScriptCache();
  const key = 'rate_' + userId;
  const count = parseInt(cache.get(key) || '0', 10);
  if (count >= 30) return true;          // ขยายจาก 10 → 30 req/60s
  cache.put(key, String(count + 1), 60);
  return false;
}

function setupSheets() {
  return initializeAllSheets();
}

function testConfig() {
  const config = getConfig();
  Logger.log(JSON.stringify(config, null, 2));
  return config;
}

/**
 * ============================================================
 * Config
 * ============================================================
 */

const REQUIRED_PROPS = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'SHEET_ID',
  'DRIVE_FOLDER_ID',
  'OWNER_LINE_USER_ID',
  'LIFF_ID_REGISTER',
  'LIFF_ID_CHECKIN',
  'LIFF_ID_LEAVE',
  'LIFF_ID_OT',
  'LIFF_ID_BALANCE',
  'LIFF_ID_HR_TOOLS',
  'LIFF_ID_APPROVAL',
  'LIFF_ID_EVIDENCE',
  'LIFF_ID_RESPONSE',
];

const DEFAULT_CONFIG = {
  company_name: 'My Company Co., Ltd.',
  geofence_lat: 13.7563,
  geofence_lng: 100.5018,
  geofence_radius_m: 150,
  work_start: '08:00',
  work_end: '17:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
  ot_rate_multiplier: 1.5,
  sick_quota_default: 30,
  personal_quota_default: 3,
  vacation_quota_default: 15,
  late_threshold_min: 30,
  ot_request_lead_min: 30,
  enable_approval_L2: true,
  enable_approval_L3: true,
working_saturday_pattern: 'every',
};

function getProp(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('missing_property: ' + key);
  return v;
}

function getPropOptional(key, defaultValue) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v || defaultValue;
}

function getConfig() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('cfg');
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getScriptProperties();
  const sheetConfig = readConfigSheet();
  const config = Object.assign({}, DEFAULT_CONFIG, sheetConfig);
  config.LINE_CHANNEL_ACCESS_TOKEN = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  config.LINE_CHANNEL_SECRET = props.getProperty('LINE_CHANNEL_SECRET');
  config.OWNER_LINE_USER_ID = props.getProperty('OWNER_LINE_USER_ID');
  config.DRIVE_FOLDER_ID = props.getProperty('DRIVE_FOLDER_ID');

  try { cache.put('cfg', JSON.stringify(config), 21600); } catch(e) {}
  return config;
}

function invalidateConfigCache() {
  CacheService.getScriptCache().remove('cfg');
}

function readConfigSheet() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      if (typeof value === 'string') {
        if (value === 'true') config[key] = true;
        else if (value === 'false') config[key] = false;
        else if (!isNaN(parseFloat(value)) && isFinite(value)) config[key] = parseFloat(value);
        else config[key] = value;
      } else {
        config[key] = value;
      }
    }
  }
  return config;
}

function validateConfig() {
  const missing = [];
  REQUIRED_PROPS.forEach(function(key) {
    const v = PropertiesService.getScriptProperties().getProperty(key);
    if (!v) missing.push(key);
  });
  if (missing.length > 0) throw new Error('Missing Script Properties: ' + missing.join(', '));
  return { ok: true, props: REQUIRED_PROPS.length };
}

const SHEETS = {
  EMPLOYEES: {
    name: 'Employees',
    columns: [
      'employee_id', 'line_user_id', 'display_name', 'phone', 'email',
      'department', 'position', 'pay_type', 'base_pay_monthly', 'daily_rate', 'ot_rate_per_hour',
      'bank_name', 'bank_account_no', 'bank_account_name',
      'selfie_url', 'id_card_url',
      'approver_L1_id', 'approver_L2_id', 'approver_L3_id',
      'start_date', 'is_active', 'registered_at'
    ]
  },
  CHECKINS: {
    name: 'Checkins',
    columns: [
      'checkin_id', 'employee_id', 'checkin_date', 'slot',
      'checkin_at', 'lat', 'lng', 'distance_m', 'selfie_url',
      'status', 'approved_by', 'approved_at'
    ]
  },
  LEAVES: {
    name: 'Leaves',
    columns: [
      'leave_id', 'employee_id', 'leave_type', 'duration_type',
      'start_date', 'end_date', 'total_days', 'total_hours', 'reason',
      'evidence_url', 'status', 'current_approver', 'approval_history',
      'submitted_at'
    ]
  },
  OT: {
    name: 'OT',
    columns: [
      'ot_id', 'employee_id', 'ot_date', 'start_time', 'end_time',
      'total_hours', 'reason', 'status', 'current_approver',
      'approval_history', 'submitted_at'
    ]
  },
  PAYMENTS: {
    name: 'Payments',
    columns: [
      'payment_id', 'employee_id', 'period', 'pay_type', 'work_days', 'total_working_days', 'ot_hours',
      'base_pay', 'ot_pay',
      'meal_allowance', 'travel_allowance',
      'leave_deduction', 'absent_deduction',
      'bonus', 'deduction', 'total_amount',
      'status', 'closed_at', 'paid_at', 'note'
    ]
  },
  LEAVE_QUOTA: {
    name: 'LeaveQuota',
    columns: [
      'employee_id', 'year',
      'sick_quota', 'sick_used',
      'personal_quota', 'personal_used',
      'vacation_quota', 'vacation_used'
    ]
  },
  PAY_ITEMS: {
    name: 'PayItems',
    columns: [
      'item_id', 'employee_id', 'period', 'type', 'amount',
      'reason', 'created_by', 'created_at'
    ]
  },
  HOLIDAYS: {
    name: 'Holidays',
    columns: ['date', 'name', 'type']
  },
  CONFIG: {
    name: 'Config',
    columns: ['key', 'value']
  },
  LOGS: {
    name: 'Logs',
    columns: ['timestamp', 'level', 'function', 'user_id', 'message', 'payload']
  },
  APPROVERS: {
    name: 'Approvers',
    columns: ['employee_id', 'level', 'approver_id', 'is_active']
  },
};

function initializeAllSheets() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const results = [];
  Object.keys(SHEETS).forEach(function(key) {
    const def = SHEETS[key];
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      results.push({ sheet: def.name, created: true });
    } else {
      results.push({ sheet: def.name, created: false });
    }
    const range = sheet.getRange(1, 1, 1, def.columns.length);
    const current = range.getValues()[0];
    const isEmpty = current.every(function(c) { return !c; });
    if (isEmpty) {
      range.setValues([def.columns]);
      range.setFontWeight('bold');
      range.setBackground('#D4550A');
      range.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });
  initializeConfigSheet();
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);
  return { ok: true, sheets: results };
}

function initializeConfigSheet() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return;
  const existing = readConfigSheet();
  const rowsToAdd = [];
  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    if (!(key in existing)) rowsToAdd.push([key, DEFAULT_CONFIG[key]]);
  });
  if (rowsToAdd.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAdd.length, 2).setValues(rowsToAdd);
  }
}

/**
 * ============================================================
 * Drive Store
 * ============================================================
 */

function uploadImage(base64, filename, subfolder) {
  if (!base64) throw new Error('missing_base64');
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const folderId = getProp('DRIVE_FOLDER_ID');
  const rootFolder = DriveApp.getFolderById(folderId);
  let targetFolder = rootFolder;
  if (subfolder) {
    const parts = subfolder.split('/');
    parts.forEach(function(part) {
      if (part) targetFolder = getOrCreateSubfolder(targetFolder, part);
    });
  }
  const blob = Utilities.newBlob(
    Utilities.base64Decode(cleanBase64), 'image/jpeg', filename
  );
  const file = targetFolder.createFile(blob);
  // ต้องตั้ง public sharing เพื่อให้ LINE Flex card แสดงรูปได้
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?id=' + file.getId();
}

function deleteImage(url) {
  try {
    const match = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (!match) return false;
    DriveApp.getFileById(match[1]).setTrashed(true);
    return true;
  } catch (err) {
    logWarn('deleteImage', err.message, { url });
    return false;
  }
}

/**
 * ============================================================
 * LINE Messaging API
 * ============================================================
 */

const LINE_API_BASE = 'https://api.line.me';

function pushMessage(to, messages) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  return retryRequest(LINE_API_BASE + '/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: messages }),
    muteHttpExceptions: true
  });
}

function replyMessage(replyToken, messages) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  return retryRequest(LINE_API_BASE + '/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
}

function pushFlex(to, altText, flexContents) {
  return pushMessage(to, [{ type: 'flex', altText: altText || 'แจ้งเตือน', contents: flexContents }]);
}

function pushFlexToOwner(altText, flexContents) {
  return pushFlex(getProp('OWNER_LINE_USER_ID'), altText, flexContents);
}

function getLineProfile(userId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  try {
    const res = UrlFetchApp.fetch(LINE_API_BASE + '/v2/bot/profile/' + userId, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) return JSON.parse(res.getContentText());
    logWarn('getLineProfile', 'non-200', { userId, code: res.getResponseCode() });
    return null;
  } catch (err) {
    logError('getLineProfile', err.message, { userId });
    return null;
  }
}

function verifyLineSignature(body, signature) {
  if (!signature) return false;
  const secret = getProp('LINE_CHANNEL_SECRET');
  const hash = Utilities.computeHmacSha256Signature(body, secret);
  return signature === Utilities.base64Encode(hash);
}

function retryRequest(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) return { ok: true, status: code, body: res.getContentText() };
      if (code >= 500) {
        lastError = 'http_' + code;
        Utilities.sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      logWarn('retryRequest', 'client_error', { url, code, body: res.getContentText() });
      return { ok: false, status: code, body: res.getContentText() };
    } catch (err) {
      lastError = err.message;
      logWarn('retryRequest', 'fetch_error', { url, attempt, error: err.message });
      if (attempt < maxRetries - 1) Utilities.sleep(Math.pow(2, attempt) * 1000);
    }
  }
  logError('retryRequest', 'max_retries_exceeded', { url, lastError });
  return { ok: false, error: lastError };
}

function linkRichMenuToUser(userId, richMenuId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  return retryRequest(LINE_API_BASE + '/v2/bot/user/' + userId + '/richmenu/' + richMenuId, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
}

function unlinkRichMenu(userId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  return retryRequest(LINE_API_BASE + '/v2/bot/user/' + userId + '/richmenu', {
    method: 'delete',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
}

/**
 * ============================================================
 * Logger  ← แก้ไข: เพิ่ม userId param ใน logInfo/logWarn/logError
 * ============================================================
 */

// userId เป็น param ที่ 4 (optional) ในทุก function
function logInfo(fn, message, payload, userId) {
  writeLog('info', fn, userId || '', message, payload);
}

function logWarn(fn, message, payload, userId) {
  writeLog('warn', fn, userId || '', message, payload);
}

function logError(fn, message, payload, userId) {
  writeLog('error', fn, userId || '', message, payload);
  console.error('[' + fn + ']', message, payload);
}

function logUserAction(fn, userId, message, payload) {
  writeLog('info', fn, userId || '', message, payload);
}

function writeLog(level, fn, userId, message, payload) {
  try {
    const sheet = getSheet(SHEETS.LOGS.name);
    if (!sheet) { console.error('Logs sheet not found'); return; }
    const payloadStr = payload ? JSON.stringify(payload).substring(0, 1000) : '';
    // ใช้ formatDateTime แทน nowBangkok เพื่อให้ Logs sheet อ่านง่าย
    // เช่น "2026-05-19 09:30:00" แทน "2026-05-19T09:30:00+07:00"
    sheet.appendRow([formatDateTime(new Date()), level, fn || '', userId || '', message || '', payloadStr]);
  } catch (err) {
    console.error('Failed to write log', err.message);
  }
}

function cleanupOldLogs(daysToKeep) {
  daysToKeep = daysToKeep || 30;
  const sheet = getSheet(SHEETS.LOGS.name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  let deleteUpTo = 1;
  for (let i = 1; i < data.length; i++) {
    if (new Date(data[i][0]) < cutoff) deleteUpTo = i + 1;
    else break;
  }
  if (deleteUpTo > 1) {
    sheet.deleteRows(2, deleteUpTo - 1);
    logInfo('cleanupOldLogs', 'deleted ' + (deleteUpTo - 1) + ' rows');
  }
}

/**
 * ============================================================
 * Router  ← แก้ไข: ส่ง userId ไปกับ logError ทุกจุด
 *           และแก้ processWebhookEvent ให้ส่ง sourceUserId
 * ============================================================
 */

const ACTION_HANDLERS = {
  'register':       function(p) { return register(p); },
  'checkin':        function(p) { return checkin(p); },
  'leave':          function(p) { return submitLeave(p); },
  'ot':             function(p) { return submitOT(p); },
  'balance':        function(p) { return getBalance(p); },
  'evidence':       function(p) { return submitEvidence(p); },
  'approval_list':  function(p) { return getApprovalInbox(p); },
  'approve_item':   function(p) { return processApproval(p); },
  'hr_employees':   function(p) { return hrGetEmployees(p); },
  'hr_add_emp':        function(p) { return hrAddEmployee(p); },
  'hr_update_emp':     function(p) { return hrUpdateEmployee(p); },
  'hr_deactivate_emp': function(p) { return hrDeactivateEmployee(p); },
  'hr_reactivate_emp': function(p) { return hrReactivateEmployee(p); },
  'hr_pay_items':   function(p) { return hrGetPayItems(p); },
  'hr_add_payitem': function(p) { return hrAddPayItem(p); },
  'hr_holidays':    function(p) { return hrGetHolidays(p); },
'hr_get_quota':   function(p) { return hrGetLeaveQuota(p); },
  'hr_set_quota':   function(p) { return hrSetLeaveQuota(p); },
  'hr_report':      function(p) { return hrGetReport(p); },
  'close_period':   function(p) { return closePeriod(p); },
  'mark_paid':      function(p) { return markPaid(p); },
  'cancel_leave':   function(p) { return cancelLeave(p); },
  'hr_leaves':      function(p) { return hrGetLeaves(p); },
};

function routeAction(action, payload) {
  const handler = ACTION_HANDLERS[action];
  if (!handler) {
    // ส่ง lineUserId ไปกับ log ด้วย
    logError('routeAction', 'unknown_action', { action }, payload.lineUserId || '');
    return jsonOutput({ ok: false, error: 'unknown_action', action: action });
  }
  try {
    const result = handler(payload);
    return jsonOutput(result);
  } catch (err) {
    logError('routeAction:' + action, err.message, { stack: err.stack }, payload.lineUserId || '');
    return jsonOutput({ ok: false, error: 'handler_error', message: err.message });
  }
}

function handleLineWebhook(events) {
  if (!Array.isArray(events) || events.length === 0) {
    logWarn('handleLineWebhook', 'empty_events', {});
    return jsonOutput({ ok: true });
  }
  for (const event of events) {
    try {
      if (!event.type || !event.source || !event.source.userId) {
        logWarn('handleLineWebhook', 'invalid_event_structure', { event });
        continue;
      }
      processWebhookEvent(event);
    } catch (err) {
      const uid = (event.source && event.source.userId) || '';
      // ส่ง userId ไปกับ log
      logError('handleLineWebhook', err.message, { event }, uid);
    }
  }
  return jsonOutput({ ok: true });
}

function processWebhookEvent(event) {
  const type = event.type;
  const sourceUserId = event.source && event.source.userId;
  const replyToken = event.replyToken;

  // ✅ จุดที่แก้: ส่ง sourceUserId เป็น param ที่ 4 ของ logInfo
  logInfo('webhook', type, { userId: sourceUserId }, sourceUserId);

  if (type === 'follow') {
    handleFollowEvent(sourceUserId, replyToken);
  } else if (type === 'postback') {
    handlePostback(event.postback.data, sourceUserId, replyToken);
  } else if (type === 'message' && event.message.type === 'text') {
    handleTextMessage(event.message.text, sourceUserId, replyToken);
  }
}

function handleFollowEvent(userId, replyToken) {
  replyMessage(replyToken, [{
    type: 'text',
    text: 'สวัสดี นี่คือบัญชีทางการของ HR-Grandvance\n\nเมนูพนักงาน\n1. ลงเวลาทำงาน\n2. ส่งใบลา\n3. ขออนุมัติ OT (เฉพาะพนักงานออฟฟิศ)\n4. ดูยอดวันลาคงเหลือ และประมาณการรายได้\n\nหากต้องการติดต่อ HR สามารถพิมพ์ข้อความในนี้ได้เลย 💌\n\n---\n\nHello! This is the official account of HR-Grandvance\n\nEmployee Menu\n1. Check in/out\n2. Submit leave requests\n3. Request OT approval (Office staff only)\n4. View remaining leave balance and estimated income\n\nTo contact HR, you can message us directly here. 💌'
  }]);
}

function handlePostback(data, userId, replyToken) {
  const params = parsePostbackData(data);
  if (params.action === 'approve' || params.action === 'reject' || params.action === 'need_info') {
    return processApprovalPostback({
      action: params.action,
      id: params.id,
      level: params.level,
      type: params.type,
      userId: userId,
      replyToken: replyToken
    });
  }
  replyMessage(replyToken, [{ type: 'text', text: 'คำสั่งไม่ถูกต้อง' }]);
}

function handleTextMessage(text, userId, replyToken) {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'help' || normalized === 'menu' || normalized === 'เมนู') {
    replyMessage(replyToken, [{ type: 'text', text: 'กดที่ Rich Menu ด้านล่างเพื่อใช้งานครับ' }]);
  }
}

function parsePostbackData(data) {
  const result = {};
  data.split('&').forEach(function(pair) {
    const idx = pair.indexOf('=');
    if (idx > 0) result[pair.substring(0, idx)] = decodeURIComponent(pair.substring(idx + 1));
  });
  return result;
}

/**
 * ============================================================
 * Sheet Store
 * ============================================================
 */

// ใน GAS แต่ละ execution เป็น process ใหม่ — _sheetCache จึงไม่ช่วยข้ามการเรียก
// แต่ยังคงประโยชน์สำหรับ reuse ใน execution เดียวกัน (เช่น หลาย handler ใน doPost เดียว)
// สิ่งสำคัญ: SpreadsheetApp.openById() ใน GAS มี internal cache อยู่แล้ว
const _sheetCache = {};
function getSheet(name) {
  if (_sheetCache[name]) return _sheetCache[name];
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('sheet_not_found: ' + name);
  _sheetCache[name] = sheet;
  return sheet;
}

function clearSheetCache() {
  for (const k in _sheetCache) delete _sheetCache[k];
}

// Sheets ที่ cache ได้ (เปลี่ยนนานๆ ครั้ง) → 6 ชม.
// Sheets ที่ cache ไม่ได้ (เปลี่ยนบ่อย) → ดึงตรงทุกครั้ง
const CACHEABLE_SHEETS = {
  'Employees':  21600,
  'LeaveQuota': 3600,
  'Config':     21600,
  'Holidays':   21600,
};

function getAllRows(sheetName) {
  const ttl = CACHEABLE_SHEETS[sheetName];
  if (ttl) {
    const cache = CacheService.getScriptCache();
    const key = 'rows_' + sheetName;
    const cached = cache.get(key);
    if (cached) return JSON.parse(cached);
    const rows = _fetchAllRows(sheetName);
    try { cache.put(key, JSON.stringify(rows), ttl); } catch(e) {}
    return rows;
  }
  return _fetchAllRows(sheetName);
}

function _fetchAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    obj._row = i + 1;
    result.push(obj);
  }
  return result;
}

function invalidateRowCache(sheetName) {
  CacheService.getScriptCache().remove('rows_' + sheetName);
}

function invalidateAllRowCaches() {
  const cache = CacheService.getScriptCache();
  Object.keys(CACHEABLE_SHEETS).forEach(function(name) {
    cache.remove('rows_' + name);
  });
}

function findRow(sheetName, predicate) {
  const rows = getAllRows(sheetName);
  for (let i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
}

function filterRows(sheetName, predicate) {
  return getAllRows(sheetName).filter(predicate);
}

function insertRow(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return row;
}

function updateRowByNumber(sheetName, rowNum, updates) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (const key in updates) {
    const colIdx = headers.indexOf(key);
    if (colIdx >= 0) sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
  }
}

function updateRow(sheetName, predicate, updates) {
  const found = findRow(sheetName, predicate);
  if (!found) return false;
  updateRowByNumber(sheetName, found._row, updates);
  return true;
}

function deleteRow(sheetName, predicate) {
  const found = findRow(sheetName, predicate);
  if (!found) return false;
  getSheet(sheetName).deleteRow(found._row);
  return true;
}

function findEmployeeByLineId(lineUserId) {
  return findRow(SHEETS.EMPLOYEES.name, function(r) { return r.line_user_id === lineUserId; });
}

function findEmployeeById(employeeId) {
  return findRow(SHEETS.EMPLOYEES.name, function(r) { return r.employee_id === employeeId; });
}

function getActiveEmployees() {
  return filterRows(SHEETS.EMPLOYEES.name, function(r) {
    return r.is_active === true || r.is_active === 'TRUE' || r.is_active === 'true';
  });
}

function insertEmployee(data) { return insertRow(SHEETS.EMPLOYEES.name, data); }
function insertCheckin(data)  { return insertRow(SHEETS.CHECKINS.name, data); }

function findCheckin(employeeId, date, slot) {
  return findRow(SHEETS.CHECKINS.name, function(r) {
    return r.employee_id === employeeId
      && formatDate(new Date(r.checkin_date)) === date
      && r.slot === slot;
  });
}

function insertLeave(data) { return insertRow(SHEETS.LEAVES.name, data); }
function findLeaveById(leaveId) {
  return findRow(SHEETS.LEAVES.name, function(r) { return r.leave_id === leaveId; });
}

function insertOT(data) { return insertRow(SHEETS.OT.name, data); }
function findOTById(otId) {
  return findRow(SHEETS.OT.name, function(r) { return r.ot_id === otId; });
}

function insertPayment(data) { return insertRow(SHEETS.PAYMENTS.name, data); }

function getLeaveQuota(employeeId, year) {
  return findRow(SHEETS.LEAVE_QUOTA.name, function(r) {
    return r.employee_id === employeeId && Number(r.year) === year;
  });
}

function initLeaveQuota(employeeId, year) {
  const config = getConfig();
  const existing = getLeaveQuota(employeeId, year);
  if (existing) return existing;
  const quota = {
    employee_id: employeeId, year: year,
    sick_quota: config.sick_quota_default, sick_used: 0,
    personal_quota: config.personal_quota_default, personal_used: 0,
    vacation_quota: config.vacation_quota_default, vacation_used: 0,
  };
  insertRow(SHEETS.LEAVE_QUOTA.name, quota);
  return quota;
}

function deductLeaveQuota(leave) {
  const year = new Date(leave.start_date).getFullYear();
  const quota = getLeaveQuota(leave.employee_id, year);
  if (!quota) return;
  const usedField = leave.leave_type + '_used';
  const updates = {};
  updates[usedField] = Number(quota[usedField] || 0) + Number(leave.total_days || 0);
  updateRowByNumber(SHEETS.LEAVE_QUOTA.name, quota._row, updates);
}

function restoreLeaveQuota(leave) {
  if (!leave.leave_type || leave.leave_type === 'unpaid' || leave.leave_type === 'emergency') return;
  const year = new Date(leave.start_date).getFullYear();
  const quota = getLeaveQuota(leave.employee_id, year);
  if (!quota) return;
  const usedField = leave.leave_type + '_used';
  const restored = Math.max(0, Number(quota[usedField] || 0) - Number(leave.total_days || 0));
  const updates = {};
  updates[usedField] = restored;
  updateRowByNumber(SHEETS.LEAVE_QUOTA.name, quota._row, updates);
}

/**
 * ============================================================
 * Utils
 * ============================================================
 */

const TZ = 'Asia/Bangkok';

function nowBangkok()    { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function todayBangkok()  { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function formatDate(d)   { return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }
function formatDateTime(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd HH:mm:ss"); }

function formatThaiDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const toRad = function(deg) { return deg * Math.PI / 180; };
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nextEmployeeId() {
  const data = getSheet(SHEETS.EMPLOYEES.name).getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    if (id.indexOf('TH') === 0) {
      const num = parseInt(id.slice(2), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return 'TH' + padLeft(maxNum + 1, 5);
}

function nextCheckinId(dateStr) {
  const dateCompact = dateStr.replace(/-/g, '');
  const data = getSheet(SHEETS.CHECKINS.name).getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('CHK-' + dateCompact) === 0) count++;
  }
  return 'CHK-' + dateCompact + '-' + padLeft(count + 1, 4);
}

function nextLeaveId() {
  const today = todayBangkok().replace(/-/g, '');
  const data = getSheet(SHEETS.LEAVES.name).getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('LV-' + today) === 0) count++;
  }
  return 'LV-' + today + '-' + padLeft(count + 1, 4);
}

function nextOTId() {
  const today = todayBangkok().replace(/-/g, '');
  const data = getSheet(SHEETS.OT.name).getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('OT-' + today) === 0) count++;
  }
  return 'OT-' + today + '-' + padLeft(count + 1, 4);
}

function nextPaymentId(period) {
  const compact = period.replace(/-/g, '');
  const data = getSheet(SHEETS.PAYMENTS.name).getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('PAY-' + compact) === 0) count++;
  }
  return 'PAY-' + compact + '-' + padLeft(count + 1, 4);
}

function padLeft(num, len) {
  let s = String(num);
  while (s.length < len) s = '0' + s;
  return s;
}

function parseHHMM(str) {
  if (str instanceof Date) return str.getHours() * 60 + str.getMinutes();
  const parts = String(str).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesNow() {
  return parseHHMM(Utilities.formatDate(new Date(), TZ, "HH:mm"));
}

function diffMinutes(t1, t2) { return parseHHMM(t2) - parseHHMM(t1); }

function isHoliday(dateStr) {
  const data = getSheet(SHEETS.HOLIDAYS.name).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && formatDate(new Date(data[i][0])) === dateStr)
      return { isHoliday: true, name: data[i][1], type: data[i][2] };
  }
  return { isHoliday: false };
}

function isWorkingSaturday(dateStr) {
  const config = getConfig();
  const pattern = config.working_saturday_pattern || 'none';
  if (pattern === 'none') return false;
  if (pattern === 'every') return true;

  // odd/even — นับลำดับเสาร์ในเดือนนั้น
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  let satCount = 0;
  for (let day = 1; day <= d.getDate(); day++) {
    if (new Date(year, month, day).getDay() === 6) satCount++;
  }
  if (pattern === 'odd')  return satCount % 2 === 1;
  if (pattern === 'even') return satCount % 2 === 0;
  return false;
}

function isWorkingDay(dateStr) {
  const dow = new Date(dateStr).getDay();
  if (dow === 0) return false; // อาทิตย์ หยุดเสมอ
  if (dow === 6) return isWorkingSaturday(dateStr); // เสาร์ — เช็ค pattern
  return !isHoliday(dateStr).isHoliday;
}

function countWorkingDays(startDate, endDate) {
  let count = 0;
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(formatDate(d))) count++;
  }
  return count;
}

function checkLateArrival(slot, config) {
  if (slot !== 'IN') return false;
  const lateLimit = parseHHMM(config.work_start) + (config.late_threshold_min || 30);
  return minutesNow() > lateLimit;
}
function forceAuthorize() {
  const folderId = getProp('DRIVE_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob('test', 'text/plain', 'test.txt');
  const file = folder.createFile(blob);
  file.setTrashed(true);
  Logger.log('Authorization OK: ' + folder.getName());
}
/**
 * ============================================================
 * Keep-alive — ป้องกัน cold start
 * ตั้ง Time-based Trigger รัน keepAlive ทุก 5 นาที
 * ============================================================
 */
function keepAlive() {
  // ping Spreadsheet เบาๆ เพื่อให้ Apps Script ไม่หลับ
  SpreadsheetApp.openById(getProp('SHEET_ID')).getName();
}
