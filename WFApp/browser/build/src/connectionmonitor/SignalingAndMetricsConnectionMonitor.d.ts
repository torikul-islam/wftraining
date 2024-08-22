import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import AudioVideoObserver from '../audiovideoobserver/AudioVideoObserver';
import ClientMetricReport from '../clientmetricreport/ClientMetricReport';
import ConnectionHealthData from '../connectionhealthpolicy/ConnectionHealthData';
import PingPong from '../pingpong/PingPong';
import PingPongObserver from '../pingpongobserver/PingPongObserver';
import RealtimeController from '../realtimecontroller/RealtimeController';
import StatsCollector from '../statscollector/StatsCollector';
import ConnectionMonitor from './ConnectionMonitor';
export default class SignalingAndMetricsConnectionMonitor implements ConnectionMonitor, PingPongObserver, AudioVideoObserver {
    private audioVideoController;
    private realtimeController;
    private connectionHealthData;
    private pingPong;
    private statsCollector;
    private isActive;
    private hasSeenValidPacketMetricsBefore;
    constructor(audioVideoController: AudioVideoController, realtimeController: RealtimeController, connectionHealthData: ConnectionHealthData, pingPong: PingPong, statsCollector: StatsCollector);
    start(): void;
    stop(): void;
    receiveSignalStrengthChange(signalStrength: number): void;
    didReceivePong(_id: number, latencyMs: number, clockSkewMs: number): void;
    didMissPongs(): void;
    metricsDidReceive(clientMetricReport: ClientMetricReport): void;
    private updateAudioPacketsSentInConnectionHealth;
    private addToMinuteWindow;
    private updateConnectionHealth;
}
