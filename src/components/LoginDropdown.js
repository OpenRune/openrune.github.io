import React, { useState } from "react";
import {
  CButton,
  CFormInput,
  CDropdownMenu,
  CForm,
  CDropdownDivider,
  CDropdownToggle,
  CDropdown,
  CDropdownHeader,
  CInputGroupText,
  CInputGroup,
  CSpinner,
  CTooltip,
  CDropdownItem,
  CNavItem,
  CNavLink,
  CNav,
  CTabPane,
  CTabContent,
} from "@coreui/react";
import { cilLockLocked, cilUser, cilEnvelopeOpen, cilXCircle, cilCheckCircle, cilUserFollow } from "@coreui/icons";
import CIcon from "@coreui/icons-react";
import { useAlert } from "src/components/AlertProviderWithDisplay";
import { loginUser, registerUser } from "src/api/apiService";

// LoginPanel Component
const LoginPanel = ({ onLogin, email, setEmail, password, setPassword, loading, errorMessage }) => (
  <CTabPane visible>
    <div style={{ padding: "10px" }}>
      <CForm onSubmit={onLogin}>
        <CInputGroup className="mb-3">
          <CInputGroupText>
            <CIcon icon={cilUser} />
          </CInputGroupText>
          <CFormInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </CInputGroup>

        <CInputGroup className="mb-4">
          <CInputGroupText>
            <CIcon icon={cilLockLocked} />
          </CInputGroupText>
          <CFormInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </CInputGroup>

        {loading ? (
          <div className="d-flex justify-content-center mb-3">
            <CSpinner color="primary" />
          </div>
        ) : (
          <CButton color="primary" type="submit" className="w-100" disabled={!email || !password}>
            Sign in
          </CButton>
        )}
      </CForm>

      {errorMessage && <div className="text-danger text-center mt-3">{errorMessage}</div>}

      <CDropdownDivider />
      <div className="text-center">
        <CDropdownItem href="#">Forgot password?</CDropdownItem>
      </div>
    </div>
  </CTabPane>
);

// RegisterPanel Component
const RegisterPanel = ({
                         onRegister,
                         username,
                         setUsername,
                         email,
                         setEmail,
                         password,
                         handlePasswordChange,
                         passwordStrength,
                         getPasswordStrengthColor,
                         loading,
                       }) => (
  <CTabPane visible>
    <div style={{ padding: "10px" }}>
      <CForm onSubmit={onRegister}>
        <CInputGroup className="mb-3">
          <CInputGroupText>
            <CIcon icon={cilUserFollow} />
          </CInputGroupText>
          <CFormInput
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </CInputGroup>

        <CInputGroup className="mb-3">
          <CInputGroupText>
            <CIcon icon={cilEnvelopeOpen} />
          </CInputGroupText>
          <CFormInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </CInputGroup>

        <CInputGroup className="mb-4">
          <CInputGroupText>
            <CIcon icon={cilLockLocked} />
          </CInputGroupText>
          <CFormInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={handlePasswordChange}
            required
          />
          <CTooltip
            content="Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, and one number."
            placement="top"
          >
            <CInputGroupText style={{ cursor: "pointer" }}>
              <CIcon
                icon={passwordStrength === "strong" ? cilCheckCircle : cilXCircle}
                style={{ color: getPasswordStrengthColor() }}
              />
            </CInputGroupText>
          </CTooltip>
        </CInputGroup>

        {loading ? (
          <div className="d-flex justify-content-center mb-3">
            <CSpinner color="primary" />
          </div>
        ) : (
          <CButton color="primary" type="submit" className="w-100" disabled={!username || !email || !password}>
            Register
          </CButton>
        )}
      </CForm>
    </div>
  </CTabPane>
);

// Main Component (LoginDropdown)
const LoginDropdown = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState("login"); // Control active tab
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(""); // 'weak', 'medium', 'strong'
  const { addAlert } = useAlert();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await loginUser(email, password);
      addAlert(response.data.message || "Login successful!", "success");
      localStorage.setItem("token", response.data.token);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setPassword(password);
    validatePassword(password);
  };

  const validatePassword = (password) => {
    const strongPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    const mediumPattern = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    if (strongPattern.test(password)) {
      setPasswordStrength("strong");
    } else if (mediumPattern.test(password)) {
      setPasswordStrength("medium");
    } else {
      setPasswordStrength("weak");
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case "strong":
        return "green";
      case "medium":
        return "yellow";
      case "weak":
      default:
        return "red";
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerUser(username, email, password);
      addAlert("Account created successfully", "success");
      setLoading(false);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <CDropdown autoClose="outside" variant="nav-item">
      <CDropdownToggle caret={false}>
        <CIcon icon={cilUser} size="lg" />
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" style={{ width: "300px" }}>
        <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">Account</CDropdownHeader>
        <CNav variant="underline-border" role="tablist">
          <CNavItem>
            <CNavLink active={activeTab === "login"} onClick={() => setActiveTab("login")}>
              <CIcon icon={cilUser} /> Login
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === "register"} onClick={() => setActiveTab("register")}>
              <CIcon icon={cilUserFollow} /> Register
            </CNavLink>
          </CNavItem>
        </CNav>
        <CTabContent>
          {activeTab === "login" && (
            <LoginPanel
              onLogin={handleLoginSubmit}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              loading={loading}
              errorMessage={errorMessage}
            />
          )}
          {activeTab === "register" && (
            <RegisterPanel
              onRegister={handleRegisterSubmit}
              username={username}
              setUsername={setUsername}
              email={email}
              setEmail={setEmail}
              password={password}
              handlePasswordChange={handlePasswordChange}
              passwordStrength={passwordStrength}
              getPasswordStrengthColor={getPasswordStrengthColor}
              loading={loading}
            />
          )}
        </CTabContent>
      </CDropdownMenu>
    </CDropdown>
  );
};
export default LoginDropdown;
