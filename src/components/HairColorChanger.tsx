'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';

const COLOR_PALETTE = [
  '#aa8866', '#debe99', '#241c11', '#4f1a00', '#9a3300',
];

export default function HairColorChanger() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#aa8866');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visionRef = useRef<any>(null);
  const hairSegmenterRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Memoize the applyHairColor function to prevent unnecessary recreations
  const applyHairColor = useCallback((ctx: CanvasRenderingContext2D, mask: any) => {
    try {
      const { width, height } = ctx.canvas;
      const maskData = mask.getAsUint8Array();
      const imageData = ctx.getImageData(0, 0, width, height);

      const hex = selectedColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] === 1) {
          const pixelIndex = i * 4;
          const blendFactor = 0.4; // Increased blend factor for more visible color change
          imageData.data[pixelIndex] = r * blendFactor + imageData.data[pixelIndex] * (1 - blendFactor);
          imageData.data[pixelIndex + 1] = g * blendFactor + imageData.data[pixelIndex + 1] * (1 - blendFactor);
          imageData.data[pixelIndex + 2] = b * blendFactor + imageData.data[pixelIndex + 2] * (1 - blendFactor);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error applying hair color:', error);
    }
  }, [selectedColor]); // Recreate only when selectedColor changes

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
      console.error("Error processing frame:", err);
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
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm"
        );
        visionRef.current = vision;

        const options: ImageSegmenterOptions = {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
            delegate: "CPU"
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        };

        hairSegmenterRef.current = await ImageSegmenter.createFromOptions(vision, options);

        // Start camera after initialization
        await startCamera();
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to initialize. Please refresh the page and allow camera access.");
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
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure you've granted camera permissions.");
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
          style={{ display: 'none', width: '640px', height: '480px' }}
        />
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 rounded-lg ${isCameraOn ? 'block' : 'hidden'} h-screen w-screen`}
        />
      </div>

      <div className="flex flex-col items-center gap-6 absolute bottom-0" style={{ bottom: 30 }}>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-semibold mb-2">Choose Hair Color</h2>
          <div className="flex gap-4 w-full gap-2">
            {COLOR_PALETTE.map((color) => (
              <span
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{
                  backgroundColor: color,
                  width: 50,
                  height: 50,
                  borderRadius: 150,
                  cursor: 'pointer',
                  border: selectedColor === color ? '2px solid white' : 'none'
                }}
              />
            ))}
          </div>
          <div className="mt-2 w-full h-8 rounded-md"
               style={{ backgroundColor: selectedColor }} />
        </div>
        <span className="text-lg">Note: Works best in well-lit environments with clear hair visibility</span>
        <span className="">The model may take a moment to initialize</span>
      </div>
    </div>
  );
}