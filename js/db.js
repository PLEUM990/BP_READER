/**
 * db.js - Client-side database management utilizing localStorage.
 * Mimics a backend database for users and blood pressure records.
 */

const DB_USERS_KEY = 'bp_users';
const DB_RECORDS_KEY = 'bp_records';
const DB_SETTINGS_KEY = 'bp_settings';

// Initial Mock Data to ensure the user gets a working experience immediately
const DEFAULT_USERS = [
  {
    user_id: "0001",
    full_name: "นาย สมศักดิ์ รักดี",
    date_of_birth: "1980-05-15",
    sex: "male",
    weight_kg: 72.5,
    height_cm: 170,
    bmi: 25.1,
    contact_phone: "081-234-5678",
    notify_email: "somsak@example.com",
    notify_telegram: "",
    conditions: "ความดันโลหิตสูง, ไขมันในเลือดสูง",
    medications: "Amlodipine 5mg วันละครั้ง",
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    face_images: []
  },
  {
    user_id: "0002",
    full_name: "นาง สมศรี มีสุข",
    date_of_birth: "1985-08-20",
    sex: "female",
    weight_kg: 58.0,
    height_cm: 160,
    bmi: 22.7,
    contact_phone: "089-876-5432",
    notify_email: "somsri@example.com",
    notify_telegram: "",
    conditions: "เบาหวานชนิดที่ 2",
    medications: "Metformin 500mg หลังอาหารเช้า-เย็น",
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    face_images: []
  }
];

const DEFAULT_RECORDS = [
  {
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
    patient_id: "0001",
    name: "นาย สมศักดิ์ รักดี",
    SYS: 135,
    DIA: 85,
    PULSE: 72,
    posture: "sitting",
    arm: "left",
    pre_measure_behavior: "พักผ่อน 5 นาทีก่อนวัด",
    symptoms: "ปกติ"
  },
  {
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
    patient_id: "0001",
    name: "นาย สมศักดิ์ รักดี",
    SYS: 128,
    DIA: 82,
    PULSE: 74,
    posture: "sitting",
    arm: "left",
    pre_measure_behavior: "ดื่มชาเขียวเมื่อ 1 ชั่วโมงก่อน",
    symptoms: "เวียนศีรษะเล็กน้อย"
  },
  {
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
    patient_id: "0001",
    name: "นาย สมศักดิ์ รักดี",
    SYS: 142,
    DIA: 91,
    PULSE: 80,
    posture: "sitting",
    arm: "left",
    pre_measure_behavior: "รีบเดินขึ้นบันไดมาก่อนวัดทันที",
    symptoms: "ใจสั่น"
  },
  {
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
    patient_id: "0002",
    name: "นาง สมศรี มีสุข",
    SYS: 118,
    DIA: 76,
    PULSE: 68,
    posture: "sitting",
    arm: "left",
    pre_measure_behavior: "พัก 10 นาทีก่อนวัด",
    symptoms: "ปกติ"
  },
  {
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16),
    patient_id: "0002",
    name: "นาง สมศรี มีสุข",
    SYS: 122,
    DIA: 79,
    PULSE: 70,
    posture: "sitting",
    arm: "right",
    pre_measure_behavior: "ปกติ",
    symptoms: "ปกติ"
  }
];

const DEFAULT_SETTINGS = {
  discordWebhook: "https://discord.com/api/webhooks/1426056601441275946/AEMcSWyfVQRft3PK10G3syyligeV2WoXjjI1zuyFVO6oOSoxxMtFOq1MjQHT0aDPYiNE",
  telegramToken: "",
  telegramChatId: "",
  adminPassword: "admin", // Default password for management page
  faceConfidenceThreshold: 75
};

// Initialize DB if empty
function initDb() {
  if (!localStorage.getItem(DB_USERS_KEY)) {
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem(DB_RECORDS_KEY)) {
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(DEFAULT_RECORDS));
  }
  if (!localStorage.getItem(DB_SETTINGS_KEY)) {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }
}

initDb();

// --- Database operations for USERS ---
const db = {
  getUsers: function() {
    try {
      return JSON.parse(localStorage.getItem(DB_USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  getUserById: function(userId) {
    const users = this.getUsers();
    return users.find(u => u.user_id === userId) || null;
  },

  getUserByName: function(fullName) {
    const users = this.getUsers();
    return users.find(u => u.full_name.trim().toLowerCase() === fullName.trim().toLowerCase()) || null;
  },

  saveUser: function(user) {
    const users = this.getUsers();
    // Validate unique ID
    if (users.some(u => u.user_id === user.user_id)) {
      throw new Error(`รหัสประจำตัวผู้ใช้ ${user.user_id} นี้มีอยู่ในระบบแล้ว`);
    }
    // Validate unique name
    if (users.some(u => u.full_name.trim().toLowerCase() === user.full_name.trim().toLowerCase())) {
      throw new Error(`ชื่อ-นามสกุล "${user.full_name}" นี้มีอยู่ในระบบแล้ว`);
    }
    users.push(user);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    return user;
  },

  updateUser: function(userId, updatedData) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.user_id === userId);
    if (idx === -1) throw new Error(`ไม่พบผู้ใช้รหัส ${userId}`);
    
    // Check name conflict
    if (updatedData.full_name) {
      const conflict = users.find((u, i) => i !== idx && u.full_name.trim().toLowerCase() === updatedData.full_name.trim().toLowerCase());
      if (conflict) throw new Error(`ชื่อ-นามสกุล "${updatedData.full_name}" ซ้ำกับผู้ใช้อื่นในระบบ`);
    }

    users[idx] = { ...users[idx], ...updatedData };
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    
    // Also update name in records if name changed
    if (updatedData.full_name) {
      const records = this.getRecords();
      let updated = false;
      records.forEach(r => {
        if (r.patient_id === userId) {
          r.name = updatedData.full_name;
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
      }
    }
    
    return users[idx];
  },

  deleteUser: function(userId) {
    let users = this.getUsers();
    users = users.filter(u => u.user_id !== userId);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    
    // Also delete their BP records
    let records = this.getRecords();
    records = records.filter(r => r.patient_id !== userId);
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
    return true;
  },

  clearAllUsers: function() {
    localStorage.setItem(DB_USERS_KEY, JSON.stringify([]));
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify([]));
  },

  // --- Database operations for RECORDS ---
  getRecords: function() {
    try {
      return JSON.parse(localStorage.getItem(DB_RECORDS_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  getRecordsByPatientId: function(patientId) {
    const records = this.getRecords();
    return records.filter(r => r.patient_id === patientId);
  },

  getRecordsByNameOrId: function(query) {
    const records = this.getRecords();
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.patient_id && r.patient_id.toLowerCase().includes(q))
    );
  },

  saveRecord: function(record) {
    const records = this.getRecords();
    // Add default timestamp if not present
    if (!record.timestamp) {
      const now = new Date();
      record.timestamp = now.toISOString().replace('T', ' ').substring(0, 16);
    }
    records.push(record);
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
    return record;
  },

  deleteRecord: function(timestamp) {
    let records = this.getRecords();
    records = records.filter(r => r.timestamp !== timestamp);
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
    return true;
  },

  clearAllRecords: function() {
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify([]));
  },

  // --- Database operations for SETTINGS ---
  getSettings: function() {
    try {
      return JSON.parse(localStorage.getItem(DB_SETTINGS_KEY)) || DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: function(settings) {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  },

  // --- CSV / Backup Utilities ---
  exportToCSV: function(type) {
    const data = type === 'users' ? this.getUsers() : this.getRecords();
    if (data.length === 0) return '';
    
    // Define headers
    const headers = type === 'users' ? 
      ["user_id", "full_name", "date_of_birth", "sex", "weight_kg", "height_cm", "bmi", "contact_phone", "notify_email", "notify_telegram", "conditions", "medications", "created_at"] :
      ["timestamp", "patient_id", "name", "SYS", "DIA", "PULSE", "posture", "arm", "pre_measure_behavior", "symptoms"];
      
    let csvContent = headers.join(",") + "\r\n";
    
    data.forEach(item => {
      const row = headers.map(header => {
        let val = item[header];
        if (val === undefined || val === null) val = '';
        // Escape commas and double quotes
        val = val.toString().replace(/"/g, '""');
        if (val.search(/("|,|\n)/g) >= 0) {
          val = `"${val}"`;
        }
        return val;
      });
      csvContent += row.join(",") + "\r\n";
    });
    
    return csvContent;
  },

  importFromCSV: function(csvText, type) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return 0;
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const importedData = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter that respects quoted commas
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const row = matches.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      
      const obj = {};
      headers.forEach((header, index) => {
        let val = row[index] || '';
        // Parse numbers
        if (['weight_kg', 'height_cm', 'bmi', 'SYS', 'DIA', 'PULSE'].includes(header)) {
          val = val !== '' ? Number(val) : '';
        }
        obj[header] = val;
      });
      
      if (type === 'users') {
        if (!obj.user_id || !obj.full_name) continue;
        obj.face_images = obj.face_images ? JSON.parse(obj.face_images) : [];
        importedData.push(obj);
      } else {
        if (!obj.timestamp || !obj.patient_id) continue;
        importedData.push(obj);
      }
    }
    
    if (importedData.length === 0) return 0;
    
    if (type === 'users') {
      const currentUsers = this.getUsers();
      // Merge unique users (update existing or append new)
      importedData.forEach(impUser => {
        const idx = currentUsers.findIndex(u => u.user_id === impUser.user_id);
        if (idx >= 0) {
          currentUsers[idx] = { ...currentUsers[idx], ...impUser };
        } else {
          currentUsers.push(impUser);
        }
      });
      localStorage.setItem(DB_USERS_KEY, JSON.stringify(currentUsers));
    } else {
      const currentRecords = this.getRecords();
      // Merge unique records by timestamp + patient_id
      importedData.forEach(impRecord => {
        const idx = currentRecords.findIndex(r => r.timestamp === impRecord.timestamp && r.patient_id === impRecord.patient_id);
        if (idx >= 0) {
          currentRecords[idx] = { ...currentRecords[idx], ...impRecord };
        } else {
          currentRecords.push(impRecord);
        }
      });
      localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(currentRecords));
    }
    
    return importedData.length;
  }
};

window.db = db;
