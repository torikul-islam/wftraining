import DevicePixelRatioMonitor from '../devicepixelratiomonitor/DevicePixelRatioMonitor';
import DevicePixelRatioObserver from '../devicepixelratioobserver/DevicePixelRatioObserver';
import VideoTileController from '../videotilecontroller/VideoTileController';
import VideoTile from './VideoTile';
import VideoTileState from './VideoTileState';
export default class DefaultVideoTile implements DevicePixelRatioObserver, VideoTile {
    private tileController;
    private devicePixelRatioMonitor;
    private tileState;
    /**
     * Connect a video stream to a video element by setting the srcObject of the video element to the video stream.
     * @param videoStream The video stream input.
     * @param videoElement The video element input.
     * @param localTile Flag to indicate whether this is a local video.
     */
    static connectVideoStreamToVideoElement(videoStream: MediaStream, videoElement: HTMLVideoElement, localTile: boolean): void;
    /**
     * Disconnect a video stream from a video element by setting `HTMLVideoElement.srcObject` to `null`.
     * @param videoElement The video element input.
     * @param dueToPause A flag to indicate whether this function is called due to pausing video tile.
     * Based on `keepLastFrameWhenPaused`, it sets `HTMLVideoElement.srcObject` to `null`.
     * @param keepLastFrameWhenPaused If `true` and `dueToPause` is also `true`, then we will not set `HTMLVideoElement.srcObject` of the
     * video element to `null` when it is paused and therefore, the last frame of the stream will be shown.
     */
    static disconnectVideoStreamFromVideoElement(videoElement: HTMLVideoElement | null, dueToPause: boolean, keepLastFrameWhenPaused?: boolean | undefined): void;
    constructor(tileId: number, localTile: boolean, tileController: VideoTileController, devicePixelRatioMonitor: DevicePixelRatioMonitor);
    destroy(): void;
    devicePixelRatioChanged(newDevicePixelRatio: number): void;
    id(): number;
    state(): VideoTileState;
    stateRef(): VideoTileState;
    bindVideoStream(attendeeId: string, localTile: boolean, mediaStream: MediaStream | null, contentWidth: number | null, contentHeight: number | null, streamId: number | null, externalUserId?: string): void;
    bindVideoElement(videoElement: HTMLVideoElement | null): void;
    pause(): void;
    unpause(): void;
    markPoorConnection(): boolean;
    unmarkPoorConnection(): boolean;
    capture(): ImageData | null;
    setStreamId(id: number): void;
    private sendTileStateUpdate;
    private updateActiveState;
    private updateVideoElementPhysicalPixels;
    private updateVideoStreamOnVideoElement;
    private static setVideoElementFlag;
}
