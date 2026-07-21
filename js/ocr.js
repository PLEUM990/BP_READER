/**
 * ocr.js - Client-side OCR parsing using Tesseract.js.
 * Pre-processes images using canvas methods before running OCR to maximize accuracy.
 */

const ocr = {
  // Pre-process image on a temporary canvas: grayscale, increase contrast, and binarize
  preprocessImage: function(imageElement, canvasElement) {
    const ctx = canvasElement.getContext('2d');
    const w = imageElement.naturalWidth || imageElement.width || 640;
    const h = imageElement.naturalHeight || imageElement.height || 480;
    
    canvasElement.width = w;
    canvasElement.height = h;
    ctx.drawImage(imageElement, 0, 0, w, h);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    // Grayscale & Contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Standard luminance formula
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Increase contrast: stretch gray values
      const factor = 1.5;
      gray = (gray - 128) * factor + 128;
      
      // Simple thresholding (binarization)
      const threshold = 120;
      const finalColor = gray > threshold ? 255 : 0;
      
      data[i] = finalColor;     // R
      data[i+1] = finalColor;   // G
      data[i+2] = finalColor;   // B
    }
    
    ctx.putImageData(imgData, 0, 0);
    return canvasElement.toDataURL('image/jpeg', 0.9);
  },

  // Perform client-side OCR using Tesseract.js
  runOCR: async function(imageSrc, progressCallback) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js is not loaded. Please ensure you are online or Tesseract is correctly included.');
    }

    let worker = window.tesseractWorker;
    let isGlobal = true;
    
    if (!worker) {
      isGlobal = false;
      worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (progressCallback && m.status === 'recognizing text') {
            progressCallback(Math.round(m.progress * 100));
          }
        }
      });
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789SYSDIAPULSEpulsePULhrbpmHRBPM\n ',
      });
    }

    try {
      const { data: { text, blocks } } = await worker.recognize(imageSrc);
      if (!isGlobal) await worker.terminate();
      
      return this.parseBPValues(text, blocks);
    } catch (e) {
      if (!isGlobal && worker) await worker.terminate();
      throw e;
    }
  },

  // Extract SYS, DIA, and PULSE from OCR results
  parseBPValues: function(rawText, blocks) {
    console.log("OCR Raw Text Result:", rawText);
    
    let result = {
      SYS: null,
      DIA: null,
      PULSE: null,
      rawText: rawText,
      boxes: []
    };

    // Extract all numbers and word positions
    const numbers = [];
    const labels = {
      sys: [],
      dia: [],
      pulse: []
    };

    if (blocks && Array.isArray(blocks)) {
      blocks.forEach(block => {
        if (block.paragraphs) {
          block.paragraphs.forEach(para => {
            if (para.lines) {
              para.lines.forEach(line => {
                if (line.words) {
                  line.words.forEach(word => {
                    const text = word.text.trim().toUpperCase();
                    const bbox = word.bbox;
                    const cleanText = text.replace(/[^0-9A-Z]/g, '');

                    // Check if it is a number
                    if (/^\d+$/.test(cleanText)) {
                      const val = parseInt(cleanText, 10);
                      numbers.push({
                        value: val,
                        text: cleanText,
                        bbox: bbox,
                        cy: (bbox.y0 + bbox.y1) / 2,
                        cx: (bbox.x0 + bbox.x1) / 2
                      });
                    } else {
                      // Check for labels
                      if (cleanText.includes('SYS')) {
                        labels.sys.push({ bbox, cy: (bbox.y0 + bbox.y1) / 2, cx: (bbox.x0 + bbox.x1) / 2 });
                      } else if (cleanText.includes('DIA')) {
                        labels.dia.push({ bbox, cy: (bbox.y0 + bbox.y1) / 2, cx: (bbox.x0 + bbox.x1) / 2 });
                      } else if (cleanText.match(/(PULSE|PR|PUL|HR|BPM)/)) {
                        labels.pulse.push({ bbox, cy: (bbox.y0 + bbox.y1) / 2, cx: (bbox.x0 + bbox.x1) / 2 });
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    // Heuristic 1: Match numbers closest to labels if labels exist
    if (labels.sys.length > 0 || labels.dia.length > 0 || labels.pulse.length > 0) {
      const findClosestNumber = (label) => {
        if (!label) return null;
        let closest = null;
        let minDist = Infinity;
        numbers.forEach(num => {
          const dy = Math.abs(num.cy - label.cy);
          const dx = num.cx - label.cx;
          
          if (dy < 60 && dx > -20) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              closest = num.value;
            }
          }
        });
        return closest;
      };

      if (labels.sys.length > 0) result.SYS = findClosestNumber(labels.sys[0]);
      if (labels.dia.length > 0) result.DIA = findClosestNumber(labels.dia[0]);
      if (labels.pulse.length > 0) result.PULSE = findClosestNumber(labels.pulse[0]);
    }

    // Heuristic 2: Line-by-line regex extraction (top-to-bottom sequence of numbers)
    if (!result.SYS || !result.DIA || !result.PULSE) {
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const lineNumbers = [];
      lines.forEach(line => {
        const matches = line.match(/\b\d{2,3}\b/g) || line.match(/\d{2,3}/g);
        if (matches) {
          matches.forEach(numStr => {
            const val = parseInt(numStr, 10);
            // Plausible range filter
            if (val >= 35 && val <= 250) {
              lineNumbers.push(val);
            }
          });
        }
      });

      if (lineNumbers.length >= 3) {
        if (!result.SYS) result.SYS = lineNumbers[0];
        if (!result.DIA) result.DIA = lineNumbers[1];
        if (!result.PULSE) result.PULSE = lineNumbers[2];
      }
    }

    // Heuristic 3: Vertical coordinate sort of all found 2-3 digit numbers
    if (!result.SYS || !result.DIA || !result.PULSE) {
      const candidateNums = numbers.filter(n => {
        const val = n.value;
        return val >= 35 && val <= 250;
      });

      // Sort vertically from top to bottom
      candidateNums.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      if (candidateNums.length >= 3) {
        if (!result.SYS) result.SYS = candidateNums[0].value;
        if (!result.DIA) result.DIA = candidateNums[1].value;
        if (!result.PULSE) result.PULSE = candidateNums[2].value;
      } else if (candidateNums.length === 2) {
        if (!result.SYS) result.SYS = candidateNums[0].value;
        if (!result.DIA) result.DIA = candidateNums[1].value;
      }
    }

    // Final Validation: Ensure reasonable medical ranges
    if (result.SYS && (result.SYS < 40 || result.SYS > 260)) result.SYS = null;
    if (result.DIA && (result.DIA < 30 || result.DIA > 180)) result.DIA = null;
    if (result.PULSE && (result.PULSE < 30 || result.PULSE > 220)) result.PULSE = null;

    // Map boxes for rendering debug highlights on screen
    numbers.forEach(n => {
      let type = 'number';
      if (n.value === result.SYS) type = 'sys_val';
      else if (n.value === result.DIA) type = 'dia_val';
      else if (n.value === result.PULSE) type = 'pulse_val';
      result.boxes.push({ text: n.text, bbox: n.bbox, type: type });
    });
    
    labels.sys.forEach(l => result.boxes.push({ text: 'SYS', bbox: l.bbox, type: 'label_sys' }));
    labels.dia.forEach(l => result.boxes.push({ text: 'DIA', bbox: l.bbox, type: 'label_dia' }));
    labels.pulse.forEach(l => result.boxes.push({ text: 'PULSE', bbox: l.bbox, type: 'label_pulse' }));

    return result;
  }
};

window.ocr = ocr;
