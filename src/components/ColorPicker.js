import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { CCard, CCardBody } from '@coreui/react';
import {
  convertHSLToHex as convertJagexHSLToHex,
  packJagexHSL as packHSL,
  unpackJagexHSL as unpackHSL
} from 'src/api/ColorUtils';


const ColorPicker = forwardRef(({ width = 300, defaultColor = 32191, onChange }, ref) => {
  const initialHSL = unpackHSL(defaultColor);

  const [hue, setHue] = useState(initialHSL.hue);
  const [saturation, setSaturation] = useState(initialHSL.saturation);
  const [lightness, setLightness] = useState(initialHSL.lightness);
  const [selectedColor, setSelectedColor] = useState(convertJagexHSLToHex(initialHSL.hue, initialHSL.saturation, initialHSL.lightness));
  const [selectedColorString, setSelectedColorString] = useState(defaultColor);

  const handleHSLInputChange = (newHSLValue) => {
    const unpackedHSL = unpackHSL(newHSLValue);

    setHue(unpackedHSL.hue);
    setSaturation(unpackedHSL.saturation);
    setLightness(unpackedHSL.lightness);

    setSelectedColorString(newHSLValue);

    const hexColor = convertJagexHSLToHex(unpackedHSL.hue, unpackedHSL.saturation, unpackedHSL.lightness);
    setSelectedColor(hexColor);
  };

  useEffect(() => {
    // Calculate the current hex color and packed HSL value
    const hexColor = convertJagexHSLToHex(hue, saturation, lightness);
    const packedHSLJagex = packHSL(hue, saturation, lightness);

    setSelectedColor(hexColor);
    setSelectedColorString(packedHSLJagex);

    if (onChange) {
      onChange(packedHSLJagex);
    }
  }, [hue, saturation, lightness, onChange]);

  useImperativeHandle(ref, () => ({
    getPackedColor: () => selectedColorString,
    handleHSLInputChange: (newHSL) => {
      handleHSLInputChange(newHSL);
    }
  }));

  return (
    <CCard style={{ maxWidth: width }}>
      <CCardBody>
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              backgroundColor: selectedColor,
              height: '100px',
              width: '100%',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <p
              style={{
                color: lightness > 35 ? '#282c34' : '#ffffff',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}
            >
              {selectedColorString}
            </p>
          </div>

          {/* Unified Slider Section */}
          <div className="w-full">
            <label className="block text-sm font-medium mt-4 mb-1">Hue</label>
            <ColorSlider
              width={width - 40}
              max={63}
              value={hue}
              onChange={setHue}
              gradientStops={Array.from({ length: 64 }, (_, i) => `hsl(${i * (360 / 63)}, 100%, 50%)`)}
            />

            <label className="block text-sm font-medium mt-4 mb-1">Saturation</label>
            <ColorSlider
              width={width - 40}
              max={7}
              value={saturation}
              onChange={setSaturation}
              gradientStops={Array.from({ length: 8 }, (_, i) => `hsl(${hue * (360 / 63)}, ${i * (100 / 7)}%, 50%)`)}
            />

            <label className="block text-sm font-medium mt-4 mb-1">Lightness</label>
            <ColorSlider
              width={width - 40}
              max={127}
              value={lightness}
              onChange={setLightness}
              gradientStops={Array.from({ length: 128 }, (_, i) => `hsl(${hue * (360 / 63)}, 50%, ${i * (100 / 127)}%)`)}
            />
          </div>
        </div>
      </CCardBody>
    </CCard>
  );
});

// Unified ColorSlider component
const ColorSlider = ({ width, max, value, onChange, gradientStops }) => {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${gradientStops.join(', ')})`
  };

  return (
    <input
      type="range"
      min="0"
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: `${width}px`, ...gradientStyle }}
      className="range-slider"
    />
  );
};

export default ColorPicker;

// Inline CSS for range sliders
const style = document.createElement('style');
style.innerHTML = `
  .range-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    border-radius: 8px;
  }

  .range-slider::-webkit-slider-runnable-track {
    background-size: 100%;
    height: 100%;
    border-radius: 8px;
    border: none;
  }

  .range-slider::-moz-range-track {
    background-size: 100%;
    height: 100%;
    border-radius: 8px;
    border: none;
  }

  .range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: white;
    border: 2px solid #ccc;
  }

  .range-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: white;
    border: 2px solid #ccc;
  }
`;
document.head.appendChild(style);
