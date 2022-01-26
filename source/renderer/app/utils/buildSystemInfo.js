// @flow
import type { SystemInfo } from '../types/systemInfoTypes';
import formatCpuInfo from './formatCpuInfo';
import { formattedBytesToSize } from './formatters';
import type { Environment } from '../../../common/types/environment.types';
import NetworkStatusStore from '../stores/NetworkStatusStore';

export const buildSystemInfo = (
  environment: Environment,
  networkStatus: NetworkStatusStore
): SystemInfo => ({
  platform: environment.os,
  platformVersion: environment.platformVersion,
  cpu: formatCpuInfo(environment.cpu),
  ram: formattedBytesToSize(environment.ram),
  meetsHardwareRequirements: environment.meetsHardwareRequirements,
  availableDiskSpace: networkStatus.diskSpaceAvailable,
  rtsFlagsModeEnabled: networkStatus.rtsFlagsModeEnabled,
});