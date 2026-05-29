"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, User, Phone, Home } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getModalStyle, getTextColors, getInputStyle } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";

interface DeliveryAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DeliveryData) => void;
  isSubmitting?: boolean;
}

export type DeliveryData = {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  apartment?: string;
  notes?: string;
};

export function DeliveryAddressModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: DeliveryAddressModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const textColors = getTextColors(theme);
  const modalStyle = getModalStyle(theme);
  const isDark = theme === "dark";

  const [formData, setFormData] = useState<DeliveryData>({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    apartment: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof DeliveryData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof DeliveryData, string>> = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = t("deliveryEnterName");
    }
    if (!formData.phone.trim()) {
      newErrors.phone = t("deliveryEnterPhone");
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = t("deliveryInvalidPhone");
    }
    if (!formData.address.trim()) {
      newErrors.address = t("deliveryEnterAddress");
    }
    if (!formData.city.trim()) {
      newErrors.city = t("deliveryEnterCity");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }}
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden relative"
              style={modalStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(6,182,212,0.2)" }}
                  >
                    <MapPin className="w-5 h-5" style={{ color: "#06B6D4" }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold" style={{ color: textColors.primary }}>
                      {t("deliveryDataTitle")}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>
                      {t("deliveryDataDesc")}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                        <User className="w-3.5 h-3.5" />
                        {t("deliveryFullName")} *
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={getInputStyle(theme)}
                        placeholder={t("deliveryFullNamePlaceholder")}
                        disabled={isSubmitting}
                      />
                      {errors.full_name && (
                        <p className="text-xs mt-1 text-red-500">{errors.full_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                        <Phone className="w-3.5 h-3.5" />
                        {t("deliveryPhone")} *
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={getInputStyle(theme)}
                        placeholder={t("deliveryPhonePlaceholder")}
                        disabled={isSubmitting}
                      />
                      {errors.phone && (
                        <p className="text-xs mt-1 text-red-500">{errors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                        <MapPin className="w-3.5 h-3.5" />
                        {t("deliveryCity")} *
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={getInputStyle(theme)}
                        placeholder={t("cityPlaceholder")}
                        disabled={isSubmitting}
                      />
                      {errors.city && (
                        <p className="text-xs mt-1 text-red-500">{errors.city}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                        <Home className="w-3.5 h-3.5" />
                        {t("deliveryApartment")}
                      </label>
                      <input
                        type="text"
                        value={formData.apartment}
                        onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={getInputStyle(theme)}
                        placeholder={t("deliveryApartmentPlaceholder")}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                      <Home className="w-3.5 h-3.5" />
                      {t("deliveryAddress")} *
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={getInputStyle(theme)}
                      placeholder={t("deliveryAddressPlaceholder")}
                      disabled={isSubmitting}
                    />
                    {errors.address && (
                      <p className="text-xs mt-1 text-red-500">{errors.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: textColors.primary }}>
                      <MapPin className="w-3.5 h-3.5" />
                      {t("deliveryNotes")}
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg resize-none text-sm"
                      style={getInputStyle(theme)}
                      placeholder={t("deliveryNotesPlaceholder")}
                      rows={2}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        color: textColors.primary,
                        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                      }}
                    >
                      {t("deliveryCancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all",
                        isSubmitting && "opacity-50 cursor-not-allowed"
                      )}
                      style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                    >
                      {isSubmitting ? t("deliverySubmitting") : t("deliveryConfirmOrder")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
