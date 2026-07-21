/**
 * notifications.js - Dispatches notifications to Discord and Telegram.
 * Handles client-side fetch requests to webhooks and bot APIs.
 */

const notifications = {
  // Translate blood pressure levels to Thai terminology and emojis
  getBPInterpretation: function(sys, dia) {
    if (sys >= 180 || dia >= 110) {
      return { label: '🔴 ภาวะวิกฤต (อันตรายมาก)', color: '#dc2626' };
    } else if (sys >= 140 || dia >= 90) {
      return { label: '🟠 ความดันโลหิตสูง ระยะที่ 2', color: '#ea580c' };
    } else if (sys >= 130 || dia >= 89) {
      return { label: '🟠 ความดันโลหิตสูง ระยะที่ 1', color: '#f59e0b' };
    } else if (sys >= 120 && dia < 80) {
      return { label: '🟡 ความดันโลหิตค่อนข้างสูง', color: '#eab308' };
    } else if (sys < 90 && dia < 60) {
      return { label: '🔵 ความดันโลหิตต่ำ', color: '#2563eb' };
    } else {
      return { label: '🟢 ความดันโลหิตปกติ', color: '#16a34a' };
    }
  },

  // Send Discord notification via Webhook
  sendDiscordNotification: async function(record, settings) {
    const webhookUrl = settings.discordWebhook;
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      console.log("Discord webhook is empty or invalid. Skipping.");
      return false;
    }

    const interp = this.getBPInterpretation(record.SYS, record.DIA);
    const postureMap = { sitting: 'นั่ง', lying: 'นอน', standing: 'ยืน' };
    const armMap = { left: 'ซ้าย', right: 'ขวา' };

    const payload = {
      embeds: [
        {
          title: "📢 บันทึกผลตรวจวัดความดันโลหิตใหม่",
          description: `พบการบันทึกข้อมูลสุขภาพชิ้นใหม่เข้าระบบผ่าน **Smart BP Reader**`,
          color: parseInt(interp.color.replace('#', ''), 16),
          fields: [
            {
              name: "👤 ผู้รับการตรวจ",
              value: `**ชื่อ:** ${record.name}\n**ID:** ${record.patient_id}`,
              inline: true
            },
            {
              name: "📅 วันที่และเวลา",
              value: record.timestamp,
              inline: true
            },
            {
              name: "📊 ผลการวัดความดัน",
              value: `• **SYS (ตัวบน):** ${record.SYS} mmHg\n• **DIA (ตัวล่าง):** ${record.DIA} mmHg\n• **PULSE (ชีพจร):** ${record.PULSE} ครั้ง/นาที`,
              inline: false
            },
            {
              name: "📈 สถานะและการแปรผล",
              value: `**${interp.label}**`,
              inline: false
            },
            {
              name: "🩺 ข้อมูลประกอบ",
              value: `• **ท่าทางขณะวัด:** ${postureMap[record.posture] || 'ไม่ได้ระบุ'}\n• **แขนที่วัด:** ${armMap[record.arm] || 'ไม่ได้ระบุ'}\n• **พฤติกรรมก่อนวัด:** ${record.pre_measure_behavior || '-'}\n• **อาการร่วม:** ${record.symptoms || '-'}`,
              inline: false
            }
          ],
          footer: {
            text: "ระบบรายงานสุขภาพอัตโนมัติ · วิทยาลัยเทคนิคสมุทรสงคราม",
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error("Error sending Discord notification:", e);
      return false;
    }
  },

  // Send Telegram notification via Bot API
  sendTelegramNotification: async function(record, settings) {
    const botToken = settings.telegramToken;
    const chatId = settings.telegramChatId;
    
    if (!botToken || !chatId) {
      console.log("Telegram bot token or Chat ID is missing. Skipping.");
      return false;
    }

    const interp = this.getBPInterpretation(record.SYS, record.DIA);
    const postureMap = { sitting: 'นั่ง', lying: 'นอน', standing: 'ยืน' };
    const armMap = { left: 'ซ้าย', right: 'ขวา' };

    const message = `📢 *บันทึกผลการวัดความดันใหม่*\n\n` +
      `👤 *ผู้รับการตรวจ:* ${record.name} (ID: ${record.patient_id})\n` +
      `📅 *เวลา:* ${record.timestamp}\n\n` +
      `📊 *ผลการวัด:*\n` +
      `• SYS (ตัวบน): *${record.SYS}* mmHg\n` +
      `• DIA (ตัวล่าง): *${record.DIA}* mmHg\n` +
      `• ชีพจร: *${record.PULSE}* bpm\n\n` +
      `📈 *แปรผล:* *${interp.label}*\n\n` +
      `🩺 *ข้อมูลเพิ่มเติม:*\n` +
      `• ท่าทาง: ${postureMap[record.posture] || '-'}\n` +
      `• แขนที่วัด: ${armMap[record.arm] || '-'}\n` +
      `• ก่อนวัด: ${record.pre_measure_behavior || '-'}\n` +
      `• อาการ: ${record.symptoms || '-'}\n\n` +
      `_รายงานจากระบบอัตโนมัติ Smart BP Reader_`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      return response.ok;
    } catch (e) {
      console.error("Error sending Telegram notification:", e);
      return false;
    }
  },

  // Trigger all notifications for a saved record
  triggerAllNotifications: async function(record) {
    if (typeof window.db === 'undefined') return;
    const settings = window.db.getSettings();
    
    // Non-blocking parallel calls
    this.sendDiscordNotification(record, settings);
    this.sendTelegramNotification(record, settings);
  }
};

window.notifications = notifications;
