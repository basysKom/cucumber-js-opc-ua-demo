import {Socket} from 'net';
import {
  CallMethodResultOptions,
  DataType,
  ISessionContext,
  LocalizedText,
  nodesets,
  ObjectIds,
  OPCUAServer,
  StatusCodes,
  UAMethod,
  UAObject,
  UAVariable,
  Variant,
} from 'node-opcua';

export class AutoIdServer {
  server: OPCUAServer;
  readerObject: UAObject | null = null;
  scanRunning = false;
  scanWithDataAvailable = false;
  eventIndex = 0;

  stopped = false;

  readerSocket: Socket | null = null;
  readerPort: number;
  readerDataBuffer: Buffer<ArrayBufferLike> | null = null;
  readerConnected = false;

  constructor(listenPort: number, readerPort: number) {
    this.readerPort = readerPort;
    this.server = new OPCUAServer({
      port: listenPort,
      nodeset_filename: [
        nodesets.standard,
        `${__dirname}/../deps/ua-nodeset/DI/Opc.Ua.Di.NodeSet2.xml`,
        `${__dirname}/../deps/ua-nodeset/AutoID/Opc.Ua.AutoID.NodeSet2.xml`,
      ],
    });
  }

  private async setupAutoIdDevice() {
    const autoIdNs = this.server.engine.addressSpace?.getNamespace(
      'http://opcfoundation.org/UA/AutoID/',
    );

    if (!autoIdNs) throw new Error('Failed to resolve AutoID namespace');

    const objType = autoIdNs.findObjectType('RfidReaderDeviceType');

    if (!objType)
      throw new Error('Object type RfidReaderDeviceType was not found');

    this.readerObject = objType.instantiate({
      organizedBy: ObjectIds.ObjectsFolder,
      browseName: 'Scanner',
      optionals: ['ScanStart', 'ScanStop'],
    });

    if (!this.readerObject) throw new Error('Failed to instantiate object');

    (
      this.readerObject.getChildByName('DeviceName') as UAVariable
    ).setValueFromSource({
      dataType: DataType.String,
      value: 'Scanner',
    });

    (
      this.readerObject.getChildByName('DeviceRevision') as UAVariable
    ).setValueFromSource({
      dataType: DataType.String,
      value: '1.3',
    });

    (
      this.readerObject.getChildByName('HardwareRevision') as UAVariable
    ).setValueFromSource({
      dataType: DataType.String,
      value: '1.2',
    });

    (
      this.readerObject.getChildByName('SoftwareRevision') as UAVariable
    ).setValueFromSource({
      dataType: DataType.String,
      value: '1.15',
    });

    (
      this.readerObject.getChildByName('Manufacturer') as UAVariable
    ).setValueFromSource({
      dataType: DataType.LocalizedText,
      value: new LocalizedText({locale: 'de', text: 'basysKom GmbH'}),
    });

    (
      this.readerObject.getChildByName('Model') as UAVariable
    ).setValueFromSource({
      dataType: DataType.LocalizedText,
      value: new LocalizedText({locale: 'de', text: 'Demo RFID Reader'}),
    });

    (
      this.readerObject.getChildByName('SerialNumber') as UAVariable
    ).setValueFromSource({
      dataType: DataType.String,
      value: '12345678',
    });

    const scanStartMethod = this.server.engine
      .addressSpace!.getOwnNamespace()
      .findNode(
        this.readerObject.getChildByName('ScanStart')!.nodeId,
      ) as UAMethod;

    scanStartMethod.bindMethod(
      async (
        inputArguments: Variant[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context: ISessionContext,
      ): Promise<CallMethodResultOptions> => {
        let statusCode = StatusCodes.BadInvalidState;

        if (!this.scanRunning && this.readerConnected) {
          this.scanRunning = true;
          statusCode = StatusCodes.Good;
          this.setDeviceStatus(2); // Scanning

          this.scanWithDataAvailable =
            inputArguments[0].value.dataAvailable === true;
        }

        return {
          outputArguments: [
            {
              value: statusCode === StatusCodes.Good ? 0 : 17, // 17 == DeviceNotReady
              dataType: DataType.Int32,
            },
          ],
          statusCode,
        };
      },
    );

    const scanStopMethod = this.server.engine
      .addressSpace!.getOwnNamespace()
      .findNode(
        this.readerObject.getChildByName('ScanStop')!.nodeId,
      ) as UAMethod;

    scanStopMethod.bindMethod(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        inputArguments: Variant[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context: ISessionContext,
      ): Promise<CallMethodResultOptions> => {
        if (this.scanRunning) {
          this.scanRunning = false;
          this.setDeviceStatus(0); // Idle
          return {
            statusCode: StatusCodes.Good,
          };
        }

        return {
          statusCode: StatusCodes.BadInvalidState,
        };
      },
    );
  }

  private setDeviceStatus(status: number) {
    (
      this.readerObject!.getChildByName('DeviceStatus') as UAVariable
    ).setValueFromSource({
      dataType: DataType.Int32,
      value: status,
    });
  }

  private raiseEvent(payload: string, rssi: number) {
    const scanResultDt = this.server.engine.addressSpace?.findDataType(
      'RfidScanResult',
      3,
    );

    if (!scanResultDt)
      throw new Error('Failed to resolve RfidScanResult data type');

    const scanResult =
      this.server.engine.addressSpace!.constructExtensionObject(scanResultDt, {
        codeType: 'RAW:STRING',
        timestamp: new Date(),
        scanData: {string: payload},
        sighting: [
          {
            strength: rssi,
            timestamp: new Date(),
            currentPowerLevel: 3,
          },
        ],
      });

    this.readerObject!.raiseEvent('3:RfidScanEventType', {
      sourceName: {dataType: DataType.String, value: 'Demo'},
      sourceNode: {dataType: DataType.NodeId, value: this.readerObject!.nodeId},
      scanResult: {dataType: DataType.ExtensionObject, value: scanResult},
    });

    if (this.scanWithDataAvailable) {
      this.scanRunning = false;
      this.setDeviceStatus(0); // Idle
    }
  }

  async initialize() {
    this.stopped = false;

    await this.server.initialize();
    await this.setupAutoIdDevice();
    await this.server.start();
    this.setupReaderConnection();
  }

  async stop() {
    this.stopped = true;
    if (this.readerSocket !== null) this.readerSocket.destroy();

    await this.server.shutdown();
  }

  // Connection to the RFID reader
  setupReaderConnection() {
    if (this.readerSocket !== null) this.readerSocket.destroy();

    if (this.stopped) return;

    this.readerDataBuffer = null;
    this.readerSocket = new Socket();

    this.readerSocket.connect(this.readerPort, '127.0.0.1', () => {
      if (process.env.VERBOSE_LOG === 'true')
        console.log('Reader connection established');

      this.readerConnected = true;
      this.setDeviceStatus(0); // Idle
    });

    this.readerSocket.on('error', err => {
      if (process.env.VERBOSE_LOG === 'true')
        console.error('Reader connection failed:', err);

      this.readerConnected = false;
      this.scanRunning = false;
      this.setDeviceStatus(1); // Error
    });

    this.readerSocket.on('data', data => {
      if (this.readerDataBuffer) {
        this.readerDataBuffer = Buffer.concat([this.readerDataBuffer, data]);
      } else {
        this.readerDataBuffer = data;
      }

      while (this.readerDataBuffer && this.readerDataBuffer.byteLength > 0) {
        if (this.readerDataBuffer.byteLength <= 2) break;

        const payloadLength = this.readerDataBuffer.readUint16BE();

        if (this.readerDataBuffer.byteLength < payloadLength + 2) break;

        // Complete message received
        if (payloadLength > 0) {
          try {
            const payload = JSON.parse(
              this.readerDataBuffer.toString('utf8', 2, payloadLength + 2),
            );

            // Raise an event if a scan is running
            if (this.scanRunning) {
              this.raiseEvent(payload.data, payload.rssi);
            }
          } catch (ex) {
            if (process.env.VERBOSE_LOG === 'true')
              console.log('Malformed reader message received', ex);
          }
        }

        if (this.readerDataBuffer.length > payloadLength + 2) {
          const buffer = Buffer.alloc(
            this.readerDataBuffer.byteLength - payloadLength - 2,
          );

          this.readerDataBuffer.copy(buffer, 0, payloadLength + 2);
          this.readerDataBuffer = buffer;
        } else {
          this.readerDataBuffer = null;
        }
      }
    });

    this.readerSocket.on('close', () => {
      if (process.env.VERBOSE_LOG === 'true')
        console.log('Reader connection closed');
      this.readerConnected = false;
      this.scanRunning = false;
      this.setDeviceStatus(1); // Error
      this.scheduleReaderConnect();
    });
  }

  scheduleReaderConnect() {
    setTimeout(() => {
      this.setupReaderConnection();
    }, 100);
  }
}

// const s = new AutoIdServer(4840, 5678);
// s.initialize().catch(ex => {
//   console.error('Startup failed:', ex);
//   throw ex;
// });
