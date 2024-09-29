import React, { useState, useEffect } from 'react';
import {
  CSmartTable,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CSpinner,
  CCard,
  CCardBody,
  CCardHeader,
} from '@coreui/react-pro';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FilterTable = ({
                       pageTitle = 'Items',
                       perPage = 30,
                       tableData = [],
                       customFilters = null, // Custom filter content
                       columns = [],
                       scopedColumns = {}, // Custom scoped column handlers
                       fetchData = () => {},
                       handleRowClick = () => {}, // Custom row click handler
                       loading = false,
                       filtersVisibleDefault = true,
                       CModalContent = null, // Custom modal body content
                       handleDownloadItemIcon = null, // Custom download handler
                     }) => {
  const [itemsPerPage, setItemsPerPage] = useState(perPage);
  const [filteredData, setFilteredData] = useState([]);
  const [visible, setVisible] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [filtersVisible, setFiltersVisible] = useState(filtersVisibleDefault);

  // Update filteredData whenever tableData changes
  useEffect(() => {
    setFilteredData(tableData);
  }, [tableData]);

  useEffect(() => {
    fetchData();
  }, []);

  const onRowClick = (item) => {
    setSelectedData(item);
    setVisible(true);
    if (handleRowClick) {
      handleRowClick(item);
    }
  };

  return (
    <>
      {loading ? (
        <CSpinner color="primary" />
      ) : (
        <>
          <CCard className="vertical-card mb-4">
            <CCardHeader className="bg-primary text-white d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-normal">{pageTitle}: {filteredData.length}</h6>
              <span
                className="badge bg-light text-primary"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                Filter Options{' '}
                {filtersVisible ? (
                  <FaChevronUp style={{ marginLeft: '8px' }} />
                ) : (
                  <FaChevronDown style={{ marginLeft: '8px' }} />
                )}
              </span>
            </CCardHeader>

            {filtersVisible && customFilters && (
              <CCardBody>{customFilters}</CCardBody>
            )}
          </CCard>

          <CSmartTable
            items={filteredData}
            columnFilter
            columnSorter
            itemsPerPageSelect
            itemsPerPage={itemsPerPage}
            pagination
            columns={columns}
            tableProps={{
              striped: true,
              hover: true,
              responsive: true,
            }}
            scopedColumns={scopedColumns}
          />

          {selectedData && (
            <CModal alignment="center" visible={visible} onClose={() => setVisible(false)}>
              <CModalHeader>
                <CModalTitle>Item Details</CModalTitle>
              </CModalHeader>
              <CModalBody>
                {CModalContent ? (
                  <CModalContent item={selectedData} />
                ) : (
                  <p>No content provided</p>
                )}
              </CModalBody>
              <CModalFooter>
                {handleDownloadItemIcon && (
                  <CButton color="primary" onClick={() => handleDownloadItemIcon(selectedData)}>
                    Download Icon
                  </CButton>
                )}
                <CButton color="secondary" onClick={() => setVisible(false)}>
                  Close
                </CButton>
              </CModalFooter>
            </CModal>
          )}
        </>
      )}
    </>
  );
};

export default FilterTable;
