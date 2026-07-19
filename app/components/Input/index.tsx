"use client";

import { useState } from "react";
import { clx } from "@/app/utils/clx";
import { VscEye, VscEyeClosed } from "react-icons/vsc";

interface Props {
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  errorMessage?: string;
  pattern?: string;
  defaultValue?: string;
}

export default function Input(props: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const hasValidator = props.required || props.pattern;
  const isPassword = props.type === "password";

  return (
    <fieldset className="fieldset">
      <label className="label" htmlFor={props.label}>
        {props.label}
      </label>
      <div
        className={clx("input w-full", hasValidator ? "validator" : undefined)}
      >
        <input
          type={isPassword ? (showPassword ? "text" : "password") : props.type}
          id={props.label}
          required={props.required}
          placeholder={props.placeholder}
          pattern={props.pattern}
          name={props.label}
          defaultValue={props.defaultValue}
          autoComplete="off"
        />
        {isPassword && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <VscEyeClosed /> : <VscEye />}
          </button>
        )}
      </div>
      <p className="validator-hint">{props.errorMessage}</p>
    </fieldset>
  );
}
