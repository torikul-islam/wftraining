import VideoStreamDescription from '../videostreamindex/VideoStreamDescription';
import SignalingClientVideoSubscriptionConfiguration from './SignalingClientVideoSubscriptionConfiguration';
/**
 * [[SignalingClientSubscribe]] contains settings for the Subscribe SignalFrame.
 */
export default class SignalingClientSubscribe {
    attendeeId: string;
    sdpOffer: string;
    audioHost: string;
    audioMuted: boolean;
    audioCheckin: boolean;
    receiveStreamIds: number[];
    localVideoEnabled: boolean;
    videoStreamDescriptions: VideoStreamDescription[];
    connectionTypeHasVideo: boolean;
    compressedSdpOffer: Uint8Array;
    videoSubscriptionConfiguration: SignalingClientVideoSubscriptionConfiguration[];
    /** Initializes a SignalingClientSubscribe with the given properties.
     *
     * @param attendeeId Attendee ID of the client
     * @param sdpOffer SDP offer created by WebRTC
     * @param audioHost host
     * @param audioMuted Whether audio from client is muted
     * @param audioCheckin Whether audio is in checked-in state
     * @param receiveStreamIds Which video streams to receive
     * @param localVideoEnabled Whether to send a video stream for the local camera
     * @param array of local video stream description
     * @param connectionTypeHasVideo Whether connection type has video
     * @param compressedSdpOffer Compressed version of the SDP offer which was created by WebRTC
     */
    constructor(attendeeId: string, sdpOffer: string, audioHost: string, audioMuted: boolean, audioCheckin: boolean, receiveStreamIds: number[], localVideoEnabled: boolean, videoStreamDescriptions: VideoStreamDescription[], connectionTypeHasVideo: boolean, compressedSdpOffer: Uint8Array);
}
