import { z } from "zod";

export const vehicleFormSchema = z.object({
  year: z.number().int().min(1900).max(2030),
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  trim: z.string().trim().optional(),
  color: z.string().trim().optional(),
  transmission: z.string().trim().optional(),
  vin: z.string().trim().max(17, "VIN must be 17 characters or less").optional(),
  purchase_price: z.number().nonnegative().optional(),
  estimated_miles_per_year: z.number().int().nonnegative().optional(),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export const VEHICLE_FORM_FIELDS = [
  { name: "year", label: "Year", type: "number" as const },
  { name: "make", label: "Make", type: "text" as const },
  { name: "model", label: "Model", type: "text" as const },
  { name: "trim", label: "Trim", type: "text" as const },
  { name: "color", label: "Colour", type: "text" as const },
  { name: "transmission", label: "Transmission", type: "text" as const },
  { name: "vin", label: "VIN", type: "text" as const },
  { name: "purchase_price", label: "Purchase Price", type: "number" as const },
  {
    name: "estimated_miles_per_year",
    label: "Est. Miles/Year",
    type: "number" as const,
  },
] as const;
