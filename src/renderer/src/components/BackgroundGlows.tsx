import React, { useEffect, useState } from 'react';

export default function BackgroundGlows() {
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('iris_primary_color') || '#9333ea');
  const [secondaryColor, setSecondaryColor] = useState(localStorage.getItem('iris_secondary_color') || '#06b6d4');

  useEffect(() => {
    const handleColorChange = () => {
      setPrimaryColor(localStorage.getItem('iris_primary_color') || '#9333ea');
      setSecondaryColor(localStorage.getItem('iris_secondary_color') || '#06b6d4');
    };
    window.addEventListener('iris_color_changed', handleColorChange);
    return () => window.removeEventListener('iris_color_changed', handleColorChange);
  }, []);

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16) || 147;
    const g = parseInt(hex.slice(3, 5), 16) || 51;
    const b = parseInt(hex.slice(5, 7), 16) || 234;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <>
      <div className="absolute inset-0 z-0 bg-layer"></div>
      
      {/* Ambient Background Glows using Custom Hex Colors */}
      <div 
        className="pointer-events-none absolute -left-40 top-[-20%] h-[600px] w-[600px] rounded-full blur-[130px] transition-colors duration-1000 z-0" 
        style={{ backgroundColor: hexToRgba(primaryColor, 0.4) }} 
      />
      <div 
        className="pointer-events-none absolute right-[-10%] top-[20%] h-[600px] w-[600px] rounded-full blur-[120px] transition-colors duration-1000 z-0" 
        style={{ backgroundColor: hexToRgba(secondaryColor, 0.4) }} 
      />
      <div 
        className="pointer-events-none absolute bottom-[-20%] left-[20%] h-[500px] w-[500px] rounded-full blur-[110px] transition-colors duration-1000 z-0" 
        style={{ backgroundColor: hexToRgba(primaryColor, 0.3) }} 
      />
    </>
  );
}
