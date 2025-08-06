'use client';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';

const COLOR_PALETTE = [
  '#9a3300', '#967259', '#a17383', '#0e1111', '#414a4c', '#aa8866', '#005582', '#634832'
];

export default function HairColorChanger() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#aa8866');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edgeFadeRate, setEdgeFadeRate] = useState(1); // 0 to 1, where 1 is maximum fade
  const visionRef = useRef<any>(null);
  const hairSegmenterRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Enhanced applyHairColor with blending and edge fading
  // Updated applyHairColor with edge expansion and smoother fading
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="relative mb-6 h-screen w-screen">
        <video
          ref={videoRef}
          className={`rounded-lg border-4 ${isCameraOn ? 'border-green-500' : 'border-gray-300'}`}
          playsInline
          muted
          style={{
            display: 'none',
            width: '640px',
            height: '480px'
          }}
        />
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 rounded-lg ${isCameraOn ? 'block' : 'hidden'} h-screen w-screen`}
        />
      </div>

      <div className="flex flex-col items-center gap-6 absolute bottom-0" style={{ bottom: 30 }}>
        <div className="flex flex-col items-center gap-2" style={{ gap: 10 }}>
          <span className="text-lg mb-2">رنگ مورد علاقه خود را انتخاب کنید</span>
          <div className="flex gap-4 w-full gap-2" style={{ gap: 4 }}>
            {COLOR_PALETTE.map((color) => (
              <span
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{
                  backgroundColor: color,
                  width: 40,
                  height: 40,
                  borderRadius: 150,
                  cursor: 'pointer',
                  border: selectedColor === color ? '2px solid white' : 'none'
                }}
              />
            ))}
          </div>
          <div className="mt-2 w-full h-8 rounded-md"
               style={{ backgroundColor: selectedColor }}/>
          <span className="text-sm">برای نمایش مطلوب در محیط های با نور مناسب قرار بگیرید</span>
        </div>

      </div>
    </div>
  );
}