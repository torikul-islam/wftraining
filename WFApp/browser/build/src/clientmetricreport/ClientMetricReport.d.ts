import Logger from '../logger/Logger';
import { SdkMetric, SdkStreamDimension } from '../signalingprotocol/SignalingProtocol.js';
import VideoStreamIndex from '../videostreamindex/VideoStreamIndex';
import Direction from './ClientMetricReportDirection';
import MediaType from './ClientMetricReportMediaType';
import GlobalMetricReport from './GlobalMetricReport';
import StreamMetricReport from './StreamMetricReport';
/**
 * [[ClientMetricReport]] gets the media metrics used by ConnectionMonitor to
 * update connection health data.
 */
export default class ClientMetricReport {
    private logger;
    private videoStreamIndex?;
    private selfAttendeeId?;
    globalMetricReport: GlobalMetricReport;
    streamMetricReports: {
        [id: number]: StreamMetricReport;
    };
    rtcStatsReport: RTCStatsReport;
    currentTimestampMs: number;
    previousTimestampMs: number;
    currentSsrcs: {
        [id: number]: number;
    };
    constructor(logger: Logger, videoStreamIndex?: VideoStreamIndex, selfAttendeeId?: string);
    /**
     *  Metric transform functions
     */
    identityValue: (metricName?: string, ssrc?: number) => number;
    decoderLossPercent: (metricName?: string, ssrc?: number) => number;
    packetLossPercent: (sourceMetricName?: string, ssrc?: number) => number;
    jitterBufferMs: (metricName?: string, ssrc?: number) => number;
    countPerSecond: (metricName?: string, ssrc?: number) => number;
    bitsPerSecond: (metricName?: string, ssrc?: number) => number;
    secondsToMilliseconds: (metricName?: string, ssrc?: number) => number;
    averageTimeSpentPerSecondInMilliseconds: (metricName?: string, ssrc?: number) => number;
    isHardwareImplementation: (metricName?: string, ssrc?: number) => number;
    /**
     *  Canonical and derived metric maps
     */
    readonly globalMetricMap: {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    readonly audioUpstreamMetricMap: {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    readonly audioDownstreamMetricMap: {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    readonly videoUpstreamMetricMap: {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    readonly videoDownstreamMetricMap: {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    getMetricMap(mediaType?: MediaType, direction?: Direction): {
        [id: string]: {
            transform?: (metricName?: string, ssrc?: number) => number;
            type?: SdkMetric.Type;
            source?: string;
        };
    };
    /**
     *  Dimensions derived from metric
     */
    readonly streamDimensionMap: {
        [id: string]: SdkStreamDimension.Type;
    };
    getStreamDimensionMap(): {
        [id: string]: SdkStreamDimension.Type;
    };
    /**
     *  media Stream metrics
     */
    readonly observableVideoMetricSpec: {
        [id: string]: {
            source: string;
            media?: MediaType;
            dir?: Direction;
        };
    };
    /**
     * Observable metrics and related APIs
     */
    readonly observableMetricSpec: {
        [id: string]: {
            source: string;
            media?: MediaType;
            dir?: Direction;
        };
    };
    /**
     * Returns the value of the specific metric in observableMetricSpec.
     */
    getObservableMetricValue(metricName: string): number;
    /**
     * Returns the value of the specific metric in observableVideoMetricSpec.
     */
    getObservableVideoMetricValue(metricName: string, ssrcNum: number): number;
    /**
     * Returns the value of metrics in observableMetricSpec.
     */
    getObservableMetrics(): {
        [id: string]: number;
    };
    /**
     * Returns the value of metrics in observableVideoMetricSpec for each SSRC.
     */
    getObservableVideoMetrics(): {
        [id: string]: {
            [id: string]: {};
        };
    };
    /**
     * Returns the raw RTCStatsReport from RTCPeerConnection.getStats() API.
     */
    getRTCStatsReport(): RTCStatsReport;
    /**
     * Clones the ClientMetricReport and returns it.
     */
    clone(): ClientMetricReport;
    /**
     * Prints out the globalMetricReport, streamMetricReports and the corresponding timestamps from the current ClientMetricReport.
     */
    print(): void;
    /**
     * Removes the SSRCs that are no longer valid.
     */
    removeDestroyedSsrcs(): void;
}
