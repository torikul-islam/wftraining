import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import Logger from '../logger/Logger';
import MeetingSessionLifecycleEvent from '../meetingsession/MeetingSessionLifecycleEvent';
import MeetingSessionLifecycleEventCondition from '../meetingsession/MeetingSessionLifecycleEventCondition';
import MeetingSessionStatus from '../meetingsession/MeetingSessionStatus';
import SignalingClient from '../signalingclient/SignalingClient';
import VideoStreamIndex from '../videostreamindex/VideoStreamIndex';
import AudioLogEvent from './AudioLogEvent';
import VideoLogEvent from './VideoLogEvent';
declare type RawMetricReport = any;
/**
 * [[StatsCollector]] gathers statistics and sends metrics.
 */
export default class StatsCollector {
    private audioVideoController;
    private logger;
    private readonly interval;
    private static readonly INTERVAL_MS;
    private static readonly CLIENT_TYPE;
    private intervalScheduler;
    private signalingClient;
    private videoStreamIndex;
    private clientMetricReport;
    constructor(audioVideoController: AudioVideoController, logger: Logger, interval?: number);
    /**
     * Converts string to attribute format.
     */
    toAttribute(str: string): string;
    /**
     * Converts string to suffix format.
     */
    private toSuffix;
    metricsAddTime: (_name: string, _duration: number, _attributes?: {
        [id: string]: string;
    }) => void;
    metricsLogEvent: (_name: string, _attributes: {
        [id: string]: string;
    }) => void;
    /**
     * Logs the latency.
     */
    logLatency(eventName: string, timeMs: number, attributes?: {
        [id: string]: string;
    }): void;
    /**
     * Logs the state timeout.
     */
    logStateTimeout(stateName: string, attributes?: {
        [id: string]: string;
    }): void;
    /**
     * Logs the audio event.
     */
    logAudioEvent(eventName: AudioLogEvent, attributes?: {
        [id: string]: string;
    }): void;
    /**
     * Logs the video event.
     */
    logVideoEvent(eventName: VideoLogEvent, attributes?: {
        [id: string]: string;
    }): void;
    private logEventTime;
    /**
     * Logs the session status.
     */
    logMeetingSessionStatus(status: MeetingSessionStatus): void;
    /**
     * Logs the lifecycle event.
     */
    logLifecycleEvent(lifecycleEvent: MeetingSessionLifecycleEvent, condition: MeetingSessionLifecycleEventCondition): void;
    /**
     * Logs the events.
     */
    private logEvent;
    /**
     * Starts collecting statistics.
     */
    start(signalingClient: SignalingClient, videoStreamIndex: VideoStreamIndex): boolean;
    stop(): void;
    /**
     * Convert raw metrics to client metric report.
     */
    private updateMetricValues;
    /**
     * Converts RawMetricReport to StreamMetricReport and GlobalMetricReport and stores them as clientMetricReport.
     */
    private processRawMetricReports;
    /**
     *  Add stream metric dimension frames derived from metrics
     */
    private addStreamMetricDimensionFrames;
    /**
     * Packages a metric into the MetricFrame.
     */
    private addMetricFrame;
    /**
     * Packages metrics in GlobalMetricReport into the MetricFrame.
     */
    private addGlobalMetricsToProtobuf;
    /**
     * Packages metrics in StreamMetricReport into the MetricFrame.
     */
    private addStreamMetricsToProtobuf;
    /**
     * Packages all metrics into the MetricFrame.
     */
    private makeClientMetricProtobuf;
    /**
     * Sends the MetricFrame to Tincan via ProtoBuf.
     */
    private sendClientMetricProtobuf;
    /**
     * Checks if the type of RawMetricReport is stream related.
     */
    private isStreamRawMetricReport;
    /**
     * Returns the MediaType for a RawMetricReport.
     */
    private getMediaType;
    /**
     * Returns the Direction for a RawMetricReport.
     */
    private getDirectionType;
    /**
     * Checks if a RawMetricReport belongs to certain types.
     */
    isValidStandardRawMetric(rawMetricReport: RawMetricReport): boolean;
    /**
     * Checks if a RawMetricReport is stream related.
     */
    isValidSsrc(rawMetricReport: RawMetricReport): boolean;
    /**
     * Checks if a RawMetricReport is valid.
     */
    isValidRawMetricReport(rawMetricReport: RawMetricReport): boolean;
    /**
     * Filters RawMetricReports and keeps the required parts.
     */
    filterRawMetricReports(rawMetricReports: RawMetricReport[]): RawMetricReport[];
    /**
     * Performs a series operation on RawMetricReport.
     */
    private handleRawMetricReports;
    /**
     * Gets raw WebRTC metrics.
     */
    private getStatsWrapper;
}
export {};
