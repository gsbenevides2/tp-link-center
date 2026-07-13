import { clx } from "@/app/utils/clx";

interface Props {
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  errorMessage?: string;
  pattern?: string;
}

export default function Input(props: Props) {
  const hasValidator = props.required || props.pattern;
  return (
    <fieldset className="fieldset">
      <label className="label" htmlFor={props.label}>
        {props.label}
      </label>
      <div
        className={clx("input w-full", hasValidator ? "validator" : undefined)}
      >
        <input
          type="text"
          id={props.label}
          required={props.required}
          placeholder={props.placeholder}
          pattern={props.pattern}
          name={props.label}
        />
      </div>
      <p className="validator-hint">{props.errorMessage}</p>
    </fieldset>
  );
}
