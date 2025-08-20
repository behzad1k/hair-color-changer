'use client';
import { FilesetResolver, ImageSegmenter, ImageSegmenterOptions } from '@mediapipe/tasks-vision';
import { useWindowSize } from '@react-hook/window-size';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const COLOR_PALETTE = [
  {
    color: '#2C1810',
    opacity: 0.7
  }, // Dark Brown
  {
    color: '#3D2817',
    opacity: 0.8
  }, // Medium Brown
  {
    color: '#654321',
    opacity: 0.6
  }, // Chocolate Brown
  {
    color: '#8B4513',
    opacity: 0.5
  }, // Saddle Brown
  {
    color: '#A0522D',
    opacity: 0.4
  }, // Sienna
  {
    color: '#CD853F',
    opacity: 0.3
  }, // Peru
  {
    color: '#DEB887',
    opacity: 0.3
  }, // Burlywood
  {
    color: '#F4A460',
    opacity: 0.2
  }  // Sandy Brown
];

const HIGHLIGHT_COLORS = [
  {
    color: '#F5F5DC',
    opacity: 0.4
  }, // Platinum Blonde
  {
    color: '#E6D3A3',
    opacity: 0.5
  }, // Champagne Blonde
  {
    color: '#DEB887',
    opacity: 0.4
  }, // Honey Blonde
  {
    color: '#D2B48C',
    opacity: 0.5
  }, // Caramel Blonde
  {
    color: '#F0E68C',
    opacity: 0.3
  }, // Light Golden
  {
    color: '#FFEFD5',
    opacity: 0.3
  }, // Papaya Whip
  {
    color: '#FFE4B5',
    opacity: 0.4
  }, // Moccasin
  {
    color: '#E6E6FA',
    opacity: 0.3
  }  // Lavender (for cool tones)
];

export default function HairColorChanger() {
  const [width, height] = useWindowSize();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[2]); // Chocolate Brown
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0]); // Platinum Blonde
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightIntensity, setHighlightIntensity] = useState(0.3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showColorPalette, setShowColorPalette] = useState(false); // Hidden by default
  const [hasShownInstructions, setHasShownInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState<'color' | 'highlights'>('color');

  const visionRef = useRef<any>(null);
  const hairSegmenterRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const toggleColorPalette = () => {
    setShowColorPalette(!showColorPalette);
  };

  const handleInstructionsDismiss = () => {
    setShowInstructions(false);
    if (!hasShownInstructions) {
      setHasShownInstructions(true);
      // Delay showing the control panel for smooth animation
      setTimeout(() => {
        setShowColorPalette(true);
      }, 500);
    }
  };

  // Enhanced realistic hair coloring with texture preservation
  const applyRealisticHairColor = useCallback((ctx: CanvasRenderingContext2D, mask: any) => {
    try {
      const {
        width,
        height
      } = ctx.canvas;
      const maskData = mask.getAsUint8Array();
      const imageData = ctx.getImageData(0, 0, width, height);

      // Convert color objects to RGB
      const extractRgb = (colorObj: {
        color: string,
        opacity: number
      }) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorObj.color);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
          opacity: colorObj.opacity
        } : {
          r: 0,
          g: 0,
          b: 0,
          opacity: 1
        };
      };

      const baseColor = extractRgb(selectedColor);
      const highlightColor = extractRgb(selectedHighlightColor);

      // Create advanced edge detection and smoothing
      const createAdvancedMask = (maskData: Uint8Array, width: number, height: number) => {
        const smoothMask = new Float32Array(width * height);
        const edgeMask = new Float32Array(width * height);

        // Multi-pass smoothing with different radii
        const smoothingPasses = [
          {
            radius: 1,
            weight: 0.4
          },
          {
            radius: 2,
            weight: 0.3
          },
          {
            radius: 3,
            weight: 0.3
          }
        ];

        // Initialize with original mask
        for (let i = 0; i < maskData.length; i++) {
          smoothMask[i] = maskData[i] > 0 ? 1 : 0;
        }

        // Apply multiple smoothing passes
        smoothingPasses.forEach(pass => {
          const tempMask = new Float32Array(smoothMask);

          for (let y = pass.radius; y < height - pass.radius; y++) {
            for (let x = pass.radius; x < width - pass.radius; x++) {
              let sum = 0;
              let count = 0;

              for (let dy = -pass.radius; dy <= pass.radius; dy++) {
                for (let dx = -pass.radius; dx <= pass.radius; dx++) {
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  if (distance <= pass.radius) {
                    const weight = Math.exp(-distance * distance / (2 * pass.radius * pass.radius));
                    sum += tempMask[(y + dy) * width + (x + dx)] * weight;
                    count += weight;
                  }
                }
              }

              const idx = y * width + x;
              smoothMask[idx] = smoothMask[idx] * (1 - pass.weight) + (sum / count) * pass.weight;
            }
          }
        });

        // Detect edges for texture preservation
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            // Sobel edge detection
            const gx =
              smoothMask[(y - 1) * width + (x - 1)] * -1 + smoothMask[(y - 1) * width + (x + 1)] * 1 +
              smoothMask[y * width + (x - 1)] * -2 + smoothMask[y * width + (x + 1)] * 2 +
              smoothMask[(y + 1) * width + (x - 1)] * -1 + smoothMask[(y + 1) * width + (x + 1)] * 1;

            const gy =
              smoothMask[(y - 1) * width + (x - 1)] * -1 + smoothMask[(y - 1) * width + x] * -2 + smoothMask[(y - 1) * width + (x + 1)] * -1 +
              smoothMask[(y + 1) * width + (x - 1)] * 1 + smoothMask[(y + 1) * width + x] * 2 + smoothMask[(y + 1) * width + (x + 1)] * 1;

            edgeMask[idx] = Math.sqrt(gx * gx + gy * gy);
          }
        }

        return {
          smoothMask,
          edgeMask
        };
      };

      // Generate strategic highlight pattern based on hair segmentation
      const generateHighlightPattern = (width: number, height: number, smoothMask: Float32Array) => {
        const highlightMask = new Float32Array(width * height);

        if (!highlightMode) return highlightMask;

        // Find hair boundaries and analyze structure
        const findHairBoundaries = () => {
          let topY = height, bottomY = 0, leftX = width, rightX = 0;
          const hairPixels: Array<{
            x: number,
            y: number,
            intensity: number
          }> = [];

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              const intensity = smoothMask[idx];

              if (intensity > 0.3) {
                hairPixels.push({
                  x,
                  y,
                  intensity
                });
                topY = Math.min(topY, y);
                bottomY = Math.max(bottomY, y);
                leftX = Math.min(leftX, x);
                rightX = Math.max(rightX, x);
              }
            }
          }

          return {
            topY,
            bottomY,
            leftX,
            rightX,
            hairPixels
          };
        };

        const {
          topY,
          bottomY,
          leftX,
          rightX,
          hairPixels
        } = findHairBoundaries();
        const hairHeight = bottomY - topY;
        const hairWidth = rightX - leftX;

        if (hairHeight <= 0 || hairWidth <= 0) return highlightMask;

        // Create extended mask that goes beyond hair boundaries
        const createExtendedMask = () => {
          const extendedMask = new Float32Array(width * height);
          const bottomExtension = 25; // pixels to extend beyond bottom edge

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              const originalIntensity = smoothMask[idx];

              if (originalIntensity > 0.1) {
                extendedMask[idx] = originalIntensity;
              } else {
                // Check if this pixel should be part of extension
                let shouldExtend = false;
                let maxNearbyIntensity = 0;

                // Look for nearby hair pixels above this position
                for (let checkY = Math.max(0, y - bottomExtension); checkY < y; checkY++) {
                  const checkIdx = checkY * width + x;
                  const checkIntensity = smoothMask[checkIdx];
                  if (checkIntensity > 0.3) {
                    shouldExtend = true;
                    maxNearbyIntensity = Math.max(maxNearbyIntensity, checkIntensity);
                  }
                }

                if (shouldExtend && y <= bottomY + bottomExtension) {
                  // Calculate extension intensity based on distance from hair edge
                  const distanceFromHair = y - bottomY;
                  const extensionFactor = Math.max(0, 1 - (distanceFromHair / bottomExtension));
                  // Use cubic fade for smooth transition
                  const fadeIntensity = extensionFactor * extensionFactor * (3 - 2 * extensionFactor);
                  extendedMask[idx] = maxNearbyIntensity * fadeIntensity * 0.8;
                }
              }
            }
          }

          return extendedMask;
        };

        const extendedMask = createExtendedMask();

        // Strategic highlight placement rules with zebra patterns
        const applyStrategicHighlights = () => {
          // Rule 1: Bottom 30% with zebra-like stripe patterns
          const bottomThreshold = topY + hairHeight * 0.7;
          const stripeWidth = hairWidth / 8; // Create 8 potential stripes across hair width
          const activeStripes = [0, 2, 4, 6]; // Zebra pattern - alternate stripes

          for (let y = Math.floor(bottomThreshold); y < height; y++) {
            for (let x = leftX; x <= rightX; x++) {
              const idx = y * width + x;
              const hairIntensity = extendedMask[idx];

              if (hairIntensity > 0.1) {
                // Determine which stripe this pixel belongs to
                const relativeX = x - leftX;
                const stripeIndex = Math.floor(relativeX / stripeWidth);

                // Check if this stripe should have highlights
                const isActiveStripe = activeStripes.includes(stripeIndex);

                if (isActiveStripe) {
                  // Calculate position within stripe for smooth fading
                  const positionInStripe = (relativeX % stripeWidth) / stripeWidth;

                  // Create smooth fade across stripe width (bell curve)
                  const stripeFade = Math.sin(positionInStripe * Math.PI);

                  // Vertical progression - stronger at bottom
                  const verticalProgress = y < bottomY ?
                    (y - bottomThreshold) / (bottomY - bottomThreshold) :
                    1 - Math.min(1, (y - bottomY) / 25); // Fade in extension area

                  // Create natural variation along the stripe
                  const naturalVariation = 0.8 + Math.sin(y * 0.1) * 0.2;

                  const highlightIntensityValue = hairIntensity * stripeFade * verticalProgress * naturalVariation * 0.9;

                  highlightMask[idx] = Math.max(highlightMask[idx], highlightIntensityValue);

                  // Add soft edges to stripes by affecting neighboring pixels
                  for (let dx = -1; dx <= 1; dx++) {
                    const neighborX = x + dx;
                    if (neighborX >= 0 && neighborX < width) {
                      const neighborIdx = y * width + neighborX;
                      const neighborIntensity = extendedMask[neighborIdx];
                      if (neighborIntensity > 0.05) {
                        const edgeFade = Math.max(0, 1 - Math.abs(dx) * 0.3);
                        const edgeHighlight = highlightIntensityValue * edgeFade * 0.4;
                        highlightMask[neighborIdx] = Math.max(highlightMask[neighborIdx], edgeHighlight);
                      }
                    }
                  }
                }
              }
            }
          }

          // Rule 2: Face-framing highlights with strand grouping
          const faceFramingStripes = [0, 1, 6, 7]; // Outer stripes for face framing

          for (const pixel of hairPixels) {
            const {
              x,
              y,
              intensity
            } = pixel;
            const relativeX = x - leftX;
            const stripeIndex = Math.floor(relativeX / stripeWidth);

            if (faceFramingStripes.includes(stripeIndex) && intensity > 0.5) {
              const verticalPosition = (y - topY) / hairHeight;

              // Stronger at top, gradually decreasing
              const verticalFade = Math.max(0, 1 - verticalPosition * 0.8);

              // Position within stripe for smooth transition
              const positionInStripe = (relativeX % stripeWidth) / stripeWidth;
              const stripeFade = Math.sin(positionInStripe * Math.PI);

              const faceFramingIntensity = intensity * stripeFade * verticalFade * 0.6;

              const idx = y * width + x;
              highlightMask[idx] = Math.max(highlightMask[idx], faceFramingIntensity);
            }
          }

          // Rule 3: Crown area with subtle stripe pattern
          const topThreshold = topY + hairHeight * 0.25;
          const crownStripes = [2, 3, 4, 5]; // Middle stripes for crown

          for (const pixel of hairPixels) {
            const {
              x,
              y,
              intensity
            } = pixel;

            if (y <= topThreshold && intensity > 0.6) {
              const relativeX = x - leftX;
              const stripeIndex = Math.floor(relativeX / stripeWidth);

              if (crownStripes.includes(stripeIndex)) {
                const topProgress = 1 - (y - topY) / (topThreshold - topY);
                const positionInStripe = (relativeX % stripeWidth) / stripeWidth;
                const stripeFade = Math.sin(positionInStripe * Math.PI);

                const crownIntensity = intensity * stripeFade * topProgress * 0.4;

                const idx = y * width + x;
                highlightMask[idx] = Math.max(highlightMask[idx], crownIntensity);
              }
            }
          }

          // Rule 4: Mid-length dimensional stripes
          const midStart = topY + hairHeight * 0.4;
          const midEnd = topY + hairHeight * 0.7;
          const midStripes = [1, 3, 5]; // Scattered stripes for dimension

          for (const pixel of hairPixels) {
            const {
              x,
              y,
              intensity
            } = pixel;

            if (y >= midStart && y <= midEnd && intensity > 0.5) {
              const relativeX = x - leftX;
              const stripeIndex = Math.floor(relativeX / stripeWidth);

              if (midStripes.includes(stripeIndex)) {
                const verticalFade = Math.sin((y - midStart) / (midEnd - midStart) * Math.PI);
                const positionInStripe = (relativeX % stripeWidth) / stripeWidth;
                const stripeFade = Math.sin(positionInStripe * Math.PI);

                const dimensionalIntensity = intensity * stripeFade * verticalFade * 0.35;

                const idx = y * width + x;
                highlightMask[idx] = Math.max(highlightMask[idx], dimensionalIntensity);
              }
            }
          }
        };

        // Apply strategic highlight rules
        applyStrategicHighlights();

        // Apply final smoothing and edge fading
        const applyFinalSmoothing = () => {
          const smoothedHighlights = new Float32Array(highlightMask);
          const smoothRadius = 2;

          for (let y = smoothRadius; y < height - smoothRadius; y++) {
            for (let x = smoothRadius; x < width - smoothRadius; x++) {
              const idx = y * width + x;

              if (highlightMask[idx] > 0) {
                let sum = 0;
                let count = 0;

                for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
                  for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= smoothRadius) {
                      const neighborIdx = (y + dy) * width + (x + dx);
                      const weight = Math.exp(-distance * distance / (smoothRadius * smoothRadius));
                      sum += highlightMask[neighborIdx] * weight;
                      count += weight;
                    }
                  }
                }

                smoothedHighlights[idx] = (sum / count) * highlightIntensity;
              }
            }
          }

          return smoothedHighlights;
        };

        return applyFinalSmoothing();
      };

      const {
        smoothMask,
        edgeMask
      } = createAdvancedMask(maskData, width, height);
      const highlightMask = generateHighlightPattern(width, height, smoothMask);

      // Find hair boundaries for gradient blending
      let leftX = width, rightX = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (smoothMask[idx] > 0.3) {
            leftX = Math.min(leftX, x);
            rightX = Math.max(rightX, x);
          }
        }
      }

      // Apply enhanced color blending
      for (let i = 0; i < maskData.length; i++) {
        const pixelIndex = i * 4;
        const x = i % width;
        const y = Math.floor(i / width);

        const maskValue = smoothMask[i];
        const edgeValue = edgeMask[i];
        const highlightValue = highlightMask[i];

        if (maskValue > 0.05) {
          const originalR = imageData.data[pixelIndex];
          const originalG = imageData.data[pixelIndex + 1];
          const originalB = imageData.data[pixelIndex + 2];

          // Calculate original brightness and color temperature
          const originalBrightness = (originalR * 0.299 + originalG * 0.587 + originalB * 0.114);

          // Preserve texture by reducing blend on edges
          const texturePreservation = Math.max(0.1, 1 - edgeValue * 0.7);

          // Choose between base color and highlight with gradient blending
          const useHighlight = highlightValue > 0.1;
          let currentColor, currentIntensity;

          if (useHighlight) {
            // Create horizontal gradient from highlight color to base color
            const hairWidth = rightX - leftX;
            const centerX = leftX + hairWidth / 2;
            const distanceFromCenter = Math.abs(x - centerX) / (hairWidth / 2);
            const gradientBlend = Math.max(0.3, 1 - distanceFromCenter * 0.7);

            // Blend highlight color with base color for smoother transitions
            currentColor = {
              r: highlightColor.r * gradientBlend + baseColor.r * (1 - gradientBlend),
              g: highlightColor.g * gradientBlend + baseColor.g * (1 - gradientBlend),
              b: highlightColor.b * gradientBlend + baseColor.b * (1 - gradientBlend)
            };
            currentIntensity = highlightValue * gradientBlend;
          } else {
            currentColor = baseColor;
            currentIntensity = baseColor.opacity * maskValue * texturePreservation;
          }

          // Advanced color mixing with brightness consideration
          let blendFactor = currentIntensity;

          // Adjust blend based on original hair darkness
          if (originalBrightness < 80) {
            // Dark hair - more aggressive blending needed
            blendFactor *= 1.2;
          } else if (originalBrightness > 180) {
            // Light hair - more subtle blending
            blendFactor *= 0.7;
          }

          // Preserve natural hair variations
          const naturalVariation = 1 + (Math.random() - 0.5) * 0.1;

          // Color temperature adjustment for realism
          const warmthFactor = useHighlight ? 1.1 : 0.95;
          const adjustedR = currentColor.r * warmthFactor * naturalVariation;
          const adjustedG = currentColor.g * naturalVariation;
          const adjustedB = currentColor.b * (useHighlight ? 1.05 : 0.9) * naturalVariation;

          // Apply sophisticated blending
          const finalR = Math.min(255, Math.max(0,
            adjustedR * blendFactor + originalR * (1 - blendFactor)
          ));
          const finalG = Math.min(255, Math.max(0,
            adjustedG * blendFactor + originalG * (1 - blendFactor)
          ));
          const finalB = Math.min(255, Math.max(0,
            adjustedB * blendFactor + originalB * (1 - blendFactor)
          ));

          imageData.data[pixelIndex] = Math.round(finalR);
          imageData.data[pixelIndex + 1] = Math.round(finalG);
          imageData.data[pixelIndex + 2] = Math.round(finalB);
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Add realistic hair texture enhancement
      const enhanceTexture = () => {
        const textureData = ctx.getImageData(0, 0, width, height);

        for (let i = 0; i < textureData.data.length; i += 4) {
          const pixelIndex = Math.floor(i / 4);
          const maskValue = smoothMask[pixelIndex];

          if (maskValue > 0.1) {
            // Add subtle directional noise to simulate hair strands
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);
            const angle = Math.atan2(y - height / 2, x - width / 2);

            const directionalNoise =
              Math.sin(x * 0.1 + angle) * 2 +
              Math.cos(y * 0.08 + angle * 0.5) * 1.5 +
              (Math.random() - 0.5) * 1;

            const intensity = maskValue * 0.15;

            // Apply texture with color variation
            textureData.data[i] = Math.max(0, Math.min(255,
              textureData.data[i] + directionalNoise * intensity
            ));
            textureData.data[i + 1] = Math.max(0, Math.min(255,
              textureData.data[i + 1] + directionalNoise * intensity * 0.9
            ));
            textureData.data[i + 2] = Math.max(0, Math.min(255,
              textureData.data[i + 2] + directionalNoise * intensity * 0.8
            ));
          }
        }

        ctx.putImageData(textureData, 0, 0);
      };

      enhanceTexture();

    } catch (error) {
      console.error('Error applying hair color:', error);
    }
  }, [selectedColor, selectedHighlightColor, highlightMode, highlightIntensity]);

  // Process frame with rate limiting
  const processFrame = useCallback(async () => {
    if (!isCameraOn || !hairSegmenterRef.current || isProcessing) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = Date.now();
    if (now - lastProcessTimeRef.current < 150) {
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

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const segmentationResult = await hairSegmenterRef.current.segmentForVideo(
          video,
          now
        );

        if (segmentationResult.categoryMask) {
          applyRealisticHairColor(ctx, segmentationResult.categoryMask);
        }
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    } finally {
      setIsProcessing(false);
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isCameraOn, isProcessing, applyRealisticHairColor]);

  // Initialize MediaPipe and start camera on load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAndStart = async () => {
      try {
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
        setIsLoading(false);
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
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-800 overflow-hidden">
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
              transition={{
                repeat: Infinity,
                duration: 1,
                ease: 'linear'
              }}
              className="w-16 h-16 border-4 border-t-transparent border-purple-500 rounded-full mb-4"
            />
            <motion.p
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              transition={{ delay: 0.2 }}
              className="text-white text-lg text-center px-4"
            >در حال بارگزاری...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{
              y: -50,
              opacity: 0
            }}
            animate={{
              y: 0,
              opacity: 1
            }}
            exit={{
              y: -50,
              opacity: 0
            }}
            className="fixed top-4 left-4 right-4 mx-auto max-w-md bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg z-40 flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Responsive */}
      <motion.header
        initial={{
          opacity: 0,
          y: -20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-7xl py-2 md:py-4 z-10 px-4"
      >
        <h1 className={`font-sans text-center text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent ${
          isMobile ? 'text-xl' : isTablet ? 'text-3xl' : 'text-4xl'
        }`}>
          رنگ مو مجازی با هوش مصنوعی
        </h1>
      </motion.header>

      {/* Main content area - Responsive layout */}
      <div className={`flex ${isDesktop ? 'gap-8' : ''} flex-col items-center justify-center w-full h-full flex-1`}>

        {/* Camera preview area - Responsive sizing */}
        <div className={`relative ${
          isMobile
            ? 'w-full aspect-[0.5] '
            : isTablet
              ? 'w-10/12 aspect-[3/4] mx-auto'
              : 'w-10/12 aspect-video'
        } rounded-xl md:rounded-2xl overflow-hidden bg-gray-800 shadow-2xl border border-purple-500/30 `}>

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

          {/* Processing indicator */}
          {isProcessing && (
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10 bg-purple-600/80 backdrop-blur-sm rounded-full px-3 py-1">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 1,
                  ease: 'linear'
                }}
                className="w-3 h-3 border-2 border-t-transparent border-white rounded-full"
              />
              <span className="text-white text-xs font-medium">Processing</span>
            </div>
          )}

          {/* Instructions overlay */}
          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-6 z-20"
                onClick={handleInstructionsDismiss}
              >
                <motion.div
                  initial={{
                    y: 20,
                    scale: 0.9
                  }}
                  animate={{
                    y: 0,
                    scale: 1
                  }}
                  className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-purple-500/50 rounded-xl p-4 md:p-6 max-w-md w-full mx-4 text-center shadow-2xl"
                >
                  <h3 className={`text-white mb-3 md:mb-4 ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}`}>نحوه استفاده</h3>
                  <ul className="space-y-2 md:space-y-3 text-sm md:text-base mb-4 md:mb-6 text-gray-200">
                    <li className="flex flex-row-reverse gap-3 mt-4 items-center">
                      <span className="text-purple-400">.۱</span>
                      <span>اجازه دسترسی به دوربین را تایید کنید</span>
                    </li>
                    <li className="flex flex-row-reverse gap-3 mt-4 items-center">
                      <span className="text-purple-400">.۲</span>
                      <span>رنگ پایه یا هایلایت مورد نظر را انتخاب کنید</span>
                    </li>
                    <li className="flex flex-row-reverse gap-3 mt-4 items-center">
                      <span className="text-purple-400">.۳</span>
                      <span>در محیطی با نور مناسب قرار گیرید</span>
                    </li>
                    <li className="flex flex-row-reverse gap-3 mt-4 items-center text-rose-500">
                      <span>
          تصویر و ویدیو شما به هیچ عنوان توسط ما ذخیره نمیشود
        </span>
                    </li>
                  </ul>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-2 md:px-8 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base mt-4 shadow-lg"
                  >
                    شروع کنیم!
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop sidebar controls */}
        {isDesktop && (
          <AnimatePresence>
            {showColorPalette && (
              <motion.div
                initial={{
                  x: 50,
                  opacity: 0
                }}
                animate={{
                  x: 0,
                  opacity: 1
                }}
                exit={{
                  x: 50,
                  opacity: 0
                }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  delay: hasShownInstructions ? 0.5 : 0
                }}
                className="w-full max-w-sm bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-purple-500/30 h-fit"
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Tab switcher */}
                  <div className="flex bg-gray-700/50 rounded-lg p-1 w-fit">
                    <button
                      onClick={() => setActiveTab('color')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'color'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      رنگ پایه
                    </button>
                    <button
                      onClick={() => setActiveTab('highlights')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'highlights'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      هایلایت
                    </button>
                  </div>

                  {/* Base Color Tab */}
                  {activeTab === 'color' && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 10
                      }}
                      animate={{
                        opacity: 1,
                        y: 0
                      }}
                      className="w-full flex flex-col items-center gap-4"
                    >
                      <div className="text-center">
                        <h2 className="text-xl text-white mb-1 text-right">رنگ پایه مو</h2>
                        <p className="text-gray-400 text-sm">یک رنگ پایه برای موهای خود انتخاب کنید</p>
                      </div>

                      {/* Base color palette */}
                      <div className="w-full">
                        <div className="grid grid-cols-4 gap-3 justify-center">
                          {COLOR_PALETTE.map((colorObj, index) => (
                            <motion.div
                              key={index}
                              whileHover={{
                                scale: 1.1,
                                y: -5
                              }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedColor(colorObj)}
                              className={`w-12 h-12 rounded-full cursor-pointer shadow-lg transition-all duration-200 relative ${
                                selectedColor.color === colorObj.color
                                  ? 'ring-4 ring-purple-400 scale-110 shadow-purple-400/50'
                                  : 'ring-2 ring-gray-600 hover:ring-purple-300'
                              }`}
                              style={{ backgroundColor: colorObj.color }}
                              title={`Color: ${colorObj.color} (${Math.round(colorObj.opacity * 100)}% opacity)`}
                            >
                              {/* Opacity indicator */}
                              <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border border-gray-600">
                                {Math.round(colorObj.opacity * 100)}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Highlights Tab */}
                  {activeTab === 'highlights' && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 10
                      }}
                      animate={{
                        opacity: 1,
                        y: 0
                      }}
                      className="w-full flex flex-col items-center gap-4"
                    >
                      <div className="text-center">
                        <h2 className="text-xl text-white mb-1 text-right">هایلایت حرفه‌ای</h2>
                        <p className="text-gray-400 text-sm">هایلایت طبیعی مانند آرایشگاه‌های حرفه‌ای</p>
                      </div>

                      {/* Highlight toggle */}
                      <div className="flex items-center gap-3">
                        <span className="text-gray-300 text-sm">غیرفعال</span>
                        <motion.button
                          onClick={() => setHighlightMode(!highlightMode)}
                          className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                            highlightMode ? 'bg-purple-600' : 'bg-gray-600'
                          }`}
                          whileTap={{ scale: 0.95 }}
                        >
                          <motion.div
                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg"
                            animate={{ x: highlightMode ? 24 : 2 }}
                            transition={{
                              type: 'spring',
                              damping: 20,
                              stiffness: 300
                            }}
                          />
                        </motion.button>
                        <span className="text-gray-300 text-sm">فعال</span>
                      </div>

                      {highlightMode && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            height: 0
                          }}
                          animate={{
                            opacity: 1,
                            height: 'auto'
                          }}
                          exit={{
                            opacity: 0,
                            height: 0
                          }}
                          className="w-full flex flex-col items-center gap-4"
                        >
                          {/* Highlight color palette */}
                          <div className="w-full">
                            <div className="grid grid-cols-4 gap-2 justify-center">
                              {HIGHLIGHT_COLORS.map((colorObj, index) => (
                                <motion.div
                                  key={index}
                                  whileHover={{
                                    scale: 1.1,
                                    y: -3
                                  }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setSelectedHighlightColor(colorObj)}
                                  className={`w-8 h-8 rounded-full cursor-pointer shadow-lg transition-all duration-200 relative ${
                                    selectedHighlightColor.color === colorObj.color
                                      ? 'ring-3 ring-yellow-400 scale-110 shadow-yellow-400/50'
                                      : 'ring-1 ring-gray-600 hover:ring-yellow-300'
                                  }`}
                                  style={{ backgroundColor: colorObj.color }}
                                  title={`Highlight: ${colorObj.color} (${Math.round(colorObj.opacity * 100)}% opacity)`}
                                >
                                  {/* Opacity indicator */}
                                  <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-gray-600">
                                    {Math.round(colorObj.opacity * 10)}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>

                          {/* Highlight intensity slider */}
                          <div className="w-full">
                            <label className="block text-gray-300 text-sm mb-2 text-right">شدت هایلایت: {Math.round(highlightIntensity * 100)}%</label>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.1"
                              value={highlightIntensity}
                              onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                              style={{
                                background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${highlightIntensity * 100}%, #374151 ${highlightIntensity * 100}%, #374151 100%)`
                              }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Tips section */}
                  <div className="text-center text-gray-400 text-xs mt-2">
                    <div className="flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                      <span>برای نتیجه بهتر در نور طبیعی قرار بگیرید</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Control panel toggle button - Mobile & Tablet */}
      {!isDesktop && !showColorPalette && (
        <motion.button
          onClick={toggleColorPalette}
          whileTap={{ scale: 0.95 }}
          className={`fixed ${isMobile ? 'bottom-6 left-1/2 transform -translate-x-1/2' : 'bottom-8 right-8'} z-30 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full ${isMobile ? 'p-4' : 'p-5'} shadow-xl border-2 border-white/20`}
          initial={{
            y: 100,
            opacity: 0
          }}
          animate={{
            y: 0,
            opacity: 1
          }}
          transition={{ delay: hasShownInstructions ? 1 : 0 }}
        >
          <motion.div
            animate={{ rotate: showColorPalette ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`${isMobile ? 'h-6 w-6' : 'h-7 w-7'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
            </svg>
          </motion.div>
        </motion.button>
      )}

      {/* Enhanced Controls panel - Mobile & Tablet */}
      <AnimatePresence>
        {!isDesktop && showColorPalette && (
          <motion.div
            initial={{
              y: isMobile ? '100%' : 50,
              opacity: isMobile ? 1 : 0
            }}
            animate={{
              y: 0,
              opacity: 1
            }}
            exit={{
              y: isMobile ? '100%' : 50,
              opacity: isMobile ? 1 : 0
            }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              delay: hasShownInstructions ? 0.5 : 0
            }}
            className={`${
              isMobile
                ? 'fixed bottom-0 left-0 right-0 max-h-[35vh] overflow-y-auto'
                : 'fixed bottom-4 left-4 right-4 max-w-2xl mx-auto'
            } bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-md rounded-t-2xl ${
              isMobile ? 'rounded-b-none' : 'rounded-2xl'
            } shadow-2xl border border-purple-500/30 z-20`}
          >
            {/* Drag handle for mobile */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-12 h-1 bg-gray-400 rounded-full"></div>
              </div>
            )}
            <button className="absolute left-4 top-8 bg-orange-500 w-9 h-9 flex items-center justify-center text-xl rounded-3xl" onClick={toggleColorPalette}>X</button>
            <div className={`flex flex-col items-center gap-3 ${isMobile ? 'p-3 pb-4' : 'p-4'}`}>
              {/* Tab switcher */}
              <div className="flex bg-gray-700/50 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setActiveTab('color')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'color'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  رنگ پایه
                </button>
                <button
                  onClick={() => setActiveTab('highlights')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'highlights'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  هایلایت
                </button>
              </div>

              {/* Base Color Tab */}
              {activeTab === 'color' && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  className="w-full flex flex-col items-center gap-3"
                >
                  <div className="text-center">
                    <h2 className={`text-white mb-1 text-center ${isMobile ? 'text-base' : 'text-lg'}`}>رنگ پایه مو</h2>
                    <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>یک رنگ پایه برای موهای خود انتخاب کنید</p>
                  </div>

                  {/* Base color palette - Compact grid */}
                  <div className="w-full">
                    <div className={`grid ${isMobile ? 'grid-cols-4' : isTablet ? 'grid-cols-6' : 'grid-cols-8'} gap-2 justify-center max-w-lg mx-auto px-8`}>
                      {COLOR_PALETTE.map((colorObj, index) => (
                        <motion.div
                          key={index}
                          whileHover={{
                            scale: 1.1,
                            y: -3
                          }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedColor(colorObj)}
                          className={`${isMobile ? 'w-8 h-8' : isTablet ? 'w-9 h-9' : 'w-10 h-10'} rounded-full cursor-pointer shadow-lg transition-all duration-200 relative ${
                            selectedColor.color === colorObj.color
                              ? 'ring-2 md:ring-3 ring-purple-400 scale-110 shadow-purple-400/50'
                              : 'ring-1 ring-gray-600 hover:ring-purple-300'
                          }`}
                          style={{ backgroundColor: colorObj.color }}
                          title={`Color: ${colorObj.color} (${Math.round(colorObj.opacity * 100)}% opacity)`}
                        >
                          {/* Opacity indicator */}
                          <div className={`absolute -bottom-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full ${isMobile ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center border border-gray-600`}>
                            {Math.round(colorObj.opacity * 100)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Highlights Tab */}
              {activeTab === 'highlights' && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 10
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  className="w-full flex flex-col items-center gap-3"
                >
                  <div className="text-center">
                    <h2 className={`text-white mb-1 text-right ${isMobile ? 'text-base' : 'text-lg'}`}>هایلایت حرفه‌ای</h2>
                    <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>هایلایت طبیعی مانند آرایشگاه‌های حرفه‌ای</p>
                  </div>

                  {/* Highlight toggle */}
                  <div className="flex items-center gap-3">
                    <span className={`text-gray-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>غیرفعال</span>
                    <motion.button
                      onClick={() => setHighlightMode(!highlightMode)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                        highlightMode ? 'bg-purple-600' : 'bg-gray-600'
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg"
                        animate={{ x: highlightMode ? 24 : 2 }}
                        transition={{
                          type: 'spring',
                          damping: 20,
                          stiffness: 300
                        }}
                      />
                    </motion.button>
                    <span className={`text-gray-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>فعال</span>
                  </div>

                  {/* Highlight controls */}
                  <AnimatePresence>
                    {highlightMode && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          height: 0
                        }}
                        animate={{
                          opacity: 1,
                          height: 'auto'
                        }}
                        exit={{
                          opacity: 0,
                          height: 0
                        }}
                        className="w-full flex flex-col items-center gap-3"
                      >
                        {/* Highlight color palette - Compact */}
                        <div className="w-full">
                          <div className={`grid ${isMobile ? 'grid-cols-8' : 'grid-cols-8'} gap-1 justify-center max-w-lg mx-auto`}>
                            {HIGHLIGHT_COLORS.map((colorObj, index) => (
                              <motion.div
                                key={index}
                                whileHover={{
                                  scale: 1.1,
                                  y: -2
                                }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSelectedHighlightColor(colorObj)}
                                className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-full cursor-pointer shadow-lg transition-all duration-200 relative ${
                                  selectedHighlightColor.color === colorObj.color
                                    ? 'ring-2 ring-yellow-400 scale-110 shadow-yellow-400/50'
                                    : 'ring-1 ring-gray-600 hover:ring-yellow-300'
                                }`}
                                style={{ backgroundColor: colorObj.color }}
                                title={`Highlight: ${colorObj.color} (${Math.round(colorObj.opacity * 100)}% opacity)`}
                              >
                                {/* Opacity indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center border border-gray-600">
                                  {Math.round(colorObj.opacity * 10)}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Highlight intensity slider - Compact */}
                        <div className="w-full max-w-sm">
                          <label className={`block text-gray-300 mb-1 text-right ${isMobile ? 'text-xs' : 'text-sm'}`}>شدت هایلایت: {Math.round(highlightIntensity * 100)}%</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={highlightIntensity}
                            onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${highlightIntensity * 100}%, #374151 ${highlightIntensity * 100}%, #374151 100%)`
                            }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Compact tips section */}
              <div className={`text-center text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} mt-1`}>
                <div className="flex items-center justify-center gap-2">
                  <span>
                    تصویر و ویدیو شما به هیچ عنوان توسط ما ذخیره نمیشود
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`${isMobile ? 'hidden' : 'block'} mt-4 md:mt-6 text-gray-500 text-xs md:text-sm text-center pb-4`}
      >
        <p className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          تصویر و ویدیو شما به هیچ عنوان توسط ما ذخیره نمیشود
        </p>
      </motion.footer>

      {/* Custom CSS for sliders */}
      <style jsx>{`
          .slider::-webkit-slider-thumb {
              appearance: none;
              height: 20px;
              width: 20px;
              border-radius: 50%;
              background: linear-gradient(135deg, #8B5CF6, #EC4899);
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
              border: 2px solid white;
          }

          .slider::-moz-range-thumb {
              height: 20px;
              width: 20px;
              border-radius: 50%;
              background: linear-gradient(135deg, #8B5CF6, #EC4899);
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
              border: 2px solid white;
          }
      `}</style>
    </div>
  );
}