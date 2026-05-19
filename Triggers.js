  /**
 * ============================================================
 * Time Triggers
 * ============================================================
 * Setup in Apps Script Editor → Triggers:
 *   - endWorkReminder: Daily 17:30
 *   - lateCheckinAlert: Daily 08:25
 *   - pendingApprovalReminder: Every 2 hours
 */

/**
 * Run at 17:30 daily
 * → notify employees who are still working without approved OT
 */
function endWorkReminder() {
  try {
    const today = todayBangkok();
    const employees = getActiveEmployees();

    employees.forEach(function(emp) {
      // Check if already checked out
      if (hasCheckedOut(emp.employee_id)) return;

      // Check if has approved OT today
      const hasApprovedOT = filterRows(SHEETS.OT.name, function(r) {
        return r.employee_id === emp.employee_id
          && r.status === 'approved'
          && String(r.ot_date).indexOf(today) === 0;
      }).length > 0;

      if (hasApprovedOT) return; // OT approved → don't disturb

      // Has any checkin today (means working) but not checked out
      if (!hasCheckedInToday(emp.employee_id)) return;

      // Send reminder
      pushFlex(emp.line_user_id, 'แจ้งเตือนเลิกงาน',
        buildEndWorkReminderCard(emp, false));

      logUserAction('endWorkReminder', emp.line_user_id, 'sent', {
        employeeId: emp.employee_id
      });
    });

  } catch (err) {
    logError('endWorkReminder', err.message);
  }
}

/**
 * Run at 08:25 daily (before 08:30 late threshold)
 * → list employees who should have checked in but haven't
 */
function lateCheckinAlert() {
  try {
    const today = todayBangkok();
    const config = getConfig();
    const employees = getActiveEmployees();
    const lateList = [];

    employees.forEach(function(emp) {
      const inCheckin = filterRows(SHEETS.CHECKINS.name, function(r) {
        return r.employee_id === emp.employee_id
          && formatDate(new Date(r.checkin_date)) === today
          && r.slot === 'IN';
      });

      // No check-in yet
      if (inCheckin.length === 0) {
        // Check if on leave today
        const onLeave = filterRows(SHEETS.LEAVES.name, function(r) {
          return r.employee_id === emp.employee_id
            && r.status === 'approved'
            && r.start_date <= today && r.end_date >= today;
        }).length > 0;

        if (!onLeave) {
          lateList.push(emp);
        }
      }
    });

    if (lateList.length === 0) return;

    // Send summary to owner
    const summary = lateList.map(function(e) {
      return '  • ' + e.display_name + ' (' + e.employee_id + ')';
    }).join('\n');

    pushMessage(getProp('OWNER_LINE_USER_ID'), [{
      type: 'text',
      text: '⏰ พนักงานยังไม่เช็คอินวันนี้ (' + today + ')\n' +
            'หลัง ' + config.work_start + ' ไป ' + config.late_threshold_min + ' นาที:\n\n' +
            summary
    }]);

    // Send reminder to each late employee
    lateList.forEach(function(emp) {
      pushMessage(emp.line_user_id, [{
        type: 'text',
        text: '⏰ คุณยังไม่ได้เช็คอินวันนี้\nกรุณาเช็คอินผ่าน Rich Menu "เช็คอิน"'
      }]);
    });

    logInfo('lateCheckinAlert', 'sent', { count: lateList.length });

  } catch (err) {
    logError('lateCheckinAlert', err.message);
  }
}

/**
 * Run every 2 hours
 * → remind approvers of pending requests > 4 hours old
 */
function pendingApprovalReminder() {
  try {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago

    const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
      return String(r.status).indexOf('pending_') === 0
        && new Date(r.submitted_at) < cutoff;
    });

    const pendingOT = filterRows(SHEETS.OT.name, function(r) {
      return String(r.status).indexOf('pending_') === 0
        && new Date(r.submitted_at) < cutoff;
    });

    // Group by approver
    const byApprover = {};
    [].concat(pendingLeaves, pendingOT).forEach(function(r) {
      if (!byApprover[r.current_approver]) byApprover[r.current_approver] = [];
      byApprover[r.current_approver].push(r);
    });

    Object.keys(byApprover).forEach(function(approverId) {
      const approver = findEmployeeById(approverId);
      if (!approver) return;
      const items = byApprover[approverId];

      pushMessage(approver.line_user_id, [{
        type: 'text',
        text: '⏰ คุณมีคำขอ ' + items.length + ' รายการรออนุมัติเกิน 4 ชม.\n\n' +
              items.slice(0, 5).map(function(i) {
                return '  • ' + (i.leave_id || i.ot_id);
              }).join('\n')
      }]);
    });

    logInfo('pendingApprovalReminder', 'completed', {
      approvers: Object.keys(byApprover).length,
      total: pendingLeaves.length + pendingOT.length
    });

  } catch (err) {
    logError('pendingApprovalReminder', err.message);
  }
}

/**
 * Helper: setup all triggers programmatically
 * Run this once from editor
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // End-work reminder at 17:30
  ScriptApp.newTrigger('endWorkReminder')
    .timeBased().atHour(17).nearMinute(30).everyDays(1).create();

  // Late check-in alert at 08:25 (before 08:30 late threshold)
  ScriptApp.newTrigger('lateCheckinAlert')
    .timeBased().atHour(8).nearMinute(25).everyDays(1).create();

  // Pending approval reminder every 2 hours
  ScriptApp.newTrigger('pendingApprovalReminder')
    .timeBased().everyHours(2).create();

  // Log cleanup at midnight
  ScriptApp.newTrigger('cleanupOldLogs')
    .timeBased().atHour(2).nearMinute(0).everyDays(1).create();

  // Keep-alive every 5 minutes (ป้องกัน cold start)
  ScriptApp.newTrigger('keepAlive')
    .timeBased().everyMinutes(5).create();

  // Year-end archive: 31 ธันวาคม 23:00
  ScriptApp.newTrigger('yearEndArchive')
    .timeBased().onMonthDay(31).atHour(23).create();

  return { ok: true, message: '6 triggers created' };
}

/**
 * ============================================================
 * Year-End Archive
 * ============================================================
 * รันอัตโนมัติ 31 ธันวาคม 23:00
 * หรือรันมือจาก Apps Script Editor ได้เลย
 *
 * สิ่งที่ทำ:
 *   1. Duplicate Spreadsheet ทั้งไฟล์ → "Mini HR — Archive YYYY"
 *   2. ลบแถวปีเก่าออกจาก Checkins, Leaves, OT, Payments, Logs ในไฟล์หลัก
 *   3. Init LeaveQuota ปีใหม่ให้ทุกพนักงาน
 *   4. แจ้งเจ้าของระบบว่า archive สำเร็จ
 * ============================================================
 */
function yearEndArchive() {
  try {
    const sheetId = getProp('SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const currentYear = new Date().getFullYear();         // ปีที่กำลัง archive (เช่น 2025)
    const nextYear    = currentYear + 1;                  // ปีถัดไป (เช่น 2026)

    logInfo('yearEndArchive', 'started', { currentYear, nextYear });

    // ──────────────────────────────────────────
    // Step 1: Duplicate ไฟล์ทั้งก้อน → Archive
    // ──────────────────────────────────────────
    const archiveName = 'Mini HR — Archive ' + currentYear;
    const originalFile = DriveApp.getFileById(sheetId);
    const parentFolder = originalFile.getParents().next();
    const archiveCopy  = originalFile.makeCopy(archiveName, parentFolder);

    logInfo('yearEndArchive', 'spreadsheet_duplicated', {
      archiveId: archiveCopy.getId(),
      archiveName: archiveName
    });

    // ──────────────────────────────────────────
    // Step 2: ลบแถวปีเก่าจากไฟล์หลัก
    // ──────────────────────────────────────────
    const ARCHIVE_SHEETS = [
      { name: SHEETS.CHECKINS.name,  dateCol: 'checkin_date' },
      { name: SHEETS.LEAVES.name,    dateCol: 'start_date'   },
      { name: SHEETS.OT.name,        dateCol: 'ot_date'      },
      { name: SHEETS.PAYMENTS.name,  dateCol: 'period'       },  // format YYYY-MM
      { name: SHEETS.LOGS.name,      dateCol: 'timestamp'    },
    ];

    const deleteSummary = {};

    ARCHIVE_SHEETS.forEach(function(def) {
      try {
        const sheet = ss.getSheetByName(def.name);
        if (!sheet) { deleteSummary[def.name] = 'sheet_not_found'; return; }

        const data  = sheet.getDataRange().getValues();
        const headers = data[0];
        const colIdx  = headers.indexOf(def.dateCol);
        if (colIdx < 0) { deleteSummary[def.name] = 'col_not_found'; return; }

        // วนจากล่างขึ้นบนเพื่อ deleteRow ได้ถูก index
        let deleted = 0;
        for (let i = data.length - 1; i >= 1; i--) {
          const rawVal = data[i][colIdx];
          if (!rawVal) continue;
          const yearInRow = _extractYear(rawVal);
          if (yearInRow === currentYear) {
            sheet.deleteRow(i + 1);  // +1 เพราะ sheet row เริ่มที่ 1
            deleted++;
          }
        }
        deleteSummary[def.name] = deleted + ' rows deleted';
      } catch (sheetErr) {
        deleteSummary[def.name] = 'error: ' + sheetErr.message;
        logError('yearEndArchive:deleteRows', sheetErr.message, { sheet: def.name });
      }
    });

    // ล้าง cache ทั้งหมดหลังลบข้อมูล
    clearSheetCache();
    invalidateAllRowCaches();

    logInfo('yearEndArchive', 'rows_deleted', deleteSummary);

    // ──────────────────────────────────────────
    // Step 3: Init LeaveQuota ปีใหม่
    // ──────────────────────────────────────────
    const employees = getActiveEmployees();
    let quotaCreated = 0;
    employees.forEach(function(emp) {
      try {
        const existing = getLeaveQuota(emp.employee_id, nextYear);
        if (!existing) {
          initLeaveQuota(emp.employee_id, nextYear);
          quotaCreated++;
        }
      } catch (qErr) {
        logError('yearEndArchive:initQuota', qErr.message, { empId: emp.employee_id });
      }
    });

    invalidateRowCache('LeaveQuota');

    logInfo('yearEndArchive', 'quota_initialized', {
      employees: employees.length,
      quotaCreated: quotaCreated
    });

    // ──────────────────────────────────────────
    // Step 4: แจ้งเจ้าของระบบ
    // ──────────────────────────────────────────
    const summary = Object.keys(deleteSummary).map(function(k) {
      return '  • ' + k + ': ' + deleteSummary[k];
    }).join('\n');

    pushMessage(getProp('OWNER_LINE_USER_ID'), [{
      type: 'text',
      text: '✅ Archive ปี ' + currentYear + ' เสร็จแล้ว\n\n' +
            '📁 ไฟล์ Archive: ' + archiveName + '\n' +
            '🗑️ ลบข้อมูลจากไฟล์หลัก:\n' + summary + '\n\n' +
            '📋 สร้าง LeaveQuota ปี ' + nextYear + ': ' + quotaCreated + ' คน\n\n' +
            '⚠️ อย่าลืมอัปเดต Holidays ปี ' + nextYear + ' ด้วยนะคะ'
    }]);

    logInfo('yearEndArchive', 'completed', {
      archiveId: archiveCopy.getId(),
      currentYear,
      nextYear,
      quotaCreated
    });

    return {
      ok: true,
      archiveId: archiveCopy.getId(),
      archiveName: archiveName,
      deleteSummary: deleteSummary,
      quotaCreated: quotaCreated
    };

  } catch (err) {
    logError('yearEndArchive', err.message, { stack: err.stack });

    // แจ้ง owner ว่า archive ล้มเหลว
    try {
      pushMessage(getProp('OWNER_LINE_USER_ID'), [{
        type: 'text',
        text: '❌ Archive ปีใหม่ล้มเหลว\n' +
              'กรุณาตรวจสอบ Logs และรันมือแทน\n\n' +
              'Error: ' + err.message
      }]);
    } catch (notifyErr) { /* ignore */ }

    return { ok: false, error: err.message };
  }
}

/**
 * แยก ค.ศ. จาก cell value ที่อาจเป็น Date object, "2025-01-15", หรือ "2025-01"
 * @param {*} val
 * @returns {number} year (ค.ศ.) หรือ 0 ถ้า parse ไม่ได้
 */
function _extractYear(val) {
  if (val instanceof Date) return val.getFullYear();
  const str = String(val).trim();
  // YYYY-MM-DD หรือ YYYY-MM หรือ YYYY
  const match = str.match(/^(\d{4})/);
  if (match) return parseInt(match[1], 10);
  // อาจเป็น Date ที่ Apps Script serialize แปลกๆ
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.getFullYear();
  return 0;
}

