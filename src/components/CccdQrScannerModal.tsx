import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, AlertCircle, Upload, QrCode, Clipboard, Check, Sparkles } from "lucide-react";
import jsQR from "jsqr";

interface CccdQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: {
    cccd: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
  }) => void;
}

const SAMPLE_CCCD_STRINGS = [
  {
    label: "Mẫu 1: Nguyễn Văn An (Nam, sinh 1995, Tổ 3)",
    value: "038095012345||Nguyễn Văn An|15051995|Nam|Số 12, Tổ 3, Phường Ninh Phú, Thị xã Ninh Hòa, Tỉnh Khánh Hòa|20052021"
  },
  {
    label: "Mẫu 2: Trần Thị Bích (Nữ, sinh 1998, Tổ 5)",
    value: "079096009876||Trần Thị Bích|24121998|Nữ|Hẻm 15, Đường 2/4, Tổ 5, Phường Ninh Phú, Thị xã Ninh Hòa, Tỉnh Khánh Hòa|12082022"
  },
  {
    label: "Mẫu 3: Lê Minh Hải (Nam, sinh 1987, Tổ 2)",
    value: "036087004321||Lê Minh Hải|02021987|Nam|Đường Số 8, Tổ 2, Phường Ninh Phú, Thị xã Ninh Hòa, Tỉnh Khánh Hòa|15112020"
  }
];

export const CccdQrScannerModal: React.FC<CccdQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "simulate">("camera");
  const [dragActive, setDragActive] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError(
        "Không thể mở Camera. Vui lòng cấp quyền sử dụng camera hoặc chuyển sang tab 'Tải ảnh lên' / 'Mô phỏng' để tiếp tục."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Real-time camera QR parsing loop
  useEffect(() => {
    if (!stream || activeTab !== "camera" || !isOpen) return;

    let animFrameId: number;
    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scanFrame = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
          });

          if (code && code.data) {
            const parsed = handleParseCccdString(code.data);
            if (parsed) {
              onScanSuccess(parsed);
              stopCamera();
              onClose();
              return; // Stop scan loop
            }
          }
        }
      }
      animFrameId = requestAnimationFrame(scanFrame);
    };

    animFrameId = requestAnimationFrame(scanFrame);
    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [stream, activeTab, isOpen]);

  // CCCD QR parser
  const handleParseCccdString = (qrString: string) => {
    if (!qrString || !qrString.includes("|")) {
      return null;
    }

    try {
      const parts = qrString.split("|");
      if (parts.length < 5) return null;

      const cccd = parts[0]?.trim() || "";
      const fullName = parts[2]?.trim() || "";
      const rawBirth = parts[3]?.trim() || ""; // DDMMYYYY
      const rawGender = parts[4]?.trim() || "Nam";
      const address = parts[5]?.trim() || "";

      // Format birthdate from DDMMYYYY to YYYY-MM-DD
      let birthDate = "";
      if (rawBirth && rawBirth.length === 8) {
        const d = rawBirth.substring(0, 2);
        const m = rawBirth.substring(2, 4);
        const y = rawBirth.substring(4, 8);
        birthDate = `${y}-${m}-${d}`;
      }

      return {
        cccd,
        fullName,
        birthDate,
        gender: rawGender,
        address
      };
    } catch (e) {
      console.error("CCCD QR Parse error:", e);
      return null;
    }
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processImageFile = (file: File) => {
    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code && code.data) {
            const parsed = handleParseCccdString(code.data);
            if (parsed) {
              onScanSuccess(parsed);
              onClose();
            } else {
              setStatusMessage("Tìm thấy QR Code nhưng nội dung không đúng định dạng CCCD Việt Nam.");
            }
          } else {
            setStatusMessage("Không phát hiện thấy QR Code nào trong bức ảnh này. Vui lòng thử ảnh chụp rõ hơn.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = handleParseCccdString(manualInput);
    if (parsed) {
      onScanSuccess(parsed);
      onClose();
    } else {
      setStatusMessage("Nội dung không hợp lệ. Chuỗi CCCD QR phải tuân theo cấu trúc dấu gạch dọc (|).");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">Quét QR CCCD Nhập Liệu Tự Động</h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Tự động điền thông tin nhân khẩu và chủ hộ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab("camera"); setStatusMessage(null); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "camera" 
                ? "bg-white text-emerald-800 shadow-sm border border-slate-150" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Camera className="w-3.5 h-3.5 inline mr-1.5 shrink-0" />
            Quét bằng Camera
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("upload"); setStatusMessage(null); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "upload" 
                ? "bg-white text-emerald-800 shadow-sm border border-slate-150" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Upload className="w-3.5 h-3.5 inline mr-1.5 shrink-0" />
            Tải ảnh lên
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("simulate"); setStatusMessage(null); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "simulate" 
                ? "bg-white text-emerald-800 shadow-sm border border-slate-150" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 shrink-0" />
            Mô phỏng/Phát triển
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 min-h-[280px] flex flex-col justify-center">
          
          {statusMessage && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB 1: CAMERA SCANNER */}
          {activeTab === "camera" && (
            <div className="space-y-4">
              <div className="relative bg-slate-950 aspect-video rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-10">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <p className="text-xs font-semibold text-slate-300">Đang kích hoạt máy ảnh...</p>
                  </div>
                )}

                {error ? (
                  <div className="p-6 text-center text-white flex flex-col items-center gap-3 z-10">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <p className="text-xs font-semibold text-slate-300 max-w-sm leading-relaxed">{error}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Scanner scanning overlay line effect */}
                    {!isLoading && stream && (
                      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-44 border-2 border-emerald-500/60 rounded-xl flex items-center justify-center">
                        {/* Red flashing line */}
                        <div className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-md shadow-red-500/50 animate-pulse"></div>
                        <span className="absolute bottom-2 text-[10px] bg-slate-900/85 px-3 py-1 rounded-full text-emerald-400 font-bold tracking-wider">
                          ĐƯA QUÉT QR CCCD VÀO KHUNG
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Đưa mặt trước thẻ CCCD gắn chip (phần mã QR ở góc trên bên phải) lại gần camera để hệ thống tự động phát hiện và điền thông tin.
              </p>
            </div>
          )}

          {/* TAB 2: IMAGE UPLOAD */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition ${
                  dragActive 
                    ? "border-emerald-500 bg-emerald-50/45 text-emerald-800" 
                    : "border-slate-200 hover:border-emerald-400 bg-slate-50/20"
                }`}
                onClick={() => document.getElementById("cccd-qr-upload")?.click()}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-xs">
                  <Upload className="w-6 h-6 text-slate-500" />
                </div>
                <input
                  id="cccd-qr-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">Kéo thả ảnh hoặc click để chọn</p>
                  <p className="text-[10px] text-slate-400">Chấp nhận định dạng JPG, PNG, WEBP chứa QR Code</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Bạn có thể chụp màn hình mã QR hoặc chụp ảnh thẻ CCCD rồi tải lên đây để giải mã dữ liệu an sinh xã hội.
              </p>
            </div>
          )}

          {/* TAB 3: SIMULATION / DEMO TESTING */}
          {activeTab === "simulate" && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Mẫu CCCD Thử Nghiệm Nhanh</span>
                
                <div className="space-y-2">
                  {SAMPLE_CCCD_STRINGS.map((sample, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl flex items-center justify-between text-xs transition shadow-2xs group"
                    >
                      <div className="font-semibold text-slate-700 pr-2 leading-tight">
                        {sample.label}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setManualInput(sample.value);
                            setStatusMessage(null);
                            const parsed = handleParseCccdString(sample.value);
                            if (parsed) {
                              onScanSuccess(parsed);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg text-[10px] cursor-pointer"
                        >
                          Chọn mẫu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(sample.value);
                            setCopiedIndex(idx);
                            setTimeout(() => setCopiedIndex(null), 1500);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Sao chép chuỗi QR"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clipboard className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase">Hoặc dán chuỗi QR Code thu hoạch từ đầu đọc:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Dán chuỗi QR CCCD tại đây..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-emerald-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Giải mã
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 flex justify-end border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95"
          >
            Đóng lại
          </button>
        </div>

      </div>
    </div>
  );
};
