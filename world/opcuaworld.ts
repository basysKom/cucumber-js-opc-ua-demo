import {IWorldOptions, setWorldConstructor, World} from '@cucumber/cucumber';
import {
  AttributeIds,
  BrowseDescriptionLike,
  BrowseDirection,
  ByteString,
  ClientSession,
  DataType,
  EventFilter,
  makeBrowsePath,
  makeNodeId,
  NodeId,
  ObjectIds,
  OPCUAClient,
  QualifiedName,
  QualifiedNameLike,
  ReferenceTypeIds,
  StatusCode,
  TimestampsToReturn,
  Variant,
} from 'node-opcua';
import {AutoIdServer} from '../src/autoidserver';
import {RfidReaderSimulator} from '../src/rfidreadersimulator';

interface ChildNode {
  name: string;
  nodeId: NodeId;
  typeDefinitionId: NodeId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class OpcUaWorld<ParametersType = any> extends World<ParametersType> {
  uaClient: OPCUAClient | null = null;
  session: ClientSession | null = null;
  receivedEvents: Variant[][] = [];
  methodCallStatus: StatusCode | null = null;
  startMethodOutputArg: number | null = null;
  readerSimulator: RfidReaderSimulator;
  server: AutoIdServer;

  readonly objectsFolderId = makeNodeId(ObjectIds.ObjectsFolder);
  rfidReaderTypeId = new NodeId();
  rfidScanEventType = new NodeId();
  rfidScanResultTypeId = new NodeId();

  constructor(options: IWorldOptions<ParametersType>) {
    super(options);

    const readerPort =
      parseInt(process.env.READER_SIMULATOR_PORT || '') || 5678;
    const opcuaPort = parseInt(process.env.OPCUA_BIND_PORT || '') || 4840;

    this.readerSimulator = new RfidReaderSimulator(readerPort);
    this.server = new AutoIdServer(opcuaPort, readerPort);
  }

  async initialize() {
    this.readerSimulator.initialize();
    await this.server.initialize();
  }

  async shutdown() {
    await this.disconnectFromServer();
    await this.server.stop();
    await this.readerSimulator.shutdown();
  }

  async connectToServer(url: string): Promise<void> {
    this.uaClient = OPCUAClient.create({endpointMustExist: false});
    return this.uaClient.connect(url).then(async () => {
      this.session = await this.uaClient!.createSession();
      await this.session.readNamespaceArray();

      this.rfidReaderTypeId = this.makeAutoIdNodeId(1003);
      this.rfidScanEventType = this.makeAutoIdNodeId(1006);
      this.rfidScanResultTypeId = this.makeAutoIdNodeId(3010);
    });
  }

  getAutoIdNsIndex(): number {
    if (!this.session)
      throw new Error('Unable to resolve namespace without session');

    return this.session.getNamespaceIndex(
      'http://opcfoundation.org/UA/AutoID/',
    );
  }

  makeAutoIdNodeId(identifier: number | string): NodeId {
    const index = this.getAutoIdNsIndex();
    return makeNodeId(identifier, index);
  }

  makeAutoIdBrowseName(name: string): QualifiedName {
    return new QualifiedName({name, namespaceIndex: this.getAutoIdNsIndex()});
  }

  async disconnectFromServer(): Promise<void> {
    if (this.uaClient) await this.uaClient.disconnect();
  }

  private async getChildNodeId(
    startNode: NodeId,
    name: QualifiedNameLike,
  ): Promise<NodeId> {
    if (this.session === null)
      throw new Error('Unable to resolve node id without session');

    return this.session
      .translateBrowsePath(makeBrowsePath(startNode, `/${name}`))
      .then(res => {
        if (res.targets?.length !== 1)
          throw new Error('Failed to resolve node');

        return res.targets[0].targetId;
      });
  }

  async getRfidReaderNodeId(): Promise<NodeId> {
    if (this.session === null)
      throw new Error('Unable to resolve node id without session');

    return this.browseChildNodes(this.objectsFolderId).then(result => {
      const readerId = result.find(
        child =>
          child.typeDefinitionId.toString() ===
          this.rfidReaderTypeId.toString(),
      );

      if (!readerId) throw new Error('Failed to find reader object');

      return readerId.nodeId;
    });
  }

  private async getScanStartNodeId() {
    if (this.session === null)
      throw new Error('Unable to resolve node id without session');

    return this.session.findMethodId(
      await this.getRfidReaderNodeId(),
      this.makeAutoIdBrowseName('ScanStart').toString(),
    );
  }

  private async getScanStopNodeId() {
    if (this.session === null)
      throw new Error('Unable to resolve node id without session');

    return this.session.findMethodId(
      await this.getRfidReaderNodeId(),
      this.makeAutoIdBrowseName('ScanStop').toString(),
    );
  }

  async createEventMonitoredItem(
    nodeId: NodeId,
    eventFilter: EventFilter,
  ): Promise<void> {
    if (this.session === null)
      throw new Error('Unable to create event monitored item without session');

    const sub = await this.session.createSubscription2({
      requestedPublishingInterval: 0,
      publishingEnabled: true,
    });

    const monitoredItem = await sub.monitor(
      {nodeId: nodeId, attributeId: AttributeIds.EventNotifier},
      {
        samplingInterval: 0,
        queueSize: 10,
        filter: eventFilter,
      },
      TimestampsToReturn.Both,
    );

    monitoredItem.on('changed', (fields: Variant[]) => {
      if (process.env.VERBOSE_LOG === 'true')
        console.log('Event received:', JSON.stringify(fields, null, 2));
      this.receivedEvents.push(fields);
    });
  }

  async callScanStartMethod(dataAvailable: boolean): Promise<void> {
    if (this.session === null)
      throw new Error('Unable to call a method without session');

    const settings = await this.session.constructExtensionObject(
      this.rfidScanResultTypeId,
      {dataAvailable},
    );

    const ids = await Promise.all([
      this.getRfidReaderNodeId(),
      this.getScanStartNodeId(),
    ]);

    await this.session
      .call({
        objectId: ids[0],
        methodId: ids[1],
        inputArguments: [{dataType: DataType.ExtensionObject, value: settings}],
      })
      .then(result => {
        this.methodCallStatus = result.statusCode;
        if (result.outputArguments?.length === 1)
          this.startMethodOutputArg = result.outputArguments[0].value;
      });
  }

  async callScanStopMethod(): Promise<void> {
    if (this.session === null)
      throw new Error('Unable to call a method without session');

    const ids = await Promise.all([
      this.getRfidReaderNodeId(),
      this.getScanStopNodeId(),
    ]);

    await this.session
      .call({
        objectId: ids[0],
        methodId: ids[1],
      })
      .then(result => {
        this.methodCallStatus = result.statusCode;
      });
  }

  private async browseInternal(
    desc: BrowseDescriptionLike,
    continuationPoint?: ByteString,
  ): Promise<ChildNode[]> {
    if (this.session === null)
      throw new Error('Unable to browse without session');

    const serviceCall = continuationPoint
      ? this.session.browseNext(continuationPoint, false)
      : this.session.browse(desc);

    const children: ChildNode[] = [];

    return serviceCall.then(async result => {
      if (result.references) {
        children.push(
          ...result.references.map(reference => {
            return {
              name: reference.browseName.toString(),
              nodeId: reference.nodeId,
              typeDefinitionId: reference.typeDefinition,
            };
          }),
        );

        if (result.continuationPoint)
          children.push(
            ...(await this.browseInternal(desc, result.continuationPoint)),
          );
      }

      return children;
    });
  }

  async browseChildNodes(nodeId: NodeId): Promise<ChildNode[]> {
    return this.browseInternal({
      nodeId,
      browseDirection: BrowseDirection.Forward,
      resultMask: 0xff,
      referenceTypeId: ReferenceTypeIds.HierarchicalReferences,
      includeSubtypes: true,
    });
  }

  async readChildVariableValue(name: QualifiedNameLike) {
    if (this.session === null)
      throw new Error('Unable to read device status without session');

    const nodeId = await this.getChildNodeId(
      await this.getRfidReaderNodeId(),
      name,
    );

    return this.session
      .read({
        nodeId,
        attributeId: AttributeIds.Value,
      })
      .then(value => {
        return value.value;
      });
  }
}

setWorldConstructor(OpcUaWorld);
