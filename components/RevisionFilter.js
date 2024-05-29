import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from 'react-bootstrap';
import { Menubar } from 'primereact/menubar';
import { FaHistory } from 'react-icons/fa';

const CustomMenuItem = ({ label }) => (
    <div className="custom-menu-item">
        <FaHistory style={{ marginRight: '10px' }} />
        <span>{label}</span>
    </div>
);

// eslint-disable-next-line react/display-name
const RevisionFilter = forwardRef(({ dateOptions, selectedDate, handleDateChange, comparison, handleComparisonChange }, ref) => {
    const [selectedComparison, setSelectedComparison] = useState(comparison);
    const [selectedDateFilter, setSelectedDateFilter] = useState(selectedDate);

    useImperativeHandle(ref, () => ({
        applyDateFilter
    }));

    const handleComparisonButtonClick = (value) => {
        const newValue = selectedComparison === value ? '' : value;
        setSelectedComparison(newValue);
        handleComparisonChange(newValue);
    };

    const handleDateFilterChange = (value) => {
        setSelectedDateFilter(value);
        handleDateChange({ target: { value } });
    };

    const dateItems = [
        { label: 'All', value: 'all', icon: selectedDateFilter === 'all' ? 'pi pi-check' : null },
        ...Object.keys(dateOptions)
            .sort((a, b) => b - a)  // Sort keys in descending order
            .map(key => ({
                label: key,
                value: dateOptions[key],
                icon: selectedDateFilter === dateOptions[key] ? 'pi pi-check' : null
            }))
    ];

    const menuItems = [
        {
            label: (
                <CustomMenuItem
                    label="Rev Filter"
                />
            ),
            items: [
                {
                    template: () => (
                        <div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {dateItems.map(item => (
                                    <div key={item.label} onClick={() => handleDateFilterChange(item.value)} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', cursor: 'pointer' }}>
                                        {item.icon && <i className={item.icon} style={{ marginRight: '8px' }} />}
                                        <span>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', width: '100%' }}>
                                <Button
                                    style={{
                                        margin: '0 5px',
                                        flex: 1,
                                        backgroundColor: selectedComparison === '=' ? 'blue' : '',
                                        color: selectedComparison === '=' ? 'white' : ''
                                    }}
                                    onClick={() => handleComparisonButtonClick('=')}
                                >
                                    =
                                </Button>
                                <Button
                                    style={{
                                        margin: '0 5px',
                                        flex: 1,
                                        backgroundColor: selectedComparison === '<=' ? 'blue' : '',
                                        color: selectedComparison === '<=' ? 'white' : ''
                                    }}
                                    onClick={() => handleComparisonButtonClick('<=')}
                                >
                                    &lt;=
                                </Button>
                                <Button
                                    style={{
                                        margin: '0 5px',
                                        flex: 1,
                                        backgroundColor: selectedComparison === '>=' ? 'blue' : '',
                                        color: selectedComparison === '>=' ? 'white' : ''
                                    }}
                                    onClick={() => handleComparisonButtonClick('>=')}
                                >
                                    &gt;=
                                </Button>
                            </div>
                        </div>
                    )
                }
            ]
        }
    ];

    const applyDateFilter = (a, b) => {
        if (selectedComparison && selectedDateFilter !== 'all' && selectedDateFilter !== null) {
            const dateTolerance = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

            let minDate, maxDate;
            if (Array.isArray(selectedDateFilter) && selectedDateFilter.length === 2) {
                const [startDate, endDate] = selectedDateFilter;
                minDate = new Date(startDate * 1000);
                maxDate = new Date(endDate * 1000);
            } else {
                const date = selectedDateFilter;
                minDate = new Date(date * 1000 - dateTolerance);
                maxDate = new Date(date * 1000 + dateTolerance);
            }

            switch (selectedComparison) {
                case '=':
                    if ((a.releaseDate >= minDate && a.releaseDate <= maxDate) && !(b.releaseDate >= minDate && b.releaseDate <= maxDate)) {
                        return -1;
                    }
                    if (!(a.releaseDate >= minDate && a.releaseDate <= maxDate) && (b.releaseDate >= minDate && b.releaseDate <= maxDate)) {
                        return 1;
                    }
                    if ((a.releaseDate >= minDate && a.releaseDate <= maxDate) && (b.releaseDate >= minDate && b.releaseDate <= maxDate)) {
                        return 0;
                    }
                    return a.releaseDate < minDate ? -1 : 1;
                case '>=':
                    return (a.releaseDate >= minDate ? 0 : -1) - (b.releaseDate >= minDate ? 0 : -1);
                case '<=':
                    return (a.releaseDate <= maxDate ? 0 : -1) - (b.releaseDate <= maxDate ? 0 : -1);
                default:
                    return a.id - b.id;
            }
        }
        return a.id - b.id;
    };

    return (
        <div className="custom-menubar-container">
            <Menubar model={menuItems} className="custom-menubar" />
        </div>
    );
});

export default RevisionFilter;