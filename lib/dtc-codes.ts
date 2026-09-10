export const DTC_CODES: Record<string, string> = {
  P0010: "Camshaft Position Actuator Circuit (Bank 1)",
  P0011: "Camshaft Position Timing Over-Advanced (Bank 1)",
  P0100: "Mass Air Flow Sensor Circuit Malfunction",
  P0101: "Mass Air Flow Sensor Range/Performance",
  P0110: "Intake Air Temperature Sensor Circuit",
  P0115: "Engine Coolant Temperature Sensor Circuit",
  P0120: "Throttle Position Sensor Circuit Malfunction",
  P0128: "Coolant Temperature Below Thermostat Regulating Temperature",
  P0130: "O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)",
  P0171: "System Too Lean (Bank 1)",
  P0172: "System Too Rich (Bank 1)",
  P0174: "System Too Lean (Bank 2)",
  P0175: "System Too Rich (Bank 2)",
  P0200: "Injector Circuit Malfunction",
  P0300: "Random/Multiple Cylinder Misfire Detected",
  P0301: "Cylinder 1 Misfire Detected",
  P0302: "Cylinder 2 Misfire Detected",
  P0303: "Cylinder 3 Misfire Detected",
  P0304: "Cylinder 4 Misfire Detected",
  P0340: "Camshaft Position Sensor Circuit Malfunction",
  P0400: "Exhaust Gas Recirculation Flow Malfunction",
  P0401: "EGR Flow Insufficient Detected",
  P0420: "Catalyst System Efficiency Below Threshold (Bank 1)",
  P0430: "Catalyst System Efficiency Below Threshold (Bank 2)",
  P0440: "Evaporative Emission Control System Malfunction",
  P0442: "Evaporative Emission Control System Leak Detected (Small)",
  P0455: "Evaporative Emission Control System Leak Detected (Large)",
  P0500: "Vehicle Speed Sensor Malfunction",
  P0505: "Idle Control System Malfunction",
  P0600: "Serial Communication Link Malfunction",
  P0700: "Transmission Control System Malfunction",
  P0715: "Input/Turbine Speed Sensor Circuit Malfunction",
  P0720: "Output Speed Sensor Circuit Malfunction",
  P0730: "Incorrect Gear Ratio",
  P0740: "Torque Converter Clutch Circuit Malfunction",
  B0001: "Driver Frontal Stage 1 Deployment Control",
  B0002: "Driver Frontal Stage 2 Deployment Control",
  C0035: "Left Front Wheel Speed Sensor Circuit",
  C0040: "Right Front Wheel Speed Sensor Circuit",
  U0001: "High Speed CAN Communication Bus",
  U0100: "Lost Communication with ECM/PCM",
  U0155: "Lost Communication with Instrument Panel Cluster",
};

export function lookupDTC(code: string): string {
  const upper = code.toUpperCase().trim();
  return DTC_CODES[upper] ?? "Unknown fault code — consult a specialist";
}

export function parseDTCCodes(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(/[,\s]+/).filter(Boolean);
}
