import ClientMetricReport from '../clientmetricreport/ClientMetricReport';
import VideoSource from '../videosource/VideoSource';
import VideoStreamIdSet from '../videostreamidset/VideoStreamIdSet';
import VideoStreamIndex from '../videostreamindex/VideoStreamIndex';
import VideoDownlinkBandwidthPolicy from './VideoDownlinkBandwidthPolicy';
/**
 * [[AllHighestVideoBandwidthPolicy]] implements is a rudimentary policy that simply
 * always subscribes to the highest quality video stream available
 * for all non-self participants.
 */
export default class AllHighestVideoBandwidthPolicy implements VideoDownlinkBandwidthPolicy {
    private selfAttendeeId;
    private optimalReceiveSet;
    private subscribedReceiveSet;
    private videoSources;
    protected videoIndex: VideoStreamIndex;
    constructor(selfAttendeeId: string);
    reset(): void;
    updateIndex(videoIndex: VideoStreamIndex): void;
    updateMetrics(_clientMetricReport: ClientMetricReport): void;
    wantsResubscribe(): boolean;
    chooseSubscriptions(): VideoStreamIdSet;
    chooseRemoteVideoSources(videoSources: VideoSource[]): void;
    private calculateOptimalReceiveSet;
}
