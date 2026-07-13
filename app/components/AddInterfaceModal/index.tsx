"use client";

import {
  useRef,
  useCallback,
  useLayoutEffect,
  useState,
  SubmitEvent,
} from "react";
import Input from "../Input";
import { useAddInterface } from "../RegisteredDevicesSection/useDevices";
import z from "zod";
import { getRegexOfZod } from "@/app/utils/getRegexOfZod";

interface Context {
  open: (deviceId: string) => void;
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
  const { mutateAsync } = useAddInterface();
  const [currentDeviceId, setCurrentDeviceId] = useState<string>();

  const closeModal = useCallback(() => {
    if (!dialogRef.current) return;
    if (!formRef.current) return;
    formRef.current.reset();
    dialogRef.current.close();
    setCurrentDeviceId(undefined);
  }, [dialogRef, formRef]);

  const openModal = useCallback(
    (deviceId: string) => {
      if (!dialogRef.current) return;
      setCurrentDeviceId(deviceId);
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
      await mutateAsync({
        deviceId: currentDeviceId,
        body: {
          name: data.get("Nome da Interface")?.toString() ?? "",
          mac: data.get("Endereço MAC")?.toString() ?? "",
          ip: data.get("Endereço IP")?.toString() ?? "",
        },
      });
      closeModal();
    },
    [closeModal, mutateAsync, currentDeviceId],
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
        <h3 className="font-bold text-lg">Adicionar Interface</h3>
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
          />
          <Input
            required
            label="Endereço MAC"
            placeholder="Digite o endereço MAC:"
            errorMessage="Preenchimento Obrigatório. E o MAC Precisa ser válido."
            pattern={getRegexOfZod(z.mac())}
          />
          <Input
            required
            label="Endereço IP"
            placeholder="Digite o endereço IP:"
            errorMessage="Preenchimento Obrigatório. E o IPv4 precisa ser válido."
            pattern={getRegexOfZod(z.ipv4())}
          />
          <div className="modal-action">
            <button className="btn" type="button" onClick={closeModal}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit">
              Cadastrar
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
