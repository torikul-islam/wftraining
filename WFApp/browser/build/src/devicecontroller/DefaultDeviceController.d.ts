import ExtendedBrowserBehavior from '../browserbehavior/ExtendedBrowserBehavior';
import type { Destroyable } from '../destroyable/Destroyable';
import DeviceChangeObserver from '../devicechangeobserver/DeviceChangeObserver';
import EventController from '../eventcontroller/EventController';
import Logger from '../logger/Logger';
import DeviceControllerBasedMediaStreamBroker from '../mediastreambroker/DeviceControllerBasedMediaStreamBroker';
import MediaStreamBrokerObserver from '../mediastreambrokerobserver/MediaStreamBrokerObserver';
import AudioInputDevice from './AudioInputDevice';
import Device from './Device';
import RemovableAnalyserNode from './RemovableAnalyserNode';
import VideoInputDevice from './VideoInputDevice';
import VideoQualitySettings from './VideoQualitySettings';
export default class DefaultDeviceController implements DeviceControllerBasedMediaStreamBroker, Destroyable {
    private logger;
    private browserBehavior;
    eventController?: EventController;
    private static permissionDeniedOriginDetectionThresholdMs;
    private static defaultVideoWidth;
    private static defaultVideoHeight;
    private static defaultVideoFrameRate;
    private static defaultSampleRate;
    private static defaultSampleSize;
    private static defaultChannelCount;
    private static defaultLatencyHint?;
    private static audioContext;
    private deviceInfoCache;
    private transform;
    private activeDevices;
    private chosenVideoTransformDevice;
    private audioOutputDeviceId;
    private deviceChangeObservers;
    private mediaStreamBrokerObservers;
    private deviceLabelTrigger;
    private audioInputDestinationNode;
    private audioInputSourceNode;
    private mediaDeviceWrapper;
    private onDeviceChangeCallback?;
    private videoInputQualitySettings;
    private readonly useWebAudio;
    private readonly useMediaConstraintsFallback;
    private audioInputTaskQueue;
    private videoInputTaskQueue;
    private muted;
    private mediaStreamMuteObserver;
    constructor(logger: Logger, options?: {
        enableWebAudio?: boolean;
        useMediaConstraintsFallback?: boolean;
    }, browserBehavior?: ExtendedBrowserBehavior, eventController?: EventController);
    private isWatchingForDeviceChanges;
    private ensureWatchingDeviceChanges;
    /**
     * Unsubscribe from the `devicechange` event, which allows the device controller to
     * update its device cache.
     */
    private stopWatchingDeviceChanges;
    private shouldObserveDeviceChanges;
    private watchForDeviceChangesIfNecessary;
    destroy(): Promise<void>;
    listAudioInputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    listVideoInputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    listAudioOutputDevices(forceUpdate?: boolean): Promise<MediaDeviceInfo[]>;
    private pushAudioMeetingStateForPermissions;
    private pushVideoMeetingStateForPermissions;
    startAudioInput(device: AudioInputDevice): Promise<MediaStream | undefined>;
    private startAudioInputTask;
    stopAudioInput(): Promise<void>;
    private stopAudioInputTask;
    private chooseAudioTransformInputDevice;
    private chooseVideoTransformInputDevice;
    startVideoInput(device: VideoInputDevice): Promise<MediaStream | undefined>;
    private startVideoInputTask;
    stopVideoInput(): Promise<void>;
    private stopVideoInputTask;
    chooseAudioOutput(deviceId: string | null): Promise<void>;
    addDeviceChangeObserver(observer: DeviceChangeObserver): void;
    removeDeviceChangeObserver(observer: DeviceChangeObserver): void;
    createAnalyserNodeForAudioInput(): RemovableAnalyserNode | null;
    createAnalyserNodeForRawAudioInput(): RemovableAnalyserNode | null;
    private createAnalyserNodeForStream;
    startVideoPreviewForVideoInput(element: HTMLVideoElement): void;
    stopVideoPreviewForVideoInput(element: HTMLVideoElement): void;
    setDeviceLabelTrigger(trigger: () => Promise<MediaStream>): void;
    mixIntoAudioInput(stream: MediaStream): MediaStreamAudioSourceNode;
    chooseVideoInputQuality(width: number, height: number, frameRate: number): void;
    getVideoInputQualitySettings(): VideoQualitySettings | null;
    acquireAudioInputStream(): Promise<MediaStream>;
    acquireVideoInputStream(): Promise<MediaStream>;
    acquireDisplayInputStream(_streamConstraints: MediaStreamConstraints): Promise<MediaStream>;
    /**
     *
     * We need to do three things to clean up audio input
     *
     * * Close the tracks of the source stream.
     * * Remove the transform.
     * * Clean up the intrinsic stream's callback -- that's the stream that's tracked in
     *   `activeDevices` and needs to have its callbacks removed.
     */
    private releaseAudioTransformStream;
    /**
     *
     * We need to do three things to clean up video input
     *
     * * Close the tracks of the source stream.
     * * Remove the transform.
     * * Clean up the intrinsic stream's callback -- that's the stream that's tracked in
     *   `activeDevices` and needs to have its callbacks removed.
     */
    private releaseVideoTransformStream;
    private stopTracksAndRemoveCallbacks;
    private chosenVideoInputIsTransformDevice;
    muteLocalAudioInputStream(): void;
    unmuteLocalAudioInputStream(): void;
    private toggleLocalAudioInputStream;
    static getIntrinsicDeviceId(device: Device | null): string | string[] | undefined;
    static createEmptyAudioDevice(): MediaStream;
    static synthesizeAudioDevice(toneHz: number): MediaStream;
    private listDevicesOfKind;
    private updateDeviceInfoCacheFromBrowser;
    private listCachedDevicesOfKind;
    private alreadyHandlingDeviceChange;
    private handleDeviceChange;
    private handleDeviceStreamEnded;
    private forEachObserver;
    private forEachMediaStreamBrokerObserver;
    private areDeviceListsEqual;
    private intrinsicDeviceAsMediaStream;
    private hasSameMediaStreamId;
    private hasSameGroupId;
    private getGroupIdFromDeviceId;
    private handleGetUserMediaError;
    /**
     * Check whether a device is already selected.
     *
     * @param kind typically 'audio' or 'video'.
     * @param device the device about to be selected.
     * @param selection the existing device selection of this kind.
     * @param proposedConstraints the constraints that will be used when this device is selected.
     * @returns whether `device` matches `selection` — that is, whether this device is already selected.
     */
    private matchesDeviceSelection;
    private chooseInputIntrinsicDevice;
    private getErrorMessage;
    private handleNewInputDevice;
    private calculateMediaStreamConstraints;
    private getMediaStreamConstraintsFromTrackConstraints;
    private getMediaStreamConstraints;
    private deviceInfoFromDeviceId;
    hasAppliedTransform(): boolean;
    private isMediaStreamReusableByDeviceId;
    private getMediaTrackSettings;
    private reconnectAudioInputs;
    private setTransform;
    private removeTransform;
    private attachAudioInputStreamToAudioContext;
    /**
     * Return the end of the Web Audio graph: post-transform audio.
     */
    private getMediaStreamDestinationNode;
    /**
     * Return the start of the Web Audio graph: pre-transform audio.
     * If there's no transform node, this is the destination node.
     */
    private getMediaStreamOutputNode;
    /**
     * Overrides the default latency hint used by the user agent when creating the `AudioContext`. By default,
     * user agents will choose "interactive" which opts for the smallest possible audio buffer. This can
     * cause choppy audio in some cases on Windows. Therefore, "playback" will be chosen on Windows unless
     * this value is overridden with this function.
     * @param latencyHint The latency hint to be used when creating the Web Audio `AudioContext`
     */
    static setDefaultLatencyHint(latencyHint?: AudioContextLatencyCategory | number): void;
    /**
     * Returns the Web Audio `AudioContext` used by the {@link DefaultDeviceController}. The `AudioContext`
     * is created lazily the first time this function is called.
     * @returns a Web Audio `AudioContext`
     */
    static getAudioContext(): AudioContext;
    static closeAudioContext(): void;
    addMediaStreamBrokerObserver(observer: MediaStreamBrokerObserver): void;
    removeMediaStreamBrokerObserver(observer: MediaStreamBrokerObserver): void;
    private publishVideoInputDidChangeEvent;
    private publishAudioInputDidChangeEvent;
    private publishAudioOutputDidChangeEvent;
    private supportSampleRateConstraint;
    private supportSampleSizeConstraint;
    private supportChannelCountConstraint;
    private trace;
}
