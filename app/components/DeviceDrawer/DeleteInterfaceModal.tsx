"use client";

import { useRef, useState, type RefObject } from "react";
import { useDeleteInterface, type Device } from "../RegisteredDevicesSection/useDevices";

type Interface = Device["interfaces"][number];

type DeleteInterfaceModalProps = {
  deviceId: string;
  interfaceToDelete: Interface | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onConfirm: () => void;
};

export function useDeleteInterfaceModal(deviceId: string) {
  const [interfaceToDelete, setInterfaceToDelete] = useState<Interface | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { mutateAsync: deleteInterface } = useDeleteInterface();

  const open = (iface: Interface) => {
    setInterfaceToDelete(iface);
    dialogRef.current?.showModal();
  };

  const close = () => {
    setInterfaceToDelete(null);
    dialogRef.current?.close();
  };

  const confirm = async () => {
    if (interfaceToDelete) {
      await deleteInterface({ deviceId, interfaceId: interfaceToDelete.id });
    }
    close();
  };

  const props: DeleteInterfaceModalProps = {
    deviceId,
    interfaceToDelete,
    dialogRef,
    onClose: close,
    onConfirm: confirm,
  };

  return { interfaceToDelete, dialogRef, open, close, confirm, props };
}

export function DeleteInterfaceModal({
  interfaceToDelete,
  dialogRef,
  onClose,
  onConfirm,
}: DeleteInterfaceModalProps) {
  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg">Excluir Interface</h3>
        <p className="py-4">
          Tem certeza que deseja excluir a interface{" "}
          <strong>{interfaceToDelete?.name}</strong>?
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
