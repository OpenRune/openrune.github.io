import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'react-bootstrap';
import RevisionFilter from './RevisionFilter'; // Adjust the import path as necessary

const Header = ({ dateOptions, resetFilters, searchText, onSearchChange, buyMenuItemsRef, showNoted, onShowNotedChange, selectedDate, handleDateChange, comparison, handleComparisonChange }) => {
    return (
        <div className="flex" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div className="flex align-items-center double-line">
                <div className="flex row1">
                    <span className="p-input-icon-left" style={{ marginLeft: "10px" }}>
                        <i className="pi pi-search" />
                        <InputText
                            value={searchText}
                            onChange={onSearchChange}
                            placeholder="Item Search"
                        />
                    </span>
                    <span className="custom-checkbox" style={{ marginLeft: "10px", display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="notedCheckbox"
                            checked={showNoted}
                            onChange={onShowNotedChange}
                        />
                        <label htmlFor="notedCheckbox" className="p-checkbox-label" style={{ marginLeft: "5px", fontSize: '16px' }}>
                            Show Noted Items
                        </label>
                    </span>
                    <span className="flexcenter" style={{ marginLeft: "10px" }}>
                        <RevisionFilter
                            dateOptions={dateOptions}
                            selectedDate={selectedDate}
                            handleDateChange={handleDateChange}
                            comparison={comparison}
                            handleComparisonChange={handleComparisonChange}
                        />
                    </span>
                    <Button style={{ marginLeft: "10px" }} onClick={resetFilters}>
                        Reset Filters
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Header;