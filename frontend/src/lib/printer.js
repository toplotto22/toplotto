/** Printer service: ESC/POS via Web Bluetooth, Web Serial, Network */
import api, { API } from "./api";

const PRINTER_CFG_KEY = "tl_printer_cfg";

export const getPrinterConfig = () => {
  try { return JSON.parse(localStorage.getItem(PRINTER_CFG_KEY) || "{}"); }
  catch { return {}; }
};
export const setPrinterConfig = (cfg) => localStorage.setItem(PRINTER_CFG_KEY, JSON.stringify(cfg));

/** Fetch raw ESC/POS bytes for a ticket */
const fetchEscpos = async (ticketNumber, width = 80) => {
  const token = localStorage.getItem("tl_token");
  const res = await fetch(`${API}/tickets/${ticketNumber}/escpos?width=${width}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Pa ka jwenn done ESC/POS");
  return new Uint8Array(await res.arrayBuffer());
};

/** Generic chunked sender */
const writeChunks = async (writer, data, chunkSize = 256) => {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await writer(chunk);
    await new Promise((r) => setTimeout(r, 30));
  }
};

/** Bluetooth — typical thermal printer GATT service */
const BT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHARACTERISTIC = "00002af1-0000-1000-8000-00805f9b34fb";

export const printBluetooth = async (ticketNumber, width = 58) => {
  if (!navigator.bluetooth) throw new Error("Bluetooth pa disponib");
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BT_SERVICE] }],
    optionalServices: [BT_SERVICE],
  }).catch(async () => {
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BT_SERVICE],
    });
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BT_SERVICE);
  const ch = await service.getCharacteristic(BT_CHARACTERISTIC);
  const data = await fetchEscpos(ticketNumber, width);
  await writeChunks(async (chunk) => ch.writeValueWithoutResponse(chunk), data, 100);
  await new Promise((r) => setTimeout(r, 500));
  device.gatt.disconnect();
  return { ok: true };
};

/** Web Serial — USB */
export const printWebSerial = async (ticketNumber, width = 80) => {
  if (!navigator.serial) throw new Error("Web Serial pa disponib (Chrome/Edge sèlman)");
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  const data = await fetchEscpos(ticketNumber, width);
  await writer.write(data);
  await new Promise((r) => setTimeout(r, 200));
  await writer.close();
  await port.close();
  return { ok: true };
};

/** Network printer via backend */
export const printNetwork = async (ticketNumber, opts = {}) => {
  const cfg = getPrinterConfig();
  const payload = {
    ticket_number: ticketNumber,
    printer_ip: opts.ip || cfg.printer_ip,
    printer_port: opts.port || cfg.printer_port || 9100,
    width: opts.width || cfg.width || 80,
  };
  if (!payload.printer_ip) throw new Error("IP enprimant pa konfigure");
  const { data } = await api.post("/print/network", payload);
  return data;
};

/** Browser fallback (HTML print) */
export const printBrowser = () => window.print();
