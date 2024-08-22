import { SdkSignalFrame } from '../signalingprotocol/SignalingProtocol.js';
import SignalingClient from './SignalingClient';
import SignalingClientEventType from './SignalingClientEventType';
export default class SignalingClientEvent {
    client: SignalingClient;
    type: SignalingClientEventType;
    message: SdkSignalFrame;
    closeCode?: number;
    closeReason?: string;
    timestampMs: number;
    /** Initializes a SignalingClientEvent with the given SignalingClientEventType.
     *
     * @param client Indicates the SignalingClient associated with the event.
     * @param type Indicates the kind of event.
     * @param message SdkSignalFrame if type is ReceivedSignalFrame
     */
    constructor(client: SignalingClient, type: SignalingClientEventType, message: SdkSignalFrame, closeCode?: number, closeReason?: string);
    isConnectionTerminated(): boolean;
}
