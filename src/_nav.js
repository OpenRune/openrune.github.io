import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilCalculator,
  cilChartPie, cilColorPalette,
  cilCursor,
  cilDescription,
  cilDrop,
  cilHome,
  cilHouse,
  cilNotes,
  cilPencil,
  cilPuzzle, cilSettings,
  cilSpeedometer,
  cilStar
} from "@coreui/icons";
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'
import {cidFileImage, cidImages, cisStorage} from "@coreui/icons-pro";
import { GiBroadsword } from 'react-icons/gi';
import {FaCube, FaMap} from "react-icons/fa"; // Import the sword icon from react-icons



const _nav = [
  {
    component: CNavItem,
    name: 'Home',
    to: '/home',
    icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Map',
    to: '/MapViewer',
    icon: <FaMap className="nav-icon" />, // Use the sword icon here
  },
  {
    component: CNavGroup,
    name: 'Data',
    icon: <CIcon icon={cisStorage} customClassName="nav-icon" />,
    visible: true,  // Set the dropdown to be visible by default
    items: [
      {
        component: CNavItem,
        name: 'Items',
        to: '/Items',
        icon: <GiBroadsword className="nav-icon" />, // Use the sword icon here
      },
      {
        component: CNavItem,
        name: 'Textures',
        to: '/Textures',
        icon: <CIcon icon={cidImages} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Sprites',
        to: '/Sprites',
        icon: <CIcon icon={cidFileImage} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Models',
        to: '/Models',
        icon: <FaCube className="nav-icon" />,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Tools',
    icon: <CIcon icon={cilPencil} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Color Picker',
        to: '/colors',
        icon: <CIcon icon={cilColorPalette} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Inventory Helper',
        to: '/inventoryHelper',
        icon: (
            <span style={{position: 'relative', display: 'inline-block'}}>
              <GiBroadsword
                className="nav-icon"
                style={{
                  left: 0,
                  top: 0,
                  zIndex: 1,
                }}
              />
              <CIcon
                icon={cilSettings}
                customClassName="nav-icon"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  zIndex: 2,
                  opacity: 0.8, // Optional for blending
                  filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))', // Adds a soft shadow
                }}
              />
            </span>
        ),
      }
    ],
  },
]

export default _nav
