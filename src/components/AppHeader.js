import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  CContainer,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  useColorModes,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from "@coreui/react";
import {
  cilBell,
  cilList,
  cilEnvelopeOpen,
  cilMenu,
  cilMoon,
  cilContrast,
  cilSun,
} from "@coreui/icons";
import { NavUserDropdown } from './header/index';
import SecureContent from "src/components/SecureComponent";
import LoginDropdown from "src/components/LoginDropdown";
import ServerDropdown from "src/components/ServersDropdown";
import { CIcon } from "@coreui/icons-react";

const AppHeader = ({ removeMargins = false }) => { // Accept removeMargins prop with a default value of false
  const headerRef = useRef();
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme');
  const dispatch = useDispatch();
  const sidebarShow = useSelector((state) => state.sidebarShow);

  useEffect(() => {
    document.addEventListener('scroll', () => {
      headerRef.current &&
      headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0);
    });
  }, []);

  return (
    <CHeader position="sticky" className={`${removeMargins ? 'mb-0 p-0' : 'mb-4 p-0'}`} ref={headerRef}>
      {/* Set margin based on the removeMargins prop */}
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <SecureContent>
          <CHeaderNav className="ms-auto">
            <CNavItem>
              <CNavLink href="#">
                <CIcon icon={cilBell} size="lg" />
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="#">
                <CIcon icon={cilList} size="lg" />
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="#">
                <CIcon icon={cilEnvelopeOpen} size="lg" />
              </CNavLink>
            </CNavItem>
          </CHeaderNav>
        </SecureContent>
        <CHeaderNav>
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false}>
              {colorMode === 'dark' ? (
                <CIcon icon={cilMoon} size="lg" />
              ) : colorMode === 'auto' ? (
                <CIcon icon={cilContrast} size="lg" />
              ) : (
                <CIcon icon={cilSun} size="lg" />
              )}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem
                active={colorMode === 'light'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('light')}
              >
                <CIcon className="me-2" icon={cilSun} size="lg" /> Light
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'dark'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('dark')}
              >
                <CIcon className="me-2" icon={cilMoon} size="lg" /> Dark
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'auto'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('auto')}
              >
                <CIcon className="me-2" icon={cilContrast} size="lg" /> Auto
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <SecureContent fallback={
            <>
              <LoginDropdown />
              <li className="nav-item py-1">
                <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
              </li>
              <ServerDropdown />
            </>
          }>
            <NavUserDropdown />
          </SecureContent>
        </CHeaderNav>
      </CContainer>
    </CHeader>
  );
};

export default AppHeader;
