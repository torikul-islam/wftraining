import BrowserBehavior from './BrowserBehavior';
import ExtendedBrowserBehavior from './ExtendedBrowserBehavior';
export default class DefaultBrowserBehavior implements BrowserBehavior, ExtendedBrowserBehavior {
    private readonly browser;
    private readonly uaParserResult;
    private browserSupport;
    private browserName;
    private chromeLike;
    private webkitBrowsers;
    private static MIN_IOS_SUPPORT_CANVAS_STREAM_PLAYBACK;
    private static MIN_IOS_NON_SAFARI_SUPPORT_CANVAS_STREAM_PLAYBACK;
    version(): string;
    majorVersion(): number;
    osMajorVersion(): number;
    name(): string;
    hasChromiumWebRTC(): boolean;
    hasWebKitWebRTC(): boolean;
    hasFirefoxWebRTC(): boolean;
    requiresPlaybackLatencyHintForAudioContext(): boolean;
    supportsCanvasCapturedStreamPlayback(): boolean;
    supportsBackgroundFilter(): boolean;
    supportsVideoLayersAllocationRtpHeaderExtension(): boolean;
    requiresResolutionAlignment(width: number, height: number): [number, number];
    requiresCheckForSdpConnectionAttributes(): boolean;
    requiresIceCandidateGatheringTimeoutWorkaround(): boolean;
    requiresBundlePolicy(): RTCBundlePolicy;
    requiresNoExactMediaStreamConstraints(): boolean;
    requiresGroupIdMediaStreamConstraints(): boolean;
    getDisplayMediaAudioCaptureSupport(): boolean;
    doesNotSupportMediaDeviceLabels(): boolean;
    isSupported(): boolean;
    isSimulcastSupported(): boolean;
    supportDownlinkBandwidthEstimation(): boolean;
    supportString(): string;
    supportedVideoCodecs(): Promise<string[]>;
    supportsSetSinkId(): boolean;
    disableResolutionScaleDown(): boolean;
    disable480pResolutionScaleDown(): boolean;
    requiresDisablingH264Encoding(): boolean;
    requiresVideoPlayWorkaround(): boolean;
    /**
     * Check if the current browser supports the [[VideoFxProcessor]].
     * The videoFxProcessor is not supported on android.
     * @returns boolean representing if browser supports [[VideoFxProcessor]].
     */
    isVideoFxSupportedBrowser(): boolean;
    private isIOSSafari;
    private isSafari;
    private isFirefox;
    private isIOSFirefox;
    private isIOSChrome;
    private isChrome;
    private isEdge;
    private isIOSEdge;
    private isSamsungInternet;
    private isAndroid;
    private isPixel3;
}
