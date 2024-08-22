/**
 * [[MeetingSessionURLs]] contains the URLs that will be used to reach the
 * meeting service.
 */
export default class MeetingSessionURLs {
    /**
     * The audio host URL of the session
     */
    private _audioHostURL;
    /**
     * The signaling URL of the session
     */
    private _signalingURL;
    /**
     * The TURN control URL of the session
     */
    private _turnControlURL;
    /**
     * The event ingestion URL to send the meeting events.
     */
    private _eventIngestionURL;
    /**
     * Gets or sets the audio host URL with gets reflecting the result of the {@link MeetingSessionURLs.urlRewriter} function.
     */
    get audioHostURL(): string | null;
    set audioHostURL(value: string | null);
    /**
     * Gets or sets the signaling URL with gets reflecting the result of the {@link MeetingSessionURLs.urlRewriter} function.
     */
    get signalingURL(): string | null;
    set signalingURL(value: string | null);
    /**
     * Gets or sets the TURN control URL with gets reflecting the result of the {@link MeetingSessionURLs.urlRewriter} function.
     */
    get turnControlURL(): string | null;
    set turnControlURL(value: string | null);
    /**
     * Gets or sets the events ingestion URL with gets reflecting the result of the {@link MeetingSessionURLs.urlRewriter} function.
     */
    get eventIngestionURL(): string | null;
    set eventIngestionURL(value: string | null);
    /**
     * Function to transform URLs. Use this to rewrite URLs to traverse proxies.
     * The default implementation returns the original URL unchanged.
     */
    urlRewriter: (url: string | null) => string | null;
}
