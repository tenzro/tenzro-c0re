import { TenzroNetworkBridge } from '../integration/bridge';
import { DHTNetwork } from '../dht/network';
import { StorageManager } from '../storage/manager';
import { ContentDiscovery } from '../discovery/content';
import { SearchEngine } from '../search/engine';
import { VersionControl } from '../registry/version';

export interface CoreComponents {
    bridge: TenzroNetworkBridge;
    network: DHTNetwork;
    storage: StorageManager;
    discovery: ContentDiscovery;
    search: SearchEngine;
    versionControl: VersionControl;
}

export interface ComponentRefs {
    bridge: TenzroNetworkBridge | undefined;
    network: DHTNetwork | undefined;
    storage: StorageManager | undefined;
    discovery: ContentDiscovery | undefined;
    search: SearchEngine | undefined;
    versionControl: VersionControl | undefined;
}