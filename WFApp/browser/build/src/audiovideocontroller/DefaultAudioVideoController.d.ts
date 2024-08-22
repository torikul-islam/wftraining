import { MeetingSessionCredentials } from '..';
import ActiveSpeakerDetector from '../activespeakerdetector/ActiveSpeakerDetector';
import AudioMixController from '../audiomixcontroller/AudioMixController';
import AudioProfile from '../audioprofile/AudioProfile';
import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import AudioVideoObserver from '../audiovideoobserver/AudioVideoObserver';
import Destroyable from '../destroyable/Destroyable';
import EventController from '../eventcontroller/EventController';
import Logger from '../logger/Logger';
import MediaStreamBroker from '../mediastreambroker/MediaStreamBroker';
import MediaStreamBrokerObserver from '../mediastreambrokerobserver/MediaStreamBrokerObserver';
import MeetingSessionConfiguration from '../meetingsession/MeetingSessionConfiguration';
import MeetingSessionStatus from '../meetingsession/MeetingSessionStatus';
import RealtimeController from '../realtimecontroller/RealtimeController';
import ReconnectController from '../reconnectcontroller/ReconnectController';
import VideoCodecCapability from '../sdp/VideoCodecCapability';
import SimulcastLayers from '../simulcastlayers/SimulcastLayers';
import VideoSource from '../videosource/VideoSource';
import VideoTileController from '../videotilecontroller/VideoTileController';
import SimulcastUplinkObserver from '../videouplinkbandwidthpolicy/SimulcastUplinkObserver';
import WebSocketAdapter from '../websocketadapter/WebSocketAdapter';
export default class DefaultAudioVideoController implements AudioVideoController, SimulcastUplinkObserver, MediaStreamBrokerObserver, Destroyable {
    private _logger;
    private _configuration;
    private _webSocketAdapter;
    private _realtimeController;
    private _activeSpeakerDetector;
    private _videoTileController;
    private _mediaStreamBroker;
    private _reconnectController;
    private _audioMixController;
    private _eventController;
    private _audioProfile;
    private connectionHealthData;
    private observerQueue;
    private meetingSessionContext;
    private sessionStateController;
    private static MIN_VOLUME_DECIBELS;
    private static MAX_VOLUME_DECIBELS;
    private static PING_PONG_INTERVAL_MS;
    private enableSimulcast;
    private useUpdateTransceiverControllerForUplink;
    private totalRetryCount;
    private startAudioVideoTimestamp;
    private signalingTask;
    private preStartObserver;
    private mayNeedRenegotiationForSimulcastLayerChange;
    private maxUplinkBandwidthKbps;
    private videoSendCodecPreferences;
    private promotedToPrimaryMeeting;
    private hasGetRTCPeerConnectionStatsDeprecationMessageBeenSent;
    private receiveIndexTask;
    private monitorTask;
    destroyed: boolean;
    constructor(configuration: MeetingSessionConfiguration, logger: Logger, webSocketAdapter: WebSocketAdapter, mediaStreamBroker: MediaStreamBroker, reconnectController: ReconnectController, eventController?: EventController);
    destroy(): Promise<void>;
    get configuration(): MeetingSessionConfiguration;
    get realtimeController(): RealtimeController;
    get activeSpeakerDetector(): ActiveSpeakerDetector;
    get videoTileController(): VideoTileController;
    get audioMixController(): AudioMixController;
    get logger(): Logger;
    get rtcPeerConnection(): RTCPeerConnection | null;
    get mediaStreamBroker(): MediaStreamBroker;
    get eventController(): EventController | undefined;
    /**
     * This API will be deprecated in favor of `ClientMetricReport.getRTCStatsReport()`.
     *
     * It makes an additional call to the `getStats` API and therefore may cause slight performance degradation.
     *
     * Please subscribe to `metricsDidReceive(clientMetricReport: ClientMetricReport)` callback,
     * and get the raw `RTCStatsReport` via `clientMetricReport.getRTCStatsReport()`.
     */
    getRTCPeerConnectionStats(selector?: MediaStreamTrack): Promise<RTCStatsReport>;
    setAudioProfile(audioProfile: AudioProfile): void;
    addObserver(observer: AudioVideoObserver): void;
    removeObserver(observer: AudioVideoObserver): void;
    forEachObserver(observerFunc: (observer: AudioVideoObserver) => void): void;
    private initSignalingClient;
    private uninstallPreStartObserver;
    private prestart;
    start(options?: {
        signalingOnly?: boolean;
    }): void;
    private connectWithPromises;
    private actionConnect;
    private createOrReuseSignalingTask;
    private actionFinishConnecting;
    stop(): void;
    private actionDisconnect;
    update(options?: {
        needsRenegotiation: boolean;
    }): boolean;
    private updateRemoteVideosFromLastVideosToReceive;
    updateLocalVideoFromPolicy(): boolean;
    private negotiatedBitrateLayersAllocationRtpHeaderExtension;
    restartLocalVideo(callback: () => void): boolean;
    replaceLocalVideo(videoStream: MediaStream): Promise<void>;
    replaceLocalAudio(audioStream: MediaStream): Promise<void>;
    private actionUpdateWithRenegotiation;
    private notifyStop;
    private actionFinishUpdating;
    reconnect(status: MeetingSessionStatus, error: Error | null): boolean;
    private actionReconnect;
    private wrapTaskName;
    private cleanUpMediaStreamsAfterStop;
    private getMeetingStatusCode;
    private enforceBandwidthLimitationForSender;
    handleMeetingSessionStatus(status: MeetingSessionStatus, error: Error | null): boolean;
    setVideoMaxBandwidthKbps(maxBandwidthKbps: number): void;
    handleHasBandwidthPriority(hasBandwidthPriority: boolean): Promise<void>;
    pauseReceivingStream(streamId: number): void;
    resumeReceivingStream(streamId: number): void;
    setVideoCodecSendPreferences(preferences: VideoCodecCapability[]): void;
    getRemoteVideoSources(): VideoSource[];
    encodingSimulcastLayersDidChange(simulcastLayers: SimulcastLayers): void;
    promoteToPrimaryMeeting(credentials: MeetingSessionCredentials): Promise<MeetingSessionStatus>;
    private actionPromoteToPrimaryMeeting;
    demoteFromPrimaryMeeting(): void;
    videoInputDidChange(videoStream: MediaStream | undefined): Promise<void>;
    audioInputDidChange(audioStream: MediaStream | undefined): Promise<void>;
}
