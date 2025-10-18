'use client';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';
import { useWindowSize } from '@react-hook/window-size';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const COLOR_CATEGORIES = [
  { slug: 'red', title: 'قرمز و شرابی', color: '#6f3140' },
  { slug: 'brown', title: 'قهوه ای مدرن', color: '#2d2823' },
  { slug: 'natural', title: 'طبیعی', color: '#28282e' },
  { slug: 'quartz', title: 'کوارتز', color: '#281c1e' },
  { slug: 'variation', title: 'واریسیون', color: '#a3a2a8' },
];

const COLOR_PALETTE = [
  { category: 'red', title: 'شرابی تیره', color: '#231121', lightVariant: '#4a2342', darkVariant: '#150a13' },
  { category: 'red', title: 'شرابی', color: '#2c1c27', lightVariant: '#583848', darkVariant: '#1c0e19' },
  { category: 'red', title: 'شرابی روشن', color: '#3c1e3c', lightVariant: '#6e3c6e', darkVariant: '#2a122a' },
  { category: 'red', title: 'قرمز آلبالویی', color: '#6f3140', lightVariant: '#9e4660', darkVariant: '#4a1f2b' },
  { category: 'red', title: 'قرمز آلبالویی روشن', color: '#7c4650', lightVariant: '#b26878', darkVariant: '#562f38' },
  { category: 'red', title: 'قرمز آتشین', color: '#42050b', lightVariant: '#8a0a16', darkVariant: '#2a0307' },
  { category: 'red', title: 'قرمز آتشین روشن', color: '#50141e', lightVariant: '#a0283c', darkVariant: '#350d14' },
  { category: 'brown', title: 'شکلات تلخ', color: '#2d2823', lightVariant: '#5a5046', darkVariant: '#1d1a16' },
  { category: 'brown', title: 'نوتلا', color: '#5a463f', lightVariant: '#8c6e5f', darkVariant: '#3d2f2a' },
  { category: 'brown', title: 'کافه لاته', color: '#a6826f', lightVariant: '#d4b29f', darkVariant: '#7a5e4f' },
  { category: 'brown', title: 'موکا', color: '#463225', lightVariant: '#6e4e3a', darkVariant: '#2e2118' },
  { category: 'brown', title: 'آیس موکا', color: '#b9a07d', lightVariant: '#e5ccad', darkVariant: '#8a7559' },
  { category: 'brown', title: 'هات چاکلت', color: '#321e14', lightVariant: '#643c28', darkVariant: '#21130d' },
  { category: 'brown', title: 'مینک', color: '#644b41', lightVariant: '#967161', darkVariant: '#44322b' },
  { category: 'brown', title: 'شکلات سفید', color: '#debeaa', lightVariant: '#f5e5d5', darkVariant: '#b59e8a' },
  { category: 'natural', title: 'مشکی', color: '#000000', lightVariant: '#2a2a2a', darkVariant: '#000000' },
  { category: 'natural', title: 'قهوه ای تیره', color: '#28282e', lightVariant: '#50505c', darkVariant: '#1a1a1e' },
  { category: 'natural', title: 'قهوه ای خیلی تیره', color: '#0d0a15', lightVariant: '#1a142a', darkVariant: '#05030a' },
  { category: 'natural', title: 'قهوه ای', color: '#463a38', lightVariant: '#6e5e5c', darkVariant: '#2e2624' },
  { category: 'natural', title: 'قهوه ای روشن', color: '#493c3c', lightVariant: '#735e5e', darkVariant: '#312828' },
  { category: 'natural', title: 'بلوند تیره', color: '#4f3b32', lightVariant: '#7a5b4c', darkVariant: '#352721' },
  { category: 'natural', title: 'بلوند', color: '#644632', lightVariant: '#966a4c', darkVariant: '#442f21' },
  { category: 'natural', title: 'بلوند روشن', color: '#7d583b', lightVariant: '#bc8459', darkVariant: '#563c28' },
  { category: 'natural', title: 'بلوند خیلی روشن', color: '#86643a', lightVariant: '#c89658', darkVariant: '#5e4528' },
  { category: 'natural', title: 'بلوند فوق روشن', color: '#d8be91', lightVariant: '#f5e5c9', darkVariant: '#b39e73' },
  { category: 'quartz', title: 'کوارتز دودی', color: '#281c1e', lightVariant: '#50383c', darkVariant: '#1a1214' },
  { category: 'quartz', title: 'کوارتز دودی روشن', color: '#867072', lightVariant: '#b6a0a2', darkVariant: '#5e4e50' },
  { category: 'quartz', title: 'کوارتز دودی خیلی روشن', color: '#b09793', lightVariant: '#d8c7c3', darkVariant: '#886f6b' },
  { category: 'quartz', title: 'کوارتز صورتی', color: '#b68e8e', lightVariant: '#d8b6b6', darkVariant: '#8e6666' },
  { category: 'quartz', title: 'کوارتز صورتی روشن', color: '#c6a0a0', lightVariant: '#e6c8c8', darkVariant: '#9e7878' },
  { category: 'variation', title: 'واریاسیون نقره ای', color: '#a3a2a8', lightVariant: '#d3d2d8', darkVariant: '#73727a' },
  { category: 'variation', title: 'واریاسیون سبز', color: '#3c5055', lightVariant: '#5c7880', darkVariant: '#28383b' },
];

const HIGHLIGHT_COLORS = [
  { color: '#F5F5DC', title: 'پلاتینیوم' },
  { color: '#E6D3A3', title: 'شامپاینی' },
  { color: '#DEB887', title: 'عسلی' },
  { color: '#D2B48C', title: 'کاراملی' },
  { color: '#F0E68C', title: 'طلایی روشن' },
  { color: '#FFEFD5', title: 'کرم' },
  { color: '#FFE4B5', title: 'موکاسین' },
  { color: '#E6E6FA', title: 'لاوندر' }
];

const detectDevice = () => {
  const ua = navigator.userAgent;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return {
    isMobile: isMobileDevice,
    preferCPU: isMobileDevice,
    targetFPS: isMobileDevice ? 15 : 24
  };
};

export default function HairColorChanger() {
  const [width, height] = useWindowSize();
  const deviceConfig = detectDevice();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hairSegmenterRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const smoothMaskBufferRef = useRef<Float32Array | null>(null);
  const highlightCacheRef = useRef<Float32Array | null>(null);
  const lastHighlightSettingsRef = useRef<string>('');

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[7]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightIntensity, setHighlightIntensity] = useState(0.4);
  const [colorIntensity, setColorIntensity] = useState(0.7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [hasShownInstructions, setHasShownInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState<'color' | 'highlights'>('color');
  const [colorCat, setColorCat] = useState<any>(null);

  useEffect(() => {
    highlightCacheRef.current = null;
    lastHighlightSettingsRef.current = '';
  }, [selectedColor, selectedHighlightColor, highlightMode, highlightIntensity, colorIntensity]);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Fast box blur for smooth edges - much faster than Gaussian
  const fastBoxBlur = (data: Float32Array, width: number, height: number, radius: number) => {
    const temp = new Float32Array(data.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            sum += data[y * width + nx];
            count++;
          }
        }
        temp[y * width + x] = sum / count;
      }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            sum += temp[ny * width + x];
            count++;
          }
        }
        data[y * width + x] = sum / count;
      }
    }
  };

  // Super fast mask smoothing
  const createFastSmoothMask = (maskData: Uint8Array, width: number, height: number) => {
    if (!smoothMaskBufferRef.current || smoothMaskBufferRef.current.length !== width * height) {
      smoothMaskBufferRef.current = new Float32Array(width * height);
    }
    const smoothMask = smoothMaskBufferRef.current;

    // Initialize
    for (let i = 0; i < maskData.length; i++) {
      smoothMask[i] = maskData[i] > 0 ? 1 : 0;
    }

    // Single box blur pass - much faster
    const blurRadius = deviceConfig.isMobile ? 2 : 3;
    fastBoxBlur(smoothMask, width, height, blurRadius);

    // Simple edge feathering
    for (let i = 0; i < smoothMask.length; i++) {
      if (smoothMask[i] > 0 && smoothMask[i] < 1) {
        const t = smoothMask[i];
        smoothMask[i] = t * t * (3 - 2 * t); // Smoothstep
      }
    }

    return smoothMask;
  };

  // Simplified highlight generation
  const generateFastHighlights = (
    width: number,
    height: number,
    smoothMask: Float32Array,
    imageData: ImageData
  ) => {
    if (!highlightMode) {
      return new Float32Array(width * height);
    }

    const settingsHash = `${highlightIntensity}-${selectedHighlightColor.color}`;
    if (settingsHash === lastHighlightSettingsRef.current && highlightCacheRef.current) {
      return highlightCacheRef.current;
    }
    lastHighlightSettingsRef.current = settingsHash;

    const highlightMask = new Float32Array(width * height);

    // Fast strand-based highlights
    for (let y = 0; y < height; y += 2) { // Process every 2nd row
      const yFactor = Math.sin((y / height) * Math.PI); // Top to bottom fade

      for (let x = 0; x < width; x += 2) { // Process every 2nd column
        const idx = y * width + x;
        const maskValue = smoothMask[idx];

        if (maskValue > 0.2) {
          // Simple strand pattern
          const strandPattern = Math.sin((x / width) * Math.PI * 6) > 0.5 ? 1 : 0;

          if (strandPattern) {
            const pixelIdx = idx * 4;
            const brightness = (imageData.data[pixelIdx] * 0.299 +
              imageData.data[pixelIdx + 1] * 0.587 +
              imageData.data[pixelIdx + 2] * 0.114) / 255;

            highlightMask[idx] = maskValue * yFactor * brightness * highlightIntensity;

            // Fill neighboring pixels
            if (x + 1 < width) highlightMask[idx + 1] = highlightMask[idx];
            if (y + 1 < height) highlightMask[(y + 1) * width + x] = highlightMask[idx];
            if (x + 1 < width && y + 1 < height) highlightMask[(y + 1) * width + x + 1] = highlightMask[idx];
          }
        }
      }
    }

    highlightCacheRef.current = highlightMask;
    return highlightMask;
  };

  // IMPROVED: Better color application with brightness adjustment for high contrast
  const applyFastHairColor = useCallback((ctx: CanvasRenderingContext2D, mask: any) => {
    try {
      const { width, height } = ctx.canvas;
      const maskData = mask.getAsUint8Array();
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const baseColor = hexToRgb(selectedColor.color);
      const lightVariant = hexToRgb(selectedColor.lightVariant);
      const darkVariant = hexToRgb(selectedColor.darkVariant);
      const highlightColor = hexToRgb(selectedHighlightColor.color);

      // Calculate target brightness
      const targetBrightness = (baseColor.r * 0.299 + baseColor.g * 0.587 + baseColor.b * 0.114) / 255;
      const isLightColor = targetBrightness > 0.5;

      const smoothMask = createFastSmoothMask(maskData, width, height);
      const highlightMask = generateFastHighlights(width, height, smoothMask, imageData);

      // Fast pixel processing
      for (let i = 0; i < width * height; i++) {
        const maskValue = smoothMask[i];
        if (maskValue < 0.05) continue;

        const highlightValue = highlightMask[i];
        const pixelIdx = i * 4;

        const originalR = data[pixelIdx];
        const originalG = data[pixelIdx + 1];
        const originalB = data[pixelIdx + 2];

        // Calculate original brightness
        const originalBrightness = (originalR * 0.299 + originalG * 0.587 + originalB * 0.114) / 255;

        let targetR, targetG, targetB;

        if (highlightValue > 0.15) {
          // Apply highlight
          targetR = highlightColor.r;
          targetG = highlightColor.g;
          targetB = highlightColor.b;
        } else {
          // Choose variant based on brightness
          let selectedVariant;
          if (originalBrightness < 0.3) {
            selectedVariant = darkVariant;
          } else if (originalBrightness > 0.7) {
            selectedVariant = lightVariant;
          } else {
            selectedVariant = baseColor;
          }

          // IMPROVED: Boost brightness for light colors on dark hair
          if (isLightColor && originalBrightness < 0.4) {
            // Calculate brightness boost
            const boostFactor = 1.0 + (targetBrightness - originalBrightness) * 1.5;

            targetR = Math.min(255, selectedVariant.r * boostFactor);
            targetG = Math.min(255, selectedVariant.g * boostFactor);
            targetB = Math.min(255, selectedVariant.b * boostFactor);
          } else {
            targetR = selectedVariant.r;
            targetG = selectedVariant.g;
            targetB = selectedVariant.b;
          }

          // Preserve some original color for natural look
          const preservationFactor = 0.15;
          targetR = targetR * (1 - preservationFactor) + originalR * preservationFactor;
          targetG = targetG * (1 - preservationFactor) + originalG * preservationFactor;
          targetB = targetB * (1 - preservationFactor) + originalB * preservationFactor;
        }

        // Calculate blend intensity
        const effectiveIntensity = highlightValue > 0.15
          ? highlightValue * 0.8
          : maskValue * colorIntensity;

        // Final blend with improved formula for light colors
        let blendIntensity = effectiveIntensity;
        if (isLightColor && originalBrightness < 0.4) {
          // Stronger application for light colors on dark hair
          blendIntensity = Math.min(1, effectiveIntensity * 1.3);
        }

        data[pixelIdx] = targetR * blendIntensity + originalR * (1 - blendIntensity);
        data[pixelIdx + 1] = targetG * blendIntensity + originalG * (1 - blendIntensity);
        data[pixelIdx + 2] = targetB * blendIntensity + originalB * (1 - blendIntensity);
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error applying hair color:', error);
    }
  }, [selectedColor, selectedHighlightColor, highlightMode, highlightIntensity, colorIntensity, deviceConfig]);

  const processFrame = useCallback(async () => {
    if (!isCameraOn || !hairSegmenterRef.current || isProcessing) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = Date.now();
    const targetFrameTime = 1000 / deviceConfig.targetFPS;

    if (now - lastProcessTimeRef.current < targetFrameTime) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    setIsProcessing(true);
    lastProcessTimeRef.current = now;

    try {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const segmentationResult = await hairSegmenterRef.current.segmentForVideo(video, now);

        if (segmentationResult.categoryMask) {
          applyFastHairColor(ctx, segmentationResult.categoryMask);
        }
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    } finally {
      setIsProcessing(false);
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isCameraOn, isProcessing, applyFastHairColor, deviceConfig]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAndStart = async () => {
      try {
        // Suppress MediaPipe console warnings
        const originalConsoleLog = console.log;
        console.log = (...args) => {
          const message = args.join(' ');
          if (!message.includes('SOFTMAX') && !message.includes('segmentation_postprocessor')) {
            originalConsoleLog.apply(console, args);
          }
        };

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm'
        );

        const options: ImageSegmenterOptions = {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite',
            delegate: deviceConfig.preferCPU ? 'CPU' : 'GPU'
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        };

        hairSegmenterRef.current = await ImageSegmenter.createFromOptions(vision, options);
        setIsLoading(false);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: deviceConfig.isMobile ? 640 : 960 },
            height: { ideal: deviceConfig.isMobile ? 480 : 720 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            videoRef.current!.onloadedmetadata = resolve;
          });
          videoRef.current.play();
          setIsCameraOn(true);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('خطا در راه‌اندازی. لطفاً صفحه را بازخوانی کنید.');
      }
    };

    initializeAndStart();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [deviceConfig]);

  useEffect(() => {
    if (isCameraOn) {
      const timer = setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }, 500);

      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [isCameraOn, processFrame]);

  const ColorSwatch = ({ colorObj, onClick, isSelected }: any) => (
    <div className="flex flex-col gap-2 items-center min-w-16">
      <motion.div
        whileHover={{ scale: 1.1, y: -3 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full cursor-pointer shadow-lg transition-all duration-200 ${
          isSelected ? 'ring-4 ring-purple-400 scale-110' : 'ring-2 ring-gray-600 hover:ring-purple-300'
        }`}
        style={{ backgroundColor: colorObj.color }}
        title={colorObj.title}
      />
      <span className="text-center text-white text-xs">{colorObj.title}</span>
    </div>
  );

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800 overflow-hidden">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-16 h-16 border-4 border-t-transparent border-purple-500 rounded-full mb-4"
            />
            <p className="text-white text-lg">در حال بارگزاری...</p>
            <p className="text-gray-400 text-sm mt-2">
              {deviceConfig.preferCPU ? 'حالت CPU (موبایل)' : 'حالت GPU (دسکتاپ)'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 mx-auto max-w-md bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-40 text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full max-w-7xl py-4 z-10 px-4">
        <h1 className={`font-sans text-center text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent ${
          isMobile ? 'text-xl' : isTablet ? 'text-3xl' : 'text-4xl'
        }`}>
          رنگ مو مجازی با هوش مصنوعی
        </h1>
      </header>

      <div className="flex flex-col items-center justify-center w-full flex-1">
        <div className={`relative ${
          isMobile ? 'w-full aspect-[9/16]' : isTablet ? 'w-10/12 aspect-[3/4]' : 'w-8/12 aspect-video'
        } rounded-xl overflow-hidden bg-gray-800 shadow-2xl border border-purple-500/30`}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-20"
                onClick={() => {
                  setShowInstructions(false);
                  if (!hasShownInstructions) {
                    setHasShownInstructions(true);
                    setTimeout(() => setShowColorPalette(true), 500);
                  }
                }}
              >
                <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-purple-500/50 rounded-xl p-6 max-w-md text-center">
                  <h3 className="text-white text-xl mb-4">نحوه استفاده</h3>
                  <ul className="space-y-3 text-sm mb-6 text-gray-200 text-right">
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">۱.</span>
                      <span>اجازه دسترسی به دوربین را بدهید</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">۲.</span>
                      <span>رنگ پایه یا هایلایت انتخاب کنید</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">۳.</span>
                      <span>شدت رنگ را تنظیم کنید</span>
                    </li>
                    <li className="flex items-center gap-3 text-green-400">
                      <span>✓</span>
                      <span>بهبود کنتراست برای موهای تیره</span>
                    </li>
                    <li className="flex items-center gap-3 text-rose-400">
                      <span>تصویر شما ذخیره نمی‌شود</span>
                    </li>
                  </ul>
                  <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-medium">
                    شروع
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isDesktop && showColorPalette && (
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="fixed right-4 top-1/2 transform -translate-y-1/2 w-96 bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-purple-500/30 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('color')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'color' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                رنگ پایه
              </button>
              <button
                onClick={() => setActiveTab('highlights')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'highlights' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                هایلایت
              </button>
            </div>

            {activeTab === 'color' && (
              <>
                {!colorCat ? (
                  <div>
                    <h3 className="text-white text-lg mb-4 text-center">دسته‌بندی رنگ‌ها</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {COLOR_CATEGORIES.map((cat) => (
                        <div key={cat.slug} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setColorCat(cat)}>
                          <div className="w-16 h-16 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-white text-xs text-center">{cat.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button onClick={() => setColorCat(null)} className="text-purple-400 mb-4">« بازگشت</button>
                    <div className="grid grid-cols-3 gap-4">
                      {COLOR_PALETTE.filter(c => c.category === colorCat.slug).map((colorObj, idx) => (
                        <ColorSwatch
                          key={idx}
                          colorObj={colorObj}
                          onClick={() => setSelectedColor(colorObj)}
                          isSelected={selectedColor.color === colorObj.color}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-white text-sm mb-2 block text-right">شدت رنگ: {Math.round(colorIntensity * 100)}%</label>
                    <input
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.05"
                      value={colorIntensity}
                      onChange={(e) => setColorIntensity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'highlights' && (
              <div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="text-gray-300 text-sm">غیرفعال</span>
                  <button
                    onClick={() => setHighlightMode(!highlightMode)}
                    className={`relative w-12 h-6 rounded-full transition ${highlightMode ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                      animate={{ x: highlightMode ? 24 : 2 }}
                    />
                  </button>
                  <span className="text-gray-300 text-sm">فعال</span>
                </div>

                {highlightMode && (
                  <>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {HIGHLIGHT_COLORS.map((color, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedHighlightColor(color)}
                            className={`w-12 h-12 rounded-full cursor-pointer ${
                              selectedHighlightColor.color === color.color ? 'ring-4 ring-yellow-400' : 'ring-2 ring-gray-600'
                            }`}
                            style={{ backgroundColor: color.color }}
                          />
                          <span className="text-white text-xs text-center">{color.title}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-white text-sm mb-2 block text-right">شدت هایلایت: {Math.round(highlightIntensity * 100)}%</label>
                      <input
                        type="range"
                        min="0.2"
                        max="0.8"
                        step="0.05"
                        value={highlightIntensity}
                        onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {!isDesktop && !showColorPalette && (
        <button
          onClick={() => setShowColorPalette(true)}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-xl"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
          </svg>
        </button>
      )}

      <AnimatePresence>
        {!isDesktop && showColorPalette && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-gray-800/98 to-gray-900/98 backdrop-blur-md rounded-t-2xl shadow-2xl z-30 max-h-[70vh] overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-1 bg-gray-400 rounded-full" />
              </div>

              <button
                onClick={() => setShowColorPalette(false)}
                className="absolute left-4 top-4 bg-orange-500 w-8 h-8 flex items-center justify-center rounded-full text-white"
              >
                ✕
              </button>

              <div className="flex gap-2 mb-4 mt-4">
                <button
                  onClick={() => setActiveTab('color')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                    activeTab === 'color' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  رنگ پایه
                </button>
                <button
                  onClick={() => setActiveTab('highlights')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                    activeTab === 'highlights' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  هایلایت
                </button>
              </div>

              {activeTab === 'color' && (
                <>
                  {!colorCat ? (
                    <div className="grid grid-cols-3 gap-3">
                      {COLOR_CATEGORIES.map((cat) => (
                        <div key={cat.slug} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setColorCat(cat)}>
                          <div className="w-16 h-16 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-white text-xs text-center">{cat.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setColorCat(null)} className="text-purple-400 mb-3">« بازگشت</button>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {COLOR_PALETTE.filter(c => c.category === colorCat.slug).map((colorObj, idx) => (
                          <ColorSwatch
                            key={idx}
                            colorObj={colorObj}
                            onClick={() => setSelectedColor(colorObj)}
                            isSelected={selectedColor.color === colorObj.color}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  <div className="space-y-3 mt-4">
                    <div>
                      <label className="text-white text-sm mb-2 block text-right">شدت رنگ: {Math.round(colorIntensity * 100)}%</label>
                      <input
                        type="range"
                        min="0.3"
                        max="1"
                        step="0.05"
                        value={colorIntensity}
                        onChange={(e) => setColorIntensity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'highlights' && (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-gray-300 text-sm">غیرفعال</span>
                    <button
                      onClick={() => setHighlightMode(!highlightMode)}
                      className={`relative w-12 h-6 rounded-full transition ${highlightMode ? 'bg-purple-600' : 'bg-gray-600'}`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                        animate={{ x: highlightMode ? 24 : 2 }}
                      />
                    </button>
                    <span className="text-gray-300 text-sm">فعال</span>
                  </div>

                  {highlightMode && (
                    <>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {HIGHLIGHT_COLORS.map((color, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedHighlightColor(color)}
                              className={`w-10 h-10 rounded-full cursor-pointer ${
                                selectedHighlightColor.color === color.color ? 'ring-3 ring-yellow-400' : 'ring-2 ring-gray-600'
                              }`}
                              style={{ backgroundColor: color.color }}
                            />
                            <span className="text-white text-xs text-center">{color.title}</span>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-white text-sm mb-2 block text-right">شدت هایلایت: {Math.round(highlightIntensity * 100)}%</label>
                        <input
                          type="range"
                          min="0.2"
                          max="0.8"
                          step="0.05"
                          value={highlightIntensity}
                          onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-6 text-gray-400 text-sm text-center pb-4">
        <p>تصویر و ویدیو شما به هیچ عنوان ذخیره نمی‌شود</p>
        <p className="text-xs mt-1 text-purple-400">
          {deviceConfig.preferCPU ? '⚡ بهینه موبایل' : '🚀 بهینه دسکتاپ'}
        </p>
      </footer>
    </div>
  );
}