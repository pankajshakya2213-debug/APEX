import React, { useState, useRef, useEffect } from 'react';

// HSV to RGB conversion
function hsvToRgb(h: number, s: number, v: number) {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex: string) {
  // Convert hex to RGB first
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
}

interface ColorWheelProps {
  color: string;
  onChange: (hex: string) => void;
  size?: number;
}

export default function ColorWheel({ color, onChange, size = 150 }: ColorWheelProps) {
  const [hsv, setHsv] = useState(hexToHsv(color));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  // Sync state if color prop changes externally
  useEffect(() => {
    setHsv(hexToHsv(color));
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const radius = size / 2;
    const centerX = size / 2;
    const centerY = size / 2;
    
    ctx.clearRect(0, 0, size, size);
    
    // Draw wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1.5) * Math.PI / 180;
      const endAngle = (angle + 1.5) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }
    
    // Draw white gradient over it for saturation
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

  }, [size]);

  // Update outer state when dragging changes HSV
  const updateColorFromMouseEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return;
    }
    
    let x = clientX - rect.left - size / 2;
    let y = clientY - rect.top - size / 2;
    
    const radius = size / 2;
    let distance = Math.sqrt(x * x + y * y);
    
    // Constrain to circle
    if (distance > radius) {
      x = x * (radius / distance);
      y = y * (radius / distance);
      distance = radius;
    }
    
    // Calculate Hue
    let theta = Math.atan2(y, x);
    if (theta < 0) theta += Math.PI * 2;
    const h = theta / (Math.PI * 2);
    
    // Calculate Saturation
    const s = distance / radius;
    
    const newHsv = { h, s, v: hsv.v }; // Keep current lightness
    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    onChange(rgbToHex(rgb[0], rgb[1], rgb[2]));
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    const newHsv = { ...hsv, v };
    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    onChange(rgbToHex(rgb[0], rgb[1], rgb[2]));
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    updateColorFromMouseEvent(e);
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging.current) {
        updateColorFromMouseEvent(e);
      }
    };
    const handlePointerUp = () => {
      isDragging.current = false;
    };
    
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, []);

  // Calculate thumb position
  const angle = hsv.h * Math.PI * 2;
  const distance = hsv.s * (size / 2);
  const thumbX = size / 2 + distance * Math.cos(angle);
  const thumbY = size / 2 + distance * Math.sin(angle);

  // Full brightness color for the slider gradient
  const fullRgb = hsvToRgb(hsv.h, hsv.s, 1);
  const fullHex = rgbToHex(fullRgb[0], fullRgb[1], fullRgb[2]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-[200px] mx-auto items-center">
      <div style={{ position: 'relative', width: size, height: size }} className="mx-auto select-none">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ borderRadius: '50%', cursor: 'crosshair', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        />
        <div 
          style={{
            position: 'absolute',
            left: thumbX - 10,
            top: thumbY - 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '3px solid white',
            backgroundColor: fullHex,
            boxShadow: '0 0 10px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
            transition: 'background-color 0.1s'
          }}
        />
      </div>

      <div className="w-full flex flex-col gap-1 px-2">
        <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          <span>Dark</span>
          <span>Bright</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={hsv.v} 
          onChange={handleBrightnessChange}
          className="w-full h-3 rounded-full appearance-none outline-none cursor-pointer border border-white/20 shadow-inner"
          style={{
            background: `linear-gradient(to right, #000000, ${fullHex})`
          }}
        />
      </div>
    </div>
  );
}
