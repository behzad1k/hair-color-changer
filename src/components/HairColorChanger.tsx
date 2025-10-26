'use client';
import { COLOR_CATEGORIES, COLOR_PALETTE, HIGHLIGHT_COLORS } from '@/utils/constants';
import dih, { language } from '@/lang/dictionary';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';
import { useWindowSize } from '@react-hook/window-size';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function HairColorChanger() {
  const [width, height] = useWindowSize();
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
  const lastMaskHashRef = useRef<number>(0);
  const cachedHsvRef = useRef<{base: any, highlight: any} | null>(null);
  const lastColorSettingsRef = useRef<string>('');

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
    cachedHsvRef.current = null;
    lastColorSettingsRef.current = '';
  }, [selectedColor, selectedHighlightColor, highlightMode, highlightIntensity, colorIntensity]);

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    let h = 0;

    if (d !== 0) {
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return { h, s, v };
  };

  const hsvToRgb = (h: number, s: number, v: number) => {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const hashMask = (maskData: Uint8Array, sampleRate: number = 200): number => {
    let hash = 0;
    for (let i = 0; i < maskData.length; i += sampleRate) {
      hash = ((hash << 5) - hash) + maskData[i];
      hash = hash & hash;
    }
    return hash;
  };

  const createOptimizedMask = (maskData: Uint8Array, width: number, height: number) => {
    const currentHash = hashMask(maskData);
    if (currentHash === lastMaskHashRef.current && smoothMaskBufferRef.current) {
      return smoothMaskBufferRef.current;
    }
    lastMaskHashRef.current = currentHash;

    if (!smoothMaskBufferRef.current || smoothMaskBufferRef.current.length !== width * height) {
      smoothMaskBufferRef.current = new Float32Array(width * height);
    }
    const smoothMask = smoothMaskBufferRef.current;

    for (let i = 0; i < maskData.length; i++) {
      smoothMask[i] = maskData[i] > 0 ? 1 : 0;
    }

    const tempMask = new Float32Array(smoothMask);
    const radius = 4;
    const sigma = 2.2;
    const sigma2 = 2 * sigma * sigma;

    for (let y = radius; y < height - radius; y += 1) {
      for (let x = radius; x < width - radius; x += 1) {
        const idx = y * width + x;
        if (tempMask[idx] > 0 ||
          tempMask[(y - 1) * width + x] > 0 ||
          tempMask[(y + 1) * width + x] > 0 ||
          tempMask[y * width + (x - 1)] > 0 ||
          tempMask[y * width + (x + 1)] > 0) {

          let sum = 0, weightSum = 0;
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const dist2 = dx * dx + dy * dy;
              if (dist2 <= radius * radius) {
                const weight = Math.exp(-dist2 / sigma2);
                sum += tempMask[(y + dy) * width + (x + dx)] * weight;
                weightSum += weight;
              }
            }
          }
          smoothMask[idx] = sum / weightSum;
        }
      }
    }

    for (let i = 0; i < smoothMask.length; i++) {
      if (smoothMask[i] > 0 && smoothMask[i] < 1) {
        const t = smoothMask[i];
        smoothMask[i] = t * t * (3 - 2 * t);
      }
    }

    return smoothMask;
  };

  const generateOptimizedHighlights = (
    width: number,
    height: number,
    smoothMask: Float32Array,
    imageData: ImageData
  ) => {
    if (!highlightMode) {
      return new Float32Array(width * height);
    }

    const settingsHash = `${highlightMode}-${highlightIntensity}-${selectedHighlightColor.color}-${width}x${height}`;
    if (settingsHash === lastHighlightSettingsRef.current && highlightCacheRef.current) {
      return highlightCacheRef.current;
    }
    lastHighlightSettingsRef.current = settingsHash;

    const highlightMask = new Float32Array(width * height);

    let topY = height, bottomY = 0, leftX = width, rightX = 0;
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const idx = y * width + x;
        if (smoothMask[idx] > 0.3) {
          topY = Math.min(topY, y);
          bottomY = Math.max(bottomY, y);
          leftX = Math.min(leftX, x);
          rightX = Math.max(rightX, x);
        }
      }
    }

    const hairHeight = bottomY - topY;
    const hairWidth = rightX - leftX;
    if (hairHeight <= 0 || hairWidth <= 0) return highlightMask;

    const numStrands = 8;
    const strandWidth = hairWidth / numStrands;
    const activeStrands = [1, 3, 5, 7];

    const brightnessMap = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const pixelIdx = i * 4;
      brightnessMap[i] = (
        imageData.data[pixelIdx] * 0.299 +
        imageData.data[pixelIdx + 1] * 0.587 +
        imageData.data[pixelIdx + 2] * 0.114
      ) / 255;
    }

    for (let y = topY; y <= bottomY; y++) {
      const verticalPos = (y - topY) / hairHeight;
      const verticalGradient = verticalPos * verticalPos;

      for (let x = leftX; x <= rightX; x++) {
        const idx = y * width + x;
        const maskValue = smoothMask[idx];

        if (maskValue > 0.15) {
          const relativeX = x - leftX;
          const strandIdx = Math.floor(relativeX / strandWidth);

          if (activeStrands.includes(strandIdx)) {
            const posInStrand = (relativeX % strandWidth) / strandWidth;
            const strandGradient = Math.sin(posInStrand * Math.PI);
            const brightness = brightnessMap[idx];

            const highlightStrength =
              maskValue *
              strandGradient *
              brightness *
              verticalGradient *
              highlightIntensity;

            highlightMask[idx] = Math.min(1, highlightStrength);
          }
        }
      }
    }

    highlightCacheRef.current = highlightMask;
    return highlightMask;
  };
  const applyOptimizedHairColor = useCallback((ctx: CanvasRenderingContext2D, mask: any) => {
    let maskData: Uint8Array | null = null;

    try {
      const { width, height } = ctx.canvas;

      if (mask instanceof Uint8Array) {
        maskData = mask;
      } else if (mask && typeof mask.getAsUint8Array === 'function') {
        maskData = mask.getAsUint8Array();
      } else {
        console.warn('Invalid mask format');
        return;
      }

      if (!maskData) return

      let hairPixelCount = 0;
      for (let i = 0; i < maskData.length; i += 10) {
        if (maskData[i] > 0) hairPixelCount++;
      }

      if (hairPixelCount === 0) {
        return;
      }

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const colorSettingsHash = `${selectedColor.color}-${selectedHighlightColor.color}`;
      if (colorSettingsHash !== lastColorSettingsRef.current || !cachedHsvRef.current) {
        const baseColor = hexToRgb(selectedColor.color);
        const highlightColor = hexToRgb(selectedHighlightColor.color);
        cachedHsvRef.current = {
          base: rgbToHsv(baseColor.r, baseColor.g, baseColor.b),
          highlight: rgbToHsv(highlightColor.r, highlightColor.g, highlightColor.b)
        };
        lastColorSettingsRef.current = colorSettingsHash;
      }

      const baseHsv = cachedHsvRef.current.base;
      const highlightHsv = cachedHsvRef.current.highlight;

      const smoothMask = createOptimizedMask(maskData, width, height);
      const highlightMask = generateOptimizedHighlights(width, height, smoothMask, imageData);

      const brightnessLiftFactor = colorIntensity * 0.7;

      for (let i = 0; i < width * height; i++) {
        const maskValue = smoothMask[i];
        if (maskValue < 0.02) continue;

        const highlightValue = highlightMask[i];
        const pixelIdx = i * 4;

        const originalR = data[pixelIdx];
        const originalG = data[pixelIdx + 1];
        const originalB = data[pixelIdx + 2];

        const originalHsv = rgbToHsv(originalR, originalG, originalB);
        const brightness = originalHsv.v;

        const targetHsv = highlightValue > 0.15 ? highlightHsv : baseHsv;
        const targetBrightness = targetHsv.v;

        const brightnessDiff = targetBrightness - brightness;
        const newBrightness = brightness + (brightnessDiff * brightnessLiftFactor);

        const isLightColorOnDarkHair = targetBrightness > 0.6 && brightness < 0.4;
        const boostedBrightness = isLightColorOnDarkHair
          ? Math.max(newBrightness, targetBrightness * 0.75)
          : newBrightness;

        const newHsv = {
          h: targetHsv.h,
          s: Math.min(1, targetHsv.s * 0.85 + originalHsv.s * 0.15),
          v: Math.max(0, Math.min(1, boostedBrightness))
        };

        const newColor = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);

        const effectiveIntensity = highlightValue > 0.15
          ? highlightValue
          : maskValue * colorIntensity;

        // Enhanced preservation for thin strays and edges
        const edgeFactor = maskValue < 0.3 ? Math.pow(maskValue / 0.3, 0.5) : 1;
        const strayPreservation = Math.max(0.6, 1 - (brightness * 0.2));
        const finalIntensity = effectiveIntensity * strayPreservation * edgeFactor;

        // Adaptive blending that preserves hair texture
        const blendR = newColor.r * finalIntensity + originalR * (1 - finalIntensity);
        const blendG = newColor.g * finalIntensity + originalG * (1 - finalIntensity);
        const blendB = newColor.b * finalIntensity + originalB * (1 - finalIntensity);

        // Add back some original texture to prevent washout
        const textureFactor = 0.15;
        const textureR = (blendR - originalR) * textureFactor;
        const textureG = (blendG - originalG) * textureFactor;
        const textureB = (blendB - originalB) * textureFactor;

        data[pixelIdx] = Math.max(0, Math.min(255, blendR - textureR));
        data[pixelIdx + 1] = Math.max(0, Math.min(255, blendG - textureG));
        data[pixelIdx + 2] = Math.max(0, Math.min(255, blendB - textureB));
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error applying hair color:', error);
    } finally {
      if (mask && typeof mask.close === 'function') {
        mask.close();
      }
    }
  }, [selectedColor, selectedHighlightColor, highlightMode, highlightIntensity, colorIntensity]);

  const processFrame = useCallback(async () => {
    if (!isCameraOn || !hairSegmenterRef.current || isProcessing) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = Date.now();
    const targetFrameTime = isMobileDevice() ? 150 : 80;
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
        const maskData = segmentationResult.categoryMask;
        applyOptimizedHairColor(ctx, maskData);
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    } finally {
      setIsProcessing(false);
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isCameraOn, isProcessing, applyOptimizedHairColor]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAndStart = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm'
        );

        const isMobileEnv = isMobileDevice();

        const options: ImageSegmenterOptions = {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        };

        const segmenter = await ImageSegmenter.createFromOptions(vision, options);
        hairSegmenterRef.current = segmenter;

        setIsLoading(false);

        const constraints = isMobileEnv ? {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20 }
          },
          audio: false
        } : {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
      if (hairSegmenterRef.current && typeof hairSegmenterRef.current.close === 'function') {
        hairSegmenterRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

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
            <p className="text-white text-lg">{dih.loading}</p>
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

      <header className="w-full max-w-7xl p-4 z-10">
        <h1 className={`text-center text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text ${
          isMobile ? 'text-xl' : isTablet ? 'text-3xl' : 'text-4xl'
        }`}>
          {dih.title}
        </h1>
      </header>

      <div className="flex flex-col items-center justify-center w-full flex-1">
        <div className={`relative ${
          isMobile ? 'w-full aspect-[9/16] flex-1 h-full' : isTablet ? 'w-10/12 aspect-[3/4]' : 'w-8/12 aspect-video'
        } rounded-xl overflow-hidden bg-gray-800 shadow-2xl border border-purple-500/30`}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted/>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover"/>

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
                  <h3 className="text-white text-xl mb-4">{dih.howToUse}</h3>
                  <ul className="space-y-3 text-sm mb-6 text-gray-200 text-right">
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">1.</span>
                      <span>{dih.allowCamera}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">2.</span>
                      <span>{dih.pickColorOrHighlight}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-purple-400">3.</span>
                      <span>{dih.selectColorIntensity}</span>
                    </li>
                    <li className="flex items-center gap-3 text-rose-400">
                      <span>{dih.yourPicWontBeSaved}</span>
                    </li>
                  </ul>
                  <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-medium">
                    {dih.start}
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
            className="fixed right-4 top-1/2 transform -translate-y-1/2 w-96 bg-gradient-to-br from-transparent to-gray-900/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-purple-500/30 max-h-[90vh] overflow-y-auto"
          >
            {activeTab === 'color' && (
              <>
                {!colorCat ? (
                  <div>
                    <h3 className="text-white text-lg mb-4 text-center">{dih.colorCategories}</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {COLOR_CATEGORIES.map((cat) => (
                        <div key={cat.slug} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setColorCat(cat)}>
                          <div className="w-16 h-16 rounded-full" style={{ backgroundColor: cat.color }}/>
                          <span className="text-white text-xs text-center">{cat.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button onClick={() => setColorCat(null)} className="text-purple-400 mb-4">{dih.return}</button>
                    <div className="overflow-x-auto pb-4">
                      <div className="flex gap-4 min-w-max">
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
                  <span className="text-gray-300 text-sm">{dih.active}</span>
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
                      <label className="text-white text-sm mb-2 block text-right">{dih.highlightIntensity}{Math.round(highlightIntensity * 100)}%</label>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
          </svg>
        </button>
      )}

      <AnimatePresence>
        {!isDesktop && showColorPalette && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 pt-5 bg-transparent backdrop-blur-md rounded-t-2xl shadow-2xl z-30 max-h-[70vh] overflow-y-auto"
          >
            <div className="flex justify-center">
              <div className="w-12 h-1 bg-gray-400 rounded-full"/>
            </div>
            <div className="p-4 pt-5">
              <button
                onClick={() => setShowColorPalette(false)}
                className="absolute right-3 top-3 bg-orange-500 w-8 h-8 flex items-center justify-center rounded-full text-white"
              >
                ✕
              </button>

              {/* <div className="flex gap-2 mb-4 mt-4"> */}
              {/*   <button */}
              {/*     onClick={() => setActiveTab('color')} */}
              {/*     className={`flex-1 px-4 py-2 rounded-lg text-sm ${ */}
              {/*       activeTab === 'color' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300' */}
              {/*     }`} */}
              {/*   > */}
              {/*     {dih.baseColor} */}
              {/*   </button> */}
              {/*   <button */}
              {/*     onClick={() => setActiveTab('highlights')} */}
              {/*     className={`flex-1 px-4 py-2 rounded-lg text-sm ${ */}
              {/*       activeTab === 'highlights' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300' */}
              {/*     }`} */}
              {/*   > */}
              {/*     {dih.highlight} */}
              {/*   </button> */}
              {/* </div> */}

              {activeTab === 'color' && (
                <>
                  {!colorCat ? (
                    // <div className="grid grid-cols-3 gap-3">
                    //   {COLOR_CATEGORIES.map((cat) => (
                    //     <div key={cat.slug} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setColorCat(cat)}>
                    //       <div className="w-16 h-16 rounded-full" style={{ backgroundColor: cat.color }}/>
                    //       <span className="text-white text-xs text-center">{cat.title}</span>
                    //     </div>
                    //   ))}
                    // </div>
                      <div className="flex max-w-screen p-1 gap-1 overflow-x-auto overflow-y-hidden">
                        {COLOR_CATEGORIES.map((colorObj, idx) => (
                          <ColorSwatch
                            key={idx}
                            colorObj={colorObj}
                            onClick={() => setColorCat(colorObj)}
                            isSelected={colorCat?.color === colorObj.color}
                          />
                        ))}
                      </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setColorCat(null)}
                        className="absolute left-3 top-3 bg-gray-500 w-16 h-8 flex items-center justify-center rounded-full text-white text-sm"
                      >
                        {dih.return}
                      </button>
                      <div className="flex max-w-screen p-1 overflow-x-auto overflow-y-hidden">
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
                    <div className='flex justify-between'>
                      <label className="text-white text-sm w-2/5">{dih.colorIntensity} {Math.round(colorIntensity * 100)}%</label>
                      <input
                        type="range"
                        min="0.3"
                        max="1"
                        step="0.05"
                        value={colorIntensity}
                        dir='ltr'
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
                    <span className="text-gray-300 text-sm">{dih.inactive}</span>
                    <button
                      onClick={() => setHighlightMode(!highlightMode)}
                      className={`relative w-12 h-6 rounded-full transition ${highlightMode ? 'bg-purple-600' : 'bg-gray-600'}`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 bg-white rounded-full"
                        animate={{ x: highlightMode ? 24 : 2 }}
                      />
                    </button>
                    <span className="text-gray-300 text-sm">{dih.active}</span>
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
                        <label className="text-white text-sm mb-2 block text-right">{dih.highlightIntensity}{Math.round(highlightIntensity * 100)}%</label>
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

      {/* <footer className="mt-6 text-gray-400 text-sm text-center pb-4"> */}
      {/*   <p>{dih.yourPicWontBeSaved</p> */}
      {/* </footer> */}
    </div>
  );
}