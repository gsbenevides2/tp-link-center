"use client";

import { useRef, useState, type RefObject } from "react";
import { Device } from "./useDevices";

type DeleteModalProps = {
  device: Device | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onConfirm: () => void;
};

export function useDeleteModal(onConfirm: (deviceId: string) => void) {
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = (device: Device) => {
    setDeviceToDelete(device);
    dialogRef.current?.showModal();
  };

  const close = () => {
    setDeviceToDelete(null);
    dialogRef.current?.close();
  };

  const confirm = () => {
    if (deviceToDelete) {
      onConfirm(deviceToDelete.id);
    }
    close();
  };

  const props: DeleteModalProps = {
    device: deviceToDelete,
    dialogRef,
    onClose: close,
    onConfirm: confirm,
  };

  return { deviceToDelete, dialogRef, open, close, confirm, props };
}

export function DeleteModal({
  device,
  dialogRef,
  onClose,
  onConfirm,
}: DeleteModalProps) {
  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg">Excluir Dispositivo</h3>
        <p className="py-4">
          Tem certeza que deseja excluir o dispositivo{" "}
          <strong>{device?.name}</strong>?
        </p>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            Excluir
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
