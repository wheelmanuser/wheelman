import { xvisionGet } from "./client";
import type { XVisionDeviceOption } from "./types";

export type XVisionDevice = Record<string, unknown>;

let customerIdCache: string | null = null;

function extractList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "Data", "Customers", "Devices"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function text(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export async function getXVisionCustomerId(): Promise<string> {
  const override = process.env.XVISION_CUSTOMER_ID;
  if (override) return override;
  if (customerIdCache) return customerIdCache;

  const customers = extractList(await xvisionGet<unknown>("/Customer/GetCustomers"));
  if (customers.length === 0) throw new Error("xVision account has no customers");
  if (customers.length > 1) {
    throw new Error(
      `xVision account has ${customers.length} customers; set XVISION_CUSTOMER_ID to choose one`,
    );
  }
  const c = customers[0];
  const id = text(c.CustomerID ?? c.CustomerId ?? c.ID ?? c.Id);
  if (!id) throw new Error("xVision customer record has no CustomerID field");
  customerIdCache = id;
  return id;
}

export async function getXVisionDevices(): Promise<XVisionDevice[]> {
  const customerId = await getXVisionCustomerId();
  const payload = await xvisionGet<unknown>(
    `/Device/GetDevices?CustomerID=${encodeURIComponent(customerId)}`,
  );
  return extractList(payload);
}

export function toDeviceOption(d: XVisionDevice): XVisionDeviceOption | null {
  const objectId = text(d.ObjectID);
  if (!objectId) return null;
  return {
    objectId,
    deviceName: text(d.DeviceName),
    imei: text(d.IMEI),
    vin: text(d.VIN),
    vehicleYear: text(d.VehicleYear ?? d.Year),
    vehicleMake: text(d.VehicleMake ?? d.Make),
    vehicleModel: text(d.VehicleModel ?? d.Model),
  };
}
