"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input, Select } from "@/components/ui/input";
import { FormField, fieldA11y } from "@/components/ui/form-field";
import { ADDRESS_TYPES, INDIAN_STATES, type AddressFormValues } from "@/lib/validation/store";

export const emptyAddress: AddressFormValues = {
  type: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  area: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  landmark: "",
  isDefault: false,
};

interface Props {
  register: UseFormRegister<AddressFormValues>;
  errors: FieldErrors<AddressFormValues>;
  /** Prefix for input ids so two address forms on one page don't clash. */
  idPrefix?: string;
}

/** The address fields, shared by the address manager and checkout's "add new address". */
export function AddressFields({ register, errors, idPrefix = "addr" }: Props) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Full name" htmlFor={id("fullName")} required error={errors.fullName?.message}>
        <Input {...fieldA11y(id("fullName"), errors.fullName?.message)} autoComplete="name" {...register("fullName")} />
      </FormField>
      <FormField label="Mobile number" htmlFor={id("phone")} required error={errors.phone?.message}>
        <Input {...fieldA11y(id("phone"), errors.phone?.message)} type="tel" inputMode="numeric" autoComplete="tel-national" {...register("phone")} />
      </FormField>
      <FormField label="Address line 1" htmlFor={id("line1")} required error={errors.line1?.message} className="sm:col-span-2" >
        <Input {...fieldA11y(id("line1"), errors.line1?.message)} placeholder="House / flat no., street" autoComplete="address-line1" {...register("line1")} />
      </FormField>
      <FormField label="Address line 2" htmlFor={id("line2")} error={errors.line2?.message} className="sm:col-span-2">
        <Input {...fieldA11y(id("line2"), errors.line2?.message)} placeholder="Apartment, building (optional)" autoComplete="address-line2" {...register("line2")} />
      </FormField>
      <FormField label="Area / locality" htmlFor={id("area")} required error={errors.area?.message}>
        <Input {...fieldA11y(id("area"), errors.area?.message)} {...register("area")} />
      </FormField>
      <FormField label="Landmark" htmlFor={id("landmark")} error={errors.landmark?.message}>
        <Input {...fieldA11y(id("landmark"), errors.landmark?.message)} placeholder="Near… (optional)" {...register("landmark")} />
      </FormField>
      <FormField label="City" htmlFor={id("city")} required error={errors.city?.message}>
        <Input {...fieldA11y(id("city"), errors.city?.message)} autoComplete="address-level2" {...register("city")} />
      </FormField>
      <FormField label="District" htmlFor={id("district")} required error={errors.district?.message}>
        <Input {...fieldA11y(id("district"), errors.district?.message)} {...register("district")} />
      </FormField>
      <FormField label="State" htmlFor={id("state")} required error={errors.state?.message}>
        <Select {...fieldA11y(id("state"), errors.state?.message)} autoComplete="address-level1" {...register("state")}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Pincode" htmlFor={id("pincode")} required error={errors.pincode?.message}>
        <Input {...fieldA11y(id("pincode"), errors.pincode?.message)} inputMode="numeric" maxLength={6} autoComplete="postal-code" {...register("pincode")} />
      </FormField>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Address type</legend>
        <div className="flex gap-2">
          {ADDRESS_TYPES.map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" value={t} className="peer sr-only" {...register("type")} />
              <span className="inline-flex h-9 items-center rounded-pill border border-border bg-surface px-4 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {t}
              </span>
            </label>
          ))}
        </div>
        {errors.type && <p role="alert" className="mt-1 text-xs text-danger">{errors.type.message}</p>}
      </fieldset>
    </div>
  );
}
