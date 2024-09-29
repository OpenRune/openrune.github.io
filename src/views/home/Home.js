import React from 'react'

import {
  CCard,
  CCardBody,
  CCol,
  CRow, CWidgetStatsC
} from "@coreui/react";
import { cilChartPie } from "@coreui/icons";
import CIcon from "@coreui/icons-react";


const Home = () => {


  return (
    <>
      <CRow>
        <CCol xs={3}>
          <CWidgetStatsC
            className="mb-3"
            icon={<CIcon icon={cilChartPie} height={36} />}
            progress={{ color: 'success', value: 100 }}
            text="Widget helper text"
            title="224"
            value="Current Oldschool Rev"
          />
        </CCol>
        <CCol xs={3}>
          <CWidgetStatsC
            className="mb-3"
            icon={<CIcon icon={cilChartPie} height={36} />}
            inverse
            progress={{ value: 75 }}
            text="Widget helper text"
            title="1d 48mins"
            value="Next Oldschool Update"
          />
        </CCol>
        <CCol xs={3}>
          <CWidgetStatsC
            className="mb-3"
            icon={<CIcon icon={cilChartPie} height={36} />}
            inverse
            progress={{ color: 'success', value: 100 }}
            text="Widget helper text"
            title="894"
            value="Current Runescape Rev"
          />
        </CCol>
        <CCol xs={3}>
          <CWidgetStatsC
            className="mb-3"
            icon={<CIcon icon={cilChartPie} height={36} />}
            inverse
            progress={{ value: 75 }}
            text="Widget helper text"
            title="1d 48mins"
            value="Next Runescape Update"
          />
        </CCol>
      </CRow>
      <CCard className="mb-4">
        <CCardBody>
          <CRow>
            <CCol sm={5}>
              <h4 id="traffic" className="card-title mb-0">
                Home
              </h4>
              <div className="small text-body-secondary"></div>
            </CCol>

          </CRow>
          Content Here
        </CCardBody>
      </CCard>
    </>
  )
}

export default Home
