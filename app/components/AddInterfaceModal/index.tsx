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
  open: (
    deviceId: string,
    interfaceToEdit?: Interface,
    deviceType?: "router" | "client",
    isController?: boolean,
  ) => void;
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
  const [currentDeviceType, setCurrentDeviceType] = useState<"router" | "client">("client");
  const [currentIsController, setCurrentIsController] = useState(false);

  const isEditing = Boolean(editingInterface);

  const closeModal = useCallback(() => {
    if (!dialogRef.current) return;
    if (!formRef.current) return;
    formRef.current.reset();
    dialogRef.current.close();
    setCurrentDeviceId(undefined);
    setEditingInterface(undefined);
    setCurrentDeviceType("client");
    setCurrentIsController(false);
  }, [dialogRef, formRef]);

  const openModal = useCallback(
    (
      deviceId: string,
      interfaceToEdit?: Interface,
      deviceType?: "router" | "client",
      isController?: boolean,
    ) => {
      if (!dialogRef.current) return;
      setCurrentDeviceId(deviceId);
      setEditingInterface(interfaceToEdit);
      setCurrentDeviceType(deviceType ?? "client");
      setCurrentIsController(isController ?? false);
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
      const isRouter = currentDeviceType === "router";

      let body: {
        name: string;
        mac: string;
        ip: string;
        reservedIp: boolean;
        allowList: boolean;
      };

      if (isRouter && editingInterface) {
        body = {
          name: editingInterface.name,
          mac: editingInterface.mac,
          ip: data.get("Endereço IP")?.toString() ?? editingInterface.ip,
          reservedIp:
            data.get("IP Reservado") === "on" || editingInterface.reservedIp,
          allowList: false,
        };
      } else {
        body = {
          name: data.get("Nome da Interface")?.toString() ?? "",
          mac: data.get("Endereço MAC")?.toString() ?? "",
          ip: data.get("Endereço IP")?.toString() ?? "",
          reservedIp: isRouter
            ? false
            : data.get("IP Reservado") === "on",
          allowList: isRouter
            ? false
            : data.get("Interface na Allow List") === "on",
        };
      }

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
    [
      closeModal,
      addInterface,
      updateInterface,
      currentDeviceId,
      editingInterface,
      currentDeviceType,
    ],
  );

  useLayoutEffect(() => {
    window.addInterfaceModal = {
      open: openModal,
      close: closeModal,
    };
  }, [closeModal, openModal]);

  const isRouter = currentDeviceType === "router";
  const isController = currentIsController;
  const isEditingRouter = isRouter && isEditing;

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
          {!isEditingRouter && (
            <Input
              required
              label="Nome da Interface"
              placeholder="Digite o nome da interface:"
              errorMessage="Preenchimento Obrigatório."
              defaultValue={editingInterface?.name}
            />
          )}
          {!isEditingRouter && (
            <Input
              required
              label="Endereço MAC"
              placeholder="Digite o endereço MAC:"
              errorMessage="Preenchimento Obrigatório. E o MAC Precisa ser válido."
              pattern={getRegexOfZod(z.mac())}
              defaultValue={editingInterface?.mac}
            />
          )}
          <Input
            required
            label="Endereço IP"
            placeholder="Digite o endereço IP:"
            errorMessage="Preenchimento Obrigatório. E o IPv4 precisa ser válido."
            pattern={getRegexOfZod(z.ipv4())}
            defaultValue={editingInterface?.ip}
          />
          {isRouter && !isController && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="IP Reservado"
                className="checkbox checkbox-sm"
                defaultChecked={editingInterface?.reservedIp}
              />
              <span className="label-text">IP Reservado</span>
            </label>
          )}
          {!isRouter && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="IP Reservado"
                  className="checkbox checkbox-sm"
                  defaultChecked={editingInterface?.reservedIp}
                />
                <span className="label-text">IP Reservado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="Interface na Allow List"
                  className="checkbox checkbox-sm"
                  defaultChecked={editingInterface?.allowList}
                />
                <span className="label-text">Interface na Allow List</span>
              </label>
            </div>
          )}
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
