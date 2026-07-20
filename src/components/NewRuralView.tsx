/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Award, Map, MapPin, Eye, Plus, CheckCircle, XCircle,
  Settings, Check, X, Compass, Activity, ShieldAlert, Download, Printer,
  Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Sliders
} from "lucide-react";
import { RuralCriteria, Household, User, UserRole } from "../types";
import GoogleGISMap from "./GoogleGISMap";

interface NewRuralViewProps {
  criteria: RuralCriteria[];
  households: Household[];
  currentUser: User | null;
  onUpdateCriteria: (updated: RuralCriteria) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
}

export default function NewRuralView({
  criteria, households, currentUser, onUpdateCriteria, onExport
}: NewRuralViewProps) {
  
  const [activeTab, setActiveTab] = useState<"criteria" | "gis">("criteria");
  const [selectedHousePin, setSelectedHousePin] = useState<Household | null>(null);

  // GIS Zoom, Pan, Fullscreen and Ward/Tổ Selection States
  const [mapZoom, setMapZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [selectedGisTo, setSelectedGisTo] = useState<string>("ALL");

  // Extract unique Tổ (wardId) from households list
  const uniqueTos = React.useMemo(() => {
    const tos = households
      .map(h => h.wardId || "")
      .filter(w => w.trim() !== "");
    return Array.from(new Set(tos)).sort();
  }, [households]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mapZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || mapZoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 }); // reset pan when fit to screen
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setMapZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      // scroll up -> zoom in
      setMapZoom(prev => Math.min(prev + 0.25, 5));
    } else {
      // scroll down -> zoom out
      setMapZoom(prev => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) {
          setPanOffset({ x: 0, y: 0 });
        }
        return next;
      });
    }
  };

  // Config Criteria state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<any>("Thu nhập");
  const [formValue, setFormValue] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formStatus, setFormStatus] = useState<"Đạt" | "Chưa đạt">("Đạt");

  const handleSubmitNewCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formValue.trim() || !formTarget.trim()) {
      alert("Vui lòng điền đủ tên, hiện trạng, và đích chỉ tiêu!");
      return;
    }

    const newCriteria: RuralCriteria = {
      id: `TC-${Date.now()}`,
      name: formName,
      status: formStatus,
      value: formValue,
      targetValue: formTarget,
      category: formCategory,
      lastUpdated: new Date().toISOString().split("T")[0]
    };

    onUpdateCriteria(newCriteria);
    setIsFormOpen(false);
    setFormName("");
    setFormValue("");
    setFormTarget("");
  };

  // Convert GPS coordinate to custom SVG grid space for mock GIS
  const convertCoordsToSvg = (lat?: number, lng?: number) => {
    // Default fallback bounds of our simulated neighborhood in Phường Bình Minh, Tây Ninh
    const minLat = 11.330;
    const maxLat = 11.365;
    const minLng = 106.110;
    const maxLng = 106.145;

    let actualLat = lat || 11.3450;
    let actualLng = lng || 106.1250;

    // Handle old HCMC-bound mock coordinates and map them smoothly to Phường Bình Minh bounds
    if (actualLat < 11.0 && actualLng > 106.5) {
      const hcmcMinLat = 10.775;
      const hcmcMaxLat = 10.795;
      const hcmcMinLng = 106.695;
      const hcmcMaxLng = 106.715;

      const latPct = (actualLat - hcmcMinLat) / (hcmcMaxLat - hcmcMinLat);
      const lngPct = (actualLng - hcmcMinLng) / (hcmcMaxLng - hcmcMinLng);

      actualLat = minLat + latPct * (maxLat - minLat);
      actualLng = minLng + lngPct * (maxLng - minLng);
    }

    // Percentages
    const xPct = ((actualLng - minLng) / (maxLng - minLng)) * 100;
    // Lat is inverted on screen coordinates (Y-axis points down)
    const yPct = 100 - (((actualLat - minLat) / (maxLat - minLat)) * 100);

    return {
      x: Math.min(Math.max(xPct, 10), 90),
      y: Math.min(Math.max(yPct, 10), 90)
    };
  };

  const renderGisDetailPanel = () => {
    return (
      <div className="flex flex-col justify-between h-full space-y-4">
        {selectedHousePin ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="overflow-hidden">
                <h4 className="font-bold text-slate-800 text-sm truncate">Hồ sơ địa chính {selectedHousePin.id}</h4>
                <p className="text-[10px] text-slate-400 font-mono">GPS: {selectedHousePin.gpsLat}, {selectedHousePin.gpsLng}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p><b>Chủ hộ đại diện:</b> <span className="text-slate-900 font-bold">{selectedHousePin.ownerName}</span></p>
              <p><b>Địa chỉ thường trú:</b> {selectedHousePin.address}</p>
              <p><b>Đơn vị hành chính:</b> {selectedHousePin.wardId}{selectedHousePin.quarterId ? ` • ${selectedHousePin.quarterId}` : ""}</p>
              
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái an sinh xã hội</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{selectedHousePin.status}</p>
                <p className="text-[10px] text-slate-505 mt-1">Hộ nông nghiệp: {selectedHousePin.housingType || "Không"}</p>
              </div>
            </div>

            {selectedHousePin.photoUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-150 h-32 relative">
                <img src={selectedHousePin.photoUrl} alt="Hộ dân" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
            <MapPin className="w-8 h-8 text-slate-300 animate-bounce" />
            <p className="font-bold text-sm text-slate-600">Chưa chọn Toạ độ nhà ở</p>
            <p className="text-[10px] leading-relaxed">
              Nhấp vào bất kỳ <b className="text-emerald-600">chấm Pin màu</b> nào trên Bản đồ GIS để xem nhanh thông tin chủ hộ, địa chính và mức thu nhập an sinh.
            </p>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed shrink-0">
          <b>* Định hướng quy hoạch:</b> Mô-đun GIS giúp cán bộ Tổ trưởng phân loại phân bổ cứu trợ dựa theo dữ liệu thực địa bản đồ địa dư Phường Bình Minh, Tây Ninh.
        </div>
      </div>
    );
  };

  const renderGisMapContents = (isBig: boolean) => {
    return (
      <div className="w-full h-full relative overflow-hidden flex flex-col justify-between">
        {/* Top map widgets */}
        <div className="absolute top-4 left-4 z-10 bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 text-white text-xs shadow-xl select-none max-w-[240px] md:max-w-xs">
          <p className="font-bold flex items-center gap-1.5 text-slate-200">
            <Compass className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
            VỆ TINH GIS ĐỊA CHÍNH TỔ
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Tọa độ trung tâm: 11.3450N, 106.1250E</p>
          
          {/* Interactive Tổ Selector */}
          <div className="flex items-center gap-1.5 mt-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-inner">
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[10px] text-slate-300 font-bold shrink-0">Chọn Tổ:</span>
            <select
              value={selectedGisTo}
              onChange={(e) => setSelectedGisTo(e.target.value)}
              className="bg-transparent text-white border-none text-[10px] focus:outline-none cursor-pointer font-extrabold pr-1 focus:ring-0 w-full"
            >
              <option value="ALL" className="bg-slate-950 text-white">Tất cả các Tổ</option>
              {uniqueTos.map(to => (
                <option key={to} value={to} className="bg-slate-950 text-white">{to}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Map Information / Hover coordinates info at bottom left */}
        <div className="absolute bottom-14 left-4 z-10 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] text-slate-300 select-none font-mono hidden md:block">
          <p>Tỷ lệ: 1 : 2.500 | Phóng đại: {mapZoom.toFixed(2)}x</p>
          {mapZoom > 1 && <p className="text-[8px] text-emerald-400 mt-0.5 font-sans">Kéo rê chuột trái trên bản đồ để di chuyển</p>}
        </div>

        {/* Floating Zoom / Pan / Action Controls (Floating bottom right) */}
        <div className="absolute bottom-14 right-4 z-10 flex flex-col gap-1.5 bg-slate-950/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl select-none">
          <button 
            type="button"
            onClick={handleZoomIn} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Phóng to (Zoom In)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleZoomOut} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Thu nhỏ (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleResetZoom} 
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Thiết lập lại (Reset Zoom)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <div className="w-full border-t border-slate-800 my-0.5"></div>

          <button 
            type="button"
            onClick={() => setIsFullscreenMap(!isBig)} 
            className="p-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title={isBig ? "Thu nhỏ cửa sổ lớn" : "Phóng to toàn màn hình (Fullscreen)"}
          >
            {isBig ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Map SVG container viewport with grab cursors */}
        <div 
          className={`w-full h-full overflow-hidden relative select-none ${mapZoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
        >
          {/* Simulated Street Grid Map (Drawn using beautiful vector graphics) */}
          <svg 
            className="w-full h-full transition-transform duration-75 ease-out" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            style={{
              transform: `scale(${mapZoom}) translate(${panOffset.x / mapZoom}px, ${panOffset.y / mapZoom}px)`,
              transformOrigin: "center center",
            }}
          >
            {/* Back background texture for satellite vibe */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#334155" strokeWidth="0.1" strokeOpacity="0.4" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* River/Water vector */}
            <path d="M 0 85 Q 35 70, 70 90 T 100 80" fill="none" stroke="#0369a1" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.3" />
            <text x="35" y="81" fill="#38bdf8" fontSize="2" fontWeight="bold" opacity="0.6" transform="rotate(-5, 35, 81)">Bờ Kênh Thanh Đa</text>

            {/* Street vectors */}
            {/* Hoa Sữa street */}
            <line x1="15" y1="0" x2="15" y2="100" stroke="#475569" strokeWidth="3" strokeOpacity="0.6" />
            <text x="14" y="25" fill="#94a3b8" fontSize="2" fontWeight="bold" opacity="0.8" transform="rotate(-90, 14, 25)">Đường Hoa Sữa (Tổ 5)</text>

            {/* Hoa Hồng street */}
            <line x1="50" y1="0" x2="50" y2="100" stroke="#475569" strokeWidth="3" strokeOpacity="0.6" />
            <text x="49" y="40" fill="#94a3b8" fontSize="2" fontWeight="bold" opacity="0.8" transform="rotate(-90, 49, 40)">Đường Hoa Hồng (Tổ 5)</text>

            {/* Điện Biên Phủ main highway */}
            <line x1="0" y1="50" x2="100" y2="50" stroke="#64748b" strokeWidth="4.5" strokeOpacity="0.6" />
            <text x="70" y="48" fill="#cbd5e1" fontSize="2.2" fontWeight="bold" opacity="0.9">Đại lộ Điện Biên Phủ (Tổ 6)</text>

            {/* Plots and grids */}
            <rect x="25" y="10" width="15" height="15" rx="1" fill="#1e293b" opacity="0.4" stroke="#334155" strokeWidth="0.2" />
            <rect x="65" y="10" width="20" height="20" rx="1" fill="#1e293b" opacity="0.4" stroke="#334155" strokeWidth="0.2" />
            <text x="71" y="21" fill="#64748b" fontSize="2.5" fontWeight="bold" opacity="0.5">Khu Nam Long</text>

            {/* Interactive Household Pins mapped to their SVG positions */}
            {households.map((h) => {
              const pos = convertCoordsToSvg(h.gpsLat, h.gpsLng);
              const isSelected = selectedHousePin?.id === h.id;
              
              // Check if this household belongs to the selected Tổ
              const isBelongingToSelectedTo = selectedGisTo === "ALL" || h.wardId === selectedGisTo;
              
              // If we want to hide or fade out others
              const opacityClass = isBelongingToSelectedTo ? "opacity-100" : "opacity-20 transition-opacity duration-300";

              return (
                <g 
                  key={h.id} 
                  className={`cursor-pointer group transition-all duration-300 ${opacityClass}`}
                  onClick={() => setSelectedHousePin(h)}
                >
                  {/* Animated aura ring for highlight */}
                  {isBelongingToSelectedTo && (
                    <circle 
                      cx={pos.x} cy={pos.y} r={isSelected ? "4.5" : "2.5"} 
                      fill="none" 
                      stroke={h.status === "Hộ nghèo" ? "#f43f5e" : "#10b981"} 
                      strokeWidth="0.5" 
                      className="animate-ping" 
                      opacity="0.6"
                    />
                  )}

                  {/* Outer Pin */}
                  <circle 
                    cx={pos.x} cy={pos.y} r={isSelected ? "2.5" : isBelongingToSelectedTo ? "1.8" : "1.2"} 
                    fill={h.status === "Hộ nghèo" ? "#ef4444" : h.status === "Hộ cận nghèo" ? "#f59e0b" : "#10b981"} 
                    stroke="#ffffff" 
                    strokeWidth={isBelongingToSelectedTo ? "0.3" : "0.15"}
                  />

                  {/* Text initials inside pin */}
                  {isBelongingToSelectedTo && (
                    <text 
                      x={pos.x} y={pos.y + 0.5} 
                      fill="#ffffff" 
                      fontSize="1" 
                      textAnchor="middle" 
                      fontWeight="bold"
                    >
                      H
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom help bar */}
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between shrink-0 select-none z-10 rounded-b-2xl">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white"></span> Hộ Nghèo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white"></span> Hộ Cận Nghèo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white"></span> Hộ Bình Thường</span>
        </div>
      </div>
    );
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    const headers = [
      "STT", "Mã Tiêu Chí", "Tên Tiêu Chí", "Nhóm Lĩnh Vực", "Giá Trị Đạt Được", "Giá Trị Mục Tiêu", "Trạng Thái"
    ];
    const rows = criteria.map((c, idx) => [
      idx + 1,
      c.id,
      c.name,
      c.category,
      c.value,
      c.targetValue,
      c.status
    ]);
    onExport(type, "Chỉ số xây dựng Nông thôn mới", headers, rows);
  };

  return (
    <div id="new-rural-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-600" />
            Xây dựng Nông thôn mới & Đô thị văn minh
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi bộ tiêu chí quốc gia xây dựng đời sống mới kết hợp bản đồ vệ tinh số hóa (GIS)
          </p>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {onExport && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu tiêu chí sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                title="Xuất bản in báo cáo PDF của các tiêu chí"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </div>
          )}

          {/* Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("criteria")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === "criteria" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Tiêu chí đạt chuẩn
            </button>
            <button
              onClick={() => setActiveTab("gis")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === "gis" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Bản đồ địa lý (GIS)
            </button>
          </div>
        </div>
      </div>

      {activeTab === "criteria" ? (
        /* TAB 1: bộ tiêu chí đạt chuẩn */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl">
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Cơ cấu rà soát tiêu chuẩn</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Đạt chuẩn: {criteria.filter(c => c.status === "Đạt").length} / {criteria.length} tiêu chí quốc gia
              </p>
            </div>
            {currentUser?.role !== UserRole.COLLABORATOR && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm tiêu chí mới
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {criteria.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {c.category}
                    </span>
                    
                    {c.status === "Đạt" ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Đạt chuẩn
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 animate-pulse" /> Chưa đạt
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-800 text-base mt-2 leading-tight">{c.name}</h4>
                  
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <p><b>Hiện trạng địa phương:</b> <span className="text-slate-800 font-semibold">{c.value}</span></p>
                    <p><b>Yêu cầu tiêu chuẩn:</b> {c.targetValue}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-400">
                  <span>Cập nhật ngày: {c.lastUpdated}</span>
                  
                  {currentUser?.role !== UserRole.COLLABORATOR && (
                    <button
                      onClick={() => {
                        const nextStatus = c.status === "Đạt" ? "Chưa đạt" : "Đạt";
                        onUpdateCriteria({ ...c, status: nextStatus });
                      }}
                      className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-2.5 py-1 rounded font-bold cursor-pointer"
                    >
                      Đổi trạng thái đạt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* TAB 2: Bản đồ địa lý số hoá GIS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map display box (Interactive vector representation of the neighborhoods) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-2xl h-[480px] relative overflow-hidden shadow-inner">
    <GoogleGISMap
        households={households}
        selectedHouse={selectedHousePin}
        onSelectHouse={setSelectedHousePin}
    />
</div>

          {/* Sidebar Detail showing chosen house details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-[480px]">
            {renderGisDetailPanel()}
          </div>
        </div>
      )}

      {/* FULL-SCREEN GIS MAP OVERLAY MODAL */}
      {isFullscreenMap && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col p-4 md:p-6 overflow-hidden animate-fade-in">
          {/* Header of fullscreen GIS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <Compass className="w-6 h-6 text-emerald-400 animate-spin shrink-0" />
              <div>
                <h3 className="text-white font-bold text-base md:text-lg">Bản đồ địa lý số hoá hành chính & địa chính (GIS)</h3>
                <p className="text-slate-400 text-xs">Cuộn chuột để zoom, kéo rê chuột để di chuyển bản đồ và click chọn từng hộ dân</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setIsFullscreenMap(false);
                setMapZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
            >
              <Minimize2 className="w-4 h-4" />
              Thoát bản đồ lớn
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
            {/* The Map on left */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-inner h-full">
              {renderGisMapContents(true)}
            </div>

            {/* Sidebar details on right */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full overflow-y-auto">
              {renderGisDetailPanel()}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CRITERIA DIALOG */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base">Cấu hình tiêu chí đạt chuẩn mới</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-emerald-100 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewCriteria} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-600">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên chỉ tiêu quốc gia *</label>
                <input
                  type="text"
                  required
                  placeholder="Tỷ lệ phủ sóng internet cáp quang..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân mục tiêu chí</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value="Thu nhập">Thu nhập</option>
                    <option value="Nhà ở">Nhà ở</option>
                    <option value="Môi trường">Môi trường</option>
                    <option value="Giáo dục">Giáo dục</option>
                    <option value="Y tế">Y tế</option>
                    <option value="Lao động">Lao động</option>
                    <option value="Khác">Phân mục khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái thẩm định</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                  >
                    <option value="Đạt">Đạt chuẩn</option>
                    <option value="Chưa đạt">Chưa đạt chuẩn</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giá trị hiện trạng *</label>
                  <input
                    type="text"
                    required
                    placeholder="94.5% số hộ dân"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mục tiêu yêu cầu *</label>
                  <input
                    type="text"
                    required
                    placeholder=">= 95% số hộ dân"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-semibold"
                >
                  Thêm vào bộ rà soát
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
