/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Home, Search, Plus, Edit, Trash2, MapPin, Eye, EyeOff, X, 
  Check, Camera, HelpCircle, FileSpreadsheet, Users, Download, Printer, Image, FileText,
  Maximize2, Minimize2, QrCode
} from "lucide-react";
import { Household, HouseholdStatus, HousingType, User, UserRole, Resident, WaterSource, WasteCollectionStatus, Gender, ResidentStatus, EducationLevel, LaborSector } from "../types";
import { CameraCaptureModal } from "./CameraCaptureModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { CccdQrScannerModal } from "./CccdQrScannerModal";
import MapPickerModal from "./MapPickerModal";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export enum HouseholdGenerationType {
  SINGLE_PARENT = "SINGLE_PARENT", // Chỉ có cha hoặc mẹ sống chung với con
  ONE_GENERATION = "ONE_GENERATION", // Hộ gia đình 1 thế hệ (vợ, chồng)
  TWO_GENERATION = "TWO_GENERATION", // Hộ gia đình 2 thế hệ
  THREE_GENERATION = "THREE_GENERATION", // Hộ gia đình 3 thế hệ trở lên
  OTHER = "OTHER" // Hộ gia đình khác
}

export const getGenerationLabel = (type: HouseholdGenerationType) => {
  switch (type) {
    case HouseholdGenerationType.SINGLE_PARENT:
      return "Chỉ có cha hoặc mẹ sống chung với con";
    case HouseholdGenerationType.ONE_GENERATION:
      return "Hộ gia đình 1 thế hệ (vợ, chồng)";
    case HouseholdGenerationType.TWO_GENERATION:
      return "Hộ gia đình 2 thế hệ";
    case HouseholdGenerationType.THREE_GENERATION:
      return "Hộ gia đình 3 thế hệ trở lên";
    case HouseholdGenerationType.OTHER:
      return "Hộ gia đình khác";
    default:
      return "Không xác định";
  }
};

export function getHouseholdGenerationType(household: Household, allResidents: Resident[]): HouseholdGenerationType {
  const members = allResidents.filter(r => r.householdId === household.id && r.occupation !== "Đã qua đời");
  
  if (members.length === 0) {
    return HouseholdGenerationType.OTHER;
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  
  let hasOwner = false;
  let hasSpouse = false;
  let hasChildren = false;
  let hasParents = false;
  let hasGrandparents = false;
  let hasGrandchildren = false;
  let hasSiblings = false;
  let otherCount = 0;

  members.forEach(m => {
    const rel = normalize(m.relationToOwner || "");
    if (rel === "chủ hộ" || rel === "chủ hộ ") {
      hasOwner = true;
    } else if (rel === "vợ" || rel === "chồng") {
      hasSpouse = true;
    } else if (rel.includes("con") || rel.includes("con trai") || rel.includes("con gái") || rel.includes("con dâu") || rel.includes("con rể")) {
      hasChildren = true;
    } else if (rel.includes("bố") || rel.includes("mẹ") || rel.includes("cha") || rel.includes("mẹ kế") || rel.includes("cha dượng")) {
      hasParents = true;
    } else if (rel.includes("ông") || rel.includes("bà")) {
      hasGrandparents = true;
    } else if (rel.includes("cháu")) {
      hasGrandchildren = true;
    } else if (rel.includes("anh") || rel.includes("chị") || rel.includes("em")) {
      hasSiblings = true;
    } else {
      otherCount++;
    }
  });

  // 1. Single parent with children:
  // - Has children
  // - Only one parent (e.g. hasOwner is true, hasSpouse is false)
  // - No parents, no grandparents, no grandchildren
  if (hasChildren && hasOwner && !hasSpouse && !hasParents && !hasGrandparents && !hasGrandgrandchildren(hasGrandchildren)) {
    return HouseholdGenerationType.SINGLE_PARENT;
  }

  // Helper for checking grandchildren/others to ensure type safety
  function hasGrandgrandchildren(val: boolean) {
    return val;
  }

  // 2. One generation (husband, wife, or single person):
  // - Only owner and/or spouse and/or siblings are present
  // - No children, no parents, no grandparents, no grandchildren
  if (!hasChildren && !hasParents && !hasGrandparents && !hasGrandchildren) {
    return HouseholdGenerationType.ONE_GENERATION;
  }

  // 3. Three generations or more:
  let generationsCount = 0;
  if (hasGrandparents) generationsCount++; // layer -2
  if (hasParents) generationsCount++;      // layer -1
  if (hasOwner || hasSpouse || hasSiblings) generationsCount++; // layer 0
  if (hasChildren) generationsCount++;     // layer 1
  if (hasGrandchildren) generationsCount++; // layer 2

  if (generationsCount >= 3) {
    return HouseholdGenerationType.THREE_GENERATION;
  }

  // 4. Two generations:
  if (generationsCount === 2 || (hasChildren && (hasOwner || hasSpouse)) || (hasParents && (hasOwner || hasSpouse))) {
    return HouseholdGenerationType.TWO_GENERATION;
  }

  return HouseholdGenerationType.OTHER;
}

interface HouseholdViewProps {
  households: Household[];
  residents: Resident[];
  currentUser: User | null;
  onAddHousehold: (household: Household) => void;
  onUpdateHousehold: (household: Household, originalId?: string) => void;
  onDeleteHousehold: (id: string) => void;
  onExport?: (type: "xlsx" | "pdf", title: string, headers: string[], rows: any[][]) => void;
  isMobile?: boolean;
  onSync?: () => Promise<void>;
  offlineQueueCount?: number;
  isSyncing?: boolean;
  isOnline?: boolean;
  onAddResident?: (resident: Resident) => void;
  onUpdateResident?: (resident: Resident) => void;
  existingEntityIds?: Set<string>;
}

export default function HouseholdView({ 
  households, residents, currentUser, onAddHousehold, onUpdateHousehold, onDeleteHousehold, onExport, isMobile = false,
  onSync, offlineQueueCount = 0, isSyncing = false, isOnline = true, onAddResident, onUpdateResident, existingEntityIds
}: HouseholdViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [householdToDelete, setHouseholdToDelete] = useState<{ id: string; ownerName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [wasteFeeFilter, setWasteFeeFilter] = useState<string>("ALL");
  const [waterSourceFilter, setWaterSourceFilter] = useState<string>("ALL");
  const [agriFilter, setAgriFilter] = useState<string>("ALL");
  const [nonAgriTaxFilter, setNonAgriTaxFilter] = useState<string>("ALL");
  const [generationFilter, setGenerationFilter] = useState<string>("ALL");
  const [isClassificationVisible, setIsClassificationVisible] = useState(true);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formId, setFormId] = useState("");
  const [originalFormId, setOriginalFormId] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formWard, setFormWard] = useState("Tổ 5");
  const [formStatus, setFormStatus] = useState<HouseholdStatus>(HouseholdStatus.AVERAGE);
  const [formHousingType, setFormHousingType] = useState<HousingType>(HousingType.NO);
  const [formNonAgriTax, setFormNonAgriTax] = useState<string>("Chưa nộp");
  const [formCultural, setFormCultural] = useState(false);
  const [formPolicy, setFormPolicy] = useState(false);
  const [formMeritorious, setFormMeritorious] = useState(false);
  const [formWasteFeePaid, setFormWasteFeePaid] = useState(false);
  const [formWasteCollectionStatus, setFormWasteCollectionStatus] = useState<WasteCollectionStatus>(WasteCollectionStatus.REGISTERED);
  const [formWaterSource, setFormWaterSource] = useState<WaterSource>(WaterSource.TAP_WATER);
  const [formGpsLat, setFormGpsLat] = useState<number | undefined>();
  const [formGpsLng, setFormGpsLng] = useState<number | undefined>();
  const [formPhoto, setFormPhoto] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formCustomFields, setFormCustomFields] = useState<{ key: string; value: string }[]>([]);

  // Detailed Owner Resident States
  const [ownerCccd, setOwnerCccd] = useState("");
  const [ownerOldCmnd, setOwnerOldCmnd] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerGender, setOwnerGender] = useState<Gender>(Gender.MALE);
  const [ownerResidentStatus, setOwnerResidentStatus] = useState<ResidentStatus>(ResidentStatus.PERMANENT);
  const [ownerEthnicity, setOwnerEthnicity] = useState("Kinh");
  const [ownerReligion, setOwnerReligion] = useState("Không");
  const [ownerEducation, setOwnerEducation] = useState<EducationLevel>(EducationLevel.NONE);
  const [ownerOccupation, setOwnerOccupation] = useState("Lao động tự do");
  const [ownerInsuranceId, setOwnerInsuranceId] = useState("");
  const [ownerSubsidyType, setOwnerSubsidyType] = useState("Không");
  const [ownerIsDisabled, setOwnerIsDisabled] = useState(false);
  const [ownerTemporaryAddress, setOwnerTemporaryAddress] = useState("");
  const [ownerPermanentAddress, setOwnerPermanentAddress] = useState("");
  
  const [simulatingGps, setSimulatingGps] = useState(false);
  const [simulatingCamera, setSimulatingCamera] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMapsPickerOpen, setIsMapsPickerOpen] = useState(false);
  
  // Filtered households
  const filteredHouseholds = households.filter(h => {
    const matchesCustomFields = h.customFields && Object.entries(h.customFields).some(([k, v]) => 
      k.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesSearch = 
      h.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.ownerOldCmnd || residents.find(r => r.id === h.ownerId)?.oldCmnd || "").includes(searchQuery) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      !!matchesCustomFields;
    const matchesStatus = statusFilter === "ALL" || h.status === statusFilter;
    const matchesWasteFee = 
      wasteFeeFilter === "ALL" ||
      (wasteFeeFilter === "REGISTERED" && h.wasteCollectionStatus === WasteCollectionStatus.REGISTERED) ||
      (wasteFeeFilter === "UNREGISTERED" && h.wasteCollectionStatus === WasteCollectionStatus.UNREGISTERED) ||
      (wasteFeeFilter === "CANCELLED" && h.wasteCollectionStatus === WasteCollectionStatus.CANCELLED) ||
      // Legacy support
      (wasteFeeFilter === "PAID" && h.isWasteFeePaid) ||
      (wasteFeeFilter === "UNPAID" && !h.isWasteFeePaid);
    const matchesWaterSource =
      waterSourceFilter === "ALL" ||
      (waterSourceFilter === "TAP" && h.waterSource === WaterSource.TAP_WATER) ||
      (waterSourceFilter === "WELL" && h.waterSource === WaterSource.WELL_WATER);
    const matchesAgri = agriFilter === "ALL" || h.housingType === agriFilter;
    const matchesNonAgriTax = nonAgriTaxFilter === "ALL" || (h.nonAgriTax || "Chưa nộp") === nonAgriTaxFilter;
    const genType = getHouseholdGenerationType(h, residents);
    const matchesGeneration = generationFilter === "ALL" || genType === generationFilter;
    return matchesSearch && matchesStatus && matchesWasteFee && matchesWaterSource && matchesAgri && matchesNonAgriTax && matchesGeneration;
  });

  const handleCccdScanSuccess = (data: {
    cccd: string;
    oldCmnd?: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
  }) => {
    setFormOwnerName(data.fullName);
    setOwnerCccd(data.cccd);
    setOwnerOldCmnd(data.oldCmnd || "");
    setFormOwnerId(data.cccd);
    setOwnerBirthDate(data.birthDate);
    
    if (data.gender === "Nam") {
      setOwnerGender(Gender.MALE);
    } else if (data.gender === "Nữ") {
      setOwnerGender(Gender.FEMALE);
    } else {
      setOwnerGender(Gender.OTHER);
    }
    
    setFormAddress(data.address);
    setOwnerPermanentAddress(data.address);
    
    const matchWard = data.address.match(/Tổ\s+(\d+)/i);
    if (matchWard) {
      setFormWard(`Tổ ${matchWard[1]}`);
    }
  };
 
  // Handle open form
  const openAddForm = () => {
    setFormMode("add");
    setIsZoomed(false);
    setFormId(`HỘ-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormOwnerName("");
    setFormOwnerId("");
    setFormAddress("");
    setFormWard("Tổ 5");
    setFormStatus(HouseholdStatus.AVERAGE);
    setFormHousingType(HousingType.NO);
    setFormNonAgriTax("Chưa nộp");
    setFormCultural(true);
    setFormPolicy(false);
    setFormMeritorious(false);
    setFormWasteFeePaid(false);
    setFormWasteCollectionStatus(WasteCollectionStatus.REGISTERED);
    setFormWaterSource(WaterSource.TAP_WATER);
    setFormGpsLat(undefined);
    setFormGpsLng(undefined);
    setFormPhoto("");
    setFormNotes("");
    setFormCustomFields([]);

    // Reset owner resident fields
    setOwnerCccd("");
    setOwnerOldCmnd("");
    setOwnerPhone("");
    setOwnerBirthDate("");
    setOwnerGender(Gender.MALE);
    setOwnerResidentStatus(ResidentStatus.PERMANENT);
    setOwnerEthnicity("Kinh");
    setOwnerReligion("Không");
    setOwnerEducation(EducationLevel.NONE);
    setOwnerOccupation("Lao động tự do");
    setOwnerInsuranceId("");
    setOwnerSubsidyType("Không");
    setOwnerIsDisabled(false);
    setOwnerTemporaryAddress("");
    setOwnerPermanentAddress("");

    setIsFormOpen(true);
  };

  const openEditForm = (h: Household) => {
    setFormMode("edit");
    setIsZoomed(false);
    setFormId(h.id);
    setOriginalFormId(h.id);
    setFormOwnerName(h.ownerName);
    setFormOwnerId(h.ownerId);
    setFormAddress(h.address);
    setFormWard(h.wardId);
    setFormStatus(h.status);
    setFormHousingType(h.housingType);
    setFormNonAgriTax(h.nonAgriTax || "Chưa nộp");
    setFormCultural(h.isCulturalFamily);
    setFormPolicy(h.isPolicyFamily);
    setFormMeritorious(h.isMeritoriousFamily);
    setFormWasteFeePaid(!!h.isWasteFeePaid);
    setFormWasteCollectionStatus(h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED));
    setFormWaterSource(h.waterSource || WaterSource.TAP_WATER);
    setFormGpsLat(h.gpsLat);
    setFormGpsLng(h.gpsLng);
    setFormPhoto(h.photoUrl || "");
    setFormNotes(h.notes || "");
    if (h.customFields) {
      setFormCustomFields(Object.entries(h.customFields).map(([key, value]) => ({ key, value })));
    } else {
      setFormCustomFields([]);
    }

    // Populate owner resident fields if owner exists
    const ownerRes = residents.find(r => r.id === h.ownerId || (r.fullName === h.ownerName && r.relationToOwner === "Chủ hộ" && r.householdId === h.id));
    if (ownerRes) {
      setOwnerCccd(ownerRes.id);
      setOwnerOldCmnd(ownerRes.oldCmnd || h.ownerOldCmnd || "");
      setOwnerPhone(ownerRes.phone || "");
      setOwnerBirthDate(ownerRes.birthDate || "");
      setOwnerGender(ownerRes.gender || Gender.MALE);
      setOwnerResidentStatus(ownerRes.status || ResidentStatus.PERMANENT);
      setOwnerEthnicity(ownerRes.ethnicity || "Kinh");
      setOwnerReligion(ownerRes.religion || "Không");
      setOwnerEducation(ownerRes.education || EducationLevel.NONE);
      setOwnerOccupation(ownerRes.occupation || "Lao động tự do");
      setOwnerInsuranceId(ownerRes.insuranceId || "");
      setOwnerSubsidyType(ownerRes.subsidyType || "Không");
      setOwnerIsDisabled(!!ownerRes.isDisabled);
      setOwnerTemporaryAddress(ownerRes.temporaryAddress || "");
      setOwnerPermanentAddress(ownerRes.permanentAddress || "");
    } else {
      setOwnerCccd(h.ownerId || "");
      setOwnerOldCmnd(h.ownerOldCmnd || "");
      setOwnerPhone("");
      setOwnerBirthDate("");
      setOwnerGender(Gender.MALE);
      setOwnerResidentStatus(ResidentStatus.PERMANENT);
      setOwnerEthnicity("Kinh");
      setOwnerReligion("Không");
      setOwnerEducation(EducationLevel.NONE);
      setOwnerOccupation("Lao động tự do");
      setOwnerInsuranceId("");
      setOwnerSubsidyType("Không");
      setOwnerIsDisabled(false);
      setOwnerTemporaryAddress("");
      setOwnerPermanentAddress("");
    }

    setIsFormOpen(true);
  };

  const handleUseCurrentLocation = () => {
    setSimulatingGps(true);
    if (!navigator.geolocation) {
      setSimulatingGps(false);
      alert("Trình duyệt không hỗ trợ định vị. Hãy chọn vị trí trên Google Maps.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormGpsLat(Number(position.coords.latitude.toFixed(6)));
        setFormGpsLng(Number(position.coords.longitude.toFixed(6)));
        setSimulatingGps(false);
      },
      () => {
        setSimulatingGps(false);
        alert("Không lấy được vị trí hiện tại. Hãy cho phép quyền vị trí hoặc chọn trực tiếp trên Google Maps.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Camera Simulation
  const handleSimulateCamera = () => {
    setSimulatingCamera(true);
    setTimeout(() => {
      // Simulated picture URL of Vietnamese standard household facade
      setFormPhoto("https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=80");
      setSimulatingCamera(false);
    }, 1000);
  };

  // Handle Photo upload with client-side Data URL FileReader & Compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const img = new window.Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxWidth = 600;
            const maxHeight = 600;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              setFormPhoto(dataUrl);
            } else {
              setFormPhoto(reader.result as string);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOwnerName.trim() || !formAddress.trim()) {
      alert("Vui lòng nhập đầy đủ Tên chủ hộ và Địa chỉ!");
      return;
    }
    if (!ownerCccd.trim()) {
      alert("Vui lòng nhập số CCCD của chủ hộ!");
      return;
    }
    if (ownerResidentStatus === ResidentStatus.TEMPORARY_STAY && !ownerTemporaryAddress.trim()) {
      alert("Vui lòng nhập địa chỉ hiện tại (Tạm trú) của chủ hộ!");
      return;
    }

    const customFieldsObj: Record<string, string> = {};
    formCustomFields.forEach(field => {
      if (field.key.trim()) {
        customFieldsObj[field.key.trim()] = field.value;
      }
    });

    const finalOwnerId = ownerCccd.trim() || formOwnerId || `RES-${Date.now()}`;

    const householdData: Household = {
      id: formId,
      ownerId: finalOwnerId,
      ownerOldCmnd: ownerOldCmnd.trim() || undefined,
      ownerName: formOwnerName,
      address: formAddress,
      wardId: formWard,
      quarterId: undefined,
      createdAt: new Date().toISOString().split("T")[0],
      status: formStatus,
      isCulturalFamily: formCultural,
      isPolicyFamily: formPolicy,
      isMeritoriousFamily: formMeritorious,
      isWasteFeePaid: formWasteCollectionStatus === WasteCollectionStatus.REGISTERED,
      wasteCollectionStatus: formWasteCollectionStatus,
      waterSource: formWaterSource,
      housingType: formHousingType,
      nonAgriTax: formNonAgriTax,
      gpsLat: formGpsLat,
      gpsLng: formFormGpsLngOverride(),
      photoUrl: formPhoto,
      notes: formNotes,
      customFields: customFieldsObj
    };

    const ownerResidentData: Resident = {
      id: finalOwnerId,
      oldCmnd: ownerOldCmnd.trim() || undefined,
      fullName: formOwnerName,
      birthDate: ownerBirthDate,
      gender: ownerGender,
      relationToOwner: "Chủ hộ",
      nationalId: finalOwnerId,
      phone: ownerPhone,
      status: ownerResidentStatus,
      ethnicity: ownerEthnicity,
      religion: ownerReligion,
      nationality: "Việt Nam",
      education: ownerEducation,
      occupation: ownerOccupation,
      householdId: formId,
      wardId: formWard,
      permanentAddress: ownerPermanentAddress || formAddress,
      temporaryAddress: ownerResidentStatus === ResidentStatus.TEMPORARY_STAY ? ownerTemporaryAddress : undefined,
      insuranceId: ownerInsuranceId || undefined,
      isDisabled: ownerIsDisabled,
      subsidyType: ownerSubsidyType !== "Không" ? ownerSubsidyType : undefined,
      isEmployed: ownerOccupation !== "Thất nghiệp" && ownerOccupation !== "Đã nghỉ hưu",
      laborSector: LaborSector.SERVICE,
    };

    if (formMode === "add") {
      onAddHousehold(householdData);
      if (onAddResident) {
        onAddResident(ownerResidentData);
      }
    } else {
      onUpdateHousehold(householdData, originalFormId);
      const existingOwner = residents.find(r => r.id === finalOwnerId || (r.fullName === formOwnerName && r.relationToOwner === "Chủ hộ" && r.householdId === formId));
      if (existingOwner) {
        if (onUpdateResident) {
          onUpdateResident({ ...ownerResidentData, id: existingOwner.id });
        }
      } else {
        if (onAddResident) {
          onAddResident(ownerResidentData);
        }
      }
    }
    setIsFormOpen(false);
  };

  const formFormGpsLngOverride = () => {
    return formGpsLng;
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    if (!onExport) return;
    
    // Extract any unique custom fields from the active households
    const customKeys = new Set<string>();
    filteredHouseholds.forEach(h => {
      if (h.customFields) {
        Object.keys(h.customFields).forEach(k => customKeys.add(k));
      }
    });
    const customKeysArray = Array.from(customKeys);

    const headers = [
      "STT", "Mã Hộ", "CCCD Chủ Hộ", "Số CMND cũ Chủ Hộ", "Họ Tên Chủ Hộ", "Số ĐT Chủ Hộ", "Địa Chỉ", "Tổ dân phố",
      "Phân Loại Thế Hệ", "Ngày Tạo", "Trạng Thái", "Nước Sạch", "Thu Gom Rác", "Hộ Nông Nghiệp", "Ghi Chú",
      ...customKeysArray
    ];
    const rows = filteredHouseholds.map((h, idx) => {
      const ownerResident = residents.find(r => r.id === h.ownerId);
      const ownerPhone = ownerResident?.phone || "";
      const ownerOldCmnd = h.ownerOldCmnd || ownerResident?.oldCmnd || "";
      const customValues = customKeysArray.map(k => (h.customFields?.[k] || ""));
      const genType = getHouseholdGenerationType(h, residents);
      const genLabel = getGenerationLabel(genType);
      return [
        idx + 1,
        h.id,
        h.ownerId,
        ownerOldCmnd,
        h.ownerName,
        ownerPhone,
        h.address,
        h.wardId || "N/A",
        genLabel,
        h.createdAt,
        h.status,
        h.waterSource || "Chưa cập nhật",
        h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký"),
        h.housingType,
        h.notes || "",
        ...customValues
      ];
    });
    const feeStatusName = wasteFeeFilter === "REGISTERED" ? "Da dang ky" : wasteFeeFilter === "UNREGISTERED" ? "Chua dang ky" : wasteFeeFilter === "CANCELLED" ? "Da huy" : "Tat ca thu gom rac";
    const waterSourceName = waterSourceFilter === "TAP" ? "Nuoc may" : waterSourceFilter === "WELL" ? "Nuoc gieng" : "Tat ca nguon nuoc";
    onExport(type, `Danh sach Ho gia dinh (${feeStatusName} - ${waterSourceName})`, headers, rows);
  };

  const genCounts = {
    [HouseholdGenerationType.SINGLE_PARENT]: 0,
    [HouseholdGenerationType.ONE_GENERATION]: 0,
    [HouseholdGenerationType.TWO_GENERATION]: 0,
    [HouseholdGenerationType.THREE_GENERATION]: 0,
    [HouseholdGenerationType.OTHER]: 0,
  };

  households.forEach(h => {
    const type = getHouseholdGenerationType(h, residents);
    genCounts[type]++;
  });

  return (
    <div id="household-view-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-600" />
            Quản lý hộ gia đình
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách sổ hộ khẩu, phân loại hộ dân, an sinh xã hội & định vị GPS nhà ở
          </p>
        </div>

        {/* Action Buttons (Export & Create) */}
        <div className="flex flex-wrap items-center gap-2">
          {onExport && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors c[...]"
                title="Xuất bảng dữ li���u hộ gia đình hiện tại sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointe[...]"
                title="Xuất bản in báo cáo PDF của các hộ gia đình"
              >
                <Printer className="w-3.5 h-3.5" />
                Xuất PDF (In)
              </button>
            </>
          )}

          {true && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-xs font-semibold shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tạo hộ gia đình mới
            </button>
          )}
        </div>
      </div>

      {/* Thanh công cụ tìm kiếm hộ dân nhanh chóng */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 md:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-4 h-4 text-emerald-600 animate-pulse" />
              Công cụ tra cứu sổ hộ khẩu & chủ hộ nhanh chóng
            </h3>
            <p className="text-xs text-emerald-800/80 mt-1">
              Nhập mã hộ gia đình (mã số sổ) hoặc họ tên của chủ hộ để định vị và trích xuất thông tin nhanh.
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors shadow-xs cursor-pointer f[...]"
            >
              <X className="w-3.5 h-3.5" />
              Xóa từ khóa
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-emerald-600" />
          <input
            type="text"
            placeholder="Gõ mã hộ (ví dụ: HỘ-12345) hoặc tên chủ hộ (ví dụ: Nguyễn Văn A) để tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-emerald-200/60 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:rin[...]"
          />
        </div>

        {households.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Gợi ý tìm nhanh:</span>
            {households.slice(0, 3).map((h) => (
              <button
                key={`id-${h.id}`}
                onClick={() => setSearchQuery(h.id)}
                className="bg-white/80 hover:bg-emerald-500 hover:text-white text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100 transition-all cursor-pointer font-medium text-[11[...]"
                title={`Tìm nhanh mã hộ ${h.id}`}
              >
                {h.id}
              </button>
            ))}
            {households.slice(0, 3).map((h) => (
              <button
                key={`owner-${h.ownerName}`}
                onClick={() => setSearchQuery(h.ownerName)}
                className="bg-white/80 hover:bg-emerald-500 hover:text-white text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100 transition-all cursor-pointer font-medium text-[11[..]"
                title={`Tìm nhanh chủ hộ ${h.ownerName}`}
              >
                {h.ownerName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bảng phân loại thế hệ (Bản gốc từ Ảnh) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
... (file continues unchanged) ...
