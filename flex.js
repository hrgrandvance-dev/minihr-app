  /**
 * ============================================================
 * Flex Card builders — Approval cards
 * ============================================================
 */

const COLOR_PRIMARY = '#D4550A';
const COLOR_ACCENT = '#F28C28';
const COLOR_PEACH = '#FFF3E6';
const COLOR_GREEN = '#1F7A1F';
const COLOR_RED = '#B23A3A';
const COLOR_GRAY = '#777777';

/**
 * Leave approval card (3 buttons + need_info)
 */
function buildLeaveApprovalCard(opts) {
  const leave = opts.leave;
  const employee = opts.employee;
  const level = opts.level || 'L1';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLOR_PRIMARY,
      paddingAll: 'md',
      contents: [{
        type: 'text',
        text: '📝 ใบลาใหม่รออนุมัติ (' + level + ')',
        color: '#FFFFFF',
        weight: 'bold',
        size: 'lg'
      }, {
        type: 'text',
        text: leave.leave_id,
        color: '#FFFFFF',
        size: 'xs',
        margin: 'sm'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvRow('พนักงาน', employee.display_name),
        kvRow('ตำแหน่ง', (employee.department || '') + ' · ' + (employee.position || '')),
        { type: 'separator', margin: 'md' },
        kvRow('ประเภท', thaiLeaveType(leave.leave_type)),
        kvRow('ระยะเวลา', thaiDuration(leave.duration_type, leave.total_days)),
        kvRow('วันที่', leave.start_date + (leave.start_date !== leave.end_date ? ' ถึง ' + leave.end_date : '')),
        kvRow('จำนวน', leave.total_days + ' วัน'),
        { type: 'separator', margin: 'md' },
        { type: 'text', text: 'เหตุผล:', color: COLOR_GRAY, size: 'xs', margin: 'md' },
        { type: 'text', text: leave.reason, size: 'sm', wrap: true, margin: 'xs' },
        leave.evidence_url ? {
          type: 'button',
          margin: 'md',
          action: { type: 'uri', label: '🖼️ ดูหลักฐาน', uri: leave.evidence_url },
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
        approveButton('approve', leave.leave_id, level, 'leave'),
        rejectButton('reject', leave.leave_id, level, 'leave'),
        needInfoButton('need_info', leave.leave_id, level, 'leave')
      ]
    }
  };
}

/**
 * OT approval card
 */
function buildOTApprovalCard(opts) {
  const ot = opts.ot;
  const employee = opts.employee;
  const level = opts.level || 'L1';

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLOR_ACCENT,
      paddingAll: 'md',
      contents: [{
        type: 'text',
        text: '⏱️ ขอ OT รออนุมัติ (' + level + ')',
        color: '#FFFFFF',
        weight: 'bold',
        size: 'lg'
      }, {
        type: 'text',
        text: ot.ot_id,
        color: '#FFFFFF',
        size: 'xs',
        margin: 'sm'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvRow('พนักงาน', employee.display_name),
        kvRow('ตำแหน่ง', (employee.department || '') + ' · ' + (employee.position || '')),
        { type: 'separator', margin: 'md' },
        kvRow('วันที่', ot.ot_date),
        kvRow('เวลา', ot.start_time + ' - ' + ot.end_time),
        kvRow('รวม', ot.total_hours + ' ชั่วโมง'),
        { type: 'separator', margin: 'md' },
        { type: 'text', text: 'เหตุผล:', color: COLOR_GRAY, size: 'xs', margin: 'md' },
        { type: 'text', text: ot.reason, size: 'sm', wrap: true, margin: 'xs' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        approveButton('approve', ot.ot_id, level, 'ot'),
        rejectButton('reject', ot.ot_id, level, 'ot'),
        needInfoButton('need_info', ot.ot_id, level, 'ot')
      ]
    }
  };
}

function kvRow(key, val) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      { type: 'text', text: key, color: COLOR_GRAY, size: 'sm', flex: 3 },
      { type: 'text', text: String(val || '-'), color: '#1A1A1A', size: 'sm', flex: 5, wrap: true }
    ]
  };
}

function approveButton(action, id, level, type) {
  return {
    type: 'button',
    style: 'primary',
    color: COLOR_GREEN,
    height: 'sm',
    action: {
      type: 'postback',
      label: '✅ อนุมัติ',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'อนุมัติ ' + id
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
      label: '❌ ปฏิเสธ',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'ปฏิเสธ ' + id
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
      label: 'ℹ️ ขอข้อมูลเพิ่ม',
      data: 'action=' + action + '&id=' + id + '&level=' + level + '&type=' + type,
      displayText: 'ขอข้อมูลเพิ่ม ' + id
    }
  };
}


/**
 * Card แสดงหลังตัดสินใจแล้ว — มีเฉพาะปุ่มเปิดกล่องอนุมัติ
 */
function buildDoneCard(opts) {
  var action = opts.action;   // 'approve' | 'reject' | 'need_info'
  var id = opts.id;
  var approverName = opts.approverName || '';
  var typeLabel = opts.typeLabel || '';

  var iconMap = { approve: '✅', reject: '❌', need_info: 'ℹ️' };
  var labelMap = { approve: 'อนุมัติแล้ว', reject: 'ปฏิเสธแล้ว', need_info: 'ขอข้อมูลเพิ่มแล้ว' };
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
        color: '#FFFFFF',
        weight: 'bold',
        size: 'lg'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: typeLabel + ' ' + id, size: 'sm', color: '#555555', wrap: true },
        { type: 'text', text: 'โดย ' + approverName, size: 'xs', color: COLOR_GRAY, margin: 'sm' }
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
          label: '📥 กล่องอนุมัติ',
          uri: approvalInboxUrl
        }
      }]
    }
  };
}

function thaiDuration(durationType, totalDays) {
  if (durationType === 'full_day') return 'เต็มวัน (' + totalDays + ')';
  if (durationType === 'half_day_morning') return 'ครึ่งวันเช้า';
  if (durationType === 'half_day_afternoon') return 'ครึ่งวันบ่าย';
  if (durationType === 'hourly') return 'รายชั่วโมง';
  return durationType;
}/**
 * ============================================================
 * Checkin notification + End-work reminder cards
 * ============================================================
 */

function buildCheckinNotifyCard(opts) {
  const emp = opts.employee;
  const slot = opts.slot;
  const distance = opts.distance;
  const selfieUrl = opts.selfieUrl;
  const time = opts.time;
  const outOfRange = opts.outOfRange;

  const headerColor = outOfRange ? '#B23A3A' : COLOR_PRIMARY;
  const headerText = outOfRange ? '⚠️ นอกรัศมี สแกน ' + thaiSlot(slot) : '✅ ลงเวลา ' + thaiSlot(slot);

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerColor,
      paddingAll: 'md',
      contents: [
        { type: 'text', text: headerText, color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: time, color: '#FFFFFF', size: 'xs', margin: 'sm' }
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
        kvRow('พนักงาน', emp.employee_id + ' — ' + emp.display_name),
        kvRow('ระยะ', distance + ' m' + (outOfRange ? ' (นอกรัศมี)' : '')),
        kvRow('ช่วง', thaiSlot(slot))
      ]
    }
  };
}

function thaiSlot(slot) {
  const map = {
    IN: 'กะเข้า',
    LUNCH_OUT: 'พักเที่ยง',
    LUNCH_IN: 'กลับจากพัก',
    OUT: 'เลิกงาน'
  };
  return map[slot] || slot;
}

/**
 * End-work reminder card (for employee still at work without approved OT)
 */
function buildEndWorkReminderCard(emp, hasOTRequest) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [{
        type: 'text', text: '⚠️ แจ้งเตือนเลิกงาน',
        color: '#FFFFFF', weight: 'bold', size: 'lg'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ถึง คุณ ' + emp.display_name,
          color: COLOR_GRAY,
          size: 'sm'
        },
        {
          type: 'text',
          text: 'ถึงเวลาเลิกงานแล้ว',
          color: COLOR_PRIMARY,
          weight: 'bold',
          size: 'xl',
          align: 'center',
          margin: 'md'
        },
        {
          type: 'text',
          text: 'ให้ออกจากออฟฟิศทันที',
          weight: 'bold',
          size: 'md',
          align: 'center',
          margin: 'sm'
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#FFF3CC',
          paddingAll: 'md',
          margin: 'lg',
          cornerRadius: 'md',
          contents: [{
            type: 'text',
            text: '⚠️ คำเตือนสำคัญ',
            weight: 'bold',
            size: 'sm',
            color: '#B23A3A'
          }, {
            type: 'text',
            text: 'หากไม่ได้รับอนุญาตให้ทำงานล่วงเวลา บริษัทฯ จะไม่รับผิดชอบค่าล่วงเวลาทุกกรณี',
            size: 'xs',
            wrap: true,
            margin: 'sm'
          }]
        }
      ]
    }
  };
}

function buildLateCheckinAlertCard(emp, expectedTime, actualTime) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [{
        type: 'text', text: '⏰ มาสายแจ้งเตือน',
        color: '#FFFFFF', weight: 'bold', size: 'lg'
      }]
    },
    body: {
      type: 'box', layout: 'vertical',
      contents: [
        kvRow('พนักงาน', emp.display_name),
        kvRow('เวลาเข้างาน', expectedTime),
        kvRow('เวลาเช็คอินจริง', actualTime || '-')
      ]
    }
  };
}
