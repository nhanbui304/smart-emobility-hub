// Owner: Bùi Quang Nhân – Quản lý phương tiện điện cá nhân (hỗ trợ UC06–UC09)
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "../../api/auth";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import type { ConnectorType, PrivateVehicle, VehicleType } from "../../types";
import { connectorTypeLabel, vehicleTypeLabel } from "../../utils/display";

interface PrivateVehiclesCardProps {
  vehicles: PrivateVehicle[];
  loading: boolean;
  loadError: unknown;
  onRetryLoad: () => void;
  onChanged: () => Promise<void> | void;
  onClose?: () => void;
}

interface VehicleFormState {
  plate: string;
  type: VehicleType;
  connectorType: ConnectorType;
}

const DEFAULT_FORM: VehicleFormState = {
  plate: "",
  type: "E_MOTORBIKE",
  connectorType: "STANDARD_PLUG",
};

export function PrivateVehiclesCard({
  vehicles,
  loading,
  loadError,
  onRetryLoad,
  onChanged,
  onClose,
}: PrivateVehiclesCardProps) {
  const [adding, setAdding] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<VehicleFormState>(DEFAULT_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VehicleFormState>(DEFAULT_FORM);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Tự mở biểu mẫu thêm xe nếu sinh viên chưa có xe cá nhân nào
  useEffect(() => {
    if (!loading && vehicles.length === 0) {
      setAdding(true);
    }
  }, [loading, vehicles.length]);

  function openAddForm() {
    setEditingId(null);
    setDeletingId(null);
    setActionError(null);
    setInfoMsg(null);
    setAddForm(DEFAULT_FORM);
    setAdding(true);
  }

  function startEdit(vehicle: PrivateVehicle) {
    setAdding(false);
    setDeletingId(null);
    setActionError(null);
    setInfoMsg(null);
    setEditingId(vehicle.id);
    setEditForm({
      plate: vehicle.plate,
      type: vehicle.type,
      connectorType: vehicle.connectorType,
    });
  }

  function startDelete(vehicleId: string) {
    setAdding(false);
    setEditingId(null);
    setActionError(null);
    setInfoMsg(null);
    setDeletingId(vehicleId);
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedPlate = addForm.plate.trim();
    if (normalizedPlate.length < 4) {
      setActionError(new Error("Biển số xe tối thiểu 4 ký tự."));
      return;
    }
    setBusyKey("create");
    setActionError(null);
    setInfoMsg(null);
    try {
      const created = await authApi.createVehicle({
        plate: normalizedPlate,
        type: addForm.type,
        connectorType: addForm.connectorType,
      });
      setAddForm(DEFAULT_FORM);
      setAdding(false);
      setInfoMsg(`Đã đăng ký xe cá nhân biển số ${created.plate}.`);
      await onChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>, vehicleId: string) {
    e.preventDefault();
    const normalizedPlate = editForm.plate.trim();
    if (normalizedPlate.length < 4) {
      setActionError(new Error("Biển số xe tối thiểu 4 ký tự."));
      return;
    }
    setBusyKey(`update:${vehicleId}`);
    setActionError(null);
    setInfoMsg(null);
    try {
      const updated = await authApi.updateVehicle(vehicleId, {
        plate: normalizedPlate,
        type: editForm.type,
        connectorType: editForm.connectorType,
      });
      setEditingId(null);
      setInfoMsg(`Đã cập nhật thông tin xe ${updated.plate}.`);
      await onChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleConfirmDelete(vehicle: PrivateVehicle) {
    setBusyKey(`delete:${vehicle.id}`);
    setActionError(null);
    setInfoMsg(null);
    try {
      await authApi.deleteVehicle(vehicle.id);
      setDeletingId(null);
      setInfoMsg(`Đã xóa xe ${vehicle.plate} khỏi tài khoản.`);
      await onChanged();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card className="space-y-4 border-brand/25 p-4 md:p-5 dark:border-lime/25">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-lime">
            Hồ sơ phương tiện
          </p>
          <h2 className="mt-0.5 text-base font-bold">Quản lý xe điện cá nhân</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Đăng ký biển số và chuẩn đầu cắm để đặt chỗ đỗ, sạc ngay hoặc đặt lịch sạc tại Hub.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!adding && (
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={openAddForm}
              className="cursor-pointer rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-lime transition hover:bg-brand-light active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark"
            >
              + Thêm xe mới
            </button>
          )}
          {onClose && vehicles.length > 0 && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 active:scale-[0.99] dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              Thu gọn
            </button>
          )}
        </div>
      </div>

      {loading && vehicles.length === 0 && <Spinner />}
      <ErrorMessage error={loadError} onRetry={onRetryLoad} />

      {infoMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {infoMsg}
        </div>
      )}

      {/* Lỗi thao tác chung khi không mở hộp xác nhận xóa riêng */}
      {!deletingId && <ErrorMessage error={actionError} />}

      {/* Danh sách xe hiện có */}
      {!loading && vehicles.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Bạn chưa đăng ký xe điện cá nhân nào. Hãy điền biển số và chuẩn đầu cắm bên dưới để bắt đầu sử dụng.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {vehicles.map((v) => {
            const isEditing = editingId === v.id;
            const isDeleting = deletingId === v.id;

            return (
              <li
                key={v.id}
                className="rounded-xl border border-neutral-200/90 bg-surface/60 p-3.5 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                        {v.plate}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {vehicleTypeLabel(v.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                      Chuẩn sạc: <span className="font-medium">{connectorTypeLabel(v.connectorType)}</span>
                    </p>
                  </div>

                  {!isEditing && !isDeleting && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => startEdit(v)}
                        className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-brand hover:text-brand active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-panel-dark dark:text-neutral-200 dark:hover:border-lime dark:hover:text-lime"
                      >
                        Cập nhật
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => startDelete(v.id)}
                        className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>

                {/* Biểu mẫu sửa trực tiếp */}
                {isEditing && (
                  <form
                    onSubmit={(e) => void handleUpdate(e, v.id)}
                    className="mt-3 space-y-3 border-t border-neutral-200 pt-3 dark:border-white/10"
                  >
                    <VehicleFields
                      idPrefix={`edit-${v.id}`}
                      value={editForm}
                      onChange={setEditForm}
                      disabled={busyKey !== null}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="dark"
                        loading={busyKey === `update:${v.id}`}
                        className="px-4 py-2 text-xs"
                      >
                        Lưu thay đổi
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyKey !== null}
                        onClick={() => {
                          setEditingId(null);
                          setActionError(null);
                        }}
                        className="px-4 py-2 text-xs"
                      >
                        Hủy
                      </Button>
                    </div>
                  </form>
                )}

                {/* Hộp xác nhận xóa trực tiếp + hiển thị lỗi nếu vướng đặt chỗ/lịch sạc */}
                {isDeleting && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs dark:border-red-500/30 dark:bg-red-500/10">
                    <p className="font-medium text-red-900 dark:text-red-200">
                      Xác nhận xóa xe biển số <strong className="font-mono">{v.plate}</strong> khỏi danh sách phương tiện cá nhân?
                    </p>
                    <ErrorMessage error={actionError} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        loading={busyKey === `delete:${v.id}`}
                        onClick={() => void handleConfirmDelete(v)}
                        className="px-3.5 py-1.5 text-xs"
                      >
                        Xác nhận xóa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyKey !== null}
                        onClick={() => {
                          setDeletingId(null);
                          setActionError(null);
                        }}
                        className="px-3.5 py-1.5 text-xs"
                      >
                        Giữ lại
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Biểu mẫu thêm xe mới */}
      {adding && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-white/10 dark:bg-panel-dark"
        >
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100">Thêm phương tiện điện cá nhân</p>
          <VehicleFields
            idPrefix="create-vehicle"
            value={addForm}
            onChange={setAddForm}
            disabled={busyKey !== null}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="dark"
              loading={busyKey === "create"}
              className="px-4 py-2 text-xs"
            >
              Đăng ký xe cá nhân
            </Button>
            {vehicles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={busyKey !== null}
                onClick={() => {
                  setAdding(false);
                  setActionError(null);
                }}
                className="px-4 py-2 text-xs"
              >
                Hủy
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function VehicleFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: VehicleFormState;
  onChange: (next: VehicleFormState) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 text-xs sm:grid-cols-3">
      <div>
        <label htmlFor={`${idPrefix}-plate`} className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
          Biển số xe
        </label>
        <input
          id={`${idPrefix}-plate`}
          type="text"
          required
          minLength={4}
          maxLength={20}
          disabled={disabled}
          value={value.plate}
          onChange={(e) => onChange({ ...value, plate: e.target.value })}
          placeholder="59-MĐ1 246.81"
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono text-xs uppercase outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:focus:border-lime"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-type`} className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
          Loại phương tiện
        </label>
        <select
          id={`${idPrefix}-type`}
          disabled={disabled}
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as VehicleType })}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:focus:border-lime"
        >
          <option value="E_MOTORBIKE">Xe máy điện</option>
          <option value="E_BIKE">Xe đạp điện</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-connector`} className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
          Chuẩn đầu cắm sạc
        </label>
        <select
          id={`${idPrefix}-connector`}
          disabled={disabled}
          value={value.connectorType}
          onChange={(e) => onChange({ ...value, connectorType: e.target.value as ConnectorType })}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none transition focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:focus:border-lime"
        >
          <option value="STANDARD_PLUG">Ổ cắm tiêu chuẩn (AC)</option>
          <option value="TYPE_2">Đầu sạc Type 2</option>
        </select>
      </div>
    </div>
  );
}
