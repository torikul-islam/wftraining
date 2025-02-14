import AudioProfile from '../audioprofile/AudioProfile';
import AudioVideoController from '../audiovideocontroller/AudioVideoController';
import AudioVideoObserver from '../audiovideoobserver/AudioVideoObserver';
import ContentShareObserver from '../contentshareobserver/ContentShareObserver';
import Destroyable from '../destroyable/Destroyable';
import MeetingSessionConfiguration from '../meetingsession/MeetingSessionConfiguration';
import MeetingSessionStatus from '../meetingsession/MeetingSessionStatus';
import VideoCodecCapability from '../sdp/VideoCodecCapability';
import ContentShareSimulcastEncodingParameters from '../videouplinkbandwidthpolicy/ContentShareSimulcastEncodingParameters';
import ContentShareController from './ContentShareController';
import ContentShareMediaStreamBroker from './ContentShareMediaStreamBroker';
export default class DefaultContentShareController implements ContentShareController, AudioVideoObserver, Destroyable {
    private mediaStreamBroker;
    private contentAudioVideo;
    private attendeeAudioVideo;
    static createContentShareMeetingSessionConfigure(configuration: MeetingSessionConfiguration): MeetingSessionConfiguration;
    private observerQueue;
    private contentShareTile;
    destroyed: boolean;
    constructor(mediaStreamBroker: ContentShareMediaStreamBroker, contentAudioVideo: AudioVideoController, attendeeAudioVideo: AudioVideoController);
    setContentAudioProfile(audioProfile: AudioProfile): void;
    enableSimulcastForContentShare(enable: boolean, encodingParams?: ContentShareSimulcastEncodingParameters): void;
    startContentShare(stream: MediaStream): Promise<void>;
    startContentShareFromScreenCapture(sourceId?: string, frameRate?: number): Promise<MediaStream>;
    pauseContentShare(): void;
    unpauseContentShare(): void;
    setContentShareVideoCodecPreferences(preferences: VideoCodecCapability[]): void;
    destroy(): Promise<void>;
    stopContentShare(): void;
    addContentShareObserver(observer: ContentShareObserver): void;
    removeContentShareObserver(observer: ContentShareObserver): void;
    forEachContentShareObserver(observerFunc: (observer: ContentShareObserver) => void): void;
    audioVideoDidStart(): void;
    audioVideoDidStop(_sessionStatus: MeetingSessionStatus): void;
    private setupContentShareEvents;
}
