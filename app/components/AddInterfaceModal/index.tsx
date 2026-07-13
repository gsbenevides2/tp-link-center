"use client";

import {
  useRef,
  useCallback,
  useLayoutEffect,
  useState,
  SubmitEvent,
} from "react";
import Input from "../Input";
import {
  useAddInterface,
  useUpdateInterface,
  type Device,
} from "../RegisteredDevicesSection/useDevices";
import z from "zod";
import { getRegexOfZod } from "@/app/utils/getRegexOfZod";

export type Interface = Device["interfaces"][number];

interface Context {
  open: (deviceId: string, interfaceToEdit?: Interface) => void;
  close: () => void;
}

declare global {
  interface Window {
    addInterfaceModal: Context;
  }
}

export function AddInterfaceModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { mutateAsync: addInterface } = useAddInterface();
  const { mutateAsync: updateInterface } = useUpdateInterface();
  const [currentDeviceId, setCurrentDeviceId] = useState<string>();
  const [editingInterface, setEditingInterface] = useState<Interface>();

  const isEditing = Boolean(editingInterface);

  const closeModal = useCallback(() => {
    if (!dialogRef.current) return;
    if (!formRef.current) return;
    formRef.current.reset();
    dialogRef.current.close();
    setCurrentDeviceId(undefined);
    setEditingInterface(undefined);
  }, [dialogRef, formRef]);

  const openModal = useCallback(
    (deviceId: string, interfaceToEdit?: Interface) => {
      if (!dialogRef.current) return;
      setCurrentDeviceId(deviceId);
      setEditingInterface(interfaceToEdit);
      dialogRef.current.open = true;
    },
    [dialogRef],
  );

  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!currentDeviceId) return;
      const currentForm = event.currentTarget;
      const data = new FormData(currentForm);
      const body = {
        name: data.get("Nome da Interface")?.toString() ?? "",
        mac: data.get("Endereço MAC")?.toString() ?? "",
        ip: data.get("Endereço IP")?.toString() ?? "",
      };

      if (editingInterface) {
        await updateInterface({
          deviceId: currentDeviceId,
          interfaceId: editingInterface.id,
          body,
        });
      } else {
        await addInterface({ deviceId: currentDeviceId, body });
      }
      closeModal();
    },
    [closeModal, addInterface, updateInterface, currentDeviceId, editingInterface],
  );

  useLayoutEffect(() => {
    window.addInterfaceModal = {
      open: openModal,
      close: closeModal,
    };
  }, [closeModal, openModal]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={closeModal}>
      <div className="max-w-100 modal-box">
        <h3 className="font-bold text-lg">
          {isEditing ? "Editar Interface" : "Adicionar Interface"}
        </h3>
        <form
          className="flex flex-col gap-2 py-4"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <Input
            required
            label="Nome da Interface"
            placeholder="Digite o nome da interface:"
            errorMessage="Preenchimento Obrigatório."
            defaultValue={editingInterface?.name}
          />
          <Input
            required
            label="Endereço MAC"
            placeholder="Digite o endereço MAC:"
            errorMessage="Preenchimento Obrigatório. E o MAC Precisa ser válido."
            pattern={getRegexOfZod(z.mac())}
            defaultValue={editingInterface?.mac}
          />
          <Input
            required
            label="Endereço IP"
            placeholder="Digite o endereço IP:"
            errorMessage="Preenchimento Obrigatório. E o IPv4 precisa ser válido."
            pattern={getRegexOfZod(z.ipv4())}
            defaultValue={editingInterface?.ip}
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

export function useAddInterfaceModal() {
  return typeof window === "undefined" ? undefined : window.addInterfaceModal;
}
