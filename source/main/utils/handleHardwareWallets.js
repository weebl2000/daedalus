// @flow
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { reject, without } from 'lodash';
import { logger } from './logging';

// Types
export type LedgerState = 'plugged_in' | 'unlocked' | 'ready';
export type LedgerErrorCode = 'not_supported' | 'unable_to_list_device_paths';
export type LedgerError = {
  code: LedgerErrorCode,
  message: any,
};

// Constants
export const LEDGER_STATES: {
  PLUGGED_IN: LedgerState,
  UNLOCKED: LedgerState,
  READY: LedgerState,
} = {
  PLUGGED_IN: 'plugged_in',
  UNLOCKED: 'unlocked',
  READY: 'ready', // Cardano app running
};
export const LEDGER_ERROR_CODES: {
  NOT_SUPPORTED: LedgerErrorCode,
  UNABLE_TO_LIST_DEVICE_PATHS: LedgerErrorCode,
} = {
  NOT_SUPPORTED: 'not_supported',
  UNABLE_TO_LIST_DEVICE_PATHS: 'unable_to_list_device_paths',
};

export class HardwareWalletsHandler {
  _ledger: {
    isInitialized: boolean,
    isSupported: ?boolean,
    isReady: ?boolean,
    devicePaths: Array<string>,
    devices: Array<Object>, // TODO: Introduce Device type
    observer: ?Function,
    error: ?LedgerError,
  } = {
    isInitialized: false,
    isSupported: null,
    isReady: null,
    devicePaths: [],
    devices: [],
    observer: null,
    error: null,
  };

  get isReady(): ?boolean {
    return this._ledger.isReady;
  }

  constructor() {
    logger.info('[HW-HANDLER]:constructor', { ledger: this._ledger });
  }

  initialize = async () => {
    // TransportNodeHid
    //   isSupported: [Function]: Promise: boolean,
    //   list: [Function]: Promise: Array<string>,
    //     -  returns a list of connected and unlocked Ledger device USB paths
    //   setListenDevicesDebounce: [Function], | defaults to 500ms
    //   setListenDevicesPollingSkip: [Function],
    //   setListenDevicesDebug: [Function],
    //   listen: [Function]
    //   open: [Function]

    try {
      this._ledger.isSupported = await TransportNodeHid.isSupported();
    } catch (error) {
      Object.assign(this._ledger, {
        isSupported: false,
        error: {
          code: LEDGER_ERROR_CODES.NOT_SUPPORTED,
          message: error,
        },
      });
    }

    if (this._ledger.isSupported) {
      try {
        // $FlowFixMe
        this._ledger.devicePaths = await TransportNodeHid.list();
      } catch (error) {
        Object.assign(this._ledger, {
          isSupported: false,
          error: {
            code: LEDGER_ERROR_CODES.UNABLE_TO_LIST_DEVICE_PATHS,
            message: error,
          },
        });
      }

      const observer = new LedgerEventObserver(this.updateDevices);
      TransportNodeHid.listen(observer);
      this._ledger.observer = observer;
    }

    this._ledger.isInitialized = true;
    this._ledger.isReady =
      !!this._ledger.isSupported && this._ledger.error == null;

    logger.info('[HW-HANDLER]:initialize', { ledger: this._ledger });
  };

  updateDevices = (device: Object, action: 'add' | 'remove') => {
    logger.info('[HW-HANDLER]:updateDevices:start', {
      action,
      device,
      devices: this._ledger.devices,
      // devicePaths: this._ledger.devicePaths,
    });
    if (action === 'add') {
      // this._ledger.devicePaths.push(device.path);
      this._ledger.devices.push(device);
    } else {
      // this._ledger.devicePaths = without(this._ledger.devicePaths, device.path);
      this._ledger.devices = reject(this._ledger.devices, {
        path: device.path,
      });
    }
    logger.info('[HW-HANDLER]:updateDevices:end', {
      action,
      device,
      devices: this._ledger.devices,
      // devicePaths: this._ledger.devicePaths,
    });
  };
}

class LedgerEventObserver {
  _onUpdateDevices: Function;

  constructor(onUpdateDevices: Function) {
    this._onUpdateDevices = onUpdateDevices;
  }

  next = async (event: {
    type: 'add' | 'remove',
    descriptor: ?string, // device.path
    device: Object,
    deviceModel: Object,
  }) => {
    // "event": {
    //   "type": "add",
    //   "descriptor": "IOService:/AppleACPIPlatformExpert/PCI0@0/AppleACPIPCI/XHC1@14/XHC1@14000000/HS03@14300000/USB2.0",
    //   "device": {
    //     "vendorId": 11415,
    //     "productId": 4113,
    //     "path": "IOService:/AppleACPIPlatformExpert/PCI0@0/AppleACPIPCI/XHC1@14/XHC1@14000000/HS03@14300000/USB2.0",
    //     "serialNumber": "0001",
    //     "manufacturer": "Ledger",
    //     "product": "Nano S",
    //     "release": 513,
    //     "interface": 0,
    //     "usagePage": 65440,
    //     "usage": 1
    //   },
    //   "deviceModel": {
    //     "id": "nanoS",
    //     "productName": "Ledger Nano S",
    //     "productIdMM": 16,
    //     "legacyUsbProductId": 1,
    //     "usbOnly": true,
    //     "memorySize": 327680,
    //     "blockSize": 4096
    //   }
    // }
    logger.info('[HW-HANDLER]:LedgerEventObserver:next', { event });

    const { type, device } = event;
    this._onUpdateDevices(device, type);

    // const transport = await TransportNodeHid.open(event.descriptor);
    // "transport": [
    //   "exchangeTimeout": 30000,
    //   "unresponsiveTimeout": 15000,
    //   "deviceModel": {
    //     "id": "nanoS",
    //     "productName": "Ledger Nano S",
    //     "productIdMM": 16,
    //     "legacyUsbProductId": 1,
    //     "usbOnly": true,
    //     "memorySize": 327680,
    //     "blockSize": 4096
    //   },
    //   "_events": {
    //     "_events": {},
    //     "_eventsCount": 0
    //   },
    //   "send",
    //   "exchangeBusyPromise",
    //   "exchangeAtomicImpl",
    //   "_appAPIlock": null,
    //   "device": [
    //     "_events": {},
    //     "_eventsCount": 1,
    //     "_maxListeners",
    //     "_raw": {},
    //     "write",
    //     "getFeatureReport",
    //     "sendFeatureReport",
    //     "setNonBlocking",
    //     "readSync",
    //     "readTimeout",
    //     "getDeviceInfo",
    //     "_paused": true
    //   ]
    //   "channel": 28767,
    //   "packetSize": 64,
    //   "disconnected": false
    //   "setDisconnected",
    //   "writeHID",
    //   "readHID",
    //   "exchange"
    // ]

    // transport.setDisconnected();
    // await transport.device.close();
    // await transport.close(); // https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-transport-node-hid-noevents/src/TransportNodeHid.js#L177
  };

  error = (error) => {
    logger.info('[HW-HANDLER]:LedgerEventObserver:error', { error });
  };

  complete = () => {
    logger.info('[HW-HANDLER]:LedgerEventObserver:complete');
  };
}