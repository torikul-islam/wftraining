import { MeetingSessionCredentials, MeetingSessionStatus } from '..';
import ActiveSpeakerPolicy from '../activespeakerpolicy/ActiveSpeakerPolicy';
import AudioMixController from '../audiomixcontroller/AudioMixController';
import AudioMixObserver from '../audiomixobserver/AudioMixObserver';
import AudioProfile from '../audioprofile/AudioProfile';
import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import AudioVideoFacade from '../audiovideofacade/AudioVideoFacade';
import AudioVideoObserver from '../audiovideoobserver/AudioVideoObserver';
import ContentShareController from '../contentsharecontroller/ContentShareController';
import ContentShareObserver from '../contentshareobserver/ContentShareObserver';
import DataMessage from '../datamessage/DataMessage';
import DeviceChangeObserver from '../devicechangeobserver/DeviceChangeObserver';
import AudioInputDevice from '../devicecontroller/AudioInputDevice';
import DeviceController from '../devicecontroller/DeviceController';
import RemovableAnalyserNode from '../devicecontroller/RemovableAnalyserNode';
import VideoInputDevice from '../devicecontroller/VideoInputDevice';
import VideoQualitySettings from '../devicecontroller/VideoQualitySettings';
import RealtimeController from '../realtimecontroller/RealtimeController';
import type VolumeIndicatorCallback from '../realtimecontroller/VolumeIndicatorCallback';
import VideoCodecCapability from '../sdp/VideoCodecCapability';
import TranscriptionController from '../transcript/TranscriptionController';
import VideoSource from '../videosource/VideoSource';
import VideoTile from '../videotile/VideoTile';
import VideoTileController from '../videotilecontroller/VideoTileController';
import ContentShareSimulcastEncodingParameters from '../videouplinkbandwidthpolicy/ContentShareSimulcastEncodingParameters';
export default class DefaultAudioVideoFacade implements AudioVideoFacade, AudioVideoObserver {
    private audioVideoController;
    private videoTileController;
    private realtimeController;
    private audioMixController;
    private deviceController;
    private contentShareController;
    constructor(audioVideoController: AudioVideoController, videoTileController: VideoTileController, realtimeController: RealtimeController, audioMixController: AudioMixController, deviceController: DeviceController, contentShareController: ContentShareController);
    addObserver(observer: AudioVideoObserver): void;
    removeObserver(observer: AudioVideoObserver): void;
    setAudioProfile(audioProfile: AudioProfile): void;
    start(options?: {
        signalingOnly?: boolean;
    }): void;
    stop(): void;
    /**
     * This API will be deprecated in favor of `ClientMetricReport.getRTCStatsReport()`.
     *
     * It makes an additional call to the `getStats` API and therefore may cause slight performance degradation.
     *
     * Please subscribe to `metricsDidReceive(clientMetricReport: ClientMetricReport)` callback,
     * and get the raw `RTCStatsReport` via `clientMetricReport.getRTCStatsReport()`.
     */
    getRTCPeerConnectionStats(selector?: MediaStreamTrack): Promise<RTCStatsReport>;
    bindAudioElement(element: HTMLAudioElement): Promise<void>;
    unbindAudioElement(): void;
    getCurrentMeetingAudioStream(): Promise<MediaStream | null>;
    addAudioMixObserver(observer: AudioMixObserver): void;
    removeAudioMixObserver(observer: AudioMixObserver): void;
    bindVideoElement(tileId: number, videoElement: HTMLVideoElement): void;
    unbindVideoElement(tileId: number, cleanUpVideoElement?: boolean): void;
    startLocalVideoTile(): number;
    stopLocalVideoTile(): void;
    hasStartedLocalVideoTile(): boolean;
    removeLocalVideoTile(): void;
    getLocalVideoTile(): VideoTile | null;
    pauseVideoTile(tileId: number): void;
    unpauseVideoTile(tileId: number): void;
    getVideoTile(tileId: number): VideoTile | null;
    getAllRemoteVideoTiles(): VideoTile[];
    getAllVideoTiles(): VideoTile[];
    addVideoTile(): VideoTile;
    removeVideoTile(tileId: number): void;
    removeVideoTilesByAttendeeId(attendeeId: string): number[];
    removeAllVideoTiles(): void;
    captureVideoTile(tileId: number): ImageData | null;
    realtimeSubscribeToAttendeeIdPresence(callback: (attendeeId: string, present: boolean, externalUserId?: string, dropped?: boolean) => void): void;
    realtimeUnsubscribeToAttendeeIdPresence(callback: (attendeeId: string, present: boolean, externalUserId?: string, dropped?: boolean) => void): void;
    realtimeSetCanUnmuteLocalAudio(canUnmute: boolean): void;
    realtimeSubscribeToSetCanUnmuteLocalAudio(callback: (canUnmute: boolean) => void): void;
    realtimeUnsubscribeToSetCanUnmuteLocalAudio(callback: (canUnmute: boolean) => void): void;
    realtimeCanUnmuteLocalAudio(): boolean;
    realtimeMuteLocalAudio(): void;
    realtimeUnmuteLocalAudio(): boolean;
    realtimeSubscribeToMuteAndUnmuteLocalAudio(callback: (muted: boolean) => void): void;
    realtimeUnsubscribeToMuteAndUnmuteLocalAudio(callback: (muted: boolean) => void): void;
    realtimeIsLocalAudioMuted(): boolean;
    realtimeSubscribeToVolumeIndicator(attendeeId: string, callback: VolumeIndicatorCallback): void;
    realtimeUnsubscribeFromVolumeIndicator(attendeeId: string, callback?: VolumeIndicatorCallback): void;
    realtimeSubscribeToLocalSignalStrengthChange(callback: (signalStrength: number) => void): void;
    realtimeUnsubscribeToLocalSignalStrengthChange(callback: (signalStrength: number) => void): void;
    realtimeSendDataMessage(topic: string, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Uint8Array | string | any, lifetimeMs?: number): void;
    realtimeSubscribeToReceiveDataMessage(topic: string, callback: (dataMessage: DataMessage) => void): void;
    realtimeUnsubscribeFromReceiveDataMessage(topic: string): void;
    realtimeSubscribeToFatalError(callback: (error: Error) => void): void;
    realtimeUnsubscribeToFatalError(callback: (error: Error) => void): void;
    subscribeToActiveSpeakerDetector(policy: ActiveSpeakerPolicy, callback: (activeSpeakers: string[]) => void, scoresCallback?: (scores: {
        [attendeeId: string]: number;
    }) => void, scoresCallbackIntervalMs?: number): void;
    unsubscribeFromActiveSpeakerDetector(callback: (activeSpeakers: string[]) => void): void;
    listAudioInputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    listVideoInputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    listAudioOutputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    startAudioInput(device: AudioInputDevice): Promise<MediaStream | undefined>;
    stopAudioInput(): Promise<void>;
    startVideoInput(device: VideoInputDevice): Promise<MediaStream | undefined>;
    stopVideoInput(): Promise<void>;
    chooseAudioOutput(deviceId: string | null): Promise<void>;
    addDeviceChangeObserver(observer: DeviceChangeObserver): void;
    removeDeviceChangeObserver(observer: DeviceChangeObserver): void;
    createAnalyserNodeForAudioInput(): RemovableAnalyserNode | null;
    startVideoPreviewForVideoInput(element: HTMLVideoElement): void;
    stopVideoPreviewForVideoInput(element: HTMLVideoElement): void;
    setDeviceLabelTrigger(trigger: () => Promise<MediaStream>): void;
    mixIntoAudioInput(stream: MediaStream): MediaStreamAudioSourceNode;
    chooseVideoInputQuality(width: number, height: number, frameRate: number): void;
    setVideoMaxBandwidthKbps(maxBandwidthKbps: number): void;
    setVideoCodecSendPreferences(preferences: VideoCodecCapability[]): void;
    getVideoInputQualitySettings(): VideoQualitySettings | null;
    setContentAudioProfile(audioProfile: AudioProfile): void;
    enableSimulcastForContentShare(enable: boolean, encodingParams?: ContentShareSimulcastEncodingParameters): void;
    startContentShare(stream: MediaStream): Promise<void>;
    startContentShareFromScreenCapture(sourceId?: string, frameRate?: number): Promise<MediaStream>;
    pauseContentShare(): void;
    unpauseContentShare(): void;
    stopContentShare(): void;
    addContentShareObserver(observer: ContentShareObserver): void;
    removeContentShareObserver(observer: ContentShareObserver): void;
    setContentShareVideoCodecPreferences(preferences: VideoCodecCapability[]): void;
    private trace;
    getRemoteVideoSources(): VideoSource[];
    get transcriptionController(): TranscriptionController;
    promoteToPrimaryMeeting(credentials: MeetingSessionCredentials): Promise<MeetingSessionStatus>;
    demoteFromPrimaryMeeting(): void;
    audioVideoWasDemotedFromPrimaryMeeting(_: MeetingSessionStatus): void;
}
