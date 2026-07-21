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
      // Formula: contrast_adjusted = (original - 128) * factor + 128
      const factor = 1.5;
      gray = (gray - 128) * factor + 128;
      
      // Simple thresholding (binarization) - adjust threshold value based on average
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

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (progressCallback && m.status === 'recognizing text') {
          progressCallback(Math.round(m.progress * 100));
        }
      }
    });

    try {
      // Configure worker to prioritize reading numbers
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789SYSDIAPULSEpulsePULhrbpmHRBPM',
      });

      const { data: { text, blocks } } = await worker.recognize(imageSrc);
      await worker.terminate();
      
      return this.parseBPValues(text, blocks);
    } catch (e) {
      await worker.terminate();
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
      rawText: rawText
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

    // Heuristic 1: If labels are found, match numbers closest to those labels on the same vertical line
    if (labels.sys.length > 0 || labels.dia.length > 0 || labels.pulse.length > 0) {
      const findClosestNumber = (label) => {
        if (!label) return null;
        let closest = null;
        let minDist = Infinity;
        numbers.forEach(num => {
          // Typically numbers are to the right of or below the label
          const dy = Math.abs(num.cy - label.cy);
          const dx = num.cx - label.cx; // Positive if number is to the right
          
          if (dy < 60 && dx > -20) { // Tolerable height difference
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

    // Heuristic 2: Fallback - if values not found, extract all 2-3 digit numbers and sort them vertically
    // BP monitors always display SYS on top, DIA in middle, PULSE at the bottom.
    if (!result.SYS || !result.DIA || !result.PULSE) {
      // Filter numbers to plausible BP ranges
      const candidateNums = numbers.filter(n => {
        const val = n.value;
        // Plausible range: SYS: 70-220, DIA: 40-150, PULSE: 35-200
        return val >= 35 && val <= 230;
      });

      // Sort candidate numbers vertically from top to bottom
      candidateNums.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // If we have at least 3 candidates
      if (candidateNums.length >= 3) {
        // Find best match matching order: top is SYS (usually largest), middle is DIA, bottom is PULSE
        // Validate sorting order and plausible thresholds
        result.SYS = candidateNums[0].value;
        result.DIA = candidateNums[1].value;
        result.PULSE = candidateNums[2].value;
      } else if (candidateNums.length === 2) {
        // If only 2 numbers found, assume top is SYS and bottom is DIA
        result.SYS = candidateNums[0].value;
        result.DIA = candidateNums[1].value;
      }
    }

    // Heuristic 3: Regex backup on plain text lines
    if (!result.SYS || !result.DIA || !result.PULSE) {
      const lines = rawText.split('\n');
      const allDigits = [];
      lines.forEach(line => {
        const matches = line.match(/\b\d{2,3}\b/g);
        if (matches) {
          matches.forEach(m => allDigits.push(parseInt(m, 10)));
        }
      });
      
      if (allDigits.length >= 3) {
        if (!result.SYS) result.SYS = allDigits[0];
        if (!result.DIA) result.DIA = allDigits[1];
        if (!result.PULSE) result.PULSE = allDigits[2];
      }
    }

    // Clean up values: ensure they are in plausible ranges or nullify
    if (result.SYS && (result.SYS < 50 || result.SYS > 250)) result.SYS = null;
    if (result.DIA && (result.DIA < 30 || result.DIA > 180)) result.DIA = null;
    if (result.PULSE && (result.PULSE < 30 || result.PULSE > 220)) result.PULSE = null;

    return result;
  }
};

window.ocr = ocr;
