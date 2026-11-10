/**
 * localStorage wrapper for mock data persistence
 */

const STORAGE_PREFIX = 'welkinrim-admin-';

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  },
};

/**
 * Initialize products data from client project
 */
export function initializeProducts(): void {
  const existing = storage.get<unknown[]>('products', []);
  if (existing && existing.length > 0) {
    return; // Already initialized
  }

  // Mock data - mirror of client's Well/src/lib/products.ts structure
  const mockProducts = [
    // Haemng Motors
    {
      id: 'haemng-2121-ii',
      series: 'Haemng' as const,
      model: 'Haemng 2121 II',
      category: 'motor' as const,
      kv: 380,
      voltage: '6S',
      peakCurrent: 10,
      recommendedThrust: '350g',
      peakThrust: '1,200g',
      propeller: '13×4.4 inch',
      diameter: 46,
      height: 20,
      weight: 86,
      escCompat: 'F30, 6S',
      powerSource: 'LiPo 6S',
      performance: [
        { throttle: 30, voltage: 24.94, power: 151, thrust: 2493, rpm: 9.93, efficiency: 0.40, current: 15.21 },
        { throttle: 50, voltage: 24.81, power: 362, thrust: 3705, rpm: 11.29, efficiency: 1.29, current: 14.45 },
        { throttle: 70, voltage: 24.61, power: 631, thrust: 4903, rpm: 9.86, efficiency: 2.60, current: 10.18 },
        { throttle: 100, voltage: 24.18, power: 1204, thrust: 6624, rpm: 5.91, efficiency: 8.42, current: 7.74 },
      ],
      thrustUnit: 'g',
    },
    {
      id: 'haemng-4143-ii-v1',
      series: 'Haemng' as const,
      model: 'Haemng 4143 II (V1)',
      category: 'motor' as const,
      kv: 100,
      voltage: '12S',
      peakCurrent: 56,
      recommendedThrust: '3.5–5.5 kg',
      peakThrust: '16 kg',
      propeller: '28×9.2 inch',
      diameter: 99,
      height: 33,
      weight: 560,
      escCompat: 'E120 12S',
      powerSource: 'Power Supply',
      performance: [
        { throttle: 30, voltage: 47.55, power: 115.07, thrust: 1.44, rpm: 12.51, efficiency: 2.42, current: 1554 },
        { throttle: 50, voltage: 47.34, power: 445.94, thrust: 4.58, rpm: 10.27, efficiency: 9.42, current: 2570 },
        { throttle: 70, voltage: 47.08, power: 1047.06, thrust: 7.88, rpm: 7.53, efficiency: 22.24, current: 3414 },
        { throttle: 100, voltage: 46.60, power: 2576.98, thrust: 15.16, rpm: 5.88, efficiency: 55.30, current: 4597 },
      ],
      thrustUnit: 'kg',
    },
    {
      id: 'haemng-1536',
      series: 'Haemng' as const,
      model: 'Haemng 1536',
      category: 'motor' as const,
      kv: 80,
      voltage: '24S',
      peakCurrent: 105,
      recommendedThrust: '14–19 kg',
      peakThrust: '44 kg',
      propeller: '40×13.1 inch',
      diameter: 145,
      height: 60,
      weight: 1854,
      escCompat: 'EH200, 24S',
      powerSource: 'Power Supply',
      performance: [
        { throttle: 30, voltage: 99.42, power: 711.85, thrust: 7.22, rpm: 10.14, efficiency: 7.16, current: 1626 },
        { throttle: 50, voltage: 99.11, power: 2312.24, thrust: 16.28, rpm: 7.04, efficiency: 23.33, current: 2480 },
        { throttle: 70, voltage: 98.57, power: 4622.93, thrust: 26.18, rpm: 5.66, efficiency: 46.90, current: 3127 },
        { throttle: 100, voltage: 97.87, power: 10227.42, thrust: 43.60, rpm: 4.26, efficiency: 104.50, current: 4020 },
      ],
      thrustUnit: 'kg',
    },
    // Maelard Motors
    {
      id: 'maelard-1026-v1',
      series: 'Maelard' as const,
      model: 'Maelard 1026 (V1)',
      category: 'motor' as const,
      kv: 100,
      voltage: '14S',
      peakCurrent: 179,
      recommendedThrust: '14–18 kg',
      peakThrust: '35 kg',
      propeller: '32×10.5 inch',
      diameter: 105,
      height: 39,
      weight: 850,
      escCompat: 'F180A 14S',
      powerSource: 'Power Supply',
      performance: [
        { throttle: 30, voltage: 55.08, power: 366.72, thrust: 5.00, rpm: 10.60, efficiency: 10.13, current: 2160 },
        { throttle: 50, voltage: 54.67, power: 1466.13, thrust: 14.08, rpm: 8.10, efficiency: 40.70, current: 2970 },
        { throttle: 70, voltage: 54.08, power: 3254.04, thrust: 23.66, rpm: 6.23, efficiency: 87.80, current: 3710 },
        { throttle: 100, voltage: 53.08, power: 7463.82, thrust: 38.18, rpm: 4.40, efficiency: 199.50, current: 4650 },
      ],
      thrustUnit: 'kg',
    },
    // ESCs
    {
      id: 'esc-f30',
      series: 'ESC' as const,
      model: 'F30',
      category: 'esc' as const,
      continuousCurrent: 30,
      currentLimit: 35,
      recommendedBattery: '6S LiPo',
      bec: '5V/2A',
      ipRating: 'IP65',
      weight: 42,
      size: '52×32×18 mm',
      powerLine: '10 AWG',
      motorLine: '12 AWG',
      throttlePulse: '1000–2000 μs',
      signalFreq: '400 Hz',
      signalVoltage: '3.3–5V',
      opTempRange: '-20°C to +80°C',
      speedSignalOutput: true,
      errorSignalOutput: true,
      protections: ['Over-current', 'Over-voltage', 'Over-temperature', 'Low-voltage', 'Signal loss'],
    },
    {
      id: 'esc-e120',
      series: 'ESC' as const,
      model: 'E120',
      category: 'esc' as const,
      continuousCurrent: 120,
      currentLimit: 150,
      recommendedBattery: '12S–14S',
      bec: '5.9V/3A',
      ipRating: 'IP67',
      weight: 185,
      size: '78×52×28 mm',
      powerLine: '6 AWG',
      motorLine: '8 AWG',
      throttlePulse: '1000–2000 μs',
      signalFreq: '400 Hz',
      signalVoltage: '3.3–5V',
      opTempRange: '-30°C to +85°C',
      speedSignalOutput: true,
      errorSignalOutput: true,
      protections: ['Over-current', 'Over-voltage', 'Over-temperature', 'Low-voltage', 'Signal loss', 'Motor lock'],
    },
    // Flight Controllers
    {
      id: 'fc-pro-v2',
      series: 'Flight Controller' as const,
      model: 'FC Pro V2',
      category: 'fc' as const,
      opVoltage: '5V ± 0.2V',
      opTemp: '-20°C to +60°C',
      size: '50×50 mm',
      weight: 28,
      pwmOutput: '8 channels',
      rcIn: 'SBUS/IBUS/PPM',
      usb: 'USB-C',
      powerMonitor: 'Voltage + Current',
      powerInput: '5V BEC',
      sensor: 'BMI270 + BMP388',
      compass: true,
      vibrationIsolation: true,
      uart: 6,
      i2c: 2,
      can: 2,
      adc: '3 channels',
      spi: 2,
      software: 'ArduPilot/INAV',
      outputConnector: 'GH 1.25mm',
      communication: 'UART, I2C, CAN, SPI',
    },
    // IPS
    {
      id: 'ips-h2121',
      series: 'IPS' as const,
      model: 'IPS-H2121',
      category: 'ips' as const,
      motorModel: 'Haemng 2121 II',
      escModel: 'F30',
      kv: 380,
      voltage: '6S',
      peakCurrent: 10,
      recommendedThrust: '350g',
      peakThrust: '1,200g',
      propeller: '13×4.4 inch',
      diameter: 46,
      height: 20,
      depth: 68,
      weight: 128,
    },
  ];

  storage.set('products', mockProducts);
}
