import Device from '../devicecontroller/Device';
import Logger from '../logger/Logger';
import MeetingSession from '../meetingsession/MeetingSession';
import CheckAudioConnectivityFeedback from './CheckAudioConnectivityFeedback';
import CheckAudioInputFeedback from './CheckAudioInputFeedback';
import CheckAudioOutputFeedback from './CheckAudioOutputFeedback';
import CheckCameraResolutionFeedback from './CheckCameraResolutionFeedback';
import CheckContentShareConnectivityFeedback from './CheckContentShareConnectivityFeedback';
import CheckNetworkTCPConnectivityFeedback from './CheckNetworkTCPConnectivityFeedback';
import CheckNetworkUDPConnectivityFeedback from './CheckNetworkUDPConnectivityFeedback';
import CheckVideoConnectivityFeedback from './CheckVideoConnectivityFeedback';
import CheckVideoInputFeedback from './CheckVideoInputFeedback';
import MeetingReadinessChecker from './MeetingReadinessChecker';
import MeetingReadinessCheckerConfiguration from './MeetingReadinessCheckerConfiguration';
export default class DefaultMeetingReadinessChecker implements MeetingReadinessChecker {
    private logger;
    private meetingSession;
    private configuration;
    private static delay;
    private audioContext;
    private gainNode;
    private oscillatorNode;
    private destinationStream;
    private originalURLRewriter;
    private browserBehavior;
    constructor(logger: Logger, meetingSession: MeetingSession, configuration?: MeetingReadinessCheckerConfiguration);
    checkAudioInput(audioInputDevice: Device): Promise<CheckAudioInputFeedback>;
    checkAudioOutput(audioOutputDeviceInfo: MediaDeviceInfo | string, audioOutputVerificationCallback: () => Promise<boolean>, audioElement?: HTMLAudioElement): Promise<CheckAudioOutputFeedback>;
    private playTone;
    private stopTone;
    checkVideoInput(videoInputDevice: Device): Promise<CheckVideoInputFeedback>;
    checkCameraResolution(videoInputDevice: MediaDeviceInfo | string, width: number, height: number): Promise<CheckCameraResolutionFeedback>;
    private calculateVideoConstraint;
    checkContentShareConnectivity(sourceId?: string): Promise<CheckContentShareConnectivityFeedback>;
    checkAudioConnectivity(audioInputDevice: Device): Promise<CheckAudioConnectivityFeedback>;
    checkVideoConnectivity(videoInputDevice: Device): Promise<CheckVideoConnectivityFeedback>;
    checkNetworkUDPConnectivity(): Promise<CheckNetworkUDPConnectivityFeedback>;
    checkNetworkTCPConnectivity(): Promise<CheckNetworkTCPConnectivityFeedback>;
    private startMeeting;
    private stopMeeting;
    private executeTimeoutTask;
    private isAudioConnectionSuccessful;
}
