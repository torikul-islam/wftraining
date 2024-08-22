// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import './styleV2.scss';
import 'bootstrap';
import "jquery-confirm";
import '../../node_modules/jquery-confirm/dist/jquery-confirm.min.css';
import 'anypicker';
import {v4 as uuidv4} from 'uuid';

import {
  AsyncScheduler,
  TimeoutScheduler,
  AudioInputDevice,
  AudioVideoFacade,
  AudioVideoObserver,
  ClientMetricReport,
  ConsoleLogger,
  ContentShareObserver,
  DataMessage,
  DefaultActiveSpeakerPolicy,
  DefaultBrowserBehavior,
  DefaultDeviceController,
  DefaultMeetingEventReporter,
  DefaultMeetingSession,
  DefaultModality,
  DefaultVideoTransformDevice,
  Device,
  DeviceChangeObserver,
  EventAttributes,
  EventIngestionConfiguration,
  EventName,
  EventReporter,
  LogLevel,
  Logger,
  MeetingEventsClientConfiguration,
  MeetingSession,
  MeetingSessionConfiguration,
  MeetingSessionStatus,
  MeetingSessionStatusCode,
  MeetingSessionVideoAvailability,
  MultiLogger,
  NoOpEventReporter,
  RemovableAnalyserNode,
  SimulcastLayers,
  VideoInputDevice,
  VoiceFocusDeviceTransformer,
  VoiceFocusPaths,
  VoiceFocusTransformDevice,
  isAudioTransformDevice,
  DefaultEventController,
  POSTLogger,
  VideoTileState,
  DefaultAudioMixController,
  ClientVideoStreamReceivingReport,
  VideoSource,
} from '../../../../src/index';

import { VolumeTransformDevice } from './VolumeTransformDevice';
import { getPOSTLogger } from '../util/MeetingLogger';

import { S3Uploader } from "../util/S3Uploader";

const SHOULD_DIE_ON_FATALS = (() => {
  const isLocal = false;//document.location.host === '127.0.0.1:8080';
  const fatalYes = document.location.search.includes('fatal=1');
  const fatalNo = document.location.search.includes('fatal=0');
  return fatalYes || (isLocal && !fatalNo);
})();

let fatal: (e: Error) => void;

// This shim is needed to avoid warnings when supporting Safari.
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

class WorkoutTileOrganizer {
  // this is index instead of length
  static MAX_TILES = 17;
  tiles: { [id: number]: number } = {};
  tileStates: { [id: number]: boolean } = {};
  remoteTileCount = 0;

  acquireTileIndex(tileId: number): number {
    for (let index = 0; index <= WorkoutTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        return index;
      }
    }
    for (let index = 0; index <= WorkoutTileOrganizer.MAX_TILES; index++) {
      if (!(index in this.tiles)) {
        this.tiles[index] = tileId;
        this.remoteTileCount++;
        return index;
      }
    }
    throw new Error('no tiles are available');
  }

  releaseTileIndex(tileId: number): number {
    for (let index = 0; index <= WorkoutTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        this.remoteTileCount--;
        delete this.tiles[index];
        return index;
      }
    }
    return WorkoutTileOrganizer.MAX_TILES;
  }

  releaseAll(){
    this.remoteTileCount = 0;
    this.tiles = {};
    this.tileStates = {};
    return WorkoutTileOrganizer.MAX_TILES;
  }
}

// Support a set of query parameters to allow for testing pre-release versions of
// Amazon Voice Focus. If none of these parameters are supplied, the SDK default
// values will be used.
const search = new URLSearchParams(document.location.search);
const VOICE_FOCUS_CDN = search.get('voiceFocusCDN') || undefined;
const VOICE_FOCUS_ASSET_GROUP = search.get('voiceFocusAssetGroup') || undefined;
const VOICE_FOCUS_REVISION_ID = search.get('voiceFocusRevisionID') || undefined;

const VOICE_FOCUS_PATHS: VoiceFocusPaths | undefined = VOICE_FOCUS_CDN && {
  processors: `${VOICE_FOCUS_CDN}processors/`,
  wasm: `${VOICE_FOCUS_CDN}wasm/`,
  workers: `${VOICE_FOCUS_CDN}workers/`,
  models: `${VOICE_FOCUS_CDN}wasm/`,
};

const VOICE_FOCUS_SPEC = {
  assetGroup: VOICE_FOCUS_ASSET_GROUP,
  revisionID: VOICE_FOCUS_REVISION_ID,
  paths: VOICE_FOCUS_PATHS,
};

// type VideoFilterName = 'Emojify' | 'CircularCut' | 'NoOp' | 'Segmentation' | 'None';

// const VIDEO_FILTERS: VideoFilterName[] = ['Emojify', 'CircularCut', 'NoOp'];

class TestSound {
  static testAudioElement = new Audio();

  constructor(
    private logger: Logger,
    private sinkId: string | null,
    private frequency: number = 440,
    private durationSec: number = 1,
    private rampSec: number = 0.1,
    private maxGainValue: number = 0.1
  ) {}

  async init(): Promise<void> {
    const audioContext: AudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    const oscillatorNode = audioContext.createOscillator();
    oscillatorNode.frequency.value = this.frequency;
    oscillatorNode.connect(gainNode);
    const destinationStream = audioContext.createMediaStreamDestination();
    gainNode.connect(destinationStream);
    const currentTime = audioContext.currentTime;
    const startTime = currentTime + 0.1;
    gainNode.gain.linearRampToValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(this.maxGainValue, startTime + this.rampSec);
    gainNode.gain.linearRampToValueAtTime(
      this.maxGainValue,
      startTime + this.rampSec + this.durationSec
    );
    gainNode.gain.linearRampToValueAtTime(0, startTime + this.rampSec * 2 + this.durationSec);
    oscillatorNode.start();
    const audioMixController = new DefaultAudioMixController(this.logger);
    if (new DefaultBrowserBehavior().supportsSetSinkId()) {
      try {
        // @ts-ignore
        await audioMixController.bindAudioDevice({ deviceId: this.sinkId });
      } catch (e) {
        fatal(e);
        this.logger?.error(`Failed to bind audio device: ${e}`);
      }
    }
    try {
      await audioMixController.bindAudioElement(TestSound.testAudioElement);
    } catch (e) {
      fatal(e);
      this.logger?.error(`Failed to bind audio element: ${e}`);
    }
    await audioMixController.bindAudioStream(destinationStream.stream);
    new TimeoutScheduler((this.rampSec * 2 + this.durationSec + 1) * 1000).start(() => {
      audioContext.close();
    });
  }
}

export enum ContentShareType {
  ScreenCapture,
  VideoFile,
}

const SimulcastLayerMapping = {
  [SimulcastLayers.Low]: 'Low',
  [SimulcastLayers.LowAndMedium]: 'Low and Medium',
  [SimulcastLayers.LowAndHigh]: 'Low and High',
  [SimulcastLayers.Medium]: 'Medium',
  [SimulcastLayers.MediumAndHigh]: 'Medium and High',
  [SimulcastLayers.High]: 'High',
};

interface Toggle {
  name: string;
  oncreate: (elem: HTMLElement) => void;
  action: () => void;
}

/* Global Variables */
let trainerFlag = false, memberFlag = false, auditorFlag = false, coachFlag = false, showCoachingFlag = true, recordingFlag = false, bWithoutCoachFlag = false;
let customerId: string = null;
const  ROLE_TRAINER = "1";
const  ROLE_MEMBER = "2";
const  ROLE_AUDITOR = "3";
const  ROLE_BOT = "4";
const  ROLE_COACH = "5";
export class WorkoutApp
  implements AudioVideoObserver, DeviceChangeObserver, ContentShareObserver {
  static readonly DID: string = '+17035550122';
  static readonly BASE_URL: string = [
    location.protocol,
    '//',
    location.host,
    location.pathname.replace(/\/*$/, '/').replace('/member','').replace('/trainer','').replace('/workout',''),
  ].join('');
  // static testVideo: string =
  //   'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.360p.vp9.webm';
  static readonly LOGGER_BATCH_SIZE: number = 85;
  static readonly LOGGER_INTERVAL_MS: number = 2000;
  static readonly MAX_MEETING_HISTORY_MS: number = 5 * 60 * 1000;
  static readonly DATA_MESSAGE_TOPIC: string = 'chat';
  static readonly DATA_MESSAGE_LIFETIME_MS: number = 5000;
  static readonly SIGNAL_MESSAGE_LIFETIME_MS: number = 5000;

  static readonly DATA_MESSAGE_TOPIC_VIDEO_PAUSE: string = "video_pause";
  static readonly DATA_MESSAGE_TOPIC_VIDEO_STATUS: string = "video_status";
  static readonly DATA_MESSAGE_TOPIC_GET_VIDEO_STATUS: string = "get_video_status";
  chimeMeetingId: string = '';
  static readonly DATA_MESSAGE_TOPIC_MUTE_STATUS: string = "muteUnmuteStatus";
  static readonly DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS: string = "oneByOneChatStatus";
  static readonly DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS: string = "memberMusicStatus";
  static readonly DATA_MESSAGE_TOPIC_TRAINER_CAMERA_STATUS: string = "trainerCameraStatus";
  static readonly DATA_MESSAGE_TOPIC_GET_TRAINER_CAMERA_STATUS: string = "get_trainer_camera_status";
  static readonly DATA_MESSAGE_TOPIC_PULSE_DATA: string = "pulse_data";
  static readonly DATA_MESSAGE_TOPIC_JOIN_CUSTOMER: string = "join_customer";
  static readonly DATA_MESSAGE_TOPIC_OUT_ROOM: string = "out_customer";
  
  bShowedMemberList: boolean = false;
  bShowCountDownTimer: boolean = false;
  countdownType: number = 0;
  taskId: string = '';
  scheduledTrainerName: string = '';
  startTime: any = null;
  endTime: any;
  isWorkoutOver: boolean = false;
  // ideally we don't need to change this. Keep this configurable in case users have super slow network.
  loadingBodyPixDependencyTimeoutMs: number = 10000;
  loadingBodyPixDependencyPromise: undefined | Promise<void>;

  showActiveSpeakerScores = false;
  activeSpeakerLayout = true;
  meeting: string | null = null;
  name: string | null = null;
  voiceConnectorId: string | null = null;
  region: string | null = null;
  meetingSession: MeetingSession | null = null;
  audioVideo: AudioVideoFacade | null = null;
  deviceController: DefaultDeviceController | undefined = undefined;
  tileOrganizer: WorkoutTileOrganizer = new WorkoutTileOrganizer();
  canStartLocalVideo: boolean = true;
  defaultBrowserBehaviour: DefaultBrowserBehavior = new DefaultBrowserBehavior();

  // eslint-disable-next-line
  roster: any = {};
  tileIndexToTileId: { [id: number]: number } = {};
  tileIdToTileIndex: { [id: number]: number } = {};
  tileIndexToPauseEventListener: { [id: number]: (event: Event) => void } = {};
  tileArea = document.getElementById('tile-area') as HTMLDivElement;

  trainerTileId: number;
  botTileId: number = -1;
  coachTileId: number;
  bVirtualCoachWorkout: boolean = true;
  isFirstPerson: boolean = false;
  isJoinedFirst: boolean = false;

  cameraDeviceIds: string[] = [];
  microphoneDeviceIds: string[] = [];
  currentAudioInputDevice: AudioInputDevice | undefined;

  buttonStates: { [key: string]: boolean } = {
    'button-microphone': true,
    'button-camera': false,
    'button-speaker': true,
    'button-recorder': true
  };
  recorder: MediaRecorder;

  contentShareType: ContentShareType = ContentShareType.ScreenCapture;

  // feature flags
  enableWebAudio = false;
  enableUnifiedPlanForChromiumBasedBrowsers = true;
  enableSimulcast = false;

  supportsVoiceFocus = false;
  enableVoiceFocus = false;
  voiceFocusIsActive = false;

  markdown = require('markdown-it')({ linkify: true });
  lastMessageSender: string | null = null;
  lastReceivedMessageTimestamp = 0;

  meetingSessionPOSTLogger: POSTLogger;
  meetingEventPOSTLogger: POSTLogger;

  hasChromiumWebRTC: boolean = this.defaultBrowserBehaviour.hasChromiumWebRTC();

  // statsCollector: WebRTCStatsCollector = new WebRTCStatsCollector();
  voiceFocusTransformer: VoiceFocusDeviceTransformer | undefined;
  voiceFocusDevice: VoiceFocusTransformDevice | undefined;

  // This is an extremely minimal reactive programming approach: these elements
  // will be updated when the Amazon Voice Focus display state changes.
  voiceFocusDisplayables: HTMLElement[] = [];
  analyserNode: RemovableAnalyserNode;
  chosenVideoTransformDevice: DefaultVideoTransformDevice;
  // chosenVideoFilter: VideoFilterName = 'None';
  // selectedVideoFilterItem: VideoFilterName = 'None';

  meetingLogger: Logger | undefined = undefined;
  eventReporter: EventReporter | undefined = undefined;
  enableEventReporting = false;

  videoInfoList: any = null;
  videoInfo: any;
  
  customerAge = 0;
  customerProfileAvatar: any;
  customerLocation: any;
  customerBirthday: any

  workoutId = 0;
  classScheduleId: any;
  classNo: string = "";
  customerNo: string = "";
  workoutVersion = 0;
  workoutName = "";
  customerId: any;

  videoVolume = 1;

  role = ROLE_MEMBER;
  level= 'Light';
  
  trainSong: any = document.getElementById('TrainSongID') as HTMLAudioElement;

  isOpenedMessageChatBox = false;
  isSpeakerSoundPaused = false;
  groupId = "0";

  isBWCMutedTrainer = false;
  isBWCMutedMemberMusic = false;
  isMutedMicrophone = false;
  isMutedTrainerMusic = false;
  isMutedSpeaker = false;
  isMutedMemberMusic = false;

  isRecording = false;
  recordingExerciseId: Number = -1;
  allCustomerDetail: any = {};

  static static_api_base_url: any = null;
  api_base_url: any = null;

  bPrivateChating: boolean = false;

  currentCustomerJSON: any = null;
  
  isRuningThreeMinuteLeftTimer = false;
  bAudioMeterPreview: boolean = true;

  chunks: Blob[] = [];

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).app = this;

    fatal = this.fatal.bind(this);

    // Listen for unhandled errors, too.
    window.addEventListener('error', event => {
      // In Safari there's only a message.
      fatal(event.error || event.message);
    });

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      fatal(event.reason);
    };

    if (document.location.search.includes('testfatal=1')) {
      this.fatal(new Error('Testing fatal.'));
      return;
    }
    this.initEventListeners();
    this.setUpVideoTileElementResizer();
    this.initParameters();
  }

  /**
   * We want to make it abundantly clear at development and testing time
   * when an unexpected error occurs.
   * If we're running locally, or we passed a `fatal=1` query parameter, fail hard.
   */
  fatal(e: Error | string): void {
    // Muffle mode: let the `try-catch` do its job.
    if (e && (( e instanceof Error && e.message.indexOf('Error fetching device') >= 0 ) || (e instanceof String && e.indexOf('Error fetching device') >= 0) ) ) {      
      if ( trainerFlag || memberFlag){
        window.localStorage.setItem('WFTR_videoinput', 'None');
        (document.getElementById(
          'failed-meeting'
        ) as HTMLDivElement).innerText = `Permission check`;
        (document.getElementById(
          'failed-meeting-title'
        ) as HTMLDivElement).innerText = `Unable to fetch camera device.`;
        (document.getElementById(
          'failed-meeting-text'
        ) as HTMLDivElement).innerText = `Another program is using your camera, please close other program or reboot computer.`;
        (document.getElementById('failed-meeting-error') as HTMLDivElement).innerText =
          "";
        this.switchToFlow('flow-failed-meeting');
        return;
      }  
    }

    if (!SHOULD_DIE_ON_FATALS) {
      console.info('Ignoring fatal', e);
      return;
    }

    console.error('Fatal error: this was going to be caught, but should not have been thrown.', e);

    if (e && e instanceof Error) {
      document.getElementById('stack').innerText = e.message + '\n' + e.stack?.toString();
    } else {
      document.getElementById('stack').innerText = '' + e;
    }

    this.switchToFlow('flow-fatal');
  }
  
  AccessValueOfQueryString() {
    
    let assoc:any = {};
    
    let queryString = location.search.substring(1);
    let keyValues = queryString.split('&');
    for (let i in keyValues) {
        let n = keyValues[i].indexOf("=");
        let key1 = keyValues[i].substr(n + 1, keyValues[i].length);
        let key2 = keyValues[i].substr(0, n);
        if (key1.length > 0) {
            assoc[this.decode(key2)] = this.decode(key1);
        }
    }
    
    return assoc;
  }
  
  decode (s:string)  {
    return decodeURIComponent(s.replace(/\+/g, "%2B"));
  };

  removeOptions(selectElement:any) {
    let i, L = selectElement.options.length - 1;
    for(i = L; i >= 0; i--) {
       selectElement.remove(i);
    }
  }

  getRandomStr(length:number) {
    let result           = '';
    let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }
 
  initParameters(): void {
      ($('#jsLoadingDiv') as any).show('');
    let that = this;
    let url = window.location.href;
    let arr = url.split("/");
    let result = arr[2];
    if (result == "devstudio.webfitness.com") {
      this.api_base_url = WorkoutApp.static_api_base_url = "https://dev.webfitness.com/";
    }
    else if (result == "studio.webfitness.com") {
      this.api_base_url  = WorkoutApp.static_api_base_url = "https://webfitness.com/";
    } else {
      this.api_base_url  = WorkoutApp.static_api_base_url = "https://webfitness.com/";
    }

    let qs = this.AccessValueOfQueryString();
    this.classScheduleId = qs['ClassScheduleId'];
    let workoutIdNum = qs['WorkoutId'];
    customerId = qs['CustomerId'];
    let roleId = qs['Role'];
    if ( qs['ShowCoaching'] == 'false' )
      showCoachingFlag = false;    
    if (workoutIdNum) {
      this.workoutId = parseInt(workoutIdNum);
    }

    if (roleId) {
      $('body').removeClass('trainerScreen memberScreen auditorScreen');
        trainerFlag = false;
        memberFlag = false;
        auditorFlag = false;
      if (roleId == "1") {
        this.role = ROLE_TRAINER;
        document.title ="Trainer Room";
        $('body').addClass('trainerScreen');
        trainerFlag = true;
        (document.getElementById('button-camera') as HTMLButtonElement).disabled = false;
//        $('#trainerVideo').addClass('flipVideo');
      } else if (roleId == "2" || roleId == "5") {
        if ( roleId == "2" )
          this.role = ROLE_MEMBER;
        else {
          coachFlag = true;
          this.role = ROLE_COACH;
        }
        document.title ="Member Room";
        $('body').addClass('memberScreen');
        $('#messageBtn').addClass('hide');
        memberFlag = true;
      } else if (roleId == "3") {
        this.role = ROLE_AUDITOR;
        document.title ="Auditor Room";
        this.canStartLocalVideo = false;
        $('body').addClass('auditorScreen');
        auditorFlag = true;
      }
        // designStructure(); please uncomment these lines
        // columnPartition();
        // trinerVid();
        // heartBeatCountFont();
    }

    const videoInputQuality_select = document.getElementById('video-input-quality');
    if (memberFlag) {
      this.removeOptions(videoInputQuality_select);
      let option = document.createElement("option");
      option.text = "360p (nHD) @ 15 fps (600 Kbps max)";
      option.value = "360p";
      videoInputQuality_select.appendChild(option);
    }

    if (this.workoutId > 0 && this.classScheduleId != null && customerId != null) {
      new AsyncScheduler().start(async (): Promise<void> => {
        let json = await this.getCustomerDetail(customerId)
        this.customerNo = json.CustomerID;
        this.allCustomerDetail[customerId] = json;
        let jsonMsg = {
          "customerId": customerId,
          "data": json
        };
        this.currentCustomerJSON = jsonMsg;
        if (json != null && json.Status == true) {
          this.meeting = this.classScheduleId;
          this.name = json.Name;
          if ( this.name.length > 30 )
            this.name = this.name.substring(0,30);
          this.customerProfileAvatar = json.ProfileAvatar;
          this.customerLocation = json.Location;
          this.customerBirthday = json.Birthday;
          this.customerAge = json.Age;
          this.region = "us-east-1";
          this.showProgress('progress-authenticate');
          try {
            this.chimeMeetingId = await this.authenticate();
          } catch (error) {
            console.error(error);
            (document.getElementById(
              'failed-meeting'
            ) as HTMLDivElement).innerText = `${this.meeting}`;
            (document.getElementById('failed-meeting-error') as HTMLDivElement).innerText =
              error.message;
            this.switchToFlow('flow-failed-meeting');
            return;
          }
          (document.getElementById('class-meeting-id') as HTMLSpanElement).innerText = `${this.meeting}`;
          (document.getElementById('chime-meeting-id') as HTMLSpanElement).innerText = `${this.chimeMeetingId}`;
          (document.getElementById('info-meeting') as HTMLSpanElement).innerText = this.meeting;
          (document.getElementById('info-name') as HTMLSpanElement).innerText = this.name;

          await this.initVoiceFocus();
          await this.getClassScheduleDetail();
          if ( this.startTime == null ){
            (document.getElementById(
              'failed-meeting'
            ) as HTMLDivElement).innerText = `Invalid Class`;
            (document.getElementById(
              'failed-meeting-title'
            ) as HTMLDivElement).innerText = `Unable to fetch class details.`;
            (document.getElementById(
              'failed-meeting-text'
            ) as HTMLDivElement).innerText = `Cannot fetch valid class details from the server. Please check your class again.`;
            (document.getElementById('failed-meeting-error') as HTMLDivElement).innerText =
              "";
            this.switchToFlow('flow-failed-meeting');    
            return;
          }
          await this.getTrainerVideos();
          if ( this.videoInfoList == null ){
            (document.getElementById(
              'failed-meeting'
            ) as HTMLDivElement).innerText = `Invalid Workout`;
            (document.getElementById(
              'failed-meeting-title'
            ) as HTMLDivElement).innerText = `Unable to fetch workout details.`;
            (document.getElementById(
              'failed-meeting-text'
            ) as HTMLDivElement).innerText = `Cannot fetch valid workout details from the server. Please check your class again.`;
            (document.getElementById('failed-meeting-error') as HTMLDivElement).innerText =
              "";
            this.switchToFlow('flow-failed-meeting');    
            return;
          }

          if ( window.localStorage.getItem("isFirst_") == this.classScheduleId ){
            this.isFirstPerson = true;
            if ( memberFlag && this.bVirtualCoachWorkout ){
              $('.showOnlyInbWithoutCoach').removeClass('hide');
              this.role = ROLE_COACH;
              coachFlag = true;
            }  
          }
          if ( !this.taskId ){
            if ( memberFlag && this.bVirtualCoachWorkout ){
              if ( this.isJoinedFirst ){
                $('.showOnlyInbWithoutCoach').removeClass('hide');
                this.role = ROLE_COACH;
                coachFlag = true;  
                this.isFirstPerson = true;
                window.localStorage.setItem("isFirst_", this.classScheduleId);    
              }
            }
            console.log('start bot');
            if ( trainerFlag ){
              $("#recordingSwitch").prop('checked', recordingFlag);
            }
            this.startBot();
          }
          console.log("isFirstPerson:"+this.isFirstPerson);
          if ( auditorFlag ) {
            try {
              await this.openVideoInputFromSelection(
                (document.getElementById('video-input') as HTMLSelectElement).value,
                true
              );
            } catch (err) {
              fatal(err);
              this.log('no video input device selected');
            }
            await this.openAudioOutputFromSelection();
            this.hideProgress('progress-authenticate');  
            (document.getElementById('joinButton') as HTMLInputElement).click();  
          } else {
            let deviceSettingFlag = await this.setDevices();
            if ( !deviceSettingFlag ) {
              ($('#jsLoadingDiv') as any).hide('');
              this.switchToFlow('flow-devices');
              await this.openAudioInputFromSelectionAndPreview();
              try {
                await this.openVideoInputFromSelection(
                  (document.getElementById('video-input') as HTMLSelectElement).value,
                  true
                );
              } catch (err) {
                fatal(err);
                this.log('no video input device selected');
              }
              await this.openAudioOutputFromSelection();
              this.hideProgress('progress-authenticate');      
            } else {
              (document.getElementById('joinButton') as HTMLInputElement).click();
              this.hideProgress('progress-authenticate');
            }
          }
        } else {
          this.BackToDashboard(false,'customer not found');
        }
      });
    } else
      this.BackToDashboard(false,'invalid url parameters');
    // document.getElementById('settingsButton').addEventListener('click', async function (event) {
    //   $('#flow-devices').appendTo($('#hardwareSetupModal .modal-body'));
    //   $('#hardwareSetupModal #flow-devices').removeClass('flow').removeAttr('style');
    //   $('#joinButton').addClass('hide');
    //   ($('#hardwareSetupModal') as any).modal('show');
    //   that.bAudioMeterPreview = true;
    //   that.startAudioPreview();
    //   that.audioVideo.startVideoPreviewForVideoInput(
    //     document.getElementById('video-preview') as HTMLVideoElement
    //   );
    // });

    document.getElementById('bwc_muteTrainerMicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedTrainer = true;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_unMuteTrainerMicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedTrainer = false;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_DecreaseTrainerMicVolume').addEventListener('click', async function (event) {
      const volumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 0 || parseFloat(volumeBar.value) == 0.0){
        that.isBWCMutedTrainer = true;
        that.setBWCMixedAudio(null,null);
      } else {
        if(that.isBWCMutedTrainer == true){
          that.isBWCMutedTrainer = false;
        }
        that.setBWCMixedAudio((parseFloat(volumeBar.value) - 0.05),null);
      }
    }, false);
    document.getElementById('bwc_IncreaseTrainerMicVolume').addEventListener('click', async function (event) {
      const volumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 1 || parseFloat(volumeBar.value) == 1.0){
        that.isBWCMutedTrainer = false;
        that.setBWCMixedAudio(1,null);
      } else {
        if(that.isBWCMutedTrainer == true){
          that.isBWCMutedTrainer = false;
        }
        that.setBWCMixedAudio((parseFloat(volumeBar.value) + 0.05), null);
      }
    }, false);

    document.getElementById('bwc_muteMemberMusicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedMemberMusic = true;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_unMuteMemberMusicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedMemberMusic = false;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_muteTrainerMicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedTrainer = true;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_unMuteTrainerMicVolume').addEventListener('click', async function (event) {
      that.isBWCMutedTrainer = false;
      that.setBWCMixedAudio(null,null);
    }, false);

    document.getElementById('bwc_DecreaseMemberMusicVolume').addEventListener('click', async function (event) {
      const volumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 0 || parseFloat(volumeBar.value) == 0.0){
        that.isBWCMutedMemberMusic = true;
        that.setBWCMixedAudio(null,null);
      } else {
        if(that.isBWCMutedMemberMusic == true){
          that.isBWCMutedMemberMusic = false;
        }
        that.setBWCMixedAudio(null,(parseFloat(volumeBar.value) - 0.05));
      }
    }, false);
    document.getElementById('bwc_IncreaseMemberMusicVolume').addEventListener('click', async function (event) {
      const volumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 1 || parseFloat(volumeBar.value) == 1.0){
        that.isBWCMutedMemberMusic = false;
        that.setBWCMixedAudio(null,1);
      } else {
        if(that.isBWCMutedMemberMusic == true){
          that.isBWCMutedMemberMusic = false;
        }
        that.setBWCMixedAudio(null, (parseFloat(volumeBar.value) + 0.05));
      }
    }, false);

    document.getElementById('bwc_trainerMicVolumeBar').addEventListener('change', async function (event) {
      let thatVolumeBar: any = this;
      if(parseFloat(thatVolumeBar.value) == 0 || parseFloat(thatVolumeBar.value) == 0.0){
        that.isBWCMutedTrainer = true;
      } else {
        that.isBWCMutedTrainer = false;
      }
      that.setBWCMixedAudio(parseFloat(thatVolumeBar.value),null);
    }, false);

    document.getElementById('bwc_memberMusicVolumeBar').addEventListener('change', async function (event) {
      let thatVolumeBar: any = this;
      if(parseFloat(thatVolumeBar.value) == 0 || parseFloat(thatVolumeBar.value) == 0.0){
        that.isBWCMutedMemberMusic = true;
      } else {
        that.isBWCMutedMemberMusic = false;
      }
      that.setBWCMixedAudio(null,parseFloat(thatVolumeBar.value));
    }, false);

    document.getElementById('muteTrainerMic').addEventListener('click', async function (event) {
      that.isMutedMicrophone = true;
      that.muteAndUnmuteMicrophone(null, true);
    }, false);

    document.getElementById('muteMemberMusicVolume').addEventListener('click', function (event) {
      that.isMutedMemberMusic = true;
      that.muteAndUnmuteMemberMusicVolume();
    }, false);

    document.getElementById('unMuteTrainerMic').addEventListener('click', async function (event) {
      that.isMutedMicrophone = false;
      that.muteAndUnmuteMicrophone(null, true);
    }, false);

    document.getElementById('unMuteMemberMusicVolume').addEventListener('click', function (event) {
      that.isMutedMemberMusic = false;
      that.muteAndUnmuteMemberMusicVolume();
    }, false);

    document.getElementById('trainerMicBar').addEventListener('change', async function (event) {
      let thatVolumeBar: any = this;
      if(parseFloat(thatVolumeBar.value) == 0 || parseFloat(thatVolumeBar.value) == 0.0){
        that.isMutedMicrophone = true;
      } else {
        that.isMutedMicrophone = false;
      }
      that.muteAndUnmuteMicrophone(parseFloat(thatVolumeBar.value));
    }, false);

    document.getElementById('memberMusicVolumeBar').addEventListener('change', function (event) {
      let thatVolumeBar: any = this;
      if(parseFloat(thatVolumeBar.value) == 0 || parseFloat(thatVolumeBar.value) == 0.0){
        that.isMutedMemberMusic = true;
      } else {
        that.isMutedMemberMusic = false;
      }
      that.muteAndUnmuteMemberMusicVolume(parseFloat(thatVolumeBar.value));
    }, false);

    document.getElementById('DecreaseTrainerMic').addEventListener('click', function (event) {
      const volumeBar = document.getElementById('trainerMicBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 0 || parseFloat(volumeBar.value) == 0.0){
        that.isMutedMicrophone = true;
        that.muteAndUnmuteMicrophone(0);
      } else {
        if(that.isMutedMicrophone == true){
          that.isMutedMicrophone = false;
        }
        that.muteAndUnmuteMicrophone((parseFloat(volumeBar.value) - 0.05));
      }
    }, false);

    document.getElementById('IncreaseTrainerMic').addEventListener('click', function (event) {
      const volumeBar = document.getElementById('trainerMicBar') as HTMLInputElement;
      if(parseFloat(volumeBar.value) == 1 || parseFloat(volumeBar.value) == 1.0){
        that.muteAndUnmuteMicrophone(1);
      } else {
        if(that.isMutedMicrophone == true){
          that.isMutedMicrophone = false;
        }
        that.muteAndUnmuteMicrophone((parseFloat(volumeBar.value) + 0.05));
      }
    }, false);

    document.getElementById('DecreaseMemberMusicVolume').addEventListener('click', function (event) {
      let volume = (document.getElementById('memberMusicVolumeBar') as HTMLInputElement);
      if(parseFloat(volume.value) == 0 || parseFloat(volume.value) == 0.0){
        that.isMutedMemberMusic = true;
        that.muteAndUnmuteMemberMusicVolume(0);
      } else {
        if(that.isMutedMemberMusic == true){
          that.isMutedMemberMusic = false;
        }
        that.muteAndUnmuteMemberMusicVolume((parseFloat(volume.value) - 0.05));
      }
    }, false);
    document.getElementById('IncreaseMemberMusicVolume').addEventListener('click', function (event) {
      let volume = (document.getElementById('memberMusicVolumeBar') as HTMLInputElement);
      if(parseFloat(volume.value) == 1 || parseFloat(volume.value) == 1.0){
        that.muteAndUnmuteMemberMusicVolume(1);
      } else {
        if(that.isMutedMemberMusic == true){
          that.isMutedMemberMusic = false;
        }
        that.muteAndUnmuteMemberMusicVolume((parseFloat(volume.value) + 0.05));
      }
    }, false);
  }

  async getCustomerDetail(customerId: any): Promise<any> {
    try {
      const response = await fetch(
        this.api_base_url + `Home/GetCustomerDetails?CustomerId=${encodeURIComponent(customerId)}`,
        {
          method: 'POST',
          mode: 'cors'
        }
      );
      const json = await response.json();
      if (json.Status == true) {
        return (json)
      }
    } catch (error) {
      return (null)
    }
  }

  async getCustomerPulse(customerId: any): Promise<any> {
    try {
      const response = await fetch(
        this.api_base_url + `Home/GetCustomerPulse?CustomerId=${encodeURIComponent(customerId)}`,
        {
          method: 'POST',
          mode: 'cors'
        }
      );
      const json = await response.json();
      if (json.Status == true) {
        return (json)
      }
    } catch (error) {
      return (null)
    }
  }

  setVideoAndTrainerMicVolume(selfvolumebarVolume: number) {
    console.log('self volume:' + selfvolumebarVolume);
    const audioElement = document.getElementById(`meeting-audio`) as HTMLAudioElement;
    if (memberFlag) {
    } else {
      audioElement.volume = Number((this.videoVolume * selfvolumebarVolume).toFixed(2));
    }
  }

  async getTrainerVideos(): Promise<void> {
    try {
      const response = await fetch(
        this.api_base_url +`Home/GetDynamicWorkoutDetail?WorkoutId=${this.workoutId}&ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`,
        {
          method: 'POST',
          mode: 'cors'
        }
      );
      const json = await response.json();
      console.log('workoutdetail:'+JSON.stringify(json));
      if (json.Status == "Success") {
        this.videoInfoList = json;
        this.workoutVersion = this.videoInfoList.Version;
        (document.getElementById('workout-name') as HTMLSpanElement).innerText = this.videoInfoList.Name;
        document.getElementById('workout-version').innerText = this.workoutVersion.toString();
        document.getElementById('duration').innerText = parseInt(this.videoInfoList.Duration).toString()+" mins";

        document.getElementById('equipment-required').innerText = this.videoInfoList.RequiredEquipments.join(', ');
        document.getElementById('equipment-recommended').innerText = this.videoInfoList.RecommendedEquipments.join(', ');
        document.getElementById('equipment-optional').innerText = this.videoInfoList.OptionalEquipments.join(', ');
        let difficultyLevelText: string[] = ['1(Light)','2(Intermediate)','3(Advanced)','4(Extreme)'];
        let difficultyLevelClass: string[] = ['icon-light-level','icon-intermediate-level','icon-advanced-level','icon-extreme-level'];
        if ( Number(this.videoInfoList.DifficultyLevel)-1 >= 0 && Number(this.videoInfoList.DifficultyLevel)-1 <= 3 )
        document.getElementById('difficulty-level').innerHTML = '<i class="fa fa-2x wf '+difficultyLevelClass[Number(this.videoInfoList.DifficultyLevel)-1]+' mr5"></i><span>'+difficultyLevelText[Number(this.videoInfoList.DifficultyLevel)-1]+'</span>';

        let bodyAreaText: string[] = ['Upper','Lower','Full','Core','Cardio','Flexibility'];
        let bodyAreaClass: string[] = ['icon-UpperBody','icon-LowerBody','icon-FullBody','icon-core','icon-Cardio','icon-Flexibility'];
        if ( Number(this.videoInfoList.BodyArea)-1 >= 0 && Number(this.videoInfoList.BodyArea)-1 <= 5 )
          document.getElementById('body-area').innerHTML = '<i class="fa fa-2x wf '+bodyAreaClass[Number(this.videoInfoList.BodyArea)-1]+' mr5"></i><span>'+bodyAreaText[Number(this.videoInfoList.BodyArea)-1]+'</span>';

        let impactText: string[] = ['None','Low','Medium','High'];
        if ( Number(this.videoInfoList.Impact) >= 0 && Number(this.videoInfoList.Impact) <= 3 )
          document.getElementById('impact').innerText = impactText[Number(this.videoInfoList.Impact)];

        document.getElementById('note-admin').innerText = this.videoInfoList.AdminNote;
        document.getElementById('note-trainer').innerText = this.videoInfoList.TrainerNote;
        document.getElementById('note-member').innerText = this.videoInfoList.MemberNote;
        document.getElementById('txtWorkoutNote').innerText = this.videoInfoList.MemberNote;

        (document.getElementById('meeting-id') as HTMLSpanElement).innerText = `${this.videoInfoList.Name}`;
        for (let i = 0; i < this.videoInfoList.Data.length; i++) {
          let trClass = "";
          if (this.videoInfoList.Data[i].ControlName == 'Welcome') {
            trClass = "lightGoldBG";
          } else if (this.videoInfoList.Data[i].ControlName == 'Water') {
            trClass = "lightBlueBG";
          } else if (this.videoInfoList.Data[i].ControlName == 'Go Time') {
            trClass = "lightLimeBG";
          } else if (this.videoInfoList.Data[i].ControlName == 'Rest') {
            trClass = "lightGreenBG";
          } else if (this.videoInfoList.Data[i].ControlName == 'Congratulations') {
            trClass = "lightYellowBG";
          }
          let exerciseIconStr = '';
          if(this.videoInfoList.Data[i].RequiredEquipments != null || this.videoInfoList.Data[i].RequiredEquipments != ''){
            let exeIconStr = this.videoInfoList.Data[i].RequiredEquipments;
            if(exeIconStr != ''){
                if(exeIconStr.includes(',') == true){
                    let exeIconArr = exeIconStr.split(',');
                    for(let i1 = 0; i1 < exeIconArr.length; i1++){
                        let exeIcon = $.trim(exeIconArr[i1]).toLowerCase();
                        exeIcon = exeIcon == "bands" ? "band2" : exeIcon == "dumbbells" ? "dumbbells2" : exeIcon == "cords" ? "cord" : exeIcon;
                        exerciseIconStr += '<i class="wf icon-'+exeIcon+' fa-lg mr5"></i>';
                    }
                }
                else{
                    let exeIcon = $.trim(exeIconStr).toLowerCase();
                    exeIcon = exeIcon == "bands" ? "band2" : exeIcon == "dumbbells" ? "dumbbells2" : exeIcon == "cords" ? "cord" : exeIcon;
                    exerciseIconStr += '<i class="wf icon-'+exeIcon+' fa-lg mr5"></i>';
                }
            }
          }
          let newRowContent = '<tr id="exerciseList_tr_'+i+'" style="cursor:pointer" class="tr_exercise '+trClass+'"><td class="dflxDiv flxWrap">' + (this.videoInfoList.Data[i].ControlName != null ? ( this.videoInfoList.Data[i].ControlName != 'Custom Text & Image' ? this.videoInfoList.Data[i].ControlName : this.videoInfoList.Data[i].CustomName ): '<p class="nomar">'+exerciseIconStr + this.videoInfoList.Data[i].ExerciseName+'</p>') + '</td> <td class="w60 jsDuration">'+ this.videoInfoList.Data[i].Duration+'</td></tr>';
          $("#exerciseList tbody").append(newRowContent);
        }      
      }
    } catch (error) {
      console.error(error.message);
      return;
    }
  }

  switchPlay(itemIndex: any){
    let jsonMsg = {
      "id": "Play",
      "videoIndex": itemIndex
    };
    this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
  }

  async initVoiceFocus(): Promise<void> {
    const logger = new ConsoleLogger('SDK', LogLevel.DEBUG);
    if (!this.enableWebAudio) {
      logger.info('[WorkoutApp] Web Audio not enabled. Not checking for Amazon Voice Focus support.');
      return;
    }

    try {
      this.supportsVoiceFocus = await VoiceFocusDeviceTransformer.isSupported(VOICE_FOCUS_SPEC, {
        logger,
      });
      if (this.supportsVoiceFocus) {
        this.voiceFocusTransformer = await this.getVoiceFocusDeviceTransformer();
        this.supportsVoiceFocus =
          this.voiceFocusTransformer && this.voiceFocusTransformer.isSupported();
        if (this.supportsVoiceFocus) {
          logger.info('[WorkoutApp] Amazon Voice Focus is supported.');
          document.getElementById('voice-focus-setting').classList.remove('hidden');
          await this.populateAllDeviceLists();
          return;
        }
      }
    } catch (e) {
      // Fall through.
      logger.warn(`[WorkoutApp] Does not support Amazon Voice Focus: ${e.message}`);
    }
    logger.warn('[WorkoutApp] Does not support Amazon Voice Focus.');
    this.supportsVoiceFocus = false;
    document.getElementById('voice-focus-setting').classList.toggle('hidden', true);
    await this.populateAllDeviceLists();
  }

  private async onVoiceFocusSettingChanged(): Promise<void> {
    this.log('[WorkoutApp] Amazon Voice Focus setting toggled to', this.enableVoiceFocus);
    this.openAudioInputFromSelectionAndPreview();
  }

  setDefaultSetting(isFirstLoad: boolean) {
    if ( memberFlag && isFirstLoad ) {
      let recordingOnOff = window.localStorage.getItem("WFTR_recordingOnOff");
      if ( recordingOnOff == 'off'){
        this.toggleButton('button-recorder','off');
      } else {
        this.toggleButton('button-recorder','on');
      }
    }
    if (trainerFlag) {
      const trainerMicBarMusic = window.localStorage.getItem("trainerMicBar");
      if (trainerMicBarMusic != null && trainerMicBarMusic != "" && trainerMicBarMusic != undefined) {
        const trainerMicBarMusicJson = JSON.parse(trainerMicBarMusic);
        if (trainerMicBarMusicJson.isMutedMicrophone == true) {
          this.isMutedMicrophone = true;
          this.toggleButton('button-microphone');
          this.muteAndUnmuteMicrophone(null, true);
        } else {
          if (parseFloat(trainerMicBarMusicJson.volume) == 0 || parseFloat(trainerMicBarMusicJson.volume) == 0.0) {
            this.isMutedMicrophone = true;
            this.toggleButton('button-microphone');
            this.muteAndUnmuteMicrophone(null, true);
          } else {
            this.muteAndUnmuteMicrophone(parseFloat(trainerMicBarMusicJson.volume));
          }
        }
      } else {
        this.muteAndUnmuteMicrophone(1);
      }
    }
    
    if (memberFlag) {
      if (isFirstLoad == true) {
        const membeMicrophoneMuteObj = window.localStorage.getItem("memberMicrophoneMute_" + customerId);
        if (membeMicrophoneMuteObj != null && membeMicrophoneMuteObj != "" && membeMicrophoneMuteObj != undefined) {
          const membeMicrophoneMute = JSON.parse(membeMicrophoneMuteObj);
          if (membeMicrophoneMute.isMutedMicrophone == true) {
            if (this.toggleButton('button-microphone', (this.isMutedMicrophone == true ? "on" : "off"))) {
              this.isMutedMicrophone = false;
            } else {
              this.isMutedMicrophone = true;
            }
            this.muteAndUnmuteMicrophone();
          }
        }
        if ( this.isFirstPerson ){
          if ( showCoachingFlag == false ){
            this.isBWCMutedTrainer = true;            
            this.setBWCMixedAudio(0,0.5);
          }
          else
            this.setBWCMixedAudio(1,0.5);
        }
      }

      const memberSpeakerMuteObj = window.localStorage.getItem("memberSpeakerMute_" + customerId);
      if (memberSpeakerMuteObj != null && memberSpeakerMuteObj != "" && memberSpeakerMuteObj != undefined) {
        const memberSpeakerMute = JSON.parse(memberSpeakerMuteObj);
        if(memberSpeakerMute.isMutedSpeaker == true) {
          this.isMutedSpeaker = true;
          this.muteSpeaker();
        } else {
          let jsonStroage = {
            "isMutedSpeaker": this.isMutedSpeaker,
          };
          window.localStorage.setItem("memberSpeakerMute_"+customerId, JSON.stringify(jsonStroage));
        }
      }
    }
  }
  initEventListeners(): void {
    if (!this.defaultBrowserBehaviour.hasChromiumWebRTC()) {
      // (document.getElementById('simulcast') as HTMLInputElement).disabled = true;
      // (document.getElementById('planB') as HTMLInputElement).disabled = true;
    }
    document.getElementById('form-failed-meeting').addEventListener('submit', e => {
      e.preventDefault();
      this.BackToDashboard(false,'failed meeting');
    });

    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    audioInput.addEventListener('change', async (_ev: Event) => {
      this.log('audio input device is changed');
      await this.openAudioInputFromSelectionAndPreview();
    });

    const videoInput = document.getElementById('video-input') as HTMLSelectElement;
    videoInput.addEventListener('change', async (_ev: Event) => {
      this.log('video input device is changed');
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (e) {
        this.checkVideoInputError(e);
        this.log('no video input device selected');
      }
    });

    const videoInputQuality = document.getElementById('video-input-quality') as HTMLSelectElement;
    videoInputQuality.addEventListener('change', async (_ev: Event) => {
      this.log('Video input quality is changed');
      let videoInputQualityTosave = '360p';
      switch (videoInputQuality.value) {
        case '360p':
          this.audioVideo.chooseVideoInputQuality(640, 360, 15);
          this.audioVideo.setVideoMaxBandwidthKbps(600);
          videoInputQualityTosave = '360p';
          break;
        case '540p':
          this.audioVideo.chooseVideoInputQuality(960, 540, 15);
          this.audioVideo.setVideoMaxBandwidthKbps(1400);
          videoInputQualityTosave = '540p';
          break;
        case '720p':
          this.audioVideo.chooseVideoInputQuality(1280, 720, 15);
          this.audioVideo.setVideoMaxBandwidthKbps(1400);
          videoInputQualityTosave = '720p';
          break;
      }
      window.localStorage.setItem('WFTR_videoinputquality', videoInputQualityTosave);
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (err) {
        this.checkVideoInputError(err);
        this.log('no video input device selected');
      }
    });

    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    audioOutput.addEventListener('change', async (_ev: Event) => {
      this.log('audio output device is changed');
      await this.openAudioOutputFromSelection();
    });

    document.getElementById('button-test-sound').addEventListener('click', async e => {
      e.preventDefault();
      const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
      const testSound = new TestSound(this.meetingEventPOSTLogger, audioOutput.value);
      await testSound.init();
    });

    document.getElementById('form-devices').addEventListener('submit', e => {
      e.preventDefault();
      new AsyncScheduler().start(async () => {
        try {
          this.showProgress('progress-join');
          let res:boolean = await this.openVideoInputFromSelection(videoInput.value, false);
          if ( res == false ){
            
          }
          await this.openAudioInputFromSelectionAndPreview();
          await this.stopAudioPreview();
          this.stopVideoPreview();
          ($('#jsLoadingDiv') as any).show('');
          await this.join();
          this.audioVideo.startVideoInput(null);
          this.displayButtonStates();
          if (auditorFlag) {
            this.audioVideo.stopLocalVideoTile();
            this.hideTile(16);
          } else if (this.toggleButton('button-camera') && this.canStartLocalVideo) {
            try {
              this.setVideoInputQuality();
              let camera: string = videoInput.value;
              if (videoInput.value === 'None') {
                camera = this.cameraDeviceIds.length ? this.cameraDeviceIds[0] : 'None';
              }
              console.log('selected camera:'+camera);
              await this.openVideoInputFromSelection(camera, false);
              this.audioVideo.startLocalVideoTile();

              this.setDefaultSetting(true);
            } catch (err) {
              fatal(err);
              this.log('no video input device selected');
            }
          } else {
            this.audioVideo.stopLocalVideoTile();
            if ( this.role != ROLE_TRAINER )
              this.hideTile(16);
          }
          new TimeoutScheduler(5000).start(()=>{
            this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_GET_VIDEO_STATUS, "Join",WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
            if ( !trainerFlag )
              this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_GET_TRAINER_CAMERA_STATUS, "Join",WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
            if (this.currentCustomerJSON != null)
              this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_JOIN_CUSTOMER, JSON.stringify(this.currentCustomerJSON),WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
          });
          this.switchToFlow('flow-meeting');
          if ( !trainerFlag ){
            bubblePopshowHide();
            ($('#jsLoadingDiv') as any).hide('');
            if($('#txtWorkoutNote').is(':visible'))
              ($('.jsWaitLoadingParent') as any).show('');  
          }
          if($('#flow-meeting').is(':visible')){
            columnPartition();
          }
          this.hideProgress('progress-join');
        } catch (e) {
          if ( e && (( e instanceof Error && e.message.indexOf('no video input') >= 0 ) || (e instanceof String && e.indexOf('no video input') >= 0) ) ) {
          } else {
            document.getElementById('failed-join').innerText = `Meeting ID: ${this.meeting}`;
            document.getElementById('failed-join-error').innerText = `Error: ${e.message}`;
            this.switchToFlow('flow-failed-join');
          }
        }
        ($('#waitingModal') as any).modal('hide');
      });
    });

    (document.getElementById('add-voice-focus') as HTMLInputElement).addEventListener(
      'change',
      e => {
        this.enableVoiceFocus = (e.target as HTMLInputElement).checked;
        this.onVoiceFocusSettingChanged();
      }
    );

    const buttonMute = document.getElementById('button-microphone');
    buttonMute.addEventListener('mousedown', _e => {
      if ( auditorFlag )
        return;
      if (this.toggleButton('button-microphone')) {
          this.isMutedMicrophone = false;
          this.muteAndUnmuteMicrophone(null, true);  
      } else {
          this.isMutedMicrophone = true;
          this.muteAndUnmuteMicrophone(null, true);  
      }
    });

    const buttonVideo = document.getElementById('button-camera');
    buttonVideo.addEventListener('click', _e => {
      if ( !trainerFlag )
        return;
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-camera') && this.canStartLocalVideo) {
          try {
            let camera: string = videoInput.value;
            if (videoInput.value === 'None') {
              camera = this.cameraDeviceIds.length ? this.cameraDeviceIds[0] : 'None';
            }
            console.log('selected camera:'+camera);
            await this.openVideoInputFromSelection(camera, false);
            this.audioVideo.startLocalVideoTile();
          } catch (err) {
            fatal(err);
            this.log('no video input device selected');
          }
        } else {
          this.audioVideo.stopLocalVideoTile();
          if ( this.role != ROLE_TRAINER )
            this.hideTile(16);
        }
      });
    });

    const buttonPauseContentShare = document.getElementById('button-pause-content-share');
    buttonPauseContentShare.addEventListener('click', _e => {
      if (!this.isButtonOn('button-content-share')) {
        return;
      }
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-pause-content-share')) {
          this.audioVideo.pauseContentShare();
          if (this.contentShareType === ContentShareType.VideoFile) {
            const videoFile = document.getElementById('content-share-video') as HTMLVideoElement;
            videoFile.pause();
          }
        } else {
          this.audioVideo.unpauseContentShare();
          if (this.contentShareType === ContentShareType.VideoFile) {
            const videoFile = document.getElementById('content-share-video') as HTMLVideoElement;
            await videoFile.play();
          }
        }
      });
    });

    const buttonContentShare = document.getElementById('button-content-share');
    buttonContentShare.addEventListener('click', _e => {
      new AsyncScheduler().start(() => {
        if (!this.isButtonOn('button-content-share')) {
          this.contentShareStart();
        } else {
          this.contentShareStop();
        }
      });
    });

    const messagePopupBtn = document.getElementById('messageBtn');
    messagePopupBtn.addEventListener('click', _e => {
      if (this.isOpenedMessageChatBox != true) {
        this.isOpenedMessageChatBox = true;
      }
    });
  
    const closeMessagePopupBtn = document.getElementById('closeMessageChatBtn');
    closeMessagePopupBtn.addEventListener('click', _e => {
      if (this.isOpenedMessageChatBox == true) {
        this.isOpenedMessageChatBox = false;
      }
    });

    const buttonSpeaker = document.getElementById('button-speaker');
    buttonSpeaker.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        const speakerBtnElement = document.getElementById(`button-speaker`) as HTMLButtonElement;
        const speakerBtnDropElement = document.getElementById(`button-speaker-drop`) as HTMLButtonElement;
        this.isMutedSpeaker = !this.isMutedSpeaker;
        if (this.isMutedSpeaker == true) {
          this.audioVideo.unbindAudioElement();
          speakerBtnElement.classList.remove("active");
          speakerBtnDropElement.classList.remove("active");
          speakerBtnElement.classList.add("btn-outline-secondary");
          speakerBtnDropElement.classList.add("btn-outline-secondary");
        } else {
          this.audioVideo.bindAudioElement(document.getElementById(
            'meeting-audio'
          ) as HTMLAudioElement);
          speakerBtnElement.classList.remove("btn-outline-secondary");
          speakerBtnDropElement.classList.remove("btn-outline-secondary");
          speakerBtnElement.classList.add("active");
          speakerBtnDropElement.classList.add("active");
        }
  
        let jsonStroage = {
          "isMutedSpeaker": this.isMutedSpeaker,
        };
        window.localStorage.setItem("memberSpeakerMute_" + customerId, JSON.stringify(jsonStroage));
      });
    });

    const buttonRecorder = document.getElementById('button-recorder') as HTMLButtonElement;
    buttonRecorder.addEventListener('click', _e => {
      buttonRecorder.disabled = true;
      AsyncScheduler.nextTick(async () => {
        this.toggleButton('button-recorder');
        if (this.isButtonOn('button-recorder')) {
          window.localStorage.setItem('WFTR_recordingOnOff', 'on');
          console.info('Stopping recorder ', this.recorder);
          buttonRecorder.disabled = false;
          this.endRecording();
          return;
        } else {
          window.localStorage.setItem('WFTR_recordingOnOff', 'off');
        }
        buttonRecorder.classList.remove("active");
        buttonRecorder.classList.add("btn-outline-secondary");  
        buttonRecorder.disabled = false;
      });
    });

    const pauseButtonElement = document.getElementById(`autopausevideo`) as HTMLButtonElement;
    pauseButtonElement.addEventListener('click', async () => {
      const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
      if (videoElement.paused == false)
        await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE, "Pause", WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
    });
  
    const playButtonElement = document.getElementById(`autoplayvideo`) as HTMLButtonElement;
    playButtonElement.addEventListener('click', async () => {
      const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
      if (videoElement.paused == true)
        await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE, "Play", WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
    });

    const sendMessage = (): void => {
      new AsyncScheduler().start(() => {
        const textArea = document.getElementById('send-message') as HTMLTextAreaElement;
        const textToSend = textArea.value.trim();
        if (!textToSend) {
          return;
        }
        textArea.value = '';
        this.audioVideo.realtimeSendDataMessage(
          WorkoutApp.DATA_MESSAGE_TOPIC,
          textToSend,
          WorkoutApp.DATA_MESSAGE_LIFETIME_MS
        );
        // echo the message to the handler
        this.dataMessageHandler(
          new DataMessage(
            Date.now(),
            WorkoutApp.DATA_MESSAGE_TOPIC,
            new TextEncoder().encode(textToSend),
            this.meetingSession.configuration.credentials.attendeeId,
            this.meetingSession.configuration.credentials.externalUserId
          )
        );
      });
    };

    const textAreaSendMessage = document.getElementById('send-message') as HTMLTextAreaElement;
    textAreaSendMessage.addEventListener('keydown', e => {
      if (e.keyCode === 13) {
        if (e.shiftKey) {
          textAreaSendMessage.rows++;
        } else {
          e.preventDefault();
          sendMessage();
          textAreaSendMessage.rows = 1;
        }
      }
    });

    // Send Custom Predefined Messages
    const sendRegFixedMessages = document.getElementsByClassName('jsSendBtn');
    var sendRegClassCount = function() {
      var elVal = this.getAttribute('data-val');
      textAreaSendMessage.value = elVal;
      sendMessage();
    };
    for(var i = 0; i < sendRegFixedMessages.length; i++){
      sendRegFixedMessages[i].addEventListener('click', sendRegClassCount, false);
    }
    
    const buttonBreakoutRoomEnd = document.getElementById('button-breakout-room-end');
    buttonBreakoutRoomEnd.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if ( trainerFlag ){
          let jsonMsg = {
            "status": false
          };
          document.getElementById('button-breakout-room-end').classList.add("hide");
          ($('#waitingModal') as any).modal('show');
          this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS, JSON.stringify(jsonMsg));
          await this.endMeeting();
          this.joinRoom(this.classScheduleId);
        }
      });
    });

    const buttonMeetingLeave = document.getElementById('button-meeting-leave');
    buttonMeetingLeave.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if ( trainerFlag || coachFlag ){
          if ( this.isWorkoutOver == true ){
            this.endMeeting();
            await this.stopBot(); 
          }
        }
        this.BackToDashboard(false,'user exit');
      });
    });

    const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;

    videoElement.addEventListener('play', () => {
      console.log('videoElement started');
    });
    videoElement.addEventListener('paused', () => {
      console.log('trainsong paused');
    });
  }

  endRecording(){
    if ( !this.isRecording )
      return;
    this.isRecording = false;
    this.recorder.stop();
    this.recorder = undefined;
  }

  startRecording() {
    AsyncScheduler.nextTick(async () => {
      console.log('recording started:'+this.videoInfo.ExerciseId);
        // Combine the audio and video streams.
        const mixed = new MediaStream();

        const localTile = this.audioVideo.getLocalVideoTile();
        if (localTile) {
          mixed.addTrack(localTile.state().boundVideoStream.getVideoTracks()[0]);
        }

        // We need to get access to the media stream broker, which requires knowing
        // the exact implementation. Sorry!
        /* @ts-ignore */
        const av: DefaultAudioVideoController = this.audioVideo.audioVideoController;
        const input = await av.mediaStreamBroker.acquireAudioInputStream();
        mixed.addTrack(input.getAudioTracks()[0]);

        this.recorder = new MediaRecorder(mixed, { mimeType: 'video/webm; codecs=vp9' });
        console.info('Setting recorder to', this.recorder);
        this.recorder.ondataavailable = (event) => {
          if (event.data.size) {
            this.chunks.push(event.data);
          }
        };

        this.recorder.onstop = () => {
          console.log('recording stopped');
          const blob = new Blob(this.chunks, {
            type: 'video/webm',
          });
          // const url = URL.createObjectURL(blob);
          // const a = document.createElement('a');
          // document.body.appendChild(a);
          // /* @ts-ignore */
          // a.style = 'display: none';
          // a.href = url;
          // a.download = this.recordingExerciseId+'_recording.webm';
          // a.click();
          // window.URL.revokeObjectURL(url);

          if ( this.chunks.length == 0 )
            return;
          this.chunks.length = 0;
          let percentage:number = undefined
          let arr = window.location.href.split("/");
          let s3ApiBaseUrl = "http://127.0.0.1:8080/"
          if ( arr[2] != "127.0.0.1:8080" ){
            s3ApiBaseUrl = "https://"+arr[2]+"/";
          }
          console.log("s3ApiBaseUrl:"+s3ApiBaseUrl);
          const videoUploaderOptions = {
              customerId: this.customerNo,
              classId: this.classNo,
              exerciseId: this.recordingExerciseId,
              baseUrl: s3ApiBaseUrl,
              adminBaseUrl: this.api_base_url,
              file: blob,
            };
            const uploader = new S3Uploader(videoUploaderOptions)
            uploader
              .onProgress((newPercentage: any) => {
                // to avoid the same percentage to be logged twice
                console.log(newPercentage);
                if (newPercentage.percentage !== percentage) {
                  percentage = newPercentage.percentage
                  console.log(`${percentage}%`)
                }
              })
              .onError((error:any) => {
                console.error(error)
              })
      
            uploader.start()    
        };

        this.recorder.start();
        this.isRecording = true;
        this.recordingExerciseId = this.videoInfo.ExerciseId;    
      });
  }
  checkVideoInputError( e: any ){
    if (e && (( e instanceof Error && e.message.indexOf('Error fetching device') >= 0 ) || (e instanceof String && e.indexOf('Error fetching device') >= 0) ) ) {
      ($ as any).confirm({
          title: 'Permission Error',
          content: 'Cannot switch to camera because the camera is already in use by another application.',
          icon: 'fa fa-success',
          type: 'green',
          closeIcon: true,
          buttons: {
            OK: {
                text: 'OK',
                btnClass: 'btn-green',
                action: function () {       
                }
            }
          }
      });  
    } else
      fatal(e);
  }

  setVideoInputQuality() {
    const videoInputQuality = document.getElementById('video-input-quality') as HTMLSelectElement;
    let videoInputQualityTosave = videoInputQuality.value;
    this.log(`Video input quality is set ${videoInputQualityTosave}`);
    switch (videoInputQuality.value) {
      case '360p':
        this.audioVideo.chooseVideoInputQuality(640, 360, 15);
        this.audioVideo.setVideoMaxBandwidthKbps(600);
        videoInputQualityTosave = '360p';
        break;
      case '540p':
        this.audioVideo.chooseVideoInputQuality(960, 540, 15);
        this.audioVideo.setVideoMaxBandwidthKbps(1400);
        videoInputQualityTosave = '540p';
        break;
      case '720p':
        this.audioVideo.chooseVideoInputQuality(1280, 720, 15);
        this.audioVideo.setVideoMaxBandwidthKbps(1400);
        videoInputQualityTosave = '720p';
        break;
    }
    window.localStorage.setItem('WFTR_videoinputquality', videoInputQualityTosave);
  }

  async setDevices(): Promise<boolean> {
    let videoInputDevice = window.localStorage.getItem("WFTR_videoinput");
    let audioInputDevice = window.localStorage.getItem("WFTR_audioinput");
    let audioOutputDevice = window.localStorage.getItem("WFTR_audiooutput");
    let videoInputQuality = window.localStorage.getItem("WFTR_videoinputquality");
    if ( !videoInputDevice || videoInputDevice == 'None' || !audioInputDevice || audioInputDevice == 'None' || !audioOutputDevice || audioOutputDevice == 'None' || !videoInputQuality || videoInputQuality == 'None' )
      return false;

    try {
      const device = await this.videoInputSelectionToDevice(videoInputDevice);
      await this.audioVideo.startVideoInput(device);
    } catch (e) {
      this.log(`failed to choose saved VideoInputDevice ${videoInputDevice}`, e);
      return false;
    }

    try {
      const device = await this.audioInputSelectionToDevice(audioInputDevice);
      await this.selectAudioInputDevice(device);
    } catch (e) {
      this.log(`failed to choose saved audio input device ${audioInputDevice}`, e);
      return false;
    }
    this.currentAudioInputDevice = audioInputDevice;
    this.updateVoiceFocusDisplayState();

    try {
      await this.chooseAudioOutputDevice(audioOutputDevice);
    } catch (e) {
      this.log(`Failed to choose saved AudioOutputDevice ${audioOutputDevice}`, e);
      return false;
    }
    const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
    try {
      await this.audioVideo.bindAudioElement(audioMix);
    } catch (e) {
      this.log('failed to bindAudioElement', e);
      return false;
    }
    (document.getElementById('video-input-quality') as HTMLSelectElement).value = videoInputQuality;
    (document.getElementById('video-input') as HTMLSelectElement).value = videoInputDevice;
    (document.getElementById('audio-output') as HTMLSelectElement).value = audioOutputDevice;
    (document.getElementById('audio-input') as HTMLSelectElement).value = audioInputDevice;
    return true;
  }

  async getNearestMediaRegion(): Promise<string> {
    const nearestMediaRegionResponse = await fetch(`https://nearest-media-region.l.chime.aws`, {
      method: 'GET',
    });
    const nearestMediaRegionJSON = await nearestMediaRegionResponse.json();
    const nearestMediaRegion = nearestMediaRegionJSON.region;
    return nearestMediaRegion;
  }

  toggleButton(button: string, state?: 'on' | 'off'): boolean {
    if (state === 'on') {
      this.buttonStates[button] = true;
    } else if (state === 'off') {
      this.buttonStates[button] = false;
    } else {
      this.buttonStates[button] = !this.buttonStates[button];
    }
    this.displayButtonStates();
    return this.buttonStates[button];
  }

  isButtonOn(button: string): boolean {
    return this.buttonStates[button];
  }

  displayButtonStates(): void {
    for (const button in this.buttonStates) {
      const element = document.getElementById(button);
      const drop = document.getElementById(`${button}-drop`);
      const on = this.buttonStates[button];
      // const tipActive = element.getAttribute('data-tip');
      // const tipOpposite = element.getAttribute('data-tipOpposite');
      element.classList.add(on ? 'active' : 'btn-outline-secondary');
      element.classList.remove(on ? 'btn-outline-secondary' : 'active');
        // if(on){
        //     element.setAttribute('title', tipActive);
        //     element.setAttribute('data-original-title', tipActive);
        // }
        // else{
        //     element.setAttribute('title', tipOpposite);
        //     element.setAttribute('data-original-title', tipOpposite);
        // }
        
      (element.firstElementChild as SVGElement).classList.add(on ? 'svg-active' : 'svg-inactive');
      (element.firstElementChild as SVGElement).classList.remove(
        on ? 'svg-inactive' : 'svg-active'
      );
      if (drop) {
        drop.classList.add(on ? 'active' : 'btn-outline-secondary');
        drop.classList.remove(on ? 'btn-outline-secondary' : 'active');
      }
    }
  }

  confirmEndMeeting(): void {
    const confirmEnd = (new URL(window.location.href).searchParams.get('confirm-end')) === 'true';
    const prompt = 'Are you sure you want to end the meeting for everyone? The meeting cannot be used after ending it.';
    if (confirmEnd && !window.confirm(prompt)) {
      return;
    }
    new AsyncScheduler().start(async () => {
      this.BackToDashboard(true,'user confirmed end');
    });
  }

  showProgress(id: string): void {
    (document.getElementById(id) as HTMLDivElement).style.visibility = 'visible';
  }

  hideProgress(id: string): void {
    (document.getElementById(id) as HTMLDivElement).style.visibility = 'hidden';
  }

  switchToFlow(flow: string): void {
    ($('#jsLoadingDiv') as any).hide('');
    Array.from(document.getElementsByClassName('flow')).map(
      e => ((e as HTMLDivElement).style.display = 'none')
    );
    (document.getElementById(flow) as HTMLDivElement).style.display = 'block';
  }

  async onAudioInputsChanged(freshDevices: MediaDeviceInfo[]): Promise<void> {
    await this.populateAudioInputList();

    if (!this.currentAudioInputDevice) {
      return;
    }

    if (this.currentAudioInputDevice === 'default') {
      // The default device might actually have changed. Go ahead and trigger a
      // reselection.
      this.log('Reselecting default device.');
      await this.selectAudioInputDevice(this.currentAudioInputDevice);
      return;
    }

    const freshDeviceWithSameID = freshDevices.find(
      device => device.deviceId === this.currentAudioInputDevice
    );

    if (freshDeviceWithSameID === undefined) {
      this.log('Existing device disappeared. Selecting a new one.');

      // Select a new device.
      await this.openAudioInputFromSelectionAndPreview();
    }
  }

  audioInputsChanged(freshAudioInputDeviceList: MediaDeviceInfo[]): void {
    this.onAudioInputsChanged(freshAudioInputDeviceList);
  }

  videoInputsChanged(_freshVideoInputDeviceList: MediaDeviceInfo[]): void {
    this.populateVideoInputList();
  }

  audioOutputsChanged(_freshAudioOutputDeviceList: MediaDeviceInfo[]): void {
    this.populateAudioOutputList();
  }

  audioInputStreamEnded(deviceId: string): void {
    this.log(`Current audio input stream from device id ${deviceId} ended.`);
  }

  videoInputStreamEnded(deviceId: string): void {
    this.log(`Current video input stream from device id ${deviceId} ended.`);
  }

  estimatedDownlinkBandwidthLessThanRequired(
    estimatedDownlinkBandwidthKbps: number,
    requiredVideoDownlinkBandwidthKbps: number
  ): void {
    this.log(
      `Estimated downlink bandwidth is ${estimatedDownlinkBandwidthKbps} is less than required bandwidth for video ${requiredVideoDownlinkBandwidthKbps}`
    );
  }

  videoNotReceivingEnoughData(videoReceivingReports: ClientVideoStreamReceivingReport[]): void {
    this.log(
      `One or more video streams are not receiving expected amounts of data ${JSON.stringify(
        videoReceivingReports
      )}`
    );
  }

  metricsDidReceive(clientMetricReport: ClientMetricReport): void {
    const metricReport = clientMetricReport.getObservableMetrics();
    if (
      typeof metricReport.availableSendBandwidth === 'number' &&
      !isNaN(metricReport.availableSendBandwidth)
    ) {
      //Available Uplink Bandwidth:
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerText =
        String(metricReport.availableSendBandwidth / 1000) +
        ' Kbps';
    } else if (
      typeof metricReport.availableOutgoingBitrate === 'number' &&
      !isNaN(metricReport.availableOutgoingBitrate)
    ) {
      //Available Uplink Bandwidth:
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerText =
        String(metricReport.availableOutgoingBitrate / 1000) +
        ' Kbps';
    } else {
      //Available Uplink Bandwidth:
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerText =
        'Unknown';
    }

    if (
      typeof metricReport.availableReceiveBandwidth === 'number' &&
      !isNaN(metricReport.availableReceiveBandwidth)
    ) {
      //Available Downlink Bandwidth:
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerText =
        String(metricReport.availableReceiveBandwidth / 1000) +
        ' Kbps';
    } else if (
      typeof metricReport.availableIncomingBitrate === 'number' &&
      !isNaN(metricReport.availableIncomingBitrate)
    ) {
      //Available Downlink Bandwidth:
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerText =
        String(metricReport.availableIncomingBitrate / 1000) +
        ' Kbps';
    } else {
      //Available Downlink Bandwidth:
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerText =
        'Unknown';
    }

    var technicalElements = ['chime-meeting-id', 'desktop-attendee-id', 'video-uplink-bandwidth', 'video-downlink-bandwidth', 'workout-version'];
          showHideTRtechnicalInfo(technicalElements);

    // this.hasChromiumWebRTC && this.isButtonOn('button-video-stats') && this.getAndShowWebRTCStats();
  }

  async createLogStream(
    configuration: MeetingSessionConfiguration,
    pathname: string
  ): Promise<void> {
    const body = JSON.stringify({
      meetingId: configuration.meetingId,
      attendeeId: configuration.credentials.attendeeId,
    });
    try {
      const response = await fetch(`${WorkoutApp.BASE_URL}${pathname}`, {
        method: 'POST',
        body,
      });
      if (response.status === 200) {
        console.log('[WorkoutApp] log stream created');
      }
    } catch (error) {
      fatal(error);
      this.log(error.message);
    }
  }

  eventDidReceive(name: EventName, attributes: EventAttributes): void {
    this.log(`Received an event: ${JSON.stringify({ name, attributes })}`);
    const { meetingHistory, ...otherAttributes } = attributes;
    switch (name) {
      case 'meetingEnded':{
        this.meetingEventPOSTLogger?.info(
          JSON.stringify({
            name,
            attributes: otherAttributes,
          })
        );
        this.stopBot();
        break;
      }
      case 'meetingStartRequested':
      case 'meetingStartSucceeded':
      case 'audioInputSelected':
      case 'videoInputSelected':
      case 'audioInputUnselected':
      case 'videoInputUnselected':
      case 'attendeePresenceReceived': {
        // Exclude the "meetingHistory" attribute for successful events.
        this.meetingEventPOSTLogger?.info(
          JSON.stringify({
            name,
            attributes: otherAttributes,
          })
        );
        break;
      }
      case 'audioInputFailed':
      case 'videoInputFailed':
      case 'meetingStartFailed':
      case 'meetingFailed': {
        // Send the last 5 minutes of events.
        this.meetingEventPOSTLogger?.info(
          JSON.stringify({
            name,
            attributes: {
              ...otherAttributes,
              meetingHistory: meetingHistory.filter(({ timestampMs }) => {
                return Date.now() - timestampMs < WorkoutApp.MAX_MEETING_HISTORY_MS;
              }),
            },
          })
        );
        break;
      }
    }
  }

  async initializeMeetingSession(configuration: MeetingSessionConfiguration): Promise<void> {
    const logLevel = LogLevel.INFO;
    const consoleLogger = (this.meetingLogger = new ConsoleLogger('SDK', logLevel));
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      this.meetingLogger = consoleLogger;
    } else {
      await Promise.all([
        this.createLogStream(configuration, 'create_log_stream'),
        this.createLogStream(configuration, 'create_browser_event_log_stream'),
      ]);

      this.meetingSessionPOSTLogger = getPOSTLogger(configuration, 'SDK', `${WorkoutApp.BASE_URL}logs`, LogLevel.INFO);
      this.meetingLogger = new MultiLogger(
          consoleLogger,
          this.meetingSessionPOSTLogger,
      );
      this.meetingEventPOSTLogger = getPOSTLogger(configuration, 'SDKEvent', `${WorkoutApp.BASE_URL}log_meeting_event`, LogLevel.INFO);
    }
    this.eventReporter = await this.setupEventReporter(configuration);

    this.deviceController = new DefaultDeviceController(this.meetingLogger, {
      enableWebAudio: this.enableWebAudio,
    });
    const urlParameters = new URL(window.location.href).searchParams;
    const timeoutMs = Number(urlParameters.get('attendee-presence-timeout-ms'));
    if (!isNaN(timeoutMs)) {
      configuration.attendeePresenceTimeoutMs = Number(timeoutMs);
    }
    configuration.enableSimulcastForUnifiedPlanChromiumBasedBrowsers = this.enableSimulcast;
    this.meetingSession = new DefaultMeetingSession(
      configuration,
      this.meetingLogger,
      this.deviceController,
      new DefaultEventController(configuration, this.meetingLogger, this.eventReporter)
    );

    this.audioVideo = this.meetingSession.audioVideo;
    if (this.enableSimulcast) {
      this.audioVideo.chooseVideoInputQuality(1280, 720, 15);
      this.audioVideo.setVideoMaxBandwidthKbps(1400);
    }
    this.audioVideo.addDeviceChangeObserver(this);
    this.setupDeviceLabelTrigger();
    await this.populateAllDeviceLists();
    this.setupMuteHandler();
    this.setupCanUnmuteHandler();
    this.setupSubscribeToAttendeeIdPresenceHandler();
    this.setupDataMessage();
    this.audioVideo.addObserver(this);
    this.audioVideo.addContentShareObserver(this);
    this.initContentShareDropDownItems();    
  }

  async setupEventReporter(configuration: MeetingSessionConfiguration): Promise<EventReporter> {
    let eventReporter: EventReporter;
    const ingestionURL = configuration.urls.eventIngestionURL;
    if (!ingestionURL) {
      return eventReporter;
    }
    if (!this.enableEventReporting) {
      return new NoOpEventReporter();
    }
    const eventReportingLogger = new ConsoleLogger('SDKEventIngestion', LogLevel.INFO);
    const meetingEventClientConfig = new MeetingEventsClientConfiguration(
        configuration.meetingId,
        configuration.credentials.attendeeId,
        configuration.credentials.joinToken
    );
    const eventIngestionConfiguration = new EventIngestionConfiguration(
        meetingEventClientConfig,
        ingestionURL
    );
    if (this.isLocalHost()) {
      eventReporter = new DefaultMeetingEventReporter(eventIngestionConfiguration, eventReportingLogger);
    } else {
      await this.createLogStream(configuration, 'create_browser_event_ingestion_log_stream');
      const eventReportingPOSTLogger = getPOSTLogger(configuration, 'SDKEventIngestion', `${WorkoutApp.BASE_URL}log_event_ingestion`, LogLevel.DEBUG);
      const multiEventReportingLogger = new MultiLogger(
          eventReportingLogger,
          eventReportingPOSTLogger,
      );
      eventReporter = new DefaultMeetingEventReporter(eventIngestionConfiguration, multiEventReportingLogger);
    }
    return eventReporter;
  }

  private isLocalHost(): boolean {
    return document.location.host === '127.0.0.1:8080' || document.location.host === 'localhost:8080';
  }

  async join(): Promise<void> {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.log(event.reason);
    });
    this.audioVideo.start();
    this.pingToServer();
  }

  pingToServer(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      try {
        await fetch(
          this.api_base_url + `Home/UpdateExitTimeForOneMinute?classScheduleId=${encodeURIComponent(this.classScheduleId)}&customerId=${encodeURIComponent(customerId)}&groupId=0&isGroup=false`,
          {
            method: 'POST'
          }
        );
        new TimeoutScheduler(60000).start(()=>{
          this.pingToServer();
        });
      } catch (error) {
        console.error(error.message);
        new TimeoutScheduler(60000).start(()=>{
          this.pingToServer();
        });
        return;
      }
    });
  }

  async leave(): Promise<void> {
    //this.statsCollector.resetStats();
    this.audioVideo.removeAllVideoTiles();
    this.audioVideo.stop();
    this.voiceFocusDevice?.stop();
    this.voiceFocusDevice = undefined;
    this.audioVideo.realtimeUnsubscribeToAttendeeIdPresence(null);
    this.audioVideo.realtimeUnsubscribeToMuteAndUnmuteLocalAudio(null);
    this.audioVideo.realtimeUnsubscribeToSetCanUnmuteLocalAudio(null);
    this.audioVideo.removeObserver(this);
    this.audioVideo.removeContentShareObserver(this);

    await this.chosenVideoTransformDevice?.stop();
    this.chosenVideoTransformDevice = undefined;
    this.roster = {};

    this.tileOrganizer.releaseAll();
    for (let tileIndex = 0; tileIndex <= WorkoutTileOrganizer.MAX_TILES; tileIndex++) {
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      tileElement.classList.remove('active', 'featured', 'content');
  //    tileElement.style.display = 'none';
    }
  }

  setupMuteHandler(): void {
    const handler = (isMuted: boolean): void => {
      this.log(`muted = ${isMuted}`);
    };
    this.audioVideo.realtimeSubscribeToMuteAndUnmuteLocalAudio(handler);
    const isMuted = this.audioVideo.realtimeIsLocalAudioMuted();
    handler(isMuted);
  }

  setupCanUnmuteHandler(): void {
    const handler = (canUnmute: boolean): void => {
      this.log(`canUnmute = ${canUnmute}`);
    };
    this.audioVideo.realtimeSubscribeToSetCanUnmuteLocalAudio(handler);
    handler(this.audioVideo.realtimeCanUnmuteLocalAudio());
  }

  heartGetPercent(pulseRate: any, personAge: any) {
    return Math.round(parseInt(pulseRate) * 100 / (220 - personAge));
  }

  buildCustomerHeartRate(customerPulseList: any) {
    const roster = document.getElementById('roster');
    // console.log('pulse_data:'+JSON.stringify(customerPulseList));
    customerPulseList.forEach( (pulseData:{ CustomerID: any, PulseRate: any, PulseTime:any, O2:any }) => {
      if ( !this.allCustomerDetail[pulseData.CustomerID] )
        return;
      const customerDetail = this.allCustomerDetail[pulseData.CustomerID];
      const li = roster.querySelectorAll("li[data-customerid='"+pulseData.CustomerID+"']");
      const heartBeatCountElement = document.querySelectorAll("span.heartBeatCount[data-customerid='"+pulseData.CustomerID+"']");
      if ( li && li[0] ){
        let currentDateTime = new Date();
        let pulseTime = parseInt((pulseData.PulseTime.split('(')[1]).split(')')[0]);
        let timeOffset = currentDateTime.getTime() - pulseTime;
        const heartTag = li[0].getElementsByClassName('heartCont')[0];
        const heartIconTag = heartTag.getElementsByTagName('i')[0];
        const hRateTag = heartTag.getElementsByTagName('p')[0];
        if (pulseData.PulseRate && timeOffset < 8000) {
          if ( !memberFlag || customerId == pulseData.CustomerID )
            this.updateProperty(hRateTag, 'innerHTML', 
            "<ul style='list-style:none;padding:0px'><li><span class='heartCont'><i class='fas fa-heartbeat heartDisabled mlr15'></i>"+pulseData.PulseRate + "/" + this.heartGetPercent(pulseData.PulseRate, customerDetail.Age) + "%</span></li><li class='o2text'><small><var>O<sub>2</sub></var>" + pulseData.O2 + "%</small></li></ul>");
          else {
            this.updateProperty(hRateTag, 'innerHTML', "<ul style='list-style:none;padding:0px'><li><span class='heartCont'><i class='fas fa-heartbeat heartDisabled mlr15'></i>"+this.heartGetPercent(pulseData.PulseRate, customerDetail.Age) + "%</span></li><li class='o2text'><small><var>O<sub>2</sub></var>" + pulseData.O2 + "%</small></li></ul>");
          }
          $(heartIconTag).removeClass('heartDisabled').addClass('heart');
          $(hRateTag).removeClass('veryveryLight veryLight light moderate hard veryHard brutal');
          if ( heartBeatCountElement && heartBeatCountElement[0] ){
            $(heartBeatCountElement[0]).removeClass('veryveryLight veryLight light moderate hard veryHard brutal');
          }
          let percentClass = percentClassHelper(this.heartGetPercent(pulseData.PulseRate, customerDetail.Age));
          let tempuserId = idModifyForPulseElement(customerId);
          if (percentClass)
          {
            $(hRateTag).removeClass('hide').addClass(percentClass).attr({'data-pclass': percentClass, id: 'pulse-'+tempuserId, 'data-uid': 'pulse-'+tempuserId, 'data-age': customerDetail.Age});
            if ( heartBeatCountElement && heartBeatCountElement[0] ){
              $(heartBeatCountElement[0]).addClass(percentClass);
              this.updateProperty(heartBeatCountElement[0], 'innerHTML', "<ul style='list-style:none;padding:0px'><li><span class='heartCont'><i class='fas fa-heartbeat heartDisabled mlr15'></i>"+this.heartGetPercent(pulseData.PulseRate, customerDetail.Age) + "%</span></li><li class='o2text'><small><var>O<sub>2</sub></var>" + pulseData.O2 + "%</small></li></ul>");    
            }
            heartBeatCountFont();
          }
          $('.heartCont i').removeClass('heartDisabled').addClass('heart');
          heartRateChartHelper(tempuserId, percentClass, customerDetail.Age, customerDetail.Birthday)
        } else {
          this.updateProperty(hRateTag, 'innerText', "");
          $(hRateTag).removeClass('veryveryLight veryLight light moderate hard veryHard brutal');
          $(heartIconTag).removeClass('heart').addClass('heartDisabled');
          $('.heartCont i').removeClass('heart').addClass('heartDisabled');
          if ( heartBeatCountElement && heartBeatCountElement[0] ){
            $(heartBeatCountElement[0]).removeClass('veryveryLight veryLight light moderate hard veryHard brutal');
            this.updateProperty(heartBeatCountElement[0], 'innerText', "");    
          }
        }
      }
    });
  }

  deleteRoster(attendeeId:any): void {
    const roster = document.getElementById('roster');
    const li = roster.querySelectorAll("li[data-attendeeid='"+attendeeId+"']");
    if ( li && li[0] )
      roster.removeChild(li[0]);
  }
  addNewRoster(attendeeId:any): void {
    if ( !this.roster[attendeeId] )
      return;
    if ( this.roster[attendeeId].name.indexOf("MediaPipeline") >= 0 )
      return;
    if ( this.roster[attendeeId].name.split('#')[1] == ROLE_BOT )
      return;
    if ( memberFlag ){
      if ( this.roster[attendeeId].name.split('#')[1] == ROLE_AUDITOR )
        return;
      if ( this.roster[attendeeId].name.split('#')[1] == ROLE_TRAINER )
        return;
    }
    if ( !this.bShowedMemberList && this.roster.length >= 2 ){
      let count = 0;
      for (const id in this.roster ){
        if ( this.roster[id].name.split('#')[1] == ROLE_MEMBER )
          count++;
      }
      if ( count >= 2 ){
        $("input").find("[data-opVal='2']").click(); 
        this.bShowedMemberList = true;
      }
    }
    const roster = document.getElementById('roster');
    let liHTML =    '<div class="badge"></div>'+
                    '<img src="" alt="">'+
                    '<div class="listCont">'+
                        '<h6></h6>'+
                        '<p></p>'+
                    '</div>'+
                    '<div class="heartCont">'+
                        '<i class="fas fa-heartbeat fa-2x heartDisabled mr5"></i>'+
                        '<p class="jsHrate hRate hide" id="" data-uid="" data-age=""></p>'+
                    '</div>';
    const li = document.createElement('li');
    li.setAttribute('data-attendeeid', attendeeId);
    let attendeeCustomerId = this.roster[attendeeId].name.split('#')[2];
    li.setAttribute('data-customerid', attendeeCustomerId);
    li.innerHTML = liHTML;
    const listTag = li.getElementsByClassName('listCont')[0];
    listTag.setAttribute("id", 'side-menu_' + this.roster[attendeeId].name.split('#')[2]);
    listTag.setAttribute('data-attendeeid', attendeeId);
    listTag.setAttribute('data-customerid', attendeeCustomerId);
    let that = this;
    listTag.addEventListener('click', (e) => {
      if ( !trainerFlag )
        return;
      const customerNameTag = listTag.getElementsByTagName('h6')[0];
      let customerName = '';
      if ( customerNameTag )
        customerName = customerNameTag.innerText;
      let html = '<h4>'+customerName+'</h4>';
      const confirmModal = ($ as any).confirm({
        title:'Take Action for member',
        content: html,
        icon: 'fa fa-info-circle',
        type: 'blue',
        closeIcon: true,
        buttons: {
          oneOn1Btn: {
              text: '1 on 1',
              btnClass: 'btn-theme',
              keys: ['enter', 'shift'],
              action: function(){
                  if ( that.bPrivateChating == true ){
                    confirmModal.close();
                    return;
                  }
                  that.bPrivateChating = true;
                  confirmModal.close();
                  ($('#waitingModal') as any).modal('show');
                  new AsyncScheduler().start(async (): Promise<void> => {
                    let myuuid = uuidv4();
                    let jsonMsg = {
                      "customerId": customerId,
                      "status": that.bPrivateChating,
                      "roomId": customerId+myuuid.substring(0,8)
                    };
                    await that.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS, JSON.stringify(jsonMsg));
                    that.joinRoom(jsonMsg.roomId);
                    document.getElementById('button-breakout-room-end').classList.remove("hide");
                  });
              }
          },
          outRoomBtn: {
              text: 'Out Room',
              btnClass: 'btn-red',
              keys: ['enter', 'shift'],
              action: function(){
                  //$('side-menu-buttomLeave_'+customerId).click();
                  ($ as any).confirm({
                    title: 'Warning',
                    content: 'Are you sure, you want to remove <strong>'+customerName+'</strong> from the training room?',
                    icon: 'fa fa-warning',
                    type: 'red',
                    buttons: {
                        confirmBtn:{
                          text: 'Yes',
                          btnClass: 'btn-red',
                          keys: ['enter', 'shift'],
                          action: function(){
                            let jsonMsg = {
                              "id": attendeeCustomerId
                            };
                            that.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_OUT_ROOM, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
                          }
                        },
                        noBtn:{
                          text: 'No',
                          btnClass: 'btn-default',
                          keys: ['esc', 'shift'],
                        }
                    }
                });
              }
          }
        }
      });
    });
    const nameTag = listTag.getElementsByTagName('h6')[0];
    this.updateProperty(nameTag, 'innerText', this.roster[attendeeId].name.split('#')[0]);
    if ( this.allCustomerDetail[attendeeCustomerId] ){
      const imgTag = li.getElementsByTagName('img')[0];
      const locationTag = listTag.getElementsByTagName('p')[0];
      const customerDetail = this.allCustomerDetail[attendeeCustomerId];  
      if (customerDetail.ProfileAvatar) {
        this.updateProperty(imgTag, 'src', this.api_base_url + "Upload/Customer/ProfileAvatar/" + customerDetail.CustomerID + "_" + customerDetail.ProfileAvatar);
      } else {
        this.updateProperty(imgTag, 'src', "https://heightstitle.com/wp-content/uploads/2014/12/user-dummy-pic.png");
      }
      this.updateProperty(locationTag, 'innerText', customerDetail.Location);
    } else {
      new AsyncScheduler().start(async (): Promise<void> => {
        const customerDetail = await this.getCustomerDetail(attendeeCustomerId);
        this.allCustomerDetail[attendeeCustomerId] = customerDetail;
        const imgTag = li.getElementsByTagName('img')[0];
        const locationTag = listTag.getElementsByTagName('p')[0];
        const customerLocationElement = document.querySelectorAll("small[data-customerid='"+attendeeCustomerId+"']");
        if ( customerLocationElement && customerLocationElement[0] ){
          this.updateProperty(customerLocationElement[0], 'innerText', customerDetail.Location);  
        }
        if (customerDetail.ProfileAvatar) {
          this.updateProperty(imgTag, 'src', this.api_base_url + "Upload/Customer/ProfileAvatar/" + customerDetail.CustomerID + "_" + customerDetail.ProfileAvatar);
        } else {
          this.updateProperty(imgTag, 'src', "https://heightstitle.com/wp-content/uploads/2014/12/user-dummy-pic.png");
        }
        this.updateProperty(locationTag, 'innerText', customerDetail.Location);  
      });
    }
    roster.appendChild(li);
  }
  updateRoster(): void {
    const roster = document.getElementById('roster');
    for (const attendeeId in this.roster) {
      const li = roster.querySelectorAll("li[data-attendeeid='"+attendeeId+"']");
      if ( !li || !li[0] )
          continue;
      const statusSpan = document.querySelectorAll("span[data-attendeeid='"+attendeeId+"']");
      const statusButton = document.querySelectorAll("button[data-attendeeid='"+attendeeId+"']");
      const badgeTag = li[0].getElementsByClassName('badge')[0];
      const videoElement = document.getElementsByClassName(attendeeId);
      (li[0] as HTMLElement).style.border = null;
      if (videoElement != null && videoElement.length > 0) {
        (videoElement[0] as HTMLElement).style.border = null;
      }

      let statusClass = 'badge badge-pill ';
      let statusText = ''; // &nbsp
      if (this.roster[attendeeId].signalStrength < 1) {
        statusClass += 'badge-warning';
      } else if (this.roster[attendeeId].signalStrength === 0) {
        statusClass += 'badge-danger';
      } else if (this.roster[attendeeId].muted) {
        // statusText = 'MUTED';
        statusText = '<i class="fas fa-microphone-slash"></i>';
        statusClass += 'badge-danger';
      } else if (this.roster[attendeeId].active) {
        // statusText = 'SPEAKING';
        statusText = '<i class="bar"></i><i class="bar"></i><i class="bar"></i>';
        statusClass += 'badge-success';
        if (videoElement != null && videoElement.length > 0) {
          (videoElement[0] as HTMLElement).style.borderWidth = "5px";
          (videoElement[0] as HTMLElement).style.borderStyle = "solid";
          (videoElement[0] as HTMLElement).style.borderColor = "#dba828";
        }
        (li[0] as HTMLElement).style.borderWidth = "5px";
        (li[0] as HTMLElement).style.borderStyle = "solid";
        (li[0] as HTMLElement).style.borderColor = "#dba828";
      } else if (this.roster[attendeeId].volume > 0) {
        statusClass += 'badge-success';
      }
      if (this.roster[attendeeId].muted) {
        if ( statusButton && statusButton[0] )
          $(statusButton[0]).removeClass('unmute').addClass('mute');
        if ( statusSpan && statusSpan[0] ){
          $(statusSpan[0]).removeClass('unmute').addClass('mute');
          $(statusSpan[0]).removeClass('hide');
        }
      } else {
        if ( statusSpan && statusSpan[0] ){
          $(statusSpan[0]).removeClass('mute').addClass('unmute');
          $(statusSpan[0]).addClass('hide');
        }
        if ( statusButton && statusButton[0] )
          $(statusButton[0]).removeClass('mute').addClass('unmute');
      }
      this.updateProperty(badgeTag, 'className', statusClass);
      this.updateProperty(badgeTag, 'innerHTML', statusText);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProperty(obj: any, key: string, value: string): void {
    if (value !== undefined && obj[key] !== value) {
      obj[key] = value;
    }
  }

  presenceHandler = (
    attendeeId: string,
    present: boolean,
    externalUserId: string,
    dropped: boolean
  ): void => {
    this.log(`${attendeeId} present = ${present} (${externalUserId})`);
    const isContentAttendee = new DefaultModality(attendeeId).hasModality(
      DefaultModality.MODALITY_CONTENT
    );
    const isSelfAttendee =
      new DefaultModality(attendeeId).base() ===
      this.meetingSession.configuration.credentials.attendeeId;
    if (!present) {
      delete this.roster[attendeeId];
      this.deleteRoster(attendeeId);
      this.log(`${attendeeId} dropped = ${dropped} (${externalUserId})`);
      return;
    }
    //If someone else share content, stop the current content share
    if (
      !this.allowMaxContentShare() &&
      !isSelfAttendee &&
      isContentAttendee &&
      this.isButtonOn('button-content-share')
    ) {
      this.contentShareStop();
    }
    if (!this.roster[attendeeId]) {
      this.roster[attendeeId] = {
        name: externalUserId,
      };
      this.addNewRoster(attendeeId);
    }
    this.audioVideo.realtimeSubscribeToVolumeIndicator(
      attendeeId,
      async (
        attendeeId: string,
        volume: number | null,
        muted: boolean | null,
        signalStrength: number | null
      ) => {
        if (!this.roster[attendeeId]) {
          return;
        }
        const isContentAttendee = new DefaultModality(attendeeId).hasModality(
          DefaultModality.MODALITY_CONTENT
        );
        if ( isContentAttendee && this.roster[attendeeId].name.indexOf('«Meeting Bot»') >= 0){
          let exerciseVideoVolume = 0;
          if ( volume !== null )
            exerciseVideoVolume = Math.round(volume * 100);
          commonRangeProgress(document.getElementById('memberMusicVolumeBar'));
          $("#videoplayer_meter .sound_track ul li").each(function () {
            let ths = $(this);
            let level = ths.data("level");
            ths.css("background-color", "#cecece");
            if (level <= exerciseVideoVolume) {
              ths.css("background-color", "transparent");
            }
          });
        }
        if (volume !== null) {
          this.roster[attendeeId].volume = Math.round(volume * 100);
        }
        if (muted !== null ) {
          this.roster[attendeeId].muted = muted;
        }
        if (signalStrength !== null) {
          this.roster[attendeeId].signalStrength = Math.round(signalStrength * 100);
        }
        this.updateRoster();
      }
    );
  };

  setupSubscribeToAttendeeIdPresenceHandler(): void {
    this.audioVideo.realtimeSubscribeToAttendeeIdPresence(this.presenceHandler);
    const activeSpeakerHandler = (attendeeIds: string[]): void => {
      for (const attendeeId in this.roster) {
        this.roster[attendeeId].active = false;
      }
      for (const attendeeId of attendeeIds) {
        if (this.roster[attendeeId]) {
          this.roster[attendeeId].active = true;
          break; // only show the most active speaker
        }
      }
      this.layoutFeaturedTile();
    };
    this.audioVideo.subscribeToActiveSpeakerDetector(
      new DefaultActiveSpeakerPolicy(),
      activeSpeakerHandler,
      (scores: { [attendeeId: string]: number }) => {
        for (const attendeeId in scores) {
          if (this.roster[attendeeId]) {
            this.roster[attendeeId].score = scores[attendeeId];
          }
        }
        this.updateRoster();
      },
      this.showActiveSpeakerScores ? 100 : 0
    );
  }

  dataMessageHandler(dataMessage: DataMessage): void {
    if (!dataMessage.throttled) {
      const isSelf =
        dataMessage.senderAttendeeId === this.meetingSession.configuration.credentials.attendeeId;
      if (dataMessage.timestampMs <= this.lastReceivedMessageTimestamp) {
        return;
      }
      this.lastReceivedMessageTimestamp = dataMessage.timestampMs;
      const messageDiv = document.getElementById('receive-message') as HTMLDivElement;
      const messageNameSpan = document.createElement('div') as HTMLDivElement;
      messageNameSpan.classList.add('message-bubble-sender');
      messageNameSpan.innerText = dataMessage.senderExternalUserId.split('#').slice(-1)[0];
      const messageTextSpan = document.createElement('div') as HTMLDivElement;
      messageTextSpan.classList.add(isSelf ? 'message-bubble-self' : 'message-bubble-other');
      messageTextSpan.innerHTML = this.markdown
        .render(dataMessage.text())
        .replace(/[<]a /g, '<a target="_blank" ');
      const appendClass = (element: HTMLElement, className: string): void => {
        for (let i = 0; i < element.children.length; i++) {
          const child = element.children[i] as HTMLElement;
          child.classList.add(className);
          appendClass(child, className);
        }
      };
      appendClass(messageTextSpan, 'markdown');
      if (this.lastMessageSender !== dataMessage.senderAttendeeId) {
        messageDiv.appendChild(messageNameSpan);
      }
      this.lastMessageSender = dataMessage.senderAttendeeId;
      messageDiv.appendChild(messageTextSpan);
      messageDiv.scrollTop = messageDiv.scrollHeight;
    } else {
      this.log('Message is throttled. Please resend');
    }
  }

  rebootBot(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      console.log('rebootBot');
      const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
      videoElement.style.display = 'none';
      await this.stopBot();
      new TimeoutScheduler(3000).start(()=>{      
        this.startBot();
      });
    });
  }

  restartWorkout(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      console.log('restartWorkout');
      let jsonMsg = {
          "id": "Play",
          "videoIndex": 0,
      };
      await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_PAUSE, JSON.stringify(jsonMsg),WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
    });
  }

  sendCameraRotationStatus(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      if ( !document.getElementById('trainer-camera') )
        return;
      let classList = document.getElementById('trainer-camera').className.split(/\s+/);
      let degree = "cdegree0";
      for (let i = 0; i < classList.length; i++) {
          if (classList[i].indexOf('cdegree') !== -1) {
            degree = classList[i];
          }
      }
      console.log('sendCameraRotationStatus:'+degree);
      let dNum = degree;
      dNum.replace( /^\D+/g, '')
      document.getElementById('trainer-camera').className='trainerVideo jsTrainerVideo jsRotateVid '+degree;
      await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_TRAINER_CAMERA_STATUS, degree, WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
    });
  }

  sendSwitchCoachVideoStatus(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      console.log('sendSwitchCoachVideoStatus:'+showCoachingFlag);
      const trainerVolumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
      const memberMusicVolumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;  
      let jsonMsg = {
        "status": "BWCMixedAudioStatus",
        "isBWCMutedMemberMusic": this.isBWCMutedMemberMusic,
        "isBWCMutedTrainer": this.isBWCMutedTrainer,
        "memberMusicVolume": parseFloat(memberMusicVolumeBar.value),
        "trainerVolume": parseFloat(trainerVolumeBar.value),
        "isShowingCoach": showCoachingFlag
      };
      await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);  
    });
  }

  sendSwitchRecordingVideoStatus(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      console.log('sendSwitchRecordingVideoStatus:'+recordingFlag);
      let jsonMsg = {
        "id": "RecordingVideoStatus",
        "recordingFlag": recordingFlag
      };
      await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);  
    });
  }

  setupDataMessage(): void {

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(
      WorkoutApp.DATA_MESSAGE_TOPIC,
      (dataMessage: DataMessage) => {
        this.dataMessageHandler(dataMessage);
      }
    );

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_GET_TRAINER_CAMERA_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
        console.log(WorkoutApp.DATA_MESSAGE_TOPIC_GET_TRAINER_CAMERA_STATUS+':'+dataMessage.text());
        if ( trainerFlag )
          this.sendCameraRotationStatus();
      }
    });

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_TRAINER_CAMERA_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
      	console.log(WorkoutApp.DATA_MESSAGE_TOPIC_TRAINER_CAMERA_STATUS+':'+dataMessage.text());
        if ( trainerFlag )
          return;
        let strDegrees = dataMessage.text();
        strDegrees = strDegrees.substr(7, strDegrees.length-7);
        let degrees = Number(strDegrees);//+90;
        window.localStorage.setItem('camera_angle', degrees.toString());
        console.log('rotated:'+degrees);
        $("#trainer-camera video").css({'-webkit-transform' : 'rotate('+ degrees +'deg)',
        '-moz-transform' : 'rotate('+ degrees +'deg)',
        '-ms-transform' : 'rotate('+ degrees +'deg)',
        'transform' : 'rotate('+ degrees +'deg)'});
      }
    });

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MUTE_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
      	console.log(WorkoutApp.DATA_MESSAGE_TOPIC_MUTE_STATUS+':'+dataMessage.text());
        const jsonData = JSON.parse(dataMessage.text());
        //if (memberFlag) {
        if (jsonData.id == customerId) {
          if (jsonData.isMute == false) {
            this.isMutedMicrophone = false;
            this.toggleButton('button-microphone', 'on');
            this.audioVideo.realtimeUnmuteLocalAudio();
          } else {
            this.isMutedMicrophone = true;
            this.toggleButton('button-microphone', 'off');
            this.audioVideo.realtimeMuteLocalAudio();
          }
          let jsonStroage = {
            "isMutedMicrophone": this.isMutedMicrophone
          };
          window.localStorage.setItem("memberMicrophoneMute_" + customerId, JSON.stringify(jsonStroage));
        }
      }
    });
    
    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_PULSE_DATA, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
        console.log(WorkoutApp.DATA_MESSAGE_TOPIC_PULSE_DATA+':'+dataMessage.text());
        const jsonPulseDataList = JSON.parse(dataMessage.text());
        if (jsonPulseDataList != null && jsonPulseDataList.length > 0) {
           this.buildCustomerHeartRate(jsonPulseDataList);
        }
      }
    });
    
    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
      console.log(WorkoutApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS+':'+dataMessage.text());
        const jsonData = JSON.parse(dataMessage.text());
        if (jsonData != null) {
          if ( jsonData.status == true ){
            this.bPrivateChating = true;
            if ( jsonData.customerId == customerId ){
              ($('#waitingModal') as any).modal('show');
              new TimeoutScheduler(3000).start(async () => {
                this.joinRoom(jsonData.roomId);
              });
            }            
          } else {
            this.bPrivateChating = false;
            ($('#waitingModal') as any).modal('show');
            //need to rejoin into the original room
            this.joinRoom(this.classScheduleId);
          }
        }
      }
    });

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_JOIN_CUSTOMER, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
      console.log(WorkoutApp.DATA_MESSAGE_TOPIC_JOIN_CUSTOMER+':'+dataMessage.text());
        const jsonCustomerData = JSON.parse(dataMessage.text());
        if (jsonCustomerData != null) {
          if ( !this.allCustomerDetail[jsonCustomerData.customerId] ){
            this.allCustomerDetail[jsonCustomerData.customerId] = jsonCustomerData;
          }
        }
      }
    });

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
        const jsonData = JSON.parse(dataMessage.text());
      	console.log(WorkoutApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS+':'+dataMessage.text());
        if ( jsonData.status == "BWCMixedAudioStatus" ) {
          if ( jsonData.isTrainerJoined ){
            this.bPrivateChating = false;
            bWithoutCoachFlag = false;
            showCoachingFlag = false;
            $("#coachSwitch").prop('checked', false);
            this.isBWCMutedTrainer = true;
            $('.trainerDiv').removeClass('trainerboxhide');
            $('.botDiv').removeClass('botboxOnly');
            $('.showOnlyInbWithoutCoach').addClass('hide');
            if (this.role == ROLE_COACH ) {
              this.role = ROLE_MEMBER;
              coachFlag = false;
            }
            // $('#trainerName').text(this.scheduledTrainerName);
            columnPartition();
          }
          if (this.role == ROLE_COACH ) {      
            const trainerVolumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
            const memberMusicVolumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;
            trainerVolumeBar.value = jsonData.trainerVolume;
            memberMusicVolumeBar.value = jsonData.memberMusicVolume;
        
            if ( jsonData.trainerVolume == 0 )
              this.isBWCMutedTrainer = true;
            if ( jsonData.memberMusicVolume == 0 )
              this.isBWCMutedMemberMusic = true;
            if (this.isBWCMutedMemberMusic == false) {
              (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
              (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
            } else {
              (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
              (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
            }
            if (this.isBWCMutedTrainer == false) {
              (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
              (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
            } else {
              (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
              (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
            }
            commonRangeProgress(document.getElementById('bwc_trainerMicVolumeBar'));
            commonRangeProgress(document.getElementById('bwc_memberMusicVolumeBar'));
          }  
          if ( jsonData.isShowingCoach != showCoachingFlag ){
            showCoachingFlag = jsonData.isShowingCoach;
            if ( this.role == ROLE_COACH ){
              document.getElementById("coachSwitch").click();
            } else {
              columnPartition();  
            }
          }  
        }
      }
    });

    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
        const jsonData = JSON.parse(dataMessage.text());
        console.log(WorkoutApp.DATA_MESSAGE_TOPIC_VIDEO_STATUS+':'+dataMessage.text());
        if (jsonData.id == "VideoStatus") {
          if (jsonData.isOver == true) {
            this.isWorkoutOver = true;
//             this.BackToDashboard(true);
          } else {
            if (this.videoInfoList != null )
              this.videoInfo = this.videoInfoList.Data[parseInt(jsonData.videoIndex)];
            else
              return;
            if ( jsonData.recordingFlag != recordingFlag ){
              recordingFlag = jsonData.recordingFlag;
              if ( trainerFlag )
                $("#recordingSwitch").prop('checked', recordingFlag);
              else {
                const buttonRecorder = document.getElementById('button-recorder') as HTMLButtonElement;
                if ( !jsonData.recordingFlag ){
                  buttonRecorder.disabled = true;
                  this.toggleButton('button-recorder','on');
                } else {
                  buttonRecorder.disabled = false;
                  if ( this.isButtonOn('button-recorder') ){
                    this.toggleButton('button-recorder');
                  }
                }      
              }
            }
            if ( trainerFlag ){
              //here we need to reset trainer volume controls
              if (jsonData.memberMusicVolume ) {
                (document.getElementById('memberMusicVolumeBar') as HTMLInputElement).value = jsonData.memberMusicVolume;
                if (parseFloat(jsonData.memberMusicVolume) == 0 ) {
                  this.isMutedMemberMusic = true;
                  this.muteAndUnmuteMemberMusicVolume();
                } else {
                  this.isMutedMemberMusic = false;
                  this.muteAndUnmuteMemberMusicVolume(parseFloat(jsonData.memberMusicVolume));
                }
              } else {
                (document.getElementById('memberMusicVolumeBar') as HTMLInputElement).value = "0.7";
              }
            } else {
              this.bPrivateChating = jsonData.bPrivateChating;
              if ( this.bPrivateChating ){
                //show private chating image instead of trainer
              }
            }
            console.log('check coach mode:'+this.bVirtualCoachWorkout+' '+jsonData.isShowingCoach+' '+showCoachingFlag);
            if ( /*!this.bVirtualCoachWorkout &&*/ jsonData.isShowingCoach == true && showCoachingFlag == false ){
              console.log('switch to virtual coach mode');
              bWithoutCoachFlag = true;
              showCoachingFlag = true;
              $("#coachSwitch").prop('checked', true);
              this.isBWCMutedTrainer = false;
              $('.trainerDiv').addClass('trainerboxhide');
              $('.botDiv').addClass('botboxOnly');
              $('#trainerName').text('Prerecorded Coaching');

              columnPartition();

              if ( this.isFirstPerson && memberFlag ){
                console.log('set coach role');
                $('.showOnlyInbWithoutCoach').removeClass('hide');
                this.role = ROLE_COACH;
                coachFlag = true;
                this.setBWCMixedAudio(1, jsonData.memberMusicVolume);  
              }
            }
            if (jsonData.timeLeft != "0") {
              /*if (parseInt(jsonData.timeLeft) > 0) {
                this.startTimer(parseInt(jsonData.timeLeft), 0);
              }*/
            } else {
              if ( !this.videoInfo )
                return;
              if ( this.bShowCountDownTimer && this.countdownType == 0 ){
                this.onTimesUp(0);
              } else if ( this.bShowCountDownTimer && this.countdownType == 1  )
                return;
              this.playNextVideo(parseInt(jsonData.currentPos));
              if (jsonData.isPaused == true) {
                this.pauseVideo();
              }
            }
            if ( memberFlag && jsonData.isShowingCoach ){
              if ( showCoachingFlag != jsonData.isShowingRecordedCoachVideo){
                showCoachingFlag = jsonData.isShowingRecordedCoachVideo;
                document.getElementById("coachSwitch").click();
              }
              if ( this.role == ROLE_COACH ){
                const trainerVolumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
                const memberMusicVolumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;
                trainerVolumeBar.value = jsonData.coachVideoVolume;
                memberMusicVolumeBar.value = jsonData.memberMusicVolume;
            
                if ( jsonData.coachVideoVolume == 0 )
                  this.isBWCMutedTrainer = true;
                if ( jsonData.memberMusicVolume == 0 )
                  this.isBWCMutedMemberMusic = true;
                if (this.isBWCMutedMemberMusic == false) {
                  (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
                  (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
                } else {
                  (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
                  (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
                }
                if (this.isBWCMutedTrainer == false) {
                  (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
                  (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
                } else {
                  (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
                  (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
                }
                commonRangeProgress(document.getElementById('bwc_trainerMicVolumeBar'));
                commonRangeProgress(document.getElementById('bwc_memberMusicVolumeBar'));
              }
            }
          }
        } else if(jsonData.id == "PlayNextVideo") {
          this.videoInfo = this.videoInfoList.Data[parseInt(jsonData.videoIndex)];
          if ( !this.videoInfo )
             return;
          if ( this.role == ROLE_MEMBER || this.role == ROLE_COACH ){
            ($('#jsLoadingDiv') as any).hide('');
            ($('.jsWaitLoadingParent') as any).hide('');    
            if ( this.isRecording ){
              this.endRecording();
            }
            console.log('button status:'+this.isButtonOn("button-recorder"));
            if ( !this.isButtonOn("button-recorder") && this.videoInfo.ControlName == null ) {
              this.startRecording();
            }
          }
          console.log('check coach mode:'+this.bVirtualCoachWorkout+' '+jsonData.isShowingCoach+' '+showCoachingFlag);
          if ( /*!this.bVirtualCoachWorkout &&*/ jsonData.isShowingCoach == true && bWithoutCoachFlag == false ){
            console.log('switch to virtual coach mode');
            bWithoutCoachFlag = true;
            showCoachingFlag = jsonData.isShowingRecordedCoachVideo;
            $("#coachSwitch").prop('checked', showCoachingFlag);
            this.isBWCMutedTrainer = false;
            $('.trainerDiv').addClass('trainerboxhide');
            $('.botDiv').addClass('botboxOnly');
            if ( showCoachingFlag )
              $('#trainerName').text('Prerecorded Coaching');

            columnPartition();

            if ( this.isFirstPerson && memberFlag ){
              console.log('set coach role');
              $('.showOnlyInbWithoutCoach').removeClass('hide');
              this.role = ROLE_COACH;
              coachFlag = true;
              this.setBWCMixedAudio(1,jsonData.memberMusicVolume);  
            }            
          }
          this.playNextVideo(parseInt(jsonData.currentPos));
        } else if(jsonData.id == "PauseVideo") {
          this.pauseVideo();
          (document.getElementById('unMuteTrainerMusicVolume') as HTMLButtonElement).disabled = true;
          (document.getElementById('unMuteMemberMusicVolume') as HTMLButtonElement).disabled = true;
        } else if (jsonData.id == "PlayVideo") {
          if ( !this.videoInfo )
            return;
          (document.getElementById('jsplayControlDiv') as HTMLInputElement).classList.remove("divOverlay");
          (document.getElementById('selfvolume') as HTMLInputElement).classList.remove("divOverlay");
          (document.getElementById('unMuteTrainerMusicVolume') as HTMLButtonElement).disabled = false;
          (document.getElementById('unMuteMemberMusicVolume') as HTMLButtonElement).disabled = false;
          this.muteAndUnmuteSpeaker(null, true);
          this.muteAndUnmuteMemberMusicVolume();
          const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
          (document.getElementById('autoplayvideo') as HTMLInputElement).classList.add("hide");
          (document.getElementById('autopausevideo') as HTMLInputElement).classList.remove("hide");
          (document.getElementById('jsplayControlDiv') as HTMLInputElement).classList.remove("divOverlay");
          videoElement.play();
          this.setDefaultSetting(false);
        } else if(jsonData.id == "EndVideo") {
          if ( this.role == ROLE_MEMBER || this.role == ROLE_COACH ){
            if ( this.isRecording ){
              this.endRecording();
            }
          }
        } else if(jsonData.id == "threeMinLeft") {
          if ( this.isRuningThreeMinuteLeftTimer )
            return;
          this.isRuningThreeMinuteLeftTimer = true;
          const currentDateTime = new Date();
          const newDateObj = new Date(currentDateTime.getTime() + (3 * 60000));
          $('.botVideo').addClass('bothActive');
          this.startTimer(newDateObj.getTime(), 1);
          this.isWorkoutOver = true;
        } else if(jsonData.id == "MeetingClosed") {
          new AsyncScheduler().start(async () => {
//            await this.leave();
            this.BackToDashboard(true,'bot closed');
          });
        } else if(jsonData.id == "CoachVideoStarted"){
          console.log('Coach started');
        } else if ( jsonData.id == "RecordingVideoStatus" ) {
          if ( this.role == ROLE_COACH || this.role == ROLE_MEMBER ){
            if ( recordingFlag == jsonData.recordingFlag )
              return;
            recordingFlag = jsonData.recordingFlag;
            const buttonRecorder = document.getElementById('button-recorder') as HTMLButtonElement;
            if ( !jsonData.recordingFlag ){
              buttonRecorder.disabled = true;
              this.toggleButton('button-recorder','on');
            } else {
              buttonRecorder.disabled = false;
              if ( this.isButtonOn('button-recorder') ){
                this.toggleButton('button-recorder');
              }
            }
          }
        }
      }
    });
    this.audioVideo.realtimeSubscribeToReceiveDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_OUT_ROOM, (dataMessage: DataMessage) => {
      if (dataMessage.text() != null && dataMessage.text() != '') {
      console.log(WorkoutApp.DATA_MESSAGE_TOPIC_OUT_ROOM+':'+dataMessage.text());
        const jsonData = JSON.parse(dataMessage.text());
        if (jsonData != null) {
          if (jsonData.id == customerId) {
            this.BackToDashboard(false,'kicked out');
          }
        }
      }
    });
  }
  
  joinRoom( roomId: string){
    new AsyncScheduler().start(async () => {
      await this.leave();
      document.getElementById("roster").innerHTML = '';
      this.toggleButton('button-camera');
      this.meeting = roomId;
      this.showProgress('progress-authenticate');
      try {
        this.chimeMeetingId = await this.authenticate();
      } catch (error) {
        console.error(error);
        (document.getElementById(
          'failed-meeting'
        ) as HTMLDivElement).innerText = `${this.meeting}`;
        (document.getElementById('failed-meeting-error') as HTMLDivElement).innerText =
          error.message;
        this.switchToFlow('flow-failed-meeting');
        return;
      }    
      await this.initVoiceFocus();

      let videoInputDevice = (document.getElementById('video-input') as HTMLSelectElement).value;
      let audioInputDevice = (document.getElementById('audio-input') as HTMLSelectElement).value;
      let audioOutputDevice = (document.getElementById('audio-output') as HTMLSelectElement).value;
  
      try {
        const device = await this.videoInputSelectionToDevice(videoInputDevice);
        await this.audioVideo.startVideoInput(device);
      } catch (e) {
        this.log(`failed to choose saved VideoInputDevice ${videoInputDevice}`, e);
      }
  
      try {
        const device = await this.audioInputSelectionToDevice(audioInputDevice);
        await this.selectAudioInputDevice(device);
      } catch (e) {
        this.log(`failed to choose saved audio input device ${audioInputDevice}`, e);
      }
      this.currentAudioInputDevice = audioInputDevice;
      this.updateVoiceFocusDisplayState();
  
      try {
        await this.chooseAudioOutputDevice(audioOutputDevice);
      } catch (e) {
        this.log(`Failed to choose saved AudioOutputDevice ${audioOutputDevice}`, e);
      }
      const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
      try {
        await this.audioVideo.bindAudioElement(audioMix);
      } catch (e) {
        this.log('failed to bindAudioElement', e);
      }  
      (document.getElementById('joinButton') as HTMLInputElement).click();
      this.hideProgress('progress-authenticate');
    });
  }
  
  setBWCMixedAudio(trainerVolume?: any, memberMusicVolume?:any) {
    if ( !coachFlag )
      return;
    const trainerVolumeBar = document.getElementById('bwc_trainerMicVolumeBar') as HTMLInputElement;
    const memberMusicVolumeBar = document.getElementById('bwc_memberMusicVolumeBar') as HTMLInputElement;
    const BWCMixedAudioStatusJson = JSON.parse(window.localStorage.getItem("BWCMixedAudioStatus"));
    if (trainerVolume == null ) {
      trainerVolume = (BWCMixedAudioStatusJson != null ? BWCMixedAudioStatusJson.trainerVolume : null);
    }
    if (memberMusicVolume == null ) {
      memberMusicVolume = (BWCMixedAudioStatusJson != null ? BWCMixedAudioStatusJson.memberMusicVolume : null);
    }

    if (this.isBWCMutedMemberMusic == false) {
      memberMusicVolumeBar.value =  memberMusicVolume ?? "1";
      (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
    } else {
      memberMusicVolumeBar.value = memberMusicVolume ?? "0";
      (document.getElementById('bwc_muteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('bwc_unMuteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
    }
    if (this.isBWCMutedTrainer == false) {
      trainerVolumeBar.value = trainerVolume ?? "1";
      (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
    } else {
      trainerVolumeBar.value = trainerVolume ?? "0";
      (document.getElementById('bwc_muteTrainerMicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('bwc_unMuteTrainerMicVolume') as HTMLButtonElement).classList.remove("hide");
    }
    let jsonMsg = {
      "status": "BWCMixedAudioStatus",
      "isBWCMutedMemberMusic": this.isBWCMutedMemberMusic,
      "isBWCMutedTrainer": this.isBWCMutedTrainer,
      "memberMusicVolume": parseFloat(memberMusicVolumeBar.value),
      "trainerVolume": parseFloat(trainerVolumeBar.value),
      "isShowingCoach": showCoachingFlag
    };
    
    commonRangeProgress(document.getElementById('bwc_trainerMicVolumeBar'));
    commonRangeProgress(document.getElementById('bwc_memberMusicVolumeBar'));
    window.localStorage.setItem("BWCMixedAudioStatus", JSON.stringify(jsonMsg));
    this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
  }

  muteAndUnmuteMicrophone(volume?: any, isNotSaved?: boolean) {
    if (memberFlag) {
      if (this.isMutedMicrophone == false) {
        this.toggleButton('button-microphone','on');
        this.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        this.toggleButton('button-microphone','off');
        this.audioVideo.realtimeMuteLocalAudio();
      }
      let jsonStroage = {
        "isMutedMicrophone": this.isMutedMicrophone
      };
      window.localStorage.setItem("memberMicrophoneMute_" + customerId, JSON.stringify(jsonStroage));
      // let jsonMsg = {
      //   "title": "Onclick",
      //   "id": customerId,
      //   "isMute": this.isMutedMicrophone
      // };
      // this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MUTE_STATUS, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
    } else {
      const trainerMicBarJson = JSON.parse(window.localStorage.getItem("trainerMicBar"));
      if (isNotSaved == true && this.isMutedMicrophone == false) {
        volume = (trainerMicBarJson != null ? trainerMicBarJson.volume : null);
      }
      const volumeBar = document.getElementById('trainerMicBar') as HTMLInputElement;
      if (this.isMutedMicrophone == false) {
        volumeBar.value = volume ?? "1";
        (document.getElementById('unMuteTrainerMic') as HTMLButtonElement).classList.add("hide");
        (document.getElementById('muteTrainerMic') as HTMLButtonElement).classList.remove("hide");
        this.toggleButton('button-microphone','on');
        this.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        volumeBar.value = volume ?? "0";
        (document.getElementById('muteTrainerMic') as HTMLButtonElement).classList.add("hide");
        (document.getElementById('unMuteTrainerMic') as HTMLButtonElement).classList.remove("hide");
        this.toggleButton('button-microphone','off');
        this.audioVideo.realtimeMuteLocalAudio();
      }

      let trainerMicBarJosn = {
        "volume": (isNotSaved == true ? (trainerMicBarJson != null ? trainerMicBarJson.volume : volumeBar.value) : volumeBar.value),
        "isMutedMicrophone": this.isMutedMicrophone
      };
      (window as any).setMicVolume(trainerMicBarJosn.volume);
      window.localStorage.setItem("trainerMicBar", JSON.stringify(trainerMicBarJosn));
      commonRangeProgress(document.getElementById('trainerMicBar'));
    }
  }

  muteAndUnmuteSpeaker(volume?: any, isNotSaved?: boolean, isClickedSpeakerBtn?: boolean) {
    if (volume == null || isNotSaved == false) {
      if (this.isMutedSpeaker && isClickedSpeakerBtn == true) {
        this.isSpeakerSoundPaused = true;
      } else if (!this.isMutedSpeaker && isClickedSpeakerBtn == true) {
        this.isSpeakerSoundPaused = false;
      } 
    }
  }

  unmuteSpeaker() {
    this.isMutedSpeaker = false;
    const speakerBtnElement = document.getElementById(`button-speaker`) as HTMLButtonElement;
    const speakerBtnDropElement = document.getElementById(`button-speaker-drop`) as HTMLButtonElement;
    this.audioVideo.bindAudioElement(document.getElementById(
      'meeting-audio'
    ) as HTMLAudioElement);
    speakerBtnElement.classList.remove("btn-outline-secondary");
    speakerBtnDropElement.classList.remove("btn-outline-secondary");
    speakerBtnElement.classList.add("active");
    speakerBtnDropElement.classList.add("active");
  }

  muteSpeaker() {
    this.isMutedSpeaker = true;
    const speakerBtnElement = document.getElementById(`button-speaker`) as HTMLButtonElement;
    const speakerBtnDropElement = document.getElementById(`button-speaker-drop`) as HTMLButtonElement;
    this.audioVideo.unbindAudioElement();
    speakerBtnElement.classList.remove("active");
    speakerBtnDropElement.classList.remove("active");
    speakerBtnElement.classList.add("btn-outline-secondary");
    speakerBtnDropElement.classList.add("btn-outline-secondary");
  }

  muteAndUnmuteMemberMusicVolume(volume?: any) {
    const volumeBar = document.getElementById('memberMusicVolumeBar') as HTMLInputElement;
    if (this.isMutedMemberMusic == false) {
      volumeBar.value =  volume ?? "0.7";
      (document.getElementById('unMuteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('muteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
    } else {
      volumeBar.value = volume ?? "0";
      (document.getElementById('muteMemberMusicVolume') as HTMLButtonElement).classList.add("hide");
      (document.getElementById('unMuteMemberMusicVolume') as HTMLButtonElement).classList.remove("hide");
    }
    commonRangeProgress(document.getElementById('memberMusicVolumeBar'));
    let jsonMsg = {
      "status": "music",
      "isMutedMemberMusic": this.isMutedMemberMusic,
      "volume": parseFloat(volumeBar.value)
    };
    this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MEMBER_MUSIC_STATUS, JSON.stringify(jsonMsg), WorkoutApp.SIGNAL_MESSAGE_LIFETIME_MS);
  }

  playNextVideo(currentPos: number): void {
    const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
    videoElement.style.display = '';
    if (this.videoInfo) {
      let index = this.videoInfo.Sequence-1;
      if ((document.getElementById('exerciseList_tr_' + index) as HTMLInputElement) != null) {
          $('.tr_exercise').removeClass('highlightGreenBG');
          $('#exerciseList_tr_'+index).addClass('highlightGreenBG');
          // (document.getElementById('exerciseList_tr_' + this.videoInfo.Sequence) as HTMLInputElement).classList.add("highlightGreenBG");
          getAutoScrollList('exerciseList_tr_' + index);
      }
    }
  }

  pauseVideo(): void {
    const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
    (document.getElementById('autoplayvideo') as HTMLInputElement).classList.remove("hide");
    (document.getElementById('autopausevideo') as HTMLInputElement).classList.add("hide");
    (document.getElementById('jsplayControlDiv') as HTMLInputElement).classList.add("divOverlay");
    (document.getElementById('selfvolume') as HTMLInputElement).classList.add("divOverlay");
    videoElement.pause();
  }

  BackToDashboard(done: any, err: string = null) {
    if ( err )
      console.error('back to dashboard:'+err);
    let BackUrl = "";
    if(memberFlag && done){
      BackUrl = this.api_base_url + "Dashboard/Home#survey/"+ this.classScheduleId;
    } else {
      BackUrl =  this.api_base_url + "Dashboard/Home";
    }
    window.location.href = BackUrl;
  }

  startBot(): void {
    new AsyncScheduler().start(async (): Promise<void> => {
      const meetingURL = encodeURIComponent(WorkoutApp.BASE_URL+"bot?ClassScheduleId="+this.classScheduleId+"&WorkoutId="+this.workoutId);
      console.log('meeting:'+meetingURL);
      try {
        const response = await fetch(
          `${WorkoutApp.BASE_URL}bothandler?meetingURL=${meetingURL}&botAction=start`,
          {
            method: 'POST'
          }
        );
        if ( response.status == 200 ){
          this.taskId = await response.text();
          this.taskId.replace('"','');
          console.log('taskid:',this.taskId);
          if ( this.taskId.indexOf("failures") < 0 )
            await this.setTaskId();
        } else
          console.error('failed to start bot.');
      } catch (error) {
        console.error(error.message);
        return;
      }
    });
  }

  async setTaskId(): Promise<any> {
    console.log("taskid:"+this.taskId);
    const response = await fetch(
      this.api_base_url + `Home/SetTaskId?ClassScheduleId=${encodeURIComponent(this.classScheduleId)}&TaskId=${encodeURIComponent(this.taskId)}`,
      {
        method: 'POST',
        mode: 'cors'
      }
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(`Server error: ${json.error}`);
    }
    console.log("settaskid:"+JSON.stringify(json));
    return json;
  }

  // eslint-disable-next-line
  async joinMeeting(): Promise<any> {
    const response = await fetch(
      `${WorkoutApp.BASE_URL}join?title=${encodeURIComponent(
        this.meeting
      )}&name=${encodeURIComponent(this.name)}&region=${encodeURIComponent(this.region)}&role=${encodeURIComponent(this.role)}&customerId=${encodeURIComponent(customerId)}`,
      {
        method: 'POST',
      }
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(`Server error: ${json.error}`);
    }
    return json;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async endMeeting(): Promise<any> {
    await fetch(`${WorkoutApp.BASE_URL}end?title=${encodeURIComponent(this.meeting)}`, {
      method: 'POST',
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAttendee(attendeeId: string): Promise<any> {
    const response = await fetch(
      `${WorkoutApp.BASE_URL}attendee?title=${encodeURIComponent(
        this.meeting
      )}&attendee=${encodeURIComponent(attendeeId)}`
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(`Server error: ${json.error}`);
    }
    return json;
  }

  setupDeviceLabelTrigger(): void {
    // Note that device labels are privileged since they add to the
    // fingerprinting surface area of the browser session. In Chrome private
    // tabs and in all Firefox tabs, the labels can only be read once a
    // MediaStream is active. How to deal with this restriction depends on the
    // desired UX. The device controller includes an injectable device label
    // trigger which allows you to perform custom behavior in case there are no
    // labels, such as creating a temporary audio/video stream to unlock the
    // device names, which is the default behavior. Here we override the
    // trigger to also show an alert to let the user know that we are asking for
    // mic/camera permission.
    //
    // Also note that Firefox has its own device picker, which may be useful
    // for the first device selection. Subsequent device selections could use
    // a custom UX with a specific device id.
    this.audioVideo.setDeviceLabelTrigger(
      async (): Promise<MediaStream> => {
        if (this.isRecorder() || this.isBroadcaster()) {
          throw new Error('Recorder or Broadcaster does not need device labels');
        }
        this.switchToFlow('flow-need-permission');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        this.switchToFlow('flow-devices');
        await this.openAudioInputFromSelectionAndPreview();
        return stream;
      }
    );
  }

  populateDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[]
  ): void {
    const list = document.getElementById(elementId) as HTMLSelectElement;
    while (list.firstElementChild) {
      list.removeChild(list.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      const option = document.createElement('option');
      list.appendChild(option);
      option.text = devices[i].label || `${genericName} ${i + 1}`;
      option.value = devices[i].deviceId;
    }
    if (additionalOptions.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.text = '──────────';
      list.appendChild(separator);
      for (const additionalOption of additionalOptions) {
        const option = document.createElement('option');
        list.appendChild(option);
        option.text = additionalOption;
        option.value = additionalOption;
      }
    }
    if (!list.firstElementChild) {
      const option = document.createElement('option');
      option.text = 'Device selection unavailable';
      list.appendChild(option);
    }
  }

  populateInMeetingDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[],
    additionalToggles: Toggle[] | undefined,
    callback: (name: string) => void
  ): void {
    const menu = document.getElementById(elementId) as HTMLDivElement;
    while (menu.firstElementChild) {
      menu.removeChild(menu.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      this.createDropdownMenuItem(menu, devices[i].label || `${genericName} ${i + 1}`, () => {
        callback(devices[i].deviceId);
      });
    }
    if (additionalOptions.length) {
      this.createDropdownMenuItem(menu, '──────────', () => {}).classList.add('text-center');
      for (const additionalOption of additionalOptions) {
        this.createDropdownMenuItem(
          menu,
          additionalOption,
          () => {
            callback(additionalOption);
          },
          `${elementId}-${additionalOption.replace(/\s/g, '-')}`
        );
      }
    }
    if (additionalToggles?.length) {
      this.createDropdownMenuItem(menu, '──────────', () => {}).classList.add('text-center');
      for (const { name, oncreate, action } of additionalToggles) {
        const id = `toggle-${elementId}-${name.replace(/\s/g, '-')}`;
        const elem = this.createDropdownMenuItem(menu, name, action, id);
        oncreate(elem);
      }
    }
    if (!menu.firstElementChild) {
      this.createDropdownMenuItem(menu, 'Device selection unavailable', () => {});
    }
  }

  createDropdownMenuItem(
    menu: HTMLDivElement,
    title: string,
    clickHandler: () => void,
    id?: string
  ): HTMLButtonElement {
    const button = document.createElement('button') as HTMLButtonElement;
    menu.appendChild(button);
    button.innerText = title;
    button.classList.add('dropdown-item');
    this.updateProperty(button, 'id', id);
    button.addEventListener('click', () => {
      clickHandler();
    });
    return button;
  }

  async populateAllDeviceLists(): Promise<void> {
    await this.populateAudioInputList();
    await this.populateVideoInputList();
    // await this.populateVideoFilterInputList();
    await this.populateAudioOutputList();
  }

  async populateAudioInputList(): Promise<void> {
    const genericName = 'Microphone';
//    const additionalDevices = ['None', '440 Hz'];
    const additionalDevices: string[] = [];
    const additionalToggles = [];

    // This can't work unless Web Audio is enabled.
    if (this.enableWebAudio && this.supportsVoiceFocus) {
      additionalToggles.push({
        name: 'Amazon Voice Focus',
        oncreate: (elem: HTMLElement) => {
          this.voiceFocusDisplayables.push(elem);
        },
        action: () => this.toggleVoiceFocusInMeeting(),
      });
    }

    this.populateDeviceList(
      'audio-input',
      genericName,
      await this.audioVideo.listAudioInputDevices(),
      additionalDevices
    );

    this.populateInMeetingDeviceList(
      'dropdown-menu-microphone',
      genericName,
      await this.audioVideo.listAudioInputDevices(),
      additionalDevices,
      additionalToggles,
      async (name: string) => {
        await this.selectAudioInputDeviceByName(name);
      }
    );
  }

  private isVoiceFocusActive(): boolean {
    return this.currentAudioInputDevice instanceof VoiceFocusTransformDevice;
  }

  private updateVoiceFocusDisplayState(): void {
    const active = this.isVoiceFocusActive();
    this.log('Updating Amazon Voice Focus display state:', active);
    for (const elem of this.voiceFocusDisplayables) {
      elem.classList.toggle('vf-active', active);
    }
  }

  private isVoiceFocusEnabled(): boolean {
    this.log('VF supported:', this.supportsVoiceFocus);
    this.log('VF enabled:', this.enableVoiceFocus);
    return this.supportsVoiceFocus && this.enableVoiceFocus;
  }

  private async reselectAudioInputDevice(): Promise<void> {
    const current = this.currentAudioInputDevice;

    if (current instanceof VoiceFocusTransformDevice) {
      // Unwrap and rewrap if Amazon Voice Focus is selected.
      const intrinsic = current.getInnerDevice();
      const device = await this.audioInputSelectionWithOptionalVoiceFocus(intrinsic);
      return this.selectAudioInputDevice(device);
    }

    // If it's another kind of transform device, just reselect it.
    if (isAudioTransformDevice(current)) {
      return this.selectAudioInputDevice(current);
    }

    // Otherwise, apply Amazon Voice Focus if needed.
    const device = await this.audioInputSelectionWithOptionalVoiceFocus(current);
    return this.selectAudioInputDevice(device);
  }

  private async toggleVoiceFocusInMeeting(): Promise<void> {
    const elem = document.getElementById('add-voice-focus') as HTMLInputElement;
    this.enableVoiceFocus = this.supportsVoiceFocus && !this.enableVoiceFocus;
    elem.checked = this.enableVoiceFocus;
    this.log('Amazon Voice Focus toggle is now', elem.checked);

    await this.reselectAudioInputDevice();
  }

  async populateVideoInputList(): Promise<void> {
    const genericName = 'Camera';
//    const additionalDevices = ['None', 'Blue', 'SMPTE Color Bars'];
    const additionalDevices: string[] = [];
    this.populateDeviceList(
      'video-input',
      genericName,
      await this.audioVideo.listVideoInputDevices(),
      additionalDevices
    );
    this.populateInMeetingDeviceList(
      'dropdown-menu-camera',
      genericName,
      await this.audioVideo.listVideoInputDevices(),
      additionalDevices,
      undefined,
      async (name: string) => {
        try {
          let res = await this.openVideoInputFromSelection(name, false);
          if ( res == false ){
            this.checkVideoInputError('Error fetching device');
          }
        } catch (err) {
          fatal(err);
          this.log('no video input device selected');
        }
      }
    );
    const cameras = await this.audioVideo.listVideoInputDevices();
    this.cameraDeviceIds = cameras.map((deviceInfo:any) => {
      return deviceInfo.deviceId;
    });
  }

  async populateAudioOutputList(): Promise<void> {
    const supportsChoosing = this.defaultBrowserBehaviour.supportsSetSinkId();
    const genericName = 'Speaker';
    const additionalDevices: string[] = [];
    const devices = supportsChoosing ? await this.audioVideo.listAudioOutputDevices() : [];
    this.populateDeviceList('audio-output', genericName, devices, additionalDevices);
    this.populateInMeetingDeviceList(
      'dropdown-menu-speaker',
      genericName,
      devices,
      additionalDevices,
      undefined,
      async (name: string) => {
        if (!supportsChoosing) {
          return;
        }
        let deviceidTosave = name;
        try {
          await this.chooseAudioOutputDevice(name);
        } catch (e) {
          deviceidTosave = 'None';
          fatal(e);
          this.log('Failed to chooseAudioOutputDevice', e);
        }
        window.localStorage.setItem('WFTR_audiooutput', deviceidTosave);
        const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
        try {
          await this.audioVideo.bindAudioElement(audioMix);
        } catch (e) {
          fatal(e);
          this.log('failed to bindAudioElement', e);
        }      
      }
    );
  }

  private async chooseAudioOutputDevice(device: string): Promise<void> {
    // Set it for the content share stream if we can.
    // const videoElem = document.getElementById('botVideo') as HTMLVideoElement;
    if (this.defaultBrowserBehaviour.supportsSetSinkId()) {
      // @ts-ignore
      // videoElem.setSinkId(device);
    }

    await this.audioVideo.chooseAudioOutput(device);
  }

  private analyserNodeCallback = () => {};

  async selectedAudioInput(): Promise<AudioInputDevice> {
    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    const device = await this.audioInputSelectionToDevice(audioInput.value);
    return device;
  }

  async selectAudioInputDevice(device: AudioInputDevice): Promise<void> {
    this.log('Selecting audio input', device);
//injected for adjusting volume
    if (!isAudioTransformDevice(device)) {
      const volumeTransformDevice = new VolumeTransformDevice(device);
      
      // Make `setVolume` visible to the page so we can change it!
      (window as any).setMicVolume = volumeTransformDevice.setVolume.bind(volumeTransformDevice);
      this.currentAudioInputDevice = volumeTransformDevice;
    } else
      this.currentAudioInputDevice = device;
//-----
    let deviceidTosave = device.toString();
    try {
      await this.audioVideo.startAudioInput(device);
    } catch (e) {
      deviceidTosave = 'None';
      fatal(e);
      this.log(`failed to choose audio input device ${device}`, e);
    }
    window.localStorage.setItem('WFTR_audioinput', deviceidTosave);
    this.updateVoiceFocusDisplayState();
  }

  async selectAudioInputDeviceByName(name: string): Promise<void> {
    this.log('Selecting audio input device by name:', name);
    const device = await this.audioInputSelectionToDevice(name);
    await this.selectAudioInputDevice(device);
    this.startAudioPreview();
  }

  async openAudioInputFromSelection(): Promise<void> {
    const device = await this.selectedAudioInput();
    await this.selectAudioInputDevice(device);
  }

  async openAudioInputFromSelectionAndPreview(): Promise<void> {
    await this.stopAudioPreview();
    await this.openAudioInputFromSelection();
    this.log('Starting audio preview.');
    this.bAudioMeterPreview = true;
    await this.startAudioPreview();
  }

  setAudioPreviewPercent(percent: number): void {
    const audioPreview = document.getElementById('audio-preview');
    if (!audioPreview) {
      return;
    }
    this.updateProperty(audioPreview.style, 'transitionDuration', '33ms');
    this.updateProperty(audioPreview.style, 'width', `${percent}%`);
    if (audioPreview.getAttribute('aria-valuenow') !== `${percent}`) {
      audioPreview.setAttribute('aria-valuenow', `${percent}`);
    }
  }

  stopVideoPreview() {
    this.audioVideo.stopVideoPreviewForVideoInput(
      document.getElementById('video-preview') as HTMLVideoElement
    );
  }

  async stopAudioPreview(): Promise<void> {
    this.bAudioMeterPreview = false;
    // if (!this.analyserNode) {
    //   return;
    // }

    // this.analyserNodeCallback = () => {};

    // // Disconnect the analyser node from its inputs and outputs.
    // this.analyserNode.disconnect();
    // this.analyserNode.removeOriginalInputs();

    // this.analyserNode = undefined;
  }

  startAudioPreview(): void {
    this.setAudioPreviewPercent(0);

    // Recreate.
    if (this.analyserNode) {
      // Disconnect the analyser node from its inputs and outputs.
      this.analyserNode.disconnect();
      this.analyserNode.removeOriginalInputs();

      this.analyserNode = undefined;
    }

    const analyserNode = this.audioVideo.createAnalyserNodeForAudioInput();

    if (!analyserNode) {
      return;
    }

    if (!analyserNode.getByteTimeDomainData) {
      document.getElementById('audio-preview').parentElement.style.visibility = 'hidden';
      return;
    }

    this.analyserNode = analyserNode;
    const data = new Uint8Array(analyserNode.fftSize);
    let frameIndex = 0;
    this.analyserNodeCallback = () => {
      if (frameIndex === 0) {
        analyserNode.getByteTimeDomainData(data);
        const lowest = 0.01;
        let max = lowest;
        for (const f of data) {
          max = Math.max(max, (f - 128) / 128);
        }
        let normalized = (Math.log(lowest) - Math.log(max)) / Math.log(lowest);
        let percent = Math.min(Math.max(normalized * 100, 0), 100);
        if ( this.bAudioMeterPreview ){
          this.setAudioPreviewPercent(percent);
        }
        else {
          const trainerMicVolumeBar = document.getElementById('trainerMicBar') as HTMLInputElement;
          let trainerMicAverage = (parseFloat(trainerMicVolumeBar.value) == 0 ? 0 : (percent * (parseFloat(trainerMicVolumeBar.value))));
          commonRangeProgress(document.getElementById('trainerMicBar'));
          $("#trainer_mic_meter .sound_track ul li").each(function () {
            let ths = $(this);
            let level = ths.data("level");
            ths.css("background-color", "#cecece");
            // if (level <= ((Number(normalized)) == 1 ? 100 : ((Number(normalized)) * 100))) {
            //   ths.css("background-color", "transparent");
            // }
            if (level <= trainerMicAverage) {
              ths.css("background-color", "transparent");
            }
          });  
        }
      }
      frameIndex = (frameIndex + 1) % 2;
      requestAnimationFrame(this.analyserNodeCallback);
    };
    requestAnimationFrame(this.analyserNodeCallback);
  }

  async openAudioOutputFromSelection(): Promise<void> {
    if (this.defaultBrowserBehaviour.supportsSetSinkId()) {
      let deviceidTosave = 'None';
      try {
        const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
        await this.chooseAudioOutputDevice(audioOutput.value);
        deviceidTosave = audioOutput.value;
      } catch (e) {
        fatal(e);
        this.log('failed to chooseAudioOutputDevice', e);
      }
      window.localStorage.setItem('WFTR_audiooutput', deviceidTosave);
    }
    const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
    try {
      await this.audioVideo.bindAudioElement(audioMix);
    } catch (e) {
      fatal(e);
      this.log('failed to bindAudioElement', e);
    }
  }

  private selectedVideoInput: string | null = null;
  public async openVideoInputFromSelection(selection: string | null, showPreview: boolean): Promise<boolean> {
    if (selection) {
      this.selectedVideoInput = selection;
    }
    this.log(`Switching to: ${this.selectedVideoInput}`);
    const device = await this.videoInputSelectionToDevice(this.selectedVideoInput);
    if (device === null) {
      if (showPreview) {
        this.audioVideo.stopVideoPreviewForVideoInput(
          document.getElementById('video-preview') as HTMLVideoElement
        );
      }
      try {
        await this.audioVideo.stopVideoInput();
      } catch (e) {
        fatal(e);
        this.log(`failed to stop video input`, e);
      }
      this.log('no video device selected');
      this.toggleButton('button-camera', 'off');
      // choose video input null is redundant since we expect stopLocalVideoTile to clean up
      try {
        await this.audioVideo.startVideoInput(device);
      } catch (e) {
        fatal(e);
        this.log(`failed to startVideoInput ${device}`, e);
      }
      throw new Error('no video device selected');
    }
    let deviceidTosave = device.toString();
    let res: boolean = true;
    try {
      await this.audioVideo.startVideoInput(device);
    } catch (e) {
      deviceidTosave = 'None';
      if ( (document.getElementById('video-input') as HTMLSelectElement).children.length == 1 )
        fatal(e);
      else
        res = false;
      this.log(`failed to startVideoInput ${device}`, e);
    }
    window.localStorage.setItem('WFTR_videoinput', deviceidTosave);

    if (showPreview) {
      this.audioVideo.startVideoPreviewForVideoInput(
        document.getElementById('video-preview') as HTMLVideoElement
      );
    }
    return res;
  }

  private async audioInputSelectionToIntrinsicDevice(value: string): Promise<Device> {
    if (this.isRecorder() || this.isBroadcaster()) {
      return null;
    }

    if (value === '440 Hz') {
      return DefaultDeviceController.synthesizeAudioDevice(440);
    }

    if (value === 'None') {
      return null;
    }

    return value;
  }

  private async getVoiceFocusDeviceTransformer(): Promise<VoiceFocusDeviceTransformer> {
    if (this.voiceFocusTransformer) {
      return this.voiceFocusTransformer;
    }
    const logger = new ConsoleLogger('SDK', LogLevel.DEBUG);
    const transformer = await VoiceFocusDeviceTransformer.create(VOICE_FOCUS_SPEC, { logger });
    this.voiceFocusTransformer = transformer;
    return transformer;
  }

  private async createVoiceFocusDevice(inner: Device): Promise<VoiceFocusTransformDevice | Device> {
    if (!this.supportsVoiceFocus) {
      return inner;
    }

    if (this.voiceFocusDevice) {
      // Dismantle the old one.
      return (this.voiceFocusDevice = await this.voiceFocusDevice.chooseNewInnerDevice(inner));
    }

    try {
      const transformer = await this.getVoiceFocusDeviceTransformer();
      const vf: VoiceFocusTransformDevice = await transformer.createTransformDevice(inner);
      if (vf) {
        return (this.voiceFocusDevice = vf);
      }
    } catch (e) {
      // Fall through.
    }
    return inner;
  }

  private async audioInputSelectionWithOptionalVoiceFocus(
    device: Device
  ): Promise<Device | VoiceFocusTransformDevice> {
    if (this.isVoiceFocusEnabled()) {
      if (!this.voiceFocusDevice) {
        return this.createVoiceFocusDevice(device);
      }

      // Switch out the inner if needed.
      // The reuse of the Voice Focus device is more efficient, particularly if
      // reselecting the same inner -- no need to modify the Web Audio graph.
      // Allowing the Voice Focus device to manage toggling Voice Focus on and off
      // also
      return (this.voiceFocusDevice = await this.voiceFocusDevice.chooseNewInnerDevice(device));
    }

    return device;
  }

  private async audioInputSelectionToDevice(
    value: string
  ): Promise<Device | VoiceFocusTransformDevice> {
    const inner = await this.audioInputSelectionToIntrinsicDevice(value);
    return this.audioInputSelectionWithOptionalVoiceFocus(inner);
  }

  private async videoInputSelectionToDevice(value: string): Promise<VideoInputDevice> {
    if (this.isRecorder() || this.isBroadcaster() || value === 'None') {
      return null;
    }
    return value;
  }

  private initContentShareDropDownItems(): void {
    let item = document.getElementById('dropdown-item-content-share-screen-capture');
    item.addEventListener('click', () => {
      this.contentShareType = ContentShareType.ScreenCapture;
      this.contentShareStart();
    });

    document.getElementById('content-share-item').addEventListener('change', () => {
      const fileList = document.getElementById('content-share-item') as HTMLInputElement;
      const file = fileList.files[0];
      if (!file) {
        this.log('no content share selected');
        return;
      }
      const url = URL.createObjectURL(file);
      this.log(`content share selected: ${url}`);
      this.contentShareType = ContentShareType.VideoFile;
      this.contentShareStart(url);
      fileList.value = '';
      (document.getElementById('dropdown-item-content-share-file-item') as HTMLDivElement).click();
    });

    document.getElementById('dropdown-item-content-share-stop').addEventListener('click', () => {
      this.contentShareStop();
    });
  }

  private async playToStream(videoFile: HTMLVideoElement): Promise<MediaStream> {
    await videoFile.play();

    if (this.defaultBrowserBehaviour.hasFirefoxWebRTC()) {
      // @ts-ignore
      return videoFile.mozCaptureStream();
    }

    // @ts-ignore
    return videoFile.captureStream();
  }

  private async contentShareStart(videoUrl?: string): Promise<void> {
    switch (this.contentShareType) {
      case ContentShareType.ScreenCapture: {
        try {
          await this.audioVideo.startContentShareFromScreenCapture();
        } catch (e) {
          this.meetingLogger?.error(`Could not start content share: ${e}`);
          return;
        }
        break;
      }
      case ContentShareType.VideoFile: {
        const videoFile = document.getElementById('content-share-video') as HTMLVideoElement;
        if (videoUrl) {
          videoFile.src = videoUrl;
        }

        const mediaStream = await this.playToStream(videoFile);
        try {
          // getDisplayMedia can throw.
          await this.audioVideo.startContentShare(mediaStream);
        } catch (e) {
          this.meetingLogger?.error(`Could not start content share: ${e}`);
          return;
        }
        break;
      }
    }

    this.toggleButton('button-content-share', 'on');
    this.updateContentShareDropdown(true);
  }

  private async contentShareStop(): Promise<void> {
    this.audioVideo.stopContentShare();
    this.toggleButton('button-pause-content-share', 'off');
    this.toggleButton('button-content-share', 'off');
    this.updateContentShareDropdown(false);

    if (this.contentShareType === ContentShareType.VideoFile) {
      const videoFile = document.getElementById('content-share-video') as HTMLVideoElement;
      videoFile.pause();
      videoFile.style.display = 'none';
    }
  }

  private updateContentShareDropdown(enabled: boolean): void {
    document.getElementById('dropdown-item-content-share-screen-capture').style.display = enabled ? 'none' : 'block';
    document.getElementById('dropdown-item-content-share-screen-test-video').style.display = enabled ? 'none' : 'block';
    document.getElementById('dropdown-item-content-share-file-item').style.display = enabled ? 'none' : 'block';
    document.getElementById('dropdown-item-content-share-stop').style.display = enabled ? 'block' : 'none';
  }

  isRecorder(): boolean {
    return new URL(window.location.href).searchParams.get('record') === 'true';
  }

  isBroadcaster(): boolean {
    return new URL(window.location.href).searchParams.get('broadcast') === 'true';
  }

  async stopBot(): Promise<void>{
    try{
      const response = await fetch(
        `${this.api_base_url}Home/StopBot?ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`,        {
          method: 'POST',
          mode: 'cors'
        }
      );
      if ( response.status == 200 )
        console.log('bot stopped successfully.');
    } catch (error) {
      console.error("error:"+error.message);
    }
  }

  async getClassScheduleDetail(): Promise<void> {
    try {
      const response = await fetch(
        this.api_base_url +`Home/GetClassScheduleDetail?WorkoutId=${this.workoutId}&ClassScheduleId=${encodeURIComponent(this.classScheduleId)}`,
        {
          method: 'POST',
          mode: 'cors'
        }
      );
      const json = await response.json();
      console.log("workout time:"+JSON.stringify(json));
      if ( json.Status != false ){
        this.classNo = json.ClassScheduleId;
        this.bVirtualCoachWorkout = json.WithoutCoach;
        if ( this.bVirtualCoachWorkout && memberFlag ){
          bWithoutCoachFlag = true;
          if ( showCoachingFlag == false ){
            this.isBWCMutedTrainer = true;
            $("#coachSwitch").prop('checked', false);
          }
          $('.trainerDiv').addClass('trainerboxhide');
          $('.botDiv').addClass('botboxOnly');
          $('#trainerName').text('Prerecorded Coaching');
          if ( this.role == ROLE_COACH )
            $('.showOnlyInbWithoutCoach').removeClass('hide');
        } else {
          if ( json.TrainerName )
            this.scheduledTrainerName = json.TrainerName;
          (document.getElementById('trainerName') as HTMLSpanElement).innerText = this.scheduledTrainerName;
          (document.getElementById('workout-trainer-name') as HTMLElement).innerText = this.scheduledTrainerName;        
          showCoachingFlag = false;
        }
        this.taskId = json.TaskId;
        let d = new Date(json.StartTime);
        this.startTime = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
        d = new Date(json.EndTime);
        this.endTime = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));                      
        let now = new Date();
        let twelveMinAfterEndTime = new Date(this.endTime.getTime()+60000*12);
        if ( twelveMinAfterEndTime.getTime() < now.getTime() )
          this.BackToDashboard(false,'time mismatch');
        if ( this.startTime.getTime() - now.getTime()>=0){
          console.log('workout will start in' +(this.startTime.getTime() - now.getTime()));
          this.startTimer(this.startTime.getTime(), 0);
        } 
        if ( twelveMinAfterEndTime.getTime() - now.getTime()>=0){
          new TimeoutScheduler(twelveMinAfterEndTime.getTime() - now.getTime()).start( async () => {
            if ( this.isRuningThreeMinuteLeftTimer )
              return;
            this.isRuningThreeMinuteLeftTimer = true;
            const currentDateTime = new Date();
            const newDateObj = new Date(currentDateTime.getTime() + (3 * 60000));
            $('.botVideo').addClass('bothActive');
            this.startTimer(newDateObj.getTime(), 1);
            this.isWorkoutOver = true;  
          });
        }
        let fifteenMinAfterEndTime = new Date(this.endTime.getTime()+60000*15);
        if ( fifteenMinAfterEndTime.getTime() - now.getTime()>=0){
          new TimeoutScheduler(fifteenMinAfterEndTime.getTime() - now.getTime()).start( async () => {
            this.isWorkoutOver = true;
            await this.endMeeting();
            await this.stopBot(); 
            this.BackToDashboard(true,'scheduled timer');
          });
        }
      }
    } catch (error) {
      console.error("error:"+error.message);
    }
  }

  async authenticate(): Promise<string> {
    const joinInfo = (await this.joinMeeting()).JoinInfo;
    if ( !joinInfo ){
      throw new Error('Failed to authenticate. joinInfo is null.');
    }
    this.isJoinedFirst = joinInfo.IsFirst;
    console.log("isJoinedFirst:"+this.isJoinedFirst);
    const configuration = new MeetingSessionConfiguration(joinInfo.Meeting, joinInfo.Attendee);
    await this.initializeMeetingSession(configuration);
    // const url = new URL(window.location.href);
    // url.searchParams.set('m', this.meeting);
    // history.replaceState({}, `${this.meeting}`, url.toString());
    return configuration.meetingId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(str: string, ...args: any[]): void {
    console.log.apply(console, [`[WorkoutApp] ${str}`, ...args]);
  }

  audioVideoDidStartConnecting(reconnecting: boolean): void {
    this.log(`session connecting. reconnecting: ${reconnecting}`);
  }

  audioVideoDidStart(): void {
    this.log('session started');
  }

  audioVideoDidStop(sessionStatus: MeetingSessionStatus): void {
    this.log(`session stopped from ${JSON.stringify(sessionStatus)}`);
    // this.log(`resetting stats in WebRTCStatsCollector`);
    // this.statsCollector.resetStats();
    if (sessionStatus.statusCode() === MeetingSessionStatusCode.MeetingEnded) {
      this.log(`meeting ended`);
      // @ts-ignore
//      window.location = window.location.pathname;
    } else if (sessionStatus.statusCode() === MeetingSessionStatusCode.Left) {
      this.log('left meeting');

      // @ts-ignore
  //    window.location = window.location.pathname;
    }
  }

  createPauseResumeListener(tileState: VideoTileState): (event: Event) => void {
      return (event: Event): void => {
        if (!tileState.paused) {
            this.audioVideo.pauseVideoTile(tileState.tileId);
            // (event.target as HTMLButtonElement).innerText = 'Resume';
            (event.target as HTMLButtonElement).innerHTML = '<i class="fas fa-play"></i>';
          } else {
            this.audioVideo.unpauseVideoTile(tileState.tileId);
            // (event.target as HTMLButtonElement).innerText = 'Pause';
            (event.target as HTMLButtonElement).innerHTML = '<i class="fas fa-pause"></i>';
          }
        }
  }

  videoTileDidUpdate(tileState: VideoTileState): void {
    this.log(`video tile updated: ${JSON.stringify(tileState, null, '  ')}`);
    if (!tileState.boundAttendeeId) {
      return;
    }
    if (tileState.boundAttendeeId.split('#')[1] == "content") {
      if (tileState.boundExternalUserId.split('#')[1] == ROLE_BOT) {
        ($('#jsLoadingDiv') as any).hide('');
        ($('.jsWaitLoadingParent') as any).hide('');
        const videoElement = document.getElementById(`botVideo`) as HTMLVideoElement;
        this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
        if (!this.bShowCountDownTimer)
          videoElement.style.display = 'block';
        if ( !this.bShowCountDownTimer )
          $('#txtWorkoutNote').hide();
        // this.layoutVideoTiles();
        this.botTileId = tileState.tileId;
      }
    } else if (tileState.boundExternalUserId.split('#')[1] == ROLE_TRAINER ) {
      this.bPrivateChating = false;
      //hide private chat image
      this.trainerTileId = tileState.tileId;
      // $('#video-trainer').closest('.trainerDiv').removeClass('hide');
      $('.showOnlyInbWithoutCoach').addClass('hide');
      columnPartition();
      tileColHelper();
      const videoElement = document.getElementById(`trainerVideo`) as HTMLVideoElement;
      (document.getElementById('trainerName') as HTMLSpanElement).innerText = `${tileState.boundExternalUserId.split('#')[0]}`;
      (document.getElementById('workout-trainer-name') as HTMLElement).innerText = `${tileState.boundExternalUserId.split('#')[0]}`;
      this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
      let angle = window.localStorage.getItem("camera_angle");
      if ( !angle )
        angle = "0";
      console.log('saved angle:'+angle);
      if ( trainerFlag ){
        rotation = parseInt(angle)-90;
        $('.jsRotateClick').click();
      }
      else {
        $("#trainer-camera video").css({'-webkit-transform' : 'rotate('+ angle +'deg)',
        '-moz-transform' : 'rotate('+ angle +'deg)',
        '-ms-transform' : 'rotate('+ angle +'deg)',
        'transform' : 'rotate('+ angle +'deg)'});      
      }
      var x = document.getElementById('img_trainerdropped');
      if ( x ) {
        // document.getElementById('trainer-camera').removeChild(x);
        $('#trainer-camera').parent().find('#img_trainerdropped').remove();
      }
      x = document.getElementById('img_privatechating');
      if ( x ) {
        // document.getElementById('trainer-camera').removeChild(x);
        $('#trainer-camera').parent().find('#img_privatechating').remove();
      }
      // document.getElementById('trainerVideo').style.display = "";
      document.getElementById('trainer-camera').style.display = "";
      // this.layoutVideoTiles();
    } else {
      const tileIndex = tileState.localTile
        ? 16
        : this.tileOrganizer.acquireTileIndex(tileState.tileId);
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      const videoElement = document.getElementById(`video-${tileIndex}`) as HTMLVideoElement;
      const nameplateElement = document.getElementById(`customer-name-${tileIndex}`) as HTMLDivElement;
      const customerLocationElement = document.getElementById(`customer-location-${tileIndex}`) as HTMLDivElement;
      const attendeeIdElement = document.getElementById(`attendeeid-${tileIndex}`) as HTMLDivElement;
      const heartBeatCountElement = document.getElementById(`heartBeatCount-${tileIndex}`) as HTMLDivElement;
      const muteButtonElement = document.getElementById(`mute-${tileIndex}`) as HTMLButtonElement;
      const muteStaticElement = document.getElementById(`st-mute-${tileIndex}`) as HTMLButtonElement;
      const oneByOneChatButtonElement = document.getElementById(`btnOneOn1-${tileIndex}`) as HTMLButtonElement;
      const custId = tileState.boundExternalUserId.split('#')[2];
      const customerDetail = this.allCustomerDetail[custId];
      const pauseButtonElement = document.getElementById(
        `video-pause-${tileIndex}`
      ) as HTMLButtonElement;

      pauseButtonElement.removeEventListener('click', this.tileIndexToPauseEventListener[tileIndex]);
      this.tileIndexToPauseEventListener[tileIndex] = this.createPauseResumeListener(tileState);
      pauseButtonElement.addEventListener('click', this.tileIndexToPauseEventListener[tileIndex]);
      if (trainerFlag) {
/*        let jsonMsg = {
          "title": "Onload",
          "id": customerId,
          "tileIndex": tileIndex,
        };
        this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MUTE_STATUS, JSON.stringify(jsonMsg));*/

        muteButtonElement.addEventListener('click', () => {
          const customerId = muteButtonElement.getAttribute('data-customerid');
          const tileIndexOfCustomer = oneByOneChatButtonElement.getAttribute('data-tileindex');
          var isMute = false;
          if (muteButtonElement.classList.contains('unmute')) {
            isMute = true;
          }
          let jsonMsg = {
            "title": "Onclick",
            "id": customerId,
            "tileIndex": tileIndexOfCustomer,
            "isMute": isMute
          };
          this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_MUTE_STATUS, JSON.stringify(jsonMsg));
        });
        oneByOneChatButtonElement.addEventListener('click', () => {
          const customerId = oneByOneChatButtonElement.getAttribute('data-customerid');
          //const tileIndexOfCustomer = oneByOneChatButtonElement.getAttribute('data-tileindex');
          if ( this.bPrivateChating == true )
             return;
          this.bPrivateChating = true;          
          ($('#waitingModal') as any).modal('show');
          new AsyncScheduler().start(async (): Promise<void> => {
            let myuuid = uuidv4();
            let jsonMsg = {
              "customerId": customerId,
              "status": true,
              "roomId": customerId+myuuid.substring(0,8)
            };
            await this.audioVideo.realtimeSendDataMessage(WorkoutApp.DATA_MESSAGE_TOPIC_ONE_BY_ONE_CHAT_STATUS, JSON.stringify(jsonMsg));
            this.joinRoom(jsonMsg.roomId);
            document.getElementById('button-breakout-room-end').classList.remove("hide");
          });
          //this.muteAndUnmuteSpeaker(null);
        });
        oneByOneChatButtonElement.setAttribute('data-customerid', custId);
        oneByOneChatButtonElement.setAttribute('data-tileindex', tileIndex.toString());
        muteStaticElement.style.display = "none";
      } else {
        muteButtonElement.style.display = "none";
        oneByOneChatButtonElement.style.display = "none";
        $(`st-mute-${tileIndex}`).removeAttr('style');
      }

      muteButtonElement.setAttribute('data-customerid', custId);
      muteButtonElement.setAttribute('data-tileindex', tileIndex.toString());
      muteButtonElement.setAttribute('data-attendeeid', tileState.boundAttendeeId);
      muteStaticElement.setAttribute('data-attendeeid', tileState.boundAttendeeId);
      this.log(`binding video tile ${tileState.tileId} to ${videoElement.id}`);
      this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
      this.tileIndexToTileId[tileIndex] = tileState.tileId;
      this.tileIdToTileIndex[tileState.tileId] = tileIndex;
      this.updateProperty(nameplateElement, 'innerText', tileState.boundExternalUserId.split('#')[0]);
      customerLocationElement.setAttribute('data-customerid', custId);
      if ( customerDetail )
        this.updateProperty(customerLocationElement, 'innerText', customerDetail.Location);
      this.updateProperty(attendeeIdElement, 'innerText', tileState.boundAttendeeId);
      heartBeatCountElement.setAttribute('data-customerid', custId);
      this.showTile(tileElement, tileState);
      this.updateGridClasses();
      this.layoutFeaturedTile();
      if (tileIndex != 16) {
        videoElement.classList.add(tileState.boundAttendeeId);
      } else {
        if (memberFlag)
          videoElement.classList.add(tileState.boundAttendeeId);
      }
    }
  }

  videoTileWasRemoved(tileId: number): void {
    if ( tileId == this.trainerTileId && this.role != ROLE_TRAINER ){
      if ( this.bPrivateChating ){
        var x = document.createElement("IMG") as HTMLImageElement;
        x.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/coaching-1on1-portrait.png";
        x.id = 'img_privatechating';
        x.className = 'h100p';
        // document.getElementById('trainer-camera').appendChild(x);
        // document.getElementById('trainerVideo').style.display = "none";
        $(x).appendTo($('#trainer-camera').parent());
        document.getElementById('trainer-camera').style.display = "none";
      } else if ( !this.bVirtualCoachWorkout ){
        var x = document.createElement("IMG") as HTMLImageElement;
        x.src = "https://trainingroomfiles.s3-us-west-2.amazonaws.com/nointernet-1.png";
        x.id = 'img_trainerdropped';
        x.className = 'h100p';
        // document.getElementById('trainer-camera').appendChild(x);
        // document.getElementById('trainerVideo').style.display = "none";
        $(x).appendTo($('#trainer-camera').parent());
        document.getElementById('trainer-camera').style.display = "none";
      }
    }
    else if ( tileId == this.botTileId || tileId == this.coachTileId ){
      
    }
    else {
      const tileIndex = this.tileOrganizer.releaseTileIndex(tileId);
      this.log(`video tileId removed: ${tileId} from tile-${tileIndex}`);
      this.hideTile(tileIndex);
      this.updateGridClasses();
    }
  }

  videoAvailabilityDidChange(availability: MeetingSessionVideoAvailability): void {
    this.canStartLocalVideo = availability.canStartLocalVideo;
    this.log(`video availability changed: canStartLocalVideo  ${availability.canStartLocalVideo}`);
  }

  showTile(tileElement: HTMLDivElement, tileState: VideoTileState): void {
    tileElement.classList.add(`active`);
//    tileElement.style.display = 'block';
    if (tileState.isContent) {
      tileElement.classList.add('content');
    }
  }

  hideTile(tileIndex: number): void {
    const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    tileElement.classList.remove('active', 'featured', 'content');
//    tileElement.style.display = 'none';
  }

  tileIdForAttendeeId(attendeeId: string): number | null {
    for (const tile of this.audioVideo.getAllVideoTiles()) {
      const state = tile.state();
      if (state.boundAttendeeId === attendeeId) {
        return state.tileId;
      }
    }
    return null;
  }

  findContentTileId(): number | null {
    for (const tile of this.audioVideo.getAllVideoTiles()) {
      const state = tile.state();
      if (state.isContent) {
        return state.tileId;
      }
    }
    return null;
  }

  activeTileId(): number | null {
    let contentTileId = this.findContentTileId();
    if (contentTileId !== null) {
      return contentTileId;
    }
    for (const attendeeId in this.roster) {
      if (this.roster[attendeeId].active) {
        return this.tileIdForAttendeeId(attendeeId);
      }
    }
    return null;
  }

  layoutFeaturedTile(): void {
    if (!this.meetingSession) {
      return;
    }
    const tilesIndices = this.visibleTileIndices();
    const localTileId = this.localTileId();
    const activeTile = this.activeTileId();

    for (let i = 0; i < tilesIndices.length; i++) {
      const tileIndex = tilesIndices[i];
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      const tileId = this.tileIndexToTileId[tileIndex];

      if (tileId === activeTile && tileId !== localTileId) {
        tileElement.classList.add('featured');
      } else {
        tileElement.classList.remove('featured');
      }
    }

    this.updateGridClasses();
  }

  updateGridClasses(): void {
    const localTileId = this.localTileId();
    const activeTile = this.activeTileId();

    this.tileArea.className = `v-grid size-${this.availablelTileSize()}`;

    if (activeTile && activeTile !== localTileId) {
      this.tileArea.classList.add('featured');
    } else {
      this.tileArea.classList.remove('featured');
    }
    tileColHelper();
  }

  availablelTileSize(): number {
    return (
      this.tileOrganizer.remoteTileCount + (this.audioVideo.hasStartedLocalVideoTile() ? 1 : 0)
    );
  }

  localTileId(): number | null {
    return this.audioVideo.hasStartedLocalVideoTile()
      ? this.audioVideo.getLocalVideoTile().state().tileId
      : null;
  }

  visibleTileIndices(): number[] {
    const tileKeys = Object.keys(this.tileOrganizer.tiles);
    const tiles = tileKeys.map(tileId => parseInt(tileId));
    return tiles;
  }

  setUpVideoTileElementResizer(): void {
    for (let i = 0; i <= WorkoutTileOrganizer.MAX_TILES; i++) {
      const videoElem = document.getElementById(`video-${i}`) as HTMLVideoElement;
      videoElem.onresize = () => {
        if (videoElem.videoHeight > videoElem.videoWidth) {
          // portrait mode
          videoElem.style.objectFit = 'contain';
          this.log(
            `video-${i} changed to portrait mode resolution ${videoElem.videoWidth}x${videoElem.videoHeight}`
          );
        } else {
          videoElem.style.objectFit = 'cover';
        }
      };
    }
  }

  allowMaxContentShare(): boolean {
    const allowed = new URL(window.location.href).searchParams.get('max-content-share') === 'true';
    if (allowed) {
      return true;
    }
    return false;
  }

  connectionDidBecomePoor(): void {
    this.log('connection is poor');
  }

  connectionDidSuggestStopVideo(): void {
    this.log('suggest turning the video off');
  }

  connectionDidBecomeGood(): void {
    this.log('connection is good now');
  }

  videoSendDidBecomeUnavailable(): void {
    this.log('sending video is not available');
  }

  contentShareDidStart(): void {
    this.log('content share started.');
  }

  contentShareDidStop(): void {
    this.log('content share stopped.');
    if (this.isButtonOn('button-content-share')) {
      this.buttonStates['button-content-share'] = false;
      this.buttonStates['button-pause-content-share'] = false;
      this.displayButtonStates();
      this.updateContentShareDropdown(false);
    }
  }

  contentShareDidPause(): void {
    this.log('content share paused.');
  }

  contentShareDidUnpause(): void {
    this.log(`content share unpaused.`);
  }

  encodingSimulcastLayersDidChange(simulcastLayers: SimulcastLayers): void {
    this.log(
      `current active simulcast layers changed to: ${SimulcastLayerMapping[simulcastLayers]}`
    );
  }

  remoteVideoSourcesDidChange(videoSources: VideoSource[]): void {
    this.log(`available remote video sources changed: ${JSON.stringify(videoSources)}`);
  }

  onTimesUp(type: any) {
    this.bShowCountDownTimer = false;
    clearInterval(timerInterval);
    $('#CountDown').addClass('hide');
    if($('.botVideo').hasClass('bothActive')){
      $('.botVideo').removeClass('bothActive');
      columnPartition();
    }

    if(type == 1){
      new AsyncScheduler().start(async (): Promise<void> => {
        await this.endMeeting();
        await this.stopBot(); 
        this.BackToDashboard(true,'timer times up');
      });
    } else {
        if ( this.botTileId != -1 )
          $('#txtWorkoutNote').hide();
        $('.botVideoParent').show();
        $('#botVideo').show();
    }
  }

  startTimer(time: any, type: any) {
    // Get todays date and time
    let now = new Date().getTime();
    // Find the distance between now an the count down date
    let countDownTime = time - now;
    let CDdate = new Date(countDownTime);
    let CDTHours = CDdate.getUTCHours();
    let CDTMinutes = CDdate.getUTCMinutes();
    let CDTSeconds = CDdate.getUTCSeconds();
    TIME_LIMIT = Math.floor((CDTHours*60)+(CDTMinutes*60)+(CDTSeconds));
    console.log('time_limit:'+TIME_LIMIT);
    this.bShowCountDownTimer = true;
    this.countdownType = type;
    timeSet = now;
    if ( type == 0 ){
        $('#CountDown').html(countDownHTML);
    }
    else if ( type == 1 ){
        $('#CountDown').html(countDownHTML);
        $('#countdown-comment').html(countDownEndText);
    }
    $('#base-timer-label').html(formatTime(TIME_LIMIT));
    if($('.botVideo').hasClass('bothActive')){
        columnPartition()
    }
    else{
      $('.botVideoParent').hide();
      $('#botVideo').hide();
    }
    $('#CountDown').removeClass('hide');
    let colWidth = $('.jsLeftCol').width();
    countDownResize(colWidth);
    timePassed = 0;
    timerInterval = setInterval(() => {
        let now = new Date().getTime();
        // Find the distance between now an the count down date
        let countDownTime = now - timeSet;
        let CDdate = new Date(countDownTime);
        let CDTHours = CDdate.getUTCHours();
        let CDTMinutes = CDdate.getUTCMinutes();
        let CDTSeconds = CDdate.getUTCSeconds();
        let timePassedFromNow = Math.floor((CDTHours*60)+(CDTMinutes*60)+(CDTSeconds));
  
        timePassed = timePassed += 1;
        if ( Math.abs( timePassedFromNow - timePassed ) >= 1 )
          timePassed = timePassedFromNow;
        timeLeft = TIME_LIMIT - timePassed;
        $('#base-timer-label').html(formatTime(timeLeft));
        setCircleDasharray();
        setRemainingPathColor(timeLeft);

        if (timeLeft === 0) {
            this.onTimesUp(type);
        }
    }, 1000);
  }
}
let workoutApp: WorkoutApp = null;
window.addEventListener('load', () => {
  workoutApp = new WorkoutApp();
});

/* jQuery Configurations */

// Column Partitions

function getcolWidth(eleTotalHead: any, eleWHeight: any){
    let colHeight = eleWHeight,
        colWidth = 0;
        if(memberFlag){
            if($('.botVideo').hasClass('bothActive')){
                colWidth = (((colHeight-eleTotalHead)/1.33)*9)/16;
            }
            else{
                colWidth = ((colHeight-eleTotalHead)*9)/16;
            }
        }
        else{
            if($('.botVideo').hasClass('bothActive')){
                colWidth = ((((colHeight-eleTotalHead)/2)/1.33)*9)/16;
            }
            else{
                colWidth = (((colHeight-eleTotalHead)/2)*9)/16;
            }
        }
        return colWidth;
}

function columnPartition(){
    let totHead = $('.jsLeftheader').outerHeight();
    if(trainerFlag){
        totHead = totHead + $('.jsLeftHeader2:visible').outerHeight();
    }
  setTimeout(function(){
    if(totHead > 0){
        let colHeight = $(window).height(),
            colWidth = getcolWidth(totHead, colHeight);
        console.log('colWidth:'+colWidth);
        if(memberFlag){
            if(bWithoutCoachFlag){
                $('.trainerDiv').addClass('trainerboxhide');
                if (showCoachingFlag) {
                  colWidth = colWidth*2;
                  $('#trainerName').removeClass('hide');        
                } else
                  $('#trainerName').addClass('hide');        
                
                // else if (workoutWithFriends && !preRecordVideo) {
                //     colWidth = colWidth*2;
                // }
                tileColHelper()
            } else
              colWidth = colWidth*2;
            $('.jsRotateVid').width((colHeight-totHead)).height((colHeight-totHead)).css('flex', '0 0 '+(colHeight-totHead)+'px');
        }
        else{
            $('.jsRotateVid').width((colHeight-totHead)/2).height((colHeight-totHead)/2).css('flex', '0 0 '+(colHeight-totHead)/2+'px');
        }
        $('.jsLeftCol').width(colWidth).css({'flex': '0 0 '+colWidth+'px'});
        countDownResize(colWidth);
        heartBeatCountFont();
    }
    else{
      columnPartition();
    }
  },100);
}

// Showhide Trainer
function showHideTRtechnicalInfo(eleArr: any){
    for (var i = 0; i < eleArr.length; ++i) {
        if($('#'+eleArr[i]).text() != ""){
            $('#'+eleArr[i]).closest('tr').removeClass('hide');
        }
        else{
            $('#'+eleArr[i]).closest('tr').addClass('hide');
        }
    }
}

          

// Videotile size as per the screen space
function tileColHelper(){
  $('#tile-area').addClass('v-grid');
  let tileDiv = $('.v-grid'),
      visibleTile = $('.v-grid .vidTile:visible'),
      minTileSize = 240,
      windowHeight = $(window).height(),
      windowWidth = $(window).width(),
      totHead = $('.jsTileHeader').outerHeight(),
      colWidth = getcolWidth(totHead, windowHeight),
      jsMembersListWidth = $('.jsMembersList').width();
  let screenWidth;
  if($('.jsMembersList').hasClass('active'))
    jsMembersListWidth = 300;
  else
    jsMembersListWidth = 0;
  if(memberFlag){
    if($('.trainerDiv').is(':visible') || bWithoutCoachFlag){
        screenWidth = (windowWidth-((colWidth*2)+jsMembersListWidth));
    }
    else if($('.trainerDiv').hasClass('trainerboxhide')){
        screenWidth = (windowWidth-((colWidth*2)+jsMembersListWidth));
    }
    else{
      screenWidth = (windowWidth-(colWidth+jsMembersListWidth));
    }
  }
  else
    screenWidth = (windowWidth-(colWidth+jsMembersListWidth));
  let screenHeight = tileDiv.height(),
      colCount = Math.round(screenWidth/minTileSize),
      visibleTileLength = visibleTile.length,
      fitCol = tileColFitHelper(minTileSize, screenWidth, screenHeight, colCount, visibleTileLength);
  tileDiv.removeClass('col1 col2 col3 col4 col5 col6 col7 col8 col9 col10 col11 col12');
  if(fitCol > 1)
    tileDiv.addClass('col'+fitCol); 
}
function tileColFitHelper(minTileSize: any, screenWidth: any, screenHeight: any, colCount: any, visibleTileLength: any){
  for (let i = 1; i < 12; ++i) {
    let setColCount = tileColFinder(minTileSize, screenWidth, screenHeight, colCount, visibleTileLength, i);
    let setColumn = setColCount.setColumn;
    let totalBlock = setColCount.totalBlock;
    if(totalBlock >= visibleTileLength){
      i = 12;
      return setColumn;
    }
  }
}
function tileColFinder(minTileSize: any, screenWidth: any, screenHeight: any, colCount: any, visibleTileLength: any, setCol: any){
  let getTotalBlock;
  if(setCol == 1 && visibleTileLength == 1){
    let blockWidth = ((screenHeight*4)/3)-5;
    let blockHeight = (blockWidth*3)/4;
    getTotalBlock = 1;
    if(blockWidth >= screenWidth){
      blockWidth = screenWidth/setCol;
      blockHeight = (blockWidth*3)/4;
    }
    $('.v-grid .vidTile').each(function(){
        $(this).css({'width': blockWidth, 'height': blockHeight})
    });
  }
  else{
    if(setCol == 1){
        $('.v-grid .vidTile:visible').width('').height('');
    }
    let blockWidth = screenWidth/setCol;
    let blockHeight = (blockWidth*3)/4;
    let getRow = screenHeight/blockHeight;
    getTotalBlock = Math.floor(getRow*setCol);

    $('.v-grid .vidTile').each(function(){
        $(this).css({'width': blockWidth-1, 'height': blockHeight-1})
    });
  }
  return {
    totalBlock: getTotalBlock,
    setColumn: setCol
  };
}

// CountDown Configurations

const FULL_DASH_ARRAY = 283;
const WARNING_THRESHOLD = 10;
const ALERT_THRESHOLD = 5;

const COLOR_CODES = {
    info: {
        color: "theme"
    },
    warning: {
        color: "orange",
        threshold: WARNING_THRESHOLD
    },
    alert: {
        color: "green",
        threshold: ALERT_THRESHOLD
    }
};
let TIME_LIMIT = 300;
let timePassed = 0;
let timeLeft = TIME_LIMIT;
let timeSet: any;
let timerInterval:any = null;
let remainingPathColor = COLOR_CODES.info.color;
let countDownStartText = 'Workout will start in';
let countDownEndText = 'Workout will end in';
let countDownHTML =   '<h3 id="countdown-comment" class="text-center">'+countDownStartText+'</h3>'+
                '<div class="base-timer">'+
                    '<svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
                        '<g class="base-timer__circle">'+
                            '<circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>'+
                            '<path id="base-timer-path-remaining" stroke-dasharray="283" class="base-timer__path-remaining '+remainingPathColor+'" d="M 50, 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"></path>'+
                        '</g>'+
                    '</svg>'+
                    '<span id="base-timer-label" class="base-timer__label">'+formatTime(timeLeft)+'</span>'+
                '</div>';

function formatTime(time: any) {
    const minutes = Math.floor(time / 60);
    let seconds:any = time % 60;
    if (seconds < 10) {
        seconds = `0${seconds}`;
    }
    return `${minutes}:${seconds}`;
}

function setRemainingPathColor(timeLeft: any) {
    const { alert, warning, info } = COLOR_CODES;
    if (timeLeft <= alert.threshold) {
        $('#base-timer-path-remaining').removeClass(warning.color);
        $('#base-timer-path-remaining').addClass(alert.color);
    } else if (timeLeft <= warning.threshold) {
        $('#base-timer-path-remaining').removeClass(info.color);
        $('#base-timer-path-remaining').addClass(warning.color);
    }
}

function calculateTimeFraction() {
  const rawTimeFraction = timeLeft / TIME_LIMIT;
  return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
    const circleDasharray = `${(
        calculateTimeFraction() * FULL_DASH_ARRAY
        ).toFixed(0)} 283`;
    $('#base-timer-path-remaining').attr("stroke-dasharray", circleDasharray);
}

// CountDown Resize Handler
function countDownResize(colWidth: any){
    if($('.botVideo').hasClass('bothActive')){
        colWidth = colWidth/2
    }
    if(memberFlag){
        colWidth = colWidth/2
    }
    if(colWidth < 300){
        $('.base-timer').width(colWidth-20).height(colWidth-20);
        $('#base-timer-label').css({'font-size':(colWidth/5)+'px'});
        $('#countdown-comment').css({'font-size':(colWidth/7)+'px'});
    }
    else{
        $('.base-timer').width(300).height(300);
        $('#base-timer-label').removeAttr('style');
        $('#countdown-comment').removeAttr('style');
    }
}

let rotation = 0;
let cameraDegree:any = "";

function getAutoScrollList(eleScroll:any){
  let $this = $('#left-defaults tr:last'),
      thisHeight = $this.height(),
      scrollDiv = $('#left-defaults'),
      scrollHeight = $(scrollDiv).height(),
      gridTop = scrollHeight * .1,
      gridBottom = scrollHeight + thisHeight,        
      thisTop = $this.offset().top - $(window).scrollTop(),
      eleSTop = $('#'+eleScroll).position().top+46;
      if (thisTop > gridTop && (thisTop + thisHeight) < gridBottom) {
      } else {
          if(scrollHeight < eleSTop){
              if($('#left-defaults .highlightGreenBG').length > 0){
                  scrollDiv.scrollTop(0);
                  scrollDiv.animate({scrollTop: $('#'+eleScroll).position().top-46}, 10);
              }
          }
      }
}

let rotate = function(degrees: any, ele: any) {
    $(ele).css({'-webkit-transform' : 'rotate('+ degrees +'deg)',
                 '-moz-transform' : 'rotate('+ degrees +'deg)',
                 '-ms-transform' : 'rotate('+ degrees +'deg)',
                 'transform' : 'rotate('+ degrees +'deg)'});
};

/* HeartRate Functions */
let heartChartHTML = 
                    '<thead>'+
                        '<tr>'+
                            '<th>Heart Rate</th>'+
                            '<th>Effort</th>'+
                            '<th>Effect</th>'+
                        '</tr>'+
                    '</thead>'+
                    '<tbody>'+
                        '<tr>'+
                            '<td>'+
                                '<div class="veryHard jsHeartRate">171-190</div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Very Hard</strong><span>90-100%</span></div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Performance Redline Zone</strong><span>Developes maximum performance and speed</span></div>'+
                            '</td>'+
                        '</tr>'+
                        '<tr>'+
                            '<td>'+
                                '<div class="hard jsHeartRate">152-171</div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Hard</strong><span>80-90%</span></div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Threshold Zone</strong><span>Increases maximum performance capacity</span></div>'+
                            '</td>'+
                        '</tr>'+
                        '<tr>'+
                            '<td>'+
                                '<div class="moderate jsHeartRate">133-152</div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Moderate</strong><span>70-80%</span></div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Aerobic Zone</strong><span>Improves aerobic fitness</span></div>'+
                            '</td>'+
                        '</tr>'+
                        '<tr>'+
                            '<td>'+
                                '<div class="light jsHeartRate">114-133</div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Light</strong><span>60-70%</span></div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Temperate Zone</strong><span>Improves basic endurance and fat burning</span></div>'+
                            '</td>'+
                        '</tr>'+
                        '<tr>'+
                            '<td>'+
                                '<div class="veryLight jsHeartRate">95-114</div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Very Light</strong><span>50-60%</span></div>'+
                            '</td>'+
                            '<td>'+
                                '<div><strong>Healthy Heart Zone</strong><span>Improves overall health and helps recovery</span></div>'+
                            '</td>'+
                        '</tr>'+
                    '</tbody>'+
                '</table>';
let perCentArr:any = [100, 90, 80, 70, 60, 50];
let popFlagFirst = true;
let cuserId: any = 0;
let cuid = '', cPclass = '', cPage ='';

// Datebox Helper
let getAdjustedDate = function (adjustment:any) {
    let today = new Date();
    // today.setDate(today.getDate() + adjustment);

    let dd = today.getDate();
    let mm = today.getMonth() + 1; //January is 0!

    //let dd = 31;
    //let mm = 12;

    let yyyy = today.getFullYear() + adjustment;
    if (dd < 10) {
        dd = 0 + dd
    };

    if (mm < 10) {
        mm = 0 + mm
    };

    //return mm + '/' + dd + '/' + yyyy;
    // return yyyy + ',' + mm + ',' + dd;
    return yyyy + '-' + mm + '-' + dd;
};

let defaultDate = $('#BirthDate').val() == "" ? new Date(2000, 0, 1) : $('#BirthDate').attr('value');
// console.log(defaultDate);
let maxDate = getAdjustedDate(-7);
let minDate = getAdjustedDate(-100);
let deDate = defaultDate;
let customerBirthday = deDate;
let sOut;

let isYear = new Date(defaultDate).getFullYear();
let currentYear = new Date().getFullYear();
if (currentYear - 7 < isYear) {
    let mm = new Date(defaultDate).getMonth() + 1;
    if (mm < 10) {
        mm = 0 + mm;
    }
    let dd = new Date(defaultDate).getDate();
    if (dd < 10) {
        dd = 0 + dd;
    }
    let Year = currentYear - 7;

    defaultDate = Year + '-' + mm + '-' + dd;
}
else {
    let mm = new Date(defaultDate).getMonth() + 1;
    if (mm < 10) {
        mm = 0 + mm;
    }
    let dd = new Date(defaultDate).getDate();
    if (dd < 10) {
        dd = 0 + dd;
    }
    let Year = isYear;
    defaultDate = Year + '-' + mm + '-' + dd;
}
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const bDate = new Date(defaultDate + ' ' + new Date().getHours() + ':' + new Date().getMinutes());
let infoDate = weekday[bDate.getDay()] + ', ' + monthNames[bDate.getMonth()] + ' ' + bDate.getDate() + ', ' + isYear;
// for AP settings
const daDate = new Date(maxDate);
const dnDate = new Date(minDate);
const dfDate = new Date(defaultDate + ' ' + new Date().getHours() + ':' + new Date().getMinutes());
let maxDateAP = monthNames[daDate.getMonth()] + ' ' + daDate.getDate() + ', ' + daDate.getFullYear();
let minDateAP = monthNames[dnDate.getMonth()] + ' ' + dnDate.getDate() + ', ' + dnDate.getFullYear();
let dDateAP = monthNames[dfDate.getMonth()] + ' ' + dfDate.getDate() + ', ' + dfDate.getFullYear();

// heartBeatCount fontsize
function heartBeatCountFont() {
    let divs = $(".heartBeatCount");
    for(let i = 0; i < divs.length; i++) {
        let relFontsize = ($(divs[i].closest('.vidTile')).width())*0.20;
        divs[i].style.fontSize = relFontsize+'px';
    }
}

// HeartratClass as per percent
function percentClassHelper(elePercent:any){
    let eleClass = "veryveryLight";
    if(elePercent >= 50 && elePercent <= 60){
        eleClass = "veryLight";
    }
    else if(elePercent >= 61 && elePercent <= 70){
        eleClass = "light";
    }
    else if(elePercent >= 71 && elePercent <= 80){
        eleClass = "moderate";
    }
    else if(elePercent >= 81 && elePercent <= 90){
        eleClass = "hard";
    }
    else if(elePercent >= 91 && elePercent <= 100){
        eleClass = "veryHard";
    } else if ( elePercent > 100 )
        eleClass = "brutal";
    return eleClass;
}

function idModifyForPulseElement(userId: any){
    let tempPulseId = userId;
    if(tempPulseId.indexOf('/') != -1){
        tempPulseId = tempPulseId.replace('/', '-slash-');
    }
    else if(tempPulseId.indexOf('==') != -1){
        tempPulseId = tempPulseId.replace('==', '-doubleEqualto-');
    }
    else if(tempPulseId.indexOf('=') != -1){
        tempPulseId = tempPulseId.replace('=', '-equalto-');
    }
    return tempPulseId;
}
function idBackFromPulseElement(userId: any){
    let backId = userId;
    if(backId.indexOf('pulse-') != -1){
        backId = backId.replace('-slash-', '/');
    }
    else if(backId.indexOf('-slash-') != -1){
        backId = backId.replace('-slash-', '/');
    }
    else if(backId.indexOf('-doubleEqualto-') != -1){
        backId = backId.replace('-doubleEqualto-', '==');
    }
    else if(backId.indexOf('-equalto-') != -1){
        backId = backId.replace('-equalto-', '=');
    }
    return backId;
}

function heartRateChartHelper(userId:any , eleEffortClass:any, pAge:any, pDate:any){    
    cPage = pAge;
    $('#heartrateModal .jsAge').attr({'id': 'age-'+userId, 'data-age': cPage}).html( cPage + ' Years Old');
    $('#heartrateModal #BirthDate').val(pDate);
    customerBirthday = pDate;
    cuserId = userId;
    let _template = '<table id="heartdesc-'+userId+'" class="table heartRateTable">'+heartChartHTML;
    if($('#heartrateModal .modal-body .heartRateTable').length == 0){
        $(_template).appendTo($('#heartrateModal .modal-body'));
    }
    // let $currentPopover = null;
}

function BirthDateSaveCallback(customerId:any, birthDate:any) {
  return new Promise(async resolve => {
    try {
      debugger;
      const response = await fetch(WorkoutApp.static_api_base_url + `Home/SaveBirthDate?CustomerId=${encodeURIComponent(customerId)}&BirthDate=${encodeURIComponent(birthDate)}`,
        {
          method: 'POST',
          mode: 'cors'
        }
      );
      const json = await response.json();
      if (json.Status == true) {
        ((document.getElementsByClassName('jsAge'))[0] as HTMLDivElement).classList.remove("hide");
        (document.getElementById('BirthDate') as HTMLInputElement).classList.add("hide");
        ((document.getElementsByClassName('jsEdit'))[0] as HTMLDivElement).classList.remove("hide");
      }
    } catch (error) {

    }

    // Developer needs api to save birthdate as per modified.

    // $.ajax({
    //     url: '/Dashboard/SaveBirthDate',
    //     type: 'POST',
    //     data: { BirthDate: $("#BirthDate").val()},
    //     success: function (respo) {
    //         if (respo.Status) {
    //             $('.jsAge').removeClass('hide');
    //             $("#BirthDate").addClass('hide');
    //             $(".jsEdit").addClass('hide');
    //         }
    //     }
    // });
  });
}

function heartRatePopHelper(userId: any, eleEffortClass: any, pAge: any){
    let heartRateArr:any = [];
    heartRatePerAge(pAge, heartRateArr);
    $('.heartRateTable tbody tr').each(function(i){
        let trDiv = $(this).children('td').find('div');
        if($(trDiv).hasClass(eleEffortClass)){
            $(this).addClass(eleEffortClass);
        }
        $(this).find('.jsHeartRate').text(heartRateArr[i]);
    });
}

function heartRatePerAge(pAge:any , heartRateArr: any){
    let maxAge = 220,
        userAge = pAge,
        difAge:any = maxAge-userAge,
        maxSDif = [];

    for (let i = 0; i < perCentArr.length; i++) {
        if(i == 0){
            maxSDif.push(difAge);
        }
        else{
            let minRate = Math.floor(difAge*(perCentArr[i]/100));
            maxSDif.push(minRate);
            heartRateArr.push(minRate+'-'+(maxSDif[i-1]));
        }
    };
}

function InitDateRangePicker(eTarget: any, deDate: any) {
    try {
        ($("#"+eTarget) as any).AnyPicker({
            mode: "datetime",
            dateTimeFormat: "MMM dd, YYYY",
            inputDateTimeFormat: "MMM dd, YYYY",
            selectedDate: dDateAP,
            minValue: minDateAP,
            maxValue: maxDateAP,
            visibleRows: 3,
            maxRows: 0,
            rowHeight: 30,
            rowsNavigation: "scroller+buttons",
            setButton:
            {
                markup: "<a id='ap-button-set' class='ap-button apsetBtn'>Save</a>",
                type: "Button"
            },
            cancelButton:
            {
                markup: "<a id='ap-button-cancel' class='ap-button apClose'>+</a>",
                type: "Button"
            },
            headerTitle:
            {
                markup: "<h4>YOUR BIRTHDAY</h4><p>used for heart rate and BMI calculation</p>",
                type: "HTML",
                contentBehaviour: "Static", // Static or Dynamic
                format: "" // DateTime Format
            },
            i18n:
            {
                // headerTitle: infoDate,
                headerTitle: "<h4>YOUR BIRTHDAY</h4><p>used for heart rate and BMI calculation</p>",
                type: "HTML",
                setButton: "Save",
                cancelButton: "",
            },
            onSetOutput: function (sOutput: any, oArrSelectedValues: any) {
                // console.log(this);
                $(this.elem).removeClass('fz0').addClass('userDate');
                let dDay = weekday[oArrSelectedValues.date.getDay()];
                sOut = dDay + ', ' + sOutput;
                $(this.elem).val(sOut);
                // console.log('sOut: '+sOut);
                // console.log('sOut: '+this.elem);
                $("#BirthDate").val(sOut);
                customerBirthday = sOut;
                let userAge = getAgeFromDob(sOut);
                $('.jsAge').text(userAge+' Years Old');
                const dateFormatForApi = oArrSelectedValues.date.getFullYear()+'-'+(oArrSelectedValues.date.getMonth() + 1)+'-'+oArrSelectedValues.date.getDay()
                let eleEffortClass = '';
                let pulseSpan = document.getElementById("pulse-"+cuid);
                if ( pulseSpan != null ) {
                    $(pulseSpan).attr('data-age', userAge);
                }
                heartRatePopHelper(cuserId,eleEffortClass, userAge);
                let customerActualId = idBackFromPulseElement(cuid)
                BirthDateSaveCallback(customerActualId, dateFormatForApi);
                // Call api here for storing dob in DB
            // updateDob(sOut);
                //
            }
        });
    } catch (ex) { }
}

function getAgeFromDob(userDob: any){
    // console.log(userDob);
    let dob = new Date(userDob);
    let today = new Date();
    let dAge = today.valueOf()-dob.valueOf();
    let age = Math.floor(dAge / (365.25 * 24 * 60 * 60 * 1000));
    return age;
}

// RangeInput Helper
function commonRangeProgress(ele: any){
  let val = (ele.value - ele.getAttribute('min')) / (ele.getAttribute('max') - ele.getAttribute('min'));
  let percent = val * 100;
  ele.style.backgroundImage = '-webkit-gradient(linear, left top, right top, ' +
        'color-stop(' + percent + '%, #e33d44), ' +
        'color-stop(' + percent + '%, #c7c7c7)' +
        ')';
  ele.style.backgroundImage = '-moz-linear-gradient(left center, #e33d44 0%, #e33d44 ' + percent + '%, #c7c7c7 ' + percent + '%, #c7c7c7 100%)';
}

// Background Slider Helper
function randomNumberArr(totalItem:any){
    // 25 letter
    var itemsFromLetters = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","x","y","z"],
        items = [], itemValArr = [], itemLetterArr = [], itemRandomArr = [];
    for (var i = 0; i < totalItem; i++) {
        items.push(itemsFromLetters[i]);
    }
    var objResults:any = {};
    for(var i = 0; i < 100000; i++){
        // debugger;
        var randomElement = items[Math.floor(Math.random()*items.length)];
        if (objResults[randomElement]){
            objResults[randomElement]++ 
        }
        else{ objResults[randomElement] = 1 }
    }
    // console.log(objResults);
    for (var i = 0; i < items.length; i++) {
        itemValArr.push(objResults[items[i]]);
    }
    itemValArr.sort(function(a, b) {
        return a - b;
    });
    // console.log(itemValArr);
    for (var i = 0; i < itemValArr.length; i++) {
        var number = itemValArr[i];
        for (var i1 = 0; i1 < items.length; i1++) {
            if(number == objResults[items[i1]]){
                itemLetterArr.push(items[i1]);
                itemRandomArr.push(i1);
            }
        }
    }
    // console.log(itemLetterArr);
    // console.log(itemRandomArr);
    return itemRandomArr;
}
function bgSlider(ele:any, eleArr:any, imgArr:any, awsUrl:any){
    for (var i = 0; i < eleArr.length; i++) {
        var totalSlideSeconds = 6*eleArr.length,
            item = '<li style="background-image:url('+awsUrl+''+imgArr[eleArr[i]]+');animation:imageAnimation '+totalSlideSeconds+'s linear infinite 0s;animation-delay:'+(i*6)+'s;"></li>';
        $(item).appendTo(ele);
    }
}

// BubbleTooltip Configurations

var bubbleTooltipTemplate = '<div class="tooltip strictLeft hide" role="tooltip">'+
                                '<div class="bubblePop">'+
                                    '<div class="bubblePopBody">'+
                                        '<div class="tooltip-inner bubbleMsg"></div>'+
                                    '</div>'+
                                '</div>'+
                            '</div>';

var bubbleTooltipOptions = {
    placement: 'bottom',
    container: 'body',
    html: true,
    template:bubbleTooltipTemplate
}

function bubblePopshowHide(){
    ($('.bPopMain') as any).addClass('bPopActive');
    setTimeout(function(){
        ($('.bPopMain') as any).removeClass('bPopActive');
    },10000);
}
// Document Ready Function
$(document).ready(function(){

    // Tooltip
    ($('.jsTooltip') as any).tooltip({
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });

    // BubbleTooltip
    ($('.jsBubbleTooltip') as any).mouseenter(function(){
        // debugger;
        var that = $(this);
        var onTitle = $(this).attr('data-ontitle');
        var offTitle = $(this).attr('data-offtitle');
        // for button in memberside
        if($(this).hasClass('active')){
            $(this).attr('data-original-title', offTitle);
        }
        else{
            $(this).attr('data-original-title', onTitle);
        }

        // for button in trainerside
        if($(this).parents('.onoffswitch').length > 0){
            if($(this).closest('.onoffswitch').children('#recordingSwitch').is(':checked')){
                $(this).attr('data-original-title', onTitle);
            }
            else{
                $(this).attr('data-original-title', offTitle);
            }
        }


        that.tooltip(bubbleTooltipOptions as any);
        that.tooltip('show');
        $('.bs-tooltip-bottom').addClass('hide');
        setTimeout(function(){
            that.tooltip('hide');
        }, 100);
    });

    ($('.jsBubbleTooltip') as any).mouseleave(function(){
        $(this).tooltip('hide');
    });

    ($('.jsBubbleTooltip') as any).on('shown.bs.tooltip', function () {
        var x = $(this).offset().left;
        var y = $(this).offset().top + $(this).height()+15;
       $('.bs-tooltip-bottom').css('transform', 'translate3d('+x+'px, '+y+'px, 0px)');
       setTimeout(function(){
           $('.bs-tooltip-bottom').removeClass('hide');
       },100);
    });

    $(document).on('click', '.jsfullScreenCompressIndication', function(){
        if($(this).hasClass('compressScreenIcon')){
            $(this).removeClass('compressScreenIcon').addClass('fullScreenIcon');
            $(this).closest('.video-tile').removeClass('fullScreenVid');
        }
        else{
            $(this).removeClass('fullScreenIcon').addClass('compressScreenIcon');
            $(this).closest('.video-tile').addClass('fullScreenVid');
        }
    });

    $(document).on('click', '.jsRotateClick', function() {
      if ( !trainerFlag )
        return;
      let eleTarget = $(this).attr('data-target') + " video";
      rotation = ( rotation + 90 ) % 360;
      window.localStorage.setItem("camera_angle", rotation.toString());
      cameraDegree = "cdegree"+rotation;
      $($(this).attr('data-target')).addClass(cameraDegree);
      workoutApp.sendCameraRotationStatus();
      rotate(rotation, eleTarget);
    });

    $(document).on('click', '.tr_exercise', function () {
      if (memberFlag && !coachFlag)
          return;
      let exerciseName = $(this).find(":first-child").text();
      let eleId = $(this).attr('id');
      let itemIndex = eleId.substr(16, eleId.length - 16);
      console.log('clicked:' + itemIndex);
      ($ as any).confirm({
          title: 'Switch Exercise',
          content: 'Do you want to switch to ' + exerciseName + '?',
          icon: 'fa fa-success',
          type: 'green',
          closeIcon: true,
          buttons: {
              Yes: {
                  text: 'Yes',
                  btnClass: 'btn-green',
                  action: function () {
                      workoutApp.switchPlay(itemIndex);
                  }
              },
              No: function () {
              }
          }
      });
    });

    $('#button-restart').on('click', function () {
        if (memberFlag && !coachFlag) {
            return;
        }
        ($ as any).confirm({
            title: 'Restart workout',
            content: 'Are you sure you want to start workout over or reboot exercise video?',
            icon: 'fa fa-warning',
            type: 'red',
            closeIcon: true,
            buttons: {
                restartWorkout: {
                    text: 'Restart',
                    btnClass: 'btn-red',
                    action: function () {
                        workoutApp.restartWorkout();
                    }
                },
                rebootExerciseVideo: {
                    text: 'Reboot',
                    btnClass: 'btn-red',
                    action: function () {
                      workoutApp.rebootBot();
                    }
                },
                cancel: function () {
                }
            }
        });
    });

    $(document).on('click', '[name="slideOptions"]', function() {
        let eleTarget = $(this).val(),
            eleOpTarget = $(this).attr('data-opVal');
            $('[data-parent="'+eleTarget+'"]').addClass('active');
            $('[data-parent="'+eleOpTarget+'"]').removeClass('active');
            $('#option'+eleTarget).addClass('active');
            $('#option'+eleOpTarget).removeClass('active');
    });



    InitDateRangePicker('BirthDate', defaultDate);

    $('#BirthDate').val(infoDate);
    $('#BirthDate').attr('value', infoDate);

    $(document).off('focus click', '#BirthDate');
    $(document).on('focus click', '#BirthDate', function () {
        let eTarget = $(this).attr('id');
        // console.log(deDate);
        const dfnDate = new Date(customerBirthday);
        dDateAP = monthNames[dfnDate.getMonth()] + ' ' + dfnDate.getDate() + ', ' + dfnDate.getFullYear();
        ($(this) as any).AnyPicker("destroy");
        InitDateRangePicker(eTarget, dDateAP);
    });

    $(document).off('click', '.jsAge');
    $(document).on('click', '.jsAge', function () {
        let sTarget = $(this).attr('data-target');
        //$(this).addClass('hide');
        $(sTarget).removeClass('hide');
        $(".jsEdit").removeClass('hide');
        $('#BirthDate').click();
    });

    $(document).off('click', '.jsEdit');
    $(document).on('click', '.jsEdit', function () {
        $('.jsAge').click();
    });

    $(document).off('click', '.jsHrate');
    $(document).on('click', '.jsHrate', function () {
        cuid = $(this).attr('data-uid');
        if ( cuid != customerId )
          return;
        cPclass = $(this).attr('data-pclass');
        cPage = $(this).attr('data-age');
        ($('#heartrateModal') as any).modal('show');
    });
    // $(document).on('click', '.btn-close', function () {
    //   console.log('data-dismiss modal');
    //   workoutApp.bAudioMeterPreview = false;
    // });

    $(document).on('shown.bs.modal', '#heartrateModal', function (ev: any) {
        let uId = cuid;
        if (popFlagFirst) {
            heartRatePopHelper(uId,cPclass, cPage);
            popFlagFirst = false;
        }
        $('.jsAge').removeClass('hide');
        $("#BirthDate").addClass('hide');
    });

    $(document).on('hidden.bs.popover', '#heartrateModal', function (ev: any) {
        popFlagFirst = true;
    });

    $('input[type="range"]').each(function(){
        commonRangeProgress(this);
    });

    $(document).on('mousemove', 'input[type="range"]', function(){
        commonRangeProgress(this);
    });

    $('#button-meeting-end').on('click', function(){
      ($ as any).confirm({
          title: 'End The Workout!',
          content: 'Are you sure you want to end the class for all members attending?',
          icon: 'fa fa-warning',
          type: 'red',
          closeIcon: true,
          buttons: {
              endWorkout: {
                  text: 'End Workout',
                  btnClass: 'btn-red',
                  action: function(){
                      // ($ as any).alert('Confirmed!');
                      workoutApp.confirmEndMeeting();
                  }
              },
              cancel: function () {
                  // ($ as any).alert('Canceled!');
              }
          }
      });
    });
 
    $(document).on('click', '#buttonRightPane', function(){
        var targetId = $(this).attr('data-targetid');
        if($(targetId).hasClass('active')){
            $(targetId).removeClass('active');
        }
        else{
            $(targetId).addClass('active');
        }
        tileColHelper();
    });
    $(".dropdown-toggle").parent().on('show.bs.dropdown', function(){
        var eleClk = $(this).children('.jsDropClick');
        var dropMenu = $(eleClk).next('.dropdown-menu');
        var eleLeft = $(eleClk).offset().left;
        $(eleClk).addClass('jsDrpActive');
        $(dropMenu).css({'left': eleLeft, 'top': 0}).appendTo($('body'));
    });

    $(".dropdown-toggle").parent().on('hidden.bs.dropdown', function(){
        $('body> .dropdown-menu').insertAfter($('.jsDrpActive'));
        $('.jsDrpActive').removeClass('jsDrpActive');
    });

    $(document).on('click', '#coachSwitch', function () {
      if ( !coachFlag )
        return;
      console.log($(this).is(':checked'));
      if ($(this).is(':checked')) {
          if ( showCoachingFlag == true ){
            columnPartition();
            return;
          }
          showCoachingFlag = true;
      }
      else {
          if ( showCoachingFlag == false ){
            columnPartition();
            return;
          }
          showCoachingFlag = false;
      }
      columnPartition();
      workoutApp.sendSwitchCoachVideoStatus();
    });

    $(document).on('click', '#recordingSwitch', function () {
      console.log($(this).is(':checked'));
      if ($(this).is(':checked')) {
        recordingFlag = true;
      }
      else {
        recordingFlag = false;
      }
      workoutApp.sendSwitchRecordingVideoStatus();
    });

    // Background slider on page ready
    var bgItemCount = parseInt($('.bgSlider').attr('data-count')),
        randomArr = randomNumberArr(bgItemCount),
        awsUrl = 'https://trainingroomfiles.s3-us-west-2.amazonaws.com/workout-images/',
        imgArr = ['workout-images-01.jpg', 'WebFitness-Banner-01.jpg', 'workout-images-02.jpg', 'WebFitness-Banner-02.jpg', 'workout-images-03.1.jpg', 'WebFitness-Banner-03.1.jpg', 'workout-images-04.1.jpg', 'WebFitness-Banner-04.1.jpg', 'workout-images-05.jpg', 'WebFitness-Banner-05.1.jpg'];
    bgSlider('.bgSlider', randomArr, imgArr, awsUrl);
});

$(window).resize(function(){
    columnPartition();
    tileColHelper();
});
