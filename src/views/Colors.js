import React, { useState, useRef, useEffect } from 'react';
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormLabel,
} from '@coreui/react';
import JagexColorPicker from 'src/components/ColorPicker';
import {
  convertHexToJagexHSL,
  convertJagexHSLToHex, convertJagexHSLToHSL, convertJagexHSLToRGB, getJagexHSLComponents,
} from 'src/api/ColorUtils';

const Colors = () => {
  const [hslValue, setJgexHslValue] = useState(0);
  const [rgbValue, setHexValue] = useState('#ffffff');
  const colorPickerRef = useRef(null);

  const handleColorChange = (value, source = 'hsl') => {
    if (source === 'hsl') {
      setJgexHslValue(value);
      const hexColor = convertJagexHSLToHex(value);
      setHexValue(hexColor);
    } else if (source === 'hex') {
      setHexValue(value);
      const packedHsl = convertHexToJagexHSL(value);
      setJgexHslValue(packedHsl);
    }


    if (colorPickerRef.current) {
      colorPickerRef.current.handleHSLInputChange(source === 'hsl' ? value : convertHexToJagexHSL(value));
    }
  };

  useEffect(() => {
    if (colorPickerRef.current) {
      const color = colorPickerRef.current.getPackedColor() || 0;
      handleColorChange(color, 'hsl');
    }
  }, [colorPickerRef]);

  return (
    <CRow className="colors-container">
      <CCol md={3}>
        <CCard className="vertical-card mb-4">
          <CCardHeader>Color Settings</CCardHeader>
          <CCardBody>
            <CFormLabel htmlFor="jagexHSL">Jagex HSL</CFormLabel>
            <CFormInput
              type="number"
              id="jagexHSL"
              value={hslValue}
              onChange={(e) => handleColorChange(e.target.value, 'hsl')}
              placeholder="Enter Jagex HSL (0-65535)"
              min={0}
              max={65535}
              className="mb-3"
            />

            <CFormLabel htmlFor="rgbPicker">RGB Color Picker</CFormLabel>
            <CFormInput
              type="color"
              id="rgbPicker"
              value={rgbValue}
              onChange={(e) => handleColorChange(e.target.value, 'hex')}
            />
            <div className="mt-3">
              {colorPickerRef.current && (
                <>
                  <p className="mb-2">
                    <strong>Normal Hex:</strong> {convertJagexHSLToHex(colorPickerRef.current.getPackedColor() || 0)}
                  </p>
                  <p className="mb-2">
                    <strong>Normal RGB:</strong>
                    {colorPickerRef.current && (() => {
                      const {r, g, b} = convertJagexHSLToRGB(colorPickerRef.current.getPackedColor() || 0);
                      return ` rgb(${r}, ${g}, ${b})`;
                    })()}
                  </p>
                  <p className="mb-2">
                    <strong>Normal HSL:</strong>
                    {colorPickerRef.current && (() => {
                      const {h, s, l} = convertJagexHSLToHSL(colorPickerRef.current.getPackedColor() || 0);
                      return ` hsl(${h}, ${s}%, ${l}%)`;
                    })()}
                  </p>
                  <p className="mb-2">
                    <strong>Jagex HSL:</strong> {colorPickerRef.current.getPackedColor() || 0}
                  </p>
                  <p className="mb-2">
                    <strong>Jagex HSL (h,s,l):</strong>
                    {colorPickerRef.current && (() => {
                      const {h, s, l} = getJagexHSLComponents(colorPickerRef.current.getPackedColor() || 0);
                      return ` hsl(${h}, ${s}%, ${l}%)`;
                    })()}
                  </p>
                </>
              )}
            </div>
          </CCardBody>
        </CCard>


        <CCard className="vertical-card mb-4">
          <CCardHeader className="bg-primary text-white d-flex align-items-center justify-content-between">
            <h6 className="mb-0 fw-normal">Color Details</h6>
            <span className="badge bg-light text-primary">Info</span>
          </CCardHeader>
          <CCardBody>
            <p className="text-muted mb-3">
              Jagex uses a 16-bit HSL color format within their engine, limiting them to 65,535 distinct colors.
            </p>
            <p className="text-muted mb-3">
              RGB color pickers allow for 16.7 million colors. The color you select may not exist within the 16-bit palette and will need to be approximated, which can lead to slightly different results.
            </p>
            <p className="text-muted mb-0">
              This tool generates a color palette using Jagex's 16-bit HSL format: 6 bits for hue, 3 bits for saturation, and 7 bits for lightness, all combined and represented as a short.
            </p>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol md={9}>
        <CRow>
          <CCol>
            <CCard className="color-picker-card">
              <CCardHeader>Color Picker</CCardHeader>
              <CCardBody className="d-flex justify-content-center align-items-center">
                <JagexColorPicker ref={colorPickerRef} width={500} onChange={(packedHSLJagex) => {
                  handleColorChange(packedHSLJagex);
                }} />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CCol>
    </CRow>
  );
};

export default Colors;
