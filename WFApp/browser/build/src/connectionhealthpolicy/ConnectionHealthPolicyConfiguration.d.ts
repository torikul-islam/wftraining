export default class ConnectionHealthPolicyConfiguration {
    minHealth: number;
    maxHealth: number;
    initialHealth: number;
    connectionUnhealthyThreshold: number;
    noSignalThresholdTimeMs: number;
    connectionWaitTimeMs: number;
    zeroBarsNoSignalTimeMs: number;
    oneBarWeakSignalTimeMs: number;
    twoBarsTimeMs: number;
    threeBarsTimeMs: number;
    fourBarsTimeMs: number;
    fiveBarsTimeMs: number;
    cooldownTimeMs: number;
    pastSamplesToConsider: number;
    goodSignalTimeMs: number;
    fractionalLoss: number;
    packetsExpected: number;
    maximumTimesToWarn: number;
    missedPongsLowerThreshold: number;
    missedPongsUpperThreshold: number;
    maximumAudioDelayMs: number;
    maximumAudioDelayDataPoints: number;
    /**
     * The number of samples required to consider sending-audio to be unhealthy
     *
     * The default value is derived from the median for time taken for receiving an attendee presence message from the
     * server after joining. Attendee presence is only received when the client sends audio packets to the server, so
     * this metric is used as a proxy.
     */
    sendingAudioFailureSamplesToConsider: number;
    /**
     * The purpose of this field is to add a wait time/delay to our evaluation of sending audio health
     * as the microphone may sometimes cause a delay in sending audio packets during the initial stages of a connection.
     */
    sendingAudioFailureInitialWaitTimeMs: number;
}
