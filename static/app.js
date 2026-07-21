(() => {
  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnCapture = document.getElementById('btnCapture');
  const statusEl = document.getElementById('status');
  const dbgImg = document.getElementById('debugImage');

  const detectionBox = document.getElementById('detection-results');
  const actionButtons = document.getElementById('action-buttons');
  const nameSection = document.getElementById('nameSection');
  const idSection = document.getElementById('idSection'); // Added patient ID section
  const nameInput = document.getElementById('patientName');
  const idInput = document.getElementById('patientID'); // patient ID field (can be <select>)
  const idFilter = document.getElementById('patientIDFilter'); // optional text filter for ID select

  const valSYS = document.getElementById('valSYS');
  const valDIA = document.getElementById('valDIA');
  const valPULSE = document.getElementById('valPULSE');
  const editSYS = document.getElementById('editSYS');
  const editDIA = document.getElementById('editDIA');
  const editPULSE = document.getElementById('editPULSE');
  const postureSelect = document.getElementById('postureSelect');
  const armSelect = document.getElementById('armSelect');
  const preBehaviorInput = document.getElementById('preBehavior');
  const symptomsInput = document.getElementById('symptoms');
  const btnSave = document.getElementById('btnSave');
  const btnCancel = document.getElementById('btnCancel');
  const idList = document.getElementById('idList');
  const nameList = document.getElementById('nameList');
  const interpEl = document.getElementById('bp-interpretation');
  const faceLoginBtn = document.getElementById('btnFaceLogin');
  const faceModal = document.getElementById('faceLoginModal');
  const faceLoginVideo = document.getElementById('faceLoginVideo');
  const faceLoginStart = document.getElementById('faceLoginStart');
  const faceLoginCapture = document.getElementById('faceLoginCapture');
  const faceLoginClose = document.getElementById('faceLoginClose');
  const faceLoginStatus = document.getElementById('faceLoginStatus');
  const faceLoginHint = document.getElementById('faceLoginHint');
  const faceLoginResult = document.getElementById('faceLoginResult');
  const faceLoginName = document.getElementById('faceLoginName');
  const faceLoginId = document.getElementById('faceLoginId');
  const faceLoginConfirm = document.getElementById('faceLoginConfirm');
  const faceLoginRetry = document.getElementById('faceLoginRetry');

  let stream = null;
  let lastResult = null;
  let usersCache = [];
  const faceCanvas = document.createElement('canvas');
  let faceLoginStream = null;
  let faceLoginTimer = null;
  let faceLoginFound = null;
  let lastSpeechKey = '';
  let cachedVoice = null;

  function getThaiFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    if (cachedVoice) return cachedVoice;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const thVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('th'));
    const femaleKeywords = /female|หญิง|woman|girl/i;
    const pickFemale = thVoices.find(v => femaleKeywords.test(v.name || v.voiceURI || ''));
    cachedVoice = pickFemale || thVoices[0] || null;
    return cachedVoice;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
  }

  // initial UI state
  detectionBox.hidden = true;
  nameSection.hidden = false;
  idSection.hidden = false;
  actionButtons.hidden = false;
  btnSave.disabled = true;
  if (interpEl) interpEl.hidden = true;

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#a30000' : '';
  }

  function setFaceLoginStatus(msg, isError = false) {
    if (!faceLoginStatus) return;
    faceLoginStatus.textContent = msg || '';
    faceLoginStatus.style.color = isError ? '#a30000' : '';
  }

  function hideFaceLoginResult() {
    faceLoginFound = null;
    if (faceLoginResult) faceLoginResult.hidden = true;
  }

  function stopFaceLoginLoop() {
    if (faceLoginTimer) {
      clearInterval(faceLoginTimer);
      faceLoginTimer = null;
    }
  }

  function stopFaceLoginCamera() {
    stopFaceLoginLoop();
    if (faceLoginStream) {
      faceLoginStream.getTracks().forEach(t => t.stop());
      faceLoginStream = null;
    }
    if (faceLoginVideo) faceLoginVideo.srcObject = null;
    if (faceLoginStart) faceLoginStart.disabled = false;
    if (faceLoginCapture) faceLoginCapture.disabled = true;
  }

  function setFaceModalVisible(show) {
    if (!faceModal) return;
    faceModal.hidden = !show;
    if (!show) {
      setFaceLoginStatus('');
      stopFaceLoginCamera();
      hideFaceLoginResult();
      if (faceLoginHint) faceLoginHint.textContent = 'มองตรงให้อยู่กลางกรอบ';
    } else {
      setFaceLoginStatus('มองตรงให้อยู่กลางกรอบ แล้วหันช้าๆซ้าย-ขวา');
      if (faceLoginStart) faceLoginStart.disabled = false;
      if (faceLoginCapture) faceLoginCapture.disabled = true;
      if (faceLoginHint) faceLoginHint.textContent = 'มองตรงแล้วหันซ้าย-ขวาช้าๆ';
      hideFaceLoginResult();
      startFaceLoginCamera().then(() => startFaceLoginLoop()).catch(() => {});
    }
  }

  async function startFaceLoginCamera() {
    if (!navigator.mediaDevices) {
      setFaceLoginStatus('อุปกรณ์ไม่รองรับการเปิดกล้อง', true);
      return;
    }
    try {
      faceLoginStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (faceLoginVideo) faceLoginVideo.srcObject = faceLoginStream;
      if (faceLoginStart) faceLoginStart.disabled = true;
      if (faceLoginCapture) faceLoginCapture.disabled = false;
      setFaceLoginStatus('เปิดกล้องแล้ว มองตรงและให้ใบหน้าอยู่เต็มกรอบ');
      if (faceLoginHint) faceLoginHint.textContent = 'ค่อย ๆ หันซ้าย-ขวาให้เห็นกรอบทั้งหมด';
    } catch (err) {
      setFaceLoginStatus('เปิดกล้องไม่สำเร็จ: ' + (err.message || err), true);
    }
  }

  function startFaceLoginLoop() {
    stopFaceLoginLoop();
    faceLoginTimer = setInterval(() => captureFaceLoginFrame(true), 1400);
  }

  async function captureFaceLoginFrame(auto = false) {
    if (!faceLoginStream || !faceLoginVideo) {
      setFaceLoginStatus('ยังไม่เปิดกล้อง', true);
      return;
    }
    if (faceLoginFound && auto) return;
    const w = faceLoginVideo.videoWidth || 480;
    const h = faceLoginVideo.videoHeight || 360;
    faceCanvas.width = w;
    faceCanvas.height = h;
    const ctx = faceCanvas.getContext('2d');
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(faceLoginVideo, 0, 0, w, h);
    ctx.restore();
    const dataUrl = faceCanvas.toDataURL('image/jpeg', 0.92);
    try {
      setFaceLoginStatus('กำลังจำใบหน้า...');
      if (faceLoginCapture) faceLoginCapture.disabled = true;
      const res = await fetch('/api/face_identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: dataUrl })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.user) {
        throw new Error(data.error || 'จำใบหน้าไม่สำเร็จ');
      }
      faceLoginFound = data.user;
      if (faceLoginName) faceLoginName.textContent = data.user.full_name || '-';
      if (faceLoginId) faceLoginId.textContent = `ID: ${data.user.user_id || '-'}`;
      if (faceLoginResult) faceLoginResult.hidden = false;
      setFaceLoginStatus('พบใบหน้าในทะเบียน กรุณายืนยัน');
      stopFaceLoginLoop();
    } catch (err) {
      setFaceLoginStatus(err.message || 'จำใบหน้าไม่สำเร็จ', true);
      if (faceLoginCapture) faceLoginCapture.disabled = false;
      if (!auto) hideFaceLoginResult();
    }
  }

  // ---------- ฟังก์ชันปรับสีตามค่าความดัน ----------
  function updateCardColor(sysVal, diaVal, pulseVal) {
    const sysBox = valSYS.closest('.kv');
    const diaBox = valDIA.closest('.kv');
    const pulseBox = valPULSE.closest('.kv');

    if (!sysBox || !diaBox || !pulseBox) return;

    // ใช้ช่วงเดียวกับหน้าเกณฑ์ (guide.html)
    const colorForSys = v => {
      if (!isFiniteNumber(v)) return 'neutral';
      if (v >= 180) return 'danger';          // วิกฤต
      if (v >= 140) return 'high';            // ระยะ 2
      if (v >= 130) return 'mid';             // ระยะ 1
      if (v >= 120) return 'adjust';          // ค่อนข้างสูง (Elevated)
      if (v >= 90)  return 'good';            // ปกติ
      return 'low';                           // ต่ำ
    };
    const colorForDia = v => {
      if (!isFiniteNumber(v)) return 'neutral';
      if (v >= 110) return 'danger';          // วิกฤต
      if (v >= 90)  return 'high';            // ระยะ 2
      if (v >= 80)  return 'mid';             // ระยะ 1
      if (v >= 60)  return 'good';            // ปกติ
      return 'low';                           // ต่ำ
    };
    const colorForPulse = v => {
      if (!isFiniteNumber(v)) return 'neutral';
      if (v > 100) return 'danger';
      if (v >= 60) return 'good';
      if (v > 0)   return 'low';
      return 'neutral';
    };

    sysBox.dataset.level = colorForSys(Number(sysVal));
    diaBox.dataset.level = colorForDia(Number(diaVal));
    pulseBox.dataset.level = colorForPulse(Number(pulseVal));
  }

  function isFiniteNumber(x) {
    const n = Number(x);
    return typeof n === 'number' && isFinite(n) && !Number.isNaN(n);
  }

  function showPreviewImage(blob) {
    preview.hidden = false;
    preview.src = URL.createObjectURL(blob);
  }

  // ---------- validation / save enable ----------
  function haveAllThreeValues() {
    const s = Number(editSYS.value);
    const d = Number(editDIA.value);
    const p = Number(editPULSE.value);
    const allFinite = isFiniteNumber(s) && isFiniteNumber(d) && isFiniteNumber(p);
    if (!allFinite) return false;
    return s > 1 && d > 1 && p > 1;
  }

  // exact identity requirement
  let exactIdentityOK = false;

  function haveValidIdentity() {
    const name = (nameInput.value || '').trim();
    const id = (idInput.value || '').trim();
    return name.length > 0 && id.length > 0 && exactIdentityOK === true;
  }

  async function verifyExactIdentity() {
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    if (!name || !id) { exactIdentityOK = false; updateSaveEnabled(); return; }
    try {
      const res = await fetch(`/api/user_by_id/${encodeURIComponent(id)}`);
      const data = await res.json();
      const ok = !!(data && data.ok && data.user && (data.user.full_name || '').trim() === name);
      exactIdentityOK = ok;
      if (!ok) {
        setStatus('ชื่อ–ID ไม่ตรงกับที่ลงทะเบียน กรุณาเลือกจากรายการให้ตรง', true);
      }
    } catch (e) {
      exactIdentityOK = false;
    } finally {
      updateSaveEnabled();
    }
  }

  function updateSaveEnabled() {
    // enable only if exact identity verified AND all three values are valid numbers
    btnSave.disabled = !(haveValidIdentity() && haveAllThreeValues());
  }

  // ---------- แปรผลค่าความดัน + คำแนะนำคร่าว ๆ ----------
  function interpretBP(sys, dia, pulse){
    let card = {
      title: '',   // แสดงอิโมจิ + ชื่อความเสี่ยง
      sub: '',     // แสดง Stage / เกณฑ์
      detail: '',  // คำอธิบายสั้น
      action: '',  // คำแนะนำ
      level: 'neutral',
      adviceTips: []
    };

    // จัดช่วงตามตารางเกณฑ์ใน guide.html
    if (sys >= 180 || dia >= 110) {
      card.level = 'danger';
      card.title = '🔴 ภาวะความดันโลหิตสูงขั้นรุนแรง (วิกฤต)';
      card.sub = '≥180 / ≥110 mmHg';
      card.detail = 'อาจมีอาการปวดศีรษะรุนแรง เจ็บหน้าอก เหนื่อย หรือตามัว';
      card.action = 'ควรรีบพบแพทย์หรือไปโรงพยาบาลทันที';
      card.adviceTips = [
        'อยู่ในที่สงบ ลดความกังวล',
        'เลี่ยงการออกแรงหรือเดินเยอะ',
        'หากมีอาการรุนแรง ให้รีบขอความช่วยเหลือทันที'
      ];
    }
    else if (sys >= 140 || dia >= 90) {
      card.level = 'high';
      card.title = '🟠 ความดันโลหิตสูง ระยะที่ 2';
      card.sub = 'SYS 140–179 หรือ DIA 90–109 mmHg';
      card.detail = 'มีความเสี่ยงต่อหลอดเลือดหัวใจและสมองเพิ่มขึ้นอย่างมาก';
      card.action = 'ควรได้รับการประเมินและติดตามรักษาตามคำแนะนำแพทย์';
      card.adviceTips = [
        'ลดเค็ม หลีกเลี่ยงอาหารแปรรูป',
        'ออกกำลังกายสม่ำเสมอ อย่างน้อย 150 นาที/สัปดาห์',
        'งดสูบบุหรี่และจำกัดแอลกอฮอล์'
      ];
    }
    else if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
      card.level = 'mid';
      card.title = '🟠 ความดันโลหิตสูง ระยะที่ 1';
      card.sub = 'SYS 130–139 หรือ DIA 80–89 mmHg';
      card.detail = 'มีความเสี่ยงเริ่มเพิ่มขึ้น ควรดูแลสุขภาพอย่างต่อเนื่อง';
      card.action = 'พิจารณาปรึกษาแพทย์ โดยเฉพาะหากมีปัจจัยเสี่ยงร่วม';
      card.adviceTips = [
        'ลดน้ำหนัก หากมีน้ำหนักเกิน',
        'ลดความเครียด เพิ่มการพักผ่อน',
        'วัดและบันทึกค่าความดันอย่างต่อเนื่อง'
      ];
    }
    else if (sys >= 120 && sys <= 129 && dia < 80) {
      card.level = 'adjust';
      card.title = '🟡 ความดันโลหิตค่อนข้างสูง';
      card.sub = 'SYS 120–129 และ DIA < 80 mmHg';
      card.detail = 'ควรเฝ้าระวังเพื่อลดโอกาสเข้าสู่ความดันสูง';
      card.action = 'ควรปรับพฤติกรรมและติดตามค่าความดัน';
      card.adviceTips = [
        'ควบคุมอาหาร โดยเฉพาะลดเค็ม',
        'มีกิจกรรมทางกายทุกวัน เช่น เดิน 30 นาที',
        'ลดเครื่องดื่มที่มีคาเฟอีนหากดื่มเยอะ'
      ];
    }
    else if (sys < 90 && dia < 60) {
      card.level = 'low';
      card.title = '🔵 ความดันโลหิตต่ำ';
      card.sub = '< 90 / < 60 mmHg';
      card.detail = 'อาจทำให้เวียนศีรษะ หน้ามืด';
      card.action = 'ควรพักผ่อน ดื่มน้ำเพียงพอ หากมีอาการชัดเจนควรพบแพทย์';
      card.adviceTips = [
        'ลุกขึ้นจากท่านั่ง/นอนอย่างช้า ๆ',
        'ดื่มน้ำให้เพียงพอ',
        'หลีกเลี่ยงการยืนนาน ๆ และแดดร้อนจัด'
      ];
    }
    else {
      card.level = 'good';
      card.title = '🟢 ความดันโลหิตปกติ';
      card.sub = 'SYS < 120 และ DIA < 80 mmHg';
      card.detail = 'อยู่ในเกณฑ์ปกติ';
      card.action = 'ดูแลสุขภาพต่อเนื่อง ตรวจความดันสม่ำเสมอ';
      card.adviceTips = [
        'ทานอาหารครบ 5 หมู่ ลดหวาน มัน เค็ม',
        'ออกกำลังกายอย่างสม่ำเสมอ',
        'ตรวจวัดความดันทุกสัปดาห์เพื่อเฝ้าระวัง'
      ];
    }




    // แนบแปรผลชีพจรเพิ่มเติม
    let pulseNote = '';
    if (isFiniteNumber(pulse)) {
      if (pulse > 100) pulseNote = `ชีพจรเร็ว (${pulse}/นาที)`;
      else if (pulse < 50) pulseNote = `ชีพจรช้า (${pulse}/นาที)`;
      else pulseNote = `ชีพจรปกติ (${pulse}/นาที)`;
    }
    return { ...card, pulseNote };
  }

  function speakInterpretation(r, s, d, p) {
    if (!('speechSynthesis' in window)) return;
    const key = `${r.level}|${s}|${d}|${p}`;
    if (key === lastSpeechKey) return;
    const cleanTitle = (r.title || '').replace(/^[^ก-๙A-Za-z0-9]+/, '').trim();
    const parts = [];
    parts.push(`ผลการวัดความดันโลหิตของคุณอยู่ใน `);
    if (cleanTitle) parts.push(`ระดับ ${cleanTitle}`);
    parts.push(`,,ค่าความดันโลหิตของคุณคือ, ค่าความดันขณะหัวใจบีบตัว ${s} มิลลิเมตรปรอท,และ ค่าความดันขณะหัวใจคลายตัว${d} มิลลิเมตรปรอท`);
    if (isFiniteNumber(p)) parts.push(`,อัตราการเต้นของหัวใจ ${p} ครั้งต่อนาที`);
    if (r.action) parts.push(`,คำแนะนำคือ ${r.action}`);
    const text = parts.join(' ');
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'th-TH';
      utt.rate = 1;
      utt.pitch = 2;
      // เลือกเสียงผู้หญิงไทยถ้ามี
      const voice = getThaiFemaleVoice();
      if (voice) utt.voice = voice;
      window.speechSynthesis.speak(utt);
      lastSpeechKey = key;
    } catch (_) { /* ignore speech errors */ }
  }

  function updateInterpretation(){
    if (!interpEl) return;
    const s = Number(editSYS.value);
    const d = Number(editDIA.value);
    const p = Number(editPULSE.value);
    if (!haveAllThreeValues()) { interpEl.hidden = true; interpEl.textContent = ''; return; }
    const r = interpretBP(s, d, p);
    interpEl.dataset.level = r.level;
    interpEl.hidden = false;
    const tipsHtml = Array.isArray(r.adviceTips) && r.adviceTips.length
      ? `<ul class="risk-tips">${r.adviceTips.map(t => `<li>${t}</li>`).join('')}</ul>`
      : '';
    interpEl.innerHTML = `
      <div class="risk-title">${r.title}</div>
      <div class="risk-sub">${r.sub}</div>
      <div class="risk-detail">${r.detail}</div>
      <div class="risk-action">${r.action}</div>
      ${tipsHtml}
      <div class="risk-measured">วัดได้: SYS ${s} / DIA ${d}${isFiniteNumber(p) ? ` · ${r.pulseNote}` : ''}</div>
    `;
    speakInterpretation(r, s, d, p);
  }

  // ---------- Auto-fill name and ID ----------
  async function autoFillNameAndID() {
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    const nameStillFocused = document.activeElement === nameInput;
    
    // If name is entered and ID is empty, try to get ID from database
    if (name && !id) {
      if (nameStillFocused) return;
      try {
        const response = await fetch(`/api/user_by_name/${encodeURIComponent(name)}`);
        const data = await response.json();
        if (data.ok && data.user) {
          idInput.value = data.user.user_id;
          updateSaveEnabled();
        }
      } catch (e) {
        console.error("Error fetching user ID:", e);
      }
    }
    // If ID is entered and name is empty, try to get name from database
    else if (id && !name) {
      try {
        const response = await fetch(`/api/user_by_id/${encodeURIComponent(id)}`);
        const data = await response.json();
        if (data.ok && data.user) {
          nameInput.value = data.user.full_name;
          updateSaveEnabled();
        }
      } catch (e) {
        console.error("Error fetching user name:", e);
      }
    }
  }

  // wire inputs to validation and auto-fill
  [editSYS, editDIA, editPULSE].forEach(el => {
    el.addEventListener('input', () => {
      // keep displayed color in sync with edits
      updateCardColor(editSYS.value, editDIA.value, editPULSE.value);
      updateSaveEnabled();
      updateInterpretation();
    });
  });

  // Add auto-fill functionality to name and ID inputs
  nameInput.addEventListener('input', () => {
    updateSaveEnabled();
    clearTimeout(nameInput.autoFillTimeout);
    nameInput.autoFillTimeout = setTimeout(async () => { await autoFillNameAndID(); await verifyExactIdentity(); }, 500);
  });

  idInput.addEventListener('input', () => {
    updateSaveEnabled();
    clearTimeout(idInput.autoFillTimeout);
    idInput.autoFillTimeout = setTimeout(async () => { await autoFillNameAndID(); await verifyExactIdentity(); }, 500);
  });

  // ---------- Populate choices for name (datalist) and ID (datalist or select) ----------
  async function loadUsersList(){
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.users)) return;
      // name suggestions remain in datalist
      if (nameList) nameList.innerHTML = '';
      // ID field may be a <select> (formal) or an <input list> (legacy)
      const isSelectID = idInput && idInput.tagName === 'SELECT';
      if (isSelectID) {
        idInput.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '— เลือกเลข ID —';
        idInput.appendChild(ph);
      } else if (idList) {
        idList.innerHTML = '';
      }
      for (const u of data.users){
        if (nameList){
          const optN = document.createElement('option');
          optN.value = u.full_name;
          optN.label = `${u.full_name} · ${u.user_id}`;
          nameList.appendChild(optN);
        }
        if (isSelectID) {
          const opt = document.createElement('option');
          opt.value = u.user_id;
          opt.textContent = `${u.user_id} · ${u.full_name}`;
          idInput.appendChild(opt);
        } else if (idList) {
          const optI = document.createElement('option');
          optI.value = u.user_id;
          optI.label = `${u.user_id} · ${u.full_name}`;
          idList.appendChild(optI);
        }
      }
    } catch (e) {
      console.warn('loadUsersList failed', e);
    }
  }

  // ---------- send to server ----------
  async function sendToServer(blob) {
    setStatus('กำลังประมวลผล การตรวจจับตัวเลข...');
    const fd = new FormData();
    fd.append('file', blob, 'capture.jpg');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัพโหลดไม่สำเร็จ');

      lastResult = data;
      const { values = {}, debug_png_b64 = null } = data;

      detectionBox.hidden = false;
      nameSection.hidden = false;
      idSection.hidden = false; // Show patient ID section
      actionButtons.hidden = false;

      // normalize text -> show placeholders
      const s = (values.SYS === undefined || values.SYS === null) ? '' : String(values.SYS);
      const d = (values.DIA === undefined || values.DIA === null) ? '' : String(values.DIA);
      const p = (values.PULSE === undefined || values.PULSE === null) ? '' : String(values.PULSE);

      valSYS.textContent = s || '--';
      valDIA.textContent = d || '--';
      valPULSE.textContent = p || '--';

      editSYS.value = s || '';
      editDIA.value = d || '';
      editPULSE.value = p || '';

      if (debug_png_b64) {
        dbgImg.src = `data:image/png;base64,${debug_png_b64}`;
        dbgImg.hidden = false;
      } else {
        dbgImg.hidden = true;
      }

      // update color based on whatever values we have (or neutral)
      updateCardColor(editSYS.value, editDIA.value, editPULSE.value);
      updateInterpretation();

      // require all three values: if not complete, alert and keep Save disabled
      const ok3 = haveAllThreeValues();
      if (!ok3) {
        setStatus('อ่านค่าไม่ครบหรือไม่ถูกต้อง (ต้อง > 1) กรุณากรอก SYS/DIA/PULSE ให้ครบก่อนบันทึก', true);
      } else {
        setStatus('ตรวจจับสำเร็จ โปรดตรวจสอบและใส่ชื่อและเลข ID ให้ตรงกับทะเบียนเพื่อบันทึก');
      }
      // ensure Save button state reflects current values + name/ID
      updateSaveEnabled();

      // decide if can save
      if (!haveAllThreeValues()) {
        setStatus('ผลการตรวจจับตัวเลขขาดบางค่า — กรุณากรอกหรือแก้ไขค่า SYS/DIA/PULSE ก่อนบันทึก', true);
      } else if (!haveValidIdentity()) {
        setStatus('ผลการตรวจจับพร้อม — กรุณากรอกชื่อและเลข ID ให้ตรงกับทะเบียนก่อนบันทึก');
      } else {
        setStatus('ผลการตรวจจับตัวเลขพร้อม — กด "บันทึก" เพื่อบันทึกข้อมูล');
      }
      updateSaveEnabled();

    } catch (e) {
      console.error(e);
      setStatus('ผิดพลาด: ' + (e.message || e));
      // keep detection area visible so user can try again or edit
      detectionBox.hidden = false;
      nameSection.hidden = false;
      idSection.hidden = false; // Show patient ID section
      actionButtons.hidden = false;
      updateSaveEnabled();
    }
  }

  // ---------- เปิด/ปิดกล้อง ----------
  btnStart.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      setStatus('เปิดกล้องแล้ว');
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnCapture.disabled = false;
    } catch (e) {
      setStatus('ไม่สามารถเปิดกล้อง: ' + e.message);
    }
  });

  btnStop.addEventListener('click', () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    btnStart.disabled = false;
    btnStop.disabled = true;
    btnCapture.disabled = true;
    setStatus('ปิดกล้องแล้ว');
  });

  // ---------- แคปภาพ ----------
  btnCapture.addEventListener('click', async () => {
    if (!stream) {
      setStatus('ยังไม่เปิดกล้อง เลือกไฟล์ได้เช่นกัน');
      return;
    }
    const v = video;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    showPreviewImage(blob);
    await sendToServer(blob);
  });

  // ---------- อัพโหลดไฟล์ ----------
  fileInput.addEventListener('change', async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    preview.hidden = false;
    preview.src = URL.createObjectURL(f);
    await sendToServer(f);
    fileInput.value = '';
  });

  // ---------- บันทึก ----------
  btnSave.addEventListener('click', async () => {
    // Double-check validation before sending
    if (!haveValidIdentity()) {
      setStatus('กรุณากรอกชื่อและเลข ID ให้ตรงกับทะเบียนก่อนบันทึก', true);
      return;
    }
    if (!haveAllThreeValues()) {
      setStatus('กรุณากรอกค่าทั้ง 3 ค่า (SYS/DIA/PULSE) ให้ถูกต้องและมากกว่า 1 ก่อนบันทึก', true);
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      patient_id: idInput.value.trim(), // Added patient ID to payload
      SYS: Number(editSYS.value),
      DIA: Number(editDIA.value),
      PULSE: Number(editPULSE.value),
      posture: postureSelect ? postureSelect.value : '',
      arm: armSelect ? armSelect.value : '',
      pre_measure_behavior: preBehaviorInput ? preBehaviorInput.value.trim() : '',
      symptoms: symptomsInput ? symptomsInput.value.trim() : '',
      meta: lastResult?.meta || {},
      debug_png_b64: lastResult?.debug_png_b64 || null
    };

    try {
      setStatus('กำลังบันทึก...');
      btnSave.disabled = true;
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setStatus('บันทึกข้อมูลแล้ว → ' + (data.path || 'สำเร็จ'));
      // optional: redirect to history for this name or ID
      const searchParam = payload.name || payload.patient_id;
      if (searchParam) {
        const go = confirm('เปิดดูประวัติของ "' + searchParam + '" ตอนนี้เลยไหม?');
        if (go) location.href = '/history?name=' + encodeURIComponent(searchParam);
      }
    } catch (e) {
      console.error(e);
      setStatus('ผิดพลาดขณะบันทึก: ' + (e.message || e), true);
      btnSave.disabled = false;
    }
  });

  btnCancel.addEventListener('click', () => {
    detectionBox.hidden = true;
    nameSection.hidden = false;
    idSection.hidden = false;
    actionButtons.hidden = false;
    // clear values & preview
    valSYS.textContent = '--';
    valDIA.textContent = '--';
    valPULSE.textContent = '--';
    editSYS.value = ''; editDIA.value = ''; editPULSE.value = '';
    nameInput.value = '';
    idInput.value = ''; // Clear patient ID input
    if (postureSelect) postureSelect.value = '';
    if (armSelect) armSelect.value = '';
    if (preBehaviorInput) preBehaviorInput.value = '';
    if (symptomsInput) symptomsInput.value = '';
    preview.hidden = true;
    dbgImg.hidden = true;
    setStatus('ยกเลิกผลลัพธ์ล่าสุด');
    btnSave.disabled = true;
    if (interpEl) { interpEl.hidden = true; interpEl.textContent = ''; }
  });

  // update color when user edits manually (already added)
  [editSYS, editDIA, editPULSE].forEach(inp => {
    inp.addEventListener('input', () => {
      updateCardColor(editSYS.value, editDIA.value, editPULSE.value);
      updateSaveEnabled();
      updateInterpretation();
    });
  });

  // also update save enable when name or ID changes
  [nameInput, idInput].forEach(input => {
    input.addEventListener('input', () => updateSaveEnabled());
  });

  // Trigger auto-fill immediately when user chooses from datalist (change event)
  nameInput.addEventListener('change', async () => { await autoFillNameAndID(); await verifyExactIdentity(); });
  idInput.addEventListener('change', async () => { await autoFillNameAndID(); await verifyExactIdentity(); });

  if (faceLoginBtn && faceModal) {
    faceLoginBtn.addEventListener('click', () => setFaceModalVisible(true));
  }
  if (faceLoginClose) {
    faceLoginClose.addEventListener('click', () => setFaceModalVisible(false));
  }
  if (faceModal) {
    faceModal.addEventListener('click', (ev) => {
      if (ev.target === faceModal) setFaceModalVisible(false);
    });
  }
  if (faceLoginStart) {
    faceLoginStart.addEventListener('click', async () => {
      await startFaceLoginCamera();
      startFaceLoginLoop();
    });
  }
  if (faceLoginCapture) {
    faceLoginCapture.addEventListener('click', () => captureFaceLoginFrame(false));
  }
  if (faceLoginConfirm) {
    faceLoginConfirm.addEventListener('click', async () => {
      if (!faceLoginFound) return;
      nameInput.value = faceLoginFound.full_name || '';
      idInput.value = faceLoginFound.user_id || '';
      setStatus(`จำใบหน้าได้: ${faceLoginFound.full_name || faceLoginFound.user_id}`);
      await verifyExactIdentity();
      updateSaveEnabled();
      setFaceModalVisible(false);
    });
  }
  if (faceLoginRetry) {
    faceLoginRetry.addEventListener('click', () => {
      hideFaceLoginResult();
      setFaceLoginStatus('กำลังลองจับใหม่...');
      startFaceLoginLoop();
    });
  }

  // Load user lists for datalists on startup
  loadUsersList();
  window.addEventListener('beforeunload', () => {
    stopFaceLoginCamera();
  });

})();
