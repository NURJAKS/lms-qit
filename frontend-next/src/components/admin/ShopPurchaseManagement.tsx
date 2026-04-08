"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Image from "next/image";
import { api } from "@/api/client";
import { getLocalizedProductTitle } from "@/lib/shopUtils";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getModalStyle, getInputStyle } from "@/utils/themeStyles";
import { Package, Truck, CheckCircle, Clock, Search, Filter, UserPlus, X } from "lucide-react";
import { CourierListView } from "./CourierListView";
import { cn } from "@/lib/utils";
import { formatDateLocalized } from "@/lib/dateUtils";


type Purchase = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  shop_item_id: number;
  item_title: string;
  item_price_coins: number;
  purchased_at: string | null;
  delivery_status: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  courier_id?: number | null;
  courier_name?: string | null;
};

type Courier = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  deliveries_count: number;
  pending_deliveries: number;
  delivered_count: number;
};

type PurchaseStats = {
  total_purchases: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
};

const DELIVERY_STATUSES = [
  { value: "pending", color: "#64748B" },
  { value: "processing", color: "#F59E0B" },
  { value: "shipped", color: "#3B82F6" },
  { value: "delivered", color: "#10B981" },
  { value: "cancelled", color: "#EF4444" },
];

export function ShopPurchaseManagement() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const textColors = getTextColors(theme);
  const cardStyle = getGlassCardStyle(theme);
  const modalStyle = getModalStyle(theme);
  const isDark = theme === "dark";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState<number | null>(null);
  const [courierFilter, setCourierFilter] = useState<number | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [assigningCourier, setAssigningCourier] = useState<Purchase | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"purchases" | "couriers">("purchases");
  const [initialCourierId, setInitialCourierId] = useState<number | null>(null);

  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-shop-purchases", statusFilter, userIdFilter, courierFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("delivery_status", statusFilter);
      if (userIdFilter) params.append("user_id", userIdFilter.toString());
      const { data } = await api.get<Purchase[]>(`/admin/shop/purchases?${params.toString()}`);
      return data;
    },
  });

  const { data: couriers = [] } = useQuery({
    queryKey: ["admin-shop-couriers"],
    queryFn: async () => {
      const { data } = await api.get<Courier[]>("/admin/shop/purchases/couriers");
      return data;
    },
  });

  const { data: availableCouriers = [] } = useQuery({
    queryKey: ["admin-shop-available-couriers"],
    queryFn: async () => {
      const { data } = await api.get<Courier[]>("/admin/shop/purchases/available-couriers");
      return data;
    },
  });

  const assignCourierMutation = useMutation({
    mutationFn: async ({ purchaseId, courierId }: { purchaseId: number; courierId: number }) => {
      await api.patch(`/admin/shop/purchases/${purchaseId}/assign-courier`, {
        courier_id: courierId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shop-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin-shop-couriers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-shop-available-couriers"] });
      setAssigningCourier(null);
      setSelectedCourierId(null);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-shop-stats"],
    queryFn: async () => {
      const { data } = await api.get<PurchaseStats>("/admin/shop/purchases/stats");
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, status }: { purchaseId: number; status: string }) => {
      await api.patch(`/admin/shop/purchases/${purchaseId}/delivery-status`, {
        delivery_status: status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shop-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin-shop-stats"] });
      setEditingPurchase(null);
      setNewStatus("");
    },
  });

  const filteredPurchases = purchases.filter((p) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !p.user_name.toLowerCase().includes(searchLower) &&
        !p.user_email.toLowerCase().includes(searchLower) &&
        !p.item_title.toLowerCase().includes(searchLower) &&
        !(p.courier_name && p.courier_name.toLowerCase().includes(searchLower))
      ) {
        return false;
      }
    }
    if (courierFilter && p.courier_id !== courierFilter) {
      return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    return DELIVERY_STATUSES.find((s) => s.value === status)?.color || "#64748B";
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t("adminShopStatusPending"),
      processing: t("adminShopStatusProcessing"),
      shipped: t("adminShopStatusShipped"),
      delivered: t("adminShopStatusDelivered"),
      cancelled: t("adminShopStatusCancelled"),
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "shipped":
        return <Truck className="w-4 h-4" />;
      case "processing":
        return <Package className="w-4 h-4" />;
      case "cancelled":
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: textColors.primary }}>
          <Package className="w-8 h-8" style={{ color: "#FF4181" }} />
          {t("adminShopPurchases")}
        </h1>
      </div>

      {/* Вкладки */}
      <div className="border-b overflow-x-auto" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
        <div className="flex gap-2 min-w-max pr-1">
        <button
          onClick={() => setActiveTab("purchases")}
          className={cn(
            "px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap text-sm sm:text-base",
            activeTab === "purchases" && "text-white"
          )}
          style={
            activeTab === "purchases"
              ? {
                  background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                }
              : { color: textColors.secondary }
          }
        >
          {t("adminShopPurchasesList")}
          {activeTab === "purchases" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab("couriers")}
          className={cn(
            "px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap text-sm sm:text-base",
            activeTab === "couriers" && "text-white"
          )}
          style={
            activeTab === "couriers"
              ? {
                  background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
                }
              : { color: textColors.secondary }
          }
        >
          {t("adminShopCouriers")}
          {activeTab === "couriers" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" }}
            />
          )}
        </button>
        </div>
      </div>

      {activeTab === "couriers" ? (
        <CourierListView initialCourierId={initialCourierId} />
      ) : (
        <div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-sm mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopTotalPurchases")}
            </div>
            <div className="text-2xl font-bold" style={{ color: textColors.primary }}>
              {stats.total_purchases}
            </div>
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-sm mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopAwaiting")}
            </div>
            <div className="text-2xl font-bold" style={{ color: "#64748B" }}>
              {stats.pending}
            </div>
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-sm mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopProcessing")}
            </div>
            <div className="text-2xl font-bold" style={{ color: "#F59E0B" }}>
              {stats.processing}
            </div>
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-sm mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopShipped")}
            </div>
            <div className="text-2xl font-bold" style={{ color: "#3B82F6" }}>
              {stats.shipped}
            </div>
          </div>
          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-sm mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopDelivered")}
            </div>
            <div className="text-2xl font-bold" style={{ color: "#10B981" }}>
              {stats.delivered}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textColors.secondary }} />
          <input
            type="text"
            placeholder={t("adminShopSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg"
            style={getInputStyle(theme)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg"
            style={getInputStyle(theme)}
          >
            <option value="">{t("adminShopAllStatuses")}</option>
            {DELIVERY_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {getStatusLabel(status.value)}
              </option>
            ))}
          </select>
          <select
            value={courierFilter || ""}
            onChange={(e) => setCourierFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg"
            style={getInputStyle(theme)}
          >
            <option value="">{t("adminShopAllCouriers")}</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.full_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t("adminShopUserIdPlaceholder")}
            value={userIdFilter || ""}
            onChange={(e) => setUserIdFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full sm:w-32 px-4 py-2 rounded-lg"
            style={getInputStyle(theme)}
          />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden w-full" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopStudent")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopProduct")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopPrice")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopPurchaseDate")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopStatus")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopDeliveryDate")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopCourier")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                  {t("adminShopActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr
                  key={purchase.id}
                  className="hover:bg-opacity-50 transition-colors"
                  style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)" }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: textColors.secondary }}>
                    #{purchase.id}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-sm" style={{ color: textColors.primary }}>
                        {purchase.user_name}
                      </div>
                      <div className="text-xs" style={{ color: textColors.secondary }}>
                        {purchase.user_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: textColors.primary }}>
                    {getLocalizedProductTitle(purchase.item_title, t)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Image src="/icons/coin.png" alt="" width={14} height={14} />
                      <span className="text-sm font-medium" style={{ color: "#FBBF24" }}>
                        {purchase.item_price_coins}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: textColors.secondary }}>
                    {purchase.purchased_at
                      ? formatDateLocalized(purchase.purchased_at, lang)
                      : "-"}

                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{
                          background: `${getStatusColor(purchase.delivery_status)}20`,
                          color: getStatusColor(purchase.delivery_status),
                        }}
                      >
                        {getStatusIcon(purchase.delivery_status)}
                        {getStatusLabel(purchase.delivery_status)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {purchase.delivery_status === "delivered" && purchase.delivered_at ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
                        <span className="text-sm" style={{ color: "#10B981" }}>
                          {formatDateLocalized(purchase.delivered_at, lang, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>

                      </div>
                    ) : purchase.estimated_delivery_date ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: textColors.secondary }} />
                        <span className="text-sm" style={{ color: textColors.secondary }}>
                          {t("adminShopExpected")} {formatDateLocalized(purchase.estimated_delivery_date, lang, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>

                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: textColors.secondary }}>
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {purchase.courier_name ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            if (purchase.courier_id) {
                              setInitialCourierId(purchase.courier_id);
                              setActiveTab("couriers");
                            }
                          }}
                          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left"
                          title={t("adminShopViewCourierDeliveries")}
                        >
                          <div className="text-sm font-medium" style={{ color: "#06B6D4" }}>
                            {purchase.courier_name}
                          </div>
                          {purchase.delivery_status === "delivered" && purchase.delivered_at && (
                            <CheckCircle className="w-3.5 h-3.5" style={{ color: "#10B981" }} aria-label={t("adminShopDeliveredByCourier")} />
                          )}
                        </button>
                        {purchase.delivery_status === "delivered" && purchase.delivered_at && (
                          <div className="text-xs" style={{ color: textColors.secondary }}>
                            {t("adminShopDeliveredOn")} {formatDateLocalized(purchase.delivered_at, lang)}
                          </div>

                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: textColors.secondary }}>
                        {t("adminShopNotAssigned")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAssigningCourier(purchase);
                          setSelectedCourierId(purchase.courier_id || null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                        style={{
                          background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
                          color: "#FFFFFF",
                        }}
                        title={t("adminShopAssignCourier")}
                      >
                        <UserPlus className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPurchase(purchase);
                          setNewStatus(purchase.delivery_status);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                        style={{
                          background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                          color: "#FFFFFF",
                        }}
                      >
                        {t("adminShopUpdateStatus")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPurchases.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
              <p className="text-lg font-medium" style={{ color: textColors.primary }}>
                {t("adminShopNoPurchasesFound")}
              </p>
            </div>
          )}
        </div>
      </div>

      {editingPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }}
          onClick={() => setEditingPurchase(null)}
        >
          <div
            className="rounded-2xl shadow-xl max-w-md w-full p-6"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: textColors.primary }}>
              {t("adminShopUpdateDeliveryStatus")}
            </h2>
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: textColors.secondary }}>
                {t("adminShopProductLabel")} {getLocalizedProductTitle(editingPurchase.item_title, t)}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminShopStudentLabel")} {editingPurchase.user_name}
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: textColors.primary }}>
                {t("adminShopNewStatus")}
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-2 rounded-lg"
                style={getInputStyle(theme)}
              >
                {DELIVERY_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {getStatusLabel(status.value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingPurchase(null)}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  color: textColors.primary,
                  background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                }}
              >
                {t("adminShopCancel")}
              </button>
              <button
                onClick={() => {
                  updateStatusMutation.mutate({
                    purchaseId: editingPurchase.id,
                    status: newStatus,
                  });
                }}
                disabled={updateStatusMutation.isPending}
                className="flex-1 py-2.5 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
              >
                {updateStatusMutation.isPending ? t("adminShopSaving") : t("adminShopSave")}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningCourier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }}
          onClick={() => setAssigningCourier(null)}
        >
          <div
            className="rounded-2xl shadow-xl max-w-md w-full p-6"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: textColors.primary }}>
              {t("adminShopAssignCourier")}
            </h2>
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: textColors.secondary }}>
                {t("adminShopProductLabel")} {getLocalizedProductTitle(assigningCourier.item_title, t)}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminShopStudentLabel")} {assigningCourier.user_name}
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: textColors.primary }}>
                {t("adminShopSelectCourier")}
              </label>
              <select
                value={selectedCourierId || ""}
                onChange={(e) => setSelectedCourierId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2 rounded-lg"
                style={getInputStyle(theme)}
              >
                <option value="">{t("adminShopNotAssigned")}</option>
                {availableCouriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.full_name} {courier.deliveries_count > 0 ? `(${courier.deliveries_count} ${t("adminShopTotalDeliveries").toLowerCase()})` : `(${t("adminShopCourierRole").toLowerCase()})`}
                  </option>
                ))}
              </select>
              {availableCouriers.length === 0 && (
                <p className="text-xs mt-2" style={{ color: textColors.secondary }}>
                  {t("adminShopNoCouriersAvailable")}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAssigningCourier(null)}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  color: textColors.primary,
                  background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                }}
              >
                {t("adminShopCancel")}
              </button>
              <button
                onClick={() => {
                  if (selectedCourierId) {
                    assignCourierMutation.mutate({
                      purchaseId: assigningCourier.id,
                      courierId: selectedCourierId,
                    });
                  } else {
                    // Можно добавить endpoint для удаления курьера, но пока просто закрываем
                    setAssigningCourier(null);
                  }
                }}
                disabled={assignCourierMutation.isPending || !selectedCourierId}
                className="flex-1 py-2.5 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" }}
              >
                {assignCourierMutation.isPending ? t("adminShopSaving") : t("adminShopAssign")}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
