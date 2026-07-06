import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, FileText, Database, RefreshCw, Download, Upload, 
  Trash2, Search, ArrowLeftRight, Clock, UserCheck, AlertTriangle, 
  Shield, Check, UserMinus, Plus
} from "lucide-react";
import { User, UserRole, AuditLog } from "../types";
import AllowedEmailsView from "./AllowedEmailsView";

interface AdminPanelProps {
  currentUser: User | null;
  onRefreshData: () => Promise<void>;
  onGenerateMockData: () => Promise<void>;
  onClearMockData: () => Promise<void>;
  onRestoreBackup: (file: File) => Promise<void>;
  onExportBackup: () => void;
  isMobile: boolean;
}

export default function AdminPanel({
  currentUser,
  onRefreshData,
  onGenerateMockData,
  onClearMockData,
  onRestoreBackup,
  onExportBackup,
  isMobile
}: AdminPanelProps) {
  const [adminTab, setAdminTab] = useState<"permissions" | "logs" | "maintenance">("permissions");
  
  // Logs States
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [logPage, setLogPage] = useState(1);
  const itemsPerPage = 15;

  // File upload state for restore
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (adminTab === "logs") {
      fetchLogs();
    }
  }, [adminTab]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (window.confirm(`Bạn có chắc chắn muốn khôi phục cơ sở dữ liệu từ tệp tin "${file.name}"? Dữ liệu hiện tại có thể bị thay thế.`)) {
        try {
          await onRestoreBackup(file);
          alert("Khôi phục dữ liệu sao lưu thành công!");
          if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
          alert(`Khôi phục thất bại: ${err.message || "Lỗi tệp tin"}`);
        }
      }
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Log filtering & pagination
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.userName || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.userId || "").toLowerCase().includes(logSearch.toLowerCase());
    
    const matchesRole = roleFilter === "all" || log.userRole === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((logPage - 1) * itemsPerPage, logPage * itemsPerPage);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" id="admin-panel-container">
      {/* Admin Panel Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Hệ thống Quản trị Tối cao (Super Admin Center)
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">CỔNG ĐIỀU HÀNH TRUNG ƯƠNG</h2>
          <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
            Nơi phân quyền tài khoản truy cập, giám sát toàn bộ hoạt động của cán bộ khu phố thời gian thực và quản lý dữ liệu sao lưu dự phòng tối cao.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shrink-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">
            Admin
          </div>
          <div>
            <p className="text-xs font-bold text-white">{currentUser?.fullName || "Người quản lý tối cao"}</p>
            <p className="text-[10px] text-emerald-400 font-bold font-mono">BHTTQ3@gmail.com</p>
          </div>
        </div>
      </div>

      {/* Admin Tab Switching */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setAdminTab("permissions")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "permissions"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" /> Cấp quyền truy cập
        </button>
        <button
          onClick={() => setAdminTab("logs")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "logs"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" /> Nhật ký hệ thống
        </button>
        <button
          onClick={() => setAdminTab("maintenance")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            adminTab === "maintenance"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Database className="w-4 h-4" /> Bảo trì & Sao lưu
        </button>
      </div>

      {/* Admin Tab Contents */}
      <div className="mt-4">
        {/* TAB 1: ALLOWED EMAILS */}
        {adminTab === "permissions" && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <AllowedEmailsView />
          </div>
        )}

        {/* TAB 2: AUDIT LOGS */}
        {adminTab === "logs" && (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs p-6 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Nhật ký sự kiện thời gian thực</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Giám sát các hành động đăng nhập, cập nhật, xóa sửa dữ liệu của các tài khoản.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Tải lại nhật ký"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Filter and Search Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm cán bộ, thao tác, chi tiết..."
                  value={logSearch}
                  onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setLogPage(1); }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Tất cả vai trò cán bộ</option>
                  <option value={UserRole.SUPER_ADMIN}>Cán bộ Quản trị tối cao</option>
                  <option value={UserRole.WARD_LEADER}>Trưởng Khu phố / Tổ dân phố</option>
                  <option value={UserRole.COLLABORATOR}>Cộng tác viên điều tra</option>
                </select>
              </div>

              <div className="flex items-center justify-end text-[11px] text-slate-500 font-bold">
                Tìm thấy {filteredLogs.length} dòng nhật ký
              </div>
            </div>

            {/* Logs Table */}
            <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Cán bộ thực hiện</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3">Hành động</th>
                      <th className="px-4 py-3">Mô tả chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 bg-white">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>Đang tải nhật ký từ máy chủ...</span>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Không tìm thấy nhật ký hoạt động nào khớp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const isSuperAdmin = log.userRole === UserRole.SUPER_ADMIN;
                        const isWardLeader = log.userRole === UserRole.WARD_LEADER;
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-[11px] font-mono font-semibold text-slate-500 whitespace-nowrap">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {log.userName}
                              <p className="text-[10px] text-slate-400 font-mono font-medium">{log.userId}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {isSuperAdmin ? (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-100">
                                  Quản trị viên
                                </span>
                              ) : isWardLeader ? (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                                  Trưởng khu phố
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold border border-purple-100">
                                  Cộng tác viên
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action.includes("Xoá") || log.action.includes("Hủy")
                                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                                  : log.action.includes("Thêm") || log.action.includes("Cấp")
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : log.action.includes("Đăng nhập")
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                  <button
                    disabled={logPage === 1}
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs text-slate-600 font-bold">Trang {logPage} / {totalPages}</span>
                  <button
                    disabled={logPage === totalPages}
                    onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BACKUP & MAINTENANCE */}
        {adminTab === "maintenance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database backups */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sao lưu & Phục hồi dữ liệu</h3>
                  <p className="text-[10px] text-slate-400">Tránh mất mát dữ liệu dân cư bằng cách sao lưu thường xuyên.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống hỗ trợ cơ chế sao lưu toàn bộ cơ sở dữ liệu bao gồm: hộ gia đình, nhân khẩu, biến động, hộ kinh doanh và nhật ký hệ thống ra một tệp JSON tiêu chuẩn để lưu trữ độc lập hoặc nhập ngược lại khi cần thiết.
              </p>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={onExportBackup}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Tải tệp Sao Lưu
                </button>

                <button
                  onClick={handleTriggerFileInput}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Khôi phục dữ liệu
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
            </div>

            {/* Initialize & Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Bảo trì hệ thống trống</h3>
                  <p className="text-[10px] text-slate-400">Cài đặt ban đầu hoặc xóa dữ liệu mẫu để đưa vào thực tế.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Sử dụng các công cụ này khi chuyển giao hệ thống để xóa sạch các dữ liệu thử nghiệm ngẫu nhiên, đưa hệ thống về trạng thái ban đầu sạch sẽ để phục vụ cán bộ khu phố nhập liệu thực tế.
              </p>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    if (window.confirm("Bạn có chắc muốn tự động tạo dữ liệu mẫu (25 hộ dân, 105 nhân khẩu)? Việc này sẽ ghi đè dữ liệu hiện tại.")) {
                      try {
                        await onGenerateMockData();
                        alert("Đã khởi tạo thành công cơ sở dữ liệu mẫu!");
                      } catch (err: any) {
                        alert(`Lỗi: ${err.message}`);
                      }
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" /> Tạo dữ liệu mẫu
                </button>

                <button
                  onClick={async () => {
                    try {
                      await onClearMockData();
                    } catch (err: any) {
                      alert(`Lỗi: ${err.message}`);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Xoá toàn bộ dữ liệu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
