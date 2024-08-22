import SDPCandidateType from './SDPCandidateType';
import SDPMediaSection from './SDPMediaSection';
import VideoCodecCapability from './VideoCodecCapability';
/**
 * [[SDP]] includes a few helper functions for parsing sdp string.
 */
export default class SDP {
    sdp: string;
    private static CRLF;
    static rfc7587LowestBitrate: number;
    static rfc7587HighestBitrate: number;
    /**
     * Construts a new [[SDP]] object
     */
    constructor(sdp: string);
    /**
     * Clones an SDP
     */
    clone(): SDP;
    /**
     * Checks if the candidate is a valid RTP candidate
     */
    static isRTPCandidate(candidate: string): boolean;
    /**
     * Constructs a new SDP with the given set of SDP lines.
     */
    static linesToSDP(lines: string[]): SDP;
    /**
     * Returns an enum of [[candidateType]] for the given string.
     */
    static candidateTypeFromString(candidateType: string): SDPCandidateType | null;
    /**
     * Returns the candidate type assocaited with the sdpline.
     */
    static candidateType(sdpLine: string): string | null;
    /**
     * Returns the media type associated with the sdp line.
     */
    private static mediaType;
    /**
     * Erase out "a=mid"  from the sdp line.
     */
    private static mid;
    /**
     * Return the direction associated with the sdp line.
     */
    private static direction;
    /**
     * Format the sdp string into separate lines.
     */
    static splitLines(blob: string): string[];
    /**
     * split the different sdp sections
     */
    static splitSections(sdp: string): string[];
    /**
     * split the different sdp sections
     */
    private static findActiveCameraSection;
    /**
     * Extract the SSRCs from the group line.
     *
     * a=ssrc-group:<semantics> <ssrc-id> ...
     */
    static extractSSRCsFromFIDGroupLine(figGroupLine: string): string;
    /**
     * Extracts the lines from the sdp blob that matches the given prefix.
     */
    static matchPrefix(blob: string, prefix: string): string[];
    /**
     * Splits SDP string into lines
     */
    lines(): string[];
    /**
     * Checks if SDP has a video section.
     */
    hasVideo(): boolean;
    /**
     * Checks whether the SDP has candidates for any m-line
     */
    hasCandidates(): boolean;
    /**
     * Checks whether the SDP has candidates for all m-lines
     */
    hasCandidatesForAllMLines(): boolean;
    /**
     * Removes candidates of a given type from SDP
     */
    withoutCandidateType(candidateTypeToExclude: SDPCandidateType): SDP;
    /**
     * Removes server reflexive candidate from SDP
     */
    withoutServerReflexiveCandidates(): SDP;
    /**
     * Inserts a parameter to the SDP local offer setting the desired average audio bitrate
     */
    withAudioMaxAverageBitrate(maxAverageBitrate: number | null): SDP;
    /**
     * Update the SDP to include stereo
     */
    withStereoAudio(): SDP;
    /**
     * Here we loop through each line in the SDP
     * and construct an array containing the fmtp
     * attribute for all the audio m lines that use
     * the opus codec. If it doesn't use opus codec
     * we add null to the array which tells
     * updateOpusFmtpAttributes that no update is
     * needed for that particular fmtp attribute line
     */
    static findOpusFmtpAttributes(sdpLines: string[]): string[] | null;
    /**
     * Update the fmtp lines in each audio m section
     * that correspond to the opus codec with the parameters
     * specifief in additionalParams
     */
    static updateOpusFmtpAttributes(srcLines: string[], fmtpAttributes: (string | null)[], additionalParams: string[]): string[];
    /**
     * Munges Unified-Plan SDP from different browsers to conform to one format
     * TODO: will remove this soon.
     */
    withUnifiedPlanFormat(): SDP;
    /**
     * Returns the total number of unique Rtp header extensions.
     */
    getUniqueRtpHeaderExtensionId(srcLines: string[]): number;
    /**
     * To avoid resubscribing to preemptively turn off simulcast streams or to switch layers
     * negotiate with the back end to determine whether to use layers allocation header extension
     * this will not add the packet overhead unless negotiated to avoid waste
     */
    withVideoLayersAllocationRtpHeaderExtension(previousSdp: SDP): SDP;
    /**
     * Extracts the ssrc for the sendrecv video media section in SDP
     */
    ssrcForVideoSendingSection(): string;
    /**
     * Returns whether the sendrecv video sections if exist have two different SSRCs in SDPs
     */
    videoSendSectionHasDifferentSSRC(prevSdp: SDP): boolean;
    /**
     * Removes H.264 from the send section.
     */
    removeH264SupportFromSendSection(): SDP;
    /**
     * List of parsed media sections sections in order they occur on SDP.
     */
    mediaSections(): SDPMediaSection[];
    /**
     * Return RTP header extension ID if the extension exists in section. Return -1 otherwise
     */
    static getRtpHeaderExtensionIdInSection(section: string, url: string): number;
    /**
     * Return RTP header extension ID if the extension exists in SDP. Return -1 otherwise
     */
    getRtpHeaderExtensionId(url: string): number;
    /**
     * Return if extension ID exists in the SDP
     */
    hasRtpHeaderExtensionId(targetId: number): boolean;
    /**
     * Based off the provided preferences, this function will reorder the payload types listed in the `m=video` line.
     *
     * This will be applied to the `a=sendrecv` section so it can be applied on either local or remote SDPs. It can be used to
     * 'polyfill' `RTCRtpSender.setCodecPreferences' on the offer, but it can also be used on remote SDPs to force the
     * codec actually being send, since the send codec is currently dependent on the remote answer (i.e. `setCodecPreferences` doesn't actually
     * have any impact unless the remote side respects the order of codecs).
     */
    withVideoSendCodecPreferences(preferences: VideoCodecCapability[]): SDP;
    private sectionWithCodecPreferences;
    /**
     * Returns the `VideoCodecCapability` which corresponds to the first payload type in the
     * m-line (e.g. `m=video 9 UDP/+++ <highest priority payload type> <payload type> <payload type> ...`),
     * parsing the rest of the SDP for relevant information to construct it.
     *
     * Returns undefined if there is no video send section or no codecs in the send section
     */
    highestPriorityVideoSendCodec(): VideoCodecCapability | undefined;
}
