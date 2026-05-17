  /**
 * ============================================================
 * Time Triggers
 * ============================================================
 * Setup in Apps Script Editor → Triggers:
 *   - endWorkReminder: Daily 17:30
 *   - lateCheckinAlert: Daily 09:30
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
 * Run at 09:30 daily
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

  // Late check-in alert at 09:30
  ScriptApp.newTrigger('lateCheckinAlert')
    .timeBased().atHour(9).nearMinute(30).everyDays(1).create();

  // Pending approval reminder every 2 hours
  ScriptApp.newTrigger('pendingApprovalReminder')
    .timeBased().everyHours(2).create();

  // Log cleanup at midnight
  ScriptApp.newTrigger('cleanupOldLogs')
    .timeBased().atHour(2).nearMinute(0).everyDays(1).create();

  return { ok: true, message: '4 triggers created' };
}

