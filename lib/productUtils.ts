/**
 * Utility functions for extracting product data
 */

export interface SpecItem {
  label: string;
  value: string;
}

interface ProductData {
  keySpecs?: SpecItem[];
  allSpecs?: SpecItem[];
  [key: string]: unknown;
}

/** Product-like input: either a row wrapping `data`, or the data object itself. */
function toData(product: unknown): ProductData | undefined {
  const p = product as { data?: ProductData } | null | undefined;
  return (p?.data || p) as ProductData | undefined;
}

/**
 * Extract a spec value from keySpecs or allSpecs array
 */
export function getSpecValue(product: unknown, label: string): string | null {
  const data = toData(product);
  
  // Try keySpecs first
  if (data?.keySpecs && Array.isArray(data.keySpecs)) {
    const spec = data.keySpecs.find((s: SpecItem) => 
      s.label.toLowerCase().includes(label.toLowerCase())
    );
    if (spec) return spec.value;
  }
  
  // Try allSpecs
  if (data?.allSpecs && Array.isArray(data.allSpecs)) {
    const spec = data.allSpecs.find((s: SpecItem) => 
      s.label.toLowerCase().includes(label.toLowerCase())
    );
    if (spec) return spec.value;
  }
  
  // Fallback to direct property
  return (data?.[label] as string | undefined) || null;
}

/**
 * Extract KV rating from specs
 */
export function getKV(product: unknown): string {
  const data = toData(product);
  
  // Direct property
  if (data?.kv) return String(data.kv);
  
  // From specs
  const kvSpec = getSpecValue(product, 'kv');
  if (kvSpec) return kvSpec;
  
  return '—';
}

/**
 * Extract voltage from specs
 */
export function getVoltage(product: unknown): string {
  const data = toData(product);
  
  // Direct property
  if (data?.voltage) return String(data.voltage);
  
  // From specs - check multiple possible labels
  const voltageLabels = ['voltage', 'battery', 'recommended battery'];
  for (const label of voltageLabels) {
    const value = getSpecValue(product, label);
    if (value) return value;
  }
  
  return '—';
}

/**
 * Extract peak thrust from specs
 */
export function getPeakThrust(product: unknown): string {
  const data = toData(product);
  
  // Direct property
  if (data?.peakThrust) return String(data.peakThrust);
  
  // From specs
  const thrustLabels = ['peak thrust', 'thrust', 'max thrust'];
  for (const label of thrustLabels) {
    const value = getSpecValue(product, label);
    if (value) return value;
  }
  
  return '—';
}

/**
 * Extract weight from specs
 */
export function getWeight(product: unknown): string {
  const data = toData(product);
  
  // Direct property
  if (data?.weight) return String(data.weight);
  
  // From specs
  const weightSpec = getSpecValue(product, 'weight');
  if (weightSpec) {
    // Extract number from "57 g" format
    const match = weightSpec.match(/(\d+)\s*g/i);
    if (match) return match[1];
    return weightSpec;
  }
  
  return '—';
}

/**
 * Extract continuous current from specs (for ESCs)
 */
export function getContinuousCurrent(product: unknown): string {
  const data = toData(product);
  
  // Direct property
  if (data?.continuousCurrent) return String(data.continuousCurrent);
  
  // From specs
  const currentSpec = getSpecValue(product, 'continuous');
  if (currentSpec) {
    // Extract number from "40 A (under good cooling conditions)" format
    const match = currentSpec.match(/(\d+)\s*A/i);
    if (match) return match[1];
    return currentSpec;
  }
  
  return '—';
}
