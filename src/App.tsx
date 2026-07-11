/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, Home, Calendar, Award, Building, Sparkles, FileText, 
  Activity, User, LogOut, ShieldCheck, KeyRound, Smartphone, Check, HelpCircle,
  RefreshCw, AlertTriangle, Download, Wifi, WifiOff, Menu, ChevronLeft, ChevronRight,
  Eye, EyeOff, Bot, ZoomIn, ZoomOut
} from "lucide-react";
import { Household, Resident, BusinessHousehold, RuralCriteria, DemographicsChange, DemographicsChangeType, User as UserType, UserRole, AllowedEmail } from "./types";

// Import components
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import DeviceSimulator from "./components/DeviceSimulator";
import DashboardView from "./components/DashboardView";
import HouseholdView from "./components/HouseholdView";
import ResidentView from "./components/ResidentView";
import DemographicsChangeView from "./components/DemographicsChangeView";
import SocialSecurityView from "./components/SocialSecurityView";
import BusinessView from "./components/BusinessView";
import NewRuralView from "./components/NewRuralView";
import AICopilotView from "./components/AICopilotView";
import AllowedEmailsView from "./components/AllowedEmailsView";
import AdminPanel from "./components/AdminPanel";
import QuarterDocumentsView from "./components/QuarterDocumentsView";
import { useAuth } from "./context/AuthContext";
import MovableChatbox from "./components/MovableChatbox";
// @ts-ignore
import officialLogo from "./assets/images/logo_phuong_binh_minh_official_1782824466988.png";

export default function App() {
  const { user, login: contextLogin, loginWithRedirect: contextLoginWithRedirect, logout: contextLogout } = useAuth();
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    return null;
  });

  // Login Form States
  const [loginPhone, setLoginPhone] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.SUPER_ADMIN);
  const [loginMethod, setLoginMethod] = useState<"google" | "phone">("google");

  // Registration States
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRole, setRegRole] = useState<UserRole>(UserRole.WARD_LEADER);
  const [regReason, setRegReason] = useState("");
  const [regSuccessMessage, setRegSuccessMessage] = useState("");

  // 2FA & admin routing States
  const [pendingUser2FA, setPendingUser2FA] = useState<UserType | null>(null);
  const [expected2FACode, setExpected2FACode] = useState<string>("");
  const [entered2FACode, setEntered2FACode] = useState<string>("");
  const [showAIChatbox, setShowAIChatbox] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showAIChatbox") !== "false";
    }
    return true;
  });

  useEffect(() => {
    const handleToggle = () => {
      setShowAIChatbox(localStorage.getItem("showAIChatbox") !== "false");
    };
    window.addEventListener("toggle-ai-chatbox", handleToggle);
    return () => window.removeEventListener("toggle-ai-chatbox", handleToggle);
  }, []);

  const handleToggleAIChatbox = () => {
    const newVal = !showAIChatbox;
    localStorage.setItem("showAIChatbox", newVal ? "true" : "false");
    window.dispatchEvent(new Event("toggle-ai-chatbox"));
  };

  const [isAdminPath, setIsAdminPath] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname === "/admin" || window.location.pathname === "/admin/";
    }
    return false;
  });

  // Keep state in sync with URL popstate events (for in-app back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminPath(window.location.pathname === "/admin" || window.location.pathname === "/admin/");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", path);
      setIsAdminPath(path === "/admin" || path === "/admin/");
    }
  };

  // Synchronize Google login session with local currentUser state
  useEffect(() => {
    const checkUserAccess = async () => {
      if (user) {
        const email = user.email || "";
        const displayName = user.displayName || email || "Cán bộ số";
        const lowerEmail = email.toLowerCase();
        const adminEmails = ["bhttq3@gmail.com", "tayninhdoimoi@gmail.com", "nguyentanbinh3005@gmail.com"];

        let assignedRole: UserRole | null = null;
        let isAuthorized = false;

        if (adminEmails.includes(lowerEmail)) {
          assignedRole = UserRole.SUPER_ADMIN;
          isAuthorized = true;
        } else {
          try {
            const res = await fetch("/api/allowed-emails");
            if (res.ok) {
              const allowedList: AllowedEmail[] = await res.json();
              const allowedUser = allowedList.find(a => a.email.toLowerCase() === lowerEmail);
              if (allowedUser) {
                assignedRole = allowedUser.role;
                isAuthorized = true;
              }
            }
          } catch (e) {
            console.error("Failed to check allowed emails", e);
          }
        }

        if (isAuthorized && assignedRole) {
          const potentialUser = {
            id: user.uid,
            username: email || user.uid,
            fullName: displayName,
            role: assignedRole,
            phone: user.phoneNumber || "0900000000"
          };

          setCurrentUser(potentialUser);
          localStorage.setItem("currentUser", JSON.stringify(potentialUser));
          setLoginError("");
        } else {
          setLoginError(`Tài khoản Google ${email} chưa được cấp quyền truy cập. Vui lòng liên hệ Người quản lý (0912.012.114) để được cấp quyền.`);
          // Call server API to log this unauthorized attempt and trigger an email warning
          try {
            fetch("/api/auth/unauthorized-attempt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, displayName })
            }).catch(e => console.warn("Failed to report unauthorized attempt", e));
          } catch (err) {
            console.error("Error calling unauthorized logging", err);
          }
          setCurrentUser(null);
          localStorage.removeItem("currentUser");
          await contextLogout();
        }
      } else {
        // If user logs out of Google context, clean up Google currentUser session
        const saved = localStorage.getItem("currentUser");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // If the parsed user is not a Google user (e.g. Phone/OTP, Demo or Google Bypass), preserve it
            if (parsed.id?.startsWith("demo-") || parsed.id?.startsWith("GOOGLE-bypass-")) {
              setCurrentUser(parsed);
            } else if (parsed.id?.startsWith("GOOGLE-") || parsed.id === "google-uid-placeholder" || parsed.id?.length > 20) {
              setCurrentUser(null);
              localStorage.removeItem("currentUser");
            } else {
              setCurrentUser(parsed);
            }
          } catch {
            setCurrentUser(null);
            localStorage.removeItem("currentUser");
          }
        } else {
          setCurrentUser(null);
        }
      }
    };

    checkUserAccess();
  }, [user]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  }, [currentUser]);
  
  // Data State
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [businesses, setBusinesses] = useState<BusinessHousehold[]>([]);
  const [criteria, setCriteria] = useState<RuralCriteria[]>([]);
  const [changes, setChanges] = useState<DemographicsChange[]>([]);
  const [loading, setLoading] = useState(true);

  // Backup States
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState<boolean>(false);
  const [latestSecurityAlert, setLatestSecurityAlert] = useState<any | null>(null);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Login Form States
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [isRealSMSSent, setIsRealSMSSent] = useState(false);
  const [otpGateway, setOtpGateway] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [loginError, setLoginError] = useState<React.ReactNode>("");

  // Offline & Synchronize state and helpers (Disabled dynamic offline per user request)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueue, setOfflineQueue] = useState<{ id: string; url: string; method: string; body: any; description: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Beautiful Custom Alert state
  const [appAlert, setAppAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Zoom scaling state
  const [zoomScale, setZoomScale] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appZoomScale");
      return saved ? parseInt(saved, 10) : 100;
    }
    return 100;
  });

  const handleZoomIn = () => {
    setZoomScale(prev => {
      const next = Math.min(prev + 10, 155);
      localStorage.setItem("appZoomScale", next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 10, 75);
      localStorage.setItem("appZoomScale", next.toString());
      return next;
    });
  };

  const handleZoomReset = () => {
    setZoomScale(100);
    localStorage.setItem("appZoomScale", "100");
  };

  // Sync state helpers
  const syncOfflineCache = (type: string, data: any) => {
    localStorage.setItem(`off_${type}`, JSON.stringify(data));
  };

  const enqueueOfflineAction = (url: string, method: string, body: any, description: string) => {
    const newItem = {
      id: `QUE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url,
      method,
      body,
      description
    };
    setOfflineQueue(prev => {
      const updated = [...prev, newItem];
      localStorage.setItem("offline_queue", JSON.stringify(updated));
      return updated;
    });
  };

  const triggerSync = async () => {
    const savedQueue = localStorage.getItem("offline_queue");
    if (!savedQueue) return;
    let queue: any[] = [];
    try {
      queue = JSON.parse(savedQueue);
    } catch (e) {
      return;
    }
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    const remainingQueue = [...queue];

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.body ? { "Content-Type": "application/json" } : undefined,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (response.ok) {
          successCount++;
          remainingQueue.shift(); // Remove from processing
          localStorage.setItem("offline_queue", JSON.stringify(remainingQueue));
          setOfflineQueue([...remainingQueue]);
        } else {
          console.warn(`Sync failed for action: ${item.description}`, response.statusText);
          break; // Stop sequencing if offline/error persists
        }
      } catch (err) {
        console.error(`Sync network exception for action: ${item.description}`, err);
        break; // Stop on network issues
      }
    }

    setIsSyncing(false);
    setIsOnline(true);

    if (successCount > 0) {
      await fetchData();
    }
  };

  // Fetch initial data from Express backend with offline fallbacks
  const fetchData = async () => {
    setLoading(true);
    try {
      const [hhRes, resRes, busRes, critRes, changesRes] = await Promise.all([
        fetch("/api/households").then(r => r.json()),
        fetch("/api/residents").then(r => r.json()),
        fetch("/api/businesses").then(r => r.json()),
        fetch("/api/criteria").then(r => r.json()),
        fetch("/api/changes").then(r => r.json()).catch(() => ({ changes: [] }))
      ]);

      const hh = Array.isArray(hhRes) ? hhRes : (hhRes.households || []);
      const rs = Array.isArray(resRes) ? resRes : (resRes.residents || []);
      const bs = Array.isArray(busRes) ? busRes : (busRes.businesses || []);
      const cr = Array.isArray(critRes) ? critRes : (critRes.criteria || []);
      const ch = Array.isArray(changesRes) ? changesRes : (changesRes.changes || []);

      setHouseholds(hh);
      setResidents(rs);
      setBusinesses(bs);
      setCriteria(cr);
      setChanges(ch);

      // Save to localStorage for robust offline capability
      localStorage.setItem("off_households", JSON.stringify(hh));
      localStorage.setItem("off_residents", JSON.stringify(rs));
      localStorage.setItem("off_businesses", JSON.stringify(bs));
      localStorage.setItem("off_criteria", JSON.stringify(cr));
      localStorage.setItem("off_changes", JSON.stringify(ch));

      setIsOnline(true);
    } catch (err) {
      console.warn("Backend API not reachable. Loading from offline cache.", err);
      setIsOnline(false);

      // Load cached offline copies
      const cachedHh = localStorage.getItem("off_households");
      const cachedRes = localStorage.getItem("off_residents");
      const cachedBus = localStorage.getItem("off_businesses");
      const cachedCrit = localStorage.getItem("off_criteria");
      const cachedCh = localStorage.getItem("off_changes");

      if (cachedHh) setHouseholds(JSON.parse(cachedHh));
      if (cachedRes) setResidents(JSON.parse(cachedRes));
      if (cachedBus) setBusinesses(JSON.parse(cachedBus));
      if (cachedCrit) setCriteria(JSON.parse(cachedCrit));
      if (cachedCh) setChanges(JSON.parse(cachedCh));
    } finally {
      setLoading(false);
    }
  };

  const checkSecurityAlerts = async () => {
    if (currentUser && currentUser.role === UserRole.SUPER_ADMIN) {
      try {
        const res = await fetch("/api/logs");
        if (res.ok) {
          const logs = await res.json();
          // Filter logs that are security warnings (like unauthorized access attempts)
          const securityLogs = logs.filter((log: any) => 
            log.action?.includes("CẢNH BÁO") || 
            log.details?.includes("chưa được cấp quyền")
          );
          if (securityLogs && securityLogs.length > 0) {
            setLatestSecurityAlert(securityLogs[0]); // most recent log is at index 0
          } else {
            setLatestSecurityAlert(null);
          }
        }
      } catch (e) {
        console.error("Failed to check security alerts", e);
      }
    } else {
      setLatestSecurityAlert(null);
    }
  };

  useEffect(() => {
    // Read saved queue on startup
    const savedQueue = localStorage.getItem("offline_queue");
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Failed to parse offline queue on startup", e);
      }
    }

    fetchData();
  }, []);

  // Check last backup date on login and every time the user state is loaded (Disabled per user request)
  useEffect(() => {
    if (currentUser) {
      const stored = localStorage.getItem("last_backup_date");
      setLastBackupDate(stored);
      setShowBackupReminder(false);
      checkSecurityAlerts();
    } else {
      setShowBackupReminder(false);
      setLatestSecurityAlert(null);
    }
  }, [currentUser]);

  // Google Login state and trigger using real Firebase Auth
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setLoginError("");
    try {
      await contextLogin();
      setLoginError("");
    } catch (error: any) {
      const errorStr = (error && error.message) ? String(error.message).toLowerCase() : "";
      const errorCode = (error && error.code) ? String(error.code).toLowerCase() : "";

      const isPopupIssue = error && (
        error.code === "auth/popup-closed-by-user" || 
        error.code === "auth/popup-blocked" || 
        errorStr.includes("popup-closed-by-user") || 
        errorStr.includes("popup_closed_by_user") ||
        errorStr.includes("cancelled") ||
        errorStr.includes("closed-by-user") ||
        errorStr.includes("popup-blocked")
      );

      const isRedirectIssue = error && (
        errorStr.includes("redirect_uri_mismatch") || 
        errorStr.includes("uri_mismatch") ||
        errorCode.includes("unauthorized-domain") ||
        errorStr.includes("unauthorized-domain")
      );

      if (isPopupIssue || isRedirectIssue) {
        console.warn('Google login trigger warning (popup issue / redirect mismatch):', error);
        
        let isInsideIframe = false;
        try {
          isInsideIframe = window.self !== window.top;
        } catch (e) {
          isInsideIframe = true;
        }

        const isExplicitConfigIssue = errorCode.includes("unauthorized-domain") || errorStr.includes("unauthorized-domain") || isRedirectIssue;

        if (isExplicitConfigIssue) {
          setLoginError(
            <div className="space-y-2 p-3.5 bg-rose-50/80 border border-rose-250 rounded-xl text-left shadow-xs">
              <p className="font-bold text-rose-800 text-[11px] uppercase tracking-wide flex items-center gap-1">⚠️ Lỗi: Tên miền chưa được cấp phép (Unauthorized Domain)</p>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                Tên miền hiện tại (<code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-rose-600 font-mono text-[9px] break-all">{window.location.hostname}</code>) chưa được thêm vào danh sách <strong className="text-slate-800">Authorized Domains</strong> trong cấu hình Firebase Authentication.
              </p>
              <p className="text-[9.5px] text-slate-500 leading-relaxed pt-1 border-t border-rose-100">
                <strong>Hướng dẫn khắc phục:</strong> Cán bộ cần truy cập <span className="font-semibold text-slate-700">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</span> và nhấp <span className="font-semibold text-slate-700">"Add domain"</span> để thêm tên miền trên (<code className="font-semibold text-slate-700">{window.location.hostname}</code>) vào hệ thống trước khi đăng nhập Google.
              </p>
            </div>
          );
        } else if (isInsideIframe) {
          setLoginError(
            <div className="space-y-2 text-left">
              <p className="font-bold text-rose-800">Cửa sổ đăng nhập (Google Popup) bị chặn hoặc không thể hiển thị trong khung bảo mật (IFrame) của AI Studio.</p>
              <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                Vui lòng mở ứng dụng trực tiếp trong tab mới để đăng nhập bằng tài khoản Google thực tế một cách an toàn:
              </p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-2 block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-[11px] uppercase shadow-md hover:shadow-lg transition-all animate-pulse"
              >
                Mở trong Tab mới ↗
              </a>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-2 text-slate-500 text-[9px] uppercase font-bold">Hoặc thử</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>
              <button
                type="button"
                onClick={handleGoogleLoginRedirect}
                className="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-[10px] uppercase shadow-sm transition-all cursor-pointer text-center"
              >
                Đăng nhập Chuyển hướng (Redirect) 🔄
              </button>
            </div>
          );
        } else {
          setLoginError(
            <div className="space-y-2 p-3.5 bg-amber-50/80 border border-amber-250 rounded-xl text-left shadow-xs">
              <p className="font-bold text-amber-800 text-[11px] uppercase tracking-wide flex items-center gap-1">⚠️ Cửa sổ đăng nhập bị chặn hoặc đóng</p>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                Cửa sổ đăng nhập Google (Popup) đã bị trình duyệt chặn hiển thị hoặc đã bị cán bộ đóng trước khi hoàn tất đăng nhập.
              </p>
              <button
                type="button"
                onClick={handleGoogleLoginRedirect}
                className="mt-2 block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] uppercase shadow-sm transition-all cursor-pointer"
              >
                Đăng nhập bằng Chuyển hướng (Google Redirect) 🔄
              </button>
              <p className="text-[9.5px] text-slate-500 leading-relaxed pt-1 border-t border-amber-200">
                <strong>Cách xử lý khác:</strong> Vui lòng cho phép hiển thị cửa sổ bật lên (popups) cho trang web này trên thanh địa chỉ trình duyệt, hoặc nhấp nút Đăng nhập Chuyển hướng ở trên (không cần mở popup).
              </p>
            </div>
          );
        }
      } else {
        console.error('Google login trigger error:', error);
        setLoginError(`Lỗi Google Auth thực tế: ${error.message || "Vui lòng kiểm tra lại kết nối mạng."}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLoginRedirect = async () => {
    setGoogleLoading(true);
    setLoginError("");
    try {
      await contextLoginWithRedirect();
      setLoginError("");
    } catch (error: any) {
      console.error('Google login redirect error:', error);
      setLoginError(`Lỗi đăng nhập Google Redirect: ${error.message || "Vui lòng kiểm tra lại kết nối mạng."}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoBypass = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "BHTTQ3@gmail.com" })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể đăng nhập bypass.");
      }
      const data = await res.json();
      
      setCurrentUser(data.user);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      setLoginError("");
    } catch (err: any) {
      setLoginError(err.message || "Lỗi đăng nhập.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setRegSuccessMessage("");

    const emailToSubmit = regEmail.trim().toLowerCase();
    const fullNameToSubmit = regFullName.trim();
    const phoneToSubmit = regPhone.trim();

    if (!emailToSubmit || !fullNameToSubmit || !phoneToSubmit) {
      setLoginError("Vui lòng điền đầy đủ các thông tin đăng ký bắt buộc.");
      return;
    }

    if (!phoneToSubmit.match(/^0[0-9]{9}$/)) {
      setLoginError("Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (ví dụ: 0912345678).");
      return;
    }

    try {
      const res = await fetch("/api/pending-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSubmit,
          fullName: fullNameToSubmit,
          phone: phoneToSubmit,
          requestedRole: regRole,
          reason: regReason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể gửi yêu cầu đăng ký.");
      }

      setRegSuccessMessage(`Đăng ký thành công! Yêu cầu của tài khoản ${emailToSubmit} đã được gửi tới Người quản lý để phê duyệt. Vui lòng liên hệ trực tiếp với Người quản lý hoặc đợi cấp quyền trước khi đăng nhập.`);
      
      // Clear fields
      setRegEmail("");
      setRegFullName("");
      setRegPhone("");
      setRegReason("");
    } catch (err: any) {
      setLoginError(err.message || "Có lỗi xảy ra khi đăng ký.");
    }
  };

  // Handle actual phone login with OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.match(/^0[0-9]{9}$/)) {
      setLoginError("Số điện thoại không hợp lệ! Vui lòng nhập định dạng 10 số (ví dụ: 0901234567).");
      return;
    }
    setLoginError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone, role: loginRole })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể gửi OTP.");
      }
      const data = await res.json();
      setSentOtp(data.otp || "");
      setIsRealSMSSent(!!data.isRealSMS);
      setOtpGateway(data.gateway || "");
      setOtpMessage(data.message || "");
      setOtpMode(true);
    } catch (err: any) {
      setLoginError(err.message || "Lỗi kết nối khi gửi OTP.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone, otp: otpCode, role: loginRole })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Mã OTP không chính xác.");
      }
      const data = await res.json();
      
      setCurrentUser(data.user);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      setLoginError("");
      setOtpMode(false);
      setOtpCode("");
    } catch (err: any) {
      setLoginError(err.message || "Lỗi xác thực mã OTP.");
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await contextLogout();
      } catch (e) {
        console.error("Error logging out from Firebase:", e);
      }
    }
    setCurrentUser(null);
    setPendingUser2FA(null);
    setExpected2FACode("");
    setEntered2FACode("");
    setOtpMode(false);
    setOtpCode("");
    setLoginPhone("");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("passed2FA");
  };

  // CRUD API wrappers with backend updates and immediate local state changes
  const addHousehold = async (newHh: Household) => {
    setHouseholds(prev => {
      const updated = [newHh, ...prev];
      syncOfflineCache("households", updated);
      return updated;
    });
    try {
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHh)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/households", "POST", newHh, `Thêm hộ gia đình: ${newHh.ownerName}`);
    }
  };

  const updateHousehold = async (updatedHh: Household, originalId?: string) => {
    const oldId = originalId || updatedHh.id;
    setHouseholds(prev => {
      const updated = prev.map(h => h.id === oldId ? updatedHh : h);
      syncOfflineCache("households", updated);
      return updated;
    });

    if (oldId !== updatedHh.id) {
      setResidents(prev => {
        const updated = prev.map(r => r.householdId === oldId ? { ...r, householdId: updatedHh.id } : r);
        syncOfflineCache("residents", updated);
        return updated;
      });
    }

    try {
      const res = await fetch(`/api/households/${oldId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedHh)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/households/${oldId}`, "PUT", updatedHh, `Cập nhật hộ gia đình: ${updatedHh.ownerName}`);
    }
  };

  const deleteHousehold = async (id: string) => {
    let deletedName = "";
    setHouseholds(prev => {
      const deleted = prev.find(h => h.id === id);
      if (deleted) deletedName = deleted.ownerName;
      const updated = prev.filter(h => h.id !== id);
      syncOfflineCache("households", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/households/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/households/${id}`, "DELETE", null, `Xoá hộ gia đình: ${deletedName || id}`);
    }
  };

  const addResident = async (newRes: Resident) => {
    setResidents(prev => {
      const updated = [newRes, ...prev];
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRes)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/residents", "POST", newRes, `Thêm nhân khẩu: ${newRes.fullName}`);
    }
  };

  const updateResident = async (updatedRes: Resident) => {
    setResidents(prev => {
      const updated = prev.map(r => r.id === updatedRes.id ? updatedRes : r);
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/residents/${updatedRes.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRes)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/residents/${updatedRes.id}`, "PUT", updatedRes, `Cập nhật nhân khẩu: ${updatedRes.fullName}`);
    }
  };

  const deleteResident = async (id: string) => {
    let deletedName = "";
    setResidents(prev => {
      const deleted = prev.find(r => r.id === id);
      if (deleted) deletedName = deleted.fullName;
      const updated = prev.filter(r => r.id !== id);
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/residents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/residents/${id}`, "DELETE", null, `Xoá nhân khẩu: ${deletedName || id}`);
    }
  };

  const addDemographicsChange = async (newChange: Omit<DemographicsChange, "id">) => {
    const changeWithId: DemographicsChange = {
      ...newChange,
      id: `CHG-${Date.now()}`
    };

    setChanges(prev => {
      const updated = [changeWithId, ...prev];
      syncOfflineCache("changes", updated);
      return updated;
    });

    // If change is death, automatically update resident status in state and backend
    if (newChange.type === DemographicsChangeType.DEATH) {
      const targetResident = residents.find(r => r.id === newChange.residentId);
      if (targetResident) {
        const updated = { ...targetResident, occupation: "Đã qua đời" };
        updateResident(updated);
      }
    }

    try {
      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeWithId)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/changes", "POST", changeWithId, `Ghi nhận biến động: ${newChange.residentName} (${newChange.type})`);
    }
  };

  const addBusiness = async (newBus: BusinessHousehold) => {
    setBusinesses(prev => {
      const updated = [newBus, ...prev];
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBus)
      });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/businesses", "POST", newBus, `Thêm hộ kinh doanh: ${newBus.name}`);
    }
  };

  const updateBusiness = async (updatedBus: BusinessHousehold) => {
    setBusinesses(prev => {
      const updated = prev.map(b => b.id === updatedBus.id ? updatedBus : b);
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/businesses/${updatedBus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBus)
      });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/businesses/${updatedBus.id}`, "PUT", updatedBus, `Cập nhật hộ kinh doanh: ${updatedBus.name}`);
    }
  };

  const deleteBusiness = async (id: string) => {
    let deletedName = "";
    setBusinesses(prev => {
      const deleted = prev.find(b => b.id === id);
      if (deleted) deletedName = deleted.name;
      const updated = prev.filter(b => b.id !== id);
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/businesses/${id}`, "DELETE", null, `Xoá hộ kinh doanh: ${deletedName || id}`);
    }
  };

  const updateCriteria = async (updated: RuralCriteria) => {
    setCriteria(prev => {
      let updatedList = [];
      if (prev.some(c => c.id === updated.id)) {
        updatedList = prev.map(c => c.id === updated.id ? updated : c);
      } else {
        updatedList = [updated, ...prev];
      }
      syncOfflineCache("criteria", updatedList);
      return updatedList;
    });

    try {
      const res = await fetch(`/api/criteria/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/criteria/${updated.id}`, "PUT", updated, `Cập nhật tiêu chí: ${updated.name}`);
    }
  };

  const handleGenerateMockData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data/generate-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const result = await response.json();
        await fetchData(); // Refresh state from backend
        setAppAlert({
          isOpen: true,
          title: "Khởi tạo thành công",
          message: `Đã tự động sinh 25 Hộ gia đình mẫu với ${result.residentsCount} Nhân khẩu chi tiết! Dữ liệu đã đồng bộ và sẵn sàng phục vụ thống kê, xuất báo cáo.`,
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi khởi tạo",
          message: `Không thể tạo dữ liệu mẫu: ${err}`,
          type: "error"
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi kết nối máy chủ:", err);
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = async (bypassConfirm = false) => {
    if (!bypassConfirm && !window.confirm("CẢNH BÁO: Hành động này sẽ xoá TOÀN BỘ dữ liệu hộ dân, nhân khẩu, hộ kinh doanh hiện có trong hệ thống để chuẩn bị nhập dữ liệu thực tế. Bạn có chắc chắn muốn tiếp tục?")) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/data/clear-all?user=${encodeURIComponent(currentUser?.fullName || "Hệ thống")}&role=${encodeURIComponent(currentUser?.role || "")}`, {
        method: "POST"
      });
      if (response.ok) {
        // Clear offline local storage cache keys immediately
        localStorage.setItem("off_households", "[]");
        localStorage.setItem("off_residents", "[]");
        localStorage.setItem("off_businesses", "[]");
        localStorage.setItem("off_changes", "[]");
        
        await fetchData(); // Refresh state from backend
        setAppAlert({
          isOpen: true,
          title: "Xoá sạch dữ liệu thành công",
          message: "Toàn bộ dữ liệu mẫu đã được xoá sạch khỏi hệ thống. Bây giờ bạn có thể tiến hành nhập dữ liệu thực tế.",
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi xoá dữ liệu",
          message: err,
          type: "error"
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi kết nối máy chủ để xoá dữ liệu:", err);
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportFullBackup = async () => {
    try {
      // Fetch documents first so we can include them in the Excel workbook
      const documents = await fetch("/api/documents").then(r => r.json()).catch(() => []);

      // 1. Households sheet
      let maxHhPhotoChunks = 1;
      const maxChunkSize = 30000;
      households.forEach((h: any) => {
        const url = h.photoUrl || "";
        const chunksCount = Math.max(1, Math.ceil(url.length / maxChunkSize));
        if (chunksCount > maxHhPhotoChunks) {
          maxHhPhotoChunks = chunksCount;
        }
      });

      const hhHeaders = [
        "STT", "Mã Hộ Gia Đình", "Mã CCCD Chủ Hộ", "Họ Tên Chủ Hộ", "Số ĐT Chủ Hộ", "Địa Chỉ Thường Trú", 
        "Tổ Dân Phố", "Khu Phố", "Ngày Lập Hộ", "Phân Loại Hộ", "Gia Đình Văn Hoá",
        "Gia Đình Chính Sách", "Gia Đình Có Công", "Nước Sạch", "Thu Gom Rác", "Thuế Phi Nông Nghiệp (PNN)", "Hộ Nông Nghiệp", "Vĩ Độ (Lat)", "Kinh Độ (Lng)"
      ];
      hhHeaders.push("Đường Dẫn Ảnh");
      for (let i = 2; i <= maxHhPhotoChunks; i++) {
        hhHeaders.push(`Đường Dẫn Ảnh Phần ${i}`);
      }
      hhHeaders.push("Ghi Chú");

      const hhRows = households.map((h, idx) => {
        const ownerResident = residents.find(r => r.id === h.ownerId);
        const ownerPhone = ownerResident?.phone || "";

        const photoStr = h.photoUrl || "";
        const chunks: string[] = [];
        for (let i = 0; i < photoStr.length; i += maxChunkSize) {
          chunks.push(photoStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxHhPhotoChunks) {
          chunks.push("");
        }

        const rowData = [
          idx + 1,
          h.id,
          `'${h.ownerId}`,
          h.ownerName,
          ownerPhone,
          h.address,
          h.wardId,
          h.quarterId || "",
          h.createdAt,
          h.status,
          h.isCulturalFamily ? "Có" : "Không",
          h.isPolicyFamily ? "Có" : "Không",
          h.isMeritoriousFamily ? "Có" : "Không",
          h.waterSource || "Chưa cập nhật",
          h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký"),
          h.nonAgriTax || "Chưa nộp",
          h.housingType || "Không",
          h.gpsLat || "",
          h.gpsLng || ""
        ];

        rowData.push(...chunks);
        rowData.push(h.notes || "");
        return rowData;
      });

      // 2. Residents sheet
      let maxResPhotoChunks = 1;
      residents.forEach((r: any) => {
        const url = r.photoUrl || "";
        const chunksCount = Math.max(1, Math.ceil(url.length / maxChunkSize));
        if (chunksCount > maxResPhotoChunks) {
          maxResPhotoChunks = chunksCount;
        }
      });

      const resHeaders = [
        "STT", "Mã Hộ Gia Đình", "Họ và Tên", "Quan Hệ Chủ Hộ", "Giới Tính", 
        "Ngày Sinh", "Số CCCD", "Trạng Thái Cư Trú", "Dân Tộc", "Tôn Giáo", 
        "Trình Độ Học Vấn", "Nghề Nghiệp", "Nơi Làm Việc", "Số Điện Thoại", "Mã Số BHYT",
        "Người Cao Tuổi", "Khuyết Tật", "Mang Thai", "Học Sĩ/Sinh Viên", "Loại Học Sinh",
        "Có Việc Làm", "Lĩnh Vực Lao Động", "Trợ Cấp", "Ghi Chú thực địa", "Vĩ Độ GPS", "Kinh Độ GPS"
      ];
      resHeaders.push("Ảnh Thẻ / Thực Địa");
      for (let i = 2; i <= maxResPhotoChunks; i++) {
        resHeaders.push(`Ảnh Thẻ / Thực Địa Phần ${i}`);
      }

      const resRows = residents.map((r, idx) => {
        const photoStr = r.photoUrl || "";
        const chunks: string[] = [];
        for (let i = 0; i < photoStr.length; i += maxChunkSize) {
          chunks.push(photoStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxResPhotoChunks) {
          chunks.push("");
        }

        const rowData = [
          idx + 1,
          r.householdId,
          r.fullName,
          r.relationToOwner,
          r.gender,
          r.birthDate,
          `'${r.id}`,
          r.status,
          r.ethnicity,
          r.religion,
          r.education,
          r.occupation || "N/A",
          r.workplace || "N/A",
          r.phone || "",
          r.insuranceId || "",
          r.isElderly ? "Có" : "Không",
          r.isDisabled ? "Có" : "Không",
          r.isPregnant ? "Có" : "Không",
          r.isStudent ? "Có" : "Không",
          r.studentType || "",
          r.isEmployed ? "Có" : "Không",
          r.laborSector,
          r.subsidyType || "Không",
          r.notes || "",
          r.gpsLat || "",
          r.gpsLng || ""
        ];

        rowData.push(...chunks);
        return rowData;
      });

      // 3. Businesses sheet
      const busHeaders = [
        "STT", "Mã Hộ Kinh Doanh", "Tên Hộ Kinh Doanh", "Họ Tên Chủ Hộ", "CCCD Chủ Hộ", 
        "Ngành Nghề Kinh Doanh", "Mã Số Thuế", "Số Giấy Phép", "Địa Chỉ Kinh Doanh"
      ];
      const busRows = businesses.map((b, idx) => [
        idx + 1,
        b.id,
        b.name,
        b.ownerName,
        `'${b.ownerId}`,
        b.sector,
        b.taxCode,
        b.licenseNumber,
        b.address
      ]);

      // 4. Changes sheet
      const changeHeaders = [
        "STT", "Mã Biến Động", "Mã Nhân Khẩu", "Họ và Tên", "Loại Biến Động", "Ngày Ghi Nhận", "Chi Tiết Biến Động", "Cán Bộ Thực Hiện"
      ];
      const changeRows = changes.map((c, idx) => [
        idx + 1,
        c.id,
        `'${c.residentId}`,
        c.residentName,
        c.type,
        c.date,
        c.details,
        c.recordedBy
      ]);

      // 5. Criteria sheet
      const critHeaders = [
        "STT", "Mã Tiêu Chí", "Tên Tiêu Chí", "Phân Nhóm", "Mục Tiêu", "Hiện Trạng", "Trạng Thái Đạt", "Cập Nhật Cuối"
      ];
      const critRows = criteria.map((cr, idx) => [
        idx + 1,
        cr.id,
        cr.name,
        cr.category,
        cr.targetValue,
        cr.value,
        cr.status,
        cr.lastUpdated
      ]);

      // 6. Documents sheet
      let maxChunks = 1;
      documents.forEach((doc: any) => {
        const attStr = doc.attachments ? JSON.stringify(doc.attachments) : "";
        const chunksCount = Math.max(1, Math.ceil(attStr.length / maxChunkSize));
        if (chunksCount > maxChunks) {
          maxChunks = chunksCount;
        }
      });

      const docHeaders = [
        "STT", "Mã Tài Liệu", "Tiêu Đề", "Số Kí Hiệu", "Ngày Ban Hành", "Nơi Ban Hành", "Chuyên Mục", "Mô Tả", "Dung Lượng", "Định Dạng"
      ];
      docHeaders.push("Tài Liệu Đính Kèm");
      for (let i = 2; i <= maxChunks; i++) {
        docHeaders.push(`Tài Liệu Đính Kèm Phần ${i}`);
      }
      docHeaders.push("Ngày Tạo");

      const docRows = documents.map((doc: any, idx: number) => {
        const attStr = doc.attachments ? JSON.stringify(doc.attachments) : "";
        const rowData = [
          idx + 1,
          doc.id,
          doc.title,
          doc.docNumber || "",
          doc.issueDate,
          doc.issuer,
          doc.category,
          doc.description || "",
          doc.fileSize || "0.0 KB",
          doc.fileType || "Tài liệu đính kèm"
        ];

        // Chunk attachment string into max 30,000 characters per cell
        const chunks: string[] = [];
        for (let i = 0; i < attStr.length; i += maxChunkSize) {
          chunks.push(attStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxChunks) {
          chunks.push("");
        }

        rowData.push(...chunks);
        rowData.push(doc.createdAt || "");
        return rowData;
      });

      // Construct workbook
      const workbook = XLSX.utils.book_new();

      const addSheet = (headersArr: string[], dataRows: any[][], sheetName: string) => {
        const fullData = [headersArr, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(fullData);
        // Auto-fit
        ws["!cols"] = headersArr.map((_, colIdx) => {
          let maxLen = 10;
          fullData.forEach(row => {
            const val = row[colIdx];
            if (val !== undefined && val !== null) {
              const strVal = String(val);
              if (strVal.length > maxLen) maxLen = strVal.length;
            }
          });
          return { wch: Math.min(maxLen + 3, 40) };
        });
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      };

      addSheet(hhHeaders, hhRows, "Ho_Gia_Dinh");
      addSheet(resHeaders, resRows, "Nhan_Khau");
      addSheet(busHeaders, busRows, "Ho_Kinh_Doanh");
      addSheet(changeHeaders, changeRows, "Bien_Dong_Cu_Tru");
      addSheet(critHeaders, critRows, "Tieu_Chi_NTM");
      addSheet(docHeaders, docRows, "Tai_Lieu_Luu_Tru");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Sao_Luu_Toan_Bo_DB_Dan_Cu_${dateStr}.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Record backup date in localStorage
      localStorage.setItem("last_backup_date", now.toISOString());
      setLastBackupDate(now.toISOString());
      setShowBackupReminder(false);
      
      alert(`[SAO LƯU THÀNH CÔNG] Toàn bộ cơ sở dữ liệu (bao gồm cả kho tài liệu số hóa kèm tệp đính kèm) đã được sao lưu và kết xuất ra tập tin Excel: "${filename}".`);
    } catch (error: any) {
      console.error("Backup error:", error);
      alert(`[LỖI SAO LƯU] Không thể tạo file sao lưu: ${error.message}`);
    }
  };

  const handleExportJSONBackup = async () => {
    try {
      const documents = await fetch("/api/documents").then(r => r.json()).catch(() => []);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
        JSON.stringify({ households, residents, businesses, changes, criteria, documents }, null, 2)
      );
      const downloadAnchor = document.createElement("a");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Sao_Luu_Toan_Bo_DB_Dan_Cu_${dateStr}.json`;
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      localStorage.setItem("last_backup_date", now.toISOString());
      setLastBackupDate(now.toISOString());
      setShowBackupReminder(false);

      alert(`[SAO LƯU THÀNH CÔNG] Toàn bộ cơ sở dữ liệu dạng cấu trúc JSON đã được kết xuất thành công ra tệp tin: "${filename}".`);
    } catch (error: any) {
      console.error("JSON Backup error:", error);
      alert(`[LỖI SAO LƯU JSON] Không thể tạo file sao lưu JSON: ${error.message}`);
    }
  };

  const parseXLSXBackup = (workbook: XLSX.WorkBook) => {
    const importedData: any = {};

    const parseSheet = (sheetName: string, mapper: (row: any) => any) => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return [];
      const rows = XLSX.utils.sheet_to_json(ws);
      return rows.map(mapper);
    };

    const cleanVal = (val: any) => {
      if (val === undefined || val === null) return "";
      const str = String(val).trim();
      if (str.startsWith("'")) return str.substring(1);
      return str;
    };

    const parseBool = (val: any) => {
      if (!val) return false;
      const str = String(val).trim().toLowerCase();
      return str === "có" || str === "yes" || str === "true";
    };

    const parseFloatVal = (val: any) => {
      if (val === undefined || val === null || val === "") return undefined;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    // Households
    importedData.households = parseSheet("Ho_Gia_Dinh", (row: any) => {
      let photoUrl = "";
      if (row) {
        if (row["Đường Dẫn Ảnh"]) {
          photoUrl += cleanVal(row["Đường Dẫn Ảnh"]);
        }
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Đường Dẫn Ảnh Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          photoUrl += cleanVal(row[k]);
        });
      }

      return {
        id: cleanVal(row["Mã Hộ Gia Đình"]),
        ownerId: cleanVal(row["Mã CCCD Chủ Hộ"]),
        ownerName: cleanVal(row["Họ Tên Chủ Hộ"]),
        address: cleanVal(row["Địa Chỉ Thường Trú"]),
        wardId: cleanVal(row["Tổ Dân Phố"]),
        quarterId: cleanVal(row["Khu Phố"]),
        createdAt: cleanVal(row["Ngày Lập Hộ"]),
        status: cleanVal(row["Phân Loại Hộ"]),
        isCulturalFamily: parseBool(row["Gia Đình Văn Hoá"]),
        isPolicyFamily: parseBool(row["Gia Đình Chính Sách"]),
        isMeritoriousFamily: parseBool(row["Gia Đình Có Công"]),
        waterSource: cleanVal(row["Nước Sạch"]),
        wasteCollectionStatus: cleanVal(row["Thu Gom Rác"]),
        nonAgriTax: cleanVal(row["Thuế Phi Nông Nghiệp (PNN)"]) || "Chưa nộp",
        housingType: cleanVal(row["Hộ Nông Nghiệp"]) || cleanVal(row["Loại Nhà Ở"]) || "Không",
        gpsLat: parseFloatVal(row["Vĩ Độ (Lat)"]),
        gpsLng: parseFloatVal(row["Kinh Độ (Lng)"]),
        photoUrl,
        notes: cleanVal(row["Ghi Chú"])
      };
    }).filter(h => h.id);

    // Residents
    importedData.residents = parseSheet("Nhan_Khau", (row: any) => {
      let photoUrl = "";
      if (row) {
        if (row["Ảnh Thẻ / Thực Địa"]) {
          photoUrl += cleanVal(row["Ảnh Thẻ / Thực Địa"]);
        }
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Ảnh Thẻ / Thực Địa Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          photoUrl += cleanVal(row[k]);
        });
      }

      return {
        householdId: cleanVal(row["Mã Hộ Gia Đình"]),
        fullName: cleanVal(row["Họ và Tên"]),
        relationToOwner: cleanVal(row["Quan Hệ Chủ Hộ"]),
        gender: cleanVal(row["Giới Tính"]),
        birthDate: cleanVal(row["Ngày Sinh"]),
        id: cleanVal(row["Số CCCD"]),
        status: cleanVal(row["Trạng Thái Cư Trú"]),
        ethnicity: cleanVal(row["Dân Tộc"]),
        religion: cleanVal(row["Tôn Giáo"]),
        education: cleanVal(row["Trình Độ Học Vấn"]),
        occupation: cleanVal(row["Nghề Nghiệp"]),
        workplace: cleanVal(row["Nơi Làm Việc"]),
        phone: cleanVal(row["Số Điện Thoại"]),
        insuranceId: cleanVal(row["Mã Số BHYT"]),
        isElderly: parseBool(row["Người Cao Tuổi"]),
        isDisabled: parseBool(row["Khuyết Tật"]),
        isPregnant: parseBool(row["Mang Thai"]),
        isStudent: parseBool(row["Học Sĩ/Sinh Viên"] || row["Học sinh/Sinh viên"]),
        studentType: cleanVal(row["Loại Học Sinh"]),
        isEmployed: parseBool(row["Có Việc Làm"]),
        laborSector: cleanVal(row["Lĩnh Vực Lao Động"]),
        subsidyType: cleanVal(row["Trợ Cấp"]),
        notes: cleanVal(row["Ghi Chú thực địa"]),
        gpsLat: parseFloatVal(row["Vĩ Độ GPS"]),
        gpsLng: parseFloatVal(row["Kinh Độ GPS"]),
        photoUrl
      };
    }).filter(r => r.fullName);

    // Businesses
    importedData.businesses = parseSheet("Ho_Kinh_Doanh", (row: any) => ({
      id: cleanVal(row["Mã Hộ Kinh Doanh"]),
      name: cleanVal(row["Tên Hộ Kinh Doanh"]),
      ownerName: cleanVal(row["Họ Tên Chủ Hộ"]),
      ownerId: cleanVal(row["CCCD Chủ Hộ"]),
      sector: cleanVal(row["Ngành Nghề Kinh Doanh"]),
      taxCode: cleanVal(row["Mã Số Thuế"]),
      licenseNumber: cleanVal(row["Số Giấy Phép"]),
      address: cleanVal(row["Địa Chỉ Kinh Doanh"])
    })).filter(b => b.id);

    // Changes
    importedData.changes = parseSheet("Bien_Dong_Cu_Tru", (row: any) => ({
      id: cleanVal(row["Mã Biến Động"]),
      residentId: cleanVal(row["Mã Nhân Khẩu"]),
      residentName: cleanVal(row["Họ và Tên"]),
      type: cleanVal(row["Loại Biến Động"]),
      date: cleanVal(row["Ngày Ghi Nhận"]),
      details: cleanVal(row["Chi Tiết Biến Động"]),
      recordedBy: cleanVal(row["Cán Bộ Thực Hiện"])
    })).filter(c => c.id);

    // Criteria
    importedData.criteria = parseSheet("Tieu_Chi_NTM", (row: any) => ({
      id: cleanVal(row["Mã Tiêu Chí"]),
      name: cleanVal(row["Tên Tiêu Chí"]),
      category: cleanVal(row["Phân Nhóm"]),
      targetValue: parseFloatVal(row["Mục Tiêu"]) || 0,
      value: parseFloatVal(row["Hiện Trạng"]) || 0,
      status: cleanVal(row["Trạng Thái Đạt"]),
      lastUpdated: cleanVal(row["Cập Nhật Cuối"])
    })).filter(cr => cr.id);

    // Documents
    importedData.documents = parseSheet("Tai_Lieu_Luu_Tru", (row: any) => {
      let attachments: any[] = [];
      let attStr = "";
      if (row) {
        if (row["Tài Liệu Đính Kèm"]) {
          attStr += cleanVal(row["Tài Liệu Đính Kèm"]);
        }
        // Grab any keys like "Tài Liệu Đính Kèm Phần 2", "Tài Liệu Đính Kèm Phần 3", etc.
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Tài Liệu Đính Kèm Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          attStr += cleanVal(row[k]);
        });
      }
      if (attStr) {
        try {
          attachments = JSON.parse(attStr);
        } catch {
          // Fallback if not a valid JSON
        }
      }
      return {
        id: cleanVal(row["Mã Tài Liệu"]),
        title: cleanVal(row["Tiêu Đề"]),
        docNumber: cleanVal(row["Số Kí Hiệu"]) || undefined,
        issueDate: cleanVal(row["Ngày Ban Hành"]),
        issuer: cleanVal(row["Nơi Ban Hành"]),
        category: cleanVal(row["Chuyên Mục"]) as any,
        description: cleanVal(row["Mô Tả"]) || undefined,
        fileSize: cleanVal(row["Dung Lượng"]) || "0.0 KB",
        fileType: cleanVal(row["Định Dạng"]) || "Tài liệu đính kèm",
        attachments,
        createdAt: cleanVal(row["Ngày Tạo"]) || new Date().toISOString().split("T")[0]
      };
    }).filter(doc => doc.id && doc.title);

    return importedData;
  };

  const sendRestorePayload = async (payload: any) => {
    try {
      const response = await fetch(`/api/data/restore?user=${encodeURIComponent(currentUser?.fullName || "Hệ thống")}&role=${encodeURIComponent(currentUser?.role || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        await fetchData();
        setAppAlert({
          isOpen: true,
          title: "Khôi phục thành công",
          message: `Toàn bộ dữ liệu đã được khôi phục thành công lên hệ thống:\n- Hộ dân: ${result.householdsCount}\n- Nhân khẩu: ${result.residentsCount}\n- Hộ kinh doanh: ${result.businessesCount}\n- Biến động: ${result.changesCount}\n- Tiêu chí: ${result.criteriaCount}${result.documentsCount !== undefined ? `\n- Tài liệu lưu trữ: ${result.documentsCount}` : ""}`,
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi khôi phục",
          message: `Không thể khôi phục dữ liệu: ${err}`,
          type: "error"
        });
        throw new Error(err);
      }
    } catch (err: any) {
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      try {
        const isJson = file.name.endsWith(".json");
        const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

        if (!isJson && !isXlsx) {
          const errMsg = "Chỉ chấp nhận tập tin sao lưu dạng .json hoặc .xlsx";
          setAppAlert({
            isOpen: true,
            title: "Lỗi định dạng",
            message: errMsg,
            type: "error"
          });
          setLoading(false);
          reject(new Error(errMsg));
          return;
        }

        if (isJson) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const content = e.target?.result as string;
              const backupData = JSON.parse(content);
              await sendRestorePayload(backupData);
              resolve();
            } catch (err: any) {
              const errMsg = `Không thể đọc nội dung file sao lưu: ${err.message}`;
              setAppAlert({
                isOpen: true,
                title: "Lỗi giải mã JSON",
                message: errMsg,
                type: "error"
              });
              setLoading(false);
              reject(err);
            }
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: "array" });
              const backupData = parseXLSXBackup(workbook);
              await sendRestorePayload(backupData);
              resolve();
            } catch (err: any) {
              const errMsg = `Không thể đọc file Excel sao lưu: ${err.message}`;
              setAppAlert({
                isOpen: true,
                title: "Lỗi giải mã Excel",
                message: errMsg,
                type: "error"
              });
              setLoading(false);
              reject(err);
            }
          };
          reader.readAsArrayBuffer(file);
        }
      } catch (err: any) {
        setAppAlert({
          isOpen: true,
          title: "Lỗi phục hồi",
          message: `Có lỗi xảy ra trong quá trình xử lý tệp tin: ${err.message}`,
          type: "error"
        });
        setLoading(false);
        reject(err);
      }
    });
  };

  const handleExportSim = (
    type: "xlsx" | "pdf" | "docx",
    titleOrEntity: string,
    passedHeaders?: string[],
    passedRows?: any[][]
  ) => {
    const BOM = "\uFEFF";
    let csvContent = "";
    let filename = "";
    let headers: string[] = passedHeaders || [];
    let rows: any[][] = passedRows || [];
    let reportTitle = titleOrEntity;

    if (!passedHeaders || !passedRows) {
      // Fallback for older calls from Dashboard
      if (titleOrEntity === "residents") {
        reportTitle = "Danh sách Nhân khẩu Chi tiết KDC";
        headers = [
          "STT", "Mã Hộ Gia Đình", "Họ và Tên", "Quan Hệ Chủ Hộ", "Giới Tính", 
          "Ngày Sinh", "Số CCCD", "Trạng Thái Cư Trú", "Dân Tộc", "Tôn Giáo", 
          "Trình Độ Học Vấn", "Nghề Nghiệp", "Nơi Làm Việc", "Số Điện Thoại", "Mã Số BHYT",
          "Người Cao Tuổi", "Khuyết Tật", "Mang Thai", "Học Sinh/Sinh Viên", "Loại Học Sinh",
          "Có Việc Làm", "Lĩnh Vực Lao Động", "Trợ Cấp"
        ];
        
        rows = residents.filter(r => r.occupation !== "Đã qua đời").map((r, idx) => [
          idx + 1,
          r.householdId,
          r.fullName,
          r.relationToOwner,
          r.gender,
          r.birthDate,
          `'${r.id}`,
          r.status,
          r.ethnicity,
          r.religion,
          r.education,
          r.occupation || "N/A",
          r.workplace || "N/A",
          r.phone || "",
          r.insuranceId || "",
          r.isElderly ? "Có" : "Không",
          r.isDisabled ? "Có" : "Không",
          r.isPregnant ? "Có" : "Không",
          r.isStudent ? "Có" : "Không",
          r.studentType || "",
          r.isEmployed ? "Có" : "Không",
          r.laborSector,
          r.subsidyType || "Không"
        ]);
      } else if (titleOrEntity === "households") {
        reportTitle = "Danh sách Hộ gia đình Chi tiết";
        headers = [
          "STT", "Mã Hộ Gia Đình", "Mã CCCD Chủ Hộ", "Họ Tên Chủ Hộ", "Số ĐT Chủ Hộ", "Địa Chỉ", 
          "Tổ Dân Phố", "Khu Phố", "Ngày Lập Hộ", "Phân Loại Hộ", "Gia Đình Văn Hoá",
          "Gia Đình Chính Sách", "Gia Đình Có Công", "Nước Sạch", "Thu Gom Rác", "Hộ Nông Nghiệp", "Vĩ Độ (Lat)", "Kinh Độ (Lng)",
          "Ghi Chú"
        ];
        
        rows = households.map((h, idx) => {
          const ownerResident = residents.find(r => r.id === h.ownerId);
          const ownerPhone = ownerResident?.phone || "";
          return [
            idx + 1,
            h.id,
            `'${h.ownerId}`,
            h.ownerName,
            ownerPhone,
            h.address,
            h.wardId,
            h.quarterId || "",
            h.createdAt,
            h.status,
            h.isCulturalFamily ? "Có" : "Không",
            h.isPolicyFamily ? "Có" : "Không",
            h.isMeritoriousFamily ? "Có" : "Không",
            h.waterSource || "Chưa cập nhật",
            h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký"),
            h.housingType,
            h.gpsLat || "",
            h.gpsLng || "",
            h.notes || ""
          ];
        });
      }
    }

    // Extract unit/group name dynamically based on report title/filter label
    let unitName = "BAN ĐIỀU HÀNH";
    const groupMatch = reportTitle.match(/tổ\s+(\d+)/i);
    if (groupMatch) {
      unitName = `BAN ĐIỀU HÀNH TỔ DÂN PHỐ ${groupMatch[1]}`;
    }

    if (type === "xlsx") {
      // Create a beautifully formatted Vietnamese public official report header at the top of the Excel worksheet
      const now = new Date();
      const dateStr = `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      const headerRows = [
        ["ỦY BAN NHÂN DÂN PHƯỜNG BÌNH MINH", "", "", "", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        [unitName, "", "", "", "Độc lập - Tự do - Hạnh phúc"],
        ["", "", "", "", ""],
        ["BÁO CÁO THỐNG KÊ CHI TIẾT DÂN CƯ", "", "", "", ""],
        [`Danh mục báo cáo: ${reportTitle}`, "", "", "", ""],
        [`Thời gian kết xuất: ${dateStr} lúc ${timeStr}`, "", "", "", ""],
        ["", "", "", "", ""],
      ];

      // Merge headers & rows
      const worksheetData = [...headerRows, headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Auto-fit column widths based on data headers and rows only to keep the design clean
      const colWidths = headers.map((_, colIdx) => {
        let maxLen = headers[colIdx].length;
        rows.forEach(row => {
          const val = row[colIdx];
          if (val !== undefined && val !== null) {
            const strVal = String(val);
            if (strVal.length > maxLen) {
              maxLen = strVal.length;
            }
          }
        });
        return { wch: Math.min(maxLen + 3, 40) };
      });
      worksheet["!cols"] = colWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      // Sheet name cannot exceed 31 chars and must not contain special chars
      const safeSheetName = reportTitle.replace(/[\\/?*\[\]]/g, "").slice(0, 31) || "Data";
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

      // Write array buffer
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      filename = `${reportTitle.replace(/\s+/g, "_")}_2026.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (type === "pdf") {
      // Create a temporary container for rendering the PDF layout cleanly in Landscape
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "0";
      tempDiv.style.width = "1120px"; // Spacious horizontal layout for landscape orientation
      tempDiv.style.backgroundColor = "white";
      tempDiv.style.color = "black";
      tempDiv.style.padding = "45px";
      tempDiv.style.fontFamily = "'Times New Roman', Times, serif";
      tempDiv.style.lineHeight = "1.4";
      tempDiv.style.boxSizing = "border-box";

      tempDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; font-size: 13px;">
          <div style="text-align: center; font-weight: bold;">
            ỦY BAN NHÂN DÂN PHƯỜNG BÌNH MINH<br />
            ${unitName}<br />
            <div style="width: 120px; border-top: 1px solid #000; margin: 4px auto 0 auto;"></div>
          </div>
          <div style="text-align: center;">
            <div style="font-weight: bold; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style="font-weight: bold; font-size: 13px;">Độc lập - Tự do - Hạnh phúc</div>
            <div style="width: 150px; border-top: 1px solid #000; margin: 4px auto 0 auto;"></div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">${reportTitle}</div>
          <div style="font-size: 11px; font-style: italic; color: #333;">Thời gian kết xuất báo cáo: ${new Date().toLocaleDateString("vi-VN")} lúc ${new Date().toLocaleTimeString("vi-VN")} (Định dạng Trang Ngang / Landscape)</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; table-layout: auto;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              ${headers.map(h => `<th style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 9px; white-space: normal; word-break: break-word;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, rIdx) => `
              <tr style="background-color: ${rIdx % 2 === 1 ? '#fcfcfc' : '#ffffff'};">
                ${row.map((cell, cIdx) => `
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: ${cIdx === 0 ? 'center' : 'left'}; font-size: 9px; word-break: break-word; white-space: normal;">
                    ${cell !== null && cell !== undefined ? cell : ""}
                  </td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="margin-top: 35px; display: flex; justify-content: space-between; font-size: 13px;">
          <div>
            <strong>Tổng số bản ghi:</strong> ${rows.length}<br />
            <strong>Người thực hiện:</strong> ${currentUser?.fullName || "Cán bộ số"}<br />
            <strong>Trạng thái:</strong> Hệ thống dữ liệu dân cư khu phố
          </div>
          <div style="text-align: center; width: 250px;">
            <div style="font-style: italic; font-size: 12px; margin-bottom: 5px;">Bình Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
            <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 65px;">XÁC NHẬN CỦA BAN ĐIỀU HÀNH</div>
            <div style="font-style: italic; font-size: 11px; margin-bottom: 55px;">(Ký tên và đóng dấu)</div>
            <div style="font-weight: bold; font-size: 13px;">Nguyễn Tấn Bình</div>
          </div>
        </div>
      `;

      document.body.appendChild(tempDiv);

      // Add a visual loading feedback
      const loadingToast = document.createElement("div");
      loadingToast.style.position = "fixed";
      loadingToast.style.bottom = "24px";
      loadingToast.style.left = "50%";
      loadingToast.style.transform = "translateX(-50%)";
      loadingToast.style.backgroundColor = "#10b981";
      loadingToast.style.color = "white";
      loadingToast.style.padding = "10px 20px";
      loadingToast.style.borderRadius = "8px";
      loadingToast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
      loadingToast.style.zIndex = "99999";
      loadingToast.style.fontSize = "13px";
      loadingToast.style.fontWeight = "bold";
      loadingToast.innerText = "Đang xử lý và xuất tệp tin PDF dạng trang ngang...";
      document.body.appendChild(loadingToast);

      // Render with html2canvas (scale 2 for retina crisps)
      html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      }).then((canvas) => {
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        
        // Setup A4 dimensions in landscape mode ("l", "mm", "a4") -> 297 x 210 mm
        const pdf = new jsPDF("l", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let positionY = 0;
        
        // Add canvas image to PDF pages as needed
        pdf.addImage(imgData, "JPEG", 0, positionY, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        
        while (heightLeft >= 0) {
          positionY = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, positionY, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
        
        const downloadName = `${reportTitle.replace(/\s+/g, "_")}_Landscape_2026.pdf`;
        pdf.save(downloadName);
        
        document.body.removeChild(tempDiv);
        document.body.removeChild(loadingToast);
      }).catch((err) => {
        console.error("PDF generation error:", err);
        if (tempDiv.parentNode) document.body.removeChild(tempDiv);
        if (loadingToast.parentNode) document.body.removeChild(loadingToast);
        alert("Có lỗi xảy ra trong quá trình xuất PDF. Vui lòng thử lại.");
      });
    }
  };

  return (
    <>
    <DeviceSimulator>
      {(isMobile, deviceType) => {
        
        // Gated Login View
        if (!currentUser) {
          // Sub-view 1: Two-Factor Authentication (2FA) Code Verification
          if (pendingUser2FA) {
            return (
              <div 
                id="auth-gate-container" 
                className="h-full w-full bg-slate-900 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
              >
                <div className="flex-1" />
                <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shrink-0 p-6 space-y-6 max-[400px]:p-4 max-[400px]:space-y-4 max-[400px]:rounded-2xl">
                  <div className="text-center space-y-2 max-[400px]:space-y-1">
                    <div className="w-14 h-14 max-[400px]:w-11 max-[400px]:h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                      <KeyRound className="w-7 h-7 max-[400px]:w-5 max-[400px]:h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-wide text-white uppercase max-[400px]:text-xs">XÁC THỰC 2 LỚP BẢO MẬT (2FA)</h3>
                      <p className="text-[10px] text-slate-400 max-[400px]:text-[9px]">Yêu cầu xác minh danh tính cán bộ trước khi truy cập dữ liệu</p>
                    </div>
                  </div>

                  <div className="p-4 max-[400px]:p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-2xl text-center space-y-2 max-[400px]:space-y-1">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest max-[400px]:text-[9px]">🔐 MÃ XÁC THỰC THỜI GIAN THỰC (OTP/2FA)</p>
                    <p className="text-2xl font-black font-mono tracking-[0.25em] text-white bg-slate-900/90 py-2 rounded-xl border border-emerald-500/10 max-[400px]:text-xl max-[400px]:tracking-[0.15em] max-[400px]:py-1.5">
                      {expected2FACode}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed max-[400px]:text-[8px]">
                      Sử dụng mã 6 chữ số ngẫu nhiên thời gian thực này để hoàn thành bước xác thực thứ hai.
                    </p>
                  </div>

                  {loginError && (
                    <div className="bg-rose-950/50 border border-rose-500/20 rounded-xl p-3 text-[10px] text-rose-300 font-bold leading-relaxed text-center">
                      {loginError}
                    </div>
                  )}

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (entered2FACode.trim() === expected2FACode) {
                      // 2FA Succeeded!
                      sessionStorage.setItem("passed2FA", "true");
                      setCurrentUser(pendingUser2FA);
                      localStorage.setItem("currentUser", JSON.stringify(pendingUser2FA));
                      
                      // Log on server-side audit trail
                      fetch("/api/auth/log-google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: pendingUser2FA.username || "BHTTQ3@gmail.com",
                          name: pendingUser2FA.fullName || "Cán bộ số",
                          role: pendingUser2FA.role || UserRole.SUPER_ADMIN,
                          action: "Đăng nhập + 2FA",
                          details: `Đăng nhập hệ thống và hoàn thành xác thực 2 lớp. Vai trò: ${pendingUser2FA.role}`
                        })
                      }).catch(e => console.error(e));

                      setPendingUser2FA(null);
                      setExpected2FACode("");
                      setEntered2FACode("");
                      setLoginError("");
                    } else {
                      setLoginError("Mã xác thực 2 lớp không chính xác! Vui lòng kiểm tra lại.");
                    }
                  }} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nhập mã 2FA 6 số:</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="______"
                        value={entered2FACode}
                        onChange={(e) => setEntered2FACode(e.target.value.replace(/\D/g, ""))}
                        className="w-full text-center py-3 bg-slate-900 border border-slate-800 rounded-xl font-bold font-mono text-lg text-white tracking-[0.25em] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      Xác minh & Vào hệ thống
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPendingUser2FA(null);
                        setExpected2FACode("");
                        setEntered2FACode("");
                        setLoginError("");
                        localStorage.removeItem("currentUser");
                        sessionStorage.removeItem("passed2FA");
                      }}
                      className="w-full py-2.5 bg-transparent border border-slate-850 hover:border-slate-800 text-slate-400 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Quay lại màn hình đăng nhập
                    </button>
                  </form>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          if (showRegisterForm) {
            return (
              <div 
                id="auth-gate-container" 
                className="h-full w-full bg-slate-50 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
              >
                <div className="flex-1" />
                <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl shrink-0 max-[400px]:rounded-2xl">
                  {/* Banner */}
                  <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 max-[400px]:p-4 text-center text-white space-y-2 flex flex-col items-center">
                    <div className="w-12 h-12 max-[400px]:w-10 max-[400px]:h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow">
                      <Users className="w-6 h-6 max-[400px]:w-5 max-[400px]:h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-tight uppercase max-[400px]:text-xs">ĐĂNG KÝ TÀI KHOẢN CÁN BỘ</h3>
                      <p className="text-[10px] text-emerald-100 max-[400px]:text-[9px]">Cổng đăng ký thông tin chờ duyệt nâng cao</p>
                    </div>
                  </div>

                  <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                    {loginError && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed font-semibold">
                        <p>{loginError}</p>
                      </div>
                    )}

                    {regSuccessMessage && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-[11px] text-emerald-800 leading-relaxed font-semibold space-y-3">
                        <p>{regSuccessMessage}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setRegSuccessMessage("");
                            setShowRegisterForm(false);
                            setLoginError("");
                          }}
                          className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer"
                        >
                          Quay lại Đăng nhập
                        </button>
                      </div>
                    )}

                    {!regSuccessMessage && (
                      <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-[400px]:space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Họ và tên cán bộ:</label>
                          <input
                            type="text"
                            required
                            placeholder="Nguyễn Văn A"
                            value={regFullName}
                            onChange={(e) => setRegFullName(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Địa chỉ Gmail chính thức:</label>
                          <input
                            type="email"
                            required
                            placeholder="canbo.nhaplieu@gmail.com"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Số điện thoại liên hệ:</label>
                          <input
                            type="tel"
                            required
                            placeholder="0912345678"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vai trò đề xuất:</label>
                          <select
                            value={regRole}
                            onChange={(e) => setRegRole(e.target.value as UserRole)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          >
                            <option value={UserRole.WARD_LEADER}>Trưởng Khu phố / Tổ trưởng</option>
                            <option value={UserRole.COLLABORATOR}>Cộng tác viên nhập liệu</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lý do đăng ký / Đơn vị:</label>
                          <textarea
                            placeholder="Nhập lý do hoặc đơn vị công tác (ví dụ: Tổ dân phố số 3)..."
                            value={regReason}
                            onChange={(e) => setRegReason(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold h-16 max-[400px]:h-12 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 bg-emerald-750 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          Gửi yêu cầu đăng ký
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowRegisterForm(false);
                            setLoginError("");
                          }}
                          className="w-full py-2.5 bg-transparent border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                        >
                          Quay lại Đăng nhập
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          // Sub-view 2: Admin Portal Gate vs Regular Staff Gate
          if (isAdminPath) {
            return (
              <div 
                id="auth-gate-container" 
                className="h-full w-full bg-slate-900 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
              >
                <div className="flex-1" />
                <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shrink-0 max-[400px]:rounded-2xl">
                  {/* Admin Visual Banner */}
                  <div className="bg-gradient-to-b from-indigo-950 to-slate-950 p-6 max-[400px]:p-4 text-center text-white border-b border-slate-800 flex flex-col items-center space-y-3 max-[400px]:space-y-2">
                    <div className="w-16 h-16 max-[400px]:w-11 max-[400px]:h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center p-0.5 shadow-lg">
                      <ShieldCheck className="w-9 h-9 max-[400px]:w-6 max-[400px]:h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-wide uppercase text-white max-[400px]:text-xs">CỔNG TRUY CẬP QUẢN TRỊ VIÊN</h3>
                      <p className="text-[10px] text-slate-400 max-[400px]:text-[9px]">Yêu cầu xác thực bảo mật 2 lớp tối cao (/admin)</p>
                    </div>
                  </div>

                  <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                    {loginError && (
                      <div className="bg-rose-950/50 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300 font-semibold leading-relaxed">
                        <div>{loginError}</div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-3">
                        {/* Selected admin role default */}
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vai trò truy cập:</p>
                          <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold border border-indigo-500/20">
                            SUPER_ADMIN (Quản trị viên cấp cao)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setLoginRole(UserRole.SUPER_ADMIN);
                            handleGoogleLogin();
                          }}
                          disabled={googleLoading}
                          className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer duration-200 active:scale-[0.98] text-xs"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>{googleLoading ? "Đang kết nối..." : "Google Admin Sign-in"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginRole(UserRole.SUPER_ADMIN);
                            handleGoogleLoginRedirect();
                          }}
                          disabled={googleLoading}
                          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-700/60 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer duration-200 active:scale-[0.98] text-[10px]"
                        >
                          <span>{googleLoading ? "Đang kết nối..." : "🔄 Admin Redirect Sign-in (Không dùng Popup)"}</span>
                        </button>
                        

                      </div>

                      <div className="pt-2 text-center border-t border-slate-900 flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginError("");
                            setShowRegisterForm(true);
                          }}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          📝 Đăng ký tài khoản mới (Chờ duyệt)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginError("");
                            navigateTo("/");
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          🏠 Quay lại Cổng thông tin Cán bộ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          // Regular Gated Portal (Case C)
          return (
            <div 
              id="auth-gate-container" 
              className="h-full w-full bg-slate-50 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
            >
              <div className="flex-1" />
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl shrink-0 max-[400px]:rounded-2xl">
                {/* Visual Banner */}
                <div className="bg-emerald-800 p-5 max-[400px]:p-4 text-center text-white space-y-2 flex flex-col items-center">
                  <div className="w-18 h-18 max-[400px]:w-14 max-[400px]:h-14 rounded-full bg-white border-2 border-emerald-500/20 shadow-lg overflow-hidden flex items-center justify-center p-0.5">
                    <img src={officialLogo} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight uppercase max-[400px]:text-xs">CỔNG XÁC THỰC CÁN BỘ SỐ</h3>
                    <p className="text-[10px] text-emerald-200 max-[400px]:text-[9px]">Khu phố Ninh Phú - Hệ thống Quản lý dân cư</p>
                  </div>
                </div>

                <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                  {loginError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed font-semibold space-y-1.5">
                      <div>{loginError}</div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Role Selection Group with Missions */}
                    <div className="space-y-2.5 max-[400px]:space-y-1.5 bg-slate-50 p-3.5 max-[400px]:p-2.5 rounded-2xl border border-slate-100 text-left">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Chọn vai trò đăng nhập của cán bộ:
                      </label>
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLoginRole(UserRole.SUPER_ADMIN)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.SUPER_ADMIN
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoginRole(UserRole.WARD_LEADER)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.WARD_LEADER
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>Trưởng KP</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoginRole(UserRole.COLLABORATOR)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.COLLABORATOR
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>CTV</span>
                        </button>
                      </div>

                      {/* Corresponding Duties / Mission box */}
                      <div className="bg-white border border-slate-200/60 rounded-xl p-2.5 max-[400px]:p-2 text-[10px] leading-relaxed text-slate-600">
                        <p className="font-bold text-slate-800 uppercase text-[9px] tracking-wide mb-1 border-b border-slate-100 pb-1 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Nhiệm vụ {loginRole === UserRole.SUPER_ADMIN ? "Quản trị viên" : loginRole === UserRole.WARD_LEADER ? "Trưởng Khu phố" : "Cộng tác viên"}:</span>
                        </p>
                        {loginRole === UserRole.SUPER_ADMIN && (
                          <span className="font-medium">
                            Toàn quyền quản trị hệ thống, phê duyệt cấp quyền tài khoản cán bộ mới, cấu hình bộ tiêu chí đô thị văn minh, sao lưu dự phòng toàn hệ thống dữ liệu.
                          </span>
                        )}
                        {loginRole === UserRole.WARD_LEADER && (
                          <span className="font-medium">
                            Quản lý danh sách hộ gia đình & cư dân, cập nhật thông tin nhân khẩu, theo dõi biến động cư dân (tạm trú, tạm vắng, chuyển đi/đến), tự động tổng hợp chất lượng sống.
                          </span>
                        )}
                        {loginRole === UserRole.COLLABORATOR && (
                          <span className="font-medium">
                            Tham gia hỗ trợ điều tra cơ sở, cập nhật trạng thái các chỉ số an sinh xã hội, khảo sát dịch vụ y tế, thẻ bảo hiểm y tế và tình hình giáo dục, việc làm tại khu phố.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full py-3.5 px-4 max-[400px]:py-2.5 max-[400px]:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl shadow-xs transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer duration-200 active:scale-[0.98] border-solid text-center"
                      >
                        <div className="flex items-center gap-2 text-xs justify-center">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>{googleLoading ? "Đang kết nối Google..." : "Xác thực bằng Google Gmail"}</span>
                        </div>
                      </button>

                      

                    </div>

                    <div className="pt-3 text-center border-t border-slate-100 flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError("");
                          setShowRegisterForm(true);
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        📝 Đăng ký tài khoản mới (Chờ duyệt)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError("");
                          navigateTo("/admin");
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        🔑 Cổng thông tin Quản trị hệ thống (/admin)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1" />
            </div>
          );
        }

        // Authenticated Dashboard Layout
        if (isAdminPath) {
          if (currentUser.role !== UserRole.SUPER_ADMIN) {
            return (
              <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-lg">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black tracking-tight text-white uppercase">TRUY CẬP BỊ TỪ CHỐI</h2>
                    <p className="text-xs text-rose-400 font-bold uppercase tracking-wider font-mono">Lỗi: Quyền hạn không đủ (SUPER_ADMIN Clearance Required)</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    Tài khoản <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.username}) không có quyền truy cập vào Cổng điều hành trung ương. Vui lòng quay trở lại cổng cư trú cơ bản hoặc đăng nhập bằng tài khoản Quản trị cấp cao.
                  </p>
                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigateTo("/")}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      Quay lại Bảng cư dân
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 py-3 bg-transparent hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Đăng xuất tài khoản
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div 
              className="flex-1 flex flex-col overflow-hidden h-full bg-slate-950 font-sans text-slate-250"
              style={{ zoom: `${zoomScale}%` }}
            >
              {/* Specialized Admin top control header */}
              <header className="h-16 bg-slate-900 border-b border-slate-850 flex items-center justify-between px-6 shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-xs font-black tracking-wide uppercase text-white">TRANG TRẠM QUẢN TRỊ TRUNG ƯƠNG</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigateTo("/")}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600 text-slate-300 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Quay lại Bảng cư dân</span>
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-400 border border-rose-500/20 text-rose-300 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </header>

              {/* Rendering the modular Admin Panel component */}
              <div className="flex-1 flex overflow-hidden bg-slate-900/40">
                <AdminPanel 
                  currentUser={currentUser}
                  onRefreshData={fetchData}
                  onGenerateMockData={handleGenerateMockData}
                  onClearMockData={handleClearAllData}
                  onRestoreBackup={handleRestoreBackup}
                  onExportBackup={handleExportJSONBackup}
                  isMobile={isMobile}
                />
              </div>
            </div>
          );
        }

        // Authenticated Dashboard Layout
        return (
          <div 
            className="flex-1 flex flex-col overflow-hidden h-full bg-[#F1F5F9] font-sans text-[#1E293B]"
            style={{ zoom: `${zoomScale}%` }}
          >
            <div className="flex-1 flex overflow-hidden relative">
            
            {/* Backdrop overlay for mobile drawer has been removed per user request to prevent dimming and blocking page actions */}

            {/* Sidebar navigation (collapsible layout for desktop, drawer overlay for mobile) */}
            <aside className={`${
              isMobile
                ? `${isSidebarHidden ? "-translate-x-full w-0 border-r-0" : "translate-x-0 w-72"} absolute inset-y-0 left-0 z-45 shadow-2xl`
                : `${isSidebarHidden ? "w-20" : "w-72"}`
            } bg-[#0F172A] relative flex flex-col justify-between shrink-0 border-r border-slate-850 h-full overflow-visible transition-all duration-300 select-none z-35`}>
              {/* Collapsible/Expandable arrow button positioned directly on the sidebar border - Always visible */}
              <button
                onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                className="absolute top-20 -right-3 w-6 h-6 bg-[#0F172A] border border-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 transition-all z-50 cursor-pointer shadow-md hover:scale-105 active:scale-95 flex"
                title={isSidebarHidden ? "Mở rộng Menu" : "Thu gọn Menu"}
              >
                {isSidebarHidden ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
              </button>

              <div className="flex flex-col justify-between h-full w-full overflow-hidden">
                 {/* Brand Header (Fixed Top) */}
                <div className={`p-4 ${isSidebarHidden ? "pb-3" : "pb-4 sm:p-6"} border-b border-slate-800/60 shrink-0 flex flex-col items-center text-center gap-2`}>
                  <div className="w-14 h-14 rounded-full bg-white border-2 border-blue-500/30 overflow-hidden flex items-center justify-center p-0.5 shadow-lg shrink-0">
                    <img src={officialLogo} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  </div>
                  {!isSidebarHidden && (
                    <div className="text-center mt-1">
                      <h1 className="text-white font-extrabold text-xs uppercase tracking-wide leading-tight">QUẢN LÝ DÂN CƯ</h1>
                      <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest block mt-0.5">KHU PHỐ NINH PHÚ</span>
                    </div>
                  )}
                </div>

                {/* Main Sidebar Contents (Scrollable Container) */}
                <div className={`flex-1 overflow-y-auto ${isSidebarHidden ? "p-2 space-y-4" : "p-4 sm:p-6 space-y-6"} scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent`}>

                  {/* Logged in Official details card */}
                  <div className={`bg-[#1E293B]/50 ${isSidebarHidden ? "p-1.5 py-2.5 justify-center" : "p-3 mx-1"} rounded-2xl border border-slate-800/80 flex items-center gap-3.5`}>
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white border border-blue-500/50 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-lg" title={currentUser.fullName}>
                      CB
                    </div>
                    {!isSidebarHidden && (
                      <div className="overflow-hidden flex flex-col text-left">
                        <h4 className="font-bold text-white text-xs truncate uppercase tracking-wide leading-tight" title={currentUser.fullName}>
                          {currentUser.fullName}
                        </h4>
                        <p className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider mt-1">
                          {currentUser.role === UserRole.SUPER_ADMIN ? "QUẢN TRỊ VIÊN" : currentUser.role === UserRole.WARD_LEADER ? "TRƯỞNG KHU PHỐ" : "CTV / ĐIỀU TRA VIÊN"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Tabs List */}
                  <nav className="space-y-1 mt-4">
                    {[
                      { id: "dashboard", label: "Báo cáo Thống kê", icon: <Activity className="w-4 h-4" /> },
                      { id: "households", label: "Quản lý Hộ dân", icon: <Home className="w-4 h-4" /> },
                      { id: "residents", label: "Quản lý Nhân khẩu", icon: <Users className="w-4 h-4" /> },
                      { id: "changes", label: "Biến động cư trú", icon: <Calendar className="w-4 h-4" /> },
                      { id: "security", label: "An sinh & Y tế", icon: <Award className="w-4 h-4" /> },
                      { id: "businesses", label: "Hộ kinh doanh", icon: <Building className="w-4 h-4" /> },
                      { id: "rural", label: "Nông thôn mới & GIS", icon: <Sparkles className="w-4 h-4" /> },
                      { id: "documents", label: "Lưu tài liệu KP", icon: <FileText className="w-4 h-4 text-emerald-400" /> },
                      { id: "ai", label: "Gemini AI Copilot", icon: <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" /> },
                      ...(currentUser.role === UserRole.SUPER_ADMIN
                        ? [{ id: "permissions", label: "Cấp quyền truy cập", icon: <ShieldCheck className="w-4 h-4 text-emerald-400" /> }]
                        : [])
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          if (isMobile) setIsSidebarHidden(true); // Auto close sidebar on mobile tap
                        }}
                        title={tab.label}
                        className={`w-full flex ${isSidebarHidden ? "justify-center p-3" : "items-center gap-3.5 px-4 py-3"} rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                          activeTab === tab.id
                            ? "bg-[#1E293B]/95 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                            : "text-[#94A3B8] hover:text-white hover:bg-slate-850/30"
                        }`}
                      >
                        <span className={`${activeTab === tab.id ? "text-blue-400" : "text-slate-400"} shrink-0`}>
                          {tab.icon}
                        </span>
                        {!isSidebarHidden && <span className="whitespace-nowrap truncate">{tab.label}</span>}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </aside>

            {/* Main view container block */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Web Top Header Bar */}
              {!isMobile && (
                <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-6 shadow-xs select-none">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer mr-1 flex items-center justify-center border border-slate-200"
                      title={isSidebarHidden ? "Mở rộng Menu" : "Thu gọn Menu"}
                    >
                      {isSidebarHidden ? (
                        <ChevronRight className="w-5 h-5 text-slate-700" />
                      ) : (
                        <ChevronLeft className="w-5 h-5 text-slate-700" />
                      )}
                    </button>
                    <span className="text-slate-400 text-xs font-bold tracking-wider uppercase">Chuyên mục:</span>
                    <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/60 uppercase tracking-wide">
                      {activeTab === "dashboard" && "Báo cáo Thống kê"}
                      {activeTab === "households" && "Quản lý Hộ dân"}
                      {activeTab === "residents" && "Quản lý Nhân khẩu"}
                      {activeTab === "changes" && "Biến động cư trú"}
                      {activeTab === "security" && "An sinh & Y tế"}
                      {activeTab === "businesses" && "Hộ kinh doanh"}
                      {activeTab === "rural" && "Nông thôn mới & GIS"}
                      {activeTab === "documents" && "Tài liệu lưu trữ"}
                      {activeTab === "ai" && "Trợ lý Trí tuệ Nhân tạo Gemini AI"}
                      {activeTab === "permissions" && "Quản lý Cấp quyền Truy cập"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Zoom / View Scale Widget (Sửa lỗi màn hình nhỏ bị cắt góc) */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="Thu nhỏ giao diện (-10%)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomReset}
                        className="px-2 py-0.5 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-black transition-colors cursor-pointer font-mono"
                        title="Đặt lại tỉ lệ 100%"
                      >
                        {zoomScale}%
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="Phóng to giao diện (+10%)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Toggle AI Chatbox Assistant */}
                    <button
                      onClick={handleToggleAIChatbox}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer shadow-xs active:scale-95 ${
                        showAIChatbox
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      }`}
                      title={showAIChatbox ? "Ẩn hoàn toàn Trợ lý AI" : "Hiện Trợ lý AI"}
                    >
                      {showAIChatbox ? (
                        <>
                          <Bot className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Bật Trợ lý AI</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Tắt Trợ lý AI</span>
                        </>
                      )}
                    </button>

                    {/* Logout Button in appropriate place (Top Header Bar) */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-100 hover:border-rose-200 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs"
                      title="Đăng xuất khỏi hệ thống"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Đăng xuất
                    </button>
                  </div>
                </header>
              )}
              
              {/* Simulated Mobile Quick Navigation drawer block */}
              {isMobile && (
                <div className="bg-[#0F172A] text-slate-200 px-3 py-2.5 shrink-0 flex items-center justify-between border-b border-slate-800 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-700"
                      title={isSidebarHidden ? "Mở Menu" : "Đóng Menu"}
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] uppercase shadow shrink-0">
                      {currentUser.fullName.split(" ").pop()?.substring(0, 2) || "CB"}
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-[10px] font-bold text-white truncate max-w-[100px]">{currentUser.fullName}</span>
                      <span className="text-[8px] text-blue-400 font-bold uppercase tracking-wider">
                        {currentUser.role === UserRole.SUPER_ADMIN ? "Quản trị viên" : currentUser.role === UserRole.WARD_LEADER ? "Trưởng khu" : "Cộng tác viên"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={activeTab}
                      onChange={(e) => setActiveTab(e.target.value)}
                      className="px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-[9px] text-blue-400 font-bold text-center"
                    >
                      <option value="dashboard" className="text-center">Báo cáo Thống kê</option>
                      <option value="households" className="text-center">Quản lý Hộ dân</option>
                      <option value="residents" className="text-center">Quản lý Nhân khẩu</option>
                      <option value="changes" className="text-center">Biến động cư trú</option>
                      <option value="security" className="text-center">An sinh & Y tế</option>
                      <option value="businesses" className="text-center">Hộ kinh doanh</option>
                      <option value="rural" className="text-center">Nông thôn mới & GIS</option>
                      <option value="ai" className="text-center">Gemini AI Copilot</option>
                      {currentUser.role === UserRole.SUPER_ADMIN && (
                        <option value="permissions" className="text-center">Cấp quyền truy cập</option>
                      )}
                    </select>

                    {/* Toggle AI Button for mobile */}
                    <button
                      onClick={handleToggleAIChatbox}
                      className={`flex items-center gap-1 px-2 py-1 border rounded-lg cursor-pointer transition-all active:scale-95 shrink-0 ${
                        showAIChatbox
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-750 hover:text-slate-200"
                      }`}
                      title={showAIChatbox ? "Tắt Trợ lý AI" : "Bật Trợ lý AI"}
                    >
                      <Bot className={`w-3 h-3 ${showAIChatbox ? "animate-pulse text-emerald-400" : "text-slate-400"}`} />
                      <span className="text-[9px] font-extrabold uppercase">AI</span>
                    </button>

                    <button 
                      onClick={handleLogout} 
                      className="flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg text-[9px] font-extrabold text-rose-400 cursor-pointer shrink-0 transition-all active:scale-95"
                      title="Đăng xuất"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Rendering selected sub view */}
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs font-semibold">Đang liên kết cơ sở dữ liệu dân cư khu phố...</p>
                </div>
              ) : (
                <>
                  {showBackupReminder && (
                    <div className="bg-amber-50 border-b border-amber-250 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-800 shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                            Nhắc nhở sao lưu định kỳ hàng tuần
                          </h4>
                          <p className="text-amber-700 text-xs mt-0.5 leading-relaxed font-medium">
                            {lastBackupDate ? (
                              `Hệ thống ghi nhận lần sao lưu gần nhất: ${new Date(lastBackupDate).toLocaleDateString("vi-VN")} lúc ${new Date(lastBackupDate).toLocaleTimeString("vi-VN")}. Hãy xuất và lưu trữ dữ liệu sang Excel định kỳ để tránh sự cố mất dữ liệu.`
                            ) : (
                              "Bạn chưa thực hiện sao lưu dữ liệu lần nào. Vui lòng xuất dữ liệu hệ thống ra tập tin Excel (XLSX) để đảm bảo an toàn."
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setShowBackupReminder(false)}
                          className="px-3 py-1.5 hover:bg-amber-150 text-amber-850 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Để sau
                        </button>
                        <button
                          onClick={handleExportFullBackup}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Sao lưu ngay
                        </button>
                      </div>
                    </div>
                  )}

                  {currentUser?.role === UserRole.SUPER_ADMIN && latestSecurityAlert && (
                    <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs animate-pulse-subtle">
                      <div className="flex items-start gap-3">
                        <div className="bg-rose-100 p-2 rounded-xl text-rose-800 shrink-0 border border-rose-200">
                          <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-rose-900 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                            🚨 CẢNH BÁO BẢO MẬT HỆ THỐNG
                          </h4>
                          <p className="text-rose-700 text-xs mt-0.5 leading-relaxed font-semibold">
                            {latestSecurityAlert.details} (Thời gian: {new Date(latestSecurityAlert.timestamp).toLocaleString("vi-VN")})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setLatestSecurityAlert(null)}
                          className="px-3 py-1.5 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Bỏ qua
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("permissions");
                            setLatestSecurityAlert(null);
                          }}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer uppercase tracking-wider"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Xem & Phê duyệt
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === "dashboard" && (
                    <DashboardView 
                      households={households} 
                      residents={residents} 
                      businesses={businesses} 
                      onExport={handleExportSim} 
                      isMobile={isMobile} 
                      onGenerateMockData={handleGenerateMockData}
                      onClearAllData={handleClearAllData}
                      onExportFullBackup={handleExportFullBackup}
                      onExportJSONBackup={handleExportJSONBackup}
                      onRestoreBackup={handleRestoreBackup}
                    />
                  )}
                  {activeTab === "households" && (
                    <HouseholdView 
                      households={households} 
                      residents={residents} 
                      currentUser={currentUser} 
                      onAddHousehold={addHousehold} 
                      onUpdateHousehold={updateHousehold} 
                      onDeleteHousehold={deleteHousehold} 
                      onExport={handleExportSim}
                      isMobile={isMobile}
                      onSync={triggerSync}
                      offlineQueueCount={offlineQueue.length}
                      isSyncing={isSyncing}
                      isOnline={isOnline}
                      onAddResident={addResident}
                      onUpdateResident={updateResident}
                    />
                  )}
                  {activeTab === "residents" && (
                    <ResidentView 
                      residents={residents} 
                      households={households} 
                      currentUser={currentUser} 
                      onAddResident={addResident} 
                      onUpdateResident={updateResident} 
                      onDeleteResident={deleteResident} 
                      onExport={handleExportSim}
                      isMobile={isMobile}
                    />
                  )}
                  {activeTab === "changes" && (
                    <DemographicsChangeView 
                      changes={changes} 
                      residents={residents} 
                      households={households}
                      currentUser={currentUser} 
                      onAddChange={addDemographicsChange} 
                      onAddResident={addResident}
                      onUpdateResident={updateResident}
                      onUpdateHousehold={updateHousehold}
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "security" && (
                    <SocialSecurityView 
                      residents={residents} 
                      households={households} 
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "businesses" && (
                    <BusinessView 
                      businesses={businesses} 
                      residents={residents} 
                      households={households} 
                      currentUser={currentUser} 
                      onAddBusiness={addBusiness} 
                      onUpdateBusiness={updateBusiness} 
                      onDeleteBusiness={deleteBusiness} 
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "rural" && (
                    <NewRuralView 
                      criteria={criteria} 
                      households={households} 
                      currentUser={currentUser} 
                      onUpdateCriteria={updateCriteria} 
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "documents" && (
                    <QuarterDocumentsView currentUser={currentUser} />
                  )}
                  {activeTab === "ai" && (
                    <AICopilotView isMobile={isMobile} />
                  )}
                  {activeTab === "permissions" && (
                    <AllowedEmailsView />
                  )}
                </>
              )}
            </div>

            </div>

            {/* Horizontal bottom bar (Thanh ngang cuối trang) */}
            {!isMobile && (
              <footer className="h-14 bg-[#0F172A] border-t border-slate-800 shrink-0 flex items-center justify-between px-6 text-slate-300 text-xs select-none">
                {/* Left: Version and Location */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">Phiên bản v2.4</span>
                  <span className="font-semibold text-slate-400">Tổ dân phố / Khu phố Ninh Phú, Phường Bình Minh</span>
                </div>

                {/* Center: Copyright */}
                <div className="text-slate-500 font-medium text-[11px] hidden md:block">
                  © Bản quyền thuộc về Nguyễn Tấn Bình và Phạm Duy Ngôn
                </div>

                {/* Right: DB Export & System Logout */}
                <div className="flex items-center gap-3">
                  {currentUser.role === UserRole.SUPER_ADMIN && (
                    <button
                      onClick={() => setActiveTab("permissions")}
                      className={`flex items-center gap-2 px-4 py-1.5 border rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs active:scale-95 ${
                        activeTab === "permissions"
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                          : "bg-slate-900 hover:bg-emerald-950 border-slate-800 hover:border-emerald-900 hover:text-emerald-200 text-slate-300"
                      }`}
                      title="Cấp quyền truy cập hệ thống"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Cấp quyền truy cập
                    </button>
                  )}

                  <button
                    onClick={handleExportFullBackup}
                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 hover:bg-amber-950 border border-slate-800 hover:border-amber-900 hover:text-amber-200 text-xs text-slate-300 font-bold rounded-xl transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Download className="w-4 h-4 text-amber-500" />
                    Sao lưu Toàn bộ DB
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-900 hover:text-rose-200 text-xs text-slate-300 font-bold rounded-xl transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    Thoát hệ thống
                  </button>
                </div>
              </footer>
            )}
            <MovableChatbox />
          </div>
        );
      }}
    </DeviceSimulator>
    
    {appAlert && appAlert.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-[99999]">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3">
            {appAlert.type === "success" && (
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
            )}
            {appAlert.type === "error" && (
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {appAlert.type === "info" && (
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
            )}
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">{appAlert.title}</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">{appAlert.message}</p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setAppAlert(null)}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Đồng ý
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
