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
  const [formGpsLat, setFormGpsLat] = useState<number | undefined>(10.7769);
  const [formGpsLng, setFormGpsLng] = useState<number | undefined>(106.7009);
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
    cmnd: string;
    fullName: string;
    birthDate: string;
    gender: string;
    address: string;
  }) => {
    setFormOwnerName(data.fullName);
    setOwnerCccd(data.cccd);
    setOwnerOldCmnd(data.cmnd || "");
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
    setFormGpsLat(10.77 + Math.random() * 0.02);
    setFormGpsLng(106.69 + Math.random() * 0.02);
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

  // Map any coordinate into the Phường Bình Minh, Tây Ninh boundary
  const mapToBinhMinh = (lat: number, lng: number) => {
    const minLat = 11.330;
    const maxLat = 11.365;
    const minLng = 106.110;
    const maxLng = 106.145;

    // If already inside, keep it
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return { lat, lng };
    }

    // Map other provinces/cities (e.g. HCMC ~10.7-10.8, Hanoi ~20.9-21.0, etc.)
    // proportionally into our sector
    let latPct = (lat % 0.1) / 0.1;
    let lngPct = (lng % 0.1) / 0.1;

    if (lat >= 10.0 && lat <= 11.5 && lng >= 106.0 && lng <= 107.0) {
      latPct = (lat - 10.75) / 0.05;
      lngPct = (lng - 106.68) / 0.04;
    } else if (lat >= 20.5 && lat <= 21.5 && lng >= 105.5 && lng <= 106.5) {
      latPct = (lat - 20.95) / 0.05;
      lngPct = (lng - 105.78) / 0.05;
    }

    latPct = Math.min(Math.max(Math.abs(latPct) % 1.0, 0), 1);
    lngPct = Math.min(Math.max(Math.abs(lngPct) % 1.0, 0), 1);

    const finalLat = minLat + latPct * (maxLat - minLat);
    const finalLng = minLng + lngPct * (maxLng - minLng);

    return {
      lat: parseFloat(finalLat.toFixed(6)),
      lng: parseFloat(finalLng.toFixed(6))
    };
  };

  // GPS Simulation
  const handleSimulateGps = () => {
    setSimulatingGps(true);
    setTimeout(() => {
      // Simulate GPS capture in Phường Bình Minh, Tây Ninh
      const rawLat = 11.330 + Math.random() * 0.035;
      const rawLng = 106.110 + Math.random() * 0.035;
      const { lat, lng } = mapToBinhMinh(rawLat, rawLng);
      setFormGpsLat(lat);
      setFormGpsLng(lng);
      setSimulatingGps(false);
    }, 1200);
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
          const img = new Image();
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
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                title="Xuất bảng dữ liệu hộ gia đình hiện tại sang tệp Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
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
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
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
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-emerald-200/60 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
          />
        </div>

        {households.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Gợi ý tìm nhanh:</span>
            {households.slice(0, 3).map((h) => (
              <button
                key={`id-${h.id}`}
                onClick={() => setSearchQuery(h.id)}
                className="bg-white/80 hover:bg-emerald-500 hover:text-white text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100 transition-all cursor-pointer font-medium text-[11px]"
                title={`Tìm nhanh mã hộ ${h.id}`}
              >
                {h.id}
              </button>
            ))}
            {households.slice(0, 3).map((h) => (
              <button
                key={`owner-${h.ownerName}`}
                onClick={() => setSearchQuery(h.ownerName)}
                className="bg-white/80 hover:bg-emerald-500 hover:text-white text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100 transition-all cursor-pointer font-medium text-[11px]"
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Bảng phân loại tiêu chí hộ gia đình (Theo Thế Hệ & Thành Phần)
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              * Nhấp vào từng dòng để lọc nhanh danh sách hộ dân và xuất báo cáo tương ứng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsClassificationVisible(!isClassificationVisible)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              title={isClassificationVisible ? "Ẩn bảng phân loại" : "Hiện bảng phân loại"}
            >
              {isClassificationVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  Ẩn bảng
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  Hiện bảng
                </>
              )}
            </button>
            {onSync && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border ${
                  offlineQueueCount > 0
                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 animate-pulse"
                    : isSyncing
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                }`}
                title="Đồng bộ tất cả dữ liệu tức thời lên máy chủ Ninh Phú"
              >
                <Users className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Đang đồng bộ..." : offlineQueueCount > 0 ? `Đồng bộ ngay (${offlineQueueCount})` : "Đồng bộ lại tất cả dữ liệu"}
              </button>
            )}
            {generationFilter !== "ALL" && (
              <button
                onClick={() => setGenerationFilter("ALL")}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer bg-none border-none"
              >
                <X className="w-3.5 h-3.5" />
                Xóa bộ lọc phân loại
              </button>
            )}
          </div>
        </div>

        {isClassificationVisible && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                  <th className="p-3 pl-4">Tiêu chí phân loại hộ gia đình</th>
                  <th className="p-3 w-28 text-center border-l border-slate-200">Đơn vị tính</th>
                  <th className="p-3 w-32 text-right pr-6 border-l border-slate-200">Số lượng thực tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {/* Tổng số hộ gia đình */}
                <tr 
                  onClick={() => setGenerationFilter("ALL")}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === "ALL" 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4 font-semibold">Tổng số hộ gia đình</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{households.length}</td>
                </tr>

                {/* Chỉ có cha hoặc mẹ sống chung với con */}
                <tr 
                  onClick={() => setGenerationFilter(HouseholdGenerationType.SINGLE_PARENT)}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === HouseholdGenerationType.SINGLE_PARENT 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4">Số hộ gia đình chỉ có cha hoặc mẹ sống chung với con</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{genCounts[HouseholdGenerationType.SINGLE_PARENT]}</td>
                </tr>

                {/* 1 thế hệ (vợ, chồng) */}
                <tr 
                  onClick={() => setGenerationFilter(HouseholdGenerationType.ONE_GENERATION)}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === HouseholdGenerationType.ONE_GENERATION 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4">Số hộ gia đình 1 thế hệ (vợ, chồng)</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{genCounts[HouseholdGenerationType.ONE_GENERATION]}</td>
                </tr>

                {/* 2 thế hệ */}
                <tr 
                  onClick={() => setGenerationFilter(HouseholdGenerationType.TWO_GENERATION)}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === HouseholdGenerationType.TWO_GENERATION 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4">Số hộ gia đình 2 thế hệ</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{genCounts[HouseholdGenerationType.TWO_GENERATION]}</td>
                </tr>

                {/* 3 thế hệ trở lên */}
                <tr 
                  onClick={() => setGenerationFilter(HouseholdGenerationType.THREE_GENERATION)}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === HouseholdGenerationType.THREE_GENERATION 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4">Số hộ gia đình 3 thế hệ trở lên</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{genCounts[HouseholdGenerationType.THREE_GENERATION]}</td>
                </tr>

                {/* Hộ gia đình khác */}
                <tr 
                  onClick={() => setGenerationFilter(HouseholdGenerationType.OTHER)}
                  className={`cursor-pointer transition-colors ${
                    generationFilter === HouseholdGenerationType.OTHER 
                      ? "bg-emerald-50 hover:bg-emerald-100/80 font-extrabold text-emerald-950 border-l-4 border-l-emerald-600" 
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="p-3 pl-4">Số hộ gia đình khác</td>
                  <td className="p-3 text-center text-slate-500 font-medium border-l border-slate-150">Hộ</td>
                  <td className="p-3 text-right pr-6 font-extrabold text-slate-900 border-l border-slate-150">{genCounts[HouseholdGenerationType.OTHER]}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter and Search rail */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên chủ hộ, mã hộ, hoặc địa chỉ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600 focus:bg-white"
          />
        </div>

        <div className="sm:w-52">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả tình trạng hộ</option>
            <option value={HouseholdStatus.POOR}>Hộ nghèo</option>
            <option value={HouseholdStatus.NEAR_POOR}>Hộ cận nghèo</option>
            <option value={HouseholdStatus.AVERAGE}>Hộ trung bình</option>
            <option value={HouseholdStatus.FAIR}>Hộ khá</option>
            <option value={HouseholdStatus.RICH}>Hộ giàu</option>
          </select>
        </div>

        <div className="sm:w-56">
          <select
            value={wasteFeeFilter}
            onChange={(e) => setWasteFeeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả thu gom rác</option>
            <option value="REGISTERED">Đã đăng ký</option>
            <option value="UNREGISTERED">Chưa đăng ký</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>

        <div className="sm:w-56">
          <select
            value={waterSourceFilter}
            onChange={(e) => setWaterSourceFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả nguồn nước sạch</option>
            <option value="TAP">Nước máy</option>
            <option value="WELL">Nước giếng</option>
          </select>
        </div>

        <div className="sm:w-56">
          <select
            value={agriFilter}
            onChange={(e) => setAgriFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả Hộ nông nghiệp</option>
            <option value={HousingType.YES}>Hộ nông nghiệp: Có</option>
            <option value={HousingType.NO}>Hộ nông nghiệp: Không</option>
          </select>
        </div>

        <div className="sm:w-56">
          <select
            value={nonAgriTaxFilter}
            onChange={(e) => setNonAgriTaxFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-emerald-600"
          >
            <option value="ALL">Tất cả Thuế PNN</option>
            <option value="Đã nộp">Thuế PNN: Đã nộp</option>
            <option value="Chưa nộp">Thuế PNN: Chưa nộp</option>
            <option value="Miễn nộp">Thuế PNN: Miễn nộp</option>
          </select>
        </div>
      </div>

      {/* Kết quả rà soát */}
      {(() => {
        const totalFilteredHouseholds = filteredHouseholds.length;
        const totalFilteredMembers = filteredHouseholds.reduce((sum, h) => {
          const members = residents.filter(r => r.householdId === h.id && r.occupation !== "Đã qua đời");
          return sum + members.length;
        }, 0);

        return (
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-emerald-800 font-medium shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Kết quả rà soát: Tìm thấy <strong className="text-emerald-950 font-bold text-sm">{totalFilteredHouseholds}</strong> hộ gia đình với <strong className="text-emerald-950 font-bold text-sm">{totalFilteredMembers}</strong> nhân khẩu thỏa mãn các tiêu chí lọc.
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 hidden sm:inline bg-emerald-100/50 px-2.5 py-1 rounded-full font-semibold">
              Hoạt động rà soát dân cư tự động
            </span>
          </div>
        );
      })()}

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHouseholds.map((h) => {
          const members = residents.filter(r => r.householdId === h.id && r.occupation !== "Đã qua đời");

          return (
            <div 
              key={h.id} 
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Card visual banner representing Vietnamese local house decoration */}
              <div className="h-2 bg-emerald-600"></div>

              <div className="p-5 flex-1 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
                      {h.id}
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{h.ownerName}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Chủ hộ gia đình</p>
                  </div>

                  {/* Poverty Badge */}
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    h.status === HouseholdStatus.POOR 
                      ? "bg-rose-50 text-rose-700 border border-rose-200" 
                      : h.status === HouseholdStatus.NEAR_POOR 
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : h.status === HouseholdStatus.RICH 
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-50 text-slate-700 border border-slate-200"
                  }`}>
                    {h.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{h.address} <br/> <b className="text-slate-500">{h.wardId}{h.quarterId ? ` • ${h.quarterId}` : ""}</b></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Số thành viên trong hộ: <b className="text-slate-800 font-bold">{members.length} nhân khẩu</b></span>
                  </div>
                </div>

                {/* Sub classifications */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-extrabold shadow-xs">
                    {getGenerationLabel(getHouseholdGenerationType(h, residents))}
                  </span>
                  {h.isCulturalFamily && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Gia đình văn hóa
                    </span>
                  )}
                  {h.isPolicyFamily && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-medium">
                      Gia đình chính sách
                    </span>
                  )}
                  {h.isMeritoriousFamily && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-medium">
                      Có công cách mạng
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                    (h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.REGISTERED 
                      ? "bg-teal-100 text-teal-900 border-teal-300 shadow-xs" 
                      : (h.wasteCollectionStatus || (h.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.CANCELLED
                        ? "bg-slate-200 text-slate-800 border-slate-300"
                        : "bg-rose-100 text-rose-900 border-rose-300 shadow-xs"
                  }`}>
                    Rác: {h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký")}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                    (h.waterSource || WaterSource.TAP_WATER) === WaterSource.TAP_WATER 
                      ? "bg-sky-100 text-sky-900 border-sky-300 shadow-xs" 
                      : "bg-amber-100 text-amber-900 border-amber-300 shadow-xs"
                  }`}>
                    Nước: {h.waterSource || "Chưa cập nhật"}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                    h.housingType === HousingType.YES 
                      ? "bg-amber-50 text-amber-700 border-amber-150" 
                      : "bg-slate-50 text-slate-600 border-slate-100"
                  }`}>
                    Hộ nông nghiệp: {h.housingType}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                    (h.nonAgriTax || "Chưa nộp") === "Đã nộp" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : (h.nonAgriTax || "Chưa nộp") === "Miễn nộp"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    Thuế PNN: {h.nonAgriTax || "Chưa nộp"}
                  </span>
                </div>

                {h.notes && (
                  <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-2.5 text-[11px] text-amber-800 italic mt-2">
                    <span className="font-semibold not-italic text-amber-900">Ghi chú:</span> {h.notes}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-2 min-h-[52px]">
                <button
                  onClick={() => setSelectedHousehold(h)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Eye className="w-4 h-4" />
                  Thành viên ({members.length})
                </button>

                {(currentUser?.role !== UserRole.COLLABORATOR || !existingEntityIds?.has(h.id)) && (
                  <>
                    <button
                      onClick={() => openEditForm(h)}
                      className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Chỉnh sửa hộ gia đình"
                    >
                      <Edit className="w-4.5 h-4.5" />
                    </button>

                    <button
                      onClick={() => {
                        setHouseholdToDelete({ id: h.id, ownerName: h.ownerName });
                        setDeleteModalOpen(true);
                      }}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Xoá hộ gia đình"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MEMBERS MODAL DETAIL VIEW */}
      {selectedHousehold && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Home className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-lg">SỔ HỘ GIA ĐÌNH: {selectedHousehold.id}</h3>
                  <p className="text-xs text-emerald-200">Địa chỉ: {selectedHousehold.address}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedHousehold(null)}
                className="text-emerald-100 hover:text-white p-1 rounded-full hover:bg-emerald-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Photo & GPS info if exists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Định vị GPS & Thông tin địa chính</h4>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p><b>Phường/Xã:</b> Phường Bình Minh, Tây Ninh</p>
                    <p><b>Địa bàn:</b> {selectedHousehold.wardId}{selectedHousehold.quarterId ? ` • ${selectedHousehold.quarterId}` : ""}</p>
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span><b>Tọa độ:</b> {selectedHousehold.gpsLat || "10.7769"}, {selectedHousehold.gpsLng || "106.7009"}</span>
                    </p>
                    <p>
                      <b className="text-slate-900 font-extrabold">Thu gom rác:</b>{" "}
                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[11px] border ${
                        (selectedHousehold.wasteCollectionStatus || (selectedHousehold.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.REGISTERED
                          ? "text-teal-950 bg-teal-100 border-teal-300 shadow-xs"
                          : (selectedHousehold.wasteCollectionStatus || (selectedHousehold.isWasteFeePaid ? WasteCollectionStatus.REGISTERED : WasteCollectionStatus.UNREGISTERED)) === WasteCollectionStatus.CANCELLED
                            ? "text-slate-800 bg-slate-200 border-slate-300"
                            : "text-rose-950 bg-rose-100 border-rose-300 shadow-xs"
                      }`}>
                        {selectedHousehold.wasteCollectionStatus || (selectedHousehold.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký")}
                      </span>
                    </p>
                    <p>
                      <b className="text-slate-900 font-extrabold">Nguồn nước sạch:</b>{" "}
                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[11px] border ${
                        (selectedHousehold.waterSource || WaterSource.TAP_WATER) === WaterSource.TAP_WATER
                          ? "text-sky-950 bg-sky-100 border-sky-300 shadow-xs"
                          : "text-amber-950 bg-amber-100 border-amber-300 shadow-xs"
                      }`}>
                        {selectedHousehold.waterSource || "Chưa cập nhật"}
                      </span>
                    </p>
                    <p>
                      <b>Hộ nông nghiệp:</b>{" "}
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                        selectedHousehold.housingType === HousingType.YES
                          ? "text-amber-950 bg-amber-50 border-amber-200"
                          : "text-slate-700 bg-slate-50 border-slate-200"
                      }`}>
                        {selectedHousehold.housingType || "Không"}
                      </span>
                    </p>
                    <p>
                      <b>Thuế đất phi nông nghiệp (PNN):</b>{" "}
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                        (selectedHousehold.nonAgriTax || "Chưa nộp") === "Đã nộp"
                          ? "text-emerald-950 bg-emerald-50 border-emerald-200"
                          : (selectedHousehold.nonAgriTax || "Chưa nộp") === "Miễn nộp"
                            ? "text-blue-950 bg-blue-50 border-blue-200"
                            : "text-rose-950 bg-rose-50 border-rose-200"
                      }`}>
                        {selectedHousehold.nonAgriTax || "Chưa nộp"}
                      </span>
                    </p>
                    <p><b>Thời điểm đăng ký:</b> {selectedHousehold.createdAt}</p>
                    <p><b>Số CMND cũ chủ hộ:</b> <span className="font-mono">{selectedHousehold.ownerOldCmnd || residents.find(r => r.id === selectedHousehold.ownerId)?.oldCmnd || "Chưa cập nhật"}</span></p>
                  </div>
                </div>

                {selectedHousehold.photoUrl ? (
                  <div className="rounded-lg overflow-hidden border border-slate-200 h-28 relative">
                    <img src={selectedHousehold.photoUrl} alt="Mặt tiền nhà hộ dân" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-slate-200 h-28 flex flex-col items-center justify-center text-slate-400">
                    <Home className="w-6 h-6 mb-1" />
                    <span className="text-[10px]">Chưa cập nhật ảnh chụp thực địa</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedHousehold.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Ghi chú của tổ dân phố:</p>
                  <p className="italic">{selectedHousehold.notes}</p>
                </div>
              )}

              {/* Trường dữ liệu bổ sung */}
              {selectedHousehold.customFields && Object.entries(selectedHousehold.customFields).length > 0 && (
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs text-slate-700 space-y-2">
                  <p className="font-bold text-slate-800 flex items-center gap-1">
                    <FileText className="w-4 h-4 text-emerald-600" /> Trường thông tin bổ sung:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 bg-white p-3 rounded-lg border border-slate-100">
                    {Object.entries(selectedHousehold.customFields).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-400 font-medium">{key}:</span>
                        <b className="text-slate-800 text-right">{val}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Danh sách nhân khẩu đăng ký ({residents.filter(r => r.householdId === selectedHousehold.id && r.occupation !== "Đã qua đời").length} người)
                </h4>

                <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-150">
                  {residents.filter(r => r.householdId === selectedHousehold.id && r.occupation !== "Đã qua đời").map((member) => (
                    <div key={member.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{member.fullName}</span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                            {member.relationToOwner}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                          <p>Ngày sinh: {member.birthDate} | Giới tính: {member.gender}</p>
                          <p>CCCD/Mã định danh: <span className="font-mono font-medium">{member.id}</span></p>
                          {member.oldCmnd && <p>Số CMND cũ: <span className="font-mono font-medium">{member.oldCmnd}</span></p>}
                          <p>Nghề nghiệp: {member.occupation || "N/A"} | BHYT: {member.insuranceId ? "Đã cấp" : "Chưa đăng ký"}</p>
                        </div>
                      </div>

                      {member.phone && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          {member.phone}
                        </span>
                      )}
                    </div>
                  ))}

                  {residents.filter(r => r.householdId === selectedHousehold.id && r.occupation !== "Đã qua đời").length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Sổ hộ khẩu trống. Chưa có nhân khẩu nào đăng ký trong hộ này.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-150 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedHousehold(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Đóng sổ hộ khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 transition-all duration-300 ${
            isZoomed ? "max-w-4xl h-[90vh] md:h-[94vh]" : "max-w-xl max-h-[90vh]"
          }`}>
            <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm md:text-base">{formMode === "add" ? "Khai báo thành lập Hộ gia đình mới" : "Cập nhật hồ sơ Hộ gia đình"}</h3>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsZoomed(!isZoomed)} 
                  className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
                  title={isZoomed ? "Thu nhỏ cửa sổ" : "Phóng to cửa sổ"}
                >
                  {isZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formMode === "add" && (
                <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-2xs mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">Nhập liệu nhanh bằng CCCD</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Quét QR hoặc tải ảnh để tự động điền mọi thông tin.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95 shrink-0"
                  >
                    <QrCode className="w-4 h-4" /> Quét QR CCCD
                  </button>
                </div>
              )}

              <div className={`grid gap-4 ${isZoomed ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mã hộ gia đình *</label>
                  <input
                    type="text"
                    required
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tên chủ hộ *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Tấn Bình"
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* THÔNG TIN CHI TIẾT CHỦ HỘ SECTION */}
              <div className="border border-emerald-100 bg-emerald-50/25 p-4 rounded-xl space-y-4 shadow-sm">
                <h4 className="font-bold text-xs text-emerald-800 uppercase tracking-wider border-b border-emerald-100/60 pb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  Thông tin nhân khẩu Chủ hộ *
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Số CCCD / Định danh *</label>
                    <input
                      type="text"
                      required
                      placeholder="079096012345"
                      value={ownerCccd}
                      onChange={(e) => setOwnerCccd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Số CMND cũ</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="123456789"
                      value={ownerOldCmnd}
                      onChange={(e) => setOwnerOldCmnd(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Số điện thoại *</label>
                    <input
                      type="text"
                      required
                      placeholder="0901234567"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ngày sinh *</label>
                    <input
                      type="date"
                      required
                      value={ownerBirthDate}
                      onChange={(e) => setOwnerBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Giới tính *</label>
                    <select
                      value={ownerGender}
                      onChange={(e) => setOwnerGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value={Gender.MALE}>Nam</option>
                      <option value={Gender.FEMALE}>Nữ</option>
                      <option value={Gender.OTHER}>Khác</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Trạng thái cư trú *</label>
                    <select
                      value={ownerResidentStatus}
                      onChange={(e) => setOwnerResidentStatus(e.target.value as ResidentStatus)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value={ResidentStatus.PERMANENT}>Thường trú</option>
                      <option value={ResidentStatus.TEMPORARY_STAY}>Tạm trú</option>
                      <option value={ResidentStatus.TEMPORARY_ABSENT}>Tạm vắng</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dân tộc *</label>
                    <input
                      type="text"
                      required
                      placeholder="Kinh"
                      value={ownerEthnicity}
                      onChange={(e) => setOwnerEthnicity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tôn giáo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Không"
                      value={ownerReligion}
                      onChange={(e) => setOwnerReligion(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Địa chỉ thường trú *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập địa chỉ thường trú..."
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tổ dân phố *</label>
                    <select
                      value={formWard}
                      onChange={(e) => setFormWard(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      {Array.from({ length: 10 }, (_, i) => `Tổ ${i + 1}`).map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                      {formWard && !Array.from({ length: 10 }, (_, i) => `Tổ ${i + 1}`).includes(formWard) && (
                        <option value={formWard}>{formWard}</option>
                      )}
                    </select>
                  </div>
                </div>

                {ownerResidentStatus === ResidentStatus.TEMPORARY_STAY && (
                  <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100/60 space-y-1.5 animate-fadeIn">
                    <label className="block text-xs font-bold text-emerald-800 uppercase">Địa chỉ tạm trú *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập địa chỉ tạm trú..."
                      value={ownerTemporaryAddress}
                      onChange={(e) => setOwnerTemporaryAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white shadow-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Trình độ học vấn *</label>
                    <select
                      value={ownerEducation}
                      onChange={(e) => setOwnerEducation(e.target.value as EducationLevel)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value={EducationLevel.NONE}>Chưa qua đào tạo</option>
                      <option value={EducationLevel.PRIMARY}>Tiểu học</option>
                      <option value={EducationLevel.SECONDARY}>THCS</option>
                      <option value={EducationLevel.HIGH_SCHOOL}>THPT</option>
                      <option value={EducationLevel.VOCATIONAL}>Trung cấp</option>
                      <option value={EducationLevel.COLLEGE}>Cao đẳng</option>
                      <option value={EducationLevel.UNIVERSITY}>Đại học</option>
                      <option value={EducationLevel.POSTGRADUATE}>Sau đại học</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nghề nghiệp *</label>
                    <input
                      type="text"
                      required
                      placeholder="Lao động tự do"
                      value={ownerOccupation}
                      onChange={(e) => setOwnerOccupation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mã số thẻ BHYT</label>
                    <input
                      type="text"
                      placeholder="DN4797912345678"
                      value={ownerInsuranceId}
                      onChange={(e) => setOwnerInsuranceId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Đối tượng Trợ cấp xã hội</label>
                    <select
                      value={ownerSubsidyType}
                      onChange={(e) => setOwnerSubsidyType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value="Không">Không thuộc diện trợ cấp</option>
                      <option value="Người khuyết tật">Người khuyết tật</option>
                      <option value="Hộ nghèo">Hộ nghèo khó khăn</option>
                      <option value="Trẻ mồ côi">Trẻ mồ côi</option>
                      <option value="Người cao tuổi đơn thân">Người cao tuổi đơn thân</option>
                      <option value="Thương binh / Bệnh binh">Thương binh / Bệnh binh</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ownerIsDisabled}
                      onChange={(e) => setOwnerIsDisabled(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    Chủ hộ là Người khuyết tật / Nhận trợ cấp khuyết tật
                  </label>
                </div>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phân loại Đời sống</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as HouseholdStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  >
                    <option value={HouseholdStatus.POOR}>Hộ nghèo</option>
                    <option value={HouseholdStatus.NEAR_POOR}>Hộ cận nghèo</option>
                    <option value={HouseholdStatus.AVERAGE}>Hộ trung bình</option>
                    <option value={HouseholdStatus.FAIR}>Hộ khá</option>
                    <option value={HouseholdStatus.RICH}>Hộ giàu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Hộ nông nghiệp</label>
                  <select
                    value={formHousingType}
                    onChange={(e) => setFormHousingType(e.target.value as HousingType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  >
                    <option value={HousingType.YES}>Có</option>
                    <option value={HousingType.NO}>Không</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Thuế đất phi nông nghiệp (PNN)</label>
                  <select
                    value={formNonAgriTax}
                    onChange={(e) => setFormNonAgriTax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  >
                    <option value="Chưa nộp">Chưa nộp</option>
                    <option value="Đã nộp">Đã nộp</option>
                    <option value="Miễn nộp">Miễn nộp</option>
                  </select>
                </div>
              </div>

              {/* Policy Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase">Danh hiệu, Chính sách & Dịch vụ công</label>
                
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCultural}
                      onChange={(e) => setFormCultural(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Gia đình đạt chuẩn "Gia đình Văn hóa"
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPolicy}
                      onChange={(e) => setFormPolicy(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Gia đình chính sách (Có thương binh, liệt sĩ)
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMeritorious}
                      onChange={(e) => setFormMeritorious(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    Gia đình có công với Cách mạng
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200/60 mt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Thu Gom Rác *</label>
                    <select
                      value={formWasteCollectionStatus}
                      onChange={(e) => setFormWasteCollectionStatus(e.target.value as WasteCollectionStatus)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value={WasteCollectionStatus.REGISTERED}>{WasteCollectionStatus.REGISTERED}</option>
                      <option value={WasteCollectionStatus.UNREGISTERED}>{WasteCollectionStatus.UNREGISTERED}</option>
                      <option value={WasteCollectionStatus.CANCELLED}>{WasteCollectionStatus.CANCELLED}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nước Sạch *</label>
                    <select
                      value={formWaterSource}
                      onChange={(e) => setFormWaterSource(e.target.value as WaterSource)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                    >
                      <option value={WaterSource.TAP_WATER}>{WaterSource.TAP_WATER}</option>
                      <option value={WaterSource.WELL_WATER}>{WaterSource.WELL_WATER}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ghi chú thêm</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Nhập thông tin ghi chú đặc biệt về hộ dân này (ví dụ: hoàn cảnh đặc biệt, hộ neo đơn, đang đi làm ăn xa...)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-emerald-600 bg-white"
                  rows={2}
                />
              </div>

              {/* Trường dữ liệu bổ sung tự thêm/xoá */}
              <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Trường thông tin bổ sung</label>
                  <button
                    type="button"
                    onClick={() => setFormCustomFields([...formCustomFields, { key: "", value: "" }])}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Thêm trường mới
                  </button>
                </div>
                
                {formCustomFields.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Chưa có trường thông tin bổ sung nào. Nhấp "Thêm trường mới" để bổ sung.</p>
                ) : (
                  <div className="space-y-2">
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          placeholder="Tên trường (VD: Diện tích vườn)"
                          value={field.key}
                          onChange={(e) => {
                            const updated = [...formCustomFields];
                            updated[idx].key = e.target.value;
                            setFormCustomFields(updated);
                          }}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-emerald-600"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Giá trị (VD: 150m2)"
                          value={field.value}
                          onChange={(e) => {
                            const updated = [...formCustomFields];
                            updated[idx].value = e.target.value;
                            setFormCustomFields(updated);
                          }}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formCustomFields.filter((_, i) => i !== idx);
                            setFormCustomFields(updated);
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="Xóa trường này"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Capture Simulation Fields (Camera & GPS) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-between h-28">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Tọa độ địa dư (GPS)</span>
                    <span className="text-xs font-semibold text-slate-700 block mt-1">
                      {formGpsLat ? `${formGpsLat.toFixed(5)}, ${formGpsLng?.toFixed(5)}` : "Chưa cập nhật"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateGps}
                    disabled={simulatingGps}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {simulatingGps ? "Đang dò..." : "Quét GPS Vị trí"}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-between min-h-[120px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Ảnh hiện trường</span>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {formPhoto ? "Đã cập nhật ảnh" : "Chưa cập nhật"}
                      </span>
                    </div>
                    {formPhoto && (
                      <div className="w-10 h-10 rounded overflow-hidden border border-slate-200">
                        <img src={formPhoto} alt="facade preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="flex items-center justify-center gap-1 w-full py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded text-[10px] font-bold transition-colors cursor-pointer text-center">
                      <Image className="w-3.5 h-3.5" />
                      Từ thư viện
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="flex items-center justify-center gap-1 w-full py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Chụp ảnh
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Lưu trữ hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(dataUrl) => setFormPhoto(dataUrl)}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen && householdToDelete !== null}
        title={`Xoá sổ hộ gia đình ${householdToDelete?.id}`}
        description={`Bạn có chắc chắn muốn xoá vĩnh viễn sổ hộ gia đình của ông/bà ${householdToDelete?.ownerName}? Lưu ý: Hành động này không thể khôi phục.`}
        confirmWord={householdToDelete?.ownerName || "XOÁ"}
        placeholder={`Nhập tên chủ hộ '${householdToDelete?.ownerName}' để xác nhận`}
        onConfirm={() => {
          if (householdToDelete) {
            onDeleteHousehold(householdToDelete.id);
          }
          setDeleteModalOpen(false);
          setHouseholdToDelete(null);
        }}
        onCancel={() => {
          setDeleteModalOpen(false);
          setHouseholdToDelete(null);
        }}
      />

      <CccdQrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onScanSuccess={handleCccdScanSuccess}
      />
    </div>
  );
}
