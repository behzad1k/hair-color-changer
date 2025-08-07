'use client';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWindowSize } from '@react-hook/window-size';

const COLOR_PALETTE = [
  '#9a3300', '#967259', '#a17383', '#0e1111', '#414a4c', '#aa8866', '#005582', '#634832'
];

export default function HairColorChanger() {
  const [width, height] = useWindowSize();
  const isMobile = width < 768;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#aa8866');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edgeFadeRate, setEdgeFadeRate] = useState(1); // 0 to 1, where 1 is maximum fade
  const [isLoading, setIsLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showColorPalette, setShowColorPalette] = useState(true);
  const visionRef = useRef<any>(null);
  const hairSegmenterRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const toggleColorPalette = () => {
    setShowColorPalette(!showColorPalette);
  };
  // Enhanced applyHairColor with blending and edge fading
  const applyHairColor = useCallback((ctx: CanvasRenderingContext2D, mask: any) => {
    try {
      const {
        width,
        height
      } = ctx.canvas;
      const maskData = mask.getAsUint8Array();
      const imageData = ctx.getImageData(0, 0, width, height);

      // Convert hex color to RGB
      const hex = selectedColor.replace('#', '');
      const targetR = parseInt(hex.substring(0, 2), 16);
      const targetG = parseInt(hex.substring(2, 4), 16);
      const targetB = parseInt(hex.substring(4, 6), 16);

      // Create a temporary canvas for edge expansion and fading
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw the original mask to the temp canvas
      const maskImageData = tempCtx.createImageData(width, height);
      for (let i = 0; i < maskData.length; i++) {
        const pixelIndex = i * 4;
        maskImageData.data[pixelIndex] = maskData[i] * 255;
        maskImageData.data[pixelIndex + 1] = maskData[i] * 255;
        maskImageData.data[pixelIndex + 2] = maskData[i] * 255;
        maskImageData.data[pixelIndex + 3] = 255;
      }
      tempCtx.putImageData(maskImageData, 0, 0);

      // Create an expanded mask by dilating the original mask
      const expandedCanvas = document.createElement('canvas');
      expandedCanvas.width = width;
      expandedCanvas.height = height;
      const expandedCtx = expandedCanvas.getContext('2d');
      if (!expandedCtx) return;

      // Draw the original mask
      expandedCtx.putImageData(maskImageData, 0, 0);

      // Apply dilation by drawing multiple times with offset
      const expandPixels = .5; // Average of 4-6 pixels expansion
      expandedCtx.globalCompositeOperation = 'lighten';
      expandedCtx.filter = 'blur(1px)'; // Soften the expansion

      // Draw expanded edges in all directions
      for (let i = 1; i <= expandPixels; i++) {
        expandedCtx.drawImage(tempCanvas, -i, 0); // left
        expandedCtx.drawImage(tempCanvas, i, 0);  // right
        expandedCtx.drawImage(tempCanvas, 0, -i); // top
        expandedCtx.drawImage(tempCanvas, 0, i);  // bottom
        // Diagonals for more complete expansion
        expandedCtx.drawImage(tempCanvas, -i, -i);
        expandedCtx.drawImage(tempCanvas, i, -i);
        expandedCtx.drawImage(tempCanvas, -i, i);
        expandedCtx.drawImage(tempCanvas, i, i);
      }

      expandedCtx.filter = 'none';
      expandedCtx.globalCompositeOperation = 'source-over';

      // Create gradient mask for fading
      const gradientCanvas = document.createElement('canvas');
      gradientCanvas.width = width;
      gradientCanvas.height = height;
      const gradientCtx = gradientCanvas.getContext('2d');
      if (!gradientCtx) return;

      // Get the expanded mask data
      const expandedData = expandedCtx.getImageData(0, 0, width, height);
      gradientCtx.putImageData(expandedData, 0, 0);

      // Apply blur to create smooth fading
      const fadeStartDistance = 5; // Start fading 3-4 pixels before the edge
      const totalFadeDistance = expandPixels + fadeStartDistance;
      gradientCtx.filter = `blur(${totalFadeDistance}px)`;
      gradientCtx.drawImage(gradientCanvas, 0, 0);
      gradientCtx.filter = 'none';

      // Get the final mask with smooth fading
      const finalMaskData = gradientCtx.getImageData(0, 0, width, height).data;

      // Apply color with blending and edge fading
      for (let i = 0; i < maskData.length; i++) {
        const pixelIndex = i * 4;
        const maskValue = finalMaskData[pixelIndex] / 255; // Fading mask value (0 to 1)

        if (maskValue > 0) {
          // Get the original pixel color
          const originalR = imageData.data[pixelIndex];
          const originalG = imageData.data[pixelIndex + 1];
          const originalB = imageData.data[pixelIndex + 2];

          // Calculate the blend amount based on the original mask and fading
          const originalMaskValue = maskData[i]; // Original mask (0 or 1)
          const edgeFactor = originalMaskValue === 1 ? 1 : maskValue; // Full strength inside, fading at edges

          // Dynamic blend factor based on original hair darkness
          const originalBrightness = (originalR + originalG + originalB) / 3;
          const darknessFactor = originalBrightness / 255; // 0 for black, 1 for white
          // More color for darker hair, less for lighter
          const blendFactor = 0.35;

          // Apply color with edge fading
          imageData.data[pixelIndex] =
            targetR * blendFactor * edgeFactor +
            originalR * (1 - blendFactor * edgeFactor);

          imageData.data[pixelIndex + 1] =
            targetG * blendFactor * edgeFactor +
            originalG * (1 - blendFactor * edgeFactor);

          imageData.data[pixelIndex + 2] =
            targetB * blendFactor * edgeFactor +
            originalB * (1 - blendFactor * edgeFactor);
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Apply a subtle noise filter to make it look more natural
      const noiseOpacity = 0.03;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelIndex = Math.floor(i / 4);
        const maskValue = finalMaskData[i] / 255;
        if (maskValue > 0) {
          const noise = (Math.random() - 0.5) * 40;
          imageData.data[i] += noise * noiseOpacity * maskValue;
          imageData.data[i + 1] += noise * noiseOpacity * maskValue;
          imageData.data[i + 2] += noise * noiseOpacity * maskValue;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error applying hair color:', error);
    }
  }, [selectedColor, edgeFadeRate]);
  // Process frame with rate limiting
  const processFrame = useCallback(async () => {
    if (!isCameraOn || !hairSegmenterRef.current || isProcessing) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = Date.now();
    if (now - lastProcessTimeRef.current < 200) { // 0.5 FPS
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    setIsProcessing(true);
    lastProcessTimeRef.current = now;

    try {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw the original video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Perform hair segmentation
        const segmentationResult = await hairSegmenterRef.current.segmentForVideo(
          video,
          now
        );

        if (segmentationResult.categoryMask) {
          applyHairColor(ctx, segmentationResult.categoryMask);
        }
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    } finally {
      setIsProcessing(false);
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isCameraOn, isProcessing, applyHairColor]);

  // Initialize MediaPipe and start camera on load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAndStart = async () => {
      try {
        // Initialize MediaPipe
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm'
        );
        visionRef.current = vision;

        const options: ImageSegmenterOptions = {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        };

        hairSegmenterRef.current = await ImageSegmenter.createFromOptions(vision, options);
        setIsLoading(false)
        // Start camera after initialization
        await startCamera();
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to initialize. Please refresh the page and allow camera access.');
      }
    };

    initializeAndStart();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Start processing when camera is on
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

  // Start camera function
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
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
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please ensure you\'ve granted camera permissions.');
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full mb-4"
            />
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white text-lg text-center px-4"
            >...در حال بارگزاری</motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 mx-auto max-w-md bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg z-40 flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-4xl py-4 z-10"
      >
        <h1 className="text-2xl font-sans md:text-4xl text-center text-white">رنگ مو مجازی</h1>
      </motion.header>

      {/* Camera preview area - responsive sizing */}
      <div className={`relative h-full w-full ${isMobile ? 'aspect-[9/16]' : 'aspect-video'}  rounded-xl md:rounded-2xl overflow-hidden bg-gray-800 shadow-xl`}>
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isCameraOn ? 'opacity-0' : 'opacity-20'}`}
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Camera status indicator */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${isCameraOn ? 'bg-green-400 shadow-green-400/50' : 'bg-gray-500'} shadow-lg`}
          />
          <span className="text-white text-xs md:text-sm font-medium">
            {isCameraOn ? 'Active' : 'Offline'}
          </span>
        </div>

        {/* Instructions overlay */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-6 z-20"
              onClick={() => setShowInstructions(false)}
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="bg-gray-800/90 border border-gray-700 rounded-xl p-4 md:p-6 max-w-md w-full mx-4 text-center"
              >
                <h3 className="text-xl md:text-4xl text-white mb-3 md:mb-4">نحوه استفاده</h3>
                <ul className="space-y-2 md:space-y-3 md:text-base mb-4 md:mb-6">
                  <li className="flex flex-row-reverse gap-3 mt-4">
                    <span className="text-blue-500">.۱</span> اجازه دسترسی به دوربین را تایید کنید
                  </li>
                  <li className="flex flex-row-reverse gap-3 mt-4">
                    <span className="text-blue-500">.۲</span> رنگ مو مد نظر خود را انتخاب کنید
                  </li>
                  <li className="flex flex-row-reverse gap-3 mt-4">
                    <span className="text-blue-500">.۳</span>در محیطی با نور مناسب قرار گیرید
                  </li>
                </ul>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 md:px-6 md:py-2 rounded-lg font-medium transition-colors text-sm md:text-base mt-4"
                >
                  متوجه شدم!
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile controls toggle */}
      {/* {isMobile && ( */}
      {/*   <motion.button */}
      {/*     onClick={toggleColorPalette} */}
      {/*     whileTap={{ scale: 0.95 }} */}
      {/*     className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30 bg-blue-600 text-white rounded-full p-3 shadow-xl" */}
      {/*   > */}
      {/*     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> */}
      {/*       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /> */}
      {/*     </svg> */}
      {/*   </motion.button> */}
      {/* )} */}

      {/* Controls panel - responsive positioning */}
      <AnimatePresence>
        {(showColorPalette || !isMobile) && (
          <motion.div
            initial={{ y: isMobile ? 50 : 0, opacity: isMobile ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: isMobile ? 50 : 0, opacity: isMobile ? 0 : 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`${isMobile ? 'fixed bottom-0 left-0 right-0' : 'relative mt-6'} w-full max-w-2xl bg-gray-800/90 backdrop-blur-md rounded-t-2xl ${isMobile ? 'rounded-b-none' : 'rounded-2xl'} md:p-6 shadow-lg border border-gray-700 z-20 p-4 `}
          >
            <div className="flex flex-col items-center gap-4 md:gap-6">
              <div className="text-center">
                <h2 className="text-xl md:text-2xl text-white mb-1 text-right">!رنگ مو های جدید امتخان کنید</h2>
                <p className="text-gray-400 text-sm md:text-base">یکی از رتگ های زیر را برای شروع انتخاب کنید</p>
              </div>

              {/* Color palette - responsive sizing */}
              <div className="w-full pb-5">
                <div className="flex justify-center gap-2 md:gap-3 px-1 flex-wrap " style={{ minWidth: 'min-content' }}>
                  {COLOR_PALETTE.map((color) => (
                    <motion.div
                      key={color}
                      whileHover={{ scale: 1.1, y: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full cursor-pointer shadow-lg transition-all duration-200 ${selectedColor === color ? 'ring-3 md:ring-4 ring-white scale-110' : 'ring-1 md:ring-2 ring-gray-600'}`}
                      style={{ backgroundColor: color }}
                      title={`Color: ${color}`}
                    />
                  ))}
                </div>
              </div>

              {/* Tips */}
              {/* <div className="text-center text-gray-400 text-xs md:text-sm mt-1 md:mt-2"> */}
              {/*   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> */}
              {/*     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> */}
              {/*   </svg> */}
              {/*   For best results, position yourself in good lighting */}
              {/* </div> */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`${isMobile ? 'hidden' : 'block'} mt-4 md:mt-6 text-gray-500 text-xs md:text-sm text-center`}
      >
        <p>Hair Color Changer App • Powered by AI • v1.0.0</p>
      </motion.footer>
    </div>
  );

}