export interface DEV2_ADT_WAN {
  enable: string;
  name: string;
  secondaryName: string;
  customConnName: string;
  ifName: string;
  IPIntfIndex: string;
  serviceType: string;
  accessMode: string;
  ATMDestAddr: string;
  ATMEncapsulation: string;
  ATMQoS: string;
  ATMPeakCellRate: string;
  ATMMaximumBurstSize: string;
  ATMSustainableCellRate: string;
  vlanEnabled: string;
  vlanID: string;
  vlanPr: string;
  USBCountryIndex: string;
  USBISPIndex: string;
  USBManualAPNEnabled: string;
  USBDialNumber: string;
  USBAPN: string;
  USBModemStatus: string;
  USBSimStatus: string;
  USBModemType: string;
  USBPinAction: string;
  USBPinCode: string;
  USBAutoUnlockPin: string;
  USBIspCfgReaded: string;
  USBUserSaved: string;
  maxMTUSize: string;
  ISPName: string;
  connType: string;
  connIPv4Enabled: string;
  connIPv6Enabled: string;
  connStatusV4: string;
  connStatusV6: string;
  connIPv4Address: string;
  connIPv4SubnetMask: string;
  connIPv4Gateway: string;
  connIPv4DnsServer: string;
  connIPv6AddressType: string;
  connIPv6Address: string;
  connIPv6PrefixLength: string;
  connIPv6Gateway: string;
  connIPv6DnsServer: string;
  VPNServerUrlOrIP: string;
  VPNSecondaryType: string;
  dualConnType: string;
  secondConnStatus: string;
  secondConnIPv4Address: string;
  secondConnIPv4SubnetMask: string;
  secondConnIPv4Gateway: string;
  secondConnIPv4DnsServer: string;
  specifiedIPv4AddrEnabled: string;
  specifiedDnsv4Enabled: string;
  specifiedIPv6GatewayEnabled: string;
  specifiedDnsv6Enabled: string;
  reqIpv6rdInfo: string;
  reqIpv6DsliteInfo: string;
  reqIpv6MaptInfo: string;
  specifiedMACAddrEnabled: string;
  MACAddr: string;
  DHCPHostName: string;
  DHCPUnicast: string;
  PPPUserName: string;
  PPPPassword: string;
  PPPAuthProtocol: string;
  PPPIdleDisconnectTime: string;
  PPPConnectionTrigger: string;
  PPPLCPEcho: string;
  PPPoEACName: string;
  PPPoEServiceName: string;
  PPPLastConnError: string;
  NATEnabled: string;
  fullconeNATEnabled: string;
  SPIFirewallEnabled: string;
  IGMPProxyEnabled: string;
  MLDProxyEnabled: string;
  ripEnable: string;
  ripngEnable: string;
  ripVersion: string;
  acceptRA: string;
  sendRA: string;
  boundLANIntfList: string;
  boundTSList: string;
  boundTSEthList: string;
  disableDHCP: string;
  X_TP_BytesSent: string;
  X_TP_BytesReceived: string;
  X_TP_PacketsSent: string;
  X_TP_PacketsReceived: string;
  X_TP_UptimeV6: string;
  X_TP_Uptime: string;
  X_TP_DuplexMode: string;
  X_TP_MaxBitRate: string;
  X_TP_DefaultGw4Conn: string;
  X_TP_DefaultGw6Conn: string;
  X_TP_UsernameDomainEnable: string;
  X_TP_UsernameExcludeDomain: string;
  stack: string;
}

export interface DEV2_DEV_INFO {
  deviceCategory: string;
  manufacturer: string;
  manufacturerOUI: string;
  X_TP_DeviceModel: string;
  modelName: string;
  modelNumber: string;
  description: string;
  productClass: string;
  serialNumber: string;
  hardwareVersion: string;
  softwareVersion: string;
  additionalHardwareVersion: string;
  additionalSoftwareVersion: string;
  provisioningCode: string;
  upTime: string;
  X_TP_HardwareID: string;
  X_TP_FirmwareID: string;
  X_TP_OemID: string;
  X_TP_DevManufacturerURL: string;
  X_TP_DevModelVersion: string;
  X_TP_ProductID: string;
  X_TP_ProductVersion: string;
  X_TP_SpecialVersion: string;
  X_TP_SoftwareRevision: string;
  X_TP_SoftwareRevisionMinor: string;
  X_TP_PlatformVersion: string;
  X_TP_PlatformCodeName: string;
  X_TP_BetaCode: string;
  X_TP_DMVersion: string;
  X_TP_ConfigVersion: string;
  X_TP_BuildDate: string;
  X_TP_BuildTime: string;
  X_TP_IsManufacture: string;
  X_TP_IsBeta: string;
  X_TP_BetaInfo: string;
  X_TP_IsTrans: string;
  X_TP_TransInfo: string;
  X_TP_IsDateCode: string;
  X_TP_AgileACS_Sig: string;
  X_TP_BuildSpec: string;
  X_TP_IsFD: string;
  X_TP_Zone: string;
  X_TP_DevType: string;
  X_TP_ProtoVersion: string;
  stack: string;
}

export interface DEV2_MEM_STATUS {
  total: string;
  free: string;
  stack: string;
}

export interface DEV2_PROC_STATUS {
  CPUUsage: string;
  stack: string;
}

export interface DEV2_WIFI_APDEV {
  MACAddress: string;
  X_TP_IPAddress: string;
  backhaulLinkType: string;
  X_TP_HostName: string;
  X_TP_Active: string;
}

export interface DEV2_WIFI_APDEV_ASSOCDEV {
  X_TP_HostName: string;
  X_TP_RadioMac: string;
  X_TP_IPAddress: string;
  MACAddress: string;
  active: string;
}

export interface DEV2_WIFI_APDEV_RADIO {
  channel: string;
  operatingFrequencyBand: string;
  MACAddress: string;
}

export interface DEV2_WIFI_APDEV_ETHASSOCDEV {
  IPAddress: string;
  X_TP_HostName: string;
  MACAddress: string;
  active: string;
}

export interface DEV2_DHCPV4_POOL_STATICADDR {
  yiaddr: string;
  chaddr: string;
  stack: string;
}

export interface DEV2_FW_CHAIN {
  name: string;
  enable: string;
  ruleNumberOfEntries: string;
  stack: string;
}

export interface DEV2_FW_CHAIN_RULE {
  X_TP_RuleName: string;
  X_TP_RuleType: string;
  X_TP_SourceType: string;
  sourceIP: string;
  X_TP_SourceMACAddress: string;
  target: string;
  enable: string;
  stack: string;
}

export type ConnectedDevices = {
  mac: string;
  ip: string;
  vendor: string;
  name: string;
  routerInterface: string;
}[];

export type DhcpEntries = {
  entryId: string;
  mac: string;
  ip: string;
}[];

export type RouterStatus = {
  wanIp: string;
  connectionStatus: string;
  connectionUptime: string;
  routerUptime: string;
  firmwareVersion: string;
  hardwareVersion: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  totalDownload: string | null;
  totalUpload: string | null;
};
