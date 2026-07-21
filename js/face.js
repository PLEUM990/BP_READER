/**
 * face.js - Client-side facial capture and matching.
 * Uses a lightweight, high-performance image hashing algorithm (dHash / Difference Hash)
 * combined with average color histogram comparison to match faces without downloading heavy model weights.
 */

const face = {
  // Crop the face area using the predefined ellipse boundary from the video stream
  cropFaceFromVideo: function(videoElement, canvasElement) {
    const ctx = canvasElement.getContext('2d');
    const vw = videoElement.videoWidth || 640;
    const vh = videoElement.videoHeight || 480;
    
    // Create a square crop centered around the face frame region (approx. middle 60%)
    const size = Math.min(vw, vh) * 0.6;
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    
    canvasElement.width = 200;
    canvasElement.height = 200;
    
    // Draw mirrored crop
    ctx.save();
    ctx.translate(200, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, sx, sy, size, size, 0, 0, 200, 200);
    ctx.restore();
    
    return canvasElement.toDataURL('image/jpeg', 0.9);
  },

  // Calculate dHash (Difference Hash) of a cropped face image (grayscaled, 9x8 downscaled)
  calculateDHash: async function(imageDataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // We need 9x8 to perform row difference comparison (8 differences per row)
        canvas.width = 9;
        canvas.height = 8;
        
        ctx.drawImage(img, 0, 0, 9, 8);
        const imgData = ctx.getImageData(0, 0, 9, 8);
        const data = imgData.data;
        
        // Grayscale conversion
        const grays = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          grays.push(0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        // Compute differences
        let hash = "";
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const leftIdx = row * 9 + col;
            const rightIdx = leftIdx + 1;
            hash += grays[leftIdx] > grays[rightIdx] ? "1" : "0";
          }
        }
        
        // Convert binary string to hexadecimal hash
        let hexHash = "";
        for (let i = 0; i < hash.length; i += 4) {
          const nibble = hash.substring(i, i + 4);
          hexHash += parseInt(nibble, 2).toString(16);
        }
        
        resolve(hexHash);
      };
      img.src = imageDataUrl;
    });
  },

  // Calculate average color channels (RGB) to add color-profile verification
  calculateColorProfile: async function(imageDataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(img, 0, 0, 16, 16);
        
        const imgData = ctx.getImageData(0, 0, 16, 16);
        const data = imgData.data;
        
        let sumR = 0, sumG = 0, sumB = 0;
        const totalPixels = 16 * 16;
        
        for (let i = 0; i < data.length; i += 4) {
          sumR += data[i];
          sumG += data[i+1];
          sumB += data[i+2];
        }
        
        resolve({
          r: Math.round(sumR / totalPixels),
          g: Math.round(sumG / totalPixels),
          b: Math.round(sumB / totalPixels)
        });
      };
      img.src = imageDataUrl;
    });
  },

  // Calculate Hamming Distance between two hex strings (number of differing bits)
  calculateHammingDistance: function(hash1, hash2) {
    if (hash1.length !== hash2.length) return 999;
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      const val1 = parseInt(hash1[i], 16);
      const val2 = parseInt(hash2[i], 16);
      // XOR the two values and count set bits
      let xorVal = val1 ^ val2;
      while (xorVal > 0) {
        if (xorVal & 1) distance++;
        xorVal >>= 1;
      }
    }
    return distance;
  },

  // Identify a user by matching their current camera frame against registered users in the database
  identifyUser: async function(cameraFrameDataUrl, registeredUsers, threshold = 18) {
    if (!registeredUsers || registeredUsers.length === 0) return null;
    
    // Crop & downscale current frame
    const currentHash = await this.calculateDHash(cameraFrameDataUrl);
    const currentColor = await this.calculateColorProfile(cameraFrameDataUrl);
    
    let bestMatchUser = null;
    let minDistance = Infinity;
    
    for (const user of registeredUsers) {
      if (!user.face_images || user.face_images.length === 0) continue;
      
      // Calculate distances for each registered pose image (Front, Left, Right)
      for (const regFace of user.face_images) {
        // If stored image is old format (just dataUrl string), recalculate hash
        const regHash = regFace.hash || await this.calculateDHash(regFace.dataUrl);
        const distance = this.calculateHammingDistance(currentHash, regHash);
        
        // Color variance check (filters extreme lighting differences/false positives)
        const regColor = regFace.color || await this.calculateColorProfile(regFace.dataUrl);
        const colorDiff = Math.abs(currentColor.r - regColor.r) + 
                          Math.abs(currentColor.g - regColor.g) + 
                          Math.abs(currentColor.b - regColor.b);
                          
        // Combine hamming distance and color profile match (adjust weight)
        if (distance < minDistance && distance <= threshold && colorDiff < 140) {
          minDistance = distance;
          bestMatchUser = user;
        }
      }
    }
    
    if (bestMatchUser) {
      console.log(`Matched face: ${bestMatchUser.full_name} with hamming distance ${minDistance}`);
      return {
        user: bestMatchUser,
        distance: minDistance
      };
    }
    
    return null;
  }
};

window.face = face;
