import './style.css';
import '@mediapipe/selfie_segmentation';
const SelfieSegmentation = window.SelfieSegmentation;
import liff from '@line/liff';

// Configuration
const CONFIG = {
  LIFF_ID: '1657626423-odDnbGYx', // Placeholder
  WIDTH: 1280,
  HEIGHT: 720,
};

// State
const state = {
  currentFilter: 'filter-none',
  currentBgIndex: 0,
  isLoaded: false,
  segmentation: null,
  canvasCtx: null,
  bgImages: [],
};

// Assets
const FILTERS = [
  { id: 'filter-none', name: '原圖' },
  { id: 'filter-punch', name: '精品' }, // Punch/Contrast
  { id: 'filter-cool', name: '日系' }, // Cool
  { id: 'filter-sakura', name: '櫻花粉' }, // Sakura
  { id: 'filter-dark', name: '暗黑風' }, // Dark
  { id: 'filter-vintage', name: '復古' }, // Vintage
  { id: 'filter-sepia', name: '懷舊' }, // Sepia
  { id: 'filter-warm', name: '暖陽' },
  { id: 'filter-cyber', name: '賽博' },
  { id: 'filter-soft', name: '柔焦' },
  { id: 'filter-fade', name: '褪色' },
  { id: 'filter-grayscale', name: '黑白' },
];

// Placeholder Backgrounds (Colors/Gradients for now, can replace with URLs)
// In a real app, these would be image URLs.
const BACKGROUNDS = [
  { name: 'VIP室', color: '#2c3e50' },
  { name: '海邊', color: '#3498db' },
  { name: '巴黎', color: '#e74c3c' },
  { name: '櫻花道', color: '#fd79a8' },
  { name: '雪山', color: '#dfe6e9' },
  { name: '攝影棚', color: '#636e72' },
  { name: '咖啡廳', color: '#d63031' },
  { name: '街頭', color: '#f1c40f' },
  { name: '夜景', color: '#2d3436' },
  { name: '霓虹', color: '#0984e3' },
];

// DOM Elements
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const loadingElement = document.getElementById('loading');
const filterScroll = document.getElementById('filter-scroll');
const bgScroll = document.getElementById('bg-scroll');
const btnCapture = document.getElementById('btn-capture');
const btnShare = document.getElementById('btn-share');

// Initialize
async function init() {
  try {
    // 1. Setup Canvas
    canvasElement.width = CONFIG.WIDTH;
    canvasElement.height = CONFIG.HEIGHT;
    state.canvasCtx = canvasElement.getContext('2d');

    // 2. Setup Camera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CONFIG.WIDTH },
        height: { ideal: CONFIG.HEIGHT },
        facingMode: 'user',
      },
    });
    videoElement.srcObject = stream;
    await videoElement.play();

    // 3. Setup MediaPipe
    state.segmentation = new SelfieSegmentation({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      },
    });

    state.segmentation.setOptions({
      modelSelection: 1, // 0: General, 1: Landscape (faster?) actually 1 is usually lighter? No, 1 is landscape, 0 is general.
      // Docs: 0 is general, 1 is landscape. Landscape is often better for full body/webcam.
      // Let's stick to 1 for now or 0. 1 is usually higher quality but slower?
      // Actually for mobile, we want speed.
      // Let's try 0 first if 1 is too slow.
      modelSelection: 0, 
      selfieMode: false, // We handle mirroring manually via CSS/Canvas
    });

    state.segmentation.onResults(onResults);

    // Start processing loop
    async function sendToMediaPipe() {
      if (!videoElement.paused && !videoElement.ended) {
        await state.segmentation.send({ image: videoElement });
      }
      requestAnimationFrame(sendToMediaPipe);
    }
    
    // Wait for video to be ready
    videoElement.onloadeddata = () => {
        loadingElement.style.display = 'none';
        sendToMediaPipe();
    };

    // 4. Setup UI
    renderUI();
    
    // 5. Setup LIFF
    initLIFF();

  } catch (error) {
    console.error('Initialization failed:', error);
    alert('Camera access denied or error: ' + error.message);
    loadingElement.style.display = 'none';
  }
}

// MediaPipe Results Handler
function onResults(results) {
  const ctx = state.canvasCtx;
  const width = canvasElement.width;
  const height = canvasElement.height;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Background
  // In real app, drawImage(currentBgImage, ...)
  const bg = BACKGROUNDS[state.currentBgIndex];
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, width, height);
  
  // 2. Draw Segmentation Mask
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(results.segmentationMask, 0, 0, width, height);

  // 3. Draw Person (Original Video)
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(results.image, 0, 0, width, height);

  ctx.restore();
}

// UI Rendering
function renderUI() {
  // Filters
  FILTERS.forEach((filter) => {
    const el = document.createElement('div');
    el.className = `option-item ${filter.id === state.currentFilter ? 'active' : ''}`;
    el.innerHTML = `
      <div style="width:100%;height:100%;background:#555;"></div>
      <span>${filter.name}</span>
    `;
    el.onclick = () => setFilter(filter.id, el);
    filterScroll.appendChild(el);
  });

  // Backgrounds
  BACKGROUNDS.forEach((bg, index) => {
    const el = document.createElement('div');
    el.className = `option-item ${index === state.currentBgIndex ? 'active' : ''}`;
    el.innerHTML = `
      <div style="width:100%;height:100%;background:${bg.color};"></div>
      <span>${bg.name}</span>
    `;
    el.onclick = () => setBackground(index, el);
    bgScroll.appendChild(el);
  });

  // Capture Button
  btnCapture.onclick = takePicture;
  
  // Share Button
  btnShare.onclick = sharePicture;
}

function setFilter(filterId, element) {
  state.currentFilter = filterId;
  canvasElement.className = filterId; // Apply CSS filter to canvas
  
  // Update UI active state
  Array.from(filterScroll.children).forEach(c => c.classList.remove('active'));
  element.classList.add('active');
}

function setBackground(index, element) {
  state.currentBgIndex = index;
  
  // Update UI active state
  Array.from(bgScroll.children).forEach(c => c.classList.remove('active'));
  element.classList.add('active');
}

function takePicture() {
  // Flash effect
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.top = 0;
  flash.style.left = 0;
  flash.style.width = '100%';
  flash.style.height = '100%';
  flash.style.background = 'white';
  flash.style.opacity = 1;
  flash.style.transition = 'opacity 0.5s';
  flash.style.zIndex = 100;
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.style.opacity = 0;
    setTimeout(() => flash.remove(), 500);
  }, 50);

  // Show share button
  btnShare.style.display = 'block';
  btnCapture.style.display = 'none'; // Hide capture to prevent spamming
  
  // In a real app, we might pause the video or show a preview image.
  // For now, we just let the stream continue but show the share button.
}

async function initLIFF() {
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  } catch (err) {
    console.log('LIFF init failed (expected in local dev):', err);
  }
}

async function sharePicture() {
  if (!liff.isInClient()) {
    alert('此功能僅能在 LINE App 中使用。');
    return;
  }

  // NOTE: Sending images requires a public URL. 
  // Since we don't have a backend here, we can't upload the canvas blob.
  // We will simulate the sharing flow.
  
  const canvas = document.getElementById('output-canvas');
  // const dataUrl = canvas.toDataURL('image/png'); // This is base64, too large for some LIFF APIs directly, need upload.

  if (liff.isApiAvailable('shareTargetPicker')) {
    try {
      const res = await liff.shareTargetPicker([
        {
          type: 'flex',
          altText: '來看看我的新照片！',
          contents: {
            type: 'bubble',
            hero: {
              type: 'image',
              url: 'https://via.placeholder.com/1024x1024.png?text=User+Photo', // Placeholder
              size: 'full',
              aspectRatio: '20:13',
              aspectMode: 'cover',
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '我的 LIFF 相機照片',
                  weight: 'bold',
                  size: 'xl'
                }
              ]
            }
          }
        }
      ]);
      if (res) {
        alert('分享成功！');
      }
    } catch (error) {
      console.error('Share failed:', error);
      alert('分享失敗: ' + error.message);
    }
  } else {
    alert('無法使用 ShareTargetPicker。');
  }
  
  // Reset UI
  btnShare.style.display = 'none';
  btnCapture.style.display = 'block';
}

// Start
init();
