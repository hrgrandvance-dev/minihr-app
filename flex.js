/**
 * ============================================================
 * Flex Card builders — Approval cards
 * Bilingual: ไทย / English
 * ============================================================
 */

const COLOR_PRIMARY = '#D4550A';
const COLOR_ACCENT  = '#F28C28';
const COLOR_PEACH   = '#FFF3E6';
const COLOR_GREEN   = '#1F7A1F';
const COLOR_RED     = '#B23A3A';
const COLOR_GRAY    = '#777777';

// ──────────────────────────────────────────────────────────────
// Helpers — bilingual text
// ──────────────────────────────────────────────────────────────

/**
 * Single text node ที่มีทั้งไทยและอังกฤษในบรรทัดเดียว
 * เช่น  "ใบลาใหม่รออนุมัติ · New Leave Request"
 */
function biText(th, en, opts) {
  opts = opts || {};
  return Object.assign({
    type: 'text',
    text: th + ' · ' + en,
    wrap: true
  }, opts);
}

/**
 * Label เล็กๆ สองบรรทัด (Thai บนบรรทัด 1, English บรรทัด 2)
 * ใช้สำหรับ key ใน kv row
 */
function biLabel(th, en) {
  return {
    type: 'box',
    layout: 'vertical',
    flex: 4,
    contents: [
      { type: 'text', text: th, color: COLOR_GRAY, size: 'xs', wrap: false },
      { type: 'text', text: en, color: '#AAAAAA', size: '3xs', wrap: false }
    ]
  };
}

/**
 * kv row แบบ bilingual key
 * key = { th, en }  val = string
 */
function kvBi(key, val) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    margin: 'sm',
    contents: [
      biLabel(key.th, key.en),
      { type: 'text', text: String(val || '-'), color: '#1A1A1A', size: 'sm', flex: 6, wrap: true }
    ]
  };
}

// Label pairs ที่ใช้บ่อย
const L = {
  employee:  { th: 'พนักงาน',        en: 'Employee'      },
  position:  { th: 'ตำแหน่ง',        en: 'Position'      },
  type:      { th: 'ประเภท',          en: 'Type'          },
  duration:  { th: 'ระยะเวลา',        en: 'Duration'      },
  date:      { th: 'วันที่',          en: 'Date'          },
  days:      { th: 'จำนวน',           en: 'Days'          },
  otDate:    { th: 'วัน OT',          en: 'OT Date'       },
  time:      { th: 'เวลา',            en: 'Time'          },
  hours:     { th: 'รวม',             en: 'Total'         },
  reason:    { th: 'เหตุผล',          en: 'Reason'        },
  distance:  { th: 'ระยะทาง',        en: 'Distance'      },
  slot:      { th: 'ช่วง',            en: 'Slot'          },
  checkin:   { th: 'เวลาเข้างาน',     en: 'Work Start'    },
  actual:    { th: 'เวลาเช็คอินจริง', en: 'Actual Check-in'},
  by:        { th: 'โดย',             en: 'By'            },
};

// ──────────────────────────────────────────────────────────────
// Leave type / Duration / Slot maps (bilingual)
// ──────────────────────────────────────────────────────────────

function biLeaveType(type) {
  const map = {
    sick:      'ป่วย · Sick',
    personal:  'กิจ · Personal',
    vacation:  'พักร้อน · Annual Leave',
    unpaid:    'ไม่รับเงิน · Unpaid',
    emergency: 'ฉุกเฉิน · Emergency'
  };
  return map[type] || type;
}

function thaiLeaveType(type) {
  const map = { sick:'ป่วย', personal:'กิจ', vacation:'พักร้อน', unpaid:'ไม่รับเงิน', emergency:'ฉุกเฉิน' };
  return map[type] || type;
}

function biDuration(durationType, totalDays) {
  if (durationType === 'full_day')          return 'เต็มวัน · Full Day (' + totalDays + ')';
  if (durationType === 'half_day_morning')  return 'ครึ่งวันเช้า · Morning Half-Day';
  if (durationType === 'half_day_afternoon')return 'ครึ่งวันบ่าย · Afternoon Half-Day';
  if (durationType === 'hourly')            return 'รายชั่วโมง · Hourly';
  return durationType;
}

function thaiDuration(durationType, totalDays) {
  if (durationType === 'full_day')          return 'เต็มวัน (' + totalDays + ')';
  if (durationType === 'half_day_morning')  return 'ครึ่งวันเช้า';
  if (durationType === 'half_day_afternoon')return 'ครึ่งวันบ่าย';
  if (durationType === 'hourly')            return 'รายชั่วโมง';
  return durationType;
}

function biSlot(slot) {
  const map = {
    IN:          'กะเข้า · Check-In',
    LUNCH_OUT:   'พักเที่ยง · Lunch Out',
    LUNCH_IN:    'กลับจากพัก · Lunch Return',
    OUT:         'เลิกงาน · Check-Out'
  };
  return map[slot] || slot;
}

function thaiSlot(slot) {
  const map = { IN:'กะเข้า', LUNCH_OUT:'พักเที่ยง', LUNCH_IN:'กลับจากพัก', OUT:'เลิกงาน' };
  return map[slot] || slot;
}

// ──────────────────────────────────────────────────────────────
// Action Buttons (bilingual labels)
// ──────────────────────────────────────────────────────────────

function approveButton(action, id, level, type) {
  return {
    type: 'button',
    style: 'primary',
    color: COLOR_GREEN,
    height: 'sm',
    action: {
      type: 'postback',
      label: '✅ อนุมัติ · Approve',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'อนุมัติ · Approve: ' + id
    }
  };
}

function rejectButton(action, id, level, type) {
  return {
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: {
      type: 'postback',
      label: '❌ ปฏิเสธ · Reject',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'ปฏิเสธ · Reject: ' + id
    }
  };
}

function needInfoButton(action, id, level, type) {
  return {
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: {
      type: 'postback',
      label: 'ℹ️ ขอข้อมูลเพิ่ม · Need Info',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'ขอข้อมูลเพิ่ม · Need Info: ' + id
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Leave Approval Card
// ──────────────────────────────────────────────────────────────

function buildLeaveApprovalCard(opts) {
  const leave    = opts.leave;
  const employee = opts.employee;
  const level    = opts.level || 'L1';

  const dateRange = leave.start_date !== leave.end_date
    ? leave.start_date + ' ถึง · to ' + leave.end_date
    : leave.start_date;

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLOR_PRIMARY,
      paddingAll: 'md',
      contents: [
        {
          type: 'text',
          text: '📝 ใบลาใหม่รออนุมัติ (' + level + ')',
          color: '#FFFFFF', weight: 'bold', size: 'lg'
        },
        {
          type: 'text',
          text: 'New Leave Request — Pending Approval (' + level + ')',
          color: '#FFD0B0', size: 'xs', margin: 'xs', wrap: true
        },
        {
          type: 'text',
          text: leave.leave_id,
          color: '#FFFFFF', size: 'xs', margin: 'sm'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvBi(L.employee, employee.display_name),
        kvBi(L.position, (employee.department || '') + ' · ' + (employee.position || '')),
        { type: 'separator', margin: 'md' },
        kvBi(L.type,     biLeaveType(leave.leave_type)),
        kvBi(L.duration, biDuration(leave.duration_type, leave.total_days)),
        kvBi(L.date,     dateRange),
        kvBi(L.days,     leave.total_days + ' วัน · days'),
        { type: 'separator', margin: 'md' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'เหตุผล · Reason', color: COLOR_GRAY, size: 'xs' },
            { type: 'text', text: leave.reason || '-', size: 'sm', wrap: true, margin: 'xs' }
          ]
        },
        leave.evidence_url ? {
          type: 'button',
          margin: 'md',
          action: { type: 'uri', label: '🖼️ ดูหลักฐาน · View Evidence', uri: leave.evidence_url },
          style: 'secondary',
          height: 'sm'
        } : { type: 'filler' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        approveButton('approve',   leave.leave_id, level, 'leave'),
        rejectButton('reject',     leave.leave_id, level, 'leave'),
        needInfoButton('need_info',leave.leave_id, level, 'leave')
      ]
    }
  };
}

// ──────────────────────────────────────────────────────────────
// OT Approval Card
// ──────────────────────────────────────────────────────────────

function buildOTApprovalCard(opts) {
  const ot       = opts.ot;
  const employee = opts.employee;
  const level    = opts.level || 'L1';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLOR_ACCENT,
      paddingAll: 'md',
      contents: [
        {
          type: 'text',
          text: '⏱️ ขอ OT รออนุมัติ (' + level + ')',
          color: '#FFFFFF', weight: 'bold', size: 'lg'
        },
        {
          type: 'text',
          text: 'OT Request — Pending Approval (' + level + ')',
          color: '#FFF0D0', size: 'xs', margin: 'xs', wrap: true
        },
        {
          type: 'text',
          text: ot.ot_id,
          color: '#FFFFFF', size: 'xs', margin: 'sm'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvBi(L.employee, employee.display_name),
        kvBi(L.position, (employee.department || '') + ' · ' + (employee.position || '')),
        { type: 'separator', margin: 'md' },
        kvBi(L.otDate, ot.ot_date),
        kvBi(L.time,   ot.start_time + ' - ' + ot.end_time),
        kvBi(L.hours,  ot.total_hours + ' ชั่วโมง · hrs'),
        { type: 'separator', margin: 'md' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'เหตุผล · Reason', color: COLOR_GRAY, size: 'xs' },
            { type: 'text', text: ot.reason || '-', size: 'sm', wrap: true, margin: 'xs' }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        approveButton('approve',   ot.ot_id, level, 'ot'),
        rejectButton('reject',     ot.ot_id, level, 'ot'),
        needInfoButton('need_info',ot.ot_id, level, 'ot')
      ]
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Done Card (หลังตัดสินใจแล้ว)
// ──────────────────────────────────────────────────────────────

function buildDoneCard(opts) {
  var action       = opts.action;   // 'approve' | 'reject' | 'need_info'
  var id           = opts.id;
  var approverName = opts.approverName || '';
  var typeLabel    = opts.typeLabel || '';

  var iconMap  = { approve: '✅', reject: '❌', need_info: 'ℹ️' };
  var labelMap = {
    approve:   'อนุมัติแล้ว · Approved',
    reject:    'ปฏิเสธแล้ว · Rejected',
    need_info: 'ขอข้อมูลเพิ่มแล้ว · Info Requested'
  };
  var colorMap = { approve: COLOR_GREEN, reject: COLOR_RED, need_info: '#F2A640' };

  var approvalInboxUrl = 'https://liff.line.me/' + getProp('LIFF_ID_APPROVAL');

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: colorMap[action] || COLOR_GRAY,
      paddingAll: 'md',
      contents: [{
        type: 'text',
        text: (iconMap[action] || '') + ' ' + (labelMap[action] || action),
        color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: typeLabel + ' ' + id, size: 'sm', color: '#555555', wrap: true },
        {
          type: 'text',
          text: 'โดย · By: ' + approverName,
          size: 'xs', color: COLOR_GRAY, margin: 'sm'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'uri',
          label: '📥 กล่องอนุมัติ · Approval Inbox',
          uri: approvalInboxUrl
        }
      }]
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Check-in Notification Card
// ──────────────────────────────────────────────────────────────

function buildCheckinNotifyCard(opts) {
  const emp        = opts.employee;
  const slot       = opts.slot;
  const distance   = opts.distance;
  const selfieUrl  = opts.selfieUrl;
  const time       = opts.time;
  const outOfRange = opts.outOfRange;

  const headerColor = outOfRange ? COLOR_RED : COLOR_PRIMARY;
  const headerTh    = outOfRange ? '⚠️ นอกรัศมี สแกน ' + thaiSlot(slot) : '✅ ลงเวลา ' + thaiSlot(slot);
  const headerEn    = outOfRange ? 'Out of Range — ' + (slot === 'IN' ? 'Check-In' : slot) : 'Checked — ' + (slot === 'IN' ? 'Check-In' : slot === 'OUT' ? 'Check-Out' : slot);
  const distText    = distance + ' m' + (outOfRange ? ' (นอกรัศมี · Out of Range)' : '');

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerColor,
      paddingAll: 'md',
      contents: [
        { type: 'text', text: headerTh, color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: headerEn, color: '#FFE0CC', size: 'xs', margin: 'xs', wrap: true },
        { type: 'text', text: time,     color: '#FFFFFF', size: 'xs', margin: 'sm' }
      ]
    },
    hero: selfieUrl ? {
      type: 'image',
      url: selfieUrl,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover'
    } : undefined,
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvBi(L.employee, emp.employee_id + ' — ' + emp.display_name),
        kvBi(L.distance, distText),
        kvBi(L.slot,     biSlot(slot))
      ]
    }
  };
}

// ──────────────────────────────────────────────────────────────
// End-Work Reminder Card
// ──────────────────────────────────────────────────────────────

function buildEndWorkReminderCard(emp, hasOTRequest) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [
        { type: 'text', text: '⚠️ แจ้งเตือนเลิกงาน', color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'End of Work Reminder',  color: '#FFF0D0', size: 'xs', margin: 'xs' }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ถึง คุณ · To: ' + emp.display_name,
          color: COLOR_GRAY, size: 'sm'
        },
        {
          type: 'text',
          text: 'ถึงเวลาเลิกงานแล้ว',
          color: COLOR_PRIMARY, weight: 'bold', size: 'xl', align: 'center', margin: 'md'
        },
        {
          type: 'text',
          text: 'It\'s time to finish work.',
          color: COLOR_ACCENT, size: 'sm', align: 'center', margin: 'xs'
        },
        {
          type: 'text',
          text: 'กรุณาออกจากออฟฟิศทันที · Please leave the office now.',
          size: 'sm', align: 'center', margin: 'sm', wrap: true
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#FFF3CC',
          paddingAll: 'md',
          margin: 'lg',
          cornerRadius: 'md',
          contents: [
            { type: 'text', text: '⚠️ คำเตือนสำคัญ · Important Notice', weight: 'bold', size: 'xs', color: COLOR_RED },
            {
              type: 'text',
              text: 'หากไม่ได้รับอนุญาตให้ทำงานล่วงเวลา บริษัทฯ จะไม่รับผิดชอบค่าล่วงเวลาทุกกรณี',
              size: 'xs', wrap: true, margin: 'sm', color: '#555'
            },
            {
              type: 'text',
              text: 'Unauthorized overtime will not be compensated.',
              size: 'xs', wrap: true, margin: 'xs', color: '#888'
            }
          ]
        }
      ]
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Late Check-in Alert Card
// ──────────────────────────────────────────────────────────────

function buildLateCheckinAlertCard(emp, expectedTime, actualTime) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [
        { type: 'text', text: '⏰ มาสายแจ้งเตือน',    color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'Late Check-in Alert', color: '#FFF0D0', size: 'xs', margin: 'xs' }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvBi(L.employee, emp.display_name),
        kvBi(L.checkin,  expectedTime),
        kvBi(L.actual,   actualTime || '-')
      ]
    }
  };
}
