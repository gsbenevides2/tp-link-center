"use client";

import { useRef, useCallback, useLayoutEffect, useState, SubmitEvent } from "react";
import Input from "../Input";
import { useAddDevice, useUpdateDevice, type Device } from "../RegisteredDevicesSection/useDevices";

interface Context {
  open: (device?: Device) => void;
  close: () => void;
}

declare global {
  interface Window {
    addDeviceModal: Context;
  }
}

export function AddDeviceModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { mutateAsync: addDevice } = useAddDevice();
  const { mutateAsync: updateDevice } = useUpdateDevice();
  const [editingDevice, setEditingDevice] = useState<Device>();

  const isEditing = Boolean(editingDevice);

  const closeModal = useCallback(() => {
    if (!dialogRef.current) return;
    if (!formRef.current) return;
    formRef.current.reset();
    dialogRef.current.close();
    setEditingDevice(undefined);
  }, [dialogRef, formRef]);

  const openModal = useCallback((device?: Device) => {
    if (!dialogRef.current) return;
    setEditingDevice(device);
    dialogRef.current.open = true;
  }, [dialogRef]);

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const currentForm = event.currentTarget;
      const data = new FormData(currentForm);
      const name = data.get("Nome do Dispositivo")?.toString() ?? "";
      const brand = data.get("Fabricante do Dispositivo")?.toString() ?? "";

      if (editingDevice) {
        await updateDevice({ deviceId: editingDevice.id, body: { name, brand } });
      } else {
        await addDevice({ name, brand });
      }
      closeModal();
    },
    [closeModal, addDevice, updateDevice, editingDevice],
  );

  useLayoutEffect(() => {
    window.addDeviceModal = {
      open: openModal,
      close: closeModal,
    };
  }, [closeModal, openModal]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={closeModal}>
      <div className="max-w-100 modal-box">
        <h3 className="font-bold text-lg">
          {isEditing ? "Editar Dispositivo" : "Adicionar Dispositivo"}
        </h3>
        <form
          className="flex flex-col gap-2 py-4"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <Input
            required
            label="Nome do Dispositivo"
            placeholder="Digite o nome do dispositivo:"
            errorMessage="Preenchimento Obrigatório."
            defaultValue={editingDevice?.name}
          />
          <Input
            required
            label="Fabricante do Dispositivo"
            placeholder="Digite o fabricante do dispositivo:"
            errorMessage="Preenchimento Obrigatório."
            defaultValue={editingDevice?.brand}
          />
          <div className="modal-action">
            <button className="btn" type="button" onClick={closeModal}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit">
              {isEditing ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

export function useAddDeviceModal() {
  return typeof window === "undefined" ? undefined : window.addDeviceModal;
}
