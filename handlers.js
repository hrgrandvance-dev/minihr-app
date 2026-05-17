  /**
 * ============================================================
 * Register Handler
 * ============================================================
 * Flow 1: ลงทะเบียนพนักงานใหม่
 */

function register(payload) {
  const lineUserId = payload.lineUserId;
  const displayName = payload.displayName;
  const phone = payload.phone;
  const email = payload.email || '';
  const department = payload.department || '';
  const position = payload.position || '';
  const basePayMonthly = Number(payload.basePayMonthly || 15000);
  const otRatePerHour = Number(payload.otRatePerHour || 80);
  const bankName = payload.bankName;
  const bankAccountNo = payload.bankAccountNo;
  const bankAccountName = payload.bankAccountName;
  const selfieBase64 = payload.selfieBase64;
  const idCardBase64 = payload.idCardBase64;

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (!displayName) return { ok: false, error: 'invalid_display_name' };
  if (!phone) return { ok: false, error: 'invalid_phone' };
  if (!bankAccountNo) return { ok: false, error: 'invalid_bank_account' };
  if (!selfieBase64) return { ok: false, error: 'missing_selfie' };
  if (!idCardBase64) return { ok: false, error: 'missing_id_card' };

  // === Check duplicate (with lock to prevent race condition) ===
  const existing = findEmployeeByLineId(lineUserId);
  if (existing) {
    logUserAction('register', lineUserId, 'already_registered');
    return { ok: false, error: 'already_registered', employeeId: existing.employee_id };
  }

  // === Upload images ===
  let selfieUrl, idCardUrl;
  try {
    selfieUrl = uploadImage(
      selfieBase64,
      'selfie_' + lineUserId + '_' + Date.now() + '.jpg',
      'selfies'
    );
    idCardUrl = uploadImage(
      idCardBase64,
      'id_' + lineUserId + '_' + Date.now() + '.jpg',
      'id-cards'
    );
  } catch (err) {
    logError('register:upload', err.message, { lineUserId });
    return { ok: false, error: 'upload_failed', message: err.message };
  }

  // === Insert row ===
  const employeeId = nextEmployeeId();
  const newEmp = {
    employee_id: employeeId,
    line_user_id: lineUserId,
    display_name: displayName,
    phone: phone,
    email: email,
    department: department,
    position: position,
    base_pay_monthly: basePayMonthly,
    ot_rate_per_hour: otRatePerHour,
    bank_name: bankName,
    bank_account_no: bankAccountNo,
    bank_account_name: bankAccountName,
    selfie_url: selfieUrl,
    id_card_url: idCardUrl,
    approver_L1_id: '',  // ต้อง assign ทีหลังโดย HR
    approver_L2_id: '',
    approver_L3_id: '',
    start_date: todayBangkok(),
    is_active: true,
    registered_at: nowBangkok()
  };

  try {
    insertEmployee(newEmp);
  } catch (err) {
    logError('register:insert', err.message, { lineUserId });
    return { ok: false, error: 'insert_failed', message: err.message };
  }

  // === Init leave quota ===
  try {
    initLeaveQuota(employeeId, new Date().getFullYear());
  } catch (err) {
    logWarn('register:quota', err.message, { employeeId });
    // continue — quota สามารถสร้างเองทีหลังได้
  }

  // === Welcome message ===
  pushMessage(lineUserId, [{
    type: 'text',
    text: '✅ ลงทะเบียนเรียบร้อย ' + displayName + '!\n' +
          'รหัสพนักงาน: ' + employeeId + '\n\n' +
          '⚠️ รอ HR/เจ้าของระบบกำหนดผู้อนุมัติให้คุณก่อน จึงจะเริ่มลงเวลา/ขอลาได้'
  }]);

  // === Notify owner ===
  pushMessage(getProp('OWNER_LINE_USER_ID'), [{
    type: 'text',
    text: '🆕 พนักงานใหม่ลงทะเบียน\n' +
          'ID: ' + employeeId + '\n' +
          'ชื่อ: ' + displayName + '\n' +
          'เบอร์: ' + phone + '\n\n' +
          'กรุณาเข้า "เครื่องมือ HR" เพื่อกำหนดผู้อนุมัติ'
  }]);

  logUserAction('register', lineUserId, 'success', { employeeId });
  return { ok: true, employeeId: employeeId, selfieUrl: selfieUrl };
}/**
 * ============================================================
 * Approval Handler — Multi-level state machine
 * ============================================================
 * Flow 7: L1 → L2 → L3
 * Actions: approve / approve_conditional / reject / need_info
 *
 * State transitions:
 *   pending_L1 -[approve]→ pending_L2 (if L2 exists) | approved
 *   pending_L2 -[approve]→ pending_L3 (if L3 exists) | approved
 *   pending_L3 -[approve]→ approved
 *   pending_*  -[reject]→ rejected
 *   pending_*  -[need_info]→ need_info (waiting employee response)
 */

function processApprovalPostback(payload) {
  const action = payload.action;       // approve / reject / need_info
  const recordId = payload.id;          // LV-... or OT-...
  const level = payload.level;          // L1 / L2 / L3
  const type = payload.type || (recordId.indexOf('LV-') === 0 ? 'leave' : 'ot');
  const userId = payload.userId;
  const replyToken = payload.replyToken;

  // === Verify approver ===
  const approver = findEmployeeByLineId(userId);
  if (!approver) {
    if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูลผู้อนุมัติในระบบ' }]);
    return { ok: false, error: 'approver_not_found' };
  }

  // === Get record ===
  const record = (type === 'leave') ? findLeaveById(recordId) : findOTById(recordId);
  if (!record) {
    if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบรหัส ' + recordId }]);
    return { ok: false, error: 'record_not_found' };
  }

  // === Verify current approver ===
  if (record.current_approver !== approver.employee_id) {
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '❌ คุณไม่ใช่ผู้อนุมัติของคำขอนี้ในขั้นนี้'
    }]);
    return { ok: false, error: 'not_current_approver' };
  }

  // === Verify status ===
  const expectedStatus = 'pending_' + level;
  if (record.status !== expectedStatus) {
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '⚠️ คำขอนี้สถานะเปลี่ยนไปแล้ว (' + record.status + ')'
    }]);
    return { ok: false, error: 'wrong_status', currentStatus: record.status };
  }

  // === Process action ===
  if (action === 'approve') {
    return doApprove(record, type, level, approver, replyToken);
  } else if (action === 'reject') {
    return doReject(record, type, level, approver, replyToken);
  } else if (action === 'need_info') {
    return doNeedInfo(record, type, level, approver, replyToken);
  }

  return { ok: false, error: 'unknown_action' };
}

function doApprove(record, type, level, approver, replyToken) {
  // Append to history
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'approve',
    at: nowBangkok()
  });

  // Find employee
  const employee = findEmployeeById(record.employee_id);

  // Determine next level
  const config = getConfig();
  const nextLevel = getNextLevel(level, employee, config);

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  if (nextLevel) {
    // Forward to next level
    const nextApprover = findEmployeeById(employee['approver_' + nextLevel + '_id']);
    if (!nextApprover) {
      logWarn('doApprove', 'next_approver_missing', { recordId: record[idField], nextLevel });
      // Fallback: final approve
      finalizeApproval(record, type, employee, history, sheetName, idField);
    } else {
      updateRowByNumber(sheetName, record._row, {
        status: 'pending_' + nextLevel,
        current_approver: nextApprover.employee_id,
        approval_history: JSON.stringify(history)
      });

      // Notify next approver
      if (type === 'leave') {
        pushFlex(nextApprover.line_user_id, 'ใบลา: ' + employee.display_name, buildLeaveApprovalCard({
          leave: record,
          employee: employee,
          level: nextLevel
        }));
      } else {
        pushFlex(nextApprover.line_user_id, 'ขอ OT: ' + employee.display_name, buildOTApprovalCard({
          ot: record,
          employee: employee,
          level: nextLevel
        }));
      }

      if (replyToken) replyMessage(replyToken, [{
        type: 'text',
        text: '✅ อนุมัติแล้ว (ขั้น ' + level + ')\nส่งต่อ ' + nextApprover.display_name + ' (' + nextLevel + ')'
      }]);
    }
  } else {
    // Final approval
    finalizeApproval(record, type, employee, history, sheetName, idField);
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '✅ อนุมัติเรียบร้อย\n' + record[idField] + ' (' + level + ' = final)'
    }]);
  }

  logUserAction('doApprove', approver.line_user_id, 'success', {
    recordId: record[idField], level, type
  });
  return { ok: true };
}

function finalizeApproval(record, type, employee, history, sheetName, idField) {
  updateRowByNumber(sheetName, record._row, {
    status: 'approved',
    current_approver: '',
    approval_history: JSON.stringify(history)
  });

  // If leave: deduct quota
  if (type === 'leave' && record.leave_type !== 'unpaid' && record.leave_type !== 'emergency') {
    try {
      deductLeaveQuota(record);
    } catch (err) {
      logError('finalizeApproval:deductQuota', err.message);
    }
  }

  // Notify employee
  const typeLabel = type === 'leave' ? 'ใบลา' : 'OT';
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: '🎉 คำขอ' + typeLabel + ' ' + record[idField] + ' ได้รับอนุมัติแล้ว!'
  }]);
}

function doReject(record, type, level, approver, replyToken) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'reject',
    at: nowBangkok()
  });

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  updateRowByNumber(sheetName, record._row, {
    status: 'rejected',
    current_approver: '',
    approval_history: JSON.stringify(history)
  });

  const employee = findEmployeeById(record.employee_id);
  const typeLabel = type === 'leave' ? 'ใบลา' : 'OT';
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: '❌ คำขอ' + typeLabel + ' ' + record[idField] + ' ถูกปฏิเสธในขั้น ' + level
  }]);

  if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'บันทึกการปฏิเสธแล้ว' }]);

  logUserAction('doReject', approver.line_user_id, 'success', { recordId: record[idField] });
  return { ok: true };
}

function doNeedInfo(record, type, level, approver, replyToken) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'need_info',
    at: nowBangkok()
  });

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  updateRowByNumber(sheetName, record._row, {
    status: 'need_info',
    approval_history: JSON.stringify(history)
  });

  // Send LIFF link to employee
  const evidenceLiff = getProp('LIFF_ID_EVIDENCE');
  const liffUrl = 'https://liff.line.me/' + evidenceLiff + '?id=' + record[idField] + '&type=' + type;

  const employee = findEmployeeById(record.employee_id);
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: 'ℹ️ ผู้อนุมัติขอข้อมูลเพิ่มเติมสำหรับคำขอ ' + record[idField] +
          '\n\nกรุณาคลิกลิงก์เพื่อแนบหลักฐาน:\n' + liffUrl
  }]);

  if (replyToken) replyMessage(replyToken, [{
    type: 'text',
    text: 'ส่งคำขอข้อมูลเพิ่มถึงพนักงานแล้ว'
  }]);

  logUserAction('doNeedInfo', approver.line_user_id, 'success', { recordId: record[idField] });
  return { ok: true };
}

function getNextLevel(currentLevel, employee, config) {
  if (currentLevel === 'L1') {
    if (config.enable_approval_L2 && employee.approver_L2_id) return 'L2';
    if (config.enable_approval_L3 && employee.approver_L3_id) return 'L3';
    return null;
  }
  if (currentLevel === 'L2') {
    if (config.enable_approval_L3 && employee.approver_L3_id) return 'L3';
    return null;
  }
  return null;
}

function parseHistory(historyStr) {
  if (!historyStr) return [];
  try {
    return JSON.parse(historyStr);
  } catch (err) {
    return [];
  }
}

/**
 * Get approval inbox for current user
 */
function getApprovalInbox(payload) {
  const lineUserId = payload.lineUserId;
  const approver = findEmployeeByLineId(lineUserId);
  if (!approver) return { ok: false, error: 'not_registered' };

  // Find all leaves + OTs where current_approver = me
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.current_approver === approver.employee_id
      && String(r.status).indexOf('pending_') === 0;
  });

  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return r.current_approver === approver.employee_id
      && String(r.status).indexOf('pending_') === 0;
  });

  return {
    ok: true,
    leaves: pendingLeaves,
    ot: pendingOT,
    count: pendingLeaves.length + pendingOT.length
  };
}

/**
 * Process approval from LIFF (instead of postback)
 */
function processApproval(payload) {
  return processApprovalPostback({
    action: payload.action,
    id: payload.id,
    level: payload.level,
    type: payload.type,
    userId: payload.lineUserId,
    replyToken: null
  });
}/**
 * ============================================================
 * Balance Handler — Flow 8
 * ============================================================
 */

function getBalance(payload) {
  const lineUserId = payload.lineUserId;
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const period = payload.period || currentPeriod();
  const year = parseInt(period.split('-')[0], 10);

  // === Work days this period ===
  const workDays = countApprovedWorkDays(emp.employee_id, period);

  // === OT hours this period ===
  const otHours = sumApprovedOT(emp.employee_id, period);

  // === Pay calculation (estimate) ===
  const dailyRate = Number(emp.base_pay_monthly || 0) / 22; // 22 working days/month
  const config = getConfig();
  const otRate = Number(emp.ot_rate_per_hour || 0);
  const basePay = workDays * dailyRate;
  const otPay = otHours * otRate * config.ot_rate_multiplier;

  // === Bonus/deduction ===
  const bonus = sumPayItems(emp.employee_id, period, 'bonus');
  const deduction = sumPayItems(emp.employee_id, period, 'deduction');

  const estimateTotal = basePay + otPay + bonus - deduction;

  // === Leave quota remaining ===
  const quota = getLeaveQuota(emp.employee_id, year) || {};
  const leaveBalance = {
    sick: {
      quota: Number(quota.sick_quota || 0),
      used: Number(quota.sick_used || 0),
      remaining: Number(quota.sick_quota || 0) - Number(quota.sick_used || 0)
    },
    personal: {
      quota: Number(quota.personal_quota || 0),
      used: Number(quota.personal_used || 0),
      remaining: Number(quota.personal_quota || 0) - Number(quota.personal_used || 0)
    },
    vacation: {
      quota: Number(quota.vacation_quota || 0),
      used: Number(quota.vacation_used || 0),
      remaining: Number(quota.vacation_quota || 0) - Number(quota.vacation_used || 0)
    }
  };

  // === Last paid period ===
  const lastPayment = findLastPayment(emp.employee_id);

  // === Pending counts ===
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.employee_id === emp.employee_id
      && String(r.status).indexOf('pending') === 0;
  }).length;

  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return r.employee_id === emp.employee_id
      && String(r.status).indexOf('pending') === 0;
  }).length;

  return {
    ok: true,
    employee: {
      id: emp.employee_id,
      name: emp.display_name,
      department: emp.department,
      position: emp.position
    },
    period: period,
    workDays: workDays,
    otHours: otHours,
    basePay: Math.round(basePay),
    otPay: Math.round(otPay),
    bonus: bonus,
    deduction: deduction,
    estimateTotal: Math.round(estimateTotal),
    leaveBalance: leaveBalance,
    pending: { leaves: pendingLeaves, ot: pendingOT },
    lastPayment: lastPayment ? {
      period: lastPayment.period,
      total: lastPayment.total_amount,
      status: lastPayment.status
    } : null
  };
}

function currentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  return year + '-' + month;
}

function countApprovedWorkDays(employeeId, period) {
  // Count distinct dates with at least one approved IN checkin
  const checkins = filterRows(SHEETS.CHECKINS.name, function(r) {
    if (r.employee_id !== employeeId) return false;
    if (r.status !== 'approved') return false;
    if (r.slot !== 'IN') return false;
    const dateStr = formatDate(new Date(r.checkin_date));
    return dateStr.indexOf(period) === 0;
  });
  // Distinct dates
  const dates = {};
  checkins.forEach(function(c) {
    dates[formatDate(new Date(c.checkin_date))] = true;
  });
  return Object.keys(dates).length;
}

function sumApprovedOT(employeeId, period) {
  const otRows = filterRows(SHEETS.OT.name, function(r) {
    return r.employee_id === employeeId
      && r.status === 'approved'
      && String(r.ot_date).indexOf(period) === 0;
  });
  return otRows.reduce(function(s, r) { return s + Number(r.total_hours || 0); }, 0);
}

function sumPayItems(employeeId, period, type) {
  const items = filterRows(SHEETS.PAY_ITEMS.name, function(r) {
    return (r.employee_id === employeeId || r.employee_id === '' || r.employee_id === '*')
      && r.period === period
      && r.type === type;
  });
  return items.reduce(function(s, r) { return s + Number(r.amount || 0); }, 0);
}

function findLastPayment(employeeId) {
  const payments = filterRows(SHEETS.PAYMENTS.name, function(r) {
    return r.employee_id === employeeId;
  });
  if (payments.length === 0) return null;
  // Sort by period desc
  payments.sort(function(a, b) { return String(b.period).localeCompare(String(a.period)); });
  return payments[0];
}


/**
 * ============================================================
 * Evidence Handler — attach evidence after "need_info"
 * ============================================================
 */
function submitEvidence(payload) {
  const lineUserId = payload.lineUserId;
  const recordId = payload.id;
  const type = payload.type; // leave / ot
  const evidenceBase64 = payload.evidenceBase64;
  const note = (payload.note || '').trim();

  if (!recordId) return { ok: false, error: 'missing_id' };
  if (!evidenceBase64) return { ok: false, error: 'missing_evidence' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const record = (type === 'leave') ? findLeaveById(recordId) : findOTById(recordId);
  if (!record) return { ok: false, error: 'record_not_found' };
  if (record.employee_id !== emp.employee_id) return { ok: false, error: 'not_your_record' };
  if (record.status !== 'need_info') return { ok: false, error: 'wrong_status' };

  // Upload
  let evidenceUrl;
  try {
    evidenceUrl = uploadImage(
      evidenceBase64,
      'evidence_' + recordId + '_' + Date.now() + '.jpg',
      'evidence'
    );
  } catch (err) {
    return { ok: false, error: 'upload_failed' };
  }

  // Append to history
  const history = parseHistory(record.approval_history);
  const lastNeedInfo = history.slice().reverse().find(function(h) { return h.action === 'need_info'; });
  const level = lastNeedInfo ? lastNeedInfo.level : 'L1';

  history.push({
    level: 'employee',
    by: emp.employee_id,
    action: 'submit_evidence',
    note: note,
    evidence_url: evidenceUrl,
    at: nowBangkok()
  });

  // Reset back to pending at the level that asked
  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';
  updateRowByNumber(sheetName, record._row, {
    status: 'pending_' + level,
    evidence_url: evidenceUrl,
    approval_history: JSON.stringify(history)
  });

  // Notify approver
  const approver = findEmployeeById(record.current_approver);
  if (approver) {
    pushMessage(approver.line_user_id, [{
      type: 'text',
      text: '📎 ' + emp.display_name + ' ส่งหลักฐานเพิ่มสำหรับ ' + recordId + ' แล้ว\n\n' +
            'หมายเหตุ: ' + (note || '-') + '\n' +
            'ดูหลักฐาน: ' + evidenceUrl
    }]);
  }

  return { ok: true, evidenceUrl: evidenceUrl };
}


/**
 * ============================================================
 * HR Tools Handler — Owner only
 * ============================================================
 */
function hrGetEmployees(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employees = getAllRows(SHEETS.EMPLOYEES.name);
  return { ok: true, employees: employees };
}

function hrAddEmployee(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  // TODO: validate + insert
  const newEmp = payload.employee;
  newEmp.employee_id = newEmp.employee_id || nextEmployeeId();
  newEmp.registered_at = nowBangkok();
  newEmp.is_active = true;
  insertEmployee(newEmp);
  return { ok: true, employeeId: newEmp.employee_id };
}

function hrUpdateEmployee(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employeeId = payload.employeeId;
  const updates = payload.updates;
  const ok = updateRow(SHEETS.EMPLOYEES.name, function(r) {
    return r.employee_id === employeeId;
  }, updates);
  return { ok: ok };
}

function hrGetPayItems(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();
  const items = filterRows(SHEETS.PAY_ITEMS.name, function(r) {
    return r.period === period;
  });
  return { ok: true, items: items };
}

function hrAddPayItem(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const item = payload.item;
  item.item_id = 'PI-' + Date.now();
  item.created_by = payload.lineUserId;
  item.created_at = nowBangkok();
  insertRow(SHEETS.PAY_ITEMS.name, item);
  return { ok: true };
}

function hrGetHolidays(payload) {
  const holidays = getAllRows(SHEETS.HOLIDAYS.name);
  return { ok: true, holidays: holidays };
}

function hrSetLeaveQuota(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employeeId = payload.employeeId;
  const year = payload.year;
  const updates = payload.updates;
  const ok = updateRow(SHEETS.LEAVE_QUOTA.name, function(r) {
    return r.employee_id === employeeId && Number(r.year) === Number(year);
  }, updates);
  return { ok: ok };
}

function hrGetReport(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();
  const employees = getActiveEmployees();
  const report = employees.map(function(emp) {
    return {
      employee_id: emp.employee_id,
      name: emp.display_name,
      department: emp.department,
      work_days: countApprovedWorkDays(emp.employee_id, period),
      ot_hours: sumApprovedOT(emp.employee_id, period),
      bonus: sumPayItems(emp.employee_id, period, 'bonus'),
      deduction: sumPayItems(emp.employee_id, period, 'deduction')
    };
  });
  return { ok: true, period: period, report: report };
}

function isOwner(lineUserId) {
  return lineUserId === getProp('OWNER_LINE_USER_ID');
}


/**
 * ============================================================
 * Payment Handler — Flow 10: ปิดงวด + จ่ายเงิน
 * ============================================================
 */
function closePeriod(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();

  // Check pending
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return String(r.status).indexOf('pending') === 0;
  });
  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return String(r.status).indexOf('pending') === 0;
  });

  if ((pendingLeaves.length > 0 || pendingOT.length > 0) && !payload.force) {
    return {
      ok: false,
      error: 'has_pending',
      message: 'มีคำขอที่ยังค้างอนุมัติ: ' + pendingLeaves.length + ' ลา + ' + pendingOT.length + ' OT',
      pendingLeaves: pendingLeaves.length,
      pendingOT: pendingOT.length
    };
  }

  // Process each employee
  const employees = getActiveEmployees();
  const config = getConfig();
  const results = [];

  employees.forEach(function(emp) {
    const workDays = countApprovedWorkDays(emp.employee_id, period);
    const otHours = sumApprovedOT(emp.employee_id, period);
    const dailyRate = Number(emp.base_pay_monthly || 0) / 22;
    const otRate = Number(emp.ot_rate_per_hour || 0);
    const basePay = workDays * dailyRate;
    const otPay = otHours * otRate * config.ot_rate_multiplier;
    const bonus = sumPayItems(emp.employee_id, period, 'bonus');
    const deduction = sumPayItems(emp.employee_id, period, 'deduction');
    const total = Math.round(basePay + otPay + bonus - deduction);

    // Check if already closed
    const existing = findRow(SHEETS.PAYMENTS.name, function(r) {
      return r.employee_id === emp.employee_id && r.period === period;
    });

    if (existing) {
      results.push({ employee: emp.display_name, skipped: true, reason: 'already_closed' });
      return;
    }

    const paymentId = nextPaymentId(period);
    insertPayment({
      payment_id: paymentId,
      employee_id: emp.employee_id,
      period: period,
      work_days: workDays,
      ot_hours: otHours,
      base_pay: Math.round(basePay),
      ot_pay: Math.round(otPay),
      bonus: bonus,
      deduction: deduction,
      total_amount: total,
      status: 'รอจ่าย',
      closed_at: nowBangkok(),
      paid_at: '',
      note: ''
    });

    results.push({
      employee: emp.display_name,
      total: total,
      paymentId: paymentId
    });
  });

  // Send summary
  const summaryLines = results.map(function(r) {
    if (r.skipped) return '  - ' + r.employee + ' (' + r.reason + ')';
    return '  ' + r.employee + ': ' + (r.total || 0).toLocaleString() + ' บาท';
  });
  const totalSum = results.reduce(function(s, r) { return s + (r.total || 0); }, 0);

  pushMessage(getProp('OWNER_LINE_USER_ID'), [{
    type: 'text',
    text: '💰 ปิดงวด ' + period + ' เรียบร้อย\n\n' +
          summaryLines.join('\n') + '\n\n' +
          '─────────────────\n' +
          'รวมทั้งสิ้น: ' + totalSum.toLocaleString() + ' บาท\n\n' +
          'หลังโอนเงินแล้ว กดเปลี่ยนสถานะ "จ่ายแล้ว" ใน Sheet Payments'
  }]);

  return { ok: true, period: period, count: results.length, totalSum: totalSum };
}

function markPaid(payload) {
  if (!isOwner(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const paymentId = payload.paymentId;

  const ok = updateRow(SHEETS.PAYMENTS.name, function(r) {
    return r.payment_id === paymentId;
  }, {
    status: 'จ่ายแล้ว',
    paid_at: nowBangkok()
  });

  if (ok) {
    // Notify employee
    const payment = findRow(SHEETS.PAYMENTS.name, function(r) {
      return r.payment_id === paymentId;
    });
    const emp = findEmployeeById(payment.employee_id);
    if (emp) {
      pushMessage(emp.line_user_id, [{
        type: 'text',
        text: '💵 เงินเดือนงวด ' + payment.period + ' โอนเข้าบัญชีคุณแล้ว\n' +
              'จำนวน: ' + Number(payment.total_amount).toLocaleString() + ' บาท'
      }]);
    }
  }

  return { ok: ok };
}/**
 * ============================================================
 * Checkin Handler
 * ============================================================
 * Flow 2-3: ลงเวลา 4 slot/day
 *   IN = เข้างาน
 *   LUNCH_OUT = ออกพักเที่ยง
 *   LUNCH_IN = กลับจากพักเที่ยง
 *   OUT = เลิกงาน
 */

const SLOTS = ['IN', 'LUNCH_OUT', 'LUNCH_IN', 'OUT'];

function checkin(payload) {
  const lineUserId = payload.lineUserId;
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  const selfieBase64 = payload.selfieBase64;
  const slot = payload.slot || autoDetectSlot();

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (!selfieBase64) return { ok: false, error: 'missing_selfie' };
  if (SLOTS.indexOf(slot) < 0) return { ok: false, error: 'invalid_slot' };

  // === Find employee ===
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const isActive = emp.is_active === true || emp.is_active === 'TRUE' || emp.is_active === 'true';
  if (!isActive) return { ok: false, error: 'inactive_employee' };

  // === GPS check ===
  const config = getConfig();
  // ถ้าไม่มี GPS (lat/lng = 0) ให้ถือว่าอยู่นอกรัศมี
  let distance = 999999;
  let inRange = false;
  if (lat !== 0 || lng !== 0) {
    distance = haversineMeters(lat, lng, config.geofence_lat, config.geofence_lng);
    inRange = distance <= config.geofence_radius_m;
  }

  // === Check late arrival ===
  const isLate = checkLateArrival(slot, config);

  // === Slot timing validation ===
  const slotErr = validateSlotTiming(slot, config);
  if (slotErr) {
    return { ok: false, error: slotErr };
  }

  // === Dedupe ===
  const today = todayBangkok();
  const existing = findCheckin(emp.employee_id, today, slot);
  if (existing) {
    return {
      ok: true,
      duplicated: true,
      checkinId: existing.checkin_id,
      message: 'คุณเช็คอินช่วงนี้ของวันนี้แล้ว'
    };
  }

  // === Upload selfie ===
  let selfieUrl;
  try {
    selfieUrl = uploadImage(
      selfieBase64,
      'chk_' + emp.employee_id + '_' + today + '_' + slot + '.jpg',
      'daily-photos'
    );
  } catch (err) {
    logError('checkin:upload', err.message, { lineUserId, slot });
    return { ok: false, error: 'upload_failed' };
  }

  // === Insert row ===
  const checkinId = nextCheckinId(today);
  const status = inRange ? 'approved' : 'out_of_range';

  const newRow = {
    checkin_id: checkinId,
    employee_id: emp.employee_id,
    checkin_date: today,
    slot: slot,
    checkin_at: nowBangkok(),
    lat: lat,
    lng: lng,
    distance_m: Math.round(distance),
    selfie_url: selfieUrl,
    status: status,
    approved_by: inRange ? 'system' : '',
    approved_at: inRange ? nowBangkok() : ''
  };

  try {
    insertCheckin(newRow);
  } catch (err) {
    logError('checkin:insert', err.message, { lineUserId });
    return { ok: false, error: 'insert_failed' };
  }

  // === Notify owner if out of range ===
  if (!inRange) {
    pushFlexToOwner(
      'นอกรัศมี: ' + emp.display_name,
      buildCheckinNotifyCard({
        employee: emp,
        slot: slot,
        distance: Math.round(distance),
        selfieUrl: selfieUrl,
        time: nowBangkok(),
        outOfRange: true
      })
    );
  }

  logUserAction('checkin', lineUserId, 'success', { slot, inRange, distance, isLate });
  return {
    ok: true,
    checkinId: checkinId,
    inRange: inRange,
    distance: Math.round(distance),
    radiusLimit: config.geofence_radius_m,
    selfieUrl: selfieUrl,
    isLate: isLate
  };
}

/**
 * Auto-detect slot based on current time
 */
function autoDetectSlot() {
  const config = getConfig();
  const now = minutesNow();
  const workStart = parseHHMM(config.work_start);
  const lunchStart = parseHHMM(config.lunch_start);
  const lunchEnd = parseHHMM(config.lunch_end);
  const workEnd = parseHHMM(config.work_end);

  if (now < lunchStart) return 'IN';
  if (now < lunchEnd) return 'LUNCH_OUT';
  if (now < workEnd) return 'LUNCH_IN';
  return 'OUT';
}

/**
 * Validate slot timing
 * TODO: refine per company policy
 */
function validateSlotTiming(slot, config) {
  // Allow flexible — just warn if outside normal window
  // Return null = OK, string = error
  return null;
}

/**
 * Get today's checkins for an employee
 */
function getTodayCheckins(employeeId) {
  const today = todayBangkok();
  return filterRows(SHEETS.CHECKINS.name, function(r) {
    return r.employee_id === employeeId
      && formatDate(new Date(r.checkin_date)) === today;
  });
}

/**
 * Has any approved checkin today?
 */
function hasCheckedInToday(employeeId) {
  const checkins = getTodayCheckins(employeeId);
  return checkins.some(function(c) { return c.status === 'approved'; });
}

/**
 * Has checked out for the day?
 */
function hasCheckedOut(employeeId) {
  const checkins = getTodayCheckins(employeeId);
  return checkins.some(function(c) {
    return c.slot === 'OUT' && c.status === 'approved';
  });
}/**
 * ============================================================
 * Leave Handler
 * ============================================================
 * Flow 5: ขอลา (sick / personal / vacation / unpaid / emergency)
 */

const LEAVE_TYPES = ['sick', 'personal', 'vacation', 'unpaid', 'emergency'];
const DURATION_TYPES = ['full_day', 'half_day_morning', 'half_day_afternoon', 'hourly'];

function submitLeave(payload) {
  const lineUserId = payload.lineUserId;
  const leaveType = payload.leaveType;
  const durationType = payload.durationType;
  const startDate = payload.startDate;
  const endDate = payload.endDate || payload.startDate;
  const totalHours = payload.totalHours ? Number(payload.totalHours) : null;
  const reason = (payload.reason || '').trim();
  const evidenceBase64 = payload.evidenceBase64;

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (LEAVE_TYPES.indexOf(leaveType) < 0) return { ok: false, error: 'invalid_leave_type' };
  if (DURATION_TYPES.indexOf(durationType) < 0) return { ok: false, error: 'invalid_duration_type' };
  if (!startDate) return { ok: false, error: 'missing_start_date' };
  if (!reason) return { ok: false, error: 'missing_reason' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  if (!emp.approver_L1_id) {
    return { ok: false, error: 'no_approver_set', message: 'รอ HR กำหนดผู้อนุมัติให้คุณก่อน' };
  }

  // === Calculate total days ===
  let totalDays;
  if (durationType === 'full_day') {
    totalDays = countWorkingDays(startDate, endDate);
  } else if (durationType === 'half_day_morning' || durationType === 'half_day_afternoon') {
    totalDays = 0.5;
  } else if (durationType === 'hourly') {
    if (!totalHours || totalHours <= 0) return { ok: false, error: 'missing_hours' };
    totalDays = totalHours / 8; // assume 8-hour workday
  }

  // === Check quota ===
  if (leaveType !== 'unpaid' && leaveType !== 'emergency') {
    const year = new Date(startDate).getFullYear();
    const quota = getLeaveQuota(emp.employee_id, year);
    if (!quota) {
      initLeaveQuota(emp.employee_id, year);
    } else {
      const remaining = Number(quota[leaveType + '_quota'] || 0)
                      - Number(quota[leaveType + '_used'] || 0);
      if (totalDays > remaining) {
        return {
          ok: false,
          error: 'insufficient_quota',
          message: 'สิทธิ์ลา' + thaiLeaveType(leaveType) + 'เหลือ ' + remaining + ' วัน'
                 + ' แต่คุณขอลา ' + totalDays + ' วัน',
          remaining: remaining,
          requested: totalDays
        };
      }
    }
  }

  // === Lead time rules ===
  // personal leave: 3 days advance, emergency: any time, vacation: 7 days
  const today = new Date(todayBangkok());
  const start = new Date(startDate);
  const daysAhead = Math.floor((start - today) / (1000 * 60 * 60 * 24));

  if (leaveType === 'personal' && daysAhead < 3) {
    return { ok: false, error: 'personal_leave_lead_time', message: 'ลากิจต้องขอล่วงหน้าอย่างน้อย 3 วัน' };
  }
  if (leaveType === 'vacation' && daysAhead < 7) {
    return { ok: false, error: 'vacation_lead_time', message: 'ลาพักร้อนต้องขอล่วงหน้าอย่างน้อย 7 วัน' };
  }

  // === Upload evidence (optional) ===
  let evidenceUrl = '';
  if (evidenceBase64) {
    try {
      evidenceUrl = uploadImage(
        evidenceBase64,
        'leave_' + emp.employee_id + '_' + Date.now() + '.jpg',
        'evidence'
      );
    } catch (err) {
      logWarn('submitLeave:upload', err.message, { lineUserId });
    }
  }

  // === Insert row ===
  const leaveId = nextLeaveId();
  const newLeave = {
    leave_id: leaveId,
    employee_id: emp.employee_id,
    leave_type: leaveType,
    duration_type: durationType,
    start_date: startDate,
    end_date: endDate,
    total_days: totalDays,
    total_hours: totalHours || '',
    reason: reason,
    evidence_url: evidenceUrl,
    status: 'pending_L1',
    current_approver: emp.approver_L1_id,
    approval_history: '[]',
    submitted_at: nowBangkok()
  };

  insertLeave(newLeave);

  // === Notify L1 approver ===
  const approver = findEmployeeById(emp.approver_L1_id);
  if (approver) {
    pushFlex(approver.line_user_id, 'ใบลา: ' + emp.display_name, buildLeaveApprovalCard({
      leave: newLeave,
      employee: emp,
      level: 'L1'
    }));
  }

  // === Confirm to employee ===
  pushMessage(lineUserId, [{
    type: 'text',
    text: '📝 ส่งใบลาเรียบร้อย\n' +
          'รหัส: ' + leaveId + '\n' +
          'ประเภท: ' + thaiLeaveType(leaveType) + '\n' +
          'จำนวน: ' + totalDays + ' วัน\n' +
          'สถานะ: รอ ' + (approver ? approver.display_name : 'ผู้อนุมัติ') + ' อนุมัติ (L1)'
  }]);

  logUserAction('submitLeave', lineUserId, 'success', { leaveId, leaveType, totalDays });
  return { ok: true, leaveId: leaveId, status: 'pending_L1' };
}

function thaiLeaveType(type) {
  const map = {
    sick: 'ป่วย',
    personal: 'กิจ',
    vacation: 'พักร้อน',
    unpaid: 'ไม่รับเงิน',
    emergency: 'ฉุกเฉิน'
  };
  return map[type] || type;
}/**
 * ============================================================
 * OT Handler
 * ============================================================
 * Flow 6: ขอ OT
 */

function submitOT(payload) {
  const lineUserId = payload.lineUserId;
  const otDate = payload.otDate;
  const startTime = payload.startTime; // "18:00"
  const endTime = payload.endTime;     // "21:00"
  const reason = (payload.reason || '').trim();

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (!otDate) return { ok: false, error: 'missing_date' };
  if (!startTime || !endTime) return { ok: false, error: 'missing_time' };
  if (!reason) return { ok: false, error: 'missing_reason' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  if (!emp.approver_L1_id) {
    return { ok: false, error: 'no_approver_set' };
  }

  // === Calculate hours ===
  const startMin = parseHHMM(startTime);
  const endMin = parseHHMM(endTime);
  if (endMin <= startMin) {
    return { ok: false, error: 'invalid_time_range', message: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' };
  }
  const totalHours = (endMin - startMin) / 60;

  // === Lead time check ===
  // OT request must be at least N min before work_end if same day
  const config = getConfig();
  const today = todayBangkok();
  if (otDate === today) {
    const workEnd = parseHHMM(config.work_end);
    const nowMin = minutesNow();
    const leadRequired = config.ot_request_lead_min || 30;
    if (nowMin > workEnd - leadRequired) {
      return {
        ok: false,
        error: 'ot_lead_time',
        message: 'การขอ OT ต้องส่งก่อนเลิกงานอย่างน้อย ' + leadRequired + ' นาที'
      };
    }
  }

  // === Insert row ===
  const otId = nextOTId();
  const newOT = {
    ot_id: otId,
    employee_id: emp.employee_id,
    ot_date: otDate,
    start_time: startTime,
    end_time: endTime,
    total_hours: totalHours,
    reason: reason,
    status: 'pending_L1',
    current_approver: emp.approver_L1_id,
    approval_history: '[]',
    submitted_at: nowBangkok()
  };

  insertOT(newOT);

  // === Notify L1 ===
  const approver = findEmployeeById(emp.approver_L1_id);
  if (approver) {
    pushFlex(approver.line_user_id, 'ขอ OT: ' + emp.display_name, buildOTApprovalCard({
      ot: newOT,
      employee: emp,
      level: 'L1'
    }));
  }

  pushMessage(lineUserId, [{
    type: 'text',
    text: '⏱️ ส่งคำขอ OT เรียบร้อย\n' +
          'รหัส: ' + otId + '\n' +
          'วัน: ' + otDate + ' เวลา ' + startTime + '-' + endTime + '\n' +
          'รวม: ' + totalHours + ' ชั่วโมง\n' +
          'สถานะ: รอ ' + (approver ? approver.display_name : 'ผู้อนุมัติ') + ' อนุมัติ'
  }]);

  logUserAction('submitOT', lineUserId, 'success', { otId, totalHours });
  return { ok: true, otId: otId };
}
