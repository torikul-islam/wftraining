import ApplicationMetadata from '../applicationmetadata/ApplicationMetadata';
import ServerSideNetworkAdaption from './ServerSideNetworkAdaption';
/**
 * [[SignalingClientJoin]] contains settings for the Join SignalFrame.
 */
export default class SignalingClientJoin {
    readonly applicationMetadata?: ApplicationMetadata;
    serverSideNetworkAdaption: ServerSideNetworkAdaption;
    supportedServerSideNetworkAdaptions: ServerSideNetworkAdaption[];
    disablePeriodicKeyframeRequestOnContentSender: boolean;
    /**
     * Initializes a SignalingClientJoin with the given properties.
     * @param applicationMetadata [[ApplicationMetadata]].
     */
    constructor(applicationMetadata?: ApplicationMetadata);
}
