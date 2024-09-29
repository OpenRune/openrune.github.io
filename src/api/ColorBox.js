import React from 'react';
import { CTooltip } from '@coreui/react';
import {convertHSLToHex, unpackJagexHSL} from './colorUtils'; // Assuming the utility functions are in colorUtils.js

const ColorBox = ({
                    width = 100,
                    height = 100,
                    packedHsl = 0,
                    tooltip = false,
                    showHex = false // New prop to display hex code inside the box
                  }) => {
  // Unpack the HSL values from the packed HSL input
  const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);

  // Convert the unpacked HSL to CSS-compatible HSL color and Hex color
  const hslColor = convertHSLToHex(hue, saturation, lightness);

  const boxStyle = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: hslColor, // Set the background color using the CSS HSL color
    border: '1px solid #000',
    display: 'flex', // Use flexbox to center text
    alignItems: 'center', // Vertically center the text
    justifyContent: 'center', // Horizontally center the text
    position: 'relative',
    fontSize: '12px', // Font size for the hex code
    color: '#fff', // White text color for hex code (assuming dark backgrounds)
    textShadow: '1px 1px 2px rgba(0,0,0,0.5)', // Add text shadow for better readability
    fontFamily: 'monospace', // Monospace font for hex code
  };

  // Create tooltip content displaying both HSL and Hex values
  const tooltipContent = `
    HSL: (${hue}, ${saturation}%, ${lightness}%)
    HEX: ${hslColor}
    Jagex HSL: ${packedHsl}
  `.trim();

  return (
    <>
      {tooltip ? (
        <CTooltip content={tooltipContent} placement="top">
          <div style={boxStyle}>
            {showHex && hslColor} {/* Display the hex code in the box if showHex is true */}
          </div>
        </CTooltip>
      ) : (
        <div style={boxStyle}>
          {showHex && hslColor} {/* Display the hex code in the box if showHex is true */}
        </div>
      )}
    </>
  );
};

export default ColorBox;
