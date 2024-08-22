import BrowserBehavior from '../browserbehavior/BrowserBehavior';
import Logger from '../logger/Logger';
import DefaultTransceiverController from './DefaultTransceiverController';
export default class SimulcastTransceiverController extends DefaultTransceiverController {
    static readonly LOW_LEVEL_NAME: string;
    static readonly MID_LEVEL_NAME: string;
    static readonly HIGH_LEVEL_NAME: string;
    static readonly NAME_ARR_ASCENDING: string[];
    static readonly BITRATE_ARR_ASCENDING: number[];
    protected videoQualityControlParameterMap: Map<string, RTCRtpEncodingParameters>;
    constructor(logger: Logger, browserBehavior: BrowserBehavior);
    setEncodingParameters(encodingParamMap: Map<string, RTCRtpEncodingParameters>): Promise<void>;
    setVideoSendingBitrateKbps(_bitrateKbps: number): Promise<void>;
    setupLocalTransceivers(): void;
    protected logVideoTransceiverParameters(): void;
    protected copyEncodingParams(fromEncodingParams: RTCRtpEncodingParameters, toEncodingParams: RTCRtpEncodingParameters): void;
}
