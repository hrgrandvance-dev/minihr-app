// Translations Object - Thai/English
const TRANSLATIONS = {
  // Leave Types
  LEAVE_TYPE: {
    sick: { th: 'ลาป่วย', en: 'Sick Leave' },
    personal: { th: 'ลากิจ', en: 'Personal Leave' },
    vacation: { th: 'พักร้อน', en: 'Vacation' },
    unpaid: { th: 'ไม่รับเงิน', en: 'Unpaid Leave' },
    emergency: { th: 'ฉุกเฉิน', en: 'Emergency' }
  },

  // Leave Duration
  DURATION: {
    full_day: { th: 'เต็มวัน', en: 'Full Day' },
    half_day_morning: { th: 'ครึ่งเช้า', en: 'Half Day (AM)' },
    half_day_afternoon: { th: 'ครึ่งบ่าย', en: 'Half Day (PM)' },
    hourly: { th: 'รายชั่วโมง', en: 'Hourly' }
  },

  // Approval Status & Actions
  ACTION: {
    approve: { th: 'อนุมัติ', en: 'Approve' },
    reject: { th: 'ปฏิเสธ', en: 'Reject' },
    need_info: { th: 'ขอข้อมูล', en: 'More Info' }
  },

  // Request Type Labels
  REQUEST_TYPE: {
    leave: { th: 'ใบลา', en: 'Leave' },
    ot: { th: 'OT', en: 'Overtime' },
    evidence: { th: 'หลักฐาน', en: 'Evidence' }
  },

  // Status Messages (Approval Inbox)
  APPROVAL_STATUS: {
    pending_level_1: { th: 'ระดับ 1', en: 'Level 1' },
    pending_level_2: { th: 'ระดับ 2', en: 'Level 2' },
    pending_hr: { th: 'HR', en: 'HR' }
  },

  // Success Messages
  SUCCESS: {
    leave_submitted: { th: 'ส่งใบลาเรียบร้อย', en: 'Leave Request Submitted' },
    ot_submitted: { th: 'ส่งคำขอ OT เรียบร้อย', en: 'OT Request Submitted' },
    checkin_success: { th: 'ลงเวลาเรียบร้อย', en: 'Check-in Successful' },
    evidence_submitted: { th: 'ส่งหลักฐานเรียบร้อย', en: 'Evidence Submitted' },
    saved: { th: 'บันทึกแล้ว', en: 'Saved' },
    registered: { th: 'ลงทะเบียนแล้ว', en: 'Registered' }
  },

  // Error Messages
  ERROR: {
    missing_camera: { th: 'กรุณาถ่ายรูปก่อน', en: 'Please take a photo first' },
    missing_gps: { th: 'ต้องการ GPS', en: 'GPS Required' },
    camera_permission: { th: 'กรุณาอนุญาติให้ใช้กล้อง', en: 'Camera Permission Required' },
    camera_not_found: { th: 'ไม่พบกล้องในอุปกรณ์นี้', en: 'Camera Not Found' },
    gps_failed: { th: 'เปิด GPS ไม่สำเร็จ', en: 'GPS Failed' },
    gps_unsupported: { th: 'อุปกรณ์ไม่รองรับ GPS', en: 'GPS Not Supported' },
    load_failed: { th: 'โหลดไม่ได้', en: 'Loading Failed' },
    no_requests: { th: 'ไม่มีรายการรออนุมัติ', en: 'No Pending Requests' },
    no_employees: { th: 'ยังไม่มีพนักงาน', en: 'No Employees' },
    liff_config_missing: { th: 'ยังไม่ได้ตั้งค่า LIFF_ID ใน Code.gs', en: 'LIFF_ID Not Configured' },
    line_user_id_missing: { th: 'ไม่พบ LINE user id', en: 'LINE User ID Not Found' }
  },

  // Loading Messages
  LOADING: {
    loading: { th: 'กำลังโหลด...', en: 'Loading...' },
    requesting_location: { th: 'กำลังค้นหาตำแหน่ง...', en: 'Requesting Location...' },
    processing: { th: 'กำลังประมวลผล...', en: 'Processing...' },
    sending: { th: 'กำลังส่งข้อมูล...', en: 'Sending Data...' }
  },

  // Form Labels
  FORM_LABELS: {
    leave_type: { th: 'ประเภทการลา', en: 'Leave Type' },
    duration: { th: 'ระยะเวลา', en: 'Duration' },
    start_date: { th: 'วันที่เริ่มลา', en: 'Start Date' },
    end_date: { th: 'วันที่สิ้นสุด', en: 'End Date' },
    hours: { th: 'จำนวนชั่วโมง', en: 'Hours' },
    reason: { th: 'เหตุผล', en: 'Reason' },
    ot_date: { th: 'วันที่ทำ OT', en: 'OT Date' },
    time_range: { th: 'ช่วงเวลา', en: 'Time Range' },
    start_time: { th: 'เริ่ม', en: 'Start Time' },
    end_time: { th: 'สิ้นสุด', en: 'End Time' },
    total: { th: 'รวม', en: 'Total' },
    notes: { th: 'หมายเหตุ', en: 'Notes' },
    request_id: { th: 'รหัสคำขอ', en: 'Request ID' },
    type: { th: 'ประเภท', en: 'Type' }
  },

  // Balance Page Labels
  BALANCE_LABELS: {
    salary_estimate: { th: 'ยอดประมาณการเดือนนี้', en: 'Estimated Salary' },
    details: { th: 'รายละเอียดประมาณการ', en: 'Salary Details' },
    leave_quota: { th: 'สิทธิ์ลาคงเหลือ', en: 'Remaining Leave Quota' },
    last_payment: { th: 'งวดล่าสุด', en: 'Last Payment' },
    base_pay: { th: 'ค่าจ้างพื้นฐาน', en: 'Base Salary' },
    ot_pay: { th: 'ค่า OT', en: 'OT Pay' },
    bonus: { th: 'เงินเพิ่ม', en: 'Bonus' },
    deduction: { th: 'เงินหัก', en: 'Deduction' },
    working_days: { th: 'วันทำงาน', en: 'Working Days' },
    ot_hours: { th: 'OT (ชม.)', en: 'OT Hours' },
    pending: { th: 'รออนุมัติ', en: 'Pending' },
    period: { th: 'งวด', en: 'Period' },
    status: { th: 'สถานะ', en: 'Status' }
  },

  // Holiday Types
  HOLIDAY_TYPE: {
    substitution: { th: '🔄 ชดเชย', en: '🔄 Substitution' },
    national: { th: '🎌 นักขัตฤกษ์', en: '🎌 National Holiday' }
  },

  // HR Tools Labels
  HR_TABS: {
    employees: { th: 'พนักงาน', en: 'Employees' },
    payroll: { th: 'เพิ่ม/หัก', en: 'Pay Items' },
    quota: { th: 'โควต้าลา', en: 'Leave Quota' },
    holidays: { th: 'วันหยุด', en: 'Holidays' },
    report: { th: 'รายงาน', en: 'Reports' }
  },

  HR_STATUS: {
    active: { th: 'ใช้งาน', en: 'Active' },
    inactive: { th: 'ไม่ใช้งาน', en: 'Inactive' }
  },

  // Photo Status (Register)
  PHOTO_STATUS: {
    not_selected: { th: '⚠️ ยังไม่ได้ถ่ายรูป', en: '⚠️ No Photo' },
    selected: { th: '✅ เลือกรูปแล้ว', en: '✅ Photo Selected' }
  },

  // Response Page
  RESPONSE_STATUS: {
    processing: { th: 'กำลังประมวลผล', en: 'Processing' },
    success: { th: 'สำเร็จ', en: 'Success' },
    error: { th: 'ผิดพลาด', en: 'Error' },
    pending: { th: 'รอประมวลผล', en: 'Pending' },
    close: { th: 'ปิด', en: 'Close' }
  },

  // Miscellaneous
  MISC: {
    loading_data: { th: 'กำลังโหลดข้อมูล...', en: 'Loading Data...' },
    wait: { th: 'โปรดรอสักครู่', en: 'Please Wait' },
    submit: { th: 'ส่ง', en: 'Submit' },
    cancel: { th: 'ยกเลิก', en: 'Cancel' },
    approval_inbox: { th: 'กล่องอนุมัติ', en: 'Approval Inbox' },
    pending_count: { th: 'รออนุมัติ', en: 'Pending' },
    approve_inbox: { th: 'Approval Inbox', en: 'Approval Inbox' }
  },

  // Banks (for register)
  BANKS: {
    kbank: { th: 'ธนาคารกสิกรไทย', en: 'Kasikornbank' },
    bbl: { th: 'ธนาคารแบงก์อก', en: 'Bangkok Bank' },
    ttb: { th: 'ธนาคารทหารไทย', en: 'TMBThanachart' },
    krungsri: { th: 'ธนาคารกรุงศรี', en: 'Bank of Ayudhya' },
    scb: { th: 'ธนาคารไซยามพาณิชย์', en: 'Siam Commercial Bank' },
    kmnc: { th: 'ธนาคารเกียรตินาคินภัณฑ์', en: 'Kiatnakin Phatra Bank' },
    bac: { th: 'ธนาคารกรุงเทพ', en: 'Bank of Bangkok' }
  }
};

// Helper function to get Thai/English text
function getText(key, lang = 'th') {
  const parts = key.split('.');
  let obj = TRANSLATIONS;
  for (let part of parts) {
    obj = obj?.[part];
  }
  return obj?.[lang] || key;
}

// Helper function to get both Thai and English
function getBoth(key) {
  const parts = key.split('.');
  let obj = TRANSLATIONS;
  for (let part of parts) {
    obj = obj?.[part];
  }
  return obj || { th: key, en: key };
}
